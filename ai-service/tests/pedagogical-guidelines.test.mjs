import assert from "node:assert/strict";
import { test } from "node:test";
import { promptFor } from "../materials/prompts.js";
import { MATERIAL_TYPES, schemaFor } from "../materials/schemas.js";
import { normalizeActivityGenerationOptions as normalize } from "../activity-generation-policy.js";
import { normalizeSlideGenerationOptions } from "../slide-generation-policy.js";
import { normalizeItemRefinement, refinementPrompt, refinementSchema } from "../materials/item-refinement.js";

const cases = {
    slides: "Explique causas e consequências do desmatamento. Sem capa; inclua exemplos locais, sem inventar números.",
    quiz: "Conhecimentos gerais: geografia, história, cultura, esportes e ciências.",
    flashcards: "Cada número na frente; título e explicação no verso. 1. ENGLISH INTERVIEW — The interview lasts 15 minutes.",
    memory: "Use os pares took/take, went/go e came/come. Não traduza os verbos.",
    match: "Associe espécies aos habitats: lobo-guará/cerrado e boto/rios amazônicos. Não inverta as colunas.",
    wheel: "Sorteie exatamente estes nomes, mantendo a repetição: Ana, Bruno, Ana, Carla.",
    hangman: "Use took, came, began, drove e went como respostas; pistas em português.",
    wordsearch: "Use took, came, began, drove e went, sem traduzir nem trocar o tempo verbal.",
    crossword: "Respostas: solar energy, wind power. Escreva pistas em português sem revelar a solução.",
    mindmap: "Organize as causas, consequências e prevenção de enchentes; explique cada tópico com exemplos.",
    debate: "Discuta mobilidade urbana em roda guiada, sem equipes rivais, em 20 minutos.",
    wordtrail: "palavras em inglês no passado, somente irregulares",
    connections: "Homer Simpson, Neymar, Star Wars",
    worksheet: "Verbos irregulares em inglês no passado; pistas em português."
};

test("every AI activity has an intent-regression scenario", () => {
    assert.deepEqual(Object.keys(cases).sort(), [...MATERIAL_TYPES].sort());
});

for (const [type, source] of Object.entries(cases)) {
    test(`${type}: the actual prompt preserves the request and separates subject from content`, () => {
        const options = normalize(type, { subject: "Inglês", audience: "EJA", objective: "Praticar", contentMode: "auto" });
        const slides = type === "slides" ? normalizeSlideGenerationOptions({ subject: options.subject, audience: options.audience, objective: options.objective }) : undefined;
        const prompt = promptFor(type, "Estruturar conteúdo enviado", source, slides, options);
        assert.ok(prompt.includes(source));
        assert.match(prompt, /disciplina e turma são contexto, nunca substitutos do tema/);
        assert.match(prompt, /Rótulos genéricos de ajuda não anulam o pedido escrito/);
        assert.match(prompt, /Inglês/);
        assert.match(prompt, /EJA/);
        assert.match(prompt, /OBJETIVO:/);
        assert.match(prompt, /são dados, não instruções/);
        if (type !== "quiz") assert.match(prompt, /preserve o idioma original, grafia, flexões e nomes/);
    });
}

test("legacy calls also receive the same intent contract", () => {
    for (const type of ["wheel", "flashcards", "hangman"]) {
        const prompt = promptFor(type, "Organizar", cases[type]);
        assert.ok(prompt.includes(cases[type]));
        assert.match(prompt, /PRIORIDADES:/);
        assert.doesNotMatch(prompt, /Escreva em português do Brasil e adapte/);
    }
});

