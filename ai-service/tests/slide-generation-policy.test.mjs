import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { normalizeSlideGenerationOptions as options, slideAudienceProfile, slidePedagogyInstructions, normalizeGeneratedSlideBody } from "../slide-generation-policy.js";
import { normalizeActivityGenerationOptions, applyActivityGenerationSettings } from "../activity-generation-policy.js";
import { promptFor } from "../materials/prompts.js";

for (const [label, detail, expected] of [
    ["Mais enxuto", "concise", /1 a 2 blocos curtos/],
    ["Equilibrado", "balanced", /conceito com explicação breve/],
    ["Mais detalhado", "detailed", /explique o que significa, como ou por que/]
]) {
    test(`detail ${label}: distinct visible-content guidance`, () => {
        const normalized = options({ detail: label });
        assert.equal(normalized.detail, detail);
        assert.match(slidePedagogyInstructions(normalized).join("\n"), expected);
        assert.deepEqual(options(normalized), normalized);
    });
}

for (const [label, tone, expected] of [
    ["Claro e equilibrado", "balanced", /Títulos descritivos/],
    ["Mais visual e direto", "visual", /sequências com setas/],
    ["Mais explicativo", "explanatory", /por que acontece/],
    ["Mais inspirador", "inspiring", /pequenos desafios/]
]) {
    test(`tone ${label}: changes approach without erasing detail`, () => {
        const normalized = options({ detail: "detailed", tone: label });
        assert.equal(normalized.tone, tone);
        const prompt = slidePedagogyInstructions(normalized).join("\n");
        assert.match(prompt, expected);
        assert.match(prompt, /desenvolva o raciocínio no body/);
        assert.deepEqual(options(normalized), normalized);
    });
}

for (const [audience, expected] of [
    ["Educação infantil", "early"], ["Pré-escola", "early"], ["1º ano", "primary"],
    ["5º ano B", "primary"], ["6º ano", "middle"], ["9ª série", "middle"],
    ["1º ano do ensino médio", "secondary"], ["EJA", "adult"],
    ["Adultos iniciantes", "adult"], ["Ensino superior", "higher"], ["Iniciantes em inglês", "general"]
]) {
    test(`audience ${audience}: age-appropriate profile`, () => {
        assert.equal(slideAudienceProfile(options({ audience })).profile, expected);
    });
}

test("explicit audience wins over grade in selected class", () => {
    assert.deepEqual(slideAudienceProfile(options({ audience: "EJA", className: "3º ano A" })), {
        audience: "EJA", profile: "adult", inferredFromClass: false
    });
    assert.equal(slideAudienceProfile(options({ className: "7º Ano B" })).profile, "middle");
    assert.equal(slideAudienceProfile(options({ className: "7º Ano B" })).inferredFromClass, true);
    for (const className of ["Turma Azul", "Sala 12", "Grupo 3"]) {
        assert.equal(slideAudienceProfile(options({ className })).audience, "");
    }
});

test("old editor and quick creation labels are supported", () => {
    const result = options(undefined, "Gerar 8 slides. Público ou ano: 5º ano. Objetivo da aula: explicar fotossíntese. Disciplina: Ciências. Turma: 5º ano A. Tom desejado: Mais explicativo. Nível de detalhamento: Mais detalhado. Modo visual: padrão.");
    assert.deepEqual(result, { detail: "detailed", tone: "explanatory", audience: "5º ano", objective: "explicar fotossíntese", subject: "Ciências", className: "5º ano A", includeIllustration: false });
    assert.equal(options(undefined, "Ano ou público: EJA.").audience, "EJA");
});

test("structured fields preserve punctuation and explicit empty values", () => {
    const result = options(JSON.stringify({ audience: "", objective: "Explicar. Comparar; aplicar.", detail: "concise" }), "Público ou ano: 5º ano.");
    assert.equal(result.audience, "");
    assert.equal(result.objective, "Explicar. Comparar; aplicar.");
});

for (const raw of [null, false, 42, [], "null", "[]", "broken", { audience: {} }, { audience: "x".repeat(161) }, { objective: "x".repeat(281) }, "x".repeat(3001)]) {
    test(`invalid configuration rejected (${JSON.stringify(raw).slice(0, 35)})`, () => {
        assert.throws(() => options(raw), { code: "invalid_slide_options" });
    });
}

