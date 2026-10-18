import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import input from "../../assets/js/discovery-input.js";
import core from "../../assets/js/discovery-core.js";
import { normalizeActivityGenerationOptions } from "../../ai-service/activity-generation-policy.js";
import { validateDiscoverySource, normalizeDiscoveryMaterial } from "../../ai-service/materials/discovery.js";
import { promptFor } from "../../ai-service/materials/prompts.js";
import { schemaFor } from "../../ai-service/materials/schemas.js";

const source = "took, came, began, drove e went";
const terms = ["took", "came", "began", "drove", "went"];
const optionsFor = (text, raw = {}) => validateDiscoverySource("wordtrail", normalizeActivityGenerationOptions("wordtrail", raw), text);

test("the reported trail list stays five English words, including a final sentence stop", () => {
    for (const text of [source, `${source}.`, "took\ncame\nbegan\ndrove\nwent", "Palavras: took, came, began, drove e went"]) {
        const options = optionsFor(text, { count: 6 });
        assert.equal(options.inputMode, "words");
        assert.equal(options.count, null);
        assert.deepEqual(options.answers, terms);
    }
    assert.match(input.describe(input.resolve(source), "wordtrail"), /5 palavras na trilha: took • came • began • drove • went/);
});

test("recognition is general and preserves spelling, accents and quoted compounds", () => {
    for (const [source, expected] of [["maison, chien e chat", ["maison", "chien", "chat"]], ["Água;Coração;Guarda-chuva", ["Água", "Coração", "Guarda-chuva"]], ['"Tom e Jerry", Neymar', ["Tom e Jerry", "Neymar"]]]) {
        assert.deepEqual(optionsFor(source).answers, expected);
    }
});

test("a general English-past topic stays open for AI selection with explicit language guidance", () => {
    const topic = "palavras em inglês no passado";
    const options = optionsFor(topic, { count: 8 });
    assert.equal(options.inputMode, "topic");
    assert.equal(options.count, 8);
    const schema = schemaFor("wordtrail", options).schema;
    assert.equal(schema.properties.words.items.properties.term.enum, undefined);
    const prompt = promptFor("wordtrail", "", topic, undefined, options);
    assert.match(prompt, /idioma solicitado no tema/);
    assert.match(prompt, /verbos no passado EM INGLÊS, não suas traduções/);
    assert.match(prompt, /Gere exatamente 8/);
    assert.equal(optionsFor(source, { inputMode: "topic" }).inputMode, "topic");
});

test("the provider contract restricts the exact terms and the size of the list", () => {
    const options = optionsFor(source);
    const schema = schemaFor("wordtrail", options).schema.properties.words;
    assert.equal(schema.minItems, 5);
    assert.equal(schema.maxItems, 5);
    assert.deepEqual(schema.items.properties.term.enum, terms);
    const prompt = promptFor("wordtrail", "Gerar 6 palavras.", source, undefined, options);
    assert.match(prompt, /\["took","came","began","drove","went"\]/);
    assert.match(prompt, /Não traduza para português ou outro idioma/);
    assert.doesNotMatch(prompt, /Escolha palavras relevantes|Quantidade automática: escolha/);
});

test("translated, substituted, extra, missing or duplicate terms fail instead of losing clues", () => {
    const options = optionsFor(source);
    const words = terms.map((term, index) => ({ term, clue: `Pista ${index + 1}` }));
    for (const invalid of [words.slice(0, 4), [...words, { term: "swam" }], [words[0], words[0], ...words.slice(2)], words.map((word, i) => ({ ...word, term: ["pegou", "veio", "começou", "conduziu", "foi"][i] }))]) {
        assert.throws(() => normalizeDiscoveryMaterial("wordtrail", { words: invalid }, options, source), /idioma original/);
    }
    const valid = normalizeDiscoveryMaterial("wordtrail", { words: [...words].reverse().map(w => ({ ...w, term: w.term.toUpperCase() })) }, options, source);
    assert.deepEqual(valid.words, words);
    assert.deepEqual(core.createBoards(valid).flatMap(board => board.entries.map(entry => entry.term)), terms);
});

test("invalid lists are rejected before generation and the no-clue option remains supported", () => {
    for (const source of ["took, took", "took, H2O", "palavras: took", Array.from({ length: 13 }, (_, i) => `word${i}`).join(",")]) assert.throws(() => optionsFor(source));
    const options = optionsFor(source, { includeClues: false });
    const material = normalizeDiscoveryMaterial("wordtrail", { words: terms.map(term => ({ term, clue: "Pista" })) }, options, source);
    assert.equal(material.showClues, false);
    assert.ok(material.words.every(word => word.clue === ""));
    assert.match(promptFor("wordtrail", "", source, undefined, options), /SEM PISTAS/);
});

test("the trail editor loads the shared interpreter and offers auto, topic and exact-list modes", async () => {
    const html = await fs.readFile(new URL("../../plataforma/trilha-palavras-builder.html", import.meta.url), "utf8");
    assert.ok(html.indexOf("discovery-input.js") < html.indexOf("discovery-builder.js"));
    assert.match(html, /option value="auto">Reconhecer meu pedido/);
    assert.match(html, /Tema — IA escolhe as palavras/);
    assert.match(html, /data-discovery-source-help role="status"/);
});
