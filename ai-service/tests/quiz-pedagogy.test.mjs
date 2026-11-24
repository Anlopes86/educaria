import assert from "node:assert/strict";
import { test } from "node:test";
import { quizCoveragePlan } from "../materials/quiz-pedagogy.js";
import { normalizeActivityGenerationOptions as normalize, applyActivityGenerationSettings as apply } from "../activity-generation-policy.js";
import { createQuizVariation } from "../materials/quiz-variety.js";
import { promptFor } from "../materials/prompts.js";

const topic = "conhecimentos gerais. geografia, história, cultura, esportes e ciências.";
test("coverage includes every requested domain and keeps exact totals", () => {
    for (const count of [5, 8, 10, 17, 30, 50]) {
        const plan = quizCoveragePlan(topic, count);
        assert.equal(plan.length, 5);
        assert.equal(plan.reduce((sum, item) => sum + item.count, 0), count);
        assert.ok(Math.max(...plan.map(item => item.count)) - Math.min(...plan.map(item => item.count)) <= 1);
        assert.ok(plan.find(item => item.area === "cultura").count >= 1);
    }
});
test("complex requests and unknown domains do not receive an incomplete inferred quota", () => {
    for (const source of [topic + " Sem história.", topic + " Priorize cultura.", topic + " e filosofia", "História da cultura brasileira", topic + " 70% cultura."]) {
        assert.deepEqual(quizCoveragePlan(source, 10), []);
    }
    assert.deepEqual(quizCoveragePlan(topic, 3), []);
});
test("subject contextualizes rather than replaces the topic in the actual provider prompt", () => {
    const options = normalize("quiz", { count: 10, subject: "Inglês", language: "en", audience: "Ensino médio", difficulty: "hard" });
    options.quizVariation = createQuizVariation({ sourceText: topic, options });
    const prompt = promptFor("quiz", "Criar quiz", topic, undefined, options);
    assert.ok(prompt.includes(topic));
    assert.match(prompt, /cultura: 2 pergunta/);
    assert.match(prompt, /NÃO autoriza trocar/);
    assert.match(prompt, /IDIOMA SELECIONADO:.*inglês/);
    assert.match(prompt, /DIFICULDADE DIFÍCIL/);
    assert.equal(apply("quiz", {}, options).generation_options.language, "en");
    assert.equal(apply("quiz", {}, options).generation_options.difficulty, "hard");
});
test("difficulty defaults to medium and all supported choices survive normalization", () => {
    assert.equal(normalize("quiz", {}).difficulty, "medium");
    for (const difficulty of ["easy", "medium", "hard"]) for (const language of ["auto", "pt-BR", "en", "es"]) {
        const options = normalize("quiz", { difficulty, language });
        assert.equal(options.difficulty, difficulty);
        assert.equal(options.language, language);
    }
    for (const raw of [{ difficulty: "extreme" }, { language: "instructions" }]) assert.throws(() => normalize("quiz", raw), { code: "invalid_generation_options" });
});
test("provided questions have no inferred topic quotas", () => {
    const options = normalize("quiz", { count: 10, contentMode: "preserve" });
    options.quizVariation = createQuizVariation({ sourceText: topic, options });
    const prompt = promptFor("quiz", "Organizar", topic, undefined, options);
    assert.doesNotMatch(prompt, /PLANO DE COBERTURA:/);
    assert.match(prompt, /preserve seu conteúdo e dificuldade/);
});
