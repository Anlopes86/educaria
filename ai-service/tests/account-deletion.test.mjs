import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeletionManager, createDeletionActions, validateDeletionRequest, DELETION_STAGES } from "../account-deletion.js";
import { createAiCreditStore } from "../ai-credit-store.js";

const receipt = "a".repeat(64);
const time = 1_800_000_000_000;
const user = { uid: "teacher-a", auth_time: time / 1000 };
const body = { version: 1, confirmation: "EXCLUIR", receipt };
function fixture() {
    const jobs = new Map();
    let clock = time;
    const calls = [];
    const store = {
        async create(uid, job) { if (!jobs.has(uid)) jobs.set(uid, { ...job }); return jobs.get(uid); },
        async get(uid) { return jobs.get(uid); },
        async list() { return [...jobs.keys()]; },
        async claim(uid, owner, now, ttl) {
            const job = jobs.get(uid);
            if (!job?.pending || job.retryAt > now || job.leaseUntil > now) return null;
            job.leaseOwner = owner; job.leaseUntil = now + ttl;
            return { ...job };
        },
        async renew() { return true; },
        async finish(uid, owner, patch) {
            if (jobs.get(uid).leaseOwner !== owner) return false;
            Object.assign(jobs.get(uid), patch, { leaseOwner: null }); return true;
        }
    };
    const actions = Object.fromEntries(DELETION_STAGES.map((stage) => [stage, async (uid) => { calls.push([stage, uid]); }]));
    const make = () => createDeletionManager({ store, actions, now: () => clock });
    return { jobs, calls, store, actions, make, manager: make(), advance: () => { clock += 4_000_000; } };
}

test("deletion requires recent authentication, explicit confirmation and a valid receipt", () => {
    for (const auth_time of [undefined, 1, time / 1000 + 600]) {
        assert.throws(() => validateDeletionRequest({ ...user, auth_time, iat: time / 1000 }, body, time), { code: "recent_login_required" });
    }
    for (const uid of ["", "../x", "a/b", "..", "x\u0000", "a".repeat(129)]) {
        assert.throws(() => validateDeletionRequest({ ...user, uid }, body, time), { status: 401 });
    }
    for (const invalid of [{}, { ...body, receipt: "short" }, { ...body, version: 2 }, { ...body, confirmation: "yes" }]) {
        assert.throws(() => validateDeletionRequest(user, invalid, time), { status: 400 });
    }
});

test("receipt stores only a hash and permits status, never cross-user access", async () => {
    const f = fixture();
    assert.equal((await f.manager.start(user, body)).status, "pending");
    assert.notEqual(f.jobs.get(user.uid).receiptHash, receipt);
    assert.equal(JSON.stringify(f.jobs.get(user.uid)).includes(receipt), false);
    await assert.rejects(f.manager.status("teacher-b", receipt), { status: 404 });
    await assert.rejects(f.manager.status(user.uid, "b".repeat(64)), { status: 404 });
    await assert.rejects(f.manager.start(user, { ...body, receipt: "b".repeat(64) }), { status: 409 });
    assert.equal((await f.manager.start(user, body)).status, "pending");
    assert.equal(f.calls.length, 0);
});

test("successful deletion is ordered, scoped, resumable and preserves AI usage", async () => {
    const f = fixture();
    const credits = createAiCreditStore({ type: "memory" });
    const bucket = { key: "teacher-a:free:2026-09-30", userId: user.uid, day: "2026-09-30", plan: "free" };
    const reserved = await credits.reserve({ ...bucket, amount: 50, limit: 500 });
    await credits.settle({ key: bucket.key, reservationId: reserved.reservationId, amount: 50, limit: 500 });
    await f.manager.start(user, body);
    await f.manager.run();
    const restarted = f.make();
    for (let i = 0; i < 4; i++) await restarted.run();
    assert.deepEqual(f.calls, DELETION_STAGES.map((stage) => [stage, user.uid]));
    assert.equal((await restarted.status(user.uid, receipt)).status, "completed");
    assert.ok(f.jobs.get(user.uid).expiresAt instanceof Date);
    assert.equal((await credits.get(bucket)).used, 50);
    await restarted.run();
    assert.equal(f.calls.length, 5);
});

test("partial failure is retried from its checkpoint, including billing failure", async () => {
    for (const failedStage of DELETION_STAGES) {
        const f = fixture();
        let failing = true;
        f.actions[failedStage] = async () => { if (failing) throw new Error("SECRET_MUST_NOT_LEAK"); };
        await f.manager.start(user, body);
        for (let i = 0; i <= DELETION_STAGES.indexOf(failedStage); i++) await f.manager.run();
        const job = f.jobs.get(user.uid);
        assert.equal(job.stage, DELETION_STAGES.indexOf(failedStage));
        assert.equal((await f.manager.status(user.uid, receipt)).status, "retrying");
        assert.equal(JSON.stringify(job).includes("SECRET"), false);
        await f.manager.run();
        assert.equal(job.attempts, 1);
        failing = false; f.advance();
        const restarted = f.make();
        for (let i = 0; i < 5; i++) await restarted.run();
        assert.equal((await restarted.status(user.uid, receipt)).status, "completed");
    }
});

test("two workers cannot execute the same leased stage concurrently", async () => {
    const f = fixture();
    let release;
    let reached;
    const entered = new Promise((resolve) => { reached = resolve; });
    f.actions.access = () => new Promise((resolve) => { release = resolve; reached(); });
    await f.manager.start(user, body);
    const running = f.manager.run();
    await entered;
    await f.make().run();
    assert.equal(f.jobs.get(user.uid).stage, 0);
    release(); await running;
    assert.equal(f.jobs.get(user.uid).stage, 1);
});

test("storage batches stay on their checkpoint until empty", async () => {
    const f = fixture();
    let batches = 0;
    f.actions.files = async () => ++batches >= 3;
    await f.manager.start(user, body);
    await f.manager.run();
    await f.manager.run(); await f.manager.run();
    assert.equal(f.jobs.get(user.uid).stage, 1);
    await f.manager.run();
    assert.equal(f.jobs.get(user.uid).stage, 2);
});

test("Admin actions use exact teacher paths; 403 is not treated as absent Storage", async () => {
    const calls = [];
    let storageError;
    const missing = () => { throw Object.assign(new Error("gone"), { code: "auth/user-not-found" }); };
    const services = {
        auth: { updateUser: missing, revokeRefreshTokens: missing, deleteUser: missing },
        db: { doc: (path) => path, recursiveDelete: async (ref) => { calls.push(ref); } },
        bucket: () => ({ getFiles: async (options) => {
            calls.push(options);
            if (storageError) throw storageError;
            return [[{ delete: async () => {} }]];
        } })
    };
    const actions = createDeletionActions(() => services, async (uid) => { calls.push(uid); });
    await actions.access(user.uid); await actions.identity(user.uid);
    assert.equal(await actions.files(user.uid), false);
    assert.equal(calls[0].prefix, "teachers/teacher-a/");
    assert.equal(calls[0].autoPaginate, false);
    assert.equal(calls[0].versions, true);
    await actions.content(user.uid);
    assert.equal(calls[1], "teachers/teacher-a");
    storageError = { code: 403 }; await assert.rejects(actions.files(user.uid));
    storageError = { code: 404 }; assert.equal(await actions.files(user.uid), true);
});
