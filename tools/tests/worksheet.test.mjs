import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import core from "../../assets/js/worksheet-core.js";
import view from "../../assets/js/worksheet-view.js";
import discovery from "../../assets/js/discovery-core.js";
import { worksheetFixture, worksheetLargeFixture } from "../fixtures/worksheet.mjs";
import { normalizeActivityGenerationOptions } from "../../ai-service/activity-generation-policy.js";
import { validateWorksheetSource, normalizeWorksheetMaterial, worksheetCompletionTokens } from "../../ai-service/materials/worksheet.js";
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

test("one activity can use its own topic while the others preserve the general list", () => {
    const options = validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", {
        worksheetTypes: ["wordsearch", "crossword"],
        activityOptions: { wordsearch: { instructions: "Animais em inglês", count: 6 } }
    }), "went, ate, took, saw");
    const schema = schemaFor("worksheet", options).schema.properties.activities.properties;
    assert.equal(schema.wordsearch.properties.words.minItems, 6);
    assert.equal(schema.wordsearch.properties.words.items.properties.term.enum, undefined);
    assert.deepEqual(schema.crossword.properties.words.items.properties.term.enum, ["went", "ate", "took", "saw"]);
    assert.match(promptFor("worksheet", "", "went, ate, took, saw", undefined, options), /Animais em inglês/);
});

