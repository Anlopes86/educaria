import assert from "node:assert/strict";
import { test } from "node:test";
import context from "../../assets/js/quiz-generation-context.js";

const lesson = (id, question, className, updatedAt) => ({ id, materialType: "quiz", className, updatedAt,
    draft: JSON.stringify({ pendingAiResult: { ownerUid: "teacher-A", material: { questions: [{ prompt: question, correct_answer: "PRIVATE ANSWER" }] } } }) });

test("the current account's recent quizzes span classes and prioritize the newest results", () => {
    const values = [lesson("old", "Qual é o rio?", "Turma A", "2026-11-20"), lesson("new", "Qual é o planeta?", "Turma B", "2026-11-23")];
    assert.deepEqual(context.collect(values, "teacher-A"), ["Qual é o planeta?", "Qual é o rio?"]);
    assert.deepEqual(context.collect(values, "teacher-B"), []);
    assert.deepEqual(context.collect(values, ""), []);
    assert.doesNotMatch(JSON.stringify(context.collect(values, "teacher-A")), /PRIVATE|Turma/);
});

test("converted drafts remain available, while corrupt and non-quiz materials do not block history", () => {
    const values = [{ materialType: "slides", draft: '{"stackHtml":"other"}' },
        { materialType: "quiz", draft: '{bad' }, { materialType: "quiz", draft: '{"stackHtml":"saved quiz"}' }];
    assert.deepEqual(context.collect(values, "teacher-A", html => html === "saved quiz" ? ["Qual é a obra?"] : []), ["Qual é a obra?"]);
});

test("history stays small, uses complete prompts and omits duplicate questions", () => {
    const values = [lesson("quiz", "Q", "A", "2026-11-23")];
    const questions = ["Onde fica?", " ONDE FICA? ", "long ".repeat(100), ...Array.from({ length: 50 }, (_, i) => `Questão ${i}`)];
    values[0].draft = JSON.stringify({ pendingAiResult: { ownerUid: "teacher-A", material: { questions: questions.map(prompt => ({ prompt })) } } });
    const result = context.collect(values, "teacher-A");
    assert.equal(result.length, 24); assert.equal(result[0], "Onde fica?");
    assert.ok(result.every(item => item.length <= 180)); assert.ok(result.join("").length <= 2600);
});
