import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = (path) => fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [wheel, wheelRuntime, wordsearch, flashcards, mode] = await Promise.all([
    "wheel-builder", "wheel-runtime", "wordsearch-runtime", "flashcards-runtime", "presentation-mode"
].map((name) => read(`assets/js/${name}.js`)));
function section(source, first, next) {
    const start = source.indexOf(first), end = source.indexOf(next, start + first.length);
    assert.ok(start >= 0 && end > start, `Missing source boundaries: ${first}`);
    return source.slice(start, end);
}
function node() {
    return { dataset: {}, style: {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } };
}
function wheelHarness(count = 16) {
    const quantity = { options: [4, 6, 8, 10, 12].map(n => ({ text: `${n} espaços`, value: `${n} espaços` })), appendChild(option) { option.text = option.textContent; this.options.push(option); } };
    const freeCount = {}, segments = Array.from({ length: count }, (_, index) => ({
        text: `Espaço original ${index + 1}`, button: null,
        querySelector(selector) { return selector === "[data-wheel-remove]" ? this.button : null; },
        appendChild(button) { this.button = button; },
        remove() { segments.splice(segments.indexOf(this), 1); }
    }));
    let saves = 0;
    const context = vm.createContext({
        document: { getElementById: id => id === "roleta-quantidade" ? quantity : freeCount, createElement: node, querySelectorAll: () => segments },
        renderWheelPreview() {}, dispatchBuilderContentChange() { saves++; }
    });
    vm.runInContext(section(wheel, "function setWheelCountSelect", "function syncWheelSegmentCount"), context);
    vm.runInContext(section(wheel, "function removeWheelSegment", "function polar"), context);
    return { context, quantity, freeCount, segments, saves: () => saves };
}

test("custom wheel counts preserve standard options and synchronize the numeric field", () => {
    const h = wheelHarness();
    h.context.setWheelCountSelect(16);
    h.context.setWheelCountSelect(16);
    assert.equal(h.quantity.options.length, 6);
    assert.equal(h.quantity.options[4].value, "12 espaços");
    assert.equal(h.quantity.value, "16 espaços");
    assert.equal(h.freeCount.value, "16");
});
test("old saved wheel cards regain one accessible removal button each", () => {
    const h = wheelHarness();
    h.context.ensureWheelRemoveControls(); h.context.ensureWheelRemoveControls();
    assert.equal(h.segments.length, 16);
    assert.equal(h.segments[15].button.attributes["aria-label"], "Remover espaço 16");
    assert.equal(h.segments[15].button.disabled, false);
    h.segments.splice(2); h.context.ensureWheelRemoveControls();
    assert.ok(h.segments.every(segment => segment.button.disabled));
});
test("removing a wheel space keeps every other space and requests an autosave", () => {
    const h = wheelHarness();
    const target = h.segments[10];
    h.context.removeWheelSegment({ closest: () => target });
    assert.equal(h.segments.length, 15);
    assert.equal(h.quantity.value, "15 espaços");
    assert.equal(h.freeCount.value, "15");
    assert.equal(h.segments[14].text, "Espaço original 16");
    assert.equal(h.saves(), 1);
    h.segments.splice(2); h.context.removeWheelSegment({ closest: () => h.segments[0] });
    assert.equal(h.segments.length, 2);
    assert.equal(h.saves(), 1);
});
test("saving wheel presentation edits preserves editor removal controls", () => {
    const context = vm.createContext({});
    vm.runInContext(section(wheelRuntime, "function escapeWheelText", "function buildWheelDiscSvg"), context);
    const html = context.serializeWheelSegments([{ text: 'A < B "teste"' }, { text: "Outro" }]);
    assert.equal((html.match(/data-wheel-remove/g) || []).length, 2);
    assert.ok(html.includes("&lt;") && html.includes("&quot;"));
});

function boardHarness(width, height, rows, cols) {
    const classes = new Set(), inner = { style: { setProperty(key, value) { this[key] = value; } } };
    const shell = { clientWidth: width, clientHeight: height, classList: { contains: value => classes.has(value) } };
    const context = vm.createContext({
        boardRoot: { closest: () => shell, querySelector: () => inner }, boardResizeFrame: 0, puzzle: { rows, cols },
        window: { cancelAnimationFrame() {}, requestAnimationFrame(fn) { fn(); return 1; } },
        getComputedStyle: () => ({ paddingLeft: "10", paddingRight: "10", paddingTop: "10", paddingBottom: "10", gap: "2" })
    });
    vm.runInContext(section(wordsearch, "    function fitBoardToAvailableSpace", "    function paintBoard"), context);
    return { context, inner, classes };
}
test("wordsearch zoom really enlarges cells already bigger than 32px and is reversible", () => {
    const h = boardHarness(600, 500, 8, 10);
    h.context.fitBoardToAvailableSpace();
    const original = parseFloat(h.inner.style.width);
    h.classes.add("is-zoomed"); h.context.fitBoardToAvailableSpace();
    const enlarged = parseFloat(h.inner.style.width);
    assert.ok(enlarged > original * 1.4);
    h.context.fitBoardToAvailableSpace();
    assert.equal(parseFloat(h.inner.style.width), enlarged, "Repeated resizing must not compound zoom");
    h.classes.clear(); h.context.fitBoardToAvailableSpace();
    assert.equal(parseFloat(h.inner.style.width), original);
});
test("the full wordsearch grid fits both axes in a short embedded stage", () => {
    const h = boardHarness(390, 220, 12, 12);
    h.context.fitBoardToAvailableSpace();
    assert.ok(parseFloat(h.inner.style.height) <= 200);
    assert.ok(parseFloat(h.inner.style.width) <= 370);
});

