import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export const DELETION_COLLECTION = "accountDeletionJobs";
export const DELETION_STAGES = ["access", "files", "content", "billing", "identity"];
const leaseMs = 120_000;
const receiptPattern = /^[a-f0-9]{64}$/;
const validReceipt = (value) => typeof value === "string" && receiptPattern.test(value);
export const validDeletionUid = (uid) => typeof uid === "string" && uid.length > 0 && uid.length <= 128
    && !/[\/\u0000-\u001f\u007f]/.test(uid) && uid !== "." && uid !== "..";
const hashReceipt = (token) => createHash("sha256").update(token).digest("hex");
function hasReceipt(job, receipt) {
    return validReceipt(receipt) && validReceipt(job?.receiptHash)
        && timingSafeEqual(Buffer.from(job.receiptHash, "hex"), Buffer.from(hashReceipt(receipt), "hex"));
}
function failure(status, code, message) {
    return Object.assign(new Error(message), { status, code });
}

export function validateDeletionRequest(user, body, now = Date.now()) {
    if (!validDeletionUid(user?.uid)) throw failure(401, "login_required", "Entre novamente para excluir a conta.");
    const authenticatedAt = Number(user.auth_time);
    const seconds = Math.floor(now / 1000);
    if (!Number.isFinite(authenticatedAt) || authenticatedAt > seconds + 60 || seconds - authenticatedAt > 300) {
        throw failure(401, "recent_login_required", "Confirme sua senha novamente para excluir a conta.");
    }
    // Reject legacy clients: they used DELETE only to clean billing after browser-side deletion.
    if (body?.confirmation !== "EXCLUIR" || body?.version !== 1 || !validReceipt(body?.receipt)) {
        throw failure(400, "invalid_deletion_request", "Atualize a página e confirme a exclusão novamente.");
    }
}

export function createDeletionManager({ store, actions, now = Date.now, report = () => {} }) {
    let running = false;
    return {
        async start(user, body) {
            validateDeletionRequest(user, body, now());
            const job = await store.create(user.uid, {
                receiptHash: hashReceipt(body.receipt), stage: 0, pending: true,
                createdAt: now(), updatedAt: now(), retryAt: 0, attempts: 0, leaseUntil: 0
            });
            if (!hasReceipt(job, body.receipt)) throw failure(409, "deletion_already_requested", "Esta conta já tem uma solicitação de exclusão.");
            return { ok: true, status: job.pending ? "pending" : "completed" };
        },
        async status(uid, receipt) {
            if (!validDeletionUid(uid) || !validReceipt(receipt)) throw failure(404, "not_found", "Solicitação não encontrada neste navegador.");
            const job = await store.get(uid);
            if (!hasReceipt(job, receipt)) throw failure(404, "not_found", "Solicitação não encontrada neste navegador.");
            return { ok: true, status: !job.pending ? "completed" : job.attempts > 0 ? "retrying" : "pending" };
        },
        async run() {
            if (running) return;
            running = true;
            try {
                for (const uid of await store.list()) {
                    if (!validDeletionUid(uid)) continue;
                    const owner = randomUUID();
                    const job = await store.claim(uid, owner, now(), leaseMs);
                    if (!job) continue;
                    let lostLease = false;
                    let renewing = false;
                    const heartbeat = setInterval(async () => {
                        if (renewing) return;
                        renewing = true;
                        try { if (!await store.renew(uid, owner, now(), leaseMs)) lostLease = true; }
                        catch { lostLease = true; }
                        finally { renewing = false; }
                    }, leaseMs / 3);
                    heartbeat.unref?.();
                    try {
                        const stage = DELETION_STAGES[job.stage];
                        if (!stage || !actions[stage]) throw new Error("invalid_stage");
                        // Files are bounded batches. Returning false keeps this checkpoint.
                        const done = await actions[stage](uid);
                        if (!lostLease) {
                            const nextStage = job.stage + (done === false ? 0 : 1);
                            const completed = nextStage >= DELETION_STAGES.length;
                            await store.finish(uid, owner, {
                                stage: nextStage, pending: !completed, attempts: 0, retryAt: 0,
                                updatedAt: now(), leaseUntil: 0,
                                ...(completed ? { expiresAt: new Date(now() + 30 * 86_400_000) } : {})
                            });
                        }
                    } catch {
                        // No provider error text, user data or secrets are persisted/logged.
                        report("account_deletion_stage_failed");
                        if (!lostLease) await store.finish(uid, owner, {
                            attempts: job.attempts + 1, updatedAt: now(), leaseUntil: 0,
                            retryAt: now() + Math.min(3_600_000, 15_000 * 2 ** Math.min(job.attempts, 8))
                        });
                    } finally { clearInterval(heartbeat); }
                }
            } finally { running = false; }
        }
    };
}

