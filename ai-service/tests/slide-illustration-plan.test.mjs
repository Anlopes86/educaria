import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { schemaFor } from "../materials/schemas.js";
import { normalizeSlidesMaterial } from "../materials/slides.js";
import { normalizeGeneratedSlideIllustration } from "../slide-illustration-policy.js";
import { recoverRejectedSlideResponse } from "../materials/slide-response-recovery.js";
import { diagramExamples } from "../../tools/fixtures/slide-diagrams.mjs";

const browser = vm.createContext({});
for (const file of ["slide-diagram-model", "slide-diagram-renderer", "slide-illustrations"])
    vm.runInContext(await fs.readFile(new URL(`../../assets/js/${file}.js`, import.meta.url), "utf8"), browser);
const images = browser.EducariaSlideIllustrations;
const diagram = () => structuredClone(diagramExamples[0]);
const deck = () => ({
    title: "Sistema solar", visual_theme: { name: "Claro", rationale: "Leitura", font: "Leitura limpa", accent: "#226963",
        secondary_accent: "#73549b", background: "#ffffff", alternate_background: "#eff6ff", text: "#173c43",
        contrast_background: "#153c41", contrast_text: "#ffffff" },
    slides: ["Sistema solar", "Comparação", "Revisão"].map(title => ({ type: "content", title, subtitle: "",
        body: "Conteúdo original do professor.", teacher_notes: "Converse com a turma.", image_prompt: "", layout: "stack", visual_variant: "light" })),
    illustrations: [{ slide_number: 2, diagram: diagram() }]
});
const normalize = (material, includeIllustration = true, visualMode = "standard") => ({
    ...normalizeSlidesMaterial(material, { includeIllustration, visualMode }), generation_options: { includeIllustration }
});

test("Yes requires a nonempty drawing plan, while No excludes both drawing contracts", () => {
    const enabled = schemaFor("slides", { includeIllustration: true }).schema;
    const disabled = schemaFor("slides", { includeIllustration: false }).schema;
    assert.ok(enabled.required.includes("illustrations"));
    assert.equal(enabled.properties.illustrations.minItems, 1);
    assert.equal(enabled.properties.illustrations.maxItems, 30);
    assert.deepEqual(enabled.properties.illustrations.items.properties.diagram.properties.status.enum, ["ready", "needs-image"]);
    assert.equal(enabled.properties.slides.items.properties.illustration, undefined);
    assert.equal(disabled.properties.illustrations, undefined);
    assert.equal(disabled.properties.slides.items.properties.illustration, undefined);
    assert.ok(schemaFor("slides").schema.properties.slides.items.properties.illustration, "legacy schema remains unchanged");
});

test("drawing plans reach the correct slide and render after saving with both visual modes", () => {
    for (const visualMode of ["standard", "ai"]) for (const example of diagramExamples) {
        const source = deck();
        source.illustrations[0].diagram = structuredClone(example);
        const before = structuredClone(source);
        const result = JSON.parse(JSON.stringify(normalize(source, true, visualMode)));
        assert.deepEqual(source, before);
        assert.equal(result.illustrations, undefined, "wire-only drawing plan is not duplicated in saved content");
        assert.equal(result.slides[0].illustration.status, "not-needed");
        assert.equal(result.slides[1].illustration.status, "ready");
        assert.equal(result.slides[1].layout, "split");
        assert.equal(result.slides[2].illustration.status, "not-needed");
        const image = images.resolveImage(result, result.slides[1], 1);
        assert.match(image.url, /^data:image\/svg\+xml/);
        assert.equal(image.mode, "Ilustração da IA");
        assert.match(images.feedback(result), /Ilustração incluída no slide 2/);
        assert.equal(normalize(result).slides[1].illustration.status, "ready", "saved per-slide format still works");
        result.slides.forEach((slide, index) => assert.equal(slide.body, source.slides[index].body));
    }
});

test("No discards drawing plans even when the provider ignores the selection", () => {
    const result = normalize(deck(), false);
    result.slides.forEach((slide, index) => {
        assert.equal(slide.layout, "stack");
        assert.equal(images.resolveImage(result, slide, index).url, "");
    });
    assert.equal(images.feedback(result), "");
});

