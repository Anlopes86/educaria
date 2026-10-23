import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import discoveryInput from "../../assets/js/discovery-input.js";
const source = await fs.readFile(new URL("../../assets/js/teacher-dashboard.js", import.meta.url), "utf8");
const attachments = await fs.readFile(new URL("../../assets/js/dashboard-creation.js", import.meta.url), "utf8");
const generator = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
const html = await fs.readFile(new URL("../../plataforma/index.html", import.meta.url), "utf8");
const configSource = source.slice(0, source.indexOf('const DASHBOARD_TOUR_FOCUSABLE_SELECTOR'));
function slice(start, end) { return source.slice(source.indexOf(start), source.indexOf(end)); }

test("print creation is a single illustrated shortcut in the welcome panel, before the toolkit", async () => {
    const hero = html.slice(html.indexOf('<section class="dashboard-hero-panel">'), html.indexOf('<section class="dashboard-section" id="activity-toolkit">'));
    const entry = hero.match(/<a href="folha-atividades-builder.html\?new=1" class="dashboard-worksheet-entry"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    assert.ok(entry, "The print shortcut must be in the welcome panel, not below the activities");
    assert.match(entry, /<svg[^>]+aria-hidden="true"/);
    assert.match(entry, /id="worksheet-entry-title"/);
    assert.match(entry, /id="worksheet-entry-copy"/);
    assert.match(entry, /Criar folha com IA/);
    assert.equal((html.match(/class="dashboard-worksheet-entry"/g) || []).length, 1);
    assert.doesNotMatch(html.slice(html.indexOf('id="activity-toolkit"')), /folha-atividades-builder/);
    for (const locale of ["pt-BR", "en-US", "es-ES"]) {
        const translations = JSON.parse(await fs.readFile(new URL(`../../assets/i18n/${locale}.json`, import.meta.url), "utf8"));
        for (const [, key] of entry.matchAll(/data-i18n="([^"]+)"/g)) assert.ok(translations[key], `${locale}: ${key}`);
    }
    const context = vm.createContext({});
    vm.runInContext(configSource, context);
    assert.equal(vm.runInContext('DASHBOARD_QUICK_CREATE_FORMATS.some(item => item.href.startsWith("folha-atividades"))', context), false,
        "Worksheet links must open their dedicated builder, not trigger the projection creator");
});

for (const hasExtraFormats of [true, false]) {
    test(`dashboard refresh preserves other sections and renders extra formats once (existing=${hasExtraFormats})`, () => {
        // Guard the former duplicate bug: another feature may use the same visual class.
        const featureMarkup = "Separate feature";
        const feature = { className: "dashboard-toolkit-secondary", innerHTML: featureMarkup };
        const extra = { id: "extra-formats", className: "dashboard-toolkit-secondary", innerHTML: "Original formats" };
        const blocks = hasExtraFormats ? [feature, extra] : [feature];
        const grid = { querySelectorAll: () => [], querySelector: () => null,
            insertAdjacentElement: (_, element) => blocks.push(element) };
        const toolkit = { querySelector(selector) {
            if (selector === ".dashboard-toolkit-grid") return grid;
            if (selector === ".dashboard-toolkit-secondary") return blocks[0];
            if (selector === "#extra-formats") return blocks.find(block => block.id === "extra-formats") || null;
            return null;
        } };
        let exampleRefreshes = 0;
        const context = vm.createContext({
            window: { EducariaExamples: { enhance() { exampleRefreshes++; } } },
            document: { querySelector: () => null, getElementById: () => toolkit, createElement: () => ({}) },
            dashboardTranslate: (_, fallback) => fallback
        });
        vm.runInContext(configSource, context);
        vm.runInContext(slice("function syncDashboardFormatHierarchy(", "function hydrateQuickCreateForm("), context);
        for (let refresh = 0; refresh < 3; refresh++) context.syncDashboardFormatHierarchy();
        assert.equal(exampleRefreshes, 3, "Rebuilt cards must get their example buttons back");
        assert.equal(feature.innerHTML, featureMarkup, "Refreshing formats must never replace another feature");
        assert.equal(blocks.length, 2);
        const rendered = blocks.find(block => block.id === "extra-formats");
        assert.equal((rendered.innerHTML.match(/Mais possibilidades/g) || []).length, 1);
        assert.equal((rendered.innerHTML.match(/class="dashboard-toolkit-link /g) || []).length, 11);
        assert.ok(rendered.innerHTML.includes('trilha-palavras-builder.html?new=1'));
        assert.ok(rendered.innerHTML.includes('em-comum-builder.html?new=1'));
    });
}

function harness() {
    let request;
    const fields = new Map();
    const form = { querySelector: (selector) => fields.get(selector) || null };
    const context = vm.createContext({
        FormData, window: { EducariaDiscoveryInput: discoveryInput, educariaAiEndpoint: () => "https://example.test/ai", educariaGenerationRecovery: { currentUid: () => "teacher" }, educariaAiAuthHeaders: async () => ({ Authorization: "Bearer fixture" }) },
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
        assert.equal(sent.audience, "EJA"); assert.equal(sent.className, "Turma A");
        if (["slides", "flashcards"].includes(type)) assert.equal(sent.count, null);
        else assert.ok(sent.count > 0);
        for (const field of h.configs[type]) assert.notEqual(sent[field.key], undefined, field.key);
        assert.ok(h.request.body.get("action").length <= 500);
        assert.ok(h.configs[type].filter((field) => !field.advanced).length <= 2);
    });
}
test("connections recognize teacher answers in the primary field and suppress generic counts", async () => {
    const h = harness(); h.populate("connections");
    const source = "Homer simpson, Neymar e star wars";
    h.fields.set('[data-dashboard-quick-topic]', { value: source });
    assert.equal(h.configs.connections[0].value, "auto");
    const options = h.context.collectDashboardQuickOptions(h.form, "connections");
    assert.equal(options.values.count, null);
    await h.context.requestDashboardQuickMaterial("connections", source, "O que há em comum?", options, "teacher");
    const sent = JSON.parse(h.request.body.get("generationOptions"));
    assert.equal(sent.inputMode, "auto");
    assert.equal(sent.clueCount, 5);
    assert.equal(sent.difficulty, "medium");
    assert.equal(h.request.body.get("sourceText"), source);
    assert.doesNotMatch(h.request.body.get("action"), /Gerar \d+ desafios/);
});

test("word trail recognizes an exact list while keeping topic-driven generation and clue choices", async () => {
    const h = harness(); h.populate("wordtrail");
    h.fields.set('[data-dashboard-quick-topic]', { value: "took, came, began, drove e went" });
    h.fields.set('[data-dashboard-quick-option="includeClues"]', { value: "false" });
    assert.equal(h.configs.wordtrail[0].value, "auto");
    const options = h.context.collectDashboardQuickOptions(h.form, "wordtrail");
    assert.equal(options.values.count, null);
    await h.context.requestDashboardQuickMaterial("wordtrail", "took, came, began, drove e went", "Trilha de Palavras", options, "teacher");
    const sent = JSON.parse(h.request.body.get("generationOptions"));
    assert.equal(sent.inputMode, "auto");
    assert.equal(sent.includeClues, "false");
    assert.doesNotMatch(h.request.body.get("action"), /Gerar \d+ palavras/);
    h.populate("wordtrail");
    h.fields.set('[data-dashboard-quick-topic]', { value: "palavras em inglês no passado" });
    assert.equal(h.context.collectDashboardQuickOptions(h.form, "wordtrail").values.count, 6);
});

test("file-only creation sends the original file, with no cover image sent to AI", async () => {
    const h = harness(); h.populate("slides");
    const options = h.context.collectDashboardQuickOptions(h.form, "slides");
    await h.context.requestDashboardQuickMaterial("slides", "", "Slides", options, "teacher", new Blob(["Conteúdo de revisão"]));
    assert.equal(await h.request.body.get("file").text(), "Conteúdo de revisão");
    assert.equal(h.request.body.get("sourceText"), "");
    assert.equal(JSON.parse(h.request.body.get("slideOptions")).audience, "EJA");
    assert.equal(h.request.body.get("cover_image"), null);
});

test("dashboard sends the illustration choice beside the unmodified teacher request", async () => {
    const h = harness(); h.populate("slides");
    h.fields.set('[data-dashboard-quick-option="includeIllustration"]', { value: "true" });
    const options = h.context.collectDashboardQuickOptions(h.form, "slides");
    const request = "Explique as fases da Lua com um esquema ilustrativo.";
    await h.context.requestDashboardQuickMaterial("slides", request, "Slides", options, "teacher");
    assert.equal(JSON.parse(h.request.body.get("slideOptions")).includeIllustration, "true");
    assert.equal(h.request.body.get("sourceText"), request);
});

test("dashboard sends both visual modes explicitly instead of relying only on action text", async () => {
    for (const visualMode of ["standard", "ai"]) {
        const h = harness(); h.populate("slides");
        h.fields.set('[data-dashboard-quick-option="visualMode"]', { value: visualMode });
        await h.context.requestDashboardQuickMaterial("slides", "Tema", "Slides", h.context.collectDashboardQuickOptions(h.form, "slides"), "teacher");
        assert.equal(JSON.parse(h.request.body.get("slideOptions")).visualMode, visualMode);
    }
});

test("dashboard sends every detail/tone combination without replacing selections with defaults", async () => {
    for (const detail of ["concise", "balanced", "detailed"]) for (const tone of ["balanced", "visual", "explanatory", "inspiring"]) {
        const h = harness(); h.populate("slides");
        for (const [key, value] of Object.entries({ detail, tone })) h.fields.set(`[data-dashboard-quick-option="${key}"]`, { value });
        const options = h.context.collectDashboardQuickOptions(h.form, "slides");
        await h.context.requestDashboardQuickMaterial("slides", "Verbos no passado", "Slides", options, "teacher");
        const sent = JSON.parse(h.request.body.get("slideOptions"));
        assert.equal(sent.detail, detail);
        assert.equal(sent.tone, tone);
    }
});

test("automatic quantity follows the request in the single main field", async () => {
    const h = harness(); h.populate("flashcards");
    h.fields.set('[data-dashboard-quick-option="contentMode"]', { value: "preserve" });
    const options = h.context.collectDashboardQuickOptions(h.form, "flashcards");
    const request = "Número na frente, explicação no verso. Não traduza.\n\n1. ENGLISH INTERVIEW";
    await h.context.requestDashboardQuickMaterial("flashcards", request, "Flashcards", options, "teacher");
    const sent = JSON.parse(h.request.body.get("generationOptions"));
    assert.equal(sent.count, null);
    assert.equal(sent.contentMode, "preserve");
    assert.equal(sent.teacherInstructions, undefined);
    assert.equal(h.request.body.get("sourceText"), request);
    assert.doesNotMatch(html, /data-dashboard-context="teacherInstructions"/);
    assert.doesNotMatch(h.request.body.get("action"), /Gerar \d+ cards/);
});

test("an explicit quantity remains supported and long instructions do not overflow slideOptions", async () => {
    const h = harness(); h.populate("slides");
    h.fields.set('[data-dashboard-quick-option="count"]', { value: "10" });
    const options = h.context.collectDashboardQuickOptions(h.form, "slides");
    const request = "Aprofunde este tema. " + '"'.repeat(1500);
    await h.context.requestDashboardQuickMaterial("slides", request, "Slides", options, "teacher");
    assert.equal(JSON.parse(h.request.body.get("generationOptions")).count, 10);
    assert.equal(h.request.body.get("sourceText"), request);
    assert.equal(JSON.parse(h.request.body.get("generationOptions")).teacherInstructions, undefined);
    assert.equal(JSON.parse(h.request.body.get("slideOptions")).teacherInstructions, undefined);
    assert.match(h.request.body.get("action"), /Gerar 10 slides/);
    assert.ok(h.request.body.get("slideOptions").length < 3000);
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
        window: {}, document: { getElementById: () => null }, ensureCardCount: () => cards,
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
