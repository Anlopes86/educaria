import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = (file) => fs.readFile(new URL(`../../assets/js/${file}.js`, import.meta.url), "utf8");
const scripts = Object.fromEntries(await Promise.all(["wordsearch-core", "wordsearch-runtime", "crossword-core", "crossword-runtime"].map(async (name) => [name, await read(name)])));
function node() {
    const classes = new Set(), listeners = new Map();
    return {
        classes, listeners, hidden: false, textContent: "", innerHTML: "", dataset: {}, attributes: {},
        clientWidth: 700, clientHeight: 450,
        style: { setProperty(name, value) { this[name] = value; } },
        classList: { contains: (name) => classes.has(name), toggle(name, force) { const enabled = force ?? !classes.has(name); enabled ? classes.add(name) : classes.delete(name); return enabled; } },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { listeners.set(name, callback); },
        click() { listeners.get("click")?.({ currentTarget: this, target: this }); },
        querySelectorAll: () => [], querySelector: () => null, focus() {}, select() {}
    };
}
function harness(type) {
    const nodes = new Map(), frames = new Map(); let frameId = 0;
    const get = (selector) => { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); };
    const body = get(`.${type}-stage-body`), card = get(`.${type}-stage-card`);
    const sidebar = get(`.${type}-stage-sidebar`), board = get(`[data-${type}-stage-board]`);
    const shell = get(type === "wordsearch" ? ".wordsearch-stage-board-shell" : ".crossword-board-shell--stage");
    const grid = node(); board.querySelector = () => grid; board.closest = get;
    const context = vm.createContext({
        console, Set, Map,
        document: { querySelector: get, addEventListener() {} },
        localStorage: { getItem: () => null },
        DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
        getComputedStyle: () => ({ paddingLeft: "10", paddingRight: "10", paddingTop: "10", paddingBottom: "10", columnGap: "2", gap: "2" }),
        window: { addEventListener() {}, clearTimeout() {}, setTimeout: () => 1,
            requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
            cancelAnimationFrame(id) { frames.delete(id); } }
    });
    vm.runInContext(scripts[`${type}-core`], context);
    vm.runInContext(scripts[`${type}-runtime`], context);
    context[type === "wordsearch" ? "renderWordsearchApplication" : "renderCrosswordApplication"]();
    function flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn()); }
    flush();
    return { context, get, board, grid, body, card, sidebar, shell, flush, progress: context.window.educariaPresentationProgress };
}

for (const type of ["wordsearch", "crossword"]) {
    test(`${type}: expanded grade hides sidebar, fits a short stage, and restores idempotently`, () => {
        const h = harness(type), zoom = h.get("[data-puzzle-zoom]");
        zoom.click(); h.shell.clientWidth = 1024; h.shell.clientHeight = 260; h.flush();
        assert.equal(h.sidebar.hidden, true);
        assert.equal(h.body.classes.has("is-sidebar-hidden"), true);
        assert.equal(h.card.classes.has("is-grid-expanded"), true);
        if (type === "wordsearch") {
            assert.equal(h.grid.style.width, "1004px"); assert.equal(h.grid.style.height, "240px");
        } else {
            assert.ok(parseFloat(h.grid.style.width) <= 1004); assert.ok(parseFloat(h.grid.style.height) <= 240);
        }
        const fittedWidth = h.grid.style.width;
        const saved = JSON.parse(JSON.stringify(h.progress.capture()));
        h.progress.restore(saved); h.progress.restore(saved); h.flush();
        assert.equal(h.progress.capture().zoomed, true);
        assert.equal(h.grid.style.width, fittedWidth);
        zoom.click(); h.flush();
        assert.equal(h.sidebar.hidden, false);
        assert.equal(zoom.textContent, "Ampliar grade");
        assert.ok(parseFloat(h.grid.style.width) <= 1004);
        assert.ok(parseFloat(h.grid.style.height) <= 240);
    });
}