function flashHarness(width, height, longestWord) {
    const title = { style: {}, textContent: "Interdependência dos ecossistemas", get scrollWidth() { return longestWord * parseFloat(this.style.fontSize) * .52; } };
    const face = { clientWidth: width, clientHeight: height, dataset: {}, scrollHeight: height, querySelector: selector => selector === "strong" ? title : null };
    const context = vm.createContext({ window: { getComputedStyle: element => element === face ? { paddingLeft: "18px", paddingRight: "18px" } : element.style } });
    vm.runInContext(section(flashcards, "function fitFlashcardFaceContent", "function renderFlashcardsPresentation"), context);
    return { context, face, title };
}
test("flashcards shrink long words before splitting them on small screens", () => {
    const h = flashHarness(360, 180, 16);
    assert.equal(h.context.fitFlashcardFaceContent(h.face), true);
    assert.equal(h.title.style.maxWidth, "322px");
    assert.equal(h.title.style.overflowWrap, "normal");
    assert.ok(h.title.scrollWidth <= 322);
    assert.equal(h.title.textContent, "Interdependência dos ecossistemas");
});
test("very narrow flashcards use their real available width and a readable fallback", () => {
    const h = flashHarness(180, 150, 50);
    h.context.fitFlashcardFaceContent(h.face);
    assert.equal(h.title.style.maxWidth, "142px");
    assert.equal(h.title.style.fontSize, "20px");
    assert.equal(h.title.style.overflowWrap, "anywhere");
    h.face.clientHeight = 0;
    assert.equal(h.context.fitFlashcardFaceContent(h.face), false);
});

test("stage height follows the actual shell, not the laptop or parent window", () => {
    let collapsed = false, height, events = 0;
    const shell = { clientHeight: 340, querySelector: () => ({ offsetHeight: 50 }), style: { setProperty: (_, value) => height = value } };
    const context = vm.createContext({
        document: { querySelector: () => shell, body: { classList: { contains: () => collapsed } }, dispatchEvent: () => events++ },
        window: { innerHeight: 900 }, CustomEvent: class {}, getComputedStyle: () => ({ paddingTop: "8", paddingBottom: "8", rowGap: "10" })
    });
    vm.runInContext(section(mode, "    function syncPresentationViewport", "    function queuePresentationViewportSync"), context);
    context.syncPresentationViewport(); assert.equal(height, "264px");
    collapsed = true; context.syncPresentationViewport(); assert.equal(height, "324px");
    assert.equal(events, 2);
});
test("the library action stays accessible when controls are hidden, without duplication", () => {
    let link = null;
    const actions = { prepend(element) { link = element; element.parent = this; } };
    const classes = new Set(["presentation-topbar-pinned"]);
    const body = { appendChild(element) { element.parent = this; }, classList: { toggle(value, force) { const enabled = force ?? !classes.has(value); enabled ? classes.add(value) : classes.delete(value); return enabled; } } };
    const context = vm.createContext({
        libraryReturn: null, libraryReturnParent: null,
        document: { body, createElement: node, querySelector: selector => selector === "[data-presentation-library]" ? link : actions },
        showPresentationChrome() {}, queuePresentationViewportSync() {}
    });
    vm.runInContext(section(mode, "    function addLibraryReturnAction", "    function addPresentationChromeActions"), context);
    vm.runInContext(section(mode, "    function toggleTopbar", "    function addTopbarRestoreAction"), context);
    context.addLibraryReturnAction(); const first = link;
    context.addLibraryReturnAction(); assert.equal(link, first);
    assert.equal(link.href, "biblioteca.html");
    assert.equal(link.attributes["aria-label"], "Retornar à biblioteca");
    assert.ok(link.innerHTML.includes("<span>Retornar à biblioteca</span>"));
    context.toggleTopbar(); assert.equal(link.parent, body);
    context.toggleTopbar(); assert.equal(link.parent, actions);
});
test("all twelve presentation pages load the shared library action", async () => {
    const pages = ["apresentacao", "aula-completa-apresentacao", "caca-palavras-apresentacao", "debate-guiado-apresentacao", "flashcards-apresentacao", "forca-apresentacao", "jogo-memoria-apresentacao", "ligar-pontos-apresentacao", "mapa-mental-apresentacao", "palavras-cruzadas-apresentacao", "quiz-aplicacao", "roleta-apresentacao"];
    for (const page of pages) {
        const html = await read(`plataforma/${page}.html`);
        assert.match(html, /presentation-mode\.js/, page);
        assert.match(html, /(?:platform-top-actions|presentation-topbar-group|lesson-sequence-stage-actions)/, page);
    }
});
