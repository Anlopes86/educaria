// Admission is independent of daily AI quotas. A consumed registration slot
// is never replenished by a restart, account deletion or the daily reset.
export const BETA_POLICY_PATH = "platformControl/betaEnrollment";
export const BETA_MEMBERS_COLLECTION = "betaEnrollments";
const failure = (code, message) => Object.assign(new Error(message), { code });
const validUid = uid => typeof uid === "string" && uid.length > 0 && uid.length <= 128 && !/[\s/]/.test(uid);

function policyFrom(snapshot) {
    if (!snapshot.exists) return null;
    const policy = snapshot.data();
    if (!["preparing", "active"].includes(policy.state) || policy.enabled !== (policy.state === "active") || !Number.isFinite(Date.parse(policy.activatedAt))
        || !Number.isInteger(policy.newSlots) || policy.newSlots < 0
        || !Number.isInteger(policy.used) || policy.used < 0 || policy.used > policy.newSlots
        || !Number.isInteger(policy.waiting) || policy.waiting < 0
        || !Number.isInteger(policy.freeDailyCredits) || policy.freeDailyCredits < 1) {
        throw failure("beta_unavailable", "Não foi possível conferir as vagas do beta.");
    }
    return policy;
}

export function betaSummary(policy) {
    return policy?.state === "active"
        ? { enabled: true, newSlots: policy.newSlots, used: policy.used, remaining: policy.newSlots - policy.used,
            waiting: policy.waiting, freeDailyCredits: policy.freeDailyCredits, activatedAt: policy.activatedAt }
        : { enabled: false };
}

export function betaCreditLimit(plan, defaultLimit, membership) {
    return plan === "free" && membership?.status === "approved" && membership.cohort === "new"
        && Number.isInteger(membership.freeDailyCredits) && membership.freeDailyCredits > 0
        ? Math.min(defaultLimit, membership.freeDailyCredits) : defaultLimit;
}

