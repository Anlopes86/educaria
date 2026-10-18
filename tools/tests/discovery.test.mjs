import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import core from "../../assets/js/discovery-core.js";
import { normalizeDiscoveryMaterial, validateDiscoverySource } from "../../ai-service/materials/discovery.js";
import { normalizeActivityGenerationOptions, activityGenerationInstructions } from "../../ai-service/activity-generation-policy.js";
import { schemaFor } from "../../ai-service/materials/schemas.js";
import { promptFor } from "../../ai-service/materials/prompts.js";
import { isPublicFile } from "../build-pages.mjs";

const trail = { title: "Descobertas", subtitle: "Conecte as letras", words: [
    { term: "Água", clue: "Essencial à vida" }, { term: "Coração", clue: "Bombeia sangue" },
    { term: "Luz", clue: "Permite enxergar" }, { term: "Terra", clue: "Nosso planeta" },
    { term: "Lua", clue: "Satélite natural" }, { term: "Ar", clue: "Mistura de gases" }
] };
const connections = { title: "Conecte as pistas", rounds: [
    { answer: "Estados físicos da água", clues: ["Gelo", "Vapor", "Água líquida"], explanation: "São exemplos de água nos estados sólido, gasoso e líquido." },
    { answer: "Planetas", clues: ["Vênus", "Marte", "Terra", "Saturno"], explanation: "Todos orbitam o Sol." }
] };

test("discovery contracts preserve accents and reject unusable content", () => {
    assert.equal(core.normalize("wordtrail", trail).words[0].term, "Água");
    assert.equal(core.clean("Guarda-chuva"), "GUARDACHUVA");
    for (const words of [[], [{ term: "Sol" }], [{ term: "Água" }, { term: "agua" }], [{ term: "a" }, { term: "Sol" }], [{ term: "H2O" }, { term: "Sol" }], [{ term: "a".repeat(19) }, { term: "Sol" }]]) {
        assert.throws(() => core.normalize("wordtrail", { words }), { code: "invalid_discovery_material" });
    }
    for (const clues of [["A"], ["A", "a", "C"], Array.from({ length: 9 }, (_, i) => String(i)), ["A".repeat(101), "B", "C"]]) {
        assert.throws(() => core.normalize("connections", { rounds: [{ answer: "Resposta", clues }] }));
    }
    assert.throws(() => core.normalize("connections", { rounds: [{ clues: ["A", "B", "C"] }] }));
    assert.throws(() => core.normalize("other", trail));
});

test("boards are deterministic, solvable, bounded and never drop a supplied word", () => {
    for (let n = 2; n <= 12; n++) {
        for (let sample = 0; sample < 15; sample++) {
            const words = Array.from({ length: n }, (_, i) => ({ term: String.fromCharCode(65 + i) + "a".repeat(1 + (sample * 7 + i * 3) % 17) }));
            const boards = core.createBoards({ words });
            assert.deepEqual(boards, core.createBoards({ words }));
            assert.deepEqual(boards.flatMap(b => b.entries.map(e => e.term)), words.map(w => w.term));
            for (const board of boards) {
                assert.ok(board.cols <= 8 && board.rows <= 8);
                assert.ok(board.entries.length <= 4);
                const occupied = new Set();
                board.entries.forEach((entry, i) => {
                    assert.equal(core.matchPath(board, entry.path), i);
                    assert.equal(core.matchPath(board, [...entry.path].reverse()), i);
                    assert.equal(core.matchPath(board, entry.path.slice(1)), -1);
                    assert.equal(entry.path.map(p => board.cells[p].letter).join(""), core.clean(entry.term));
                    entry.path.forEach((p, offset) => {
                        assert.ok(!occupied.has(p)); occupied.add(p);
                        if (offset) assert.ok(core.adjacent(entry.path[offset - 1], p, board.cols));
                    });
                });
                assert.equal(occupied.size, board.cells.filter(Boolean).length);
            }
        }
    }
});

test("adjacency rejects diagonals and row wrapping", () => {
    assert.equal(core.adjacent(0, 1, 4), true);
    assert.equal(core.adjacent(0, 4, 4), true);
    assert.equal(core.adjacent(0, 5, 4), false);
    assert.equal(core.adjacent(3, 4, 4), false);
});

