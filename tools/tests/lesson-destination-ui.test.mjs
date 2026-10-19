import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const journeySource = await fs.readFile(new URL("../../assets/js/builder-journey.js", import.meta.url), "utf8");
const librarySource = await fs.readFile(new URL("../../assets/js/lesson-library.js", import.meta.url), "utf8");
const configs = { quiz: "quiz-turma", slides: "slides-turma", flashcards: "cards-turma", memory: "memoria-turma", hangman: "forca-turma", wheel: "roleta-turma", match: "ligar-turma" };

function journeyHarness(materialType, classes, selected = "") {
    const listeners = new Map();
    const attrs = new Map();
    const button = { disabled: true, setAttribute: (key, value) => attrs.set(key, value) };
    class Field { closest() { return true; } }
    const field = Object.assign(new Field(), { id: configs[materialType], value: "", innerHTML: "" });
    const context = vm.createContext({
        URLSearchParams, Element: Field, navigator: { onLine: true }, console,
        window: { location: { search: "" }, addEventListener() {}, clearTimeout() {} },
        document: {
            body: { dataset: { materialType } },
            getElementById: (id) => id === field.id ? field : null,
            querySelector: (selector) => selector.includes("[data-save-lesson]") ? button : null,
            querySelectorAll: () => [],
            addEventListener: (name, callback) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(callback); }
        },
        getAvailableClasses: () => classes, readSelectedClass: () => selected,
        saveSelectedClass: (value) => { selected = value; }, readActiveLesson: () => null
    });
    vm.runInContext(journeySource, context);
    const emit = (name, event) => listeners.get(name)?.forEach((fn) => fn(event));
    emit("DOMContentLoaded");
    return { button, attrs, field, emit };
}

for (const materialType of Object.keys(configs)) {
    test(`${materialType}: a new draft does not inherit the last visited class`, () => {
        assert.equal(journeyHarness(materialType, ["7º Ano A"], "7º Ano A").field.value, "");
    });
    test(`${materialType}: the class chooser remains available without a selected class`, () => {
        const h = journeyHarness(materialType, ["7º Ano A", "7º Ano B"]);
        assert.equal(h.field.value, "");
        assert.equal(h.button.disabled, false);
        assert.equal(h.attrs.get("aria-disabled"), "false");
        assert.equal(h.attrs.get("aria-haspopup"), "dialog");
    });
    test(`${materialType}: switching to the library does not disable destination selection`, () => {
        const h = journeyHarness(materialType, ["7º Ano A"], "7º Ano A");
        h.field.value = "";
        h.emit("change", { target: h.field });
        h.emit("educaria-classes-updated");
        assert.equal(h.button.disabled, false);
        assert.equal(h.attrs.get("aria-disabled"), "false");
    });
    test(`${materialType}: teachers with no classes can still open the destination dialog`, () => {
        assert.equal(journeyHarness(materialType, []).button.disabled, false);
    });
}

for (const [materialType, titleId] of Object.entries({ worksheet: "worksheet-title", wordsearch: "caca-titulo", crossword: "cruzada-titulo", mindmap: "mapa-centro", debate: "debate-titulo" })) {
    test(`${materialType}: a manual change is preserved on page exit and isolated by account`, () => {
        const listeners = new Map();
        const pageListeners = new Map();
        let uid = "teacher-a";
        const title = { id: titleId, value: "" };
        const saved = [];
        const context = vm.createContext({
            URLSearchParams, console,
            window: { location: { search: "" }, addEventListener: (name, fn) => pageListeners.set(name, fn) },
            document: {
                body: { dataset: { materialType } },
                getElementById: (id) => id === titleId ? title : null,
                querySelector: () => null,
                querySelectorAll: (selector) => selector === "input[id], textarea[id], select[id]" ? [title] : [],
                addEventListener: (name, fn) => listeners.set(name, fn)
            },
            readCurrentTeacher: () => ({ uid }), readActiveLesson: () => null,
            buildLessonRecord: (type, scope) => ({ type, scope, title: title.value }),
            persistLessonRecord: (record) => saved.push(record)
        });
        vm.runInContext(journeySource, context);
        listeners.get("DOMContentLoaded")();
        pageListeners.get("pagehide")();
        assert.equal(saved.length, 0);
        title.value = "Atividade manual";
        pageListeners.get("pagehide")();
        assert.equal(saved.length, 1);
        assert.equal(saved[0].scope, "library");
        assert.equal(saved[0].type, materialType);
        uid = "teacher-b";
        title.value = "Não deve passar para outra conta";
        pageListeners.get("pagehide")();
        assert.equal(saved.length, 1);
    });
}

