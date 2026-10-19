import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = path => fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const visualSource = await read("assets/js/collection-visuals.js");
const librarySource = await read("assets/js/lesson-library.js");
const materialSource = await read("assets/js/material-context.js");
const classesSource = await read("assets/js/classes-overview.js");
const sequenceSource = await read("assets/js/lesson-sequence-builder.js");
const types = ["slides", "quiz", "flashcards", "memory", "wheel", "mindmap", "match", "debate", "hangman", "lesson", "wordsearch", "crossword"];
const records = types.map((type, i) => ({id: `item-${i}`, title: `${String(i).padStart(2, "0")} Teste`, summary: `Resumo ${i}`, materialType: type, scope: "library", status: i === 0 ? "draft" : "ready", updatedAt: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00.000Z`, draft: "{}"}));

function harness() {
    const root = {innerHTML: "", attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }};
    const scope = vm.createContext({
        window: {}, URLSearchParams, console,
        document: {querySelector: selector => selector === "[data-library-materials]" ? root : null, addEventListener() {}},
        getAvailableClasses: () => ["7º Ano A"],
        localStorage: {getItem: () => null}
    });
    vm.runInContext(visualSource, scope);
    vm.runInContext(materialSource, scope);
    vm.runInContext(librarySource.slice(0, librarySource.indexOf('document.addEventListener("DOMContentLoaded"')), scope);
    scope.readLessonsLibrary = () => structuredClone(records);
    const run = code => vm.runInContext(code, scope);
    return {root, scope, run, visual: scope.window.EducariaCollections};
}

test("drafts is a personal-library filter, excluding ready materials and class drafts", () => {
    const h = harness();
    h.scope.readLessonsLibrary = () => [...structuredClone(records), { ...records[1], id: "class-draft", scope: "class", className: "7º Ano A", status: "draft" }];
    h.run('activeLibraryScope="drafts"; hydrateLibraryPage()');
    assert.equal((h.root.innerHTML.match(/<article/g) || []).length, 1);
    assert.match(h.root.innerHTML, /data-lesson-card="item-0"/);
    assert.doesNotMatch(h.root.innerHTML, /class-draft/);
    h.scope.readLessonsLibrary = () => [];
    h.run('hydrateLibraryPage()');
    assert.match(h.root.innerHTML, /Nenhum rascunho por aqui/);
});

test("lesson sequence routes pending generated drafts to review instead of inserting blank blocks", () => {
    const pending = { id: "pending", title: "Sistema Solar", materialType: "quiz", scope: "library", draft: JSON.stringify({ pendingAiResult: { material: {} } }) };
    const scope = vm.createContext({
        lessonSequenceState: { blocks: [] }, findLessonById: () => pending,
        detectLessonScope: (lesson) => lesson.scope, materialGroupLabel: () => "Quiz",
        materialGroupDescription: () => "Revisão", editorPathForLesson: () => "quiz-builder.html?quickApply=1",
        escapeHtml: String, escapeAttr: String,
        buildBaseBlock: () => assert.fail("Must not create a blank block before review")
    });
    for (const [start, end] of [
        ["function isPendingSequenceLesson(", "function classLessonsForSequence("],
        ["function addSavedLessonToSequence(", "function setBlockSource("],
        ["function renderSequenceMaterialCard(", "function refreshLessonSequenceMaterialResults("]
    ]) vm.runInContext(sequenceSource.slice(sequenceSource.indexOf(start), sequenceSource.indexOf(end)), scope);
    scope.addSavedLessonToSequence("pending");
    const markup = scope.renderSequenceMaterialCard(pending);
    assert.match(markup, /Revisar no editor/);
    assert.doesNotMatch(markup, /data-add-saved-lesson/);
    assert.match(scope.renderSequenceMaterialCard({ ...pending, draft: "{}" }), /data-add-saved-lesson/);
});

test("12 decorative covers are distinct, inert and fall back safely for unknown types", () => {
    const {visual} = harness();
    const covers = types.map(type => visual.cover(type));
    assert.equal(new Set(covers).size, types.length);
    for (const html of covers) {
        assert.match(html, /aria-hidden="true"/);
        assert.match(html, /viewBox="0 0 360 152"/);
        assert.doesNotMatch(html, /<script|<foreignObject|\son\w+=|href=|undefined|NaN/i);
    }
    assert.equal(visual.cover('<img src=x onerror=alert(1)>'), visual.cover("slides"));
    assert.equal(visual.cover("__proto__"), visual.cover("slides"));
});

test("class identities are stable, short, and understand Portuguese grade names", () => {
    const {visual} = harness();
    for (const [name, initials] of [["7º Ano A - Ciências", "7A"], ["8ª série B", "8B"], ["9º Ano - História", "9º"], ["", "TU"]]) {
        assert.equal(visual.classIdentity(name).initials, initials);
        assert.equal(visual.classIdentity(name).tone, visual.classIdentity(name).tone);
        assert.match(visual.classIdentity(name).tone, /^(mint|lilac|sand|blue)$/);
    }
    assert.doesNotMatch(visual.classIdentity('<img src=x>').initials, /[<>]/);
});

test("library gallery preserves global sorting, every format, and existing action hooks", () => {
    const h = harness();
    h.run('activeLibrarySort="title"; hydrateLibraryPage()');
    assert.equal(h.root.attrs["aria-busy"], "false");
    assert.match(h.root.innerHTML, /collection-library-grid/);
    assert.doesNotMatch(h.root.innerHTML, /lesson-group-disclosure/);
    let lastIndex = -1;
    for (const [i, type] of types.entries()) {
        const index = h.root.innerHTML.indexOf(`data-material-type="${type}"`);
        assert.ok(index > lastIndex, type);
        lastIndex = index;
        for (const action of ["present", "edit", "rename", "delete", "duplicate"]) assert.ok(h.root.innerHTML.includes(`data-${action}-lesson="item-${i}"`), `${type} ${action}`);
    }
    assert.equal((h.root.innerHTML.match(/class="collection-more"/g) || []).length, types.length);
    assert.match(h.root.innerHTML, /quiz-aplicacao\.html\?lesson=item-1&amp;material=quiz/);
});

test("worksheets open their print editor from the library instead of a projection player", () => {
    const h = harness();
    h.scope.readLessonsLibrary = () => [{ ...records[0], id: "sheet", materialType: "worksheet", title: "Folha impressa" }];
    h.run("hydrateLibraryPage()");
    assert.match(h.root.innerHTML, /folha-atividades-builder\.html\?lesson=sheet&amp;material=worksheet/);
    assert.match(h.root.innerHTML, />Ver folha</);
    assert.doesNotMatch(h.root.innerHTML, /apresentacao\.html/);
    assert.notEqual(h.visual.cover("worksheet"), h.visual.cover("slides"));
    assert.equal(h.run('draftKeyForType("worksheet")'), "educaria:builder:worksheet");
});

test("gallery still applies search, status, and material filters without changing saved records", () => {
    const h = harness();
    h.run('activeLibraryStatusFilter="draft"; hydrateLibraryPage()');
    assert.equal((h.root.innerHTML.match(/<article/g) || []).length, 1);
    assert.match(h.root.innerHTML, /data-material-type="slides"/);
    h.run('activeLibraryStatusFilter="all"; activeLibraryMaterialFilter="quiz"; hydrateLibraryPage()');
    assert.equal((h.root.innerHTML.match(/<article/g) || []).length, 1);
    assert.match(h.root.innerHTML, /data-material-type="quiz"/);
    h.run('activeLibraryMaterialFilter="all"; librarySearchQuery="não existe"; hydrateLibraryPage()');
    assert.match(h.root.innerHTML, /Nenhum material neste filtro/);
    assert.equal(records[0].status, "draft");
});

test("teacher text is escaped, system tags have accents, and filtered counts stay accurate", () => {
    const h = harness();
    h.scope.readLessonsLibrary = () => [{...records[0], title:'<img src=x onerror="alert(1)">', summary:"<script>bad()</script>", tags:["revisao", "organizacao", "__proto__"]}];
    h.run('hydrateLibraryPage()');
    assert.doesNotMatch(h.root.innerHTML, /<img|<script>/);
    assert.match(h.root.innerHTML, /&lt;img/);
    assert.match(h.root.innerHTML, /Revisão/);
    assert.match(h.root.innerHTML, /Organização/);
    assert.doesNotMatch(h.root.innerHTML, /\[object Object\]/);
    assert.match(h.run('libraryFilterSummaryLabel("all",1,12)'), /^1 material em/);
    assert.match(h.run('librarySearchQuery="teste"; libraryFilterSummaryLabel("all",1,12)'), /1 material encontrado pela/);
});

test("class cards retain navigation, show escaped school names and filter to the chosen group", () => {
    const h = harness();
    h.scope.getAvailableClasses = () => ["7º Ano A", "8º Ano B"];
    h.scope.classMaterials = () => [{...records[1], scope:"class"}];
    h.scope.getClassProfile = () => ({school:"Escola <Horizonte>"});
    h.scope.document.querySelector = selector => selector === "[data-classes-overview-grid]" ? h.root : null;
    vm.runInContext(classesSource, h.scope);
    h.run('activeClassesOverviewSelection="8º Ano B"; hydrateClassesOverviewPage()');
    assert.equal((h.root.innerHTML.match(/<article/g) || []).length, 1);
    assert.match(h.root.innerHTML, /8B/);
    assert.match(h.root.innerHTML, /Escola &lt;Horizonte&gt;/);
    assert.match(h.root.innerHTML, /index\.html#quick-ai-create/);
    for (const action of ["open-materials", "create-material", "open-editor", "open-presentation"]) assert.ok(h.root.innerHTML.includes(`data-class-${action}=`));
    assert.match(h.root.innerHTML, /quiz-aplicacao\.html\?lesson=item-1&amp;material=quiz/);
});

test("all collection pages load the shared look and correct presentation routing", async () => {
    for (const name of ["biblioteca", "turmas", "turma"]) {
        const html = await read(`plataforma/${name}.html`);
        assert.match(html, /<body[^>]*collection-page/);
        assert.ok(html.indexOf("/material-context.js") < html.indexOf("/lesson-library.js"));
        assert.ok(html.indexOf("/collection-visuals.js") < html.indexOf("/lesson-library.js"));
    }
    assert.match(await read("assets/css/pages/collections.css"), /prefers-reduced-motion/);
});

test("class detail renders the same gallery while retaining all transfer actions", () => {
    const h = harness();
    h.scope.document.querySelector = selector => selector === "[data-saved-lessons]" ? h.root : null;
    h.scope.document.querySelectorAll = () => [];
    h.scope.currentClassName = () => "7º Ano A";
    h.scope.classMaterials = () => structuredClone(records);
    h.scope.hydrateClassFocusPanel = () => {};
    h.scope.markClassPageReady = () => {};
    h.run('activeClassSort="title"; hydrateClassPage()');
    assert.match(h.root.innerHTML, /collection-library-grid/);
    assert.doesNotMatch(h.root.innerHTML, /lesson-group-disclosure/);
    assert.equal((h.root.innerHTML.match(/<article/g) || []).length, types.length);
    for (const action of ["present", "edit", "library", "rename", "delete", "duplicate"]) assert.ok(h.root.innerHTML.includes(`data-${action}-lesson="item-1"`));
});