test("long clues receive their own board without losing teacher content", () => {
    const words = trail.words.map((word, index) => ({ ...word, clue: index === 2 || index === 4 ? "Explicação detalhada para a turma. ".repeat(5).trim() : word.clue }));
    const boards = core.createBoards({ ...trail, words });
    assert.deepEqual(boards.flatMap(board => board.entries.map(({ term, clue }) => ({ term, clue }))), words);
    for (const board of boards) {
        if (board.entries.some(entry => entry.clue.length > 80)) assert.equal(board.entries.length, 1);
        for (const entry of board.entries) assert.ok(core.matchPath(board, entry.path) >= 0);
    }
});

test("list mode preserves teacher spelling and cancels generic count instructions", () => {
    const options = normalizeActivityGenerationOptions("wordtrail", { inputMode: "words", count: 8 });
    assert.equal(options.count, null);
    assert.doesNotMatch(activityGenerationInstructions("wordtrail", options), /Gere exatamente 8/);
    validateDiscoverySource("wordtrail", options, "Água;Luz");
    const result = normalizeDiscoveryMaterial("wordtrail", { ...trail, words: [trail.words[0], trail.words[2]] }, options, "Luz;Água");
    assert.deepEqual(result.words.map(w => w.term), ["Luz", "Água"]);
    assert.equal(result.words[0].clue, "Permite enxergar");
    assert.throws(() => normalizeDiscoveryMaterial("wordtrail", trail, options, "Luz;Água"), /não preservou/);
    assert.throws(() => validateDiscoverySource("wordtrail", options, "Água\nagua"));
    assert.throws(() => validateDiscoverySource("connections", options, "Um;um"));
});

test("connections lists preserve teacher answers rather than treating them as clues", () => {
    const source = "Estados físicos da água;Planetas";
    validateDiscoverySource("connections", { inputMode: "words" }, source);
    assert.deepEqual(normalizeDiscoveryMaterial("connections", connections, { inputMode: "words" }, source), core.normalize("connections", connections));
    for (const material of [
        { ...connections, rounds: connections.rounds.slice(0, 1) },
        { ...connections, rounds: [...connections.rounds, connections.rounds[0]] },
        { rounds: [{ answer: "Inventada", clues: ["Gelo", "Vapor", "Sol"] }] }
    ]) assert.throws(() => normalizeDiscoveryMaterial("connections", material, { inputMode: "words" }, source));
    const reordered = { rounds: [...connections.rounds].reverse().map(round => ({ ...round, answer: round.answer.toUpperCase() })) };
    assert.deepEqual(normalizeDiscoveryMaterial("connections", reordered, { inputMode: "words" }, source).rounds, connections.rounds);
    validateDiscoverySource("connections", { inputMode: "words" }, "Sistema Solar");
    assert.throws(() => validateDiscoverySource("connections", { inputMode: "words" }, Array.from({ length: 9 }, (_, i) => `Resposta ${i}`).join(";")));
});

