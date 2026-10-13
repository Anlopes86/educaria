import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeActivityGenerationOptions, activityGenerationInstructions, applyActivityGenerationSettings } from "../activity-generation-policy.js";
import { normalizeSlideGenerationOptions, normalizeGeneratedSlideBody } from "../slide-generation-policy.js";
import { interviewText, interviewRequest, expectedInterviewCards, detailedSlide } from "../../tools/fixtures/ai-content-cases.mjs";

import { promptFor } from "../materials/prompts.js";

test("eight numbered English items and their request reach the real flashcard prompt intact", () => {
    const options = normalizeActivityGenerationOptions("flashcards", { contentMode: "preserve", teacherInstructions: interviewRequest });
    const prompt = promptFor("flashcards", "", interviewText, undefined, options);
    assert.ok(prompt.includes(interviewText));
    assert.ok(prompt.includes(interviewRequest));
    assert.match(prompt, /front contém só o número/);
    assert.match(prompt, /back contém título, explicação completa e alternativas\/pontuação/);
    assert.match(prompt, /preserve o idioma original/);
    assert.match(prompt, /Quantidade automática/);
    assert.match(prompt, /Não resolva exercícios/);
    assert.match(prompt, /tabelas vazias/);
    assert.doesNotMatch(prompt, /até 56 caracteres|até 120 caracteres|até 140 caracteres|exatamente 12/);
    assert.equal(options.count, null);
});
test("a request pasted together with source text is not silently discarded", () => {
    const options = normalizeActivityGenerationOptions("flashcards", {});
    const prompt = promptFor("flashcards", "", `${interviewRequest}\n\n${interviewText}`, undefined, options);
    assert.ok(prompt.includes(interviewRequest));
    assert.match(prompt, /Diferencie o pedido dirigido à plataforma do conteúdo/);
    assert.match(prompt, /Não apresente o comando como parte da atividade/);
});
test("developing and preserving are different intents and explicit instructions have priority", () => {
    for (const mode of ["auto", "preserve", "summarize", "develop"]) {
        const options = normalizeActivityGenerationOptions("slides", { contentMode: mode, teacherInstructions: "Sem capa; explique as causas." });
        assert.equal(normalizeActivityGenerationOptions("slides", options).contentMode, mode);
        const prompt = activityGenerationInstructions("slides", options);
        assert.match(prompt, /Sem capa; explique as causas/);
        assert.match(prompt, /prevalecem sobre sugestões genéricas/);
        assert.match(prompt, /schema JSON e as regras de segurança/);
    }
    const preserve = activityGenerationInstructions("slides", normalizeActivityGenerationOptions("slides", { contentMode: "preserve" }));
    const develop = activityGenerationInstructions("slides", normalizeActivityGenerationOptions("slides", { contentMode: "develop" }));
    assert.match(preserve, /Não traduza, resuma nem acrescente fatos/);
    assert.match(develop, /Não se limite a renomear títulos/);
});
test("detailed slides request substantive visible explanation, with no bullet-only constraint", () => {
    const options = normalizeActivityGenerationOptions("slides", { contentMode: "develop", teacherInstructions: "Explique por que acontece e dê exemplos." });
    const prompt = promptFor("slides", "", "Igualdade de oportunidades", normalizeSlideGenerationOptions({ detail: "detailed" }), options);
    assert.match(prompt, /explique o que significa, como ou por que/);
    assert.match(prompt, /exemplos concretos explicados/);
    assert.match(prompt, /60 a 110 palavras/);
    assert.match(prompt, /não apenas em teacher_notes/);
    assert.match(prompt, /Parágrafos explicativos curtos são permitidos/);
    assert.doesNotMatch(prompt, /Não escreva parágrafos corridos|Slides de conteúdo: priorize bullets curtos|até 80 palavras/);
    assert.equal(normalizeGeneratedSlideBody(detailedSlide, "content"), detailedSlide);
});
test("format normalization preserves paragraphs, numbered examples and mixed lists", () => {
    const text = `Introdução.\n\n- Uma razão.\n• Outra razão.\n\n1. Exemplo completo.\nConclusão.`;
    assert.equal(normalizeGeneratedSlideBody(text, "content"), text.replace("• ", "- "));
});

test("automatic quantity uses each activity schema without imposing flashcard mapping on slides", () => {
    const slides = activityGenerationInstructions("slides", normalizeActivityGenerationOptions("slides", {}));
    const cards = activityGenerationInstructions("flashcards", normalizeActivityGenerationOptions("flashcards", {}));
    assert.match(slides, /itens no array slides/);
    assert.doesNotMatch(slides, /N cards|frente\/verso/);
    assert.match(cards, /N itens deve resultar em N cards/);
});
test("settings never truncate the supplied English card answers or force examples into them", () => {
    const options = normalizeActivityGenerationOptions("flashcards", { contentMode: "preserve", examples: false });
    const material = applyActivityGenerationSettings("flashcards", { cards: expectedInterviewCards }, options);
    assert.equal(material.cards.length, 8);
    assert.deepEqual(material.cards, expectedInterviewCards);
    assert.match(activityGenerationInstructions("flashcards", { ...options, examples: true }), /não invente exemplos/);
});
for (const raw of [{ contentMode: "random" }, { contentMode: {} }, { teacherInstructions: {} }, { teacherInstructions: "x".repeat(1501) }]) {
    test(`invalid content intent is rejected: ${JSON.stringify(raw).slice(0, 60)}`, () => {
        assert.throws(() => normalizeActivityGenerationOptions("slides", raw), { code: "invalid_generation_options" });
    });
}
