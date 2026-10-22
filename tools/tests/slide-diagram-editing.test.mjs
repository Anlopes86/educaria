import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { diagramExamples } from "../fixtures/slide-diagrams.mjs";

const context = vm.createContext({});
for (const name of ["slide-diagram-model", "slide-diagram-renderer", "slide-diagram-editing", "slide-illustrations"]) {
    vm.runInContext(await fs.readFile(new URL(`../../assets/js/${name}.js`, import.meta.url), "utf8"), context);
}
const api = context.EducariaSlideDiagramEditing;
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(index = 0) {
    const original = plain(diagramExamples[index]);
    const image = context.EducariaSlideDiagramRenderer.render(original);
    return { original, url: image.url, data: api.encode(original, image.url) };
}

test("personalized diagrams follow safe accent colours and retain them through text editing", () => {
    const { original } = fixture();
    const renderer = context.EducariaSlideDiagramRenderer;
    const colors = ["#c05621", "#1d4ed8", "#7e22ce"];
    const results = colors.map(accent => {
        const theme = { accent, secondary_accent: "#d97706" };
        const image = context.EducariaSlideIllustrations.resolveImage({ visual_mode: "ai", visual_theme: theme, generation_options: { includeIllustration: true } }, { illustration: original }, 0);
        assert.equal(image.url, renderer.render(original, theme).url);
        const revised = api.revise(image.diagramData, image.url, { ...original, title: "Título revisado" });
        assert.equal(revised.url, renderer.render({ ...original, title: "Título revisado" }, theme).url);
        assert.deepEqual(plain(api.decode(image.diagramData, image.url)), original);
        return image.url;
    });
    assert.equal(new Set(results).size, 3);
    const unsafe = renderer.render(original, { accent: 'url(x)" onload="bad' });
    assert.equal(unsafe.url, renderer.render(original).url);
    const standard = context.EducariaSlideIllustrations.resolveImage({ visual_mode: "standard", visual_theme: { accent: colors[0] }, generation_options: { includeIllustration: true } }, { illustration: original }, 0);
    assert.equal(standard.url, renderer.render(original).url);
});

test("manual theme recolouring preserves diagram meaning and leaves uploaded/replaced images alone", () => {
    const { original, url, data } = fixture();
    const result = api.recolor(data, url, { accent: "#db2777" });
    assert.notEqual(result.url, url);
    assert.deepEqual(plain(api.decode(result.data, result.url)), original);
    assert.equal(api.recolor(data, "data:image/png;base64,AAAA", { accent: "#db2777" }), null);
    assert.equal(api.recolor("", url, { accent: "#db2777" }), null);
});

for (let i = 0; i < diagramExamples.length; i++) test(`editable illustration survives JSON and changes only text: ${diagramExamples[i].layout} ${i}`, () => {
    const { original, url, data } = fixture(i);
    assert.deepEqual(plain(api.decode(JSON.parse(JSON.stringify(data)), url)), original);
    const changes = plain(original);
    changes.title = "Título corrigido";
    changes.caption = "Legenda revisada";
    changes.description = "Descrição corrigida pelo professor";
    changes.nodes[0].label = "Revisado";
    if (["process", "cards", "comparison"].includes(original.layout)) changes.nodes[0].detail = "Explicação revisada";
    const result = api.revise(data, url, changes);
    assert.ok(result.url, result.error);
    const saved = plain(api.decode(result.data, result.url));
    assert.deepEqual(saved, changes);
    assert.deepEqual(saved.links, original.links);
    assert.equal(saved.layout, original.layout);
    assert.deepEqual(saved.nodes.map(n => [n.id, n.icon]), original.nodes.map(n => [n.id, n.icon]));
    assert.deepEqual(plain(api.decode(data, url)), original, "opening/editing a temporary copy cannot mutate the old image");
});

test("invalid, legacy, replaced and oversized image data fails closed without SVG parsing", () => {
    const { data, url } = fixture();
    for (const invalid of [null, "", "{broken", "x".repeat(12001), JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, image: "", diagram: diagramExamples[0] })]) assert.equal(api.decode(invalid, url), null);
    for (const replaced of [url + "x", "data:image/png;base64,AAAA", "https://example.test/test.svg", "javascript:alert(1)", "data:image/svg+xml;charset=utf-8," + "a".repeat(160000)]) assert.equal(api.decode(data, replaced), null);
    assert.equal(api.encode({ description: "Legacy", elements: [] }, url), "");
});

