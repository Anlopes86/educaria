import assert from "node:assert/strict";
import { test } from "node:test";
import { schemaFor } from "../materials/schemas.js";
import { promptFor } from "../materials/prompts.js";
import { normalizeSlidesMaterial } from "../materials/slides.js";
import { recoverRejectedSlideResponse } from "../materials/slide-response-recovery.js";
import { normalizeSlideGenerationOptions } from "../slide-generation-policy.js";
import { normalizeActivityGenerationOptions } from "../activity-generation-policy.js";
import { generateGroqStructuredMaterial, groqStrictJsonSchema } from "../ai-text-provider.js";
import { diagramExamples } from "../../tools/fixtures/slide-diagrams.mjs";

const schema = schemaFor("slides");
const completeMaterial = illustration => ({ title: "Revisão de Ciências", visual_theme: {
    name: "Claro", rationale: "Leitura em sala", font: "Leitura limpa", accent: "#173c43", secondary_accent: "#73549b",
    background: "#ffffff", alternate_background: "#eeeeee", text: "#173c43", contrast_background: "#173c43", contrast_text: "#ffffff"
}, slides: [{ type: "content", title: "Energia e seres vivos", subtitle: "", body: "A energia passa entre os seres vivos pela alimentação.\nObserve os exemplos e explique a relação.",
    teacher_notes: "Ouça as respostas.", visual_variant: "light", layout: "split", image_prompt: "", illustration }] });
const withoutMetadata = () => {
    const { version, description, title, ...partial } = structuredClone(diagramExamples[0]);
    return partial;
};
const rejection = (material, usage) => ({ error: { code: "json_validate_failed", message: "missing properties: 'version', 'description', 'title'",
    failed_generation: typeof material === "string" ? material : JSON.stringify(material) }, usage });
const request = (payload, config = schema, status = 400) => generateGroqStructuredMaterial({
    apiKey: "test-only", prompt: "Tema sintético", schemaConfig: config,
    fetchImpl: async () => new Response(JSON.stringify(payload), { status })
});

test("illustration recovery preserves all structured teaching blocks but never invents missing lesson fields", () => {
    const config = schemaFor("slides", { includeIllustration: true, detail: "detailed", tone: "inspiring" }, { contentMode: "auto" });
    const material = completeMaterial(withoutMetadata());
    material.slides[0].body = { essential: "Como a energia chega até nós?", explanation: "A energia é transferida pela alimentação.", example: "Uma planta alimenta um consumidor.", challenge: "Trace um outro caminho possível." };
    const recovered = recoverRejectedSlideResponse(JSON.stringify(material), config);
    assert.deepEqual(recovered.slides[0].body, material.slides[0].body);
    assert.equal(normalizeSlidesMaterial(recovered, { includeIllustration: true }).slides[0].body, Object.values(material.slides[0].body).join("\n\n"));
    delete material.slides[0].body.explanation;
    assert.equal(recoverRejectedSlideResponse(JSON.stringify(material), config), null);
});

test("the exact missing version/description/title failure recovers a valid diagram without inventing nodes or links", async () => {
    const material = completeMaterial(withoutMetadata());
    const original = structuredClone(material);
    const result = recoverRejectedSlideResponse(JSON.stringify(material), schema);
    assert.deepEqual(material, original);
    assert.equal(result.slides[0].body, original.slides[0].body);
    assert.equal(result.slides[0].teacher_notes, original.slides[0].teacher_notes);
    assert.equal(result.slides[0].illustration.status, "ready");
    assert.equal(result.slides[0].illustration.version, 2);
    assert.equal(result.slides[0].illustration.title, original.slides[0].title);
    assert.deepEqual(result.slides[0].illustration.nodes, original.slides[0].illustration.nodes);
    assert.deepEqual(result.slides[0].illustration.links, original.slides[0].illustration.links);
    const response = await request(rejection(material));
    assert.equal(JSON.parse(response.text).slides[0].illustration.status, "ready");
    assert.deepEqual(response.usageMetadata, {});
    assert.equal(response.unmeteredRecovery, true);
});

for (const enabled of [false, true]) test(`actual wire schema, prompt and normalized result honor illustration=${enabled}`, async () => {
    const options = normalizeSlideGenerationOptions({ includeIllustration: enabled });
    const config = schemaFor("slides", options);
    const prompt = promptFor("slides", "Gerar 3 slides.", "Explique o ciclo da água para o 6º ano.", options, normalizeActivityGenerationOptions("slides", { count: 3 }));
    let calls = 0, body;
    const material = completeMaterial(withoutMetadata());
    if (enabled) material.illustrations = [{ slide_number: 1, diagram: material.slides[0].illustration }];
    delete material.slides[0].illustration;
    const result = await generateGroqStructuredMaterial({ apiKey: "test-only", schemaConfig: config, prompt,
        fetchImpl: async (_, init) => { calls++; body = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(material) } }], usage: { total_tokens: 123 } })); } });
    const wireSlide = body.response_format.json_schema.schema.properties.slides.items;
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(Object.hasOwn(wireSlide.properties, "illustration"), false);
    assert.equal(wireSlide.required.includes("illustration"), false);
    const wireSchema = body.response_format.json_schema.schema;
    assert.equal(Object.hasOwn(wireSchema.properties, "illustrations"), enabled);
    assert.equal(wireSchema.required.includes("illustrations"), enabled);
    if (enabled) {
        assert.equal(wireSchema.properties.illustrations.minItems, 1);
        assert.deepEqual(wireSchema.properties.illustrations.items.properties.diagram.properties.status.enum, ["ready", "needs-image"]);
    }
    assert.ok(Math.ceil(prompt.length / 3) < 4000, `prompt exceeds default free-tier input cap: ${prompt.length}`);
    assert.match(prompt, enabled ? /TODOS os campos version, status, description, title/ : /Não inclua o campo illustration/);
    const final = normalizeSlidesMaterial(JSON.parse(result.text), options);
    assert.equal(final.slides[0].layout, enabled ? "split" : "stack");
    assert.equal(final.slides[0].body, material.slides[0].body);
    assert.equal(calls, 1);
});

