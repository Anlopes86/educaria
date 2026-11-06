import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

async function readConfig(file, start, end, expression) {
    const source = await fs.readFile(new URL(`../../assets/js/${file}`, import.meta.url), "utf8");
    const first = source.indexOf(start), last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `Configuration block exists in ${file}`);
    return JSON.parse(vm.runInNewContext(`${source.slice(first, last)}; JSON.stringify(${expression})`));
}

const newer = ["wordtrail", "connections"];
const existingExtras = ["flashcards", "memory", "wheel", "match", "mindmap", "debate", "wordsearch", "crossword", "hangman"];

test("dashboard creation selector and cards keep the two new activities last", async () => {
    const config = await readConfig("teacher-dashboard.js", "const DASHBOARD_CORE_FORMATS", "const DASHBOARD_QUICK_OPTION_CONFIGS", "({ cards: DASHBOARD_EXTRA_FORMATS, selector: DASHBOARD_QUICK_CREATE_FORMATS })");
    assert.deepEqual(config.cards.map(item => item.materialType), [...existingExtras, ...newer]);
    assert.deepEqual(config.selector.map(item => item.materialType), ["slides", "quiz", ...existingExtras, ...newer]);
});

test("the sidebar uses the dashboard creator instead of maintaining another activity order", async () => {
    const source = await fs.readFile(new URL("../../assets/js/app-sidebar.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /const SIDEBAR_FORMATS|function renderSidebarFormats/);
    assert.match(source, /link\.setAttribute\("href", "index\.html#quick-ai-create"\)/);
    const dashboard = await fs.readFile(new URL("../../plataforma/index.html", import.meta.url), "utf8");
    assert.match(dashboard, /href="folha-atividades-builder\.html\?new=1"/);
});

test("complete lesson tool picker keeps its existing order and appends the new activities", async () => {
    const config = await readConfig("lesson-sequence-builder.js", "const LESSON_SEQUENCE_TYPES", "const INLINE_BLOCK_EDITOR_CONFIG", "LESSON_SEQUENCE_TYPES");
    assert.deepEqual(config.map(item => item.value), ["slides", "flashcards", "quiz", "memory", "match", "wheel", "mindmap", "debate", "hangman", "crossword", "wordsearch", ...newer]);
});
