/* Printable worksheet contract. Shared by the API, editor and tests; no DOM or network. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.EducariaWorksheet = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";
    const types = Object.freeze(["wordtrail", "connections", "wordsearch", "crossword"]);
    const labels = Object.freeze({ wordtrail: "Trilha de Palavras", connections: "O que há em comum?", wordsearch: "Caça-palavras", crossword: "Palavras cruzadas" });
    const instructions = Object.freeze({ wordtrail: "Ligue as letras vizinhas, sem diagonais. Escreva as palavras encontradas ao lado.", connections: "Leia as pistas e escreva a resposta que conecta todas elas.", wordsearch: "Encontre as palavras na grade e circule-as.", crossword: "Leia as pistas e complete as palavras cruzadas." });
    const clean = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
    const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
    function fail(message) { throw Object.assign(new Error(message), { code: "invalid_worksheet_material" }); }
    function text(value, max, label, required = true) {
        if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) fail(`${label}: ${required ? "preencha e use" : "use"} até ${max} caracteres.`);
        return value.trim();
    }
    function selection(value = types) {
        if (!Array.isArray(value) || !value.length || value.length > types.length || value.some(type => !types.includes(type)) || new Set(value).size !== value.length) fail("Selecione de uma a quatro atividades diferentes para a folha.");
        return [...value];
    }
    function normalize(raw, expected) {
        if (!raw || typeof raw !== "object" || !raw.activities || typeof raw.activities !== "object" || Array.isArray(raw.activities)) fail("A folha não trouxe atividades válidas.");
        const order = selection(expected || raw.order || Object.keys(raw.activities));
        if (Object.keys(raw.activities).length !== order.length || Object.keys(raw.activities).some(type => !order.includes(type))) fail("A folha precisa conter exatamente as atividades selecionadas.");
        const activities = {};
        for (const type of order) {
            const activity = raw.activities[type];
            if (!activity || typeof activity !== "object") fail(`Faltou a atividade ${labels[type]}.`);
            const instruction = text(activity.instruction ?? instructions[type], 200, "Instrução");
            if (type === "connections") {
                if (!Array.isArray(activity.rounds) || !activity.rounds.length || activity.rounds.length > 8) fail("Use de 1 a 8 desafios de conexão.");
                activities[type] = { instruction, rounds: activity.rounds.map(round => {
                    if (!Array.isArray(round?.clues) || round.clues.length < 2 || round.clues.length > 5) fail("Cada desafio precisa ter de 2 a 5 pistas.");
                    const clues = round.clues.map(clue => text(clue, 100, "Pista"));
                    if (new Set(clues.map(clue => clue.toLowerCase())).size !== clues.length) fail("Evite pistas repetidas no mesmo desafio.");
                    return { answer: text(round.answer, 100, "Resposta"), clues, explanation: text(round.explanation || "", 300, "Explicação", false) };
                }) };
            } else {
                if (!Array.isArray(activity.words) || activity.words.length < 2 || activity.words.length > 8) fail(`${labels[type]}: use de 2 a 8 palavras.`);
                const used = new Set();
                activities[type] = { instruction, words: activity.words.map(word => {
                    const term = text(word?.term, 40, "Palavra"), letters = clean(term);
                    if (letters.length < 2 || letters.length > 18 || /[^A-Za-zÀ-ž\s'-]/.test(term)) fail(`“${term}”: use de 2 a 18 letras, sem números ou símbolos.`);
                    if (type === "crossword" && letters.length > 17) fail(`“${term}”: as palavras cruzadas aceitam até 17 letras por resposta.`);
                    if (used.has(letters)) fail(`A palavra “${term}” está repetida em ${labels[type]}.`);
                    used.add(letters);
                    return { term, clue: text(word.clue || "", 150, "Pista", type === "crossword") };
                }) };
            }
        }
        return { version: 1, title: text(raw.title || "Folha de atividades", 100, "Título"), subtitle: text(raw.subtitle || "", 200, "Orientação", false), order, activities };
    }
    function blankActivity(type) {
        return type === "connections" ? { instruction: instructions[type], rounds: [{ answer: "", clues: ["", "", ""], explanation: "" }] }
            : { instruction: instructions[type], words: [{ term: "", clue: "" }, { term: "", clue: "" }] };
    }
    function stackHtml(raw) {
        return selection(raw.order || Object.keys(raw.activities)).map(type => {
            const activity = raw.activities[type];
            const fields = type === "connections" ? activity.rounds.map((round, i) => `<div class="worksheet-edit-item" data-ws-round><strong>Desafio ${i + 1}</strong><label>Resposta<input data-ws-answer data-field="answer" maxlength="100" value="${escape(round.answer)}"></label><label>Pistas, uma por linha<textarea data-ws-clues data-field="clues" rows="3">${escape(round.clues.join("\n"))}</textarea></label><label>Explicação no gabarito<textarea data-ws-explanation data-field="explanation" rows="2" maxlength="300">${escape(round.explanation)}</textarea></label><button type="button" data-ws-remove-item>Remover desafio</button></div>`).join("")
                : activity.words.map((word, i) => `<div class="worksheet-edit-item" data-ws-word><label>Palavra ${i + 1}<input data-ws-term data-field="term" maxlength="40" value="${escape(word.term)}"></label><label>${type === "crossword" ? "Pista" : "Pista (opcional)"}<input data-ws-clue data-field="clue" maxlength="150" value="${escape(word.clue)}"></label><button type="button" data-ws-remove-item>Remover palavra ${i + 1}</button></div>`).join("");
            return `<section class="worksheet-edit-section" data-worksheet-activity="${type}"><header><h3>${labels[type]}</h3><div><button type="button" data-ws-move="-1" aria-label="Mover ${labels[type]} para cima">↑</button><button type="button" data-ws-move="1" aria-label="Mover ${labels[type]} para baixo">↓</button><button type="button" data-ws-remove aria-label="Remover ${labels[type]}">Remover</button></div></header><label>Instrução<textarea data-ws-instruction data-field="instruction" rows="2" maxlength="200">${escape(activity.instruction)}</textarea></label>${fields}<button type="button" data-ws-add-item>+ ${type === "connections" ? "Adicionar desafio" : "Adicionar palavra"}</button></section>`;
        }).join("");
    }
    function readDraft(draft, Parser) {
        const state = typeof draft === "string" ? JSON.parse(draft) : draft || {};
        const doc = new Parser().parseFromString(state.stackHtml || "", "text/html");
        const activities = {}, order = [];
        for (const section of doc.querySelectorAll("[data-worksheet-activity]")) {
            const type = section.getAttribute("data-worksheet-activity");
            if (!types.includes(type) || order.includes(type)) fail("Atividade inválida na folha salva.");
            const read = (node, selector) => node.querySelector(selector)?.value || "";
            order.push(type);
            activities[type] = { instruction: read(section, "[data-ws-instruction]"), ...(type === "connections"
                ? { rounds: [...section.querySelectorAll("[data-ws-round]")].map(node => ({ answer: read(node, "[data-ws-answer]"), clues: read(node, "[data-ws-clues]").split("\n").map(s => s.trim()).filter(Boolean), explanation: read(node, "[data-ws-explanation]") })) }
                : { words: [...section.querySelectorAll("[data-ws-word]")].map(node => ({ term: read(node, "[data-ws-term]"), clue: read(node, "[data-ws-clue]") })) }) };
        }
        return { title: state.controls?.["worksheet-title"] || "Folha de atividades", subtitle: state.controls?.["worksheet-subtitle"] || "", order, activities };
    }
    return Object.freeze({ types, labels, instructions, clean, escape, normalize, selection, blankActivity, stackHtml, readDraft });
});
