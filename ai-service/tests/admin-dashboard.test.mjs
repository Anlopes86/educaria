import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createServer } from "node:http";
import { createAdminRouter, parseAdminUids } from "../admin-dashboard.js";
import { usageTestSnapshot } from "../../tools/fixtures/ai-usage.mjs";
import { createAiCreditStore } from "../ai-credit-store.js";

const timestamp = Date.parse("2026-10-12T12:00:00Z");
const teacher = (index, extra = {}) => ({ uid: `teacher-${index}`, displayName: `Professor ${index}`, email: `professor${index}@example.test`,
    metadata: { creationTime: "2026-10-10T12:00:00Z", lastSignInTime: "2026-10-11T12:00:00Z" },
    passwordHash: "never-return-this", passwordSalt: "never-return-this", phoneNumber: "never-return-this",
    customClaims: { secret: "never-return-this" }, providerData: [{ accessToken: "never-return-this" }], ...extra });

async function harness(t, options = {}) {
    const calls = { list: 0, profile: 0, credit: 0, verify: 0, usage: 0 };
    const users = options.users || [teacher(1), teacher(2, { displayName: "André de Teste", disabled: true, customClaims: { plan: "pro" } })];
    const services = {
        auth: { listUsers: async (size, token) => {
            calls.list += 1;
            assert.equal(size, 1000);
            if (options.listError) throw new Error("sensitive-provider-error");
            const start = Number(token || 0);
            return { users: users.slice(start, start + 1000), ...(users.length > start + 1000 ? { pageToken: String(start + 1000) } : {}) };
        } },
        db: { doc: path => { assert.match(path, /^teachers\/teacher-\d+$/); return { path }; },
            getAll: async (...args) => {
                calls.profile += 1;
                assert.deepEqual(args.pop(), { fieldMask: ["institution", "institutionName"] });
                return args.map(() => ({ data: () => ({ institutionName: "Escola de teste", secret: "never-return-this" }) }));
            } }
    };
    const app = express();
    app.use("/api/admin", createAdminRouter({
        getServices: () => services, adminUids: options.adminUids || new Set(["owner"]), now: () => timestamp,
        usageAnalytics: { read: async (filters = {}) => {
            calls.usage += 1;
            calls.usageRefresh = filters.refresh;
            if (options.usageError) throw new Error("sensitive-usage-error");
            return options.usageSnapshot || { events: [], collection: { enabled: true, store: "firestore" }, truncated: false, updatedAt: new Date(timestamp).toISOString() };
        } },
        verifySession: async token => {
            calls.verify += 1;
            if (token === "revoked") throw { code: "auth/id-token-revoked" };
            if (token === "disabled") throw { code: "auth/user-disabled" };
            if (token === "deleting") throw { code: "auth/account-deleting" };
            if (token === "outage") throw { code: "auth/internal-error" };
            return { uid: token, role: "admin", plan: "pro", admin: true };
        },
        getPlan: async user => user.customClaims?.plan === "pro" ? "pro" : "free",
        getCredits: async () => {
            calls.credit += 1;
            if (options.creditError) throw new Error("sensitive-credit-error");
            return { used: 70, remaining: 430, limit: 500, reserved: 0, unlimited: false, store: "firestore" };
        }
    }));
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return { calls, query: (route = "/users", token = "owner", method = "GET") => fetch(`http://127.0.0.1:${server.address().port}/api/admin${route}`, {
        method, headers: token ? { Authorization: `Bearer ${token}` } : {}
    }) };
}

