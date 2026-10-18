import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import core from "../../assets/js/discovery-core.js";
import view from "../../assets/js/discovery-view.js";

const board = core.createBoards({ words: [{ term: "Água", clue: "Essencial à vida" }, { term: "Luz", clue: "Permite enxergar" }] })[0];
const initial = () => ({ found: [], path: [], revealed: false, clues: 1, clueFocus: 0 });
const challenge = { answer: "Água", clues: ["Gelo", "Vapor", "Chuva"], explanation: "Estados e manifestações da água." };

test("trail starts with blank letter slots, no answer paths or solved colors", () => {
    const html = view.trail(board, initial(), true);
    assert.equal((html.match(/<i aria-hidden="true"><\/i>/g) || []).length, 7);
    assert.match(html, /aria-label="4 letras"/);
    assert.match(html, /Essencial à vida/);
    assert.doesNotMatch(html, /data-trail-ribbon|>Água<|is-solved color-/);
});

test("selected trail has a continuous rounded ribbon, arrows and a visible working word", () => {
    const round = { ...initial(), path: board.entries[0].path.slice(0, 3) };
    const html = view.trail(board, round, false);
    assert.match(html, /without-clues/);
    assert.match(html, /data-trail-trace-text title="AGU">AGU/);
    assert.match(html, /discovery-path is-tracing/);
    assert.equal((html.match(/discovery-path-arrow/g) || []).length, 2);
    assert.doesNotMatch(html, /Essencial à vida|Permite enxergar|>Água<|is-solved color-/);
    assert.equal((view.ribbon([0, 1, 4], 3, 0).match(/discovery-path-arrow/g) || []).length, 2);
    assert.match(view.ribbon([0, 1, 4], 3, 0), /points="50,50 150,50 150,150"/);
    assert.match(view.ribbon([0, 1, 4], 3, 0), /rotate\(90\)/);
});

test("found and teacher-revealed words remain distinct and keep their numbers", () => {
    const found = view.trail(board, { ...initial(), found: [0] }, true);
    assert.match(found, />Água<\/strong>/);
    assert.match(found, /aria-label="Encontrada">✓/);
    assert.equal((found.match(/data-trail-ribbon/g) || []).length, 1);
    assert.match(found, /discovery-word-number">1/);
    const revealed = view.trail(board, { ...initial(), revealed: true }, false);
    assert.equal((revealed.match(/data-trail-ribbon/g) || []).length, 2);
    assert.match(revealed, /aria-label="Resposta revelada">↗/);
    assert.doesNotMatch(revealed, /aria-label="Encontrada"/);
    assert.match(view.trail(board, { ...initial(), found: [0, 1] }, true), /Todas encontradas ✓/);
});

test("connections use the full clue area and do not expose hidden answers or explanations", () => {
    const html = view.connections(challenge, initial(), 3);
    assert.match(html, /discovery-clue is-visible is-current/);
    assert.match(html, />Gelo<\/strong>/);
    assert.match(html, /1 de 3 pistas reveladas/);
    assert.doesNotMatch(html, /Vapor|Chuva|Água|Estados e|discovery-answer-banner|data-discovery-explanation/);
});

test("answer reveal uses a banner, with an opt-in explanation and reversible clue state", () => {
    const html = view.connections(challenge, { ...initial(), revealed: true }, 3);
    assert.match(html, /discovery-answer-banner/);
    assert.match(html, /<h2>Água<\/h2>/);
    assert.match(html, /data-discovery-explanation/);
    assert.doesNotMatch(html, /Estados e manifestações/);
    assert.match(html, /3 de 3 pistas reveladas/);
    assert.doesNotMatch(view.connections(challenge, initial(), 3), /Vapor|Chuva|Água/);
    assert.doesNotMatch(view.connections({ ...challenge, explanation: "" }, { ...initial(), revealed: true }, 3), /data-discovery-explanation/);
});

test("clue pagination preserves the original numbering and does not reveal future clues", () => {
    const data = { ...challenge, clues: Array.from({ length: 8 }, (_, i) => `Indício ${i + 1}`) };
    const html = view.connections(data, { ...initial(), clues: 5, clueFocus: 4 }, 4);
    assert.match(html, /Pistas 5–8 de 8/);
    assert.match(html, /Pista <b>5<\/b>/);
    assert.match(html, /is-visible is-current[^>]*><span>Pista <b>5/);
    assert.match(html, /data-clue-page="0"/);
    assert.doesNotMatch(html, /Indício 6|Indício 7|Indício 8/);
});

test("teacher text is escaped and both players load the shared view before the runtime", async () => {
    const html = view.connections({ answer: "<img src=x>", clues: ["<script>", "&"], explanation: "unsafe" }, { ...initial(), revealed: true }, 2);
    assert.doesNotMatch(html, /<img|<script>/);
    assert.match(html, /&lt;img src=x&gt;/);
    for (const slug of Object.values(core.slugs)) {
        const page = await fs.readFile(new URL(`../../plataforma/${slug}-apresentacao.html`, import.meta.url), "utf8");
        assert.ok(page.indexOf("discovery-view.js") > page.indexOf("discovery-core.js"));
        assert.ok(page.indexOf("discovery-view.js") < page.indexOf("discovery-runtime.js"));
    }
});
