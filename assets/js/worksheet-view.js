/* Print-only rendering: student markup never contains hidden answer text or solution paths. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory(require("./worksheet-core.js"));
    else root.EducariaWorksheetView = factory(root.EducariaWorksheet);
})(typeof window !== "undefined" ? window : globalThis, function (core) {
    "use strict";
    const e = core.escape;
    function grid(rows, cols, cells, { label, paths = [], className = "", numbers = {}, printSize } = {}) {
        const size = 30;
        const { cellMm } = core.printSize(printSize);
        if (cols > (label === "Grade da trilha" ? 7 : 12) || rows > 12) className += ' worksheet-grid-wide';
        const pathMarkup = paths.map(path => `<polyline points="${path.map(index => `${(index % cols + .5) * size},${(Math.floor(index / cols) + .5) * size}`).join(" ")}" fill="none" stroke="#b8c1c0" stroke-width="17" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
        // Cells grow with the selected 10/12/14 pt letters; never shrink them to fit columns.
        // One unit of padding preserves the outer stroke at the SVG viewport edges.
        return `<svg class="worksheet-grid ${className}" style="width:${((cols + 2 / size) * cellMm).toFixed(3)}mm" viewBox="-1 -1 ${cols * size + 2} ${rows * size + 2}" role="img" aria-label="${e(label)}" xmlns="http://www.w3.org/2000/svg">${cells.map((cell, i) => `<rect x="${i % cols * size}" y="${Math.floor(i / cols) * size}" width="30" height="30" fill="${cell === null ? "#edf0ef" : "#fff"}" stroke="#53625f" stroke-width=".7"/>`).join("")}${pathMarkup}${cells.map((cell, i) => `${numbers[i] ? `<text x="${i % cols * size + 2}" y="${Math.floor(i / cols) * size + 8}" font-size="9" fill="#111">${Number(numbers[i])}</text>` : ""}${cell === null ? "" : `<text x="${(i % cols + .5) * size}" y="${(Math.floor(i / cols) + .74) * size}" font-size="19.24" font-family="Arial,sans-serif" font-weight="500" text-anchor="middle" fill="#111">${e(cell)}</text>`}`).join("")}</svg>`;
    }
    function unit(type, index, instruction, body, suffix = "", count = 0) {
        const readable = instruction.replace(/caminhos ortogonais/gi, "caminhos na horizontal ou vertical");
        return `<article class="worksheet-exercise" data-ws-print-type="${type}" data-ws-print-count="${count}"><header><span class="worksheet-exercise-number">${index}</span><h2>${core.labels[type]}${suffix ? `<small>${e(suffix)}</small>` : ""}</h2></header><p class="worksheet-instruction">${e(readable)}</p>${body}</article>`;
    }
    function groups(words, limit, clueBudget = Infinity) {
        const result = [];
        let group = [], length = 0;
        for (const word of words) {
            if (group.length && (group.length >= limit || length + word.clue.length > clueBudget)) {
                result.push(group); group = []; length = 0;
            }
            group.push(word); length += word.clue.length;
        }
        if (group.length) result.push(group);
        return result;
    }
    function units(raw, engines, answers = false, settings = {}) {
        const data = core.normalize(raw), result = [], notices = [];
        const wide = settings.columns !== "two";
        const size = core.printSize(settings.printSize);
        const budget = value => Math.floor(value / (size.scale * size.scale));
        const puzzleLayout = cols => size.extraPt && cols * size.cellMm > 120 ? " is-stacked" : "";
        const printGrid = (rows, cols, cells, options) => grid(rows, cols, cells, { ...options, printSize: size.name });
        data.order.forEach((type, index) => {
            const item = data.activities[type], number = index + 1;
            if (type === "wordtrail") {
                const boards = groups(item.words, size.extraPt ? budget(wide ? 12 : 8) : 30, size.extraPt ? budget(wide ? 1000 : 750) : Infinity)
                    .flatMap(words => engines.discovery.createBoards({ words }, { print: true, wide }));
                let offset = 0;
                for (const [part, board] of boards.entries()) {
                    const numbers = Object.fromEntries(board.entries.map((entry, i) => [entry.path[0], offset + i + 1]));
                    const lines = board.entries.map((entry, i) => `<div class="worksheet-answer-line"><span>${offset + i + 1}.</span><span>${answers ? e(entry.term) : ""}</span></div>`).join("");
                    const clues = settings.trailClues ? `<ol class="worksheet-clues" start="${offset + 1}">${board.entries.map(entry => `<li>${e(entry.clue || `${entry.letters.length} letras`)}</li>`).join("")}</ol>` : "";
                    result.push(unit(type, number, item.instruction, `<div class="worksheet-trail-row">${printGrid(board.rows, board.cols, board.cells.map(cell => cell?.letter || null), { label: "Grade da trilha", numbers, paths: answers ? board.entries.map(entry => entry.path) : [] })}<div class="worksheet-word-lines"><strong>Palavras encontradas</strong>${lines}</div></div>${clues}<p class="worksheet-note">Comece pelos números. Não use diagonais.</p>`, boards.length > 1 ? `Parte ${part + 1} de ${boards.length}` : "", board.entries.length));
                    offset += board.entries.length;
                }
            } else if (type === "connections") {
                item.rounds.forEach((round, i) => result.push(unit(type, number, item.instruction, `<ol class="worksheet-connection-clues">${round.clues.map(clue => `<li>${e(clue)}</li>`).join("")}</ol><div class="worksheet-connection-answer"><strong>Resposta:</strong><span>${answers ? e(round.answer) : ""}</span></div>${answers && round.explanation ? `<p class="worksheet-explanation">${e(round.explanation)}</p>` : ""}`, item.rounds.length > 1 ? `Desafio ${i + 1} de ${item.rounds.length}` : "", 1)));
            } else if (type === "wordsearch") {
                const help = settings.wordsearchHelp || (settings.wordBank === false ? "clues" : "words");
                const writes = /\b(?:escrev|registr|anot)/i.test(item.instruction);
                const instruction = item.instruction === core.instructions.wordsearch && help === "clues" ? "Resolva as pistas e encontre as palavras na horizontal ou vertical. Circule-as." : item.instruction;
                const pieces = []; let offset = 0;
                // The same grouping is used for student and key, regardless of answer visibility.
                for (const group of groups(item.words, budget(help === "clues" || writes ? 10 : wide ? 30 : 12), help === "clues" ? budget(600) : Infinity)) {
                    // Keep identities stable when unplaced words rejoin the remaining list.
                    let pending = group.map((word, i) => ({ ...word, id: `word-${i + 1}` }));
                    while (pending.length) {
                        let candidate = pending, puzzle;
                        // A wider grid must become smaller parts, not smaller letters on paper.
                        do {
                            const total = candidate.reduce((sum, word) => sum + core.clean(word.term).length, 0);
                            const rows = Math.max(6, Math.min(14, Math.ceil(Math.sqrt(total / 1.1))));
                            puzzle = engines.wordsearch.createPuzzle({ words: candidate, size: rows, mode: "basic", seed: JSON.stringify(candidate.map(word => word.term)) });
                            if ((puzzle.cols + 2 / 30) * size.cellMm <= 174) break;
                            if (candidate.length === 1) throw new Error("A grade não cabe no tamanho escolhido. Revise a palavra antes de imprimir.");
                            candidate = candidate.slice(0, Math.ceil(candidate.length / 2));
                        } while (true);
                        const words = puzzle.placedEntries;
                        if (!words.length) throw new Error("Não foi possível montar o caça-palavras. Revise o tamanho das palavras.");
                        const vectors = { E: [0, 1], S: [1, 0] };
                        const paths = answers ? words.map(entry => Array.from({ length: entry.cleanTerm.length }, (_, n) => (entry.row + vectors[entry.direction][0] * n) * puzzle.cols + entry.col + vectors[entry.direction][1] * n)) : [];
                        const bank = help === "words" || answers ? `<p class="worksheet-word-bank">${words.map(word => e(word.term)).join(" · ")}</p>` : help === "none" ? ""
                            : `<ul class="worksheet-clues">${words.map(word => `<li>${e(word.clue || `Uma palavra com ${core.clean(word.term).length} letras`)}</li>`).join("")}</ul>`;
                        const lines = writes ? `<div class="worksheet-search-lines">${words.map((word, i) => `<div class="worksheet-answer-line"><span>${offset + i + 1}.</span><span>${answers ? e(word.term) : ""}</span></div>`).join("")}</div>` : "";
                        const board = printGrid(puzzle.rows, puzzle.cols, puzzle.grid.flat(), { label: "Grade do caça-palavras", paths });
                        pieces.push({ body: `<div class="worksheet-puzzle-layout${bank || lines ? puzzleLayout(puzzle.cols) : " is-grid-only"}">${board}<div>${bank}${lines}</div></div>`, count: words.length });
                        offset += words.length;
                        pending = [...puzzle.omittedEntries, ...pending.slice(candidate.length)];
                    }
                }
                pieces.forEach((piece, i) => result.push(unit(type, number, instruction, piece.body, pieces.length > 1 ? `Parte ${i + 1} de ${pieces.length}` : "", piece.count)));
            } else {
                let offset = 0, disconnected = false;
                const pieces = [], singles = [];
                for (const group of groups(item.words, budget(wide ? 12 : 8), budget(wide ? 750 : 450))) {
                    let pending = group.map((word, i) => ({ id: `ws-${i}`, answer: word.term, clue: word.clue }));
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
                            pieces.push({ body: `<div class="worksheet-crossword-panel worksheet-puzzle-layout${puzzleLayout(puzzle.cols)}">${printGrid(puzzle.rows, puzzle.cols, puzzle.grid.flat().map(cell => cell ? answers ? cell.letter : "" : null), { label: answers ? "Cruzadas resolvidas" : "Grade numerada das cruzadas", numbers })}<ul class="worksheet-crossword-clues">${entries.map(entry => `<li><strong>${entry.number + offset}${entry.orientation === "across" ? " →" : " ↓"}</strong> ${e(entry.clue)}${answers ? ` <em>(${e(entry.answer)})</em>` : ""}</li>`).join("")}</ul></div><p class="worksheet-note">→ Horizontal · ↓ Vertical</p>`, count: entries.length });
                            offset += Math.max(...entries.map(entry => entry.number));
                        }
                        pending = puzzle.omittedEntries;
                        if (pending.length) disconnected = true;
                    }
                }
                for (let i = 0; i < singles.length; i += 6) pieces.push({ body: `<div class="worksheet-crossword-extras"><ol>${singles.slice(i, i + 6).join("")}</ol></div>`, count: Math.min(6, singles.length - i), lines: true });
                pieces.forEach((piece, i) => result.push(unit(type, number, piece.lines && item.instruction === core.instructions.crossword ? "Leia as pistas e escreva as respostas nas linhas." : item.instruction, piece.body, pieces.length > 1 ? `Parte ${i + 1} de ${pieces.length}` : "", piece.count)));
                if (disconnected) notices.push("Algumas palavras não cruzam na montagem encontrada. Todas foram mantidas em grades menores ou linhas de resposta.");
            }
        });
        return { units: result, notices };
    }
    function pageHeader(data, settings, answers) {
        return `<header class="worksheet-page-header">${answers ? '<p class="worksheet-key-label">GABARITO DO PROFESSOR</p>' : ""}${settings.school ? `<p>${e(settings.school)}</p>` : ""}<h1>${e(data.title)}</h1>${data.subtitle ? `<p>${e(data.subtitle)}</p>` : ""}${answers ? "" : `<div class="worksheet-student-fields"><span>Nome: <i></i></span><span>Turma: <i>${e(settings.className || "")}</i></span><span>Data: <i></i></span></div>`}</header>`;
    }
    return Object.freeze({ units, pageHeader });
});
