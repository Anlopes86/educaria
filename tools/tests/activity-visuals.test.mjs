import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = path => fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(await read("assets/js/activity-visuals.js"), context);
const visual = context.EducariaVisuals;
const plain = value => JSON.parse(JSON.stringify(value));

test("legacy slide defaults receive the landing palette without altering content or saved state", () => {
    const old = Object.freeze({ slideColor: "#102a43", textColor: "#f8fafc", accentColor: "#2dd4bf", title: "Meu slide", body: "Texto completo", imageUrl: "data:image/png;base64,AA==" });
    const next = visual.slide(old);
    assert.equal(next.slideColor, "#153c41");
    assert.equal(next.textColor, "#f8f9ec");
    assert.equal(next.body, old.body);
    assert.equal(next.imageUrl, old.imageUrl);
    assert.equal(old.slideColor, "#102a43");
    assert.notEqual(next, old);
});
test("custom colours and AI themes are preserved, including partial changes to a default", () => {
    for (const slideColor of ["#eeccaa", "#102a43"]) {
        const custom = { slideColor, textColor: "#ffffff", accentColor: "#2dd4bf" };
        assert.deepEqual(plain(visual.slide(custom)), custom);
    }
    const custom = { frontColor: "#e0f7f1", backColor: "#dbeafe", textColor: "#0f172a" };
    assert.deepEqual(plain(visual.flashcard(custom)), custom);
});
test("flashcard defaults use lilac and cream; text, notes and source remain intact", () => {
    const old = Object.freeze({ frontColor: "#FFFFFF", backColor: "#DBEAFE", textColor: "#0F172A", front: "1", back: "English interview", example: "Anotações completas" });
    const next = visual.flashcard(old);
    assert.equal(next.frontColor, "#e1d7f0");
    assert.equal(next.backColor, "#fffaf1");
    assert.equal(next.textColor, "#463563");
    assert.equal(next.example, old.example);
    assert.equal(old.frontColor, "#FFFFFF");
});
test("wheel uses soft colours without changing numbering, ordering or custom monochrome", () => {
    const segments = Object.freeze([Object.freeze({ color: "#22c55e", text: "Um", index: 2 }), Object.freeze({ color: "#0ea5e9", text: "Dois", index: 8 })]);
    const result = visual.wheel(segments);
    assert.deepEqual(plain(result), [{ color: "#a9d6c7", text: "Um", index: 2 }, { color: "#b4cce5", text: "Dois", index: 8 }]);
    assert.equal(segments[0].color, "#22c55e");
    assert.equal(visual.wheel([segments[1]], segments)[0].color, "#b4cce5");
    const mono = [{ color: "#22c55e" }, { color: "#22c55e" }];
    assert.deepEqual(plain(visual.wheel(mono)), mono);
    const custom = [{ color: "#123456" }, { color: "#22c55e" }];
    assert.deepEqual(plain(visual.wheel(custom)), custom);
});
test("the wheel keeps original numbers when items have been eliminated", async () => {
    const source = await read("assets/js/wheel-runtime.js");
    const scope = vm.createContext({ escapeWheelText: value => String(value) });
    vm.runInContext(source.slice(source.indexOf("function buildWheelLabels("), source.indexOf("function renderWheelApplication(")), scope);
    const html = scope.buildWheelLabels([{ text: "A", index: 3 }, { text: "B", index: 9 }]);
    assert.match(html, /is-number/);
    assert.match(html, />\s*4\s*<\/div>/);
    assert.match(html, />\s*10\s*<\/div>/);
});
test("palette helpers load before their consumers, including editor previews", async () => {
    for (const name of ["apresentacao", "flashcards-apresentacao", "roleta-apresentacao", "slides-builder", "flashcards-builder", "roleta-builder"]) {
        const html = await read(`plataforma/${name}.html`);
        const helper = html.indexOf("/activity-visuals.js");
        const consumer = html.search(/\/(?:presentation-runtime|flashcards-runtime|wheel-runtime|live-preview|wheel-builder)\.js/);
        assert.ok(helper > 0 && helper < consumer, `${name}: helper must load first`);
        assert.equal(html.match(/activity-visuals\.js/g).length, 1);
    }
});
test("every activity shares the visual stylesheet; memory still labels closed and open cards", async () => {
    const stylesheet = await read("assets/css/components/activity-visual-system.css");
    for (const type of ["slides", "quiz", "flashcards", "memory", "wheel", "mindmap", "match", "debate", "wordsearch", "crossword", "hangman", "lesson"]) assert.ok(stylesheet.includes(`[data-material-type="${type}"]`), type);
    const memory = await read("assets/js/memory-runtime.js");
    assert.match(memory, /memory-tile-number/);
    assert.match(memory, /index \+ 1/);
    const global = await read("assets/css/estilo-premium.css");
    assert.match(global, /activity-visual-system\.css\?v=20261011-2/);
});