test("UID configuration fails closed and is not an email, role or wildcard grant", () => {
    assert.deepEqual([...parseAdminUids()], []);
    assert.deepEqual([...parseAdminUids(" owner, owner, *, bad/uid, another-owner ")], ["owner", "another-owner"]);
});
test("anonymous access never reads the directory or balances", async t => {
    const h = await harness(t);
    for (const path of ["/access", "/users", "/usage", "/usage/export"]) assert.equal((await h.query(path, "")).status, 401);
    assert.equal(h.calls.list + h.calls.profile + h.calls.credit + h.calls.verify, 0);
});
test("ordinary accounts cannot gain access through claimed roles or after owner primes cache", async t => {
    const h = await harness(t);
    assert.equal((await h.query()).status, 200);
    const prior = { ...h.calls };
    assert.deepEqual(await (await h.query("/access", "teacher")).json(), { ok: true, isAdmin: false });
    assert.equal((await h.query("/users?uid=owner", "teacher")).status, 403);
    assert.equal(h.calls.list, prior.list); assert.equal(h.calls.credit, prior.credit);
});
test("no configured administrator means no administrative access", async t => {
    const h = await harness(t, { adminUids: new Set() });
    assert.equal((await h.query()).status, 403);
    assert.equal(h.calls.list, 0);
});
test("revoked, disabled, deleting and unavailable sessions are rejected before reads", async t => {
    const h = await harness(t);
    for (const token of ["revoked", "disabled", "deleting"]) assert.equal((await h.query("/users", token)).status, 401);
    assert.equal((await h.query("/users", "outage")).status, 503);
    assert.equal(h.calls.list, 0);
});
test("owner receives only allowed fields, fresh balance and private no-store headers", async t => {
    const h = await harness(t);
    const response = await h.query();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("vary"), /Authorization/);
    const payload = await response.json();
    assert.deepEqual(payload.summary, { total: 2, newLast7Days: 2, signedInLast7Days: 2, disabled: 1 });
    assert.equal(payload.users[0].school, "Escola de teste");
    assert.equal(payload.users[0].credits.remaining, 430);
    assert.doesNotMatch(JSON.stringify(payload), /never-return-this|password|secret|providerData|customClaims|accessToken|phoneNumber/);
});
test("search ignores accents and filters are applied across the directory", async t => {
    const h = await harness(t);
    const result = await (await h.query("/users?q=andre&status=disabled&plan=pro")).json();
    assert.equal(result.users.length, 1); assert.equal(result.users[0].name, "André de Teste");
    assert.equal(result.summary.total, 2);
    const empty = await (await h.query("/users?q=not-found")).json();
    assert.equal(empty.users.length, 0); assert.equal(empty.pagination.totalMatches, 0);
});
test("pagination is stable, clamp-safe, and only enriches 20 accounts at a time", async t => {
    const h = await harness(t, { users: Array.from({ length: 27 }, (_, index) => teacher(index)) });
    const first = await (await h.query()).json();
    const last = await (await h.query("/users?page=999")).json();
    assert.equal(first.users.length, 20); assert.equal(last.users.length, 7);
    assert.equal(last.pagination.page, 2); assert.equal(last.summary.total, 27);
    assert.equal(new Set([...first.users, ...last.users].map(user => user.uid)).size, 27);
    assert.equal(h.calls.list, 1); assert.equal(h.calls.credit, 27);
});
test("directory follows Firebase page tokens and does not lose users after batch one", async t => {
    const h = await harness(t, { users: Array.from({ length: 1001 }, (_, index) => teacher(index)) });
    const result = await (await h.query("/users?q=professor1000%40example.test")).json();
    assert.equal(result.summary.total, 1001); assert.equal(result.users[0].uid, "teacher-1000");
    assert.equal(h.calls.list, 2); assert.equal(h.calls.credit, 1);
});
test("force refresh bypasses metadata cache but not authentication", async t => {
    const h = await harness(t);
    await h.query(); await h.query("/users?refresh=true");
    assert.equal(h.calls.list, 2); assert.equal(h.calls.verify, 2);
});
test("invalid query shapes and write methods cannot mutate or read user data", async t => {
    const h = await harness(t);
    for (const query of ["page=-1", "page=abc", "q[]=x", "q=a&q=b", "status=admin", "plan=enterprise", "refresh=1", "unknown=x"]) assert.equal((await h.query(`/users?${query}`)).status, 400, query);
    for (const method of ["POST", "PATCH", "DELETE"]) assert.equal((await h.query("/users", "owner", method)).status, 405);
    assert.equal(h.calls.list, 0);
});
test("missing balances are not misrepresented as zero and provider errors do not leak", async t => {
    const h = await harness(t, { creditError: true });
    const result = await (await h.query()).json();
    assert.equal(result.users[0].credits, null);
    assert.doesNotMatch(JSON.stringify(result), /sensitive/);
    const unavailable = await harness(t, { listError: true });
    const response = await unavailable.query();
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /sensitive/);
});
test("admin traffic has a separate bounded rate limit", async t => {
    const h = await harness(t);
    for (let i = 0; i < 60; i += 1) assert.equal((await h.query("/access")).status, 200);
    const response = await h.query("/access");
    assert.equal(response.status, 429); assert.equal(response.headers.get("retry-after"), "60");
});
test("read-only credit snapshots account for reservations without writes", async () => {
    const store = createAiCreditStore({ type: "memory" });
    const params = { key: "teacher:free:day", userId: "teacher", day: "day", plan: "free" };
    await store.reserve({ ...params, limit: 500, amount: 50, reservationId: "active" });
    await store.reserve({ ...params, limit: 500, amount: 20, reservationId: "expired", expiresAt: "2000-01-01T00:00:00Z" });
    const before = JSON.stringify([...store.buckets]);
    store.persist = () => { throw new Error("peek must never write"); };
    assert.deepEqual(await store.peek(params), { used: 50, reserved: 50 });
    assert.equal(JSON.stringify([...store.buckets]), before);
    assert.deepEqual(await store.peek({ ...params, key: "missing" }), { used: 0, reserved: 0 });
});
test("Firestore credit snapshots never commit expired reservation cleanup", async () => {
    const store = createAiCreditStore({ type: "firestore", projectId: "test-project" });
    const bucket = { used: 35, reservations: { old: { amount: 10, createdAt: "2000-01-01T00:00:00Z" } } };
    store.read = async () => ({ bucket });
    store.commit = () => { throw new Error("peek must never commit"); };
    assert.deepEqual(await store.peek({ key: "anything" }), { used: 25, reserved: 0 });
    assert.equal(bucket.used, 35);
});

