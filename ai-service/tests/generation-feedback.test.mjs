import assert from "node:assert/strict";
import { test } from "node:test";
import { MATERIAL_TYPES, schemaFor } from "../materials/schemas.js";
import { groqStrictJsonSchema } from "../ai-text-provider.js";
import { withGenerationFeedback, extractGenerationFeedback, generationFeedback, generationFeedbackInstruction } from "../materials/generation-feedback.js";
import { normalizeItemRefinement, refinementSchema, validateRefinedItem } from "../materials/item-refinement.js";
import { refinementFixtures } from "../../tools/fixtures/item-refinement.mjs";

test("all creation formats can return feedback in the same response without changing their material schema", () => {
    for (const type of MATERIAL_TYPES) {
        const config = schemaFor(type), before = structuredClone(config);
        const withFeedback = withGenerationFeedback(config);
        assert.equal(withFeedback.schema.properties.assistant_message.maxLength, 600);
        assert.ok(groqStrictJsonSchema(withFeedback.schema).required.includes("assistant_message"));
        assert.deepEqual(config, before);
        assert.match(generationFeedbackInstruction, /SUGESTÕES/);
    }
});

test("feedback is optional, bounded and removed before content validation", () => {
    const material = { title: "Texto", questions: [] };
    assert.deepEqual(extractGenerationFeedback(material), { material, message: "" });
    const extracted = extractGenerationFeedback({ ...material, assistant_message: "Criei\n\u0000uma atividade." });
    assert.deepEqual(extracted.material, material);
    assert.equal(extracted.message, "Criei uma atividade.");
    assert.equal(extractGenerationFeedback({ ...material, assistant_message: "a".repeat(700) }).message.length, 600);
    assert.equal(extractGenerationFeedback({ ...material, assistant_message: {} }).message, "");
});

test("targeted feedback cannot expand the allowed IDs or editable fields", () => {
    const original = refinementFixtures.quiz;
    const request = normalizeItemRefinement("quiz", { field: "options", instruction: "Mude os distratores.",
        items: [{ id: "item-3", item: original }, { id: "item-8", item: original }], context: { neighbors: ["Uma outra questão"] } });
    const schema = withGenerationFeedback(refinementSchema("quiz", request));
    assert.equal(schema.schema.properties.items.properties["item-3"].properties.prompt, undefined);
    const patch = { optionA: "Sol", optionB: "Lua", optionC: "Pedra", optionD: "Água", correct: "A", explanation: "O Sol emite luz." };
    const { material, message } = extractGenerationFeedback({ items: { "item-3": patch, "item-8": patch }, assistant_message: "Preparei novas alternativas para a seleção." });
    assert.deepEqual(validateRefinedItem("quiz", material, request), material);
    assert.throws(() => validateRefinedItem("quiz", { items: { "item-3": { ...patch, prompt: "Invadir pergunta" }, "item-8": patch } }, request));
    const feedback = generationFeedback("quiz", material, { message, refinement: request });
    assert.match(feedback.summary, /questões 3, 8/);
    assert.match(feedback.summary, /demais itens não foram alterados/);
    assert.equal(feedback.message, message);
});

test("creation summary counts delivered content rather than claims from the model", () => {
    const feedback = generationFeedback("quiz", { questions: Array(4).fill(refinementFixtures.quiz) }, { message: "Pedido preparado." });
    assert.match(feedback.summary, /4 questões/);
    assert.equal(feedback.message, "Pedido preparado.");
    assert.match(generationFeedback("slides", { slides: [{}] }).summary, /1 slide\./);
});
