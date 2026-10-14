import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeActivityGenerationOptions as normalize, activityGenerationInstructions as instructions, applyActivityGenerationSettings as apply } from "../activity-generation-policy.js";
import { promptFor } from "../materials/prompts.js";

const types = ["slides", "quiz", "flashcards", "memory", "wheel", "match", "mindmap", "debate", "wordsearch", "crossword", "hangman"];

test("new wheels use the demo palette even when AI returns one color", () => {
    const segments = Array.from({ length: 12 }, (_, i) => ({ text: `Item ${i+1}`, color: "#22c55e" }));
    const result = apply("wheel", { segments }, normalize("wheel", {}));
    assert.deepEqual(result.segments.slice(0, 6).map((item) => item.color), ["#a9d6c7", "#b4cce5", "#e9bc77", "#e9a78e", "#c2b5df", "#b9d9bd"]);
    assert.equal(result.segments[6].color, result.segments[0].color);
    assert.equal(segments[0].color, "#22c55e", "do not mutate source materials");
    assert.equal(result.segments[11].text, "Item 12");
});

test("new matching activities cannot reveal answers through generated colors", () => {
    const pairs = [{ left:"A", right:"B", color:"#ff0000" }, { left:"C", right:"D", color:"#00ff00" }];
    const result = apply("match", { pairs }, normalize("match", { shuffle: true }));
    assert.deepEqual(result.pairs.map((pair) => pair.color), ["#527f8c", "#527f8c"]);
    assert.equal(result.pairs[1].right, "D"); assert.equal(result.shuffle_right, true);
    assert.equal(pairs[0].color, "#ff0000");
});

for (const type of types) {
    test(`${type}: count, audience, subject and objective reach the actual provider prompt`, () => {
        const options = normalize(type, { count: 6, audience: "EJA", className: "5º ano A", subject: "Ciências", objective: "Aplicar no cotidiano" });
        const prompt = promptFor(type, "", "Fotossíntese", undefined, options);
        assert.match(prompt, /exatamente 6 itens/);
        assert.match(prompt, /sem infantilização/);
        assert.match(prompt, /Aplicar no cotidiano/);
        assert.match(prompt, /Ciências/);
        assert.equal(apply(type, {}, options).generation_options.count, 6);
    });
}

for (const [format, expected] of [["choice", /TODAS.*multiple_choice/], ["open", /TODAS.*type open/], ["true-false", /TODAS.*true_false/], ["mixed", /inclua os três tipos/]]) {
    test(`quiz ${format} has an exclusive or explicitly mixed instruction`, () => assert.match(instructions("quiz", normalize("quiz", { format })), expected));
}
test("flashcard examples are requested explicitly and disabled deterministically", () => {
    assert.match(instructions("flashcards", normalize("flashcards", { examples: true })), /em cada card/);
    const result = apply("flashcards", { cards: [{ front: "Sol", back: "Estrela", example: "Nota não solicitada" }] }, normalize("flashcards", { examples: false }));
    assert.equal(result.cards[0].example, "");
});
test("map, debate, wheel and matching controls survive an inconsistent provider result", () => {
    assert.equal(apply("mindmap", { layout: "topics" }, normalize("mindmap", { layout: "radial" })).layout, "radial");
    assert.equal(apply("debate", { format: "Dois lados" }, normalize("debate", { format: "guided-circle" })).format, "Roda guiada");
    assert.equal(apply("wheel", { eliminate_used: false }, normalize("wheel", { eliminate: true })).eliminate_used, true);
    assert.equal(apply("match", { shuffle_right: true }, normalize("match", { shuffle: false })).shuffle_right, false);
    assert.notEqual(instructions("debate", normalize("debate", { format: "guided-circle" })), instructions("debate", normalize("debate", { format: "two-sides" })));
});
test("legacy editor labels retain selected count, format, examples and audience", () => {
    const quiz = normalize("quiz", undefined, "Gerar 8 perguntas. Formato desejado: Perguntas abertas. Ano ou público: 7º ano.");
    assert.equal(quiz.format, "open"); assert.equal(quiz.count, 8); assert.equal(quiz.audience, "7º ano");
    assert.equal(normalize("flashcards", undefined, "Incluir exemplos: Não.").examples, false);
    assert.equal(normalize("match", undefined, "Manter a coluna B na ordem normal.").shuffle, false);
});
for (const raw of [null, [], "bad", { count: 0 }, { count: 100 }, { count: true }, { count: "oops" }, { count: 2.5 }, { audience: "x".repeat(161) }, { eliminate: "perhaps" }]) {
    test(`reject invalid options before generation: ${JSON.stringify(raw).slice(0, 40)}`, () => assert.throws(() => normalize("quiz", raw), { code: "invalid_generation_options" }));
}
test("explicit audience overrides the class for every activity", () => {
    assert.match(instructions("memory", normalize("memory", { audience: "ensino médio", className: "2º ano A" })), /adequados ao ensino médio/);
    assert.match(instructions("memory", normalize("memory", { className: "2º ano A" })), /anos iniciais/);
    assert.match(instructions("memory", normalize("memory", { className: "Turma azul" })), /não invente idade/);
});
