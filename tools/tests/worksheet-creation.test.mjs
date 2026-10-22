import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { isPublicFile } from "../build-pages.mjs";
import core from "../../assets/js/worksheet-core.js";
import { worksheetFixture } from "../fixtures/worksheet.mjs";

const source = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
function harness({ types = core.types, failed = false, overrides = {} } = {}) {
    let applied, renders = 0;
    const posts = [], alerts = [], events = [];
    const fields = {
        "worksheet-source": { value: "Verbos em inglês no passado para o 7º ano" },
        "worksheet-file": { files: [] }, "worksheet-audience": { value: "7º ano" },
        "worksheet-input-mode": { value: "auto" }
    };
    const context = vm.createContext({
        Error, FormData, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, console: { warn() {} },
        window: { educariaAiAuthHeaders: async () => ({ Authorization: "Bearer synthetic-test" }), alert: message => alerts.push(message),
            EducariaWorksheetBuilder: { generationOptions: () => ({ worksheetTypes: core.selection(types), pageMode: "compact", difficulty: "hard", ...overrides }),
                apply: material => { applied = material; return true; }, render: () => { renders++; } } },
        document: { getElementById: id => fields[id], dispatchEvent: event => events.push(event) },
        fetch: async (_, request) => {
            posts.push(request);
            if (failed) throw new Error("Synthetic network failure");
            return { ok: true, json: async () => ({ material: worksheetFixture, credits: { remaining: 400 }, charge: { cost: 25 } }) };
        },
        resolveAiEndpoint: () => "https://test.invalid/api/ai/generate", educariaTrackAiEvent() {}, checkAiHealth: async () => {},
        aiErrorCodeFromMessage: () => "request_failed",
        openAiReadyModal: () => assert.fail("A print worksheet must not open a TV modal")
    });
    for (const [start, end] of [
        ["function materialConfig(", "async function generateMaterialFromTemplate("],
        ["function aiErrorToUserMessage(", "async function checkAiHealth("],
        ["async function requestStructuredMaterial(", "async function requestTemplateStructuredMaterial("],
        ["async function generateMaterial(", "function applyGenerationOptionsToEditor("]
    ]) vm.runInContext(section(start, end), context);
    return { context, fields, posts, alerts, events, get applied() { return applied; }, get renders() { return renders; } };
}

test("teacher selection, topic and teaching settings are sent together in one authenticated request", async () => {
    const h = harness({ types: ["wordsearch", "crossword"] }), button = { textContent: "Gerar folha com IA" };
    assert.equal(await h.context.generateMaterial("worksheet", button), true);
    assert.equal(h.posts.length, 1); assert.equal(h.posts[0].headers.Authorization, "Bearer synthetic-test");
    const form = h.posts[0].body, options = JSON.parse(form.get("generationOptions"));
    assert.equal(form.get("materialType"), "worksheet");
    assert.equal(form.get("sourceText"), h.fields["worksheet-source"].value);
    assert.deepEqual(options.worksheetTypes, ["wordsearch", "crossword"]);
    assert.equal(options.audience, "7º ano"); assert.equal(options.difficulty, "hard");
    assert.equal(options.pageMode, "compact"); assert.equal(options.inputMode, "auto");
    assert.ok(h.applied); assert.equal(h.renders, 1); assert.equal(button.disabled, false);
    assert.ok(h.events.some(event => event.type === "educaria-ai-credits-updated"));
});
test("worksheet may use a file without a topic and sends it once", async () => {
    const h = harness(); h.fields["worksheet-source"].value = "";
    h.fields["worksheet-file"].files = [new File(["Past tense content"], "conteudo.txt", { type: "text/plain" })];
    assert.equal(await h.context.generateMaterial("worksheet", { textContent: "Gerar" }), true);
    assert.equal(h.posts[0].body.get("file").name, "conteudo.txt");
    assert.equal(h.posts[0].body.get("sourceText"), "");
});

