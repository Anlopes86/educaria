import assert from "node:assert/strict";
import { test } from "node:test";
import { slideContentSchema, normalizeSlideContent } from "../materials/slide-content.js";
import { schemaFor } from "../materials/schemas.js";
import { normalizeSlidesMaterial } from "../materials/slides.js";
import { groqStrictJsonSchema, generateGroqStructuredMaterial } from "../ai-text-provider.js";
import { normalizeSlideGenerationOptions } from "../slide-generation-policy.js";

test("detail changes required visible blocks, not just an adjective in the prompt", () => {
    const expected = { concise: ["essential"], balanced: ["essential", "support"], detailed: ["essential", "explanation", "example"] };
    for (const [detail, keys] of Object.entries(expected)) {
        const body = slideContentSchema({ detail });
        assert.deepEqual(body.required, keys);
        assert.deepEqual(Object.keys(body.properties), keys);
        assert.equal(body.additionalProperties, false);
        assert.deepEqual(groqStrictJsonSchema(body).required, keys);
    }
});

test("each tone has distinct guidance and inspiring always requests a specific visible challenge", () => {
    const descriptions = new Set();
    for (const detail of ["concise", "balanced", "detailed"]) {
        for (const tone of ["balanced", "explanatory", "visual", "inspiring"]) {
            const schema = slideContentSchema({ detail, tone });
            descriptions.add(schema.properties.essential.description);
            assert.equal(schema.required.includes("challenge"), tone === "inspiring");
            if (tone === "inspiring") {
                assert.match(schema.properties.essential.description, /pergunta instigante ou uma situação real/);
                assert.match(schema.properties.challenge.description, /Não repita a abertura e não dê a resposta/);
            }
        }
    }
    assert.equal(descriptions.size, 4);
    assert.match(slideContentSchema({ tone: "visual" }).properties.support.description, /comparação ou sequência/);
    assert.match(slideContentSchema({ tone: "explanatory" }).properties.support.description, /exemplo resolvido/);
});

test("preserve mode never forces new examples or challenges into teacher material", () => {
    const schema = slideContentSchema({ detail: "detailed", tone: "inspiring" }, { contentMode: "preserve" });
    assert.deepEqual(schema.required, ["text"]);
    const text = "1. ENGLISH INTERVIEW\nA 15-minute interview entirely in English.\nADVANTAGE +1 NEUTRAL 0 DISADVANTAGE -1";
    assert.equal(normalizeSlideContent({ text }), text);
});

test("new provider contract is option-specific and leaves legacy material schemas unchanged", () => {
    const legacy = schemaFor("slides");
    for (const includeIllustration of [false, true]) {
        const options = normalizeSlideGenerationOptions({ includeIllustration, detail: "detailed", tone: "inspiring" });
        const config = schemaFor("slides", options, { contentMode: "develop" });
        const item = config.schema.properties.slides.items;
        assert.deepEqual(item.properties.body.required, ["essential", "explanation", "example", "challenge"]);
        assert.equal(Object.hasOwn(item.properties, "illustration"), false);
        assert.equal(Object.hasOwn(config.schema.properties, "illustrations"), includeIllustration);
    }
    assert.equal(legacy.schema.properties.slides.items.properties.body.type, "string");
    assert.equal(schemaFor("slides").schema.properties.slides.items.properties.body.type, "string");
});

test("structured content becomes complete editable paragraphs in a fixed order, regardless of JSON key order", () => {
    const body = { example: "Yesterday I went to school. Went é o passado de go, mesmo sem terminar em -ed.",
        challenge: "Como você contaria o que fez ontem?", essential: "Como contar uma experiência passada?",
        explanation: "Verbos irregulares têm formas próprias no passado. Aprendemos cada forma em contexto, pois não basta acrescentar -ed." };
    const expected = [body.essential, body.explanation, body.example, body.challenge].join("\n\n");
    const result = normalizeSlidesMaterial({ slides: [{ type: "content", title: "Passado", body, teacher_notes: "Ouça as respostas." }] });
    assert.equal(result.slides[0].body, expected);
    assert.equal(result.slides[0].teacher_notes, "Ouça as respostas.");
    assert.equal(normalizeSlideContent(expected), expected);
    assert.equal(normalizeSlideContent({ essential: "Capa", explanation: "", example: "" }), "Capa");
});

test("malformed structured text cannot become [object Object] or silently lose unknown fields", () => {
    for (const body of [[], 12, { essential: { text: "conteúdo" } }, { essential: "", example: " " }, { essential: "Texto", unknown: "Outro texto" }]) {
        assert.throws(() => normalizeSlideContent(body), { code: "invalid_slide_content" });
    }
});

test("actual Groq transport keeps the structured body contract and the returned text stays editable", async () => {
    const config = schemaFor("slides", { detail: "detailed", tone: "inspiring", includeIllustration: false }, { contentMode: "auto" });
    const body = { essential: "Por que observamos isso?", explanation: "Explicação completa.", example: "Exemplo explicado.", challenge: "Compare os dois casos." };
    let wire;
    const response = await generateGroqStructuredMaterial({ apiKey: "test-only", schemaConfig: config, prompt: "Pedido sintético",
        fetchImpl: async (_, init) => {
            wire = JSON.parse(init.body);
            return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ slides: [{ type: "content", body }] }) } }] }));
        } });
    assert.deepEqual(wire.response_format.json_schema.schema.properties.slides.items.properties.body.required, Object.keys(body));
    assert.equal(wire.response_format.json_schema.strict, true);
    assert.equal(normalizeSlidesMaterial(JSON.parse(response.text)).slides[0].body, Object.values(body).join("\n\n"));
});
