import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { createUsageObservation, usageContext } from "../ai-usage-analytics.js";
import { buildAiCreditUsagePolicy, aiCreditsForUsage, mergeAiUsageMetadata, normalizeAiUsageMetadata } from "../ai-credit-policy.js";
import { normalizeActivityGenerationOptions, applyActivityGenerationSettings } from "../activity-generation-policy.js";
import { normalizeSlideGenerationOptions } from "../slide-generation-policy.js";
import { normalizeSlidesMaterial } from "../materials/slides.js";
import { parseGeneratedJson } from "../materials/generated-json.js";
import { schemaFor } from "../materials/schemas.js";
import { normalizeDiscoveryMaterial, validateDiscoverySource } from "../materials/discovery.js";

const source = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");
const usageMetadata = { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 50, totalTokenCount: 350 };
function harness({ provider = "groq", unlimited = false, results = [{ text: '{"cards":[{"front":"PRIVATE","back":"PRIVATE"}]}', usageMetadata }], image = false, blocked = false, refundFails = false } = {}) {
    const events = [], providerAmounts = [], providerInputs = []; let handler, calls = 0, refunds = 0;
    const providerCall = async input => { providerInputs.push(input); const result = results[calls++]; if (result instanceof Error) throw result; return result; };
    const context = vm.createContext({
        Error, console: { error() {}, warn() {} }, process: { env: {} },
        app: { post: (...args) => { handler = args.at(-1); } },
        aiRateLimit: null, requireAiAuth: null, aiGenerationRateLimit: null, upload: { single: () => null },
        schemaFor, normalizeSlideGenerationOptions, normalizeActivityGenerationOptions, applyActivityGenerationSettings,
        extractTextFromFile: async () => "", normalizeSlidesMaterial, normalizeDiscoveryMaterial, validateDiscoverySource, isUploadValidationError: () => false,
        activeAiTextProvider: () => provider, activeAiTextModel: () => provider === "groq" ? "openai/gpt-oss-120b" : "gemini-test",
        aiPlanForRequest: () => "free", isAiUnlimitedUser: () => unlimited,
        createUsageObservation, usageContext, aiUsageAnalytics: { record: async row => { if (row) events.push(row); } },
        aiCreditUsagePolicy: buildAiCreditUsagePolicy({}), aiCreditsForUsage, mergeAiUsageMetadata, normalizeAiUsageMetadata,
        estimateAiCreditReservation: () => 10, estimateProviderTokenReservation: () => 100,
        reserveAiDailyCredit: async () => ({ reserved: !blocked, reservation: {}, credits: { plan: "free", limits: { pro: 4000 }, limit: 500 } }),
        reserveAiProviderTokens: async () => ({ reserved: true, reservation: {} }),
        reserveAiDailyRequests: async () => ({ reserved: true, reservation: {} }),
        settleAiProviderTokens: async (_, amount) => { providerAmounts.push(amount); return {}; }, settleAiDailyRequests: async () => ({}),
        settleAiDailyCredit: async (_, amount) => ({ credits: {}, charged: unlimited ? 0 : amount, measuredCost: amount }),
        refundAiDailyCredit: async () => { if (refundFails) throw new Error("PRIVATE"); refunds++; }, refundAiDailyRequests: async () => {}, refundAiProviderTokens: async () => {},
        aiDailyCreditsFor: async () => ({}), aiDailyRequestLimitError: () => ({}), aiTextProviderConfigurationError: () => "not-configured",
        promptFor: () => "synthetic test", parseGeneratedJson, fallbackJsonPrompt: () => "", aiErrorMessage: e => e.message,
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
        events, providerAmounts, providerInputs, calls: () => calls, refunds: () => refunds,
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

test("discovery routes return valid materials with measured usage and reject bad lists before the provider", async () => {
    for (const [materialType, material, sourceText] of [
        ["wordtrail", { title: "Trilha", words: [{ term: "Água", clue: "Líquido" }, { term: "Sol", clue: "Estrela" }] }, "Água;Sol"],
        ["connections", { title: "Conexões", rounds: [{ answer: "Planetas", clues: ["Marte", "Vênus", "Terra"], explanation: "Orbitam o Sol." }] }, "Planetas"]
    ]) {
        const h = harness({ results: [{ text: JSON.stringify(material), usageMetadata }] });
        const response = await h.run({ materialType, sourceText, generationOptions: { inputMode: "words", clueCount: 3, difficulty: "hard", includeClues: false } });
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.materialType, materialType);
        assert.ok(response.body.charge.cost > 0);
        assert.equal(h.events[0].materialType, materialType);
        if (materialType === "connections") {
            assert.equal(response.body.material.rounds[0].answer, "Planetas");
            assert.equal(response.body.material.generation_options.difficulty, "hard");
        } else assert.equal(response.body.material.showClues, false);
        const invalid = harness();
        const failure = await invalid.run({ materialType, sourceText: "Uma;uma", generationOptions: { inputMode: "words" } });
        assert.equal(failure.statusCode, 400);
        assert.equal(invalid.calls(), 0);
        assert.equal(invalid.events.length, 0);
    }
});
test("connections route infers a bare list, constrains provider answers and rejects unrelated categories", async () => {
    const sourceText = "Homer simpson, Neymar e star wars";
    const answers = ["Homer simpson", "Neymar", "star wars"];
    const rounds = answers.map(answer => ({ answer, clues: ["Indício inicial", "Indício final"], explanation: "Explicação" }));
    const h = harness({ results: [{ text: JSON.stringify({ rounds }), usageMetadata }] });
    const response = await h.run({ materialType: "connections", sourceText, generationOptions: { count: 7, clueCount: 2 } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.material.rounds.map(r => r.answer), answers);
    assert.deepEqual(h.providerInputs[0].schemaConfig.schema.properties.rounds.items.properties.answer.enum, answers);
    assert.equal(h.providerInputs[0].schemaConfig.schema.properties.rounds.minItems, 3);
    assert.equal(h.calls(), 1);
    assert.doesNotMatch(JSON.stringify(h.events), /Homer|Neymar|star wars/);
    const wrong = harness({ results: [{ text: JSON.stringify({ rounds: rounds.map(r => ({ ...r, answer: "Personagens que se tornaram memes" })) }), usageMetadata }] });
    const failure = await wrong.run({ materialType: "connections", sourceText, generationOptions: { clueCount: 2 } });
    assert.equal(failure.statusCode, 400);
    assert.equal(failure.body.code, "invalid_discovery_material");
    assert.equal(wrong.refunds(), 1);
    assert.equal(wrong.events[0].creditsCharged, 0);
    const invalid = harness();
    assert.equal((await invalid.run({ materialType: "connections", sourceText: "Neymar, Neymar" })).statusCode, 400);
    assert.equal(invalid.calls(), 0);
});

test("trail route constrains the teacher list and refunds a translated response", async () => {
    const sourceText = "took, came, began, drove e went";
    const terms = ["took", "came", "began", "drove", "went"];
    const h = harness({ results: [{ text: JSON.stringify({ words: terms.map(term => ({ term, clue: "Indício" })) }), usageMetadata }] });
    const response = await h.run({ materialType: "wordtrail", sourceText, generationOptions: { count: 6, includeClues: false } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.material.words.map(w => w.term), terms);
    assert.equal(response.body.material.showClues, false);
    assert.deepEqual(h.providerInputs[0].schemaConfig.schema.properties.words.items.properties.term.enum, terms);
    assert.equal(h.providerInputs[0].schemaConfig.schema.properties.words.minItems, 5);
    assert.equal(h.calls(), 1);
    const wrong = harness({ results: [{ text: JSON.stringify({ words: ["pegou", "veio", "começou", "conduziu", "foi"].map(term => ({ term, clue: "Indício" })) }), usageMetadata }] });
    const failure = await wrong.run({ materialType: "wordtrail", sourceText });
    assert.equal(failure.statusCode, 400);
    assert.match(failure.body.error, /idioma original/);
    assert.equal(wrong.refunds(), 1);
    assert.equal(wrong.events[0].creditsCharged, 0);
    const invalid = harness();
    assert.equal((await invalid.run({ materialType: "wordtrail", sourceText: "took, took" })).statusCode, 400);
    assert.equal(invalid.calls(), 0);
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
    assert.equal((await h.run()).statusCode, 502);
    assert.equal(h.events[0].usage.totalTokens, 350); assert.equal(h.events[0].attempts.length, 1);
    assert.equal(h.events[0].creditsCharged, 0); assert.equal(h.events[0].usageCoverage, "complete");
});
test("Gemini JSON retry accumulates both provider responses without counting twice", async () => {
    const h = harness({ provider: "gemini", results: [{ text: "bad-json", usageMetadata }, { text: '{"cards":[]}', usageMetadata }] });
    assert.equal((await h.run()).statusCode, 200); assert.equal(h.calls(), 2);
    assert.equal(h.events[0].attempts.length, 2); assert.equal(h.events[0].usage.totalTokens, 700); assert.equal(h.events[0].estimatedCostUsd, null);
});

test("unmetered slide recovery refunds user credits but retains the platform token estimate", async () => {
    const text = JSON.stringify({ title: "Revisão", slides: [{ title: "Tema", body: "Texto preservado", illustration: { version: 2, status: "invalid" } }] });
    const h = harness({ results: [{ text, usageMetadata: {}, unmeteredRecovery: true }] });
    const response = await h.run({ materialType: "slides", sourceText: "PRIVATE", slideOptions: { includeIllustration: true } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.material.slides[0].body, "Texto preservado");
    assert.equal(response.body.material.slides[0].layout, "stack");
    assert.equal(response.body.charge.basis, "unavailable");
    assert.equal(response.body.charge.cost, 0);
    assert.equal(response.body.charge.measuredCost, null);
    assert.equal(response.body.charge.usage, null);
    assert.equal(h.refunds(), 1); assert.equal(h.calls(), 1);
    assert.deepEqual(h.providerAmounts, [100]);
    assert.equal(h.events[0].status, "success");
    assert.equal(h.events[0].usageCoverage, "unknown");
    assert.equal(h.events[0].measuredCredits, null);
    assert.equal(h.events[0].creditsCharged, 0);
    assert.equal(h.events[0].attempts.length, 1);
});

for (const code of ["json_validate_failed", "groq_empty_response", "groq_response_incomplete"]) test(`unrecoverable ${code} returns a useful error and refunds credits`, async () => {
    const h = harness({ results: [Object.assign(new Error("PRIVATE"), { code, status: 400, usageMetadata })] });
    const response = await h.run({ materialType: "slides", sourceText: "PRIVATE", slideOptions: { includeIllustration: true } });
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.code, "ai_response_incomplete");
    assert.match(response.body.error, /material anterior foi preservado/);
    assert.doesNotMatch(JSON.stringify(response.body), /PRIVATE/);
    assert.equal(h.refunds(), 1); assert.equal(h.calls(), 1);
    assert.equal(h.events[0].creditsCharged, 0);
    assert.equal(h.events[0].usage.totalTokens, 350);
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
