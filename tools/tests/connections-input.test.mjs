import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import input from "../../assets/js/discovery-input.js";
import { normalizeActivityGenerationOptions } from "../../ai-service/activity-generation-policy.js";
import { validateDiscoverySource, normalizeDiscoveryMaterial } from "../../ai-service/materials/discovery.js";
import { promptFor } from "../../ai-service/materials/prompts.js";
import { schemaFor } from "../../ai-service/materials/schemas.js";
import { groqStrictJsonSchema } from "../../ai-service/ai-text-provider.js";

const source = "Homer simpson, Neymar e star wars";
const answers = ["Homer simpson", "Neymar", "star wars"];
const optionsFor = (text, raw = {}) => validateDiscoverySource("connections", normalizeActivityGenerationOptions("connections", raw), text);

test("the reported comma-and enumeration becomes three exact answers automatically", () => {
    assert.deepEqual(input.resolve(source), { mode: "words", answers });
    assert.deepEqual(input.parseAnswers("Homer simpson, Neymar, e star wars"), answers);
    assert.match(input.describe(input.resolve(source)), /3 desafios — respostas: Homer simpson • Neymar • star wars/);
    const options = optionsFor(source, { count: 7 });
    assert.equal(options.inputMode, "words");
    assert.equal(options.count, null);
    assert.deepEqual(options.answers, answers);
});

test("explicit separators and quotes preserve compound names rather than splitting their conjunction", () => {
    for (const text of ['"Tom e Jerry", Neymar, "Romeu e Julieta"', "Tom e Jerry;Neymar;Romeu e Julieta", "1. Tom e Jerry\n2. Neymar\n3. Romeu e Julieta"]) {
        assert.deepEqual(input.resolve(text).answers, ["Tom e Jerry", "Neymar", "Romeu e Julieta"]);
    }
    assert.deepEqual(input.parseAnswers('"Um, dois", “Lilo e Stitch”'), ["Um, dois", "Lilo e Stitch"]);
    assert.deepEqual(input.resolve("Respostas: Neymar").answers, ["Neymar"]);
    assert.deepEqual(input.resolve("Romeu e Julieta", "words").answers, ["Romeu e Julieta"]);
});

test("topics, explanatory prose and an explicit topic choice are not forced into answer lists", () => {
    for (const text of ["Sistema Solar", "Crie desafios sobre animais, plantas e fungos", "Primeira Guerra Mundial, suas causas e consequências", "A água muda de estado.\nO calor participa desse processo."]) {
        assert.equal(input.resolve(text).mode, "topic", text);
    }
    const options = optionsFor(source, { inputMode: "topic", count: 4 });
    assert.equal(options.inputMode, "topic");
    assert.equal(options.count, 4);
    assert.deepEqual(options.answers, []);
});

test("invalid inferred lists fail before a provider call; raw answer overrides are ignored", () => {
    assert.throws(() => optionsFor("Neymar, Neymar"), /respostas diferentes/);
    assert.throws(() => optionsFor(Array.from({ length: 9 }, (_, i) => `Nome ${i}`).join(", ")), /respostas diferentes/);
    assert.deepEqual(optionsFor(source, { answers: ["Resposta adulterada"] }).answers, answers);
    assert.throws(() => normalizeActivityGenerationOptions("connections", { inputMode: "invalid" }));
    assert.throws(() => normalizeActivityGenerationOptions("quiz", { inputMode: "auto" }));
});

test("provider schema constrains the answer set and round count without changing the topic schema", () => {
    const options = optionsFor(source, { clueCount: 4 });
    const schema = groqStrictJsonSchema(schemaFor("connections", options).schema);
    assert.equal(schema.properties.rounds.minItems, 3);
    assert.equal(schema.properties.rounds.maxItems, 3);
    assert.deepEqual(schema.properties.rounds.items.properties.answer.enum, answers);
    assert.equal(schema.properties.rounds.items.properties.clues.minItems, 4);
    assert.equal(schema.properties.rounds.items.properties.clues.maxItems, 4);
    assert.equal(schemaFor("connections", optionsFor("Animais")).schema.properties.rounds.items.properties.answer.enum, undefined);
});

test("prompts identify each item independently and never request a common category across the list", () => {
    const options = optionsFor(source, { difficulty: "easy", clueCount: 4 });
    const prompt = promptFor("connections", "", source, undefined, options);
    assert.match(prompt, /\["Homer simpson","Neymar","star wars"\]/);
    assert.match(prompt, /NÃO invente categorias que relacionem os itens entre si/);
    assert.match(prompt, /pessoa, personagem, obra, lugar ou conceito/);
    assert.match(prompt, /DIFICULDADE FÁCIL/);
    assert.match(prompt, /EXATAMENTE 4/);
    assert.doesNotMatch(prompt, /Quantidade automática: escolha|prefira conceitos da disciplina/);
});

test("wrong categories, missing answers and duplicated rounds are rejected, not relabelled", () => {
    const options = optionsFor(source, { clueCount: 2 });
    const rounds = answers.map(answer => ({ answer, clues: ["Indício inicial", "Indício final"], explanation: "Explicação" }));
    assert.deepEqual(normalizeDiscoveryMaterial("connections", { rounds: [...rounds].reverse() }, options, source).rounds.map(r => r.answer), answers);
    for (const wrong of [rounds.slice(0, 2), [rounds[0], rounds[0], rounds[2]], rounds.map(r => ({ ...r, answer: "Personagens que se tornaram memes" }))]) {
        assert.throws(() => normalizeDiscoveryMaterial("connections", { rounds: wrong }, options, source), /não preservou/);
    }
});

test("both creation surfaces load the same input interpreter before their handlers", async () => {
    for (const [file, script] of [["index.html", "teacher-dashboard.js"], ["em-comum-builder.html", "discovery-builder.js"]]) {
        const html = await fs.readFile(new URL(`../../plataforma/${file}`, import.meta.url), "utf8");
        assert.ok(html.indexOf("discovery-input.js") >= 0);
        assert.ok(html.indexOf("discovery-input.js") < html.indexOf(script));
    }
});
