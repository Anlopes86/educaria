/* Pure presentation markup. Game rules and saved material remain in discovery-core. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory(require("./discovery-core.js"));
    else root.EducariaDiscoveryView = factory(root.EducariaDiscovery);
})(typeof window !== "undefined" ? window : globalThis, function (core) {
    "use strict";
    const escape = core.escape;
    const point = (cell, cols) => [cell % cols * 100 + 50, Math.floor(cell / cols) * 100 + 50];

    function ribbon(path, cols, color, selected = false) {
        if (!path.length) return "";
        const points = path.map(cell => point(cell, cols));
        const arrows = points.slice(1).map((end, index) => {
            const start = points[index], angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
            return `<path class="discovery-path-arrow" d="M -5 -7 L 3 0 L -5 7" transform="translate(${(start[0] + end[0]) / 2} ${(start[1] + end[1]) / 2}) rotate(${angle})"/>`;
        }).join("");
        return `<g class="discovery-path ${selected ? "is-tracing" : `color-${color % 4}`}" data-trail-ribbon>
            <polyline points="${points.map(p => p.join(",")).join(" ")}"/>
            <circle class="discovery-path-start" cx="${points[0][0]}" cy="${points[0][1]}" r="25"/>
            ${arrows}</g>`;
    }

    function trail(board, round, showClues) {
        const marked = index => round.found.includes(index) || round.revealed;
        const paths = board.entries.map((entry, index) => marked(index) ? ribbon(entry.path, board.cols, index) : "").join("")
            + (!round.revealed ? ribbon(round.path, board.cols, 0, true) : "");
        const trace = round.path.map(cell => board.cells[cell].letter).join("");
        const complete = round.found.length === board.entries.length;
        return `<div class="discovery-trail-layout ${showClues ? "" : "without-clues"}">
            <div class="discovery-trail-play"><div class="discovery-grid-area">
                <div class="discovery-grid" data-trail-grid role="group" aria-label="Tabuleiro de letras" style="--cols:${board.cols}">
                    ${board.cells.map((cell, index) => {
                        if (!cell) return '<span class="discovery-blocked" aria-hidden="true"></span>';
                        const found = round.found.includes(cell.word), selected = !round.revealed && round.path.includes(index);
                        const start = marked(cell.word) && board.entries[cell.word].path[0] === index;
                        return `<button type="button" data-cell="${index}" class="discovery-letter ${marked(cell.word) ? `found color-${cell.word % 4}` : ""} ${selected ? "selected" : ""}" aria-label="${escape(cell.letter)}, linha ${Math.floor(index / board.cols) + 1}, coluna ${index % board.cols + 1}${found ? ", encontrada" : ""}" aria-pressed="${selected}" ${marked(cell.word) ? 'aria-disabled="true"' : ""}><span>${cell.letter}</span>${start ? `<small aria-hidden="true">${cell.word + 1}</small>` : ""}</button>`;
                    }).join("")}
                    <svg class="discovery-paths" viewBox="0 0 ${board.cols * 100} ${board.rows * 100}" aria-hidden="true" focusable="false">${paths}</svg>
                </div>
            </div></div>
            <aside class="discovery-word-bank"><header><div class="discovery-trace ${complete ? "is-complete" : ""}" aria-label="Palavra em formação">
                <span>${trace ? "Seu caminho" : complete ? "Muito bem!" : "Encontre os caminhos"}</span>
                <strong data-trail-trace-text title="${escape(trace)}">${escape(trace || (complete ? "Todas encontradas ✓" : "Palavras da trilha"))}</strong>
            </div><h2 aria-label="${round.found.length} de ${board.entries.length} palavras encontradas">${round.found.length}<span> / ${board.entries.length}</span></h2></header>
                <ol>${board.entries.map((entry, index) => {
                    const found = round.found.includes(index), visible = marked(index);
                    return `<li class="${visible ? `is-solved color-${index % 4}` : ""}"><div class="discovery-word-head"><span class="discovery-word-number">${index + 1}</span>
                        ${visible ? `<strong class="discovery-word-term">${escape(entry.term)}</strong>` : `<span class="discovery-word-slots" aria-label="${entry.letters.length} letras">${Array.from(entry.letters, () => '<i aria-hidden="true"></i>').join("")}</span>`}
                        ${visible ? `<span class="discovery-word-result" aria-label="${found ? "Encontrada" : "Resposta revelada"}">${found ? "✓" : "↗"}</span>` : ""}</div>
                        ${showClues && entry.clue ? `<p class="discovery-word-clue">${escape(entry.clue)}</p>` : ""}</li>`;
                }).join("")}</ol>
            </aside></div>`;
    }

    function connections(data, round, size) {
        const start = Math.floor((round.clueFocus || 0) / size) * size, end = Math.min(start + size, data.clues.length);
        const pages = size < data.clues.length ? `<nav class="discovery-clue-pages" aria-label="Páginas de pistas"><button type="button" data-clue-page="${start - size}" aria-label="Pistas anteriores" ${start === 0 ? "disabled" : ""}>←</button><span role="status">Pistas ${start + 1}–${end} de ${data.clues.length}</span><button type="button" data-clue-page="${start + size}" aria-label="Pistas seguintes" ${end === data.clues.length ? "disabled" : ""}>→</button></nav>` : "";
        return `<div class="discovery-connections-layout ${data.clues.length > 5 ? "discovery-connections-layout--many" : ""} ${round.revealed ? "is-revealed" : ""}" data-clue-count="${data.clues.length}" data-clue-page-size="${size}">
            <div class="discovery-clue-area"><div class="discovery-clue-toolbar"><p>${round.revealed ? data.clues.length : round.clues} de ${data.clues.length} pistas reveladas</p>${pages}</div>
                <div class="discovery-clue-stack">${data.clues.map((clue, index) => {
                    const visible = index < round.clues || round.revealed;
                    return `<div class="discovery-clue ${visible ? "is-visible" : "is-hidden"} ${!round.revealed && index === round.clues - 1 ? "is-current" : ""}" style="--clue-step:${index}" ${index < start || index >= end ? "hidden" : ""}><span>Pista <b>${index + 1}</b></span><strong>${visible ? escape(clue) : "•••"}</strong></div>`;
                }).join("")}</div>
            </div>
            ${round.revealed ? `<aside class="discovery-answer-banner" aria-label="Conexão revelada"><span class="discovery-answer-check" aria-hidden="true">✓</span><div><p class="discovery-kicker">A conexão é</p><h2>${escape(data.answer)}</h2></div>${data.explanation ? '<button type="button" class="platform-link-button platform-link-secondary" data-discovery-explanation aria-label="Ver explicação">Por quê?</button>' : ""}</aside>` : ""}
        </div>`;
    }
    return Object.freeze({ ribbon, trail, connections });
});