test("edits reject missing, reordered, extra nodes and invalid or overflowing texts", () => {
    const { original, data, url } = fixture();
    for (const change of [
        { ...original, nodes: [] }, { ...original, nodes: [...original.nodes].reverse() },
        { ...original, title: "" }, { ...original, title: "x".repeat(53) }, { ...original, description: "" },
        { ...original, nodes: original.nodes.map(n => ({ ...n, label: "" })) },
        { ...original, nodes: original.nodes.map(n => ({ ...n, detail: "x".repeat(49) })) }
    ]) assert.ok(api.revise(data, url, change).error);
    const cycle = fixture(5);
    const tooWide = { ...cycle.original, nodes: cycle.original.nodes.map(n => ({ ...n, label: "W".repeat(32) })) };
    assert.match(api.revise(cycle.data, cycle.url, tooWide).error, /não cabe/);
    assert.deepEqual(plain(api.decode(data, url)), original);
});

test("text editing cannot alter topology or inject markup into the generated image", () => {
    const { original, data, url } = fixture(6);
    const changes = plain(original);
    changes.title = "A < B & C";
    changes.description = '</title><script>alert(1)</script>';
    changes.nodes[0].label = "<script>";
    changes.nodes[0].icon = "unknown";
    changes.layout = "cycle"; changes.links = [{ from: "x", to: "y", kind: "arrow" }];
    const result = api.revise(data, url, changes);
    assert.ok(result.url, result.error);
    const svg = decodeURIComponent(result.url.split(",").slice(1).join(","));
    assert.doesNotMatch(svg, /<script|<foreignObject|onload=|href=/);
    assert.match(svg, /&lt;script&gt;/);
    const saved = plain(api.decode(result.data, result.url));
    assert.equal(saved.layout, original.layout);
    assert.deepEqual(saved.links, original.links);
    assert.equal(saved.nodes[0].icon, original.nodes[0].icon);
});

test("generated v2 illustrations carry editable data but disabled and uploaded images do not", () => {
    const slide = { illustration: diagramExamples[0] };
    const material = { generation_options: { includeIllustration: true } };
    const image = context.EducariaSlideIllustrations.resolveImage(material, slide, 0);
    assert.deepEqual(plain(api.decode(image.diagramData, image.url)), slide.illustration);
    assert.equal(context.EducariaSlideIllustrations.resolveImage({ generation_options: { includeIllustration: false } }, slide, 0).diagramData, undefined);
    assert.equal(context.EducariaSlideIllustrations.resolveImage({ ...material, cover_image: "data:image/png;base64,AAAA" }, slide, 0).diagramData, undefined);
});

test("card writes preserve material text and materialize metadata for normal draft storage", () => {
    const { original, url, data } = fixture();
    const fields = new Map();
    const card = {
        ownerDocument: { createElement: tag => ({ tagName: tag.toUpperCase(), dataset: {}, setAttribute(name, value) { this[name] = value; } }) },
        querySelector: selector => fields.get(selector.match(/data-field="([^"]+)"/)?.[1]) || null,
        appendChild: field => fields.set(field.dataset.field, field)
    };
    api.writeField(card, "slide-title", "Título do slide intocado");
    const result = api.revise(data, url, { ...original, title: "Diagrama corrigido" });
    assert.equal(api.writeCard(card, result), true);
    assert.equal(fields.get("slide-title").value, "Título do slide intocado");
    assert.equal(fields.get("slide-illustration").textContent, result.data);
    assert.equal(fields.get("slide-image-url").textContent, result.url);
    assert.equal(api.decode(api.readCard(card).data, api.readCard(card).url).title, "Diagrama corrigido");
    assert.equal(api.writeCard(card, { url: "bad", data }), false);
    api.writeField(card, "slide-image-url", "data:image/png;base64,AAAA");
    assert.equal(api.decode(api.readCard(card).data, api.readCard(card).url), null);
});

test("all generation entry points load editing data, and both editors share the same dialog", async () => {
    for (const page of ["index", "slides-builder", "criar-aula"]) {
        const html = await fs.readFile(new URL(`../../plataforma/${page}.html`, import.meta.url), "utf8");
        assert.ok(html.indexOf("slide-diagram-model.js") < html.indexOf("slide-diagram-editing.js"));
        assert.ok(html.indexOf("slide-diagram-editing.js") < html.indexOf("slide-illustrations.js"));
        if (page !== "index") { assert.match(html, /slide-diagram-editor\.js/); assert.match(html, /slide-diagram-editor\.css/); }
    }
    const editor = await fs.readFile(new URL("../../assets/js/slide-diagram-editor.js", import.meta.url), "utf8");
    assert.doesNotMatch(editor, /fetch\(|XMLHttpRequest|\/api\/ai|localStorage/);
    assert.match(editor, /event\.stopPropagation\(\); updatePreview/);
    assert.match(editor, /dialog\.showModal\(\)/);
    assert.match(editor, /trigger\.focus\(\)/);
    assert.match(editor, /educaria-auth-changed/);
});
