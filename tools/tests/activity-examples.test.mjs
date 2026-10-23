import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import catalog from "../../assets/js/activity-examples-catalog.js";
const read = file => fs.readFile(new URL(`../../${file}`, import.meta.url), "utf8");

test("every format has a registered example and real public destination", async () => {
    assert.deepEqual(Object.keys(catalog.tools).sort(), ["slides", "quiz", "flashcards", "memory", "wheel", "match", "mindmap", "debate", "wordsearch", "crossword", "hangman", "wordtrail", "connections", "lesson", "worksheet"].sort());
    for (const [type, tool] of Object.entries(catalog.tools)) {
        assert.ok(tool.label && tool.steps.length >= 2);
        assert.ok((await read(`plataforma/${tool.builder.split("?")[0]}`)).includes("<html"));
        if (tool.page) {
            const html = await read(`plataforma/${tool.page}`);
            assert.ok([...html.matchAll(/src="([^"]+)"/g)].some(([, url]) => catalog.scripts.has(url.split("?")[0].split("/").pop())));
            const example = catalog.draft(type);
            assert.ok(example.controls && example.stackHtml.length > 80, `${type}: needs demo content`);
            assert.doesNotMatch(example.stackHtml, /<script|onerror=|onclick=|https?:/i);
            assert.deepEqual(catalog.draft(type), example, `${type}: fixtures must be repeatable`);
        }
        for (const step of tool.steps) assert.ok(step.text && step.delay >= 3000, "Give teachers time to read each caption");
    }
});
test("example frames stay isolated from real accounts, storage and AI", async () => {
    const source = await read("assets/js/activity-examples.js");
    assert.match(source, /setAttribute\("sandbox", "allow-scripts"\)/);
    assert.doesNotMatch(source, /allow-same-origin|localStorage|sessionStorage|\/api\//);
    assert.match(source, /connect-src 'none'/);
    assert.match(source, /event.source !== frame.contentWindow/);
    assert.match(source, /event.data.instance !== instance/);
    assert.match(source, /prefers-reduced-motion/);
    assert.match(source, /AbortController/);
    assert.match(source, /frame\?\.remove\(\)/);
    for (const script of catalog.scripts) assert.doesNotMatch(script, /auth|firebase|storage|persistence|generator|offline/);
    const bootstrap = await read("assets/js/activity-example-frame.js");
    assert.match(bootstrap, /new Map/);
    assert.match(bootstrap, /Object.defineProperty\(window, "localStorage"/);
    assert.match(bootstrap, /event.source !== parent/);
});
test("entry points do not create nested interactive links or alter the current prompt", async () => {
    const dashboard = await read("plataforma/index.html");
    const print = await read("plataforma/folha-atividades-builder.html");
    assert.match(dashboard, /data-activity-example="selected"/);
    assert.match(print, /data-activity-example="worksheet"/);
    const source = await read("assets/js/activity-examples.js");
    assert.match(source, /wrapper.append\(button\)/);
    assert.match(source, /select.dispatchEvent/);
    assert.doesNotMatch(source, /quick-topic[^\n]*\.value\s*=/);
});
test("print sample covers every printable activity and lesson uses a coherent sequence", () => {
    assert.deepEqual(catalog.worksheet.order, ["wordtrail", "wordsearch", "crossword", "connections"]);
    assert.deepEqual(catalog.tools.lesson.sequence, ["slides", "quiz", "mindmap"]);
    assert.equal(catalog.escape('<script>"&'), "&lt;script&gt;&quot;&amp;");
});
