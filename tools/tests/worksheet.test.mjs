import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import core from "../../assets/js/worksheet-core.js";
import view from "../../assets/js/worksheet-view.js";
import discovery from "../../assets/js/discovery-core.js";
import { worksheetFixture } from "../fixtures/worksheet.mjs";
import { normalizeActivityGenerationOptions } from "../../ai-service/activity-generation-policy.js";
import { validateWorksheetSource, normalizeWorksheetMaterial } from "../../ai-service/materials/worksheet.js";
import { schemaFor } from "../../ai-service/materials/schemas.js";
import { promptFor } from "../../ai-service/materials/prompts.js";

const context = vm.createContext({ window: {} });
for (const name of ["wordsearch", "crossword"]) vm.runInContext(await fs.readFile(new URL(`../../assets/js/${name}-core.js`, import.meta.url), "utf8"), context);
const engines = { discovery, wordsearch: context.window.EducarIAWordsearch, crossword: context.window.EducarIACrossword };
const selected = types => ({ ...structuredClone(worksheetFixture), activities: Object.fromEntries(types.map(type => [type, structuredClone(worksheetFixture.activities[type])])) });

test("worksheet validates exactly the selected print-compatible formats", () => {
    assert.deepEqual(core.normalize(worksheetFixture).order, core.types);
    for (const types of [[], ["slides"], ["quiz"], ["wordtrail", "wordtrail"], ["__proto__"]]) assert.throws(() => core.selection(types));
    assert.throws(() => core.normalize(worksheetFixture, ["wordtrail"]));
    assert.deepEqual(core.normalize(selected(["crossword", "wordtrail"])).order, ["crossword", "wordtrail"]);
});
test("worksheet checks words, clues and printable limits", () => {
    for (const term of ["a", "H2O", "a".repeat(19), "<script>"]) {
        const data = selected(["wordtrail"]); data.activities.wordtrail.words[0].term = term;
        assert.throws(() => core.normalize(data));
    }
    const long = selected(["crossword"]); long.activities.crossword.words[0].term = "a".repeat(18);
    assert.throws(() => core.normalize(long), /17 letras/);
    const missing = selected(["crossword"]); missing.activities.crossword.words[0].clue = "";
    assert.throws(() => core.normalize(missing));
    const duplicate = selected(["wordtrail"]); duplicate.activities.wordtrail.words[1].term = "TOOK";
    assert.throws(() => core.normalize(duplicate), /repetida/);
});
test("worksheet schema is dynamic, strict and preserves selected order", () => {
    const options = normalizeActivityGenerationOptions("worksheet", { worksheetTypes: ["crossword", "wordtrail"], pageMode: "roomy", difficulty: "hard" });
    const schema = schemaFor("worksheet", options).schema.properties.activities;
    assert.deepEqual(schema.required, ["crossword", "wordtrail"]);
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.wordtrail.properties.words.maxItems, 6);
    assert.throws(() => normalizeActivityGenerationOptions("worksheet", { worksheetTypes: ["quiz"] }));
    assert.throws(() => normalizeActivityGenerationOptions("worksheet", { pageMode: "tiny" }));
    const prompt = promptFor("worksheet", "Meu pedido", "verbos em inglês no passado", undefined, options);
    assert.match(prompt, /duas colunas/); assert.match(prompt, /Meu pedido/); assert.match(prompt, /verbos em inglês no passado/);
});
test("exact lists are not translated or substituted and topics remain topics", () => {
    const options = validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", {}), "took, came, began, drove e went");
    assert.deepEqual(options.answers, ["took", "came", "began", "drove", "went"]);
    assert.equal(options.count, null);
    assert.equal(validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", {}), "palavras em inglês no passado").inputMode, "topic");
    const activities = Object.fromEntries(core.types.map(type => [type, type === "connections"
        ? { rounds: options.answers.map(answer => ({ answer, clues: ["Pista inicial", "Outra pista", "Pista final"] })) }
        : { words: options.answers.map(term => ({ term, clue: "Pista" })) }]));
    assert.deepEqual(normalizeWorksheetMaterial({ activities }, options).activities.wordtrail.words.map(w => w.term), options.answers);
    activities.wordtrail.words[0].term = "pegou";
    assert.throws(() => normalizeWorksheetMaterial({ activities }, options), /alterou palavras/);
    assert.deepEqual(schemaFor("worksheet", options).schema.properties.activities.properties.crossword.properties.words.items.properties.term.enum, options.answers);
    assert.throws(() => validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", {}), "um, um"));
});
test("connections-only worksheets accept one long category without imposing grid limits", () => {
    const options = normalizeActivityGenerationOptions("worksheet", { worksheetTypes: ["connections"], inputMode: "words" });
    assert.deepEqual(validateWorksheetSource(options, "Planetas do Sistema Solar").answers, ["Planetas do Sistema Solar"]);
});

test("provider outputs must also respect compact quantities and clue counts", () => {
    const options = normalizeActivityGenerationOptions("worksheet", { worksheetTypes: ["connections"], pageMode: "compact" });
    const data = selected(["connections"]);
    assert.equal(normalizeWorksheetMaterial(data, options).activities.connections.rounds.length, 1);
    data.activities.connections.rounds.push(structuredClone(data.activities.connections.rounds[0]));
    assert.throws(() => normalizeWorksheetMaterial(data, options), /quantidade/);
    data.activities.connections.rounds.pop(); data.activities.connections.rounds[0].clues.pop();
    assert.throws(() => normalizeWorksheetMaterial(data, options), /3 a 4 pistas/);
});
test("student markup has no hidden solution; answer key uses the same deterministic boards", () => {
    const student = view.units(worksheetFixture, engines, false, { trailClues: true });
    const key = view.units(worksheetFixture, engines, true, { trailClues: true });
    assert.equal(student.units.length, 4); assert.equal(key.units.length, 4);
    assert.doesNotMatch(student.units.join(""), /polyline|Irregular verbs|São verbos irregulares/);
    assert.match(key.units.join(""), /polyline|Irregular verbs/);
    assert.match(student.units[0], /Palavras encontradas/);
    assert.equal((student.units[0].match(/class="worksheet-answer-line"/g) || []).length, 4);
    assert.match(key.units[0], />took</);
    const geometry = html => [...html.matchAll(/<rect [^>]+>/g)].map(match => match[0]);
    for (let i = 0; i < 4; i++) assert.deepEqual(geometry(student.units[i]), geometry(key.units[i]));
    assert.deepEqual(view.units(worksheetFixture, engines, false, { trailClues: true }), student);
});
test("word bank and trail clues can be hidden independently", () => {
    const html = view.units(worksheetFixture, engines, false, { wordBank: false, trailClues: false }).units;
    assert.doesNotMatch(html[0], /Passado de take/);
    assert.doesNotMatch(html[2], /worksheet-word-bank/);
    assert.match(html[2], /Passado de play/);
});
test("unconnected crossword terms are distributed without silently omitting answers", () => {
    const data = selected(["crossword"]);
    data.activities.crossword.words = ["AAA", "BBB", "CCC", "DDD"].map(term => ({ term, clue: "Pista" }));
    const result = view.units(data, engines, true);
    for (const word of data.activities.crossword.words) assert.match(result.units.join(""), new RegExp(`\\(${word.term}\\)`));
    assert.equal(result.units.length, 4); assert.ok(result.notices.length);
});

test("long terms request full-width rows instead of shrinking a dense grid into a narrow column", () => {
    const data = selected(["wordsearch"]);
    data.activities.wordsearch.words = ["internacional", "responsabilidade"].map(term => ({ term, clue: "Pista" }));
    const result = view.units(data, engines, true);
    assert.match(result.units[0], /worksheet-grid-wide/);
    assert.match(result.units[0], /internacional/); assert.match(result.units[0], /responsabilidade/);
});
test("all content is escaped in editor, print and headers", () => {
    const data = core.normalize(worksheetFixture); data.title = "<img src=x onerror=alert(1)>";
    data.activities.connections.rounds[0].clues[0] = "<script>alert(1)</script>";
    data.activities.wordtrail.words[0].clue = '" onmouseover="alert(1)';
    const html = core.stackHtml(data) + view.units(data, engines).units.join("") + view.pageHeader(data, { school: "<script>" }, false);
    assert.doesNotMatch(html, /<script>|<img src=x|value="" onmouseover/);
    assert.match(html, /&lt;script&gt;/);
});
