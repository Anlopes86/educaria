import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import layout from "../../assets/js/worksheet-layout.js";

const item = (half, full, readable = true) => ({ half: { height: half, readable }, full: { height: full, readable: true } });
const space = { pageHeight: 900, remaining: 900, gap: 20 };

test("automatic layout pairs compact measured blocks, not a fixed number of words", () => {
    assert.equal(layout.useTwoColumns(item(250, 200), item(230, 180), space), true);
    assert.equal(layout.useTwoColumns(item(250, 200), null, space), false);
});

test("automatic layout gives grids and writing space full width rather than shrinking them", () => {
    assert.equal(layout.useTwoColumns(item(200, 190, false), item(200, 190), space), false);
    assert.equal(layout.useTwoColumns(item(200, 190), item(200, 190, false), space), false);
});

test("long text and inefficient pairings get full width", () => {
    assert.equal(layout.useTwoColumns(item(400, 200), item(350, 350), space), false);
    assert.equal(layout.useTwoColumns(item(400, 260), item(50, 50), space), false);
    assert.equal(layout.useTwoColumns(item(950, 800), item(200, 200), space), false);
});

test("automatic layout uses remaining page space without moving activities out of order", () => {
    assert.equal(layout.useTwoColumns(item(300, 200), item(300, 250), { ...space, remaining: 220 }), false);
    assert.equal(layout.useTwoColumns(item(300, 200), item(300, 250), { ...space, remaining: 100 }), true);
});

test("automatic is the new sheet default while manual modes keep their saved values", async () => {
    const html = await fs.readFile(new URL("../../plataforma/folha-atividades-builder.html", import.meta.url), "utf8");
    const options = html.match(/id="worksheet-columns">([\s\S]*?)<\/select>/)[1];
    assert.match(options, /^<option value="auto">/);
    assert.match(options, /value="one"/); assert.match(options, /value="two"/);
    assert.ok(html.indexOf("worksheet-layout.js") < html.indexOf("worksheet-builder.js"));
    const source = await fs.readFile(new URL("../../assets/js/worksheet-builder.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /\$\("#worksheet-columns"\)\.value\s*=(?!=)/, "do not overwrite a saved manual choice");
    const generation = source.slice(source.indexOf("function generationOptions()"), source.indexOf("function restoreGenerationOptions"));
    assert.doesNotMatch(generation, /columns/, "layout is local and does not change an AI request");
});
