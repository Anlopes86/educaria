import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { normalizeSlideIllustration, slideIllustrationSchema, slideIllustrationInstructions } from "../../ai-service/slide-illustration-policy.js";
import { normalizeSlideGenerationOptions } from "../../ai-service/slide-generation-policy.js";
import { promptFor } from "../../ai-service/materials/prompts.js";
import { normalizeSlidesMaterial } from "../../ai-service/materials/slides.js";
import { groqStrictJsonSchema } from "../../ai-service/ai-text-provider.js";

const renderer = await fs.readFile(new URL("../../assets/js/slide-illustrations.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(renderer, context);
const { render, resolveImage, feedback } = context.EducariaSlideIllustrations;
const drawing = { description: "Órbitas do sistema solar — esquema fora de escala", elements: [
    { kind: "ring", geometry: [300, 300, 180], color: "#7ab4a4", text: "" },
    { kind: "circle", geometry: [300, 300, 60], color: "#eab255", text: "" },
    { kind: "label", geometry: [300, 390, 24], color: "#173c43", text: "Sol" }
] };
const svgText = (image) => decodeURIComponent(image.url.slice(image.url.indexOf(",") + 1));

test("illustration selection defaults to No and supports both forms", () => {
    assert.equal(normalizeSlideGenerationOptions().includeIllustration, false);
    for (const value of [true, "true"]) assert.equal(normalizeSlideGenerationOptions({ includeIllustration: value }).includeIllustration, true);
    for (const value of [false, "false"]) assert.equal(normalizeSlideGenerationOptions({ includeIllustration: value }).includeIllustration, false);
    for (const value of [1, {}, [], "yes", "false OR true"]) assert.throws(() => normalizeSlideGenerationOptions({ includeIllustration: value }), { code: "invalid_slide_options" });
});

test("schema stays compatible with the existing strict structured provider", () => {
    const strict = groqStrictJsonSchema(slideIllustrationSchema);
    assert.equal(strict.additionalProperties, false);
    assert.equal(strict.properties.elements.maxItems, 32);
    assert.deepEqual(strict.properties.elements.items.required, ["kind", "geometry", "color", "text"]);
    assert.ok(!JSON.stringify(strict).includes("svg"));
});

test("server and browser suppress illustrations when disabled, including a model ignoring No", () => {
    assert.deepEqual(normalizeSlideIllustration(drawing, false), { description: "", elements: [] });
    assert.equal(resolveImage({ generation_options: { includeIllustration: false } }, { illustration: drawing }, 0).url, "");
    assert.equal(resolveImage({}, { illustration: drawing }, 0).url, "");
});

test("safe drawing renders locally with accessible description and bounded data size", () => {
    const image = render(normalizeSlideIllustration(drawing, true));
    assert.match(image.url, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.equal(image.description, drawing.description);
    assert.match(svgText(image), /<circle cx="300" cy="300" r="60"/);
    assert.match(svgText(image), /viewBox="0 0 600 600"/);
    assert.ok(image.url.length < 20_000);
    assert.doesNotMatch(svgText(image), /<script|<foreignObject|<image|href=|onload=/);
});

test("uploaded image wins on the opening only; other illustrated slides stay intact", () => {
    const material = { cover_image: "data:image/png;base64,aW1hZ2U=", generation_options: { includeIllustration: true } };
    assert.equal(resolveImage(material, { illustration: drawing }, 0).url, material.cover_image);
    assert.equal(resolveImage(material, { illustration: drawing }, 0).mode, "Enviar imagem");
    assert.equal(resolveImage(material, { illustration: drawing }, 1).mode, "Ilustração da IA");
    material.cover_image = "https://untrusted.test/image.svg";
    assert.match(resolveImage(material, { illustration: drawing }, 0).url, /^data:/);
});

test("missing illustration has honest feedback instead of a pretend image", () => {
    assert.equal(feedback({ slides: [{}] }), "");
    assert.match(feedback({ generation_options: { includeIllustration: true }, slides: [{}] }), /não retornou uma ilustração válida/);
    assert.equal(feedback({ generation_options: { includeIllustration: true }, slides: [{ illustration: drawing }] }), "");
});

test("labels and descriptions cannot inject markup; raw SVG is never accepted", () => {
    const hostile = { description: '</title><script>alert(1)</script>', elements: [drawing.elements[1],
        { kind: "label", geometry: [300, 400, 20], color: "#ffffff", text: '<img src=x onerror="bad">' },
        { kind: "svg", geometry: [1, 1, 1], color: "#ffffff", text: '<script>bad()</script>' },
        { kind: "circle", geometry: [1, 1, 1], color: 'red" onload="bad()', text: '' }
    ], svg: '<script>bad()</script>' };
    const normalized = normalizeSlideIllustration(hostile, true);
    assert.equal(normalized.elements.length, 2);
    const image = render(hostile);
    assert.match(svgText(image), /&lt;script&gt;/);
    assert.doesNotMatch(svgText(image), /<script|<img|<image|<foreignObject/);
    assert.equal(render({ svg: hostile.svg }), null);
    assert.ok(render({ ...drawing, description: "Texto com Unicode incompleto: \uD800" }));
});

test("invalid geometry, excessive sizes and empty drawings never become broken images", () => {
    for (const element of [
        { kind: "circle", geometry: [NaN, 50, 3] }, { kind: "circle", geometry: [20, 30, Infinity] },
        { kind: "circle", geometry: [-10, 30, 2] }, { kind: "circle", geometry: [40, 30, 281] },
        { kind: "box", geometry: [1, 2, 4, 0, 1] }, { kind: "ellipse", geometry: [3, 4, 5, 6, 800] },
        { kind: "__proto__", geometry: [1, 2, 3] }, { kind: "label", geometry: [1, 2, 1] }
    ]) {
        const raw = { description: "Teste", elements: [{ color: "#112233", text: "Legenda", ...element }] };
        assert.equal(normalizeSlideIllustration(raw, true).elements.length, 0);
        assert.equal(render(raw), null);
    }
    assert.equal(render({ description: "", elements: drawing.elements }), null);
    assert.equal(render({ description: "Vazio", elements: [] }), null);
});

test("drawings are capped and all supported primitives survive persistence round trips", () => {
    const raw = { description: "A".repeat(400), elements: [
        ...drawing.elements,
        { kind: "ellipse", geometry: [120, 120, 50, 12, 25], color: "#112233", text: "" },
        { kind: "box", geometry: [20, 30, 100, 80, 10], color: "#112233", text: "" },
        { kind: "line", geometry: [10, 20, 30, 40], color: "#112233", text: "" },
        { kind: "arrow", geometry: [40, 50, 60, 70], color: "#112233", text: "" },
        ...Array.from({ length: 100 }, () => drawing.elements[1])
    ] };
    const normalized = normalizeSlideIllustration(raw, true);
    assert.equal(normalized.description.length, 300);
    assert.equal(normalized.elements.length, 32);
    const svg = svgText(render(JSON.parse(JSON.stringify(normalized))));
    for (const tag of ["circle", "ellipse", "rect", "line", "polygon", "text"]) assert.ok(svg.includes(`<${tag}`), tag);
});

test("actual server prompt ties drawings to the complete teacher request and normalization honors No", async () => {
    const request = "Mostre como a gravidade mantém os planetas em órbita. Use um esquema, não uma foto.";
    const prompt = promptFor("slides", "Gerar 3 slides.", request, { includeIllustration: true });
    assert.ok(prompt.includes(request));
    assert.match(prompt, /INCLUIR ILUSTRAÇÃO: SIM/);
    assert.match(prompt, /vinculados ao pedido do professor/);
    assert.doesNotMatch(prompt, /Não prometa nem gere imagens/);
    const material = { slides: [{ body: "Texto preservado", illustration: drawing }] };
    assert.equal(normalizeSlidesMaterial(material, { includeIllustration: true }).slides[0].layout, "split");
    const disabled = normalizeSlidesMaterial(material, { includeIllustration: false }).slides[0];
    assert.equal(disabled.illustration.elements.length, 0);
    assert.equal(disabled.layout, "stack");
    assert.equal(disabled.body, "Texto preservado");
});
