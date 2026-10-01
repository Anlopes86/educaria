import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createRequire } from "node:module";
import { createDeletionManager, createFirestoreDeletionStore, createDeletionActions } from "../../ai-service/account-deletion.js";

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")
    || !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_STORAGE_EMULATOR_HOST || "")) {
    throw new Error("Worker integration tests require local emulators; no production fallback.");
}
const require = createRequire(new URL("../../ai-service/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const app = initializeApp({ projectId: "demo-educaria-security" }, "deletion-tests");
const db = getFirestore(app);
const bucket = getStorage(app).bucket("demo-educaria-security.appspot.com");
const getServices = () => ({ db, bucket: () => bucket });
after(async () => { await db.terminate(); await deleteApp(app); });

test("Firestore jobs enforce exclusive leases, expired-lease rejection and pagination", async () => {
    const store = createFirestoreDeletionStore(getServices);
    const uid = "lease-test";
    await store.create(uid, { pending: true, retryAt: 0, leaseUntil: 0 });
    const results = await Promise.all([
        store.claim(uid, "worker-a", Date.now(), 60_000),
        store.claim(uid, "worker-b", Date.now(), 60_000)
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const winner = results[0] ? "worker-a" : "worker-b";
    assert.equal(await store.renew(uid, "wrong-owner", Date.now(), 60_000), false);
    assert.equal(await store.renew(uid, winner, Date.now(), 60_000), true);
    assert.equal(await store.finish(uid, "wrong-owner", { pending: false }), false);
    await db.doc(`accountDeletionJobs/${uid}`).update({ leaseUntil: Date.now() - 1 });
    assert.equal(await store.finish(uid, winner, { pending: false }), false);
    assert.ok(await store.claim(uid, "restarted-worker", Date.now(), 60_000));
    assert.equal(await store.finish(uid, "restarted-worker", { pending: false, leaseUntil: 0 }), true);
    for (let index = 0; index < 25; index++) {
        await store.create(`page-${String(index).padStart(2, "0")}`, { pending: true, retryAt: 0, leaseUntil: 0 });
    }
    const first = await store.list();
    const second = await store.list();
    assert.equal(first.length, 20);
    assert.equal(second.length, 5);
    assert.equal(new Set([...first, ...second]).size, 25);
    assert.deepEqual(await store.list(), first);
    for (const item of [...first, ...second]) await db.doc(`accountDeletionJobs/${item}`).delete();
});

test("worker removes only its teacher's real emulator documents and Storage files across restart", async () => {
    const uid = "worker-target";
    const neighbor = "worker-target-other";
    await db.doc(`teachers/${uid}`).set({ name: "Disposable" });
    await db.doc(`teachers/${uid}/classes/orphan/materials/material`).set({ title: "Nested material" });
    await db.doc(`teachers/${neighbor}/lessons/keep`).set({ title: "Keep" });
    await bucket.file(`teachers/${uid}/test.txt`).save("Disposable", { contentType: "text/plain" });
    await bucket.file(`teachers/${neighbor}/keep.txt`).save("Keep", { contentType: "text/plain" });
    const calls = [];
    const services = {
        ...getServices(),
        auth: {
            updateUser: async (target, fields) => { assert.equal(target, uid); assert.equal(fields.disabled, true); calls.push("disabled"); },
            revokeRefreshTokens: async (target) => { assert.equal(target, uid); calls.push("revoked"); },
            deleteUser: async (target) => {
                assert.equal(target, uid);
                assert.equal((await db.doc(`teachers/${uid}`).get()).exists, false);
                assert.equal((await db.doc(`teachers/${uid}/classes/orphan/materials/material`).get()).exists, false);
                calls.push("identity");
            }
        }
    };
    const make = () => createDeletionManager({
        store: createFirestoreDeletionStore(() => services),
        actions: createDeletionActions(() => services, async (target) => { assert.equal(target, uid); calls.push("billing"); })
    });
    const receipt = "d".repeat(64);
    const manager = make();
    await manager.start({ uid, auth_time: Math.floor(Date.now() / 1000) }, { version: 1, confirmation: "EXCLUIR", receipt });
    await manager.run();
    const restarted = make();
    for (let index = 0; index < 6; index++) await restarted.run();
    assert.equal((await restarted.status(uid, receipt)).status, "completed");
    assert.deepEqual(calls, ["disabled", "revoked", "billing", "identity"]);
    assert.equal((await bucket.file(`teachers/${uid}/test.txt`).exists())[0], false);
    assert.equal((await bucket.file(`teachers/${neighbor}/keep.txt`).exists())[0], true);
    assert.equal((await db.doc(`teachers/${neighbor}/lessons/keep`).get()).exists, true);
});
