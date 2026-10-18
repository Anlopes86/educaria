(function () {
    "use strict";
    const core = window.EducariaDiscovery, type = document.body.dataset.materialType;
    const $ = selector => document.querySelector(selector);
    let material, boards, pointerInput, state = { index: 0, rounds: {}, showClues: true };
    const current = () => state.rounds[state.index] ||= { found: [], path: [], clues: 1, clueFocus: 0, revealed: false };
    const status = text => { $("[data-discovery-status]").textContent = text; };
    function direction(path, cell, cols) {
        const index = path.indexOf(cell), next = path[index + 1];
        if (index < 0 || next == null) return "";
        return next === cell + 1 ? "right" : next === cell - 1 ? "left" : next > cell ? "down" : "up";
    }
    function fit() {
        if (type === "connections" && material) {
            const layout = $("[data-clue-page-size]");
            if (layout && Number(layout.dataset.cluePageSize) !== cluePageSize()) { renderConnections(); return; }
        }
        // Keep short clues legible without a scrollable bank on the projector.
        for (const card of document.querySelectorAll(".discovery-word-bank li, .discovery-clue")) {
            if (card.hidden) continue;
            const fields = [...card.querySelectorAll("strong, span")];
            fields.forEach(field => { field.style.fontSize = ""; });
            const bounds = card.getBoundingClientRect(), style = getComputedStyle(card);
            const top = bounds.top + parseFloat(style.paddingTop), bottom = bounds.bottom - parseFloat(style.paddingBottom);
            const overflows = () => card.scrollHeight > card.clientHeight + 1 || fields.some(field => {
                const rect = field.getBoundingClientRect();
                return rect.top < top - 1 || rect.bottom > bottom + 1;
            });
            for (let step = 0; step < 20 && overflows(); step++) {
                fields.forEach(field => { const size = parseFloat(getComputedStyle(field).fontSize); field.style.fontSize = `${Math.max(Math.min(14, size), size - 1)}px`; });
            }
        }
        const grid = $("[data-trail-grid]");
        if (!grid || !boards) return;
        const area = grid.parentElement, board = boards[state.index];
        const size = Math.max(18, Math.floor(Math.min((area.clientWidth - 18) / board.cols, (area.clientHeight - 18) / board.rows, 96)));
        grid.style.setProperty("--cell", `${size}px`);
    }
    function cluePageSize() {
        const clues = material.rounds[state.index].clues, area = $("[data-discovery-content]");
        return window.innerWidth <= 760 ? clues.length : core.cluePageSize(clues, area.clientWidth, area.clientHeight);
    }
    function select(cell, drag = false) {
        const board = boards[state.index], round = current();
        if (round.revealed || !board.cells[cell] || round.found.includes(board.cells[cell].word)) return;
        const next = core.advancePath(board, round.path, cell, drag);
        if (next.error) {
            status(next.error === "repeated" ? "Essa letra já está no caminho. Use Desfazer para voltar." : "Escolha uma letra vizinha, acima, abaixo ou ao lado.");
            return false;
        }
        round.path = next.path;
        const match = core.matchPath(board, round.path);
        if (match >= 0) {
            round.found.push(match); round.path = [];
            status(round.found.length === board.entries.length ? "Trilha concluída! Todas as palavras foram encontradas." : `Encontrada: ${board.entries[match].term}.`);
        } else status(round.path.map(index => board.cells[index].letter).join(" ") || "Escolha a primeira letra de uma palavra.");
        renderTrail();
        if (!drag) $("[data-trail-grid]").querySelector(`[data-cell="${cell}"]`)?.focus({ preventScroll: true });
        return match >= 0;
    }
    function renderTrail() {
        const board = boards[state.index], round = current();
        $("[data-discovery-content]").innerHTML = `<div class="discovery-trail-layout"><div class="discovery-grid-area"><div class="discovery-grid" data-trail-grid role="group" aria-label="Tabuleiro de letras" style="--cols:${board.cols}">${board.cells.map((cell, index) => {
            if (!cell) return '<span class="discovery-blocked" aria-hidden="true"></span>';
            const found = round.found.includes(cell.word), selected = round.path.includes(index), marked = found || round.revealed;
            const next = direction(marked ? board.entries[cell.word].path : round.path, index, board.cols);
            return `<button type="button" data-cell="${index}" ${next ? `data-next="${next}"` : ""} class="discovery-letter ${marked ? `found color-${cell.word % 4}` : ""} ${selected ? "selected" : ""}" aria-label="${core.escape(cell.letter)}, linha ${Math.floor(index / board.cols) + 1}, coluna ${index % board.cols + 1}${found ? ", encontrada" : ""}" aria-pressed="${selected}" ${found || round.revealed ? 'aria-disabled="true"' : ""}><span>${cell.letter}</span>${marked ? `<small>${cell.word + 1}</small>` : ""}</button>`;
        }).join("")}</div></div><aside class="discovery-word-bank"><p class="discovery-kicker">Encontre os caminhos</p><h2>${round.found.length} de ${board.entries.length}</h2><ol>${board.entries.map((entry, index) => `<li class="${round.found.includes(index) ? `found color-${index % 4}` : ""}"><strong>${index + 1}. ${round.found.includes(index) || round.revealed ? core.escape(entry.term) : `${entry.letters.length} letras`}${round.found.includes(index) ? " ✓" : ""}</strong>${state.showClues ? `<span>${core.escape(entry.clue || "Siga as letras vizinhas.")}</span>` : ""}</li>`).join("")}</ol></aside></div>`;
        const cluesToggle = $("[data-discovery-toggle-clues]");
        if (cluesToggle) {
            cluesToggle.textContent = state.showClues ? "Ocultar pistas" : "Mostrar pistas";
            cluesToggle.setAttribute("aria-pressed", String(state.showClues));
        }
        $("[data-discovery-hint]").hidden = !state.showClues;
        $("[data-discovery-reveal]").textContent = round.revealed ? "Ocultar respostas" : "Mostrar respostas";
        $("[data-discovery-reveal]").setAttribute("aria-pressed", String(round.revealed));
        $("[data-discovery-undo]").disabled = !round.path.length || round.revealed;
        $("[data-discovery-clear]").disabled = !round.path.length || round.revealed;
        fit();
    }
    function renderConnections() {
        const data = material.rounds[state.index], round = current();
        const size = cluePageSize(), start = Math.floor((round.clueFocus || 0) / size) * size, end = Math.min(start + size, data.clues.length);
        const pages = size < data.clues.length ? `<nav class="discovery-clue-pages" aria-label="Páginas de pistas"><button type="button" data-clue-page="${start - size}" aria-label="Pistas anteriores" ${start === 0 ? "disabled" : ""}>←</button><span role="status">Pistas ${start + 1}–${end} de ${data.clues.length}</span><button type="button" data-clue-page="${start + size}" aria-label="Pistas seguintes" ${end === data.clues.length ? "disabled" : ""}>→</button></nav>` : "";
        $("[data-discovery-content]").innerHTML = `<div class="discovery-connections-layout ${data.clues.length > 5 ? "discovery-connections-layout--many" : ""} ${round.revealed ? "is-revealed" : ""}" data-clue-count="${data.clues.length}" data-clue-page-size="${size}"><div class="discovery-clue-area">${pages}<div class="discovery-clue-stack">${data.clues.map((clue, index) => `<div class="discovery-clue ${index < round.clues || round.revealed ? "is-visible" : "is-hidden"}" ${index < start || index >= end ? "hidden" : ""}><span>Pista ${index + 1}</span><strong>${index < round.clues || round.revealed ? core.escape(clue) : "?"}</strong></div>`).join("")}</div></div><aside class="discovery-answer-panel"><span class="discovery-answer-symbol" aria-hidden="true">${round.revealed ? "✓" : "?"}</span><p class="discovery-kicker">${round.revealed ? "A conexão é…" : "O que há em comum?"}</p>${round.revealed ? `<h2>${core.escape(data.answer)}</h2><p>${core.escape(data.explanation)}</p>` : `<h2>Conecte as pistas.</h2><p>Converse com a turma e tente descobrir com o menor número de pistas.</p><strong>${round.clues} de ${data.clues.length} pistas reveladas</strong>`}</aside></div>`;
        $("[data-discovery-clue]").disabled = round.clues >= data.clues.length || round.revealed;
        $("[data-discovery-reveal]").textContent = round.revealed ? "Ocultar conexão" : "Mostrar conexão";
        $("[data-discovery-reveal]").setAttribute("aria-pressed", String(round.revealed));
        fit();
    }
    function render() {
        pointerInput?.cancel();
        const total = type === "wordtrail" ? boards.length : material.rounds.length;
        $("[data-discovery-title]").textContent = material.title;
        $("[data-discovery-subtitle]").textContent = material.subtitle || (type === "wordtrail" ? "Clique ou arraste pelas letras vizinhas. Vale fazer curvas, mas não diagonais." : "Revele as pistas e descubra a conexão com a turma.");
        $("[data-discovery-counter]").textContent = `${type === "wordtrail" ? "Tabuleiro" : "Desafio"} ${state.index + 1} de ${total}`;
        $("[data-discovery-prev]").disabled = state.index === 0;
        $("[data-discovery-next]").disabled = state.index >= total - 1;
        if (type === "wordtrail") renderTrail(); else renderConnections();
        fit();
    }
    function setup() {
        try {
            const key = typeof educariaScopedKey === "function" ? educariaScopedKey(`educaria:builder:${type}`) : `educaria:builder:${type}`;
            material = core.normalize(type, core.readDraft(type, localStorage.getItem(key), DOMParser));
            if (type === "wordtrail") { boards = core.createBoards(material); state.showClues = material.showClues; }
        } catch (error) {
            $("[data-discovery-content]").innerHTML = `<div class="discovery-empty-preview"><h2>Vamos preparar a atividade?</h2><p>${core.escape(error.message)}</p><a class="platform-button" href="${core.slugs[type]}-builder.html">Voltar à edição</a></div>`;
            $("[data-discovery-controls]").hidden = true;
            return;
        }
        document.querySelectorAll("[data-trail-only]").forEach(node => { node.hidden = type !== "wordtrail"; });
        $("[data-discovery-clue]").hidden = type !== "connections";
        if (type === "wordtrail") pointerInput = window.EducariaTrailPointer.bind($("[data-discovery-content]"), select);
        $("[data-discovery-toggle-clues]")?.addEventListener("click", () => { state.showClues = !state.showClues; renderTrail(); });
        $("[data-discovery-prev]").addEventListener("click", () => { if (state.index > 0) { state.index--; status(""); render(); } });
        $("[data-discovery-next]").addEventListener("click", () => { const total = boards?.length || material.rounds.length; if (state.index < total - 1) { state.index++; status(""); render(); } });
        $("[data-discovery-reveal]").addEventListener("click", () => { current().revealed = !current().revealed; status(""); render(); });
        $("[data-discovery-clue]").addEventListener("click", () => { current().clues = Math.min(current().clues + 1, material.rounds[state.index].clues.length); current().clueFocus = current().clues - 1; renderConnections(); });
        $("[data-discovery-content]").addEventListener("click", event => {
            const button = event.target.closest("[data-clue-page]");
            if (!button || type !== "connections") return;
            current().clueFocus = Math.max(0, Math.min(material.rounds[state.index].clues.length - 1, Number(button.dataset.cluePage)));
            renderConnections();
            $("[data-discovery-content]").querySelector(`[aria-label="${button.getAttribute("aria-label")}"]`)?.focus({ preventScroll: true });
        });
        $("[data-discovery-undo]").addEventListener("click", () => { current().path.pop(); status(""); renderTrail(); });
        $("[data-discovery-clear]").addEventListener("click", () => { current().path = []; status(""); renderTrail(); });
        $("[data-discovery-hint]").addEventListener("click", () => {
            const board = boards[state.index], index = board.entries.findIndex((_, i) => !current().found.includes(i));
            if (index < 0) { status("Todas as palavras já foram encontradas!"); return; }
            current().revealed = false; current().path = [board.entries[index].path[0]];
            status(`A primeira letra da palavra ${index + 1} está destacada.`); renderTrail();
        });
        $("[data-discovery-reset]").addEventListener("click", () => { if (!window.confirm("Reiniciar este desafio e ocultar as respostas?")) return; delete state.rounds[state.index]; status(""); render(); });
        $("[data-discovery-content]").addEventListener("keydown", event => {
            const button = event.target.closest("[data-cell]");
            if (!button) return;
            const cell = Number(button.dataset.cell), board = boards[state.index];
            const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -board.cols, ArrowDown: board.cols };
            if (event.key in offsets) {
                event.preventDefault(); event.stopPropagation(); const next = cell + offsets[event.key];
                if (core.adjacent(cell, next, board.cols)) $("[data-trail-grid]").querySelector(`[data-cell="${next}"]`)?.focus();
            }
        });
        window.educariaPresentationProgress = {
            capture: () => JSON.parse(JSON.stringify(state)),
            restore(saved) {
                if (!saved || !Number.isInteger(saved.index)) return;
                const total = boards?.length || material.rounds.length;
                state = { index: Math.max(0, Math.min(total - 1, saved.index)), rounds: {}, showClues: typeof saved.showClues === "boolean" ? saved.showClues : material.showClues !== false };
                for (let i = 0; i < total; i++) {
                    const round = saved.rounds?.[i]; if (!round) continue;
                    const board = boards?.[i];
                    const clueTotal = material.rounds?.[i]?.clues.length || 1;
                    state.rounds[i] = { revealed: round.revealed === true, clues: Math.max(1, Math.min(clueTotal, Number(round.clues) || 1)), clueFocus: Math.max(0, Math.min(clueTotal - 1, Math.floor(Number(round.clueFocus) || 0))), found: board && Array.isArray(round.found) ? [...new Set(round.found.filter(index => Number.isInteger(index) && index >= 0 && index < board.entries.length))] : [], path: [] };
                }
                render();
            }
        };
        render();
        new ResizeObserver(fit).observe($("[data-discovery-content]"));
        document.addEventListener("educaria-presentation-layout-change", fit);
    }
    document.addEventListener("DOMContentLoaded", setup);
})();