export function createBetaEnrollment({ getServices, now = Date.now }) {
    const policyRef = () => getServices().db.doc(BETA_POLICY_PATH);
    const memberRef = uid => {
        if (!validUid(uid)) throw failure("auth/invalid-id-token", "Sessão inválida.");
        return getServices().db.collection(BETA_MEMBERS_COLLECTION).doc(uid);
    };
    async function status() {
        return betaSummary(policyFrom(await policyRef().get()));
    }
    async function claim(uid) {
        const { auth, db } = getServices();
        const ref = memberRef(uid);
        const user = await auth.getUser(uid);
        if (user.disabled) throw failure("auth/user-disabled", "Conta indisponível.");
        const createdAt = Date.parse(user.metadata?.creationTime);
        if (!Number.isFinite(createdAt)) throw failure("beta_unavailable", "Data do cadastro indisponível.");
        return db.runTransaction(async transaction => {
            const [control, member, deletion] = await Promise.all([
                transaction.get(policyRef()), transaction.get(ref), transaction.get(db.doc(`accountDeletionJobs/${uid}`))
            ]);
            if (deletion.exists) throw failure("auth/account-deleting", "Conta em exclusão.");
            const policy = policyFrom(control);
            if (policy?.state !== "active") return { status: "open" };
            if (member.exists) {
                const saved = member.data();
                if (saved.accessBlocked) throw failure("auth/account-deleting", "Conta em exclusão.");
                if (!["approved", "waitlisted"].includes(saved.status)) throw failure("beta_unavailable", "Cadastro indisponível.");
                return saved;
            }
            const legacy = createdAt <= Date.parse(policy.activatedAt);
            const approved = legacy || policy.used < policy.newSlots;
            const joinedAt = new Date(now()).toISOString();
            const entry = { status: approved ? "approved" : "waitlisted", cohort: legacy ? "existing" : "new", joinedAt,
                ...(approved && !legacy ? { freeDailyCredits: policy.freeDailyCredits } : {}) };
            transaction.create(ref, entry);
            if (!legacy) transaction.update(policyRef(), approved ? { used: policy.used + 1 } : { waiting: policy.waiting + 1 });
            return entry;
        });
    }
    async function readMany(users) {
        const { db } = getServices();
        const policy = policyFrom(await policyRef().get());
        if (policy?.state !== "active") return users.map(() => ({ status: "open" }));
        const result = [];
        for (let offset = 0; offset < users.length; offset += 100) {
            const batch = users.slice(offset, offset + 100);
            const entries = await db.getAll(...batch.map(user => memberRef(user.uid)));
            entries.forEach((entry, index) => result.push(entry.exists ? entry.data()
                : { status: Date.parse(batch[index].createdAt) <= Date.parse(policy.activatedAt) ? "approved" : "pending", cohort: "existing" }));
        }
        return result;
    }
    async function remove(uid) {
        const { db } = getServices();
        const ref = memberRef(uid);
        await db.runTransaction(async transaction => {
            const [control, member] = await Promise.all([transaction.get(policyRef()), transaction.get(ref)]);
            const policy = policyFrom(control);
            if (!member.exists) return;
            if (policy && member.data().status === "waitlisted") transaction.update(policyRef(), { waiting: Math.max(0, policy.waiting - 1) });
            transaction.delete(ref);
        });
    }
    async function approve(uid) {
        const { auth, db } = getServices();
        const ref = memberRef(uid);
        const user = await auth.getUser(uid);
        if (user.disabled) throw failure("beta_unavailable", "Conta desativada.");
        return db.runTransaction(async transaction => {
            const [control, member, deletion] = await Promise.all([
                transaction.get(policyRef()), transaction.get(ref), transaction.get(db.doc(`accountDeletionJobs/${uid}`))
            ]);
            const policy = policyFrom(control);
            if (policy?.state !== "active" || !member.exists || deletion.exists || member.data().accessBlocked) throw failure("beta_unavailable", "Cadastro indisponível.");
            if (member.data().status === "approved") return member.data();
            if (member.data().status !== "waitlisted") throw failure("beta_unavailable", "Cadastro indisponível.");
            const entry = { ...member.data(), status: "approved", approvedAt: new Date(now()).toISOString(), freeDailyCredits: policy.freeDailyCredits };
            transaction.set(ref, entry);
            transaction.update(policyRef(), { used: policy.used + 1, newSlots: Math.max(policy.newSlots, policy.used + 1), waiting: Math.max(0, policy.waiting - 1) });
            return entry;
        });
    }
    async function activate({ newSlots = 25, freeDailyCredits = 250 } = {}) {
        if (!Number.isInteger(newSlots) || newSlots < 1 || newSlots > 1000
            || !Number.isInteger(freeDailyCredits) || freeDailyCredits < 1 || freeDailyCredits > 10000) throw new Error("Invalid beta configuration.");
        const { auth, db } = getServices();
        const policy = await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(policyRef());
            const existing = policyFrom(snapshot);
            if (existing) return existing; // Retrying activation never grants another batch.
            const value = { state: "preparing", enabled: false, activatedAt: new Date(now()).toISOString(), newSlots, freeDailyCredits, used: 0, waiting: 0 };
            transaction.create(policyRef(), value);
            return value;
        });
        if (policy.state === "active") return betaSummary(policy);
        // Materialize existing access BEFORE enforcing rules, so established
        // accounts retain their materials without waiting for the Render service.
        let pageToken;
        const seen = new Set();
        do {
            const page = await auth.listUsers(1000, pageToken);
            const existing = page.users.filter(user => Date.parse(user.metadata?.creationTime) <= Date.parse(policy.activatedAt));
            for (let start = 0; start < existing.length; start += 400) {
                const batch = existing.slice(start, start + 400);
                await db.runTransaction(async transaction => {
                    const current = policyFrom(await transaction.get(policyRef()));
                    if (current.state !== "preparing") return;
                    const deletions = await Promise.all(batch.map(user => transaction.get(db.doc(`accountDeletionJobs/${user.uid}`))));
                    batch.forEach((user, index) => {
                        if (!deletions[index].exists) transaction.set(memberRef(user.uid), {
                            status: "approved", cohort: "existing", joinedAt: policy.activatedAt
                        }, { merge: true });
                    });
                });
            }
            pageToken = page.pageToken;
            if (pageToken && seen.has(pageToken)) throw new Error("Repeated Firebase directory cursor.");
            if (pageToken) seen.add(pageToken);
        } while (pageToken);
        await db.runTransaction(async transaction => {
            const current = policyFrom(await transaction.get(policyRef()));
            if (current.state === "preparing") transaction.update(policyRef(), { state: "active", enabled: true });
        });
        return status();
    }
    return { status, claim, readMany, remove, approve, activate };
}
