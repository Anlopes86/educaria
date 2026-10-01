import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { createAiCreditStore } from "../ai-credit-store.js";

const source = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");
const start = source.indexOf('app.delete("/api/account"');
const end = source.indexOf('app.post("/api/ai/generate"', start);

async function fixture() {
    const repository = createAiCreditStore({ type: "memory" });
    const bucket = { key: "test-user:free:2026-09-30", userId: "test-user", day: "2026-09-30", plan: "free" };
    const reserved = await repository.reserve({ ...bucket, amount: 50, limit: 500 });
    await repository.settle({ key: bucket.key, reservationId: reserved.reservationId, amount: 50, limit: 500 });
    let handler;
    let writes = 0;
    const context = vm.createContext({
        app: { delete: (_path, ...callbacks) => { handler = callbacks.at(-1); } },
        aiRateLimit() {}, requireAiAuth() {}, loadBillingStore: async () => {},
        persistBillingStore: async () => { writes += 1; },
        billingRecords: new Map(), aiProUidAllowList: new Set(), aiUnlimitedUidAllowList: new Set(),
        aiCreditRepository: repository
    });
    vm.runInContext(source.slice(start, end), context);
    return {
        repository, bucket, writes: () => writes,
        async invoke(user) {
            const result = { status: 200, body: null };
            const response = { status: (status) => { result.status = status; return response; }, json: (body) => { result.body = body; } };
            await handler({ educariaUser: user }, response);
            return result;
        }
    };
}

test("account cleanup never resets the authenticated user's AI usage", async () => {
    const f = await fixture();
    const result = await f.invoke({ uid: "test-user", auth_time: Math.floor(Date.now() / 1000) });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal((await f.repository.get(f.bucket)).used, 50);
});

test("account cleanup requires a recent sign-in, not just a refreshed ID token", async () => {
    for (const auth_time of [undefined, 1, Math.floor(Date.now() / 1000) + 600]) {
        const f = await fixture();
        const result = await f.invoke({ sub: "test-user", auth_time, iat: Math.floor(Date.now() / 1000) });
        assert.equal(result.status, 401);
        assert.equal(result.body.code, "recent_login_required");
        assert.equal(f.writes(), 0);
        assert.equal((await f.repository.get(f.bucket)).used, 50);
    }
});
