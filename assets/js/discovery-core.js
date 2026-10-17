/* Pure contracts and deterministic boards, shared by editors, players and API. */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.EducariaDiscovery = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";
    const types = ["wordtrail", "connections"];
    const labels = { wordtrail: "Trilha de Palavras", connections: "O que há em comum?" };
    const slugs = { wordtrail: "trilha-palavras", connections: "em-comum" };
    const clean = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
    const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    function fail(message) { throw Object.assign(new Error(message), { code: "invalid_discovery_material" }); }
    function text(value, max, label, required = true) {
        const result = typeof value === "string" ? value.trim() : "";
        if ((required && !result) || result.length > max) fail(`${label}: ${required ? "preencha e use" : "use"} até ${max} caracteres.`);
        return result;
    }
    function normalize(type, raw) {
        if (!types.includes(type) || !raw || typeof raw !== "object") fail("Atividade inválida.");
        const base = { title: text(raw.title || labels[type], 180, "Título"), subtitle: text(raw.subtitle || "", 280, "Orientação", false) };
        if (type === "wordtrail") {
            if (!Array.isArray(raw.words) || raw.words.length < 2 || raw.words.length > 12) fail("Use de 2 a 12 palavras na trilha.");
            const seen = new Set();
            return { ...base, words: raw.words.map(item => {
                const term = text(item?.term, 40, "Palavra"), letters = clean(term);
                if (letters.length < 2 || letters.length > 18 || /[^A-Za-zÀ-ž\s'-]/.test(term)) fail(`“${term}”: use de 2 a 18 letras, sem números ou símbolos.`);
                if (seen.has(letters)) fail(`A palavra “${term}” está repetida.`);
                seen.add(letters);
                return { term, clue: text(item.clue || "", 180, "Pista", false) };
            }) };
        }
        if (!Array.isArray(raw.rounds) || !raw.rounds.length || raw.rounds.length > 8) fail("Use de 1 a 8 desafios.");
        return { ...base, rounds: raw.rounds.map((round, index) => {
            if (!Array.isArray(round?.clues) || round.clues.length < 3 || round.clues.length > 5) fail(`Desafio ${index + 1}: inclua de 3 a 5 pistas.`);
            const clues = round.clues.map(clue => text(clue, 100, "Pista"));
            if (new Set(clues.map(value => value.toLocaleLowerCase())).size !== clues.length) fail(`Desafio ${index + 1}: evite pistas repetidas.`);
            return { answer: text(round.answer, 120, "Conexão"), clues, explanation: text(round.explanation || "", 600, "Explicação", false) };
        }) };
    }
    function parseWords(source) {
        return String(source || "").split(/[\n,;]+/).map(value => value.trim()).filter(Boolean);
    }
    function seeded(seed) {
        let state = 2166136261;
        for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
        return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
    }
    const adjacent = (a, b, cols) => Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) + Math.abs(a % cols - b % cols) === 1;
    function createBoard(words, seed = "") {
        const total = words.reduce((sum, word) => sum + clean(word.term).length, 0) + words.length - 1;
        const cols = Math.max(4, Math.ceil(Math.sqrt(total))), rows = Math.ceil(total / cols);
        let route = Array.from({ length: rows * cols }, (_, index) => {
            const row = Math.floor(index / cols), col = index % cols;
            return row * cols + (row % 2 ? cols - col - 1 : col);
        });
        const random = seeded(seed + words.map(word => word.term).join("|"));
        // Backbite transforms preserve the Hamiltonian path, so placement cannot fail.
        for (let step = 0; step < 300; step++) {
            if (random() < .5) route.reverse();
            const neighbors = route.map((cell, index) => index > 1 && adjacent(route[0], cell, cols) ? index : -1).filter(index => index > 1);
            if (!neighbors.length) continue;
            const cut = neighbors[Math.floor(random() * neighbors.length)];
            route = [...route.slice(0, cut).reverse(), ...route.slice(cut)];
        }
        const cells = Array(rows * cols).fill(null);
        let cursor = 0;
        const entries = words.map((word, index) => {
            const letters = clean(word.term), path = route.slice(cursor, cursor + letters.length);
            path.forEach((cell, offset) => { cells[cell] = { letter: letters[offset], word: index }; });
            cursor += letters.length + 1;
            return { ...word, letters, path };
        });
        return { rows, cols, cells, entries };
    }
    function createBoards(material) {
        const words = normalize("wordtrail", material).words;
        const groups = [];
        for (const word of words) {
            const current = groups.at(-1);
            // Long teacher-written clues get their own board instead of overlapping on a short screen.
            if (!current || current.length === 4 || word.clue.length > 80 || current.some(entry => entry.clue.length > 80)
                || current.reduce((sum, entry) => sum + clean(entry.term).length, 0) + clean(word.term).length > 60) groups.push([word]);
            else current.push(word);
        }
        return groups.map((group, index) => createBoard(group, String(index)));
    }
    function matchPath(board, path) {
        return board.entries.findIndex(entry => entry.path.length === path.length &&
            (entry.path.every((cell, index) => cell === path[index]) || entry.path.every((cell, index) => cell === path[path.length - 1 - index])));
    }
    function stackHtml(type, material, allowIncomplete = false) {
        const data = allowIncomplete ? material : normalize(type, material);
        const items = type === "wordtrail" ? data.words : data.rounds;
        return items.map((item, index) => `<section class="platform-question-card discovery-item" data-discovery-item>
            <header><strong data-discovery-label>${type === "wordtrail" ? "Palavra" : "Desafio"} ${index + 1}</strong><button type="button" class="platform-link-button platform-link-secondary" data-discovery-remove aria-label="Remover ${type === "wordtrail" ? "palavra" : "desafio"} ${index + 1}">Remover</button></header>
            ${type === "wordtrail" ? `<label>Palavra<input data-discovery-term data-field="term" maxlength="40" value="${escape(item.term)}"></label><label>Pista opcional<input data-discovery-clue data-field="clue" maxlength="180" value="${escape(item.clue)}"></label>` : `<label>Resposta / conexão<input data-discovery-answer data-field="answer" maxlength="120" value="${escape(item.answer)}"></label><label>Pistas, uma por linha (3 a 5)<textarea data-discovery-clues data-field="clues" rows="5">${escape(item.clues.join("\n"))}</textarea></label><label>Explicação para a turma<textarea data-discovery-explanation data-field="explanation" rows="3" maxlength="600">${escape(item.explanation)}</textarea></label>`}
        </section>`).join("");
    }
    function readDraft(type, draft, Parser) {
        const state = typeof draft === "string" ? JSON.parse(draft) : draft || {};
        const doc = new Parser().parseFromString(state.stackHtml || "", "text/html");
        const controls = state.controls || {};
        const items = [...doc.querySelectorAll("[data-discovery-item]")];
        const read = (item, selector) => item.querySelector(selector)?.value || "";
        return { title: controls["discovery-title"] || labels[type], subtitle: controls["discovery-subtitle"] || "",
            ...(type === "wordtrail" ? { words: items.map(item => ({ term: read(item, "[data-discovery-term]"), clue: read(item, "[data-discovery-clue]") })) }
                : { rounds: items.map(item => ({ answer: read(item, "[data-discovery-answer]"), clues: read(item, "[data-discovery-clues]").split("\n").map(value => value.trim()).filter(Boolean), explanation: read(item, "[data-discovery-explanation]") })) }) };
    }
    return Object.freeze({ types, labels, slugs, clean, escape, normalize, parseWords, adjacent, createBoards, matchPath, stackHtml, readDraft });
});
