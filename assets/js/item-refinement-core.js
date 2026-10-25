(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.EducariaItemRefinement = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    const field = (label, max = 1000) => ({ label, max });
    const definitions = {
        slides: { label: "Slide", fields: { title: field("Título", 200), subtitle: field("Subtítulo", 300), body: field("Conteúdo", 5000) } },
        quiz: { label: "Questão", fields: {} },
        flashcards: { label: "Card", fields: { front: field("Frente", 3000), back: field("Verso", 5000), example: field("Anotações", 2000) } },
        memory: { label: "Par", fields: { front: field("Frente", 300), back: field("Verso", 300) } },
        match: { label: "Par", fields: { left: field("Lado esquerdo", 500), right: field("Lado direito", 500) } },
        wheel: { label: "Espaço", fields: { text: field("Texto", 400) } },
        mindmap: { label: "Tópico", fields: { title: field("Título", 200), subtitle: field("Subtítulo", 300), detail: field("Explicação", 5000) } },
        debate: { label: "Etapa", fields: { title: field("Título", 200), time: field("Tempo sugerido", 80), question: field("Pergunta", 800), guidance: field("Orientação de mediação", 5000) } },
        hangman: { label: "Palavra", fields: { answer: field("Palavra", 80), clue: field("Dica", 300), category: field("Categoria", 100) } },
        wordsearch: { label: "Palavra", fields: { term: field("Palavra", 40), clue: field("Dica", 180) } },
        crossword: { label: "Entrada", fields: { answer: field("Resposta", 40), clue: field("Dica", 180) } },
        wordtrail: { label: "Palavra", fields: { term: field("Palavra", 40), clue: field("Pista", 180) } },
        connections: { label: "Desafio", fields: { answer: field("Resposta", 120), clues: field("Pistas", 1600), explanation: field("Explicação", 600) } }
    };
    const record = value => value && typeof value === "object" && !Array.isArray(value);
    const supported = type => Object.hasOwn(definitions, type);
    function fail(message) { throw new Error(message); }
    function fields(type, item = {}) {
        if (!supported(type)) fail("Esta atividade não tem ajuste por item.");
        if (type !== "quiz") return definitions[type].fields;
        const prompt = field("Pergunta", 1800), explanation = field("Explicação", 2500);
        if (item.kind === "short_answer") return { prompt, model: field("Resposta esperada", 3000), criteria: field("Critérios", 2000) };
        const correct = { label: "Resposta correta", max: 1, choices: item.kind === "true_false" ? ["A", "B"] : ["A", "B", "C", "D"] };
        if (item.kind === "true_false") return { prompt, correct, explanation };
        if (item.kind !== "multiple_choice") fail("Tipo de pergunta inválido.");
        return { prompt, optionA: field("Alternativa A", 600), optionB: field("Alternativa B", 600), optionC: field("Alternativa C", 600), optionD: field("Alternativa D", 600), correct, explanation };
    }
    function selectedKeys(type, item, selection) {
        const all = fields(type, item);
        if (selection === "all") return Object.keys(all);
        if (!Object.hasOwn(all, selection) || (type === "quiz" && !["explanation", "criteria"].includes(selection))) fail("Escolha um campo válido para ajustar.");
        return [selection];
    }
    function readText(value, max) {
        if (typeof value !== "string" || value.length > max || value.includes("\u0000")) fail("O conteúdo é inválido ou muito longo. Reduza o texto deste ajuste.");
        return value.trim();
    }
    function readItem(type, value) {
        if (!record(value)) fail("Item inválido.");
        const result = Object.fromEntries(Object.entries(fields(type, value)).map(([key, spec]) => [key, readText(value[key] ?? "", spec.max)]));
        if (type === "quiz") result.kind = value.kind;
        return result;
    }
    const cleanWord = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
    const lines = value => value.split("\n").map(s => s.trim()).filter(Boolean);
    function validatePatch(type, before, patch, selection, context = {}) {
        const keys = selectedKeys(type, before, selection), specs = fields(type, before);
        if (!record(patch) || Object.keys(patch).length !== keys.length || keys.some(key => !Object.hasOwn(patch, key))) fail("A sugestão alterou campos fora da seleção.");
        const result = Object.fromEntries(keys.map(key => [key, readText(patch[key], specs[key].max)]));
        if (!Object.values(result).some(Boolean)) fail("A sugestão veio vazia.");
        const after = { ...before, ...result };
        const required = { slides: ["title", "body"], quiz: before.kind === "short_answer" ? ["prompt", "model"] : ["prompt", "correct"],
            memory: ["front", "back"], match: ["left", "right"], flashcards: ["front", "back"], wheel: ["text"],
            mindmap: ["title", "detail"], debate: ["title", "question", "guidance"], hangman: ["answer"], wordsearch: ["term"], crossword: ["answer", "clue"], wordtrail: ["term"], connections: ["answer", "clues"] };
        if (keys.some(key => required[type].includes(key) && !result[key])) fail("A sugestão não preencheu o conteúdo necessário.");
        if (type === "quiz") {
            if ("correct" in result && !specs.correct.choices.includes(result.correct)) fail("Gabarito inválido.");
            if (before.kind === "multiple_choice" && selection === "all") {
                const options = [after.optionA, after.optionB, after.optionC, after.optionD];
                if (options.some(value => !value) || new Set(options.map(value => value.toLocaleLowerCase())).size !== 4) fail("As alternativas devem ser diferentes e estar preenchidas.");
            }
        }
        if (["wordtrail", "wordsearch", "crossword", "hangman"].includes(type)) {
            const key = ["crossword", "hangman"].includes(type) ? "answer" : "term";
            if (key in result) {
                const max = type === "crossword" ? 17 : context.surface === "print" || type === "wordtrail" ? 18 : type === "hangman" ? 60 : 24;
                if (cleanWord(result[key]).length < 2 || cleanWord(result[key]).length > max || /[^A-Za-zÀ-ž\s'-]/.test(result[key])) fail(`Use palavras com 2 a ${max} letras.`);
            }
        }
        if (type === "connections" && "clues" in result) {
            const clues = lines(result.clues), count = lines(before.clues || "").length || 3;
            if (clues.length !== Math.max(2, Math.min(8, count)) || clues.some(clue => clue.length > 100) || new Set(clues.map(clue => clue.toLocaleLowerCase())).size !== clues.length) fail("As pistas devem ter até 100 caracteres, ser distintas e manter a quantidade do desafio.");
            result.clues = clues.join("\n");
        }
        if (context.surface === "print") {
            const limits = type === "connections" ? { answer: 100, explanation: 300 } : { clue: 150 };
            for (const [key, max] of Object.entries(limits)) if (key in result && result[key].length > max) fail("O texto ficou longo demais para a folha impressa.");
            if (type === "connections" && "clues" in result && lines(result.clues).some(clue => clue.length > 100)) fail("Use pistas de até 100 caracteres na folha impressa.");
        }
        return result;
    }
    return Object.freeze({ definitions, supported, fields, selectedKeys, readItem, readText, validatePatch, cleanWord, maxBatch: 12 });
});
