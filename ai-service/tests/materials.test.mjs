import assert from "node:assert/strict";
import { test } from "node:test";
import { MATERIAL_TYPES, schemaFor } from "../materials/schemas.js";
import { promptFor, imagePromptForSlide } from "../materials/prompts.js";
import { normalizeSlidesMaterial } from "../materials/slides.js";
import { parseGeneratedJson } from "../materials/generated-json.js";
import { extractTextFromFile, isUploadValidationError, parseWheelTemplateText } from "../materials/upload.js";

const collections = {
    quiz: "questions", slides: "slides", flashcards: "cards", memory: "pairs",
    hangman: "entries", match: "pairs", wheel: "segments", wordsearch: "words",
    mindmap: "branches", debate: "steps", crossword: "entries"
};

test("every registered activity has explicit contract coverage", () => {
    assert.deepEqual([...MATERIAL_TYPES].sort(), Object.keys(collections).sort());
    assert.equal(Object.isFrozen(MATERIAL_TYPES), true);
});

test("schema lookup does not expose a shared provider config", () => {
    const first = schemaFor("quiz");
    first.name = "changed by a caller";
    assert.equal(schemaFor("quiz").name, "educaria_quiz");
});

for (const [type, collection] of Object.entries(collections)) {
    test(`${type}: exported contract retains schema and teacher content`, () => {
        const config = schemaFor(type);
        assert.equal(config.name, `educaria_${type}`);
        assert.equal(config.schema.type, "object");
        assert.equal(config.schema.additionalProperties, false);
        assert.ok(config.schema.required.includes(collection));
        assert.equal(config.schema.properties[collection].type, "array");
        const prompt = promptFor(type, "Pedido específico do professor", "Conteúdo original — não omitir");
        assert.ok(prompt.includes("Pedido específico do professor"));
        assert.ok(prompt.includes("Conteúdo original — não omitir"));
        assert.ok(prompt.includes("JSON"));
    });
}

test("unsupported material types have no schema", () => {
    for (const type of [undefined, null, "", "unknown", "toString", "__proto__"]) assert.equal(schemaFor(type), null);
});

for (const text of ['{"title":"Revisão"}', '\uFEFF{"title":"Revisão"}', '```json\n{"title":"Revisão"}\n```', 'Resultado: {"title":"Revisão"} fim', '{“title”:“Revisão”,}']) {
    test(`generated JSON retains supported recovery: ${text.slice(0, 30)}`, () => {
        assert.deepEqual(parseGeneratedJson(text), { title: "Revisão" });
    });
}
test("generated JSON rejects absent and unrecoverable responses", () => {
    assert.throws(() => parseGeneratedJson(""), /empty_model_response/);
    assert.throws(() => parseGeneratedJson("não é JSON"), /invalid_json_response/);
    assert.deepEqual(parseGeneratedJson('{"questions":["A","B",],}'), { questions: ["A", "B"] });
});

test("slide normalization preserves content and input without mutating saved materials", () => {
    const material = { title: "Aula", slides: [{ title: "Início", body: "Explicação completa.\n\nOutro parágrafo.", teacher_notes: "  Nota do professor  " }, { title: "Revisão", body: "- Um\n• Dois" }] };
    const original = structuredClone(material);
    const result = normalizeSlidesMaterial(material);
    assert.deepEqual(material, original);
    assert.equal(result.slides[0].body, material.slides[0].body);
    assert.equal(result.slides[0].teacher_notes, "Nota do professor");
    assert.equal(result.slides[1].body, "- Um\n- Dois");
    assert.deepEqual(result.slides.map(slide => [slide.type, slide.visual_variant, slide.layout]), [["cover", "hero", "stack"], ["closing", "contrast", "stack"]]);
    assert.equal(normalizeSlidesMaterial(null), null);
});
test("slide theme rejects invalid visual tokens and repairs low-contrast text", () => {
    const result = normalizeSlidesMaterial({ visual_theme: { font: "unknown", accent: "url(secret)", background: "#FFFFFF", text: "#FFFFFF", alternate_background: "#000000" }, slides: [] });
    assert.equal(result.visual_theme.background, "#ffffff");
    assert.equal(result.visual_theme.text, "#0f172a");
    assert.equal(result.visual_theme.alternate_background, "#f2f2f2");
    assert.equal(result.visual_theme.font, "Destaque moderno");
    assert.equal(result.visual_theme.accent, "#0ea5e9");
});
test("image prompt retains teacher instructions and educational constraints", () => {
    const prompt = imagePromptForSlide({ title: "Sistema solar", subtitle: "Órbitas", body: "Gravidade", prompt: "Sem texto" });
    for (const value of ["Sistema solar", "Órbitas", "Gravidade", "Sem texto", "apropriada para contexto escolar"]) assert.ok(prompt.includes(value));
});

test("file extraction preserves TXT accents and supports existing RTF templates", async () => {
    assert.equal(await extractTextFromFile(), "");
    assert.equal(await extractTextFromFile({ originalname: "aula.TXT", mimetype: "text/plain", buffer: Buffer.from("Revisão — inglês\n1. ENGLISH INTERVIEW") }), "Revisão — inglês\n1. ENGLISH INTERVIEW");
    const text = await extractTextFromFile({ originalname: "modelo.rtf", buffer: Buffer.from("{\\rtf1 Espaco 1: Sol\\par Espaco 2: Lua}") });
    assert.deepEqual(parseWheelTemplateText(text).segments.map(item => item.text), ["Sol", "Lua"]);
});
for (const extension of ["rtf", "pdf", "docx", "exe"]) {
    test(`file extraction rejects invalid ${extension} before calling a parser`, async () => {
        await assert.rejects(extractTextFromFile({ originalname: `aula.${extension}`, buffer: Buffer.from("invalid content") }), error => isUploadValidationError(error));
    });
}
test("upload errors are classified without swallowing unrelated failures", () => {
    assert.equal(isUploadValidationError({ code: "UNSUPPORTED_UPLOAD_TYPE" }), true);
    assert.equal(isUploadValidationError({ code: "INVALID_UPLOAD_SIGNATURE" }), true);
    assert.equal(isUploadValidationError(new Error("unrelated")), false);
});
test("wheel template retains minimum, limit, placeholder filtering and cyclic colors", () => {
    assert.throws(() => parseWheelTemplateText("Espaco 1: Sol"), /dois espaços/);
    assert.throws(() => parseWheelTemplateText(""), /dois campos/);
    const lines = ["Espaco 1: Revisao rapida", ...Array.from({ length: 28 }, (_, i) => `Espaco ${i + 2}: Item ${i}`)];
    const material = parseWheelTemplateText(lines.join("\n"));
    assert.equal(material.segments.length, 24);
    assert.equal(material.segments[0].text, "Item 0");
    assert.equal(material.segments[0].color, material.segments[12].color);
    assert.equal(material.eliminate_used, false);
});
