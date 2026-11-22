import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import answers from "../../assets/js/quiz-answers.js";
import { normalizeQuizMaterial } from "../../ai-service/materials/quiz.js";

const question = (index = 1) => ({ type: "multiple_choice", prompt: `Pergunta ${index}?`,
    options: [`Correta ${index}`, `Distrator um ${index}`, `Distrator dois ${index}`, `Distrator três ${index}`], correct_answer: "A", explanation: "Explicação do conceito." });

test("answer text and letter gabaritos resolve without defaulting an unknown answer to A", () => {
    const options = ["Sol", "Lua", "Terra", "Marte"];
    for (const value of ["Lua", " lua ", "B", "b)", "Alternativa B", "Opção B"]) assert.equal(answers.answerIndex(options, value), 1);
    assert.equal(answers.answerIndex(["B", "C", "D", "E"], "B"), 0, "answer text has priority over a letter");
    assert.equal(answers.answerIndex(options, "Vênus"), -1);
    assert.throws(() => normalizeQuizMaterial({ questions: [{ ...question(), correct_answer: "Vênus" }] }), { code: "invalid_quiz_material" });
});

test("8 generated answers at A become balanced while their meaning and explanations stay intact", () => {
    const source = Array.from({ length: 8 }, (_, index) => question(index));
    const original = structuredClone(source);
    const result = answers.balance(source, { random: () => 0.51 });
    assert.deepEqual(result.distribution, { A: 2, B: 2, C: 2, D: 2 });
    assert.deepEqual(source, original);
    result.questions.forEach((item, index) => {
        assert.equal(item.correct_answer, `Correta ${index}`);
        assert.equal(item.prompt, source[index].prompt);
        assert.equal(item.explanation, source[index].explanation);
        assert.deepEqual([...item.options].sort(), [...source[index].options].sort());
        assert.ok(answers.answerIndex(item.options, item.correct_answer) >= 0);
    });
});

test("mixed quizzes preserve true/false and open answers", () => {
    const tf = { type: "true_false", prompt: "Afirmação", options: ["Verdadeiro", "Falso"], correct_answer: "B" };
    const open = { type: "short_answer", prompt: "Explique", model_answer: "Modelo" };
    const result = answers.balance([question(), tf, open], { random: () => 0 });
    assert.deepEqual(result.questions[1], { ...tf, correct_answer: "Falso" });
    assert.deepEqual(result.questions[2], open);
    assert.deepEqual(answers.normalizeQuestion({ ...tf, correct_answer: "false" }).correct_answer, "Falso");
    assert.throws(() => answers.normalizeQuestion({ ...tf, correct_answer: "talvez" }));
});

test("letter references and positional alternatives are never blindly reordered", () => {
    const questions = [
        { ...question(1), options: ["Uma", "Duas", "Três", "Todas as anteriores"], correct_answer: "D" },
        { ...question(2), explanation: "A alternativa A é correta." },
        { ...question(3), options: ["One", "Two", "Three", "All of the above"], correct_answer: "D" }
    ];
    const balanced = answers.balance(questions, { random: () => 0 });
    assert.deepEqual(balanced.skipped, [0, 1, 2]);
    assert.equal(balanced.changed, 0);
    balanced.questions.forEach((item, index) => assert.deepEqual(item.options, questions[index].options));
});

test("redistributing only selected editor questions considers other positions without modifying them", () => {
    const items = [3, 5, 8].map(index => ({ kind: "multiple_choice", prompt: `Pergunta ${index}`, optionA: `Sol ${index}`,
        optionB: "Lua", optionC: "Terra", optionD: "Marte", correct: "A", explanation: "O Sol é uma estrela." }));
    const originals = structuredClone(items);
    const result = answers.balanceItems(items, { fixedAnswers: ["A", "A", "A", "B", "C"], random: () => 0 });
    assert.deepEqual(items, originals);
    assert.equal(result.items.length, 3);
    result.items.forEach((item, index) => {
        assert.equal(item[`option${item.correct}`], originals[index].optionA);
        assert.equal(item.prompt, originals[index].prompt);
        assert.equal(item.explanation, originals[index].explanation);
    });
    assert.ok(result.changed > 0);
});

test("invalid or duplicate alternatives fail instead of inventing a correct answer", () => {
    for (const patch of [{ options: ["a", "b"] }, { options: ["a", "a", "b", "c"] }, { options: ["", "b", "c", "d"] }, { correct_answer: "" }]) {
        assert.throws(() => answers.balance([{ ...question(), ...patch }]));
    }
});

test("editor importer resolves letter answers before replacing any existing cards", async () => {
    const source = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("function applyQuizFromStructuredData("), source.indexOf("const DEFAULT_AI_SLIDE_THEME"));
    let built = 0;
    const controls = Object.fromEntries(["prompt", "type", "correct", "explanation", "criteria", "model"].map(key => [key, { value: "" }]));
    const optionNodes = Array.from({ length: 4 }, () => ({ value: "" }));
    const card = { querySelector: selector => controls[selector.match(/data-field="([^"]+)"/)?.[1]], querySelectorAll: () => optionNodes };
    const context = vm.createContext({ window: { EducariaQuizAnswers: answers },
        document: { getElementById: () => null }, buildQuizCardsFromQuestions: () => { built++; return [card]; },
        setSelectByText: (control, value) => { control.value = value; }, renumberGeneratedCards() {}, dispatchBuilderContentChange() {} });
    vm.runInContext(fn, context);
    context.applyQuizFromStructuredData({ questions: [{ ...question(), correct_answer: "C" }] });
    assert.equal(controls.correct.value, "Alternativa C");
    assert.equal(built, 1);
    assert.throws(() => context.applyQuizFromStructuredData({ questions: [{ ...question(), correct_answer: "não existe" }] }));
    assert.equal(built, 1, "invalid response must not replace the draft");
});