test("clue counts, difficulty and hidden trail clues reach generation and validation", () => {
    for (const clueCount of [2, 3, 5, 6, 8]) {
        const options = normalizeActivityGenerationOptions("connections", { clueCount, difficulty: "hard", inputMode: "words" });
        const material = { rounds: [{ answer: "Água", clues: Array.from({ length: clueCount }, (_, i) => `Pista ${i + 1}`) }] };
        assert.equal(normalizeDiscoveryMaterial("connections", material, options, "Água").rounds[0].clues.length, clueCount);
        const schema = schemaFor("connections", options).schema.properties.rounds.items.properties.clues;
        assert.equal(schema.minItems, clueCount); assert.equal(schema.maxItems, clueCount);
        assert.match(activityGenerationInstructions("connections", options), new RegExp(`EXATAMENTE ${clueCount}`));
        assert.match(activityGenerationInstructions("connections", options), /DIFICULDADE DIFÍCIL/);
        assert.match(activityGenerationInstructions("connections", options), /RESPOSTA.*NÃO uma pista/);
        assert.throws(() => normalizeDiscoveryMaterial("connections", material, { ...options, clueCount: clueCount === 2 ? 3 : 2 }, "Água"));
    }
    for (const [difficulty, label] of [["easy", "FÁCIL"], ["medium", "MÉDIA"], ["hard", "DIFÍCIL"]]) {
        assert.match(activityGenerationInstructions("connections", normalizeActivityGenerationOptions("connections", { difficulty })), new RegExp(`DIFICULDADE ${label}`));
    }
    for (const raw of [{ clueCount: 1 }, { clueCount: 9 }, { clueCount: 2.5 }, { clueCount: [] }, { difficulty: "unknown" }]) assert.throws(() => normalizeActivityGenerationOptions("connections", raw));
    assert.equal(schemaFor("connections").schema.properties.rounds.items.properties.clues.minItems, 2);
    const withoutClues = normalizeActivityGenerationOptions("wordtrail", { includeClues: "false" });
    assert.match(activityGenerationInstructions("wordtrail", withoutClues), /SEM PISTAS/);
    const hidden = normalizeDiscoveryMaterial("wordtrail", trail, withoutClues);
    assert.equal(hidden.showClues, false); assert.ok(hidden.words.every(word => word.clue === ""));
    assert.equal(core.normalize("wordtrail", trail).showClues, true);
    assert.deepEqual(core.normalize("wordtrail", { ...trail, showClues: false }).words, trail.words);
});

test("click and drag traces keep adjacency, undo and reverse-path behavior", () => {
    const board = { cols: 3, cells: [{}, {}, {}, {}, null, {}, {}, {}, {}] };
    assert.deepEqual(core.advancePath(board, [], 0).path, [0]);
    assert.deepEqual(core.advancePath(board, [0, 1], 1).path, [0]);
    assert.deepEqual(core.advancePath(board, [0, 1], 1, true).path, [0, 1]);
    assert.deepEqual(core.advancePath(board, [0, 1], 0, true).path, [0]);
    assert.deepEqual(core.advancePath(board, [0, 1], 2, true).path, [0, 1, 2]);
    assert.equal(core.advancePath(board, [0], 4, true).error, "blocked");
    assert.equal(core.advancePath(board, [0], 2, true).error, "distant");
    assert.equal(core.advancePath(board, [0, 1, 2], 0, true).error, "repeated");
    assert.equal(core.advancePath(board, [2], 3, true).error, "distant");
});

test("clue pages adapt to short lesson frames without dropping clues", () => {
    const clues = Array.from({ length: 8 }, () => "Pista educativa com uma descrição de até cinquenta letras.");
    assert.equal(core.cluePageSize(clues, 941, 218), 4);
    assert.equal(core.cluePageSize(clues, 941, 400), 8);
    assert.equal(core.cluePageSize(["Marte", "Vênus"], 941, 218), 2);
    for (const count of [2, 3, 5, 6, 8]) {
        for (const height of [120, 218, 350, 650]) {
            const entries = Array.from({ length: count }, (_, i) => `${i} ${"Palavra ".repeat(12)}`);
            const size = core.cluePageSize(entries, 941, height);
            assert.ok(size >= 1 && size <= count);
            assert.deepEqual(Array.from({ length: Math.ceil(count / size) }, (_, page) => entries.slice(page * size, (page + 1) * size)).flat(), entries);
        }
    }
});

test("both formats use registered schemas, audience guidance and plain-text prompts", () => {
    for (const type of core.types) {
        const schema = schemaFor(type);
        assert.ok(schema.schema);
        assert.equal(schema.schema.additionalProperties, false);
        const options = normalizeActivityGenerationOptions(type, { audience: "6º ano", count: type === "wordtrail" ? 6 : 3 });
        const prompt = promptFor(type, "Revisar", "Ciências", undefined, options);
        assert.match(prompt, /6º ano/);
        assert.match(prompt, /sem HTML/i);
        assert.match(prompt, /não.*revelar respostas/i);
    }
    assert.throws(() => normalizeActivityGenerationOptions("connections", { count: 9 }));
    assert.throws(() => normalizeActivityGenerationOptions("wordtrail", { inputMode: "unknown" }));
});