test("individual activity requests and help choices reach the API in the same single request", async () => {
    const overrides = { activityOptions: { wordsearch: { count: 6, instructions: "Verbos de viagens." }, crossword: { count: 4, instructions: "Verbos de alimentação." } }, wordsearchHelp: "none", trailClues: false };
    const h = harness({ types: ["wordsearch", "crossword"], overrides });
    assert.equal(await h.context.generateMaterial("worksheet", { textContent: "Gerar" }), true);
    assert.equal(h.posts.length, 1);
    const options = JSON.parse(h.posts[0].body.get("generationOptions"));
    assert.deepEqual(options.activityOptions, overrides.activityOptions);
    assert.equal(options.wordsearchHelp, "none"); assert.equal(options.trailClues, false);
});
test("empty selections and empty source do not call AI or overwrite the previous sheet", async () => {
    const h = harness({ types: [] });
    assert.equal(await h.context.generateMaterial("worksheet", { textContent: "Gerar" }), false);
    assert.equal(h.posts.length, 0); assert.equal(h.applied, undefined);
    assert.match(h.alerts[0], /Selecione/);
    const empty = harness(); empty.fields["worksheet-source"].value = "";
    assert.equal(await empty.context.generateMaterial("worksheet", { textContent: "Gerar" }), false);
    assert.equal(empty.posts.length, 0);
});
test("network failure leaves the previous material intact and re-enables generation", async () => {
    const h = harness({ failed: true }), button = { textContent: "Gerar folha com IA" };
    assert.equal(await h.context.generateMaterial("worksheet", button), false);
    assert.equal(h.applied, undefined); assert.equal(button.disabled, false);
    assert.equal(button.textContent, "Gerar folha com IA"); assert.equal(h.alerts.length, 1);
});
test("worksheet routing is isolated and cannot enter the classroom projection sequence", async () => {
    const context = vm.createContext({ document: { addEventListener() {} }, window: {}, educariaScopedKey: key => `${key}:teacher-a` });
    vm.runInContext(await fs.readFile(new URL("../../assets/js/material-context.js", import.meta.url), "utf8"), context);
    assert.equal(context.draftStorageKeyForType("worksheet"), "educaria:builder:worksheet:teacher-a");
    assert.equal(context.presentationPathForMaterial("worksheet"), "folha-atividades-builder.html");
    const sequence = await fs.readFile(new URL("../../assets/js/lesson-sequence-builder.js", import.meta.url), "utf8");
    vm.runInContext(sequence, context);
    context.readLessonsLibrary = () => [{ id: 1, materialType: "worksheet" }, { id: 2, materialType: "quiz" }, { id: 3, materialType: "lesson" }];
    assert.deepEqual(Array.from(context.readAllActivityLessons(), item => item.id), [2]);
});
test("worksheet assets are public, print controls are separate and private files remain excluded", async () => {
    const path = "plataforma/folha-atividades-builder.html";
    assert.equal(isPublicFile(path), true);
    const html = await fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
    assert.match(html, /data-requires-auth="true"/); assert.match(html, /data-generate-material="worksheet"/);
    assert.match(html, /data-worksheet-print="student"/); assert.match(html, /data-worksheet-print="answers"/);
    assert.match(html, /data-save-material="worksheet"/); assert.match(html, /builder-journey.js/);
    assert.ok(html.indexOf("material-context.js") < html.indexOf("local-persistence.js"));
    for (const name of ["core", "view", "layout", "builder"]) assert.equal(isPublicFile(`assets/js/worksheet-${name}.js`), true);
    assert.equal(isPublicFile("assets/css/components/worksheet.css"), true);
    assert.equal(isPublicFile("tools/fixtures/worksheet.mjs"), false);
    assert.equal(isPublicFile("ai-service/.env"), false);
    const css = await fs.readFile(new URL("../../assets/css/components/worksheet.css", import.meta.url), "utf8");
    assert.match(css, /size:A4 portrait/); assert.match(css, /width:210mm/); assert.match(css, /height:297mm/);
    assert.match(css, /transform:none!important/); assert.match(css, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
});

test("creation settings live in their selected activity cards before generating, not in the editor", async () => {
    const html = await fs.readFile(new URL("../../plataforma/folha-atividades-builder.html", import.meta.url), "utf8");
    const create = html.slice(0, html.indexOf('data-generate-material="worksheet"'));
    for (const type of core.types) {
        const card = create.match(new RegExp(`<div class="worksheet-activity-choice" data-ws-choice="${type}">([\\s\\S]*?)<\\/details>\\s*<\\/div>`))?.[1];
        assert.ok(card, `${type} must have a card before generating`);
        assert.ok(card.includes(`data-ws-select="${type}"`));
        assert.ok(card.includes(`<details data-ws-options="${type}">`), "options start collapsed");
        assert.ok(card.includes(`id="worksheet-${type}-request"`));
        assert.ok(card.includes(`id="worksheet-${type}-count"`));
    }
    assert.ok(create.includes('id="worksheet-connections-clue-count"'));
    assert.ok(create.includes('id="worksheet-word-bank"'));
    assert.match(html, /data-worksheet-edit-panel hidden/);
    const editor = html.slice(html.indexOf('data-worksheet-edit-panel'));
    assert.ok(editor.includes('data-worksheet-items'));
    assert.ok(!editor.includes('data-ws-options'));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
});

test("review stays hidden before creation but remains accessible for an invalid or restored draft", async () => {
    let teacher = { uid: "worksheet-test" };
    const fields = Object.fromEntries([
        "[data-worksheet-items]", "[data-worksheet-edit-panel]", "[data-worksheet-start-blank]",
        "[data-worksheet-validation]", "[data-worksheet-pages]", "[data-worksheet-review-warnings]",
        "[data-worksheet-page-count]", "#worksheet-title", "#worksheet-subtitle"
    ].map(selector => [selector, { children: [], dataset: {}, value: "", innerHTML: "", replaceChildren() {} }]));
    const context = vm.createContext({
        window: { EducariaWorksheet: { readDraft: () => ({}), normalize: () => { throw new Error("Revise o conteúdo."); } }, EducariaWorksheetView: {} },
        document: { querySelector: selector => fields[selector], querySelectorAll: () => [], addEventListener() {} },
        readCurrentTeacher: () => teacher, clearTimeout() {}, persistMaterializedFields() {}, DOMParser: class {}
    });
    vm.runInContext(await fs.readFile(new URL("../../assets/js/worksheet-builder.js", import.meta.url), "utf8"), context);
    const render = context.window.EducariaWorksheetBuilder.render;
    render();
    assert.equal(fields["[data-worksheet-edit-panel]"].hidden, true);
    assert.equal(fields["[data-worksheet-start-blank]"].hidden, false);
    fields["[data-worksheet-items]"].children = [{}];
    render();
    assert.equal(fields["[data-worksheet-edit-panel]"].hidden, false, "incomplete content must remain editable");
    assert.equal(fields["[data-worksheet-start-blank]"].hidden, true);
    teacher = { uid: "another-teacher" };
    render();
    assert.equal(fields["[data-worksheet-edit-panel]"].hidden, true, "do not expose another teacher's editor");
});
