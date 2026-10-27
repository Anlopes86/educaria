import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createRequire } from "node:module";
import { createBetaEnrollment, BETA_POLICY_PATH, BETA_MEMBERS_COLLECTION } from "../../ai-service/beta-enrollment.js";
import { createFirestoreDeletionStore } from "../../ai-service/account-deletion.js";

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) throw new Error("Local emulator required; no production fallback.");
const require = createRequire(new URL("../../ai-service/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const app = initializeApp({ projectId: "demo-educaria-security" }, "beta-tests");
const db = getFirestore(app);
after(async () => { await db.terminate(); await deleteApp(app); });
const oldTime = "2026-10-01T00:00:00Z", cutoff = Date.parse("2026-10-27T14:00:00Z"), newTime = "2026-10-27T14:00:01Z";
const member = uid => db.doc(`${BETA_MEMBERS_COLLECTION}/${uid}`);

test("durable 25-slot admission survives concurrency, retries, deletion and restart", async () => {
    await db.doc(BETA_POLICY_PATH).delete();
    await db.recursiveDelete(db.collection(BETA_MEMBERS_COLLECTION));
    const users = ["legacy", "deleting-legacy", ...Array.from({ length: 35 }, (_, i) => `new-${i}`)];
    const records = users.map(uid => ({ uid, metadata: { creationTime: uid.includes("legacy") ? oldTime : newTime } }));
    const auth = {
        getUser: async uid => records.find(user => user.uid === uid) || { uid, metadata: { creationTime: newTime } },
        listUsers: async (_size, page) => page ? { users: records.slice(20) } : { users: records.slice(0, 20), pageToken: "second" }
    };
    const getServices = () => ({ auth, db });
    const enrollment = createBetaEnrollment({ getServices, now: () => cutoff });
    const deletion = createFirestoreDeletionStore(getServices);
    try {
        await deletion.create("deleting-legacy", { pending: true });
        assert.deepEqual(await enrollment.status(), { enabled: false });
        const active = await enrollment.activate();
        assert.equal(active.newSlots, 25); assert.equal(active.used, 0);
        assert.equal((await member("legacy").get()).data().cohort, "existing");
        assert.equal((await member("deleting-legacy").get()).data().accessBlocked, true);
        await assert.rejects(enrollment.claim("deleting-legacy"), { code: "auth/account-deleting" });
        assert.equal((await enrollment.claim("legacy")).cohort, "existing");
        const entrants = records.filter(user => !user.uid.includes("legacy"));
        const entries = [];
        // Contention can legitimately exhaust Firestore's retries. Failed
        // requests must stay closed and be safely retryable, not grant access.
        // Small simultaneous groups keep the emulator workload bounded.
        for (let index = 0; index < entrants.length; index += 5) {
            const group = entrants.slice(index, index + 5);
            const results = await Promise.allSettled(group.map(user => enrollment.claim(user.uid)));
            for (let item = 0; item < results.length; item++) {
                const result = results[item];
                if (result.status === "rejected") assert.equal(result.reason.code, 10);
                entries.push({ uid: group[item].uid, ...(result.status === "fulfilled" ? result.value : await enrollment.claim(group[item].uid)) });
            }
            assert.ok((await enrollment.status()).used <= 25);
        }
        assert.equal(entries.filter(entry => entry.status === "approved").length, 25);
        assert.equal(entries.filter(entry => entry.status === "waitlisted").length, 10);
        assert.ok(entries.filter(entry => entry.status === "approved").every(entry => entry.freeDailyCredits === 250));
        const waiting = entries.find(entry => entry.status === "waitlisted");
        await Promise.all(Array.from({ length: 3 }, () => enrollment.claim(waiting.uid)));
        assert.equal((await enrollment.status()).waiting, 10);
        const restart = createBetaEnrollment({ getServices, now: () => cutoff + 86400000 });
        await restart.activate({ newSlots: 100, freeDailyCredits: 1000 });
        assert.equal((await restart.status()).newSlots, 25);
        assert.equal((await restart.status()).activatedAt, new Date(cutoff).toISOString());
        const approved = entries.find(entry => entry.status === "approved");
        await deletion.create(approved.uid, { pending: true });
        assert.equal((await member(approved.uid).get()).data().accessBlocked, true);
        await assert.rejects(enrollment.claim(approved.uid), { code: "auth/account-deleting" });
        await restart.remove(approved.uid);
        assert.equal((await restart.claim("replacement")).status, "waitlisted");
        assert.equal((await restart.status()).used, 25);
        await Promise.all([restart.approve(waiting.uid), restart.approve(waiting.uid)]);
        assert.equal((await restart.status()).used, 26); assert.equal((await restart.status()).newSlots, 26);
        assert.equal((await restart.status()).waiting, 10);
        await deletion.create("replacement", { pending: true });
        await assert.rejects(restart.approve("replacement"));
        await restart.remove("replacement"); await restart.remove("replacement");
        assert.equal((await restart.status()).waiting, 9);
        assert.equal((await restart.status()).used, 26);
    } finally {
        await db.doc(BETA_POLICY_PATH).delete();
        await db.recursiveDelete(db.collection(BETA_MEMBERS_COLLECTION));
        await Promise.all([...users, "replacement"].map(uid => db.doc(`accountDeletionJobs/${uid}`).delete()));
    }
});

test("incomplete migration resumes without resetting cutoff and malformed policies fail closed", async () => {
    const auth = { getUser: async uid => ({ uid, metadata: { creationTime: oldTime } }), listUsers: async () => { throw new Error("outage"); } };
    const enrollment = createBetaEnrollment({ getServices: () => ({ db, auth }), now: () => cutoff });
    try {
        await assert.rejects(enrollment.activate());
        assert.equal((await db.doc(BETA_POLICY_PATH).get()).data().state, "preparing");
        auth.listUsers = async () => ({ users: [{ uid: "recover", metadata: { creationTime: oldTime } }] });
        await enrollment.activate({ newSlots: 99 });
        assert.equal((await enrollment.status()).newSlots, 25);
        assert.equal((await member("recover").get()).data().status, "approved");
        await db.doc(BETA_POLICY_PATH).update({ enabled: false });
        await assert.rejects(enrollment.status(), { code: "beta_unavailable" });
        await assert.rejects(enrollment.claim("recover"), { code: "beta_unavailable" });
    } finally {
        await db.doc(BETA_POLICY_PATH).delete(); await member("recover").delete();
    }
});