test("wordsearch: hiding the bank does not reveal answers or clear found words", () => {
    const h = harness("wordsearch"), bank = h.get("[data-wordsearch-toggle-bank]");
    h.progress.restore({ foundEntryIds: ["word-1"], activeEntryIds: [], wordsHidden: false });
    bank.click();
    assert.equal(h.sidebar.hidden, true);
    assert.equal(h.progress.capture().revealSolution, false);
    assert.equal(h.progress.capture().foundEntryIds[0], "word-1");
    h.get("[data-puzzle-zoom]").click(); h.get("[data-puzzle-zoom]").click();
    assert.equal(h.sidebar.hidden, true, "Reducing the board preserves a deliberately hidden bank");
    h.get("[data-puzzle-zoom]").click(); bank.click();
    assert.equal(h.sidebar.hidden, false, "Showing words also leaves full-width mode");
    assert.equal(h.progress.capture().zoomed, false);
    assert.equal(bank.attributes["aria-pressed"], "false");
});

test("crossword: inverse mode fills answers, conceals clues and preserves normal-game letters", () => {
    const h = harness("crossword"), invert = h.get("[data-crossword-invert]");
    const across = h.get("[data-crossword-stage-across]"), down = h.get("[data-crossword-stage-down]");
    h.progress.restore({ values: { "0-0": "X" }, correctCells: ["0-0"] });
    invert.click();
    assert.equal(h.progress.capture().inverted, true);
    assert.equal(h.get("[data-crossword-check]").hidden, true);
    assert.doesNotMatch(h.board.innerHTML, /data-crossword-input/);
    assert.match(h.board.innerHTML, /<strong>[A-Z]<\/strong>/);
    assert.doesNotMatch(across.innerHTML + down.innerHTML, /Curso de água|Relevo elevado|Condição atmosférica|Representação de um espaço/);
    const [id] = [...(across.innerHTML + down.innerHTML).matchAll(/data-crossword-reveal-clue="([^"]+)"/g)][0].slice(1);
    const clueRoot = across.innerHTML.includes(`data-crossword-reveal-clue="${id}"`) ? across : down;
    clueRoot.listeners.get("click")({ target: { closest: () => ({ dataset: { crosswordRevealClue: id } }) } });
    assert.equal(h.progress.capture().revealedClueIds.length, 1);
    assert.match(clueRoot.innerHTML, /class="crossword-revealed-clue"/);
    const saved = JSON.parse(JSON.stringify(h.progress.capture()));
    h.progress.restore(saved); h.progress.restore(saved);
    assert.equal(h.progress.capture().revealedClueIds.length, 1);
    h.get("[data-puzzle-zoom]").click();
    assert.equal(h.sidebar.hidden, true);
    h.get("[data-crossword-toggle-solution]").click();
    assert.equal(h.get("[data-crossword-toggle-solution]").textContent, "Ocultar pistas");
    assert.equal(h.sidebar.hidden, false, "Revealing clues makes the sidebar visible even from expanded mode");
    h.get("[data-crossword-toggle-solution]").click();
    assert.equal(h.progress.capture().revealedClueIds.length, 0);
    invert.click();
    assert.equal(h.progress.capture().values["0-0"], "X");
    assert.equal(h.progress.capture().correctCells[0], "0-0");
    assert.equal(h.get("[data-crossword-check]").hidden, false);
    assert.match(h.board.innerHTML, /data-crossword-input/);
});

test("inverted clue markup escapes teacher content, including button attributes", () => {
    const h = harness("crossword");
    const entry = { id: 'id"x', number: 1, answer: '<img src=x onerror="alert(1)">', clue: '<script>alert(1)</script>' };
    const html = h.context.buildRuntimeClueMarkup([entry], new Set(), true, new Set([entry.id]));
    assert.doesNotMatch(html, /<img|<script/);
    assert.match(html, /&lt;script&gt;/); assert.match(html, /data-crossword-reveal-clue="id&quot;x"/);
});
