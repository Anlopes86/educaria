import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
const source = await fs.readFile(new URL("../../assets/js/teacher-dashboard.js", import.meta.url), "utf8");
const attachments = await fs.readFile(new URL("../../assets/js/dashboard-creation.js", import.meta.url), "utf8");
const generator = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
const html = await fs.readFile(new URL("../../plataforma/index.html", import.meta.url), "utf8");
const configSource = source.slice(0, source.indexOf('const DASHBOARD_TOUR_FOCUSABLE_SELECTOR'));
function slice(start, end) { return source.slice(source.indexOf(start), source.indexOf(end)); }
function harness() {
    let request;
    const fields = new Map();
    const form = { querySelector: (selector) => fields.get(selector) || null };
    const context = vm.createContext({
        FormData, window: { educariaAiEndpoint: () => "https://example.test/ai", educariaGenerationRecovery: { currentUid: () => "teacher" }, educariaAiAuthHeaders: async () => ({ Authorization: "Bearer fixture" }) },
        document: { dispatchEvent() {} }, CustomEvent: class {}, dashboardQuickOptionState: new Map(),
        dashboardTranslate: (_, fallback) => fallback,
        fetch: async (url, options) => { request = options; return { ok: true, json: async () => ({ material: { slides: [] } }) }; }
    });
    vm.runInContext(configSource, context);
    vm.runInContext(slice("function collectDashboardQuickOptions(", "function dashboardQuickResultModalTemplate("), context);
    vm.runInContext(slice("async function requestDashboardQuickMaterial(", "function dashboardQuickGenerationError("), context);
    vm.runInContext(attachments, context);
    const configs = vm.runInContext("DASHBOARD_QUICK_OPTION_CONFIGS", context);
    function populate(type) {
        fields.clear();
        for (const field of configs[type]) fields.set(`[data-dashboard-quick-option="${field.key}"]`, { value: String(field.value) });
        for (const [key, value] of Object.entries({ audience: "EJA", className: "Turma A", subject: "Ciências", objective: "Revisar" })) fields.set(`[data-dashboard-context="${key}"]`, { value });
    }
    return { context, fields, form, populate, configs, get request() { return request; } };
}
for (const type of ["slides", "quiz", "flashcards", "memory", "wheel", "match", "mindmap", "debate", "wordsearch", "crossword", "hangman"]) {
    test(`${type}: dashboard options are collected and sent without exceeding the action limit`, async () => {
        const h = harness(); h.populate(type);
        const options = h.context.collectDashboardQuickOptions(h.form, type);
        await h.context.requestDashboardQuickMaterial(type, "Tema", type, options, "teacher");
        const sent = JSON.parse(h.request.body.get("generationOptions"));
        assert.equal(sent.audience, "EJA"); assert.equal(sent.className, "Turma A"); assert.ok(sent.count > 0);
        for (const field of h.configs[type]) assert.notEqual(sent[field.key], undefined, field.key);
        assert.ok(h.request.body.get("action").length <= 500);
        assert.ok(h.configs[type].filter((field) => !field.advanced).length <= 2);
    });
}
test("file-only creation sends the original file, with no cover image sent to AI", async () => {
    const h = harness(); h.populate("slides");
    const options = h.context.collectDashboardQuickOptions(h.form, "slides");
    await h.context.requestDashboardQuickMaterial("slides", "", "Slides", options, "teacher", new Blob(["Conteúdo de revisão"]));
    assert.equal(await h.request.body.get("file").text(), "Conteúdo de revisão");
    assert.equal(h.request.body.get("sourceText"), "");
    assert.equal(JSON.parse(h.request.body.get("slideOptions")).audience, "EJA");
    assert.equal(h.request.body.get("cover_image"), null);
});
test("changed accounts cannot submit content to the provider", async () => {
    const h = harness();
    await assert.rejects(h.context.requestDashboardQuickMaterial("quiz", "Tema", "Quiz", {}, "another"), { status: 401 });
    assert.equal(h.request, undefined);
});
test("content-file validation rejects oversize, unsupported or empty files", () => {
    const h = harness();
    for (const file of [{ name: "secret.exe", size: 1 }, { name: "lesson.pdf", size: 6 * 1024 * 1024 }, { name: "empty.txt", size: 0 }]) assert.throws(() => h.context.validateDashboardSourceFile(file), { status: 400 });
    for (const name of ["lesson.PDF", "lesson.docx", "lesson.txt", "lesson.rtf"]) assert.doesNotThrow(() => h.context.validateDashboardSourceFile({ name, size: 1024 }));
});
test("image preparation is reused and failure happens before generation", async () => {
    const h = harness(); let calls = 0; let file = { name: "cover.png" };
    const form = { querySelector: () => ({ files: file ? [file] : [] }) };
    h.context.window.educariaImages = { optimize: async () => { calls++; return "data:image/webp;base64,fixture"; } };
    assert.equal(await h.context.prepareDashboardSlideImage(form), "data:image/webp;base64,fixture");
    await h.context.prepareDashboardSlideImage(form); assert.equal(calls, 1);
    file = { name: "bad.png" }; h.context.window.educariaImages.optimize = async () => { throw new Error("Invalid image"); };
    await assert.rejects(h.context.prepareDashboardSlideImage(form), { status: 400 });
    file = null; assert.equal(await h.context.prepareDashboardSlideImage(form), "");
});
test("the creator uses progressive disclosure and its left action opens classes", () => {
    assert.match(html, /href="turmas.html"[^>]+data-dashboard-tour-anchor="hero-action"[^>]*>Turmas/);
    assert.doesNotMatch(html, /required[^>]+data-dashboard-quick-topic/);
    assert.match(html, /<details class="dashboard-creation-disclosure dashboard-personalize">/);
    assert.match(html, /data-dashboard-slide-image-panel hidden/);
});
test("editor keeps the selected radial layout instead of hard-coding topics", () => {
    const fields = new Map([["mapa-layout", {}], ["mind-layout-ia", { value: "Radial" }]]);
    const context = vm.createContext({
        document: { getElementById: (id) => fields.get(id) },
        ensureCardCount: () => [{ querySelector: () => null }], setSelectByText: (field, value) => { field.value = value; }, dispatchBuilderContentChange() {}
    });
    vm.runInContext(generator.slice(generator.indexOf("function applyMindmapFromStructuredData("), generator.indexOf("function applyDebateFromStructuredData(")), context);
    context.applyMindmapFromStructuredData({ branches: [{}], layout: "radial" }); assert.equal(fields.get("mapa-layout").value, "Radial");
    context.applyMindmapFromStructuredData({ branches: [{}], layout: "topics" }); assert.equal(fields.get("mapa-layout").value, "Tópicos");
});

