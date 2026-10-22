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
import { normalizeWorksheetMaterial, validateWorksheetSource, worksheetCompletionTokens } from "../materials/worksheet.js";
import { worksheetFixture, worksheetLargeFixture } from "../../tools/fixtures/worksheet.mjs";
import { promptFor } from "../materials/prompts.js";
import { diagramExamples } from "../../tools/fixtures/slide-diagrams.mjs";

const source = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");
const usageMetadata = { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 50, totalTokenCount: 350 };
function harness({ provider = "groq", unlimited = false, results = [{ text: '{"cards":[{"front":"PRIVATE","back":"PRIVATE"}]}', usageMetadata }], image = false, blocked = false, refundFails = false, promptBuilder = () => "synthetic test" } = {}) {
    const events = [], providerAmounts = [], providerInputs = []; let handler, calls = 0, refunds = 0;
    const quotaRefunds = { requests: 0, tokens: 0 };
    const providerCall = async input => { providerInputs.push(input); const result = results[calls++]; if (result instanceof Error) throw result; return result; };
    const context = vm.createContext({
        Error, console: { error() {}, warn() {} }, process: { env: {} },
        app: { post: (...args) => { handler = args.at(-1); } },
        aiRateLimit: null, requireAiAuth: null, aiGenerationRateLimit: null, upload: { single: () => null },
        schemaFor, normalizeSlideGenerationOptions, normalizeActivityGenerationOptions, applyActivityGenerationSettings, worksheetCompletionTokens, worksheetMaxCompletionTokens: 12000,
        extractTextFromFile: async () => "", normalizeSlidesMaterial, normalizeDiscoveryMaterial, validateDiscoverySource, normalizeWorksheetMaterial, validateWorksheetSource, isUploadValidationError: () => false,
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
        refundAiDailyCredit: async () => { if (refundFails) throw new Error("PRIVATE"); refunds++; }, refundAiDailyRequests: async () => { quotaRefunds.requests++; }, refundAiProviderTokens: async () => { quotaRefunds.tokens++; },
        aiDailyCreditsFor: async () => ({}), aiDailyRequestLimitError: () => ({}), aiTextProviderConfigurationError: () => "not-configured",
        promptFor: promptBuilder, parseGeneratedJson, fallbackJsonPrompt: () => "", aiErrorMessage: e => e.message,
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
        events, providerAmounts, providerInputs, quotaRefunds, calls: () => calls, refunds: () => refunds,
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

for (const includeIllustration of [true, false]) test(`real slide prompt reaches the provider with illustration=${includeIllustration} and all generation settings`, async () => {
    const bodyBlocks = { essential: "A energia passa entre os seres vivos pela alimentação.", explanation: "As plantas transformam energia luminosa em energia química. Essa energia chega aos consumidores quando se alimentam.", example: "Uma planta é comida por um gafanhoto: parte da energia armazenada na planta passa a ele." };
    const slide = { title: "Energia", body: bodyBlocks, type: "content", visual_variant: "light",
        ...(includeIllustration ? { illustration: diagramExamples[0] } : {}) };
    const body = { materialType: "slides", sourceText: "Explique a energia na cadeia alimentar. ".repeat(50),
        action: "Gerar 6 slides. Modo visual: personalizado.",
        slideOptions: { includeIllustration, detail: "detailed", tone: "explanatory", audience: "Ensino médio", subject: "Ciências" },
        generationOptions: { count: 6, contentMode: "develop" } };
    const material = { title: "Cadeia alimentar", slides: Array.from({ length: 6 }, () => ({ ...slide })) };
    const h = harness({ promptBuilder: promptFor, results: [{ text: JSON.stringify(material), usageMetadata }] });
    const response = await h.run(body);
    assert.equal(response.statusCode, 200);
    assert.equal(h.calls(), 1);
    assert.equal(h.refunds(), 0);
    assert.equal(h.providerInputs[0].maxCompletionTokens, 3500);
    assert.ok(h.providerInputs[0].prompt.includes(body.sourceText.trim()));
    assert.ok(Math.ceil(h.providerInputs[0].prompt.length / 3) <= 4000);
    assert.equal(Object.hasOwn(h.providerInputs[0].schemaConfig.schema.properties.slides.items.properties, "illustration"), includeIllustration);
    assert.deepEqual(h.providerInputs[0].schemaConfig.schema.properties.slides.items.properties.body.required, Object.keys(bodyBlocks));
    assert.equal(response.body.material.slides.length, 6);
    assert.equal(response.body.material.slides[0].body, Object.values(bodyBlocks).join("\n\n"));
    assert.equal(response.body.material.slides[0].layout, includeIllustration ? "split" : "stack");
    if (includeIllustration) assert.equal(response.body.material.slides[0].illustration.status, "ready");
    assert.ok(response.body.charge.cost > 0);
});

test("invalid structured slide content refunds credits and returns an actionable error", async () => {
    const h = harness({ results: [{ text: JSON.stringify({ slides: [{ title: "Tema", body: { essential: ["Texto inválido"] } }] }), usageMetadata }] });
    const response = await h.run({ materialType: "slides", sourceText: "Tema", slideOptions: { detail: "detailed" } });
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.code, "ai_response_incomplete");
    assert.equal(h.refunds(), 1);
    assert.equal(h.calls(), 1);
});

test("both providers receive option-specific slide schemas and return the same editable contract", async () => {
    const cases = [
        { detail: "concise", tone: "balanced", body: { essential: "Um conceito central." } },
        { detail: "detailed", tone: "inspiring", body: { essential: "Por que isso acontece?", explanation: "Uma explicação do mecanismo.", example: "Um exemplo aplicado.", challenge: "Compare os casos." } },
        { detail: "detailed", tone: "inspiring", contentMode: "preserve", body: { text: "Original English text. Do not translate." } }
    ];
    for (const provider of ["groq", "gemini"]) for (const sample of cases) {
        const h = harness({ provider, promptBuilder: promptFor, results: [{ text: JSON.stringify({ title: "Tema", slides: [{ title: "Ideia", type: "content", body: sample.body }] }), usageMetadata }] });
        const response = await h.run({ materialType: "slides", sourceText: "Pedido do professor", slideOptions: { detail: sample.detail, tone: sample.tone }, generationOptions: { contentMode: sample.contentMode || "auto", count: 1 } });
        assert.equal(response.statusCode, 200);
        const schema = provider === "groq" ? h.providerInputs[0].schemaConfig.schema : h.providerInputs[0].config.responseJsonSchema;
        assert.deepEqual(schema.properties.slides.items.properties.body.required, Object.keys(sample.body));
        assert.equal(response.body.material.slides[0].body, Object.values(sample.body).join("\n\n"));
        assert.equal(response.body.material.generation_options.detail, sample.detail);
        assert.equal(response.body.material.generation_options.tone, sample.tone);
        assert.equal(h.calls(), 1);
    }
});

test("genuinely oversized slide prompts are rejected without provider calls and all reservations are refunded", async () => {
    const h = harness({ promptBuilder: promptFor });
    const response = await h.run({ materialType: "slides", sourceText: "Texto completo do professor. ".repeat(600),
        slideOptions: { includeIllustration: true, detail: "detailed" }, generationOptions: { count: 6 } });
    assert.equal(response.statusCode, 413);
    assert.equal(response.body.code, "content_too_long");
    assert.equal(h.calls(), 0);
    assert.equal(h.refunds(), 1);
    assert.deepEqual(h.quotaRefunds, { requests: 1, tokens: 1 });
});

test("worksheet route generates all and only the selected activities in one metered request", async () => {
    const selected = ["wordtrail", "crossword"];
    const material = { ...worksheetFixture, activities: Object.fromEntries(selected.map(type => [type, worksheetFixture.activities[type]])) };
    const h = harness({ results: [{ text: JSON.stringify(material), usageMetadata }] });
    const response = await h.run({ materialType: "worksheet", sourceText: "verbos em inglês no passado", generationOptions: { worksheetTypes: selected, audience: "7º ano", difficulty: "hard" } });
    assert.equal(response.statusCode, 200); assert.equal(h.calls(), 1);
    assert.deepEqual(response.body.material.order, selected);
    assert.deepEqual(h.providerInputs[0].schemaConfig.schema.properties.activities.required, selected);
    assert.equal(response.body.material.generation_options.difficulty, "hard");
    assert.equal(h.events[0].generatedCount, 2);
    assert.ok(response.body.charge.cost > 0);
    assert.doesNotMatch(JSON.stringify(h.events), /took|came|Past simple|7º ano/);
});

test("worksheet route rejects unsupported selections before usage and refunds malformed results", async () => {
    for (const worksheetTypes of [[], ["quiz"], ["slides"], ["wordtrail", "wordtrail"]]) {
        const h = harness();
        const response = await h.run({ materialType: "worksheet", sourceText: "Tema", generationOptions: { worksheetTypes } });
        assert.equal(response.statusCode, 400); assert.equal(h.calls(), 0); assert.equal(h.events.length, 0);
    }
    const h = harness({ results: [{ text: JSON.stringify({ title: "Folha", activities: {} }), usageMetadata }] });
    const response = await h.run({ materialType: "worksheet", sourceText: "Tema", generationOptions: { worksheetTypes: ["wordtrail"] } });
    assert.equal(response.statusCode, 400); assert.equal(h.refunds(), 1);
    assert.equal(h.events[0].creditsCharged, 0);
    assert.equal(response.body.code, "invalid_worksheet_material");
});

test("large worksheet output budgets reach both providers without changing other activities", async () => {
    const activityOptions = Object.fromEntries(["wordtrail", "wordsearch", "crossword", "connections"].map(type => [type, type === "connections" ? { count: 8, clueCount: 8 } : { count: 30 }]));
    for (const provider of ["groq", "gemini"]) {
        const h = harness({ provider, results: [{ text: JSON.stringify(worksheetLargeFixture), usageMetadata }] });
        const response = await h.run({ materialType: "worksheet", sourceText: "verbos irregulares", generationOptions: { activityOptions } });
        assert.equal(response.statusCode, 200);
        const limit = provider === "groq" ? h.providerInputs[0].maxCompletionTokens : h.providerInputs[0].config.maxOutputTokens;
        assert.equal(limit, worksheetCompletionTokens({ activityOptions }));
        assert.equal(h.calls(), 1);
    }
    const regular = harness(); await regular.run();
    assert.equal(regular.providerInputs[0].maxCompletionTokens, 3500);
});

test("provider quota reserves the same worksheet output budget sent to generation", () => {
    const context = vm.createContext({ promptFor: () => "abc".repeat(100), activeAiTextProvider: () => "groq", groqMaxCompletionTokens: 3500, worksheetMaxCompletionTokens: 12000, worksheetCompletionTokens });
    const start = source.indexOf("function estimateProviderTokenReservation(");
    vm.runInContext(source.slice(start, source.indexOf("\n/**", start)), context);
    const options = { activityOptions: { wordtrail: { count: 30 }, crossword: { count: 30 }, wordsearch: { count: 30 } } };
    assert.equal(context.estimateProviderTokenReservation("worksheet", "", "", null, options), 100 + worksheetCompletionTokens(options));
    assert.equal(context.estimateProviderTokenReservation("quiz", "", "", null, {}), 3600);
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