function modalHarness(classes = ["7º Ano A", "7º Ano B", "8º Ano A"]) {
    const nodes = new Map();
    let choices = [];
    const node = (key) => {
        if (!nodes.has(key)) nodes.set(key, { hidden: false, disabled: false, textContent: "", value: "", innerHTML: "" });
        return nodes.get(key);
    };
    const optionsNode = node("[data-destination-choices]");
    Object.defineProperty(optionsNode, "innerHTML", {
        get() { return this.markup || ""; },
        set(html) {
            this.markup = html;
            choices = [...html.matchAll(/<input\b[^>]*>/g)].map(([tag]) => ({
                checked: /\schecked(?:\s|>)/.test(tag),
                dataset: { scope: tag.match(/data-scope="([^"]+)"/)[1] },
                value: tag.match(/value="([^"]*)"/)[1]
            }));
        }
    });
    const modal = {
        open: false,
        querySelector: node,
        querySelectorAll: () => choices.filter((choice) => choice.checked),
        showModal() { this.open = true; }
    };
    const context = vm.createContext({
        ensureLessonDestinationModal: () => modal,
        getAvailableClasses: () => classes, currentClassName: () => "",
        readCurrentTeacher: () => ({ uid: "teacher-test" }), readLessonsLibrary: () => [],
        normalizeLessonScope: (source) => source.scope,
        escapeHtml: (text) => String(text).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")
    });
    vm.runInContext('let lessonDestinationSession = null; const LESSON_SCOPE_LIBRARY = "library"; const LESSON_SCOPE_CLASS = "class";', context);
    vm.runInContext(librarySource.slice(librarySource.indexOf("function updateLessonDestinationSummary("), librarySource.indexOf("async function confirmLessonDestinations(")), context);
    return {
        modal, node, choices: () => choices,
        open(source, options = {}) {
            context.input = source; context.options = options;
            vm.runInContext("openLessonDestinationModal(input, options)", context);
        }
    };
}

test("saving a library draft to a class lists every class without silently selecting the library", () => {
    const h = modalHarness();
    h.open({ title: "Ecossistemas", className: "", scope: "library" }, { initialScope: "class" });
    assert.equal(h.modal.open, true);
    assert.deepEqual(h.choices().map((choice) => choice.value), ["", "7º Ano A", "7º Ano B", "8º Ano A"]);
    assert.equal(h.choices().some((choice) => choice.checked), false);
    assert.equal(h.node("[data-destination-save]").disabled, true);
});

test("the library action still preselects the library", () => {
    const h = modalHarness();
    h.open({ title: "Ecossistemas", className: "7º Ano A", scope: "class" }, { initialScope: "library" });
    assert.deepEqual(h.choices().filter((choice) => choice.checked).map((choice) => choice.dataset.scope), ["library"]);
});

test("existing class materials preselect their original class and keep the other classes available", () => {
    const h = modalHarness();
    h.open({ title: "Ecossistemas", className: "7º Ano B", scope: "class" }, { initialScope: "class" });
    assert.deepEqual(h.choices().filter((choice) => choice.checked).map((choice) => choice.value), ["7º Ano B"]);
    assert.equal(h.node("[data-destination-save]").disabled, false);
});

test("no classes shows the empty state and keeps personal library available", () => {
    const h = modalHarness([]);
    h.open({ title: "Ecossistemas", className: "", scope: "library" }, { initialScope: "class" });
    assert.equal(h.modal.open, true);
    assert.equal(h.node("[data-destination-empty]").hidden, false);
    assert.equal(h.choices().length, 1);
    assert.equal(h.choices()[0].dataset.scope, "library");
});

for (const materialType of [...Object.keys(configs), "wordsearch", "crossword", "mindmap", "debate", "lesson"]) {
    test(`${materialType}: the save action opens the destination chooser instead of navigating`, () => {
        let click;
        let opened;
        let prevented = false;
        const record = { title: "Atividade", materialType, scope: "library", className: "" };
        const button = { dataset: { saveMaterial: materialType }, addEventListener: (name, fn) => { if (name === "click") click = fn; } };
        const context = vm.createContext({
            LESSON_SCOPE_CLASS: "class", document: { querySelectorAll: () => [button] },
            readActiveLesson: () => record, activeLessonSequenceRecord: () => record,
            normalizeLessonScope: (source) => source.scope,
            buildLessonRecord: () => record, buildLessonSequenceRecord: () => record,
            openLessonDestinationModal: (source, options) => { opened = { source, options }; },
            console, showLibraryToast: (message) => assert.fail(message)
        });
        vm.runInContext(librarySource.slice(librarySource.indexOf("function bindSaveLessonAction("), librarySource.indexOf("function hydrateBuilderCommonActions(")), context);
        vm.runInContext("bindSaveLessonAction()", context);
        click({ preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
        assert.equal(opened.source, record);
        assert.equal(opened.options.initialScope, "class");
        assert.equal(opened.options.markReady, true);
    });
}