test("a grammar topic with a comma does not become an exact list", () => {
    const options = validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", {}), "Verbos em inglês no passado, irregulares.");
    assert.equal(options.inputMode, "topic");
    assert.equal(schemaFor("worksheet", options).schema.properties.activities.properties.wordtrail.properties.words.items.properties.term.enum, undefined);
    const exact = validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", { worksheetTypes: ["connections"], inputMode: "words" }), "Verbos em inglês no passado, irregulares");
    assert.equal(exact.inputMode, "words", "an explicit list mode still wins over inference");
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
test("unconnected crossword terms stay in the same exercise as compact answer lines", () => {
    const data = selected(["crossword"]);
    data.activities.crossword.words = ["AAA", "BBB", "CCC", "DDD"].map(term => ({ term, clue: "Pista" }));
    const result = view.units(data, engines, true);
    for (const word of data.activities.crossword.words) assert.match(result.units.join(""), new RegExp(`>${word.term}<`));
    assert.equal(result.units.length, 1); assert.ok(result.notices.length);
    assert.doesNotMatch(result.units[0], /<svg/);
    assert.equal((result.units[0].match(/class="worksheet-short-answer"/g) || []).length, 4);
    assert.doesNotMatch(view.units(data, engines).units[0], />AAA<|>BBB<|>CCC<|>DDD</);
});

test("paper trail groups six short words without changing presentation grouping", () => {
    const words = ["went", "ate", "saw", "took", "came", "gave"].map(term => ({ term, clue: "Uma pista longa. ".repeat(7).trim() }));
    const boards = discovery.createBoards({ words }, { print: true });
    assert.equal(boards.length, 1); assert.equal(boards[0].entries.length, 6);
    assert.equal(discovery.createBoards({ words: words.map(word => ({ ...word, clue: "Pista" })) }).length, 2);
    const data = selected(["wordtrail"]); data.activities.wordtrail.words = words;
    const rendered = view.units(data, engines, false, { trailClues: true });
    assert.equal(rendered.units.length, 1);
    assert.equal((rendered.units[0].match(/class="worksheet-answer-line"/g) || []).length, 6);
    assert.doesNotMatch(rendered.units[0], /Parte 1 de/);
});

test("print optimization joins the six irregular verbs for multiple input orders", () => {
    for (const order of [
        ["came", "gave", "took", "went", "ate", "saw"],
        ["saw", "ate", "went", "took", "gave", "came"],
        ["gave", "came", "went", "took", "saw", "ate"]
    ]) {
        const data = selected(["crossword"]);
        data.activities.crossword.words = order.map(term => ({ term, clue: "Pista" }));
        const puzzle = engines.crossword.createPuzzle({ entries: order.map(answer => ({ answer, clue: "Pista" })), size: 11, optimize: true });
        assert.equal(puzzle.placedEntries.length, 6); assert.equal(puzzle.omittedEntries.length, 0);
        const result = view.units(data, engines, true);
        assert.equal(result.units.length, 1); assert.equal(result.notices.length, 0);
        assert.equal((result.units[0].match(/<svg/g) || []).length, 1);
        for (const word of order) assert.match(result.units[0], new RegExp(`\\(${word}\\)`));
    }
});

test("grids keep 5.5mm cells, 10pt letters and padded outer borders", () => {
    const result = view.units(worksheetFixture, engines);
    for (const html of [result.units[0], result.units[2]]) {
        const svg = html.match(/style="width:([\d.]+)mm" viewBox="-1 -1 (\d+) (\d+)"/);
        assert.ok(svg);
        const width = Number(svg[1]), units = Number(svg[2]);
        const points = width / units * 19.24 * 72 / 25.4;
        assert.ok(Math.abs(points - 10) < .02);
        assert.match(html, /font-size="19.24"/);
    }
});

test("legacy wordsearch writing instructions have real answer lines", () => {
    const data = selected(["wordsearch"]);
    data.activities.wordsearch.instruction = "Circule e escreva cada verbo nas linhas.";
    assert.equal((view.units(data, engines).units[0].match(/class="worksheet-answer-line"/g) || []).length, 4);
    delete data.activities.wordsearch.instruction;
    assert.doesNotMatch(view.units(data, engines).units[0], /worksheet-answer-line/);
    assert.match(view.units(data, engines, false, { wordBank: false }).units[0], /Resolva as pistas/);
});

test("student header removes the top brand strip but keeps key identification", () => {
    const data = core.normalize(worksheetFixture);
    const student = view.pageHeader(data, {}, false), key = view.pageHeader(data, {}, true);
    assert.doesNotMatch(student, /EDUCARIA|FOLHA DE ATIVIDADES|A4|worksheet-page-kicker/);
    assert.match(student, /Nome:/); assert.match(student, /Turma:/);
    assert.match(key, /GABARITO DO PROFESSOR/); assert.doesNotMatch(key, /Nome:/);
});

test("generation respects audience and prevents answers in the heading", () => {
    const raw = selected(["connections"]);
    raw.title = "Irregular verbs – 7º Ano"; raw.subtitle = "Pratique irregular verbs.";
    const options = validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", { worksheetTypes: ["connections"] }), "verbos inglês no passado. irregulares");
    assert.equal(options.audienceProvided, false);
    const result = normalizeWorksheetMaterial(raw, options);
    assert.equal(result.title, "Atividades de aprendizagem"); assert.equal(result.subtitle, "");
    raw.title = "Prática de inglês – 7º Ano";
    assert.equal(normalizeWorksheetMaterial(raw, options).title, "Prática de inglês");
    const explicit = validateWorksheetSource({ ...options, audience: "7º ano" }, "verbos em inglês");
    assert.equal(normalizeWorksheetMaterial(raw, explicit).title, raw.title);
    assert.equal(validateWorksheetSource(options, "verbos para o 7º ano").audienceProvided, true);
    assert.equal(normalizeWorksheetMaterial(raw, options).activities.connections.instruction, core.instructions.connections);
});

test("review warns about exposed answers without changing exact teacher lists", () => {
    const data = core.normalize(worksheetFixture);
    data.title = "Irregular verbs";
    data.activities.crossword.words[0].term = data.activities.wordtrail.words[0].term;
    const snapshot = JSON.stringify(data);
    const warnings = core.qualityWarnings(data);
    assert.equal(warnings.length, 2); assert.match(warnings[1], /took/);
    assert.equal(JSON.stringify(data), snapshot);
    assert.equal(core.containsAnswer("The statement", "ate"), false);
    assert.equal(core.containsAnswer("Verbos IRREGULARES!", "verbos irregulares"), true);
});

test("worksheet generation distinguishes assessment from deliberate practice", () => {
    const options = normalizeActivityGenerationOptions("worksheet", {});
    assert.equal(options.purpose, "assessment");
    assert.throws(() => normalizeActivityGenerationOptions("worksheet", { purpose: "unknown" }));
    const prompt = promptFor("worksheet", "", "verbos", undefined, options);
    assert.match(prompt, /Avaliação|avaliação independente/); assert.match(prompt, /Não invente ano escolar/);
    assert.match(prompt, /lacuna/); assert.match(prompt, /não o próprio tema geral/);
    assert.match(promptFor("worksheet", "", "verbos", undefined, { ...options, purpose: "practice" }), /prática e revisão/);
});

test("each activity has an independent count, instruction and exact list", () => {
    const options = validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", {
        worksheetTypes: ["wordsearch", "crossword", "connections"],
        activityOptions: {
            wordsearch: { instructions: "took, came, went", count: 6 },
            crossword: { instructions: "Verbos relacionados à alimentação, com lacunas.", count: 5 },
            connections: { instructions: "Descobrir instrumentos musicais.", count: 2, clueCount: 5 }
        }, wordsearchHelp: "none", trailClues: false
    }), "Verbos irregulares em inglês");
    const schema = schemaFor("worksheet", options).schema.properties.activities.properties;
    assert.equal(schema.wordsearch.properties.words.minItems, 3);
    assert.deepEqual(schema.wordsearch.properties.words.items.properties.term.enum, ["took", "came", "went"]);
    assert.equal(schema.crossword.properties.words.minItems, 5); assert.equal(schema.crossword.properties.words.maxItems, 5);
    assert.equal(schema.connections.properties.rounds.minItems, 2);
    assert.equal(schema.connections.properties.rounds.items.properties.clues.minItems, 5);
    const prompt = promptFor("worksheet", "", "Verbos irregulares em inglês", undefined, options);
    assert.match(prompt, /somente para aquela atividade/); assert.match(prompt, /alimentação/);
    assert.match(prompt, /instrumentos musicais/); assert.match(prompt, /sem banco de palavras nem pistas/);
    const data = { activities: {
        wordsearch: { words: ["went", "took", "came"].map(term => ({ term, clue: "Pista" })) },
        crossword: { words: ["ate", "drank", "made", "bought", "had"].map(term => ({ term, clue: "Pista" })) },
        connections: { rounds: ["piano", "violino"].map(answer => ({ answer, clues: ["Uma pista", "Outra", "Terceira", "Quarta", "Quinta"], explanation: "" })) }
    } };
    assert.deepEqual(normalizeWorksheetMaterial(data, options).activities.wordsearch.words.map(word => word.term), ["took", "came", "went"]);
    data.activities.crossword.words.pop(); assert.throws(() => normalizeWorksheetMaterial(data, options), /quantidade/);
});