test("disabled illustration schema never mutates the shared schema or other formats", () => {
    schemaFor("slides", { includeIllustration: false });
    assert.ok(schemaFor("slides").schema.properties.slides.items.properties.illustration);
    assert.ok(schemaFor("slides", { includeIllustration: true }).schema.properties.illustrations);
    assert.deepEqual(schemaFor("quiz", { includeIllustration: false }), schemaFor("quiz"));
    const wire = groqStrictJsonSchema(schema.schema);
    assert.equal(wire.properties.slides.items.properties.illustration.properties.title.maxLength, undefined);
});

test("the reported No-mode failure (not-needed missing title) preserves content and never draws", async () => {
    const illustration = { version: 2, status: "not-needed", description: "", layout: "cards", caption: "", nodes: [], links: [] };
    const response = await request(rejection(completeMaterial(illustration)));
    const material = normalizeSlidesMaterial(JSON.parse(response.text), { includeIllustration: false });
    assert.equal(material.slides[0].layout, "stack");
    assert.deepEqual(material.slides[0].illustration, { description: "", elements: [] });
});

test("unrecoverable illustration preserves text, marks invalid, and cannot render a misleading diagram", () => {
    for (const illustration of [null, "<svg onload=bad>", {}, { ...withoutMetadata(), links: [] }, { ...diagramExamples[0], version: 3 }]) {
        const material = completeMaterial(illustration);
        const result = recoverRejectedSlideResponse(JSON.stringify(material), schema);
        assert.equal(result.slides[0].body, material.slides[0].body);
        assert.equal(result.slides[0].illustration.status, "invalid");
        assert.deepEqual(result.slides[0].illustration.nodes, []);
        assert.equal(normalizeSlidesMaterial(result, { includeIllustration: true }).slides[0].layout, "stack");
    }
});

test("recovery refuses malformed lesson content, extra properties and truncated responses", async () => {
    const valid = completeMaterial(withoutMetadata());
    const cases = [null, [], {}, { ...valid, title: "" }, { ...valid, slides: [] }, { ...valid, visual_theme: null },
        { ...valid, script: "bad" }, { ...valid, slides: [null] }, { ...valid, slides: [{ ...valid.slides[0], body: "" }] },
        { ...valid, slides: [{ ...valid.slides[0], type: "invented" }] }, { ...valid, slides: [{ ...valid.slides[0], teacher_notes: {} }] },
        { ...valid, slides: Array(31).fill(valid.slides[0]) }];
    for (const material of cases) {
        assert.equal(recoverRejectedSlideResponse(JSON.stringify(material), schema), null);
        await assert.rejects(request(rejection(material)), { code: "json_validate_failed" });
    }
    for (const text of ["", JSON.stringify(valid).slice(0, -1), "x".repeat(512001), "{}; alert(1)"])
        assert.equal(recoverRejectedSlideResponse(text, schema), null);
    assert.equal(recoverRejectedSlideResponse(JSON.stringify(valid), schemaFor("quiz")), null);
    assert.equal(recoverRejectedSlideResponse(JSON.stringify(valid), { name: "educaria_slides" }), null);
    const missingOtherField = structuredClone(valid);
    delete missingOtherField.slides[0].teacher_notes;
    assert.equal(recoverRejectedSlideResponse(JSON.stringify(missingOtherField), schema), null);
});

test("recovery never masks rate limits, authorization failures, other provider errors, or other activities", async () => {
    const payload = rejection(completeMaterial(withoutMetadata()));
    for (const status of [401, 429, 500, 503]) await assert.rejects(request(payload, schema, status), { status });
    await assert.rejects(request(payload, schemaFor("quiz")), { code: "json_validate_failed" });
    await assert.rejects(request({ error: { ...payload.error, code: "invalid_api_key" } }), { code: "invalid_api_key" });
});

test("recovered response keeps real usage exactly once and never exposes failed-generation text in errors", async () => {
    const result = await request(rejection(completeMaterial(withoutMetadata()), { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }));
    assert.equal(result.usageMetadata.totalTokenCount, 150);
    assert.equal(result.unmeteredRecovery, false);
    await assert.rejects(request(rejection("PRIVATE INCOMPLETE LESSON")), error => !JSON.stringify(error).includes("PRIVATE"));
});

test("a token-truncated provider success is not accepted as a complete presentation", async () => {
    await assert.rejects(request({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(completeMaterial(diagramExamples[0])) } }],
        usage: { prompt_tokens: 20, completion_tokens: 100, total_tokens: 120 } }, schema, 200),
        error => error.code === "groq_response_incomplete" && error.status === 502 && error.usageMetadata.totalTokenCount === 120);
});