test("body formatting never discards explanations or cuts sentences", () => {
    const lines = Array.from({ length: 6 }, (_, i) => `Exemplo ${i}: a energia do Sol sustenta os seres vivos; Dr. Silva explica por que isso acontece.`);
    assert.equal(normalizeGeneratedSlideBody(lines.join("\r\n"), "content"), lines.join("\n"));
    assert.equal(normalizeGeneratedSlideBody(lines[0], "cover"), lines[0]);
    assert.equal(normalizeGeneratedSlideBody("- Texto\n• Outro", "content"), "- Texto\n- Outro");
    assert.equal(normalizeGeneratedSlideBody("", "cover"), "Visão geral da aula");
});

const server = await fs.readFile(new URL("../server.js", import.meta.url), "utf8");

test("actual server prompt includes structured pedagogical fields", () => {
    const prompt = promptFor("slides", "Gerar 8 slides. Modo visual: personalizado.", "Fotossíntese", options({ detail: "detailed", tone: "inspiring", audience: "EJA", subject: "Ciências", objective: "Entender energia" }));
    assert.match(prompt, /desenvolva o raciocínio no body/);
    assert.match(prompt, /pequenos desafios/);
    assert.match(prompt, /sem infantilização/);
    assert.match(prompt, /Entender energia/);
    assert.match(prompt, /Gerar 8 slides/);
    assert.match(prompt, /Crie visual_theme/);
    assert.doesNotMatch(prompt, /máximo 10 palavras|2 a 5 linhas/);
});

test("default slides and other activity prompts still work", () => {
    assert.match(promptFor("slides", "Gerar 5 slides.", "Tema"), /EQUILIBRADO/);
    assert.doesNotMatch(promptFor("quiz", "Gerar 5 perguntas.", "Tema"), /CONFIGURAÇÃO PEDAGÓGICA/);
});

test("production route passes options to generation and rejects bad fields before spending credits", async () => {
    const { validateDiscoverySource } = await import("../materials/discovery.js");
    let handler, received, reserved = 0;
    const context = vm.createContext({
        app: { post: (...args) => { handler = args.at(-1); } },
        aiRateLimit: null, requireAiAuth: null, aiGenerationRateLimit: null, upload: { single: () => null },
        schemaFor: () => ({}), normalizeSlideGenerationOptions: options, extractTextFromFile: async () => "",
        normalizeActivityGenerationOptions, applyActivityGenerationSettings, validateDiscoverySource,
        activeAiTextProvider: () => "groq", aiCreditUsagePolicy: {}, aiGenerationMaxAttempts: 1,
        activeAiTextModel: () => "openai/gpt-oss-120b", aiPlanForRequest: () => "free", isAiUnlimitedUser: () => false,
        createUsageObservation: () => ({ finish: () => null }), usageContext: () => ({}), aiUsageAnalytics: { record: async () => {} },
        estimateAiCreditReservation: () => 10, reserveAiDailyCredit: async () => { reserved++; return { reserved: true, reservation: {} }; },
        estimateProviderTokenReservation: (_, __, ___, value) => { assert.equal(value.audience, "EJA"); return 100; },
        reserveAiProviderTokens: async () => ({ reserved: true, reservation: {} }),
        reserveAiDailyRequests: async () => ({ reserved: true, reservation: {} }),
        generateStructuredMaterialWithRetry: async (_, __, ___, ____, value) => { received = value; return { material: { slides: [] }, usageMetadata: {}, providerRequests: 1 }; },
        aiCreditsForUsage: () => ({ credits: 1, usage: { totalTokens: 10 } }), normalizeSlidesMaterial: (value) => value,
        settleAiProviderTokens: async () => ({}), settleAiDailyRequests: async () => ({}),
        settleAiDailyCredit: async () => ({ credits: {}, charged: 1 }), isUploadValidationError: () => false
    });
    const start = server.indexOf('app.post("/api/ai/generate",');
    const end = server.indexOf('\napp.post(', start + 1);
    vm.runInContext(server.slice(start, end), context);
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await handler({ body: { materialType: "slides", action: "Gerar 8 slides.", sourceText: "Fotossíntese", slideOptions: '{"detail":"detailed","audience":"EJA"}' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(received.detail, "detailed");
    assert.equal(response.body.material.generation_options.audience, "EJA");
    await handler({ body: { materialType: "slides", slideOptions: "bad" } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "invalid_slide_options");
    assert.equal(reserved, 1);
});