test("local lists override a global exact list only in their own activity", () => {
    const options = validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", {
        worksheetTypes: ["wordsearch", "crossword"], inputMode: "words", activityOptions: { crossword: { instructions: "wrote, drove, ran" } }
    }), "took, came, went");
    const schema = schemaFor("worksheet", options).schema.properties.activities.properties;
    assert.deepEqual(schema.wordsearch.properties.words.items.properties.term.enum, ["took", "came", "went"]);
    assert.deepEqual(schema.crossword.properties.words.items.properties.term.enum, ["wrote", "drove", "ran"]);
});

test("invalid per-game options and impossible lists are rejected before generation", () => {
    for (const activityOptions of [{ slides: {} }, { wordsearch: { count: 1 } }, { crossword: { count: 31 } }, { connections: { clueCount: 9 } }, { wordtrail: { count: true } }, { wordsearch: { instructions: "x".repeat(601) } }]) {
        assert.throws(() => normalizeActivityGenerationOptions("worksheet", { activityOptions }), /opções/);
    }
    assert.throws(() => validateWorksheetSource(normalizeActivityGenerationOptions("worksheet", { activityOptions: { wordsearch: { instructions: "x, y" } } }), "verbos"));
    assert.throws(() => normalizeActivityGenerationOptions("worksheet", { wordsearchHelp: "answers-in-title" }));
});