test("usage reporting requires active owner session and never exposes provider errors", async t => {
    const h = await harness(t);
    for (const token of ["teacher", "revoked", "disabled", "deleting"]) assert.ok([401, 403].includes((await h.query("/usage", token)).status));
    assert.equal(h.calls.usage, 0);
    const response = await h.query("/usage?days=30");
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await response.json()).summary.generations, 0); assert.equal(h.calls.usage, 1);
    assert.equal((await h.query("/usage?days=90")).status, 400); assert.equal(h.calls.usage, 1);
    assert.equal((await h.query("/usage", "owner", "POST")).status, 405);
    const down = await harness(t, { usageError: true });
    const failure = await down.query("/usage"); assert.equal(failure.status, 503);
    assert.doesNotMatch(await failure.text(), /sensitive/);
});

test("usage export requires owner access, ignores screen pagination and never reads the account directory", async t => {
    const snapshot = usageTestSnapshot(45);
    snapshot.events.forEach(event => { event.createdAt = new Date(timestamp).toISOString(); });
    const h = await harness(t, { usageSnapshot:snapshot, listError:true });
    for (const token of ["teacher", "revoked", "disabled", "deleting"]) assert.ok([401,403].includes((await h.query("/usage/export",token)).status));
    assert.equal(h.calls.usage, 0);
    const response = await h.query("/usage/export?days=30&page=2");
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("vary"), /Authorization/);
    const payload = await response.json();
    assert.equal(payload.report.events.length, 45); assert.equal(h.calls.usage, 1); assert.equal(h.calls.usageRefresh, true);
    assert.equal(h.calls.list + h.calls.profile + h.calls.credit, 0);
    assert.doesNotMatch(JSON.stringify(payload), /private-user-|private-event-|never-return-this|sensitive/);
    assert.equal((await h.query("/usage/export?days=90")).status, 400); assert.equal(h.calls.usage, 1);
    for (const method of ["POST","PATCH","DELETE"]) assert.equal((await h.query("/usage/export","owner",method)).status,405);
    const down = await harness(t, { usageError:true });
    const failure = await down.query("/usage/export"); assert.equal(failure.status,503); assert.doesNotMatch(await failure.text(),/sensitive/);
});