test("missing, empty, malformed and unrenderable drawings always produce visible feedback", () => {
    for (const drawings of [undefined, null, [], {}, [{ slide_number: 1, diagram: {} }],
        [{ slide_number: 1, diagram: { version: 2, status: "not-needed" } }],
        [{ slide_number: 1, diagram: { version: 2, status: "needs-image" } }]]) {
        const result = normalize({ ...deck(), illustrations: drawings });
        assert.match(images.feedback(result), /não retornou uma ilustração válida/);
        result.slides.forEach(slide => assert.equal(slide.body, "Conteúdo original do professor."));
    }
});

test("bad slide references cannot overwrite a valid drawing or silently attach to another slide", () => {
    const source = deck();
    source.illustrations.push(...[0, -1, 99, "2", 1.5, 2].map(slide_number => ({ slide_number, diagram: {} })));
    const result = normalize(source);
    assert.equal(result.illustration_unassigned, 6);
    assert.equal(result.slides[1].illustration.status, "ready");
    assert.match(images.feedback(result), /incluída no slide 2/);
    assert.match(images.feedback(result), /não pôde ser vinculada/);
});

test("metadata and reference repairs preserve every label, detail and explicit relationship", () => {
    const raw = diagram();
    delete raw.version; delete raw.description; delete raw.title; delete raw.caption;
    const ids = new Map(raw.nodes.map((node, index) => [node.id, `Referência ${index + 1}`]));
    raw.nodes = raw.nodes.map(node => ({ ...node, id: ids.get(node.id), icon: "unavailable-symbol" }));
    raw.links = raw.links.map(link => ({ ...link, from: ids.get(link.from), to: ids.get(link.to) }));
    const before = structuredClone(raw);
    const normalized = normalizeGeneratedSlideIllustration(raw, "Um esquema didático");
    assert.equal(normalized.status, "ready");
    assert.deepEqual(raw, before);
    assert.deepEqual(normalized.nodes.map(node => [node.label, node.detail]), raw.nodes.map(node => [node.label, node.detail]));
    assert.ok(normalized.nodes.every(node => node.icon === "none"));
    assert.equal(normalized.links.length, raw.links.length);
    raw.links.forEach((link, index) => {
        assert.equal(normalized.links[index].from, normalized.nodes[raw.nodes.findIndex(node => node.id === link.from)].id);
        assert.equal(normalized.links[index].to, normalized.nodes[raw.nodes.findIndex(node => node.id === link.to)].id);
        assert.equal(normalized.links[index].kind, link.kind);
    });
    assert.ok(images.render(normalized));
});

test("repairs never invent missing references, merge duplicate identities or guess edges", () => {
    for (const change of [
        raw => { raw.nodes[0].id = raw.nodes[1].id; },
        raw => { raw.nodes[0].id = "Capitalized"; raw.links[0].from = "node1"; },
        raw => { raw.links = []; },
        raw => { raw.nodes[0].label = ""; }
    ]) {
        const raw = diagram(); change(raw);
        assert.equal(normalizeGeneratedSlideIllustration(raw).status, "invalid");
    }
    const raw = { version: 2, status: "ready", title: "Conceitos", description: "Dois conceitos", layout: "cards", nodes: [
        { id: "a", label: "Primeiro" }, { id: "b", label: "Segundo" }
    ] };
    const result = normalizeGeneratedSlideIllustration(raw);
    assert.equal(result.status, "ready");
    assert.ok(result.nodes.every(node => node.detail === "" && node.icon === "none"));
    assert.deepEqual(result.links, []);
});

test("schema-error recovery preserves a drawing plan without relaxing the lesson contract", () => {
    const config = schemaFor("slides", { includeIllustration: true });
    const raw = deck();
    delete raw.illustrations[0].diagram.title;
    const result = recoverRejectedSlideResponse(JSON.stringify(raw), config);
    assert.ok(result);
    assert.equal(normalize(result).slides[1].illustration.status, "ready");
    delete raw.slides[0].teacher_notes;
    assert.equal(recoverRejectedSlideResponse(JSON.stringify(raw), config), null);
});