test("hidden wordsearch help stays absent from student markup and available in the key", () => {
    const data = selected(["wordsearch"]);
    const student = view.units(data, engines, false, { wordsearchHelp: "none" }).units[0];
    assert.doesNotMatch(student, /worksheet-word-bank|worksheet-clues|Passado de play|played/);
    assert.match(view.units(data, engines, true, { wordsearchHelp: "none" }).units[0], /played/);
    assert.match(view.units(data, engines, false, { wordsearchHelp: "clues" }).units[0], /Passado de play/);
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

test("thirty words and eight clues are explicit validated quantities, never silently reduced", () => {
    const activityOptions = Object.fromEntries(core.types.map(type => [type, type === "connections" ? { count: 8, clueCount: 8 } : { count: 30 }]));
    const options = normalizeActivityGenerationOptions("worksheet", { activityOptions });
    const material = normalizeWorksheetMaterial(worksheetLargeFixture, options);
    const schema = schemaFor("worksheet", options).schema.properties.activities.properties;
    for (const type of ["wordtrail", "wordsearch", "crossword"]) {
        assert.equal(schema[type].properties.words.minItems, 30);
        assert.equal(schema[type].properties.words.maxItems, 30);
        assert.equal(material.activities[type].words.length, 30);
    }
    assert.equal(schema.connections.properties.rounds.items.properties.clues.minItems, 8);
    const truncated = structuredClone(worksheetLargeFixture); truncated.activities.wordsearch.words.pop();
    assert.throws(() => normalizeWorksheetMaterial(truncated, options), /quantidade/);
});

test("large worksheets preserve every item in both layouts and share student/key geometry", () => {
    for (const columns of ["one", "two"]) for (const wordsearchHelp of ["words", "clues", "none"]) {
        const settings = { columns, wordsearchHelp, trailClues: true };
        const student = view.units(worksheetLargeFixture, engines, false, settings).units;
        const key = view.units(worksheetLargeFixture, engines, true, settings).units;
        assert.equal(student.length, key.length);
        const totals = {};
        for (let i = 0; i < student.length; i++) {
            const [, type, count] = student[i].match(/data-ws-print-type="(\w+)" data-ws-print-count="(\d+)"/);
            totals[type] = (totals[type] || 0) + Number(count);
            const geometry = html => [...html.matchAll(/<rect [^>]+>/g)].map(match => match[0]);
            assert.deepEqual(geometry(student[i]), geometry(key[i]));
        }
        assert.deepEqual(totals, { wordtrail: 30, wordsearch: 30, crossword: 30, connections: 8 });
        for (const word of worksheetLargeFixture.activities.wordtrail.words) assert.ok(key.join("").includes(`>${word.term}<`));
    }
});

test("print-only larger trail limits do not change presentation limits", () => {
    assert.throws(() => discovery.normalize("wordtrail", worksheetLargeFixture.activities.wordtrail), /12/);
    assert.equal(discovery.normalize("wordtrail", worksheetLargeFixture.activities.wordtrail, { print: true }).words.length, 30);
});

test("maximum clue lengths split large print trails without losing words", () => {
    const words = worksheetLargeFixture.activities.wordtrail.words.map(word => ({ ...word, clue: "Pista longa para conferir a distribuição e preservar a legibilidade. ".repeat(3).slice(0, 150) }));
    for (const wide of [true, false]) {
        const boards = discovery.createBoards({ words }, { print: true, wide });
        assert.equal(boards.reduce((total, board) => total + board.entries.length, 0), 30);
        assert.ok(boards.every(board => board.entries.reduce((sum, entry) => sum + entry.clue.length, 0) <= (wide ? 1000 : 750)));
    }
});

test("worksheet output budget scales with chosen quantities but obeys its ceiling", () => {
    assert.equal(worksheetCompletionTokens({ worksheetTypes: ["wordsearch"] }), 3500);
    const options = { activityOptions: Object.fromEntries(core.types.map(type => [type, { count: type === "connections" ? 8 : 30, clueCount: 8 }])) };
    assert.ok(worksheetCompletionTokens(options) > 9000);
    assert.equal(worksheetCompletionTokens(options, 3500, 5000), 5000);
    assert.equal(worksheetCompletionTokens(options, 3500, 1000), 1000);
    const exact = { worksheetTypes: ["wordsearch", "wordtrail"], inputMode: "words", answers: worksheetLargeFixture.activities.wordsearch.words.map(w => w.term) };
    assert.equal(worksheetCompletionTokens(exact), 5200);
});