test("slides carry a safe cover image only on the first slide, side by side", () => {
    const cards = Array.from({ length: 2 }, () => {
        const fields = new Map();
        return { dataset: {}, fields, querySelector(selector) {
            if (!fields.has(selector)) fields.set(selector, {});
            return fields.get(selector);
        } };
    });
    const context = vm.createContext({
        document: { getElementById: () => null }, ensureCardCount: () => cards,
        normalizeAiSlideTheme: () => ({}), renderAiSlideThemeSummary() {},
        slideVisualFor: () => ({}), compactSlideBodyText: (text) => text,
        setSelectByText: (field, value) => { field.value = value; },
        renumberGeneratedCards() {}, dispatchBuilderContentChange() {}
    });
    vm.runInContext(generator.slice(generator.indexOf("function applySlidesFromStructuredData("), generator.indexOf("function applyFlashcardsFromStructuredData(")), context);
    const url = "data:image/jpeg;base64,ZmFrZQ==";
    context.applySlidesFromStructuredData({ slides: [{}, {}], cover_image: url });
    const field = (index, key) => cards[index].fields.get(`[data-field="${key}"]`).value;
    assert.equal(field(0, "slide-image-url"), url);
    assert.equal(field(1, "slide-image-url"), "");
    assert.equal(field(0, "slide-image-mode"), "Enviar imagem");
    assert.equal(field(0, "slide-layout"), "Lado a lado");
    for (const invalid of ["https://example.test/image.jpg", "data:image/svg+xml;base64,ZmFrZQ==", url + "A".repeat(160 * 1024)]) {
        context.applySlidesFromStructuredData({ slides: [{}, {}], cover_image: invalid });
        assert.equal(field(0, "slide-image-url"), "");
    }
});

test("flashcard answers and annotations survive import without truncation", () => {
    const fields = new Map();
    const examples = {};
    const context = vm.createContext({
        document: { getElementById: (id) => id === "cards-exemplo" ? examples : null },
        ensureCardCount: () => [{ querySelector(selector) { fields.set(selector, {}); return fields.get(selector); } }],
        setSelectByText: (field, value) => { field.value = value; }, renumberGeneratedCards() {}, dispatchBuilderContentChange() {}
    });
    vm.runInContext(generator.slice(generator.indexOf("function applyFlashcardsFromStructuredData("), generator.indexOf("function activityColorPalette(")), context);
    const text = "Explicação completa com um exemplo importante. ".repeat(12).trim();
    context.applyFlashcardsFromStructuredData({ cards: [{ front: text, back: text, example: text }], generation_options: { examples: true } });
    for (const key of ["front", "back", "example"]) assert.equal(fields.get(`[data-field="${key}"]`).value, text);
    assert.equal(examples.value, "Sim");
});

test("teachers can remove a source attachment and return to topic-only creation", () => {
    const h = harness(); const listeners = new Map();
    const sourceField = { files: [{ name: "lesson.txt", size: 100 }], addEventListener: (event, handler) => listeners.set(event, handler), focus() {} };
    Object.defineProperty(sourceField, "value", { set() { this.files = []; } });
    const remove = { hidden: true, addEventListener: (_, handler) => listeners.set("remove", handler) };
    const label = {};
    const nodes = new Map([["[data-dashboard-source-file]", sourceField], ["[data-dashboard-remove-source]", remove], ["[data-dashboard-file-label]", label]]);
    h.context.document.addEventListener = () => {};
    h.context.bindDashboardCreationAttachments({ querySelector: (selector) => nodes.get(selector) });
    listeners.get("change")();
    assert.equal(remove.hidden, false); assert.equal(label.textContent, "lesson.txt");
    listeners.get("remove")();
    assert.equal(sourceField.files.length, 0); assert.equal(remove.hidden, true); assert.equal(label.textContent, "Anexar arquivo do professor");
});
