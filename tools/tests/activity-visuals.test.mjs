import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = path => fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(await read("assets/js/activity-visuals.js"), context);
const visual = context.EducariaVisuals;
const plain = value => JSON.parse(JSON.stringify(value));

test("fresh editor imports enforce wheel and matching defaults even with an older AI response", async () => {
    const source = await read("assets/js/ai-material-generator.js");
    for (const [type, functionName, arrayKey] of [["wheel", "applyWheelFromStructuredData", "segments"], ["match", "applyMatchFromStructuredData", "pairs"]]) {
        const fields = new Map();
        const field = key => { if (!fields.has(key)) fields.set(key, { value: "" }); return fields.get(key); };
        const cards = Array.from({length:8}, (_,i) => ({ querySelector: selector => field(`${i}:${selector}`) }));
        const scope = vm.createContext({ document: { getElementById: field }, ensureCardCount: () => cards, dispatchBuilderContentChange() {} });
        const start = source.indexOf(`function ${functionName}(`);
        vm.runInContext(source.slice(start, source.indexOf("\nfunction ", start+1)), scope);
        const items = cards.map((_,i) => ({ text:`Espaço ${i+1}`, left:`Item ${i+1}`, right:`Resposta ${i+1}`, color:"#ff0000" }));
        assert.equal(scope[functionName]({ [arrayKey]: items, shuffle_right: true }), true);
        const colors = cards.map((_,i) => field(`${i}:[data-${type}-color]`).value);
        if (type === "wheel") {
            assert.equal(new Set(colors).size, 6);
            assert.equal(colors[0], "#a9d6c7"); assert.equal(colors[6], colors[0]);
            assert.equal(field("7:[data-wheel-text]").value, "Espaço 8");
        } else {
            assert.deepEqual(colors, Array(8).fill("#527f8c"));
            assert.equal(field("ligar-cores").value, "same");
            assert.equal(field("ligar-cor-unica").value, "#527f8c");
            assert.equal(field("ligar-embaralhar").value, "Sim");
        }
    }
});

test("blank matching and wheel editors share the generation defaults", async () => {
    const match = await read("plataforma/ligar-pontos-builder.html");
    assert.match(match, /<option value="same" selected>/);
    const wheel = await read("plataforma/roleta-builder.html");
    const colors = [...wheel.matchAll(/data-wheel-color type="color" value="(#[a-f0-9]{6})"/g)].map(m => m[1]);
    assert.deepEqual(colors, ["#a9d6c7", "#b4cce5", "#e9bc77", "#e9a78e", "#c2b5df", "#b9d9bd", "#a9d6c7", "#b4cce5"]);
});

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

test("explicit slide palettes are not silently migrated even on an exact legacy colour match", () => {
    for (const visualMode of ["ai", "manual", "standard"]) {
        const selected = { slideColor: "#102a43", textColor: "#f8fafc", accentColor: "#2dd4bf", visualMode };
        assert.deepEqual(plain(visual.slide(selected)), selected);
    }
});

test("compositions adapt to content without altering old decks, image placement or text", () => {
    assert.equal(visual.slideComposition({ body: "Texto antigo" }), "classic");
    assert.equal(visual.slideComposition({ composition: "<script>" }), "classic");
    assert.equal(visual.slideComposition({ composition: "focus", body: "Uma pergunta?" }), "focus");
    assert.equal(visual.slideComposition({ composition: "panels", body: "Antes\nDepois" }), "panels");
    const image = Object.freeze({ composition: "focus", body: "Texto", imageUrl: "foto.png" });
    assert.equal(visual.slideComposition(image), "editorial");
    assert.equal(image.composition, "focus");
    for (const composition of ["focus", "panels"]) {
        assert.equal(visual.slideComposition({ composition, body: "explicação completa ".repeat(80) }), "editorial");
        assert.equal(visual.slideComposition({ composition, body: "item\n".repeat(5) }), "editorial");
    }
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
    assert.match(global, /activity-visual-system\.css\?v=\d{8}-\d+/);
});
