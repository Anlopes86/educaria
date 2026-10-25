import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeItemRefinement, refinementSchema, refinementPrompt, validateRefinedItem } from "../materials/item-refinement.js";
import { promptFor } from "../materials/prompts.js";
import core from "../../assets/js/item-refinement-core.js";
import { refinementFixtures } from "../../tools/fixtures/item-refinement.mjs";

const request = { field: "all", instruction: "Complete este tópico com um exemplo.", item: { title: "Fotossíntese", detail: "" },
    context: { title: "Plantas", neighbors: ["Raízes", "Folhas"], audience: "6º ano" } };

test("new and existing items carry bounded context and never require the original generation prompt", () => {
    const refinement = normalizeItemRefinement("mindmap", JSON.stringify(request));
    assert.equal(refinement.item.detail, "");
    assert.equal(refinement.item.title, "Fotossíntese");
    assert.equal(refinement.context.audience, "6º ano");
    assert.deepEqual(refinement.context.neighbors, ["Raízes", "Folhas"]);
    const schema = refinementSchema("mindmap", refinement).schema;
    assert.deepEqual(Object.keys(schema.properties), ["item"]);
    assert.deepEqual(schema.properties.item.required, ["title", "subtitle", "detail"]);
    const prompt = refinementPrompt("mindmap", JSON.stringify(refinement));
    assert.match(prompt, /apenas UM item/); assert.match(prompt, /Fotossíntese/); assert.match(prompt, /6º ano/);
    assert.equal(promptFor("mindmap", "", JSON.stringify(refinement), undefined, { operation: "refine-item" }), prompt);
    assert.doesNotMatch(prompt, /Gere.*[4-8] tópicos/);
});

test("individual field schemas cannot change colors, positions, other items or unrelated fields", () => {
    const refinement = normalizeItemRefinement("debate", { ...request, field: "guidance", item: { title: "Conclusão", time: "5 min" } });
    assert.deepEqual(refinementSchema("debate", refinement).schema.properties.item.required, ["guidance"]);
    assert.deepEqual(validateRefinedItem("debate", { item: { guidance: "Compare as duas posições." } }, refinement), { item: { guidance: "Compare as duas posições." } });
    for (const material of [ { item: { guidance: "ok", time: "10 min" } }, { item: {} }, { item: { guidance: ["bad"] } },
        { item: { guidance: "ok" }, steps: [] }, { item: { guidance: "x".repeat(5001) } } ]) {
        assert.throws(() => validateRefinedItem("debate", material, refinement), { code: "invalid_refined_item" });
    }
});

test("invalid requests and unexpected structures are rejected before generation", () => {
    assert.equal(normalizeItemRefinement("mindmap", undefined), null);
    for (const value of [null, [], "{", { ...request, field: "__proto__" }, { ...request, instruction: " " },
        { ...request, instruction: "x".repeat(1501) }, { ...request, item: { detail: {} } },
        { ...request, context: { neighbors: Array(31).fill("a") } } ]) {
        assert.throws(() => normalizeItemRefinement("mindmap", value), { code: "invalid_item_refinement" });
    }
    assert.throws(() => normalizeItemRefinement("quiz", request), { code: "invalid_item_refinement" });
});

for (const [type, item] of Object.entries(refinementFixtures)) test(`${type}: exact selected IDs and fields, including batches`, () => {
    const refinement = normalizeItemRefinement(type, { field: "all", instruction: "Refaça os itens selecionados.",
        items: [{ id: "item-3", item }, { id: "item-8", item }], context: { neighbors: [] } });
    const schema = refinementSchema(type, refinement).schema;
    assert.deepEqual(schema.properties.items.required, ["item-3", "item-8"]);
    const patch = Object.fromEntries(core.selectedKeys(type, item, "all").map(key => [key, item[key]]));
    const second = { ...patch };
    if (["wordtrail", "wordsearch"].includes(type)) second.term = "LUA";
    if (type === "crossword") second.answer = "LUA";
    const material = { items: { "item-8": second, "item-3": patch } };
    assert.deepEqual(validateRefinedItem(type, material, refinement).items["item-3"], patch);
    for (const wrong of [{ items: { "item-3": patch } }, { items: { "item-3": patch, "item-7": second } },
        { items: { ...material.items, "item-1": patch } }]) assert.throws(() => validateRefinedItem(type, wrong, refinement), { code: "invalid_refined_item" });
});

test("mixed quiz batch schemas preserve formats and enforce matching answer shapes", () => {
    const a = refinementFixtures.quiz, b = { kind: "true_false", prompt: "O Sol é uma estrela.", correct: "A", explanation: "Sim." }, c = { kind: "short_answer", prompt: "Explique.", model: "Resposta.", criteria: "Conceito." };
    const refinement = normalizeItemRefinement("quiz", { field: "all", instruction: "Mude 3, 5 e 8.", items: [a, b, c].map((item, i) => ({ id: `item-${[3,5,8][i]}`, item })), context: { neighbors: [] } });
    const schema = refinementSchema("quiz", refinement).schema.properties.items.properties;
    assert.deepEqual(schema["item-5"].properties.correct.enum, ["A", "B"]);
    assert.equal(schema["item-8"].properties.optionA, undefined);
    assert.equal(schema["item-3"].properties.kind, undefined);
    assert.throws(() => core.validatePatch("quiz", a, { ...a, optionB: a.optionA }, "all"));
    assert.throws(() => core.selectedKeys("quiz", a, "correct"));
});

test("paper constraints, clue counts, empty and oversized selections remain enforced", () => {
    const connections = refinementFixtures.connections;
    assert.throws(() => core.validatePatch("connections", connections, { clues: "Uma\nDuas" }, "clues"));
    assert.throws(() => core.validatePatch("connections", connections, { explanation: "a".repeat(301) }, "explanation", { surface: "print" }));
    assert.throws(() => core.validatePatch("crossword", refinementFixtures.crossword, { answer: "a".repeat(18) }, "answer", { surface: "print" }));
    assert.throws(() => core.validatePatch("crossword", refinementFixtures.crossword, { answer: "a".repeat(18) }, "answer"));
    assert.throws(() => core.validatePatch("connections", connections, { clues: "a".repeat(101) + "\nDuas\nTrês" }, "clues"));
    for (const items of [[], Array(13).fill({ id: "item-1", item: connections }), [{ id: "item-0", item: connections }], [{ id: "item-1", item: connections }, { id: "item-1", item: connections }]]) {
        assert.throws(() => normalizeItemRefinement("connections", { field: "all", instruction: "Refaça", items, context: { neighbors: [] } }));
    }
});

test("completing an empty item requires its teaching content and crossword clues", () => {
    for (const [type, key] of [["mindmap", "detail"], ["debate", "question"], ["debate", "guidance"], ["crossword", "clue"]]) {
        assert.throws(() => core.validatePatch(type, refinementFixtures[type], { ...refinementFixtures[type], [key]: "" }, "all"));
        const blank = Object.fromEntries(Object.keys(refinementFixtures[type]).map(field => [field, ""]));
        assert.deepEqual(core.validatePatch(type, blank, refinementFixtures[type], "all"), refinementFixtures[type]);
    }
});