export function createFirestoreDeletionStore(getServices) {
    const collection = () => getServices().db.collection(DELETION_COLLECTION);
    let cursor = null;
    async function mutate(uid, callback) {
        const ref = collection().doc(uid);
        return getServices().db.runTransaction(async (tx) => {
            const snapshot = await tx.get(ref);
            return callback(snapshot.exists ? snapshot.data() : null, (fields) => tx.set(ref, fields, { merge: true }));
        });
    }
    return {
        create: (uid, job) => mutate(uid, (existing, write) => { if (!existing) write(job); return existing || job; }),
        get: async (uid) => (await collection().doc(uid).get()).data(),
        async list() {
            // Single-field query, rotating pages: no composite index and no starvation
            // when an earlier job has a long retry delay.
            let query = collection().where("pending", "==", true).orderBy("__name__").limit(20);
            if (cursor) query = query.startAfter(cursor);
            const snapshot = await query.get();
            cursor = snapshot.size === 20 ? snapshot.docs.at(-1).id : null;
            return snapshot.docs.map((doc) => doc.id);
        },
        claim: (uid, owner, time, ttl) => mutate(uid, (job, write) => {
            if (!job?.pending || job.retryAt > time || job.leaseUntil > time) return null;
            write({ leaseOwner: owner, leaseUntil: time + ttl });
            return job;
        }),
        renew: (uid, owner, time, ttl) => mutate(uid, (job, write) => {
            if (!job?.pending || job.leaseOwner !== owner || job.leaseUntil <= time) return false;
            write({ leaseUntil: time + ttl }); return true;
        }),
        finish: (uid, owner, patch) => mutate(uid, (job, write) => {
            if (job?.leaseOwner !== owner || job.leaseUntil <= Date.now()) return false;
            write({ ...patch, leaseOwner: null }); return true;
        })
    };
}

export function createDeletionActions(getServices, clearBilling) {
    const allowMissingUser = async (operation) => {
        try { await operation(); } catch (error) { if (error?.code !== "auth/user-not-found") throw error; }
    };
    return {
        async access(uid) {
            const { auth } = getServices();
            await allowMissingUser(() => auth.updateUser(uid, { disabled: true }));
            await allowMissingUser(() => auth.revokeRefreshTokens(uid));
        },
        async files(uid) {
            const bucket = getServices().bucket();
            let files;
            try {
                [files] = await bucket.getFiles({ prefix: `teachers/${uid}/`, maxResults: 100, autoPaginate: false, versions: true });
            } catch (error) {
                if (Number(error?.code) === 404) return true; // Bucket does not exist; never ignore 403.
                throw error;
            }
            if (!files.length) return true;
            for (let offset = 0; offset < files.length; offset += 10) {
                await Promise.all(files.slice(offset, offset + 10).map((file) => file.delete({ ignoreNotFound: true })));
            }
            return false;
        },
        content: (uid) => getServices().db.recursiveDelete(getServices().db.doc(`teachers/${uid}`)),
        billing: clearBilling,
        identity: (uid) => allowMissingUser(() => getServices().auth.deleteUser(uid))
    };
}
