import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { createUsageObservation, usageContext } from "../ai-usage-analytics.js";
import { buildAiCreditUsagePolicy, aiCreditsForUsage, mergeAiUsageMetadata, normalizeAiUsageMetadata } from "../ai-credit-policy.js";
import { normalizeActivityGenerationOptions, applyActivityGenerationSettings } from "../activity-generation-policy.js";
import { normalizeSlideGenerationOptions } from "../slide-generation-policy.js";

const source = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");
const usageMetadata = { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 50, totalTokenCount: 350 };
function harness({ provider = "groq", unlimited = false, results = [{ text: '{"cards":[{"front":"PRIVATE","back":"PRIVATE"}]}', usageMetadata }], image = false, blocked = false, refundFails = false } = {}) {
    const events = []; let handler, calls = 0;
    const providerCall = async () => { const result = results[calls++]; if (result instanceof Error) throw result; return result; };
    const context = vm.createContext({
        Error, console: { error() {}, warn() {} }, process: { env: {} },
        app: { post: (...args) => { handler = args.at(-1); } },
        aiRateLimit: null, requireAiAuth: null, aiGenerationRateLimit: null, upload: { single: () => null },
        schemaFor: () => ({}), normalizeSlideGenerationOptions, normalizeActivityGenerationOptions, applyActivityGenerationSettings,
        extractTextFromFile: async () => "", normalizeSlidesMaterial: value => value, isUploadValidationError: () => false,
        activeAiTextProvider: () => provider, activeAiTextModel: () => provider === "groq" ? "openai/gpt-oss-120b" : "gemini-test",
        aiPlanForRequest: () => "free", isAiUnlimitedUser: () => unlimited,
        createUsageObservation, usageContext, aiUsageAnalytics: { record: async row => { if (row) events.push(row); } },
        aiCreditUsagePolicy: buildAiCreditUsagePolicy({}), aiCreditsForUsage, mergeAiUsageMetadata, normalizeAiUsageMetadata,
        estimateAiCreditReservation: () => 10, estimateProviderTokenReservation: () => 100,
        reserveAiDailyCredit: async () => ({ reserved: !blocked, reservation: {}, credits: { plan: "free", limits: { pro: 4000 }, limit: 500 } }),
        reserveAiProviderTokens: async () => ({ reserved: true, reservation: {} }),
        reserveAiDailyRequests: async () => ({ reserved: true, reservation: {} }),
        settleAiProviderTokens: async () => ({}), settleAiDailyRequests: async () => ({}),
        settleAiDailyCredit: async (_, amount) => ({ credits: {}, charged: unlimited ? 0 : amount, measuredCost: amount }),
        refundAiDailyCredit: async () => { if (refundFails) throw new Error("PRIVATE"); }, refundAiDailyRequests: async () => {}, refundAiProviderTokens: async () => {},
        aiDailyCreditsFor: async () => ({}), aiDailyRequestLimitError: () => ({}), aiTextProviderConfigurationError: () => "not-configured",
        promptFor: () => "synthetic test", parseGeneratedJson: JSON.parse, fallbackJsonPrompt: () => "", aiErrorMessage: e => e.message,
        aiGenerationMaxAttempts: 2, groqMaxPromptTokens: 4000, groqApiKey: "fake", groqReasoningEffort: "low", groqMaxCompletionTokens: 3500, groqRequestTimeoutMs: 90000,
        generateGroqStructuredMaterial: providerCall, gemini: { models: { generateContent: providerCall } },
        aiImageGenerationEnabled: true, imagePromptForSlide: () => "synthetic"
    });
    const functionStart = source.indexOf("async function generateStructuredMaterialWithRetry(");
    vm.runInContext(source.slice(functionStart, source.indexOf('app.use("/api/admin"', functionStart)), context);
    const routeStart = source.indexOf(`app.post("/api/ai/${image ? "generate-image" : "generate"}",`);
    const routeEnd = image ? source.indexOf("\napp.use((error", routeStart) : source.indexOf("\napp.post(", routeStart + 1);
    vm.runInContext(source.slice(routeStart, routeEnd), context);
    return {
        events, calls: () => calls,
        async run(body = image ? { title: "PRIVATE" } : { materialType: "flashcards", sourceText: "PRIVATE", generationOptions: { count: 3 } }) {
            const response = { statusCode: 200, setHeader() {}, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
            await handler({ educariaUser: { uid: "test-owner" }, body }, response);
            return response;
        }
    };
}
test("text route logs actual provider usage and returned quantity without storing materials", async () => {
    const h = harness(); const response = await h.run();
    assert.equal(response.statusCode, 200); assert.equal(h.calls(), 1); assert.equal(h.events.length, 1);
    assert.equal(h.events[0].usage.totalTokens, 350); assert.equal(h.events[0].generatedCount, 1); assert.equal(h.events[0].context.requestedCount, 3);
    assert.equal(h.events[0].creditsCharged, response.body.charge.cost); assert.doesNotMatch(JSON.stringify(h.events), /PRIVATE/);
});
test("owner route records measured usage even though settlement charges zero", async () => {
    const h = harness({ unlimited: true }); await h.run();
    assert.equal(h.events[0].creditsCharged, 0); assert.ok(h.events[0].measuredCredits > 0); assert.equal(h.events[0].unlimited, true);
});
test("provider rate-limit errors leave an unknown measurement and a confirmed refund", async () => {
    const h = harness({ results: [Object.assign(new Error("PRIVATE"), { status: 429 })] });
    assert.equal((await h.run()).statusCode, 429);
    assert.equal(h.events[0].usage, null); assert.equal(h.events[0].usageCoverage, "unknown"); assert.equal(h.events[0].creditsCharged, 0);
    assert.equal(h.events[0].status, "failed"); assert.doesNotMatch(JSON.stringify(h.events), /PRIVATE/);
});
test("invalid JSON still counts provider consumption once even when generation fails", async () => {
    const h = harness({ results: [{ text: "PRIVATE INVALID JSON", usageMetadata }] });
    assert.equal((await h.run()).statusCode, 500);
    assert.equal(h.events[0].usage.totalTokens, 350); assert.equal(h.events[0].attempts.length, 1);
    assert.equal(h.events[0].creditsCharged, 0); assert.equal(h.events[0].usageCoverage, "complete");
});
test("Gemini JSON retry accumulates both provider responses without counting twice", async () => {
    const h = harness({ provider: "gemini", results: [{ text: "bad-json", usageMetadata }, { text: '{"cards":[]}', usageMetadata }] });
    assert.equal((await h.run()).statusCode, 200); assert.equal(h.calls(), 2);
    assert.equal(h.events[0].attempts.length, 2); assert.equal(h.events[0].usage.totalTokens, 700); assert.equal(h.events[0].estimatedCostUsd, null);
});
test("Gemini retry after missing usage keeps the result explicitly partial", async () => {
    const h = harness({ provider: "gemini", results: [new Error("PRIVATE"), { text: '{"cards":[]}', usageMetadata }] });
    assert.equal((await h.run()).statusCode, 200); assert.equal(h.events[0].usageCoverage, "partial");
    assert.equal(h.events[0].usage.totalTokens, 350); assert.equal(h.events[0].measuredCredits, null);
});
test("requests rejected before the provider never create usage history", async () => {
    const h = harness({ blocked: true }); assert.equal((await h.run()).statusCode, 429);
    assert.equal(h.calls(), 0); assert.equal(h.events.length, 0);
});
test("unconfirmed refund is not misrepresented as zero credits charged", async () => {
    const h = harness({ results: [new Error()], refundFails: true }); await h.run();
    assert.equal(h.events[0].creditsCharged, null);
});
test("image route records a missing-image response with its known usage", async () => {
    const h = harness({ image: true, results: [{ candidates: [], usageMetadata }] });
    assert.equal((await h.run()).statusCode, 502);
    assert.equal(h.events[0].status, "failed"); assert.equal(h.events[0].usage.totalTokens, 350); assert.equal(h.events[0].creditsCharged, 0);
});
test("successful image route does not persist image bytes and measures fixed image credits", async () => {
    const h = harness({ image: true, results: [{ candidates: [{ content: { parts: [{ inlineData: { data: "PRIVATE IMAGE BYTES" } }] } }], usageMetadata }] });
    const response = await h.run(); assert.equal(response.statusCode, 200);
    assert.equal(h.events[0].status, "success"); assert.equal(h.events[0].generatedCount, 1);
    assert.equal(h.events[0].measuredCredits, response.body.charge.measuredCost); assert.doesNotMatch(JSON.stringify(h.events), /PRIVATE/);
});
