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
        // A 5.5 mm cell with a 19.24-unit glyph prints at 10 pt. Do not stretch a tiny grid.
        // One unit of padding preserves the outer stroke at the SVG viewport edges.
        return `<svg class="worksheet-grid ${className}" style="width:${(cols * 5.5 + 11 / 30).toFixed(3)}mm" viewBox="-1 -1 ${cols * size + 2} ${rows * size + 2}" role="img" aria-label="${e(label)}" xmlns="http://www.w3.org/2000/svg">${cells.map((cell, i) => `<rect x="${i % cols * size}" y="${Math.floor(i / cols) * size}" width="30" height="30" fill="${cell === null ? "#edf0ef" : "#fff"}" stroke="#53625f" stroke-width=".7"/>`).join("")}${pathMarkup}${cells.map((cell, i) => `${numbers[i] ? `<text x="${i % cols * size + 2}" y="${Math.floor(i / cols) * size + 8}" font-size="9" fill="#111">${Number(numbers[i])}</text>` : ""}${cell === null ? "" : `<text x="${(i % cols + .5) * size}" y="${(Math.floor(i / cols) + .74) * size}" font-size="19.24" font-family="Arial,sans-serif" font-weight="500" text-anchor="middle" fill="#111">${e(cell)}</text>`}`).join("")}</svg>`;
    }
    function unit(type, index, instruction, body, suffix = "") {
        const readable = instruction.replace(/caminhos ortogonais/gi, "caminhos na horizontal ou vertical");
        return `<article class="worksheet-exercise" data-ws-print-type="${type}"><header><span class="worksheet-exercise-number">${index}</span><h2>${core.labels[type]}${suffix ? `<small>${e(suffix)}</small>` : ""}</h2></header><p class="worksheet-instruction">${e(readable)}</p>${body}</article>`;
    }
    function units(raw, engines, answers = false, settings = {}) {
        const data = core.normalize(raw), result = [], notices = [];
        data.order.forEach((type, index) => {
            const item = data.activities[type], number = index + 1;
            if (type === "wordtrail") {
                const boards = engines.discovery.createBoards({ words: item.words }, { print: true });
                let offset = 0;
                for (const [part, board] of boards.entries()) {
                    const numbers = Object.fromEntries(board.entries.map((entry, i) => [entry.path[0], offset + i + 1]));
                    const lines = board.entries.map((entry, i) => `<div class="worksheet-answer-line"><span>${offset + i + 1}.</span><span>${answers ? e(entry.term) : ""}</span></div>`).join("");
                    const clues = settings.trailClues ? `<ol class="worksheet-clues" start="${offset + 1}">${board.entries.map(entry => `<li>${e(entry.clue || `${entry.letters.length} letras`)}</li>`).join("")}</ol>` : "";
                    result.push(unit(type, number, item.instruction, `<div class="worksheet-trail-row">${grid(board.rows, board.cols, board.cells.map(cell => cell?.letter || null), { label: "Grade da trilha", numbers, paths: answers ? board.entries.map(entry => entry.path) : [] })}<div class="worksheet-word-lines"><strong>Palavras encontradas</strong>${lines}</div></div>${clues}<p class="worksheet-note">Comece pelos números. Não use diagonais.</p>`, boards.length > 1 ? `Parte ${part + 1} de ${boards.length}` : ""));
                    offset += board.entries.length;
                }
            } else if (type === "connections") {
                item.rounds.forEach((round, i) => result.push(unit(type, number, item.instruction, `<ol class="worksheet-connection-clues">${round.clues.map(clue => `<li>${e(clue)}</li>`).join("")}</ol><div class="worksheet-connection-answer"><strong>Resposta:</strong><span>${answers ? e(round.answer) : ""}</span></div>${answers && round.explanation ? `<p class="worksheet-explanation">${e(round.explanation)}</p>` : ""}`, item.rounds.length > 1 ? `Desafio ${i + 1} de ${item.rounds.length}` : "")));
            } else if (type === "wordsearch") {
                const puzzle = engines.wordsearch.createPuzzle({ words: item.words, size: 6, mode: "basic", seed: JSON.stringify(item.words.map(word => word.term)) });
                if (puzzle.omittedEntries.length) throw new Error("Algumas palavras não couberam no caça-palavras. Reduza a quantidade ou o tamanho antes de imprimir.");
                const vectors = { E: [0, 1], S: [1, 0] };
                const paths = answers ? puzzle.placedEntries.map(entry => Array.from({ length: entry.cleanTerm.length }, (_, n) => (entry.row + vectors[entry.direction][0] * n) * puzzle.cols + entry.col + vectors[entry.direction][1] * n)) : [];
                const help = settings.wordsearchHelp || (settings.wordBank === false ? "clues" : "words");
                const bank = help === "words" || answers ? `<p class="worksheet-word-bank">${item.words.map(word => e(word.term)).join(" · ")}</p>` : help === "none" ? ""
                    : `<ul class="worksheet-clues">${item.words.map(word => `<li>${e(word.clue || `Uma palavra com ${core.clean(word.term).length} letras`)}</li>`).join("")}</ul>`;
                const writes = /\b(?:escrev|registr|anot)/i.test(item.instruction);
                const lines = writes ? `<div class="worksheet-search-lines">${item.words.map((word, i) => `<div class="worksheet-answer-line"><span>${i + 1}.</span><span>${answers ? e(word.term) : ""}</span></div>`).join("")}</div>` : "";
                const instruction = item.instruction === core.instructions.wordsearch && help === "clues" ? "Resolva as pistas e encontre as palavras na horizontal ou vertical. Circule-as." : item.instruction;
                result.push(unit(type, number, instruction, `${grid(puzzle.rows, puzzle.cols, puzzle.grid.flat(), { label: "Grade do caça-palavras", paths })}${bank}${lines}`));
            } else {
                let pending = item.words.map((word, i) => ({ id: `ws-${i}`, answer: word.term, clue: word.clue })), part = 0, offset = 0;
                const panels = [], singles = [];
                while (pending.length) {
                    const puzzle = engines.crossword.createPuzzle({ entries: pending, size: 11, optimize: true });
                    if (!puzzle.placedEntries.length) throw new Error("Não foi possível montar as cruzadas. Revise o tamanho das palavras.");
                    const entries = [...puzzle.placedEntries].sort((a, b) => a.number - b.number || a.orientation.localeCompare(b.orientation));
                    if (entries.length === 1) {
                        const entry = entries[0];
                        singles.push(`<li><span><strong>${offset + 1}.</strong> ${e(entry.clue)} <small>(${entry.cleanAnswer.length} letras)</small></span><span class="worksheet-short-answer">${answers ? e(entry.answer) : ""}</span></li>`);
                        offset++;
                    } else {
                        const numbers = Object.fromEntries(puzzle.grid.flat().map((cell, i) => [i, cell?.number ? cell.number + offset : 0]));
                        panels.push(`<div class="worksheet-crossword-panel">${grid(puzzle.rows, puzzle.cols, puzzle.grid.flat().map(cell => cell ? answers ? cell.letter : "" : null), { label: answers ? "Cruzadas resolvidas" : "Grade numerada das cruzadas", numbers })}<ul class="worksheet-crossword-clues">${entries.map(entry => `<li><strong>${entry.number + offset}${entry.orientation === "across" ? " →" : " ↓"}</strong> ${e(entry.clue)}${answers ? ` <em>(${e(entry.answer)})</em>` : ""}</li>`).join("")}</ul></div>`);
                        offset += Math.max(...entries.map(entry => entry.number));
                    }
                    pending = puzzle.omittedEntries; part++;
                    if (part > 8) throw new Error("Não foi possível organizar todas as palavras cruzadas.");
                }
                const extras = singles.length ? `<div class="worksheet-crossword-extras"><p>${panels.length ? "Complete também:" : "Complete as respostas nas linhas:"}</p><ol>${singles.join("")}</ol></div>` : "";
                const instruction = !panels.length && item.instruction === core.instructions.crossword ? "Leia as pistas e escreva as respostas nas linhas." : item.instruction;
                result.push(unit(type, number, instruction, `<div class="worksheet-crossword-panels">${panels.join("")}</div>${extras}${panels.length ? '<p class="worksheet-note">→ Horizontal · ↓ Vertical</p>' : ""}`));
                if (part > 1) notices.push("Algumas palavras não cruzam na montagem encontrada. Elas foram mantidas no mesmo exercício, em grades menores ou linhas de resposta.");
            }
        });
        return { units: result, notices };
    }
    function pageHeader(data, settings, answers) {
        return `<header class="worksheet-page-header">${answers ? '<p class="worksheet-key-label">GABARITO DO PROFESSOR</p>' : ""}${settings.school ? `<p>${e(settings.school)}</p>` : ""}<h1>${e(data.title)}</h1>${data.subtitle ? `<p>${e(data.subtitle)}</p>` : ""}${answers ? "" : `<div class="worksheet-student-fields"><span>Nome: <i></i></span><span>Turma: <i>${e(settings.className || "")}</i></span><span>Data: <i></i></span></div>`}</header>`;
    }
    return Object.freeze({ units, pageHeader });
});
