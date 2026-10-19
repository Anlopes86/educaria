/* Print-only rendering: student markup never contains hidden answer text or solution paths. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory(require("./worksheet-core.js"));
    else root.EducariaWorksheetView = factory(root.EducariaWorksheet);
})(typeof window !== "undefined" ? window : globalThis, function (core) {
    "use strict";
    const e = core.escape;
    function grid(rows, cols, cells, { label, paths = [], className = "", numbers = {} } = {}) {
        const size = 30;
        if (cols > (label === "Grade da trilha" ? 7 : 12) || rows > 12) className += ' worksheet-grid-wide';
        const pathMarkup = paths.map(path => `<polyline points="${path.map(index => `${(index % cols + .5) * size},${(Math.floor(index / cols) + .5) * size}`).join(" ")}" fill="none" stroke="#b8c1c0" stroke-width="17" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
        return `<svg class="worksheet-grid ${className}" viewBox="0 0 ${cols * size} ${rows * size}" role="img" aria-label="${e(label)}" xmlns="http://www.w3.org/2000/svg">${cells.map((cell, i) => `<rect x="${i % cols * size}" y="${Math.floor(i / cols) * size}" width="30" height="30" fill="${cell === null ? "#e0e4e3" : "#fff"}" stroke="#53625f" stroke-width=".7"/>`).join("")}${pathMarkup}${cells.map((cell, i) => `${numbers[i] ? `<text x="${i % cols * size + 2}" y="${Math.floor(i / cols) * size + 8}" font-size="7" fill="#111">${Number(numbers[i])}</text>` : ""}${cell === null ? "" : `<text x="${(i % cols + .5) * size}" y="${(Math.floor(i / cols) + .69) * size}" font-size="17" font-family="Arial,sans-serif" font-weight="600" text-anchor="middle" fill="#111">${e(cell)}</text>`}`).join("")}</svg>`;
    }
    function unit(type, index, instruction, body, suffix = "") {
        return `<article class="worksheet-exercise" data-ws-print-type="${type}"><header><span class="worksheet-exercise-number">${index}</span><h2>${core.labels[type]}${suffix ? `<small>${e(suffix)}</small>` : ""}</h2></header><p class="worksheet-instruction">${e(instruction)}</p>${body}</article>`;
    }
    function units(raw, engines, answers = false, settings = {}) {
        const data = core.normalize(raw), result = [], notices = [];
        data.order.forEach((type, index) => {
            const item = data.activities[type], number = index + 1;
            if (type === "wordtrail") {
                const boards = engines.discovery.createBoards({ words: item.words });
                let offset = 0;
                for (const [part, board] of boards.entries()) {
                    const numbers = Object.fromEntries(board.entries.map((entry, i) => [entry.path[0], offset + i + 1]));
                    const lines = board.entries.map((entry, i) => `<div class="worksheet-answer-line"><span>${offset + i + 1}.</span><span>${answers ? e(entry.term) : ""}</span></div>`).join("");
                    const clues = settings.trailClues ? `<ol class="worksheet-clues" start="${offset + 1}">${board.entries.map(entry => `<li>${e(entry.clue || `${entry.letters.length} letras`)}</li>`).join("")}</ol>` : "";
                    result.push(unit(type, number, item.instruction, `<div class="worksheet-trail-row">${grid(board.rows, board.cols, board.cells.map(cell => cell?.letter || null), { label: "Grade da trilha", numbers, paths: answers ? board.entries.map(entry => entry.path) : [] })}<div class="worksheet-word-lines"><strong>Palavras encontradas</strong>${lines}</div></div>${clues}<p class="worksheet-note">Sem acentos ou espaços na grade. Os números indicam o início de cada palavra.</p>`, boards.length > 1 ? `Parte ${part + 1} de ${boards.length}` : ""));
                    offset += board.entries.length;
                }
            } else if (type === "connections") {
                item.rounds.forEach((round, i) => result.push(unit(type, number, item.instruction, `<ol class="worksheet-connection-clues">${round.clues.map(clue => `<li>${e(clue)}</li>`).join("")}</ol><div class="worksheet-connection-answer"><strong>Resposta:</strong><span>${answers ? e(round.answer) : ""}</span></div>${answers && round.explanation ? `<p class="worksheet-explanation">${e(round.explanation)}</p>` : ""}`, item.rounds.length > 1 ? `Desafio ${i + 1} de ${item.rounds.length}` : "")));
            } else if (type === "wordsearch") {
                const puzzle = engines.wordsearch.createPuzzle({ words: item.words, size: 6, mode: "basic", seed: JSON.stringify(item.words.map(word => word.term)) });
                if (puzzle.omittedEntries.length) throw new Error("Algumas palavras não couberam no caça-palavras. Reduza a quantidade ou o tamanho antes de imprimir.");
                const vectors = { E: [0, 1], S: [1, 0] };
                const paths = answers ? puzzle.placedEntries.map(entry => Array.from({ length: entry.cleanTerm.length }, (_, n) => (entry.row + vectors[entry.direction][0] * n) * puzzle.cols + entry.col + vectors[entry.direction][1] * n)) : [];
                const bank = settings.wordBank !== false || answers ? `<p class="worksheet-word-bank">${item.words.map(word => e(word.term)).join(" · ")}</p>`
                    : `<ul class="worksheet-clues">${item.words.map(word => `<li>${e(word.clue || `Uma palavra com ${core.clean(word.term).length} letras`)}</li>`).join("")}</ul>`;
                result.push(unit(type, number, item.instruction, `${grid(puzzle.rows, puzzle.cols, puzzle.grid.flat(), { label: "Grade do caça-palavras", paths })}${bank}<p class="worksheet-note">Horizontal e vertical. Sem acentos ou espaços na grade.</p>`));
            } else {
                let pending = item.words.map((word, i) => ({ id: `ws-${i}`, answer: word.term, clue: word.clue })), part = 0;
                while (pending.length) {
                    const puzzle = engines.crossword.createPuzzle({ entries: pending, size: 11 });
                    if (!puzzle.placedEntries.length) throw new Error("Não foi possível montar as cruzadas. Revise o tamanho das palavras.");
                    const numbers = Object.fromEntries(puzzle.grid.flat().map((cell, i) => [i, cell?.number || 0]));
                    const entries = [...puzzle.placedEntries].sort((a, b) => a.number - b.number || a.orientation.localeCompare(b.orientation));
                    result.push(unit(type, number, item.instruction, `${grid(puzzle.rows, puzzle.cols, puzzle.grid.flat().map(cell => cell ? answers ? cell.letter : "" : null), { label: answers ? "Cruzadas resolvidas" : "Grade numerada das cruzadas", numbers })}<ul class="worksheet-crossword-clues">${entries.map(entry => `<li><strong>${entry.number}${entry.orientation === "across" ? " →" : " ↓"}</strong> ${e(entry.clue)}${answers ? ` <em>(${e(entry.answer)})</em>` : ""}</li>`).join("")}</ul><p class="worksheet-note">→ Horizontal · ↓ Vertical. Sem acentos ou espaços.</p>`, part ? `Continuação ${part + 1}` : ""));
                    pending = puzzle.omittedEntries; part++;
                    if (part > 8) throw new Error("Não foi possível organizar todas as palavras cruzadas.");
                }
                if (part > 1) notices.push(`As cruzadas foram divididas em ${part} grades para preservar todas as palavras. Você pode editar os termos para favorecer cruzamentos.`);
            }
        });
        return { units: result, notices };
    }
    function pageHeader(data, settings, answers) {
        return `<header class="worksheet-page-header"><div class="worksheet-page-kicker"><span>EDUCARIA · ${answers ? "GABARITO DO PROFESSOR" : "FOLHA DE ATIVIDADES"}</span><span>A4 · ${answers ? "Respostas" : "Aluno"}</span></div>${settings.school ? `<p>${e(settings.school)}</p>` : ""}<h1>${e(data.title)}</h1>${data.subtitle ? `<p>${e(data.subtitle)}</p>` : ""}<div class="worksheet-student-fields"><span>Nome: <i></i></span><span>Turma: <i>${e(settings.className || "")}</i></span><span>Data: <i></i></span></div></header>`;
    }
    return Object.freeze({ units, pageHeader });
});
