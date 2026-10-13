import assert from "node:assert/strict";
import { test } from "node:test";
import { createUsageObservation, createUsageAnalytics, usageContext, estimateUsageCost, parseUsageQuery, buildUsageReport } from "../ai-usage-analytics.js";
import { buildAiCreditUsagePolicy } from "../ai-credit-policy.js";
import { groqUsageMetadata } from "../ai-text-provider.js";

const timestamp = Date.parse("2026-10-13T12:00:00Z");
const metadata = groqUsageMetadata({ prompt_tokens: 574, completion_tokens: 463, total_tokens: 1037, completion_tokens_details: { reasoning_tokens: 54 } });
const observation = extra => createUsageObservation({ uid: "owner", plan: "free", unlimited: true, materialType: "mindmap",
    provider: "groq", model: "openai/gpt-oss-120b", policy: buildAiCreditUsagePolicy({}), now: () => timestamp, ...extra });
async function event(extra, finish = {}) {
    const obs = observation(extra);
    await obs.call(async () => ({ text: "PRIVATE MATERIAL", usageMetadata: metadata }));
    return obs.finish({ success: true, creditsCharged: 0, material: { branches: [{ title: "PRIVATE MATERIAL" }] }, ...finish });
}
test("owner usage is measured with no debit and without double-counting reasoning", async () => {
    const row = await event();
    assert.equal(row.usage.totalTokens, 1037); assert.equal(row.usage.outputTokens, 409); assert.equal(row.usage.thoughtTokens, 54);
    assert.equal(row.measuredCredits, 20); assert.equal(row.creditsCharged, 0); assert.equal(row.unlimited, true);
    assert.equal(row.estimatedCostUsd, .0003639); assert.equal(row.generatedCount, 1);
    assert.equal(row.usageCoverage, "complete"); assert.equal(row.costCoverage, "complete");
    assert.equal(row.expiresAt.getTime(), timestamp + 90 * 86_400_000);
    assert.doesNotMatch(JSON.stringify(row), /PRIVATE MATERIAL/);
});
test("price estimate discounts only cached input and never guesses other tariffs", async () => {
    const usage = { inputTokens: 1000, outputTokens: 600, thoughtTokens: 400, cachedInputTokens: 500, toolTokens: 0, totalTokens: 2000 };
    assert.equal(estimateUsageCost("groq", "openai/gpt-oss-120b", usage), .0007125);
    for (const changed of [{ toolTokens: 10 }, { totalTokens: 3000 }, { cachedInputTokens: 1001 }]) assert.equal(estimateUsageCost("groq", "openai/gpt-oss-120b", { ...usage, ...changed }), null);
    assert.equal(estimateUsageCost("gemini", "image-model", usage), null);
    assert.equal(estimateUsageCost("groq", "new-model", usage), null);
});
test("only whitelisted numeric and categorical settings are recorded", async () => {
    const context = usageContext("slides", { count: 12, contentMode: "develop", audience: "PRIVATE", title: "PRIVATE", teacherInstructions: "PRIVATE" },
        { detail: "detailed", includeIllustration: true, audience: "PRIVATE" }, true);
    const row = await event({ materialType: "slides", context: { ...context, prompt: "PRIVATE" } });
    assert.deepEqual(row.context, { requestedCount: 12, hasFile: true, contentMode: "develop", detail: "detailed", illustration: true });
    assert.doesNotMatch(JSON.stringify(row), /PRIVATE/);
});
test("failed and successful attempts aggregate once and finish is idempotent", async () => {
    const obs = observation();
    await assert.rejects(obs.call(async () => { throw Object.assign(new Error("SECRET PROMPT"), { usageMetadata: metadata, status: 429 }); }));
    await obs.call(async () => ({ usageMetadata: metadata }));
    const row = obs.finish({ success: true, creditsCharged: 5 });
    assert.equal(row.attempts.length, 2); assert.equal(row.usage.totalTokens, 2074); assert.equal(row.estimatedCostUsd, .0007278);
    assert.equal(row.creditsCharged, 5); assert.equal(row.attempts[0].errorCategory, "rate_limit");
    assert.equal(obs.finish(), null); assert.doesNotMatch(JSON.stringify(row), /SECRET PROMPT/);
});
test("missing usage on failures is unknown, and retries can be partially measured", async () => {
    const obs = observation();
    await assert.rejects(obs.call(async () => { throw new Error("PRIVATE"); }));
    const unknown = obs.finish({ creditsCharged: 0 });
    assert.equal(unknown.usage, null); assert.equal(unknown.usageCoverage, "unknown"); assert.equal(unknown.estimatedCostUsd, null);
    assert.equal(unknown.measuredCredits, null);
    const mixed = observation();
    await assert.rejects(mixed.call(async () => { throw new Error(); }));
    await mixed.call(async () => ({ usageMetadata: metadata }));
    const partial = mixed.finish({ success: true });
    assert.equal(partial.usageCoverage, "partial"); assert.equal(partial.costCoverage, "partial"); assert.equal(partial.measuredCredits, null);
    const report = buildUsageReport({ events: [unknown, partial], collection: {}, updatedAt: "", truncated: false }, parseUsageQuery({}), [], timestamp);
    assert.equal(report.summary.averageTokens, null); assert.equal(report.summary.knownTokens, 1037); assert.equal(report.summary.incompleteMeasurements, 2);
});
test("preflight blocks have no provider attempt and do not become generations", () => {
    assert.equal(observation().finish({ error: new Error() }), null);
});
test("successful response missing usage is unknown, but explicit zero is known", async () => {
    for (const [usageMetadata, expected] of [[{}, "unknown"], [undefined, "unknown"], [{ totalTokenCount: 0 }, "complete"]]) {
        const obs = observation(); await obs.call(async () => ({ usageMetadata }));
        assert.equal(obs.finish({ success: true }).usageCoverage, expected);
    }
});
test("memory store deduplicates stable IDs, reports truncation and removes only targeted user", async () => {
    const store = createUsageAnalytics({ mode: "memory", now: () => timestamp, maxRecords: 2 });
    const row = await event();
    await store.record(row); await store.record(row);
    assert.equal((await store.read()).events.length, 1);
    await store.record(await event({ uid: "teacher" })); await store.record(await event({ uid: "teacher" }));
    const snapshot = await store.read(); assert.equal(snapshot.events.length, 2); assert.equal(snapshot.truncated, true);
    await store.removeUser("owner"); assert.equal((await store.read({ refresh: true })).events.length, 2);
    await store.removeUser("teacher"); assert.equal((await store.read({ refresh: true })).events.length, 0);
});
test("Firestore writes consult deletion lock and do not recreate a deleted account's usage", async () => {
    const writes = []; let locked = false;
    const db = { collection: path => ({ doc: id => ({ path: `${path}/${id}` }) }),
        runTransaction: cb => cb({ get: async ref => { assert.equal(ref.path, "accountDeletionJobs/owner"); return { exists: locked }; },
            set: (ref, data) => writes.push({ ref, data }) }) };
    const store = createUsageAnalytics({ getServices: () => ({ db }), now: () => timestamp });
    await store.record(await event()); locked = true; await store.record(await event());
    assert.equal(writes.length, 1); assert.match(writes[0].ref.path, /^aiGenerationUsage\//);
});
test("analytics outages and timeouts never break generations and warn without leaking errors", async () => {
    const warnings = [];
    const unavailable = createUsageAnalytics({ getServices: () => { throw new Error("SECRET"); }, report: code => warnings.push(code) });
    await unavailable.record(await event());
    assert.equal(unavailable.status().failedWrites, 1); assert.equal(unavailable.status().pendingWrites, 0);
    let complete;
    const slow = createUsageAnalytics({ timeoutMs: 5, getServices: () => ({ db: { runTransaction: () => new Promise(resolve => { complete = resolve; }) } }), report: code => warnings.push(code) });
    await slow.record(await event()); assert.equal(slow.status().failedWrites, 1); assert.equal(slow.status().pendingWrites, 1);
    complete(); await new Promise(resolve => setImmediate(resolve)); assert.equal(slow.status().pendingWrites, 0);
    assert.deepEqual(warnings, ["ai_usage_write_unconfirmed", "ai_usage_write_unconfirmed"]);
});
test("Firestore report range is bounded, uses one indexed field and caches reads", async () => {
    const rows = [await event(), await event(), await event()]; const calls = []; let reads = 0;
    const query = { where: (...args) => { calls.push(args); return query; }, orderBy: (...args) => { calls.push(args); return query; },
        limit: size => { assert.equal(size, 3); return query; }, get: async () => { reads++; return { docs: rows.map(row => ({ data: () => row })) }; } };
    const store = createUsageAnalytics({ getServices: () => ({ db: { collection: name => { assert.equal(name, "aiGenerationUsage"); return query; } } }), maxRecords: 2, now: () => timestamp });
    const snapshot = await store.read(); assert.equal(snapshot.events.length, 2); assert.equal(snapshot.truncated, true);
    await store.read(); assert.equal(reads, 1); await store.read({ refresh: true }); assert.equal(reads, 2);
    assert.equal(calls.every(args => args[0] === "createdAt"), true);
});
test("report filters, paging and costs separate owner from beta and distinguish credits from tokens", async () => {
    const rows = [];
    for (let i = 0; i < 25; i++) rows.push(await event({ uid: "teacher", unlimited: false }, { creditsCharged: 20 }));
    rows.push(await event());
    const snapshot = { events: rows, truncated: false, collection: { store: "memory" }, updatedAt: new Date(timestamp).toISOString() };
    const report = buildUsageReport(snapshot, parseUsageQuery({ cohort: "limited", page: "2" }), [{ uid: "teacher", name: "Teste", email: "test@example.invalid", secret: "PRIVATE" }], timestamp);
    assert.equal(report.events.length, 5); assert.equal(report.summary.generations, 25); assert.equal(report.summary.creditsCharged, 500);
    assert.equal(report.summary.averageTokens, 1037); assert.equal(report.summary.p95Tokens, 1037); assert.equal(report.expensive.length, 5);
    assert.equal(report.events[0].user.name, "Teste"); assert.doesNotMatch(JSON.stringify(report), /PRIVATE/);
    assert.equal(buildUsageReport(snapshot, parseUsageQuery({ uid: "owner" }), [], timestamp).summary.generations, 1);
    assert.equal(buildUsageReport(snapshot, parseUsageQuery({ status: "failed" }), [], timestamp).summary.generations, 0);
});
test("invalid filter shapes never reach a database query", () => {
    for (const query of [{ days: "90" }, { days: ["7"] }, { uid: ["owner"] }, { uid: "bad/path" }, { page: "-1" }, { refresh: "yes" }, { materialType: "__proto__" }, { unknown: "1" }]) assert.throws(() => parseUsageQuery(query));
});