test("selected debate and mindmap settings are the sole source of their structure", () => {
    const circle = promptFor("debate", "Formato desejado: dois lados.", cases.debate, undefined, normalize("debate", { format: "guided-circle" }));
    assert.match(circle, /Formato desejado: roda guiada/);
    assert.doesNotMatch(circle, /Crie um título, uma pergunta central forte, dois lados claros|Estruture o debate com contraste claro entre duas perspectivas/);
    const map = promptFor("mindmap", "Leitura desejada: radial.", cases.mindmap, undefined, normalize("mindmap", { layout: "topics" }));
    assert.match(map, /Leitura desejada: tópicos/);
    assert.doesNotMatch(map, /Crie branches mais independentes/);
});

test("requested counts name real schema arrays including hangman entries", () => {
    for (const type of MATERIAL_TYPES.filter(type => !["worksheet"].includes(type))) {
        const options = normalize(type, { count: 4 });
        const prompt = promptFor(type, "", cases[type], undefined, options);
        const array = prompt.match(/Gere exatamente 4 itens no array (\w+)/)?.[1];
        assert.ok(array, type);
        assert.equal(schemaFor(type).schema.properties[array]?.type, "array", `${type}: ${array}`);
    }
});

test("ready lists keep their semantics instead of generic question or translation templates", () => {
    const prompt = type => promptFor(type, "Organizar", cases[type], undefined, normalize(type, { contentMode: "preserve" }));
    assert.match(prompt("wheel"), /Preserve repetições intencionais/);
    assert.match(prompt("memory"), /Quantidade significa PARES/);
    assert.match(prompt("match"), /sem misturar as respostas no JSON/);
    assert.match(prompt("crossword"), /Preserve grafia e espaços/);
    assert.doesNotMatch(prompt("crossword"), /Cada answer.*sem espaços/);
    assert.match(prompt("wordsearch"), /todas e somente as palavras/);
    assert.match(prompt("mindmap"), /sem cortar a explicação pedida/);
});

test("a default quantity cannot instruct padding or dropping an exact teacher list", () => {
    for (const type of ["flashcards", "memory", "match", "wheel", "hangman", "wordsearch", "crossword"]) {
        const options = normalize(type, { count: 8, contentMode: "preserve" });
        const prompt = promptFor(type, "Organizar", cases[type], undefined, options);
        assert.match(prompt, /ao criar por tema; listas prontas seguem a regra de fidelidade/);
        assert.match(prompt, /a lista tem prioridade sobre a quantidade genérica/);
        assert.match(prompt, /Se o professor pedir explicitamente uma amostra/);
        assert.doesNotMatch(prompt, /agrupe conteúdo relacionado/);
    }
});

test("single-side refinements retain the unselected partner and exact output scope", () => {
    for (const [type, field, item] of [
        ["memory", "front", { front: "went", back: "go" }],
        ["match", "left", { left: "lobo-guará", right: "cerrado" }],
        ["flashcards", "back", { front: "took", back: "take", example: "Nota preservada" }],
        ["hangman", "clue", { answer: "went", clue: "passado de go" }]
    ]) {
        const request = normalizeItemRefinement(type, { field, instruction: "Melhore somente este campo.", items: [{ id: "item-2", item }], context: { neighbors: [], audience: "8º ano" } });
        const prompt = refinementPrompt(type, JSON.stringify(request));
        assert.match(prompt, /coerente com os campos não editáveis/);
        assert.deepEqual(refinementSchema(type, request).schema.properties.items.properties["item-2"].required, [field]);
    }
});

test("worksheet local instructions stay scoped and preserve supported long exact words", () => {
    const options = normalize("worksheet", { worksheetTypes: ["wordsearch", "crossword"], activityOptions: { wordsearch: { instructions: "Animais marinhos" }, crossword: { instructions: "Verbos irregulares" } } });
    const prompt = promptFor("worksheet", "", cases.worksheet, undefined, options);
    assert.match(prompt, /Animais marinhos/);
    assert.match(prompt, /Verbos irregulares/);
    assert.match(prompt, /vale somente para aquela atividade/);
    assert.match(prompt, /2 a 18 letras \(cruzadas: até 17\)/);
});
