import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createBetaRouter, createRequireBetaAccess } from "../beta-routes.js";
import { betaCreditLimit } from "../beta-enrollment.js";
import { createAiCreditStore } from "../ai-credit-store.js";
import { buildAiCreditUsagePolicy } from "../ai-credit-policy.js";

async function harness(t, extra = {}) {
    const claims = [];
    const enrollment = { status: async () => ({ enabled: true, newSlots: 25, used: 25, remaining: 0, waiting: 3, activatedAt: "private" }),
        claim: async uid => { claims.push(uid); return { status: "waitlisted" }; }, ...extra };
    const app = express(); app.use(express.json());
    app.use("/beta", createBetaRouter({ enrollment, getServices: () => ({}), verifySession: async token => {
        if (token === "invalid") throw { code: "auth/id-token-revoked" };
        return { uid: token };
    } }));
    const server = createServer(app);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return { claims, query: (path, token, body = {}) => fetch(`http://127.0.0.1:${server.address().port}/beta${path}`, {
        method: path === "/status" ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(path === "/status" ? {} : { body: JSON.stringify(body) })
    }) };
}
test("public availability reveals only capacity, not waitlist identities or private metadata", async t => {
    const h = await harness(t); const response = await h.query("/status");
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { ok: true, enabled: true, newSlots: 25, used: 25, remaining: 0 });
});
test("enrollment authenticates and ignores caller-supplied UID, status and quota", async t => {
    const h = await harness(t);
    assert.equal((await h.query("/enroll")).status, 401);
    assert.equal((await h.query("/enroll", "invalid")).status, 401);
    assert.deepEqual(h.claims, []);
    const result = await (await h.query("/enroll", "actual-user", { uid: "owner", status: "approved", freeDailyCredits: 99999 })).json();
    assert.equal(result.access.status, "waitlisted"); assert.deepEqual(h.claims, ["actual-user"]);
});
test("service failures return retryable errors without provider data", async t => {
    const fail = async () => { throw Error("private-provider-secret"); };
    const h = await harness(t, { status: fail, claim: fail });
    for (const path of ["/status", "/enroll"]) {
        const response = await h.query(path, "actual-user");
        assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private-provider-secret/);
    }
});
test("admission middleware blocks waiting/missing sessions and fails closed on storage outage", async () => {
    for (const status of ["approved", "open", "waitlisted", "outage", "anonymous"]) {
        let passed = false;
        const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        const request = { educariaUser: status === "anonymous" ? null : { uid: "verified" }, body: { status: "approved" } };
        const guard = createRequireBetaAccess({ claim: async uid => {
            assert.equal(uid, "verified"); if (status === "outage") throw Error("private"); return { status };
        } });
        await guard(request, response, () => { passed = true; });
        assert.equal(passed, ["approved", "open"].includes(status));
        if (status === "waitlisted") assert.equal(response.code, 403);
        if (status === "outage") assert.equal(response.code, 503);
        if (status === "anonymous") assert.equal(response.code, 401);
    }
});
test("new beta credits preserve old/pro quotas and can never raise server limits", () => {
    const member = { status: "approved", cohort: "new", freeDailyCredits: 250 };
    assert.equal(betaCreditLimit("free", 500, member), 250);
    assert.equal(betaCreditLimit("free", 100, member), 100);
    assert.equal(betaCreditLimit("free", 500, { ...member, cohort: "existing" }), 500);
    assert.equal(betaCreditLimit("pro", 4000, member), 4000);
    assert.equal(betaCreditLimit("free", 500, null), 500);
});

const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
test("all generation, billing and credit routes enforce admission before work", () => {
    for (const path of ["ai/generate", "ai/generate-image", "ai/credits", "model-template/generate", "billing/checkout", "billing/status"]) {
        const line = source.split("\n").find(line => /^app\.(post|get)\(/.test(line) && line.includes(`"/api/${path}"`));
        assert.match(line, /requireAiAuth, requireBetaAccess,/);
        if (path.includes("generate")) assert.ok(line.indexOf("requireBetaAccess") < line.indexOf("async"));
    }
    assert.match(source, /app\.use\(\[[^\]]*"\/api\/beta"[^\]]*\], appProtection\)/);
    const deletionRoute = source.split("\n").find(line => line.startsWith('app.delete("/api/account",') && line.includes("async"));
    assert.ok(deletionRoute); assert.doesNotMatch(deletionRoute, /requireBetaAccess/);
});

test("reservation, settlement and refunds consistently use the beta limit", async () => {
    const repository = createAiCreditStore({ type: "memory" });
    const context = vm.createContext({ betaCreditLimit, aiDailyCreditLimits: { free: 500, pro: 4000 }, aiCreditUsagePolicy: buildAiCreditUsagePolicy({}),
        aiDailyCreditLimitForPlan: plan => plan === "pro" ? 4000 : 500,
        aiCreditsWithRequestQuota: async (_request, credits) => credits,
        aiCreditRepository: repository, aiCreditReservationTtlMs: 3600000,
        loadBillingStore: async () => {}, aiCreditStoreType: () => "memory",
        dailyCreditDateKey: () => "2026-10-27", nextDailyCreditResetAt: () => "2026-10-28T00:00:00Z",
        aiCreditBucketKey: () => "user:free:2026-10-27", aiCreditUserKey: () => "user", aiPlanForRequest: () => "free",
        isAiUnlimitedUser: request => request.unlimited === true
    });
    const start = source.indexOf("async function aiDailyCreditsFor(");
    const end = source.indexOf("async function requireAiAuth(");
    vm.runInContext(source.slice(start, end), context);
    const request = { educariaBeta: { status: "approved", cohort: "new", freeDailyCredits: 250 } };
    const reserved = await context.reserveAiDailyCredit(request, 200);
    assert.equal(reserved.credits.limit, 250); assert.equal(reserved.credits.remaining, 50);
    const settled = await context.settleAiDailyCredit(reserved.reservation, 240, request);
    assert.equal(settled.credits.limit, 250); assert.equal(settled.credits.remaining, 10);
    const last = await context.reserveAiDailyCredit(request, 10);
    assert.equal(last.credits.remaining, 0);
    assert.equal((await context.reserveAiDailyCredit(request, 1)).reserved, false);
    const refunded = await context.refundAiDailyCredit(last.reservation);
    assert.equal(refunded.limit, 250); assert.equal(refunded.remaining, 10);
    assert.equal((await context.aiDailyCreditsFor(request)).limits.free, 250);
    assert.equal((await context.reserveAiDailyCredit({ ...request, unlimited: true }, 1000)).credits.unlimited, true);
});
