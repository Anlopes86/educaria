import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSlideIllustrationRequest, singleSlideIllustrationSchema, validateSingleSlideIllustration } from "../materials/slide-illustration-request.js";
import { promptFor } from "../materials/prompts.js";
import { diagramExamples } from "../../tools/fixtures/slide-diagrams.mjs";

test("single-slide illustration accepts content or a custom visual instruction, with bounded fields", () => {
    assert.equal(normalizeSlideIllustrationRequest("slides", undefined), null);
    const result = normalizeSlideIllustrationRequest("slides", JSON.stringify({ title: "Energia", body: "O Sol fornece energia.", instruction: "Compare as fontes", audience: "6º ano", ignored: "not forwarded" }));
    assert.equal(result.title, "Energia"); assert.equal(result.ignored, undefined);
    assert.equal(normalizeSlideIllustrationRequest("slides", { instruction: "Um esquema sobre energia" }).instruction, "Um esquema sobre energia");
    for (const raw of [{}, [], "{", { body: "a".repeat(6001) }, { title: {} }, { instruction: "a".repeat(1001) }]) {
        assert.throws(() => normalizeSlideIllustrationRequest("slides", raw), { code: "invalid_slide_illustration_request" });
    }
    assert.throws(() => normalizeSlideIllustrationRequest("quiz", { title: "Tema" }), { code: "invalid_slide_illustration_request" });
});

test("the isolated schema and prompt request one diagram and preserve existing slide content", () => {
    assert.deepEqual(Object.keys(singleSlideIllustrationSchema.schema.properties), ["illustration"]);
    const prompt = promptFor("slides", "Ignored full-deck instruction", '{"title":"PRIVATE","instruction":"Compare as fontes"}', undefined, { operation: "illustrate-slide" });
    assert.match(prompt, /UM slide existente/); assert.match(prompt, /PRIVATE/); assert.match(prompt, /Compare as fontes/);
    assert.doesNotMatch(prompt, /illustrations na raiz|Ignored full-deck instruction/);
    assert.match(prompt, /Não produza textos substitutos/);
});

test("valid diagrams remain editable; malformed, unavailable or full-deck results are rejected", () => {
    for (const illustration of diagramExamples) {
        assert.equal(validateSingleSlideIllustration({ illustration }, { title: "Tema" }).illustration.status, "ready");
    }
    for (const material of [{ slides: [] }, { illustration: null }, { illustration: { ...diagramExamples[0], links: [] } },
        { illustration: diagramExamples[0], title: "Replacement" }, { illustration: { version: 2, status: "not-needed" } }]) {
        assert.throws(() => validateSingleSlideIllustration(material, {}), { code: "invalid_slide_illustration" });
    }
    assert.throws(() => validateSingleSlideIllustration({ illustration: { version: 2, status: "needs-image" } }, {}), { code: "illustration_requires_image" });
});