test("saved card HTML escapes teacher content and accepts incomplete manual drafts", () => {
    const html = core.stackHtml("connections", { rounds: [{ answer: '<img src=x onerror="alert(1)">', clues: ["A&B", "<script>", "C"], explanation: "</textarea>" }] });
    assert.doesNotMatch(html, /<img|<script>/);
    assert.match(html, /&lt;img/);
    assert.match(html, /A&amp;B/);
    assert.equal((html.match(/<\/textarea>/g) || []).length, 2);
    assert.match(core.stackHtml("wordtrail", { words: [{ term: "", clue: "" }] }, true), /data-discovery-term/);
});

const sources = Object.fromEntries(await Promise.all(["material-context", "lesson-sequence-builder", "ai-material-generator", "local-persistence", "generation-recovery", "teacher-dashboard", "lesson-library", "builder-journey"].map(async name => [name, await fs.readFile(new URL(`../../assets/js/${name}.js`, import.meta.url), "utf8")])));
test("new formats have isolated routes and do not fall through to slides", () => {
    const context = vm.createContext({ document: { addEventListener() {} }, window: {}, educariaScopedKey: key => `${key}:teacher` });
    vm.runInContext(sources["material-context"], context);
    for (const type of core.types) {
        assert.equal(context.draftStorageKeyForType(type), `educaria:builder:${type}:teacher`);
        assert.equal(context.presentationPathForMaterial(type), `${core.slugs[type]}-apresentacao.html`);
        assert.equal(context.normalizeMaterialType(core.slugs[type]), type);
        assert.equal(context.presentationLabelForMaterial(type), core.labels[type]);
        for (const name of ["generation-recovery", "teacher-dashboard", "lesson-library", "builder-journey"]) assert.ok(sources[name].includes(type), `${name}: ${type}`);
    }
});

test("lesson sequence builds editable drafts, supports AI and keeps failed generation in its format", () => {
    const context = vm.createContext({ document: { addEventListener() {} }, window: { EducariaDiscovery: core } });
    vm.runInContext(sources["lesson-sequence-builder"], context);
    for (const [type, payload] of [["wordtrail", trail], ["connections", connections]]) {
        assert.equal(context.lessonAiSupported(type), true);
        assert.equal(context.payloadHasContent(type, payload), true);
        const draft = JSON.parse(context.buildLessonDraftFromPayload(type, payload));
        assert.equal(draft.controls["discovery-title"], payload.title);
        if (type === "wordtrail") {
            assert.equal(draft.controls["discovery-show-clues"], "true");
            assert.equal(JSON.parse(context.buildLessonDraftFromPayload(type, { ...payload, showClues: false })).controls["discovery-show-clues"], "false");
        }
        assert.match(draft.stackHtml, /data-discovery-item/);
        const fallback = context.fallbackPayloadForType(type, "Texto", "Falhou");
        assert.equal(context.payloadHasContent(type, fallback), false);
        assert.match(context.buildDraftStackHtml(type, fallback), /data-discovery-item/);
    }
});

test("new pages are public assets with shared save, auth and presentation controls", async () => {
    for (const type of core.types) {
        for (const kind of ["builder", "apresentacao"]) {
            const path = `plataforma/${core.slugs[type]}-${kind}.html`;
            assert.equal(isPublicFile(path), true);
            const html = await fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
            assert.ok(html.includes(`data-material-type="${type}"`));
            assert.match(html, /discovery-core\.js/);
            if (kind === "builder") {
                assert.match(html, /data-requires-auth="true"/);
                assert.match(html, /data-save-lesson/);
                assert.match(html, /builder-journey\.js/);
            } else {
                assert.match(html, /presentation-mode\.js/);
                assert.match(html, /data-discovery-controls/);
                assert.match(html, /data-return-to-editor/);
            }
        }
    }
    const server = await fs.readFile(new URL("../../ai-service/server.js", import.meta.url), "utf8");
    const route = server.slice(server.indexOf('app.post("/api/ai/generate"'));
    assert.ok(route.indexOf("validateDiscoverySource(materialType") < route.indexOf("await reserveAiDailyCredit"));
});
