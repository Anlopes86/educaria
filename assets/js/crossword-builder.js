function crosswordEscapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function crosswordEntryTemplate(index, answer = "", clue = "") {
    return `
        <section class="platform-question-card activity-content-card crossword-entry-card" data-crossword-entry>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-crossword-label>Entrada ${index + 1}</span>
                    <h3>Resposta e pista</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-crossword-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Resposta</label>
                    <input data-crossword-answer data-field="answer" type="text" value="${crosswordEscapeAttr(answer)}">
                </div>
                <div class="platform-field">
                    <label>Pista</label>
                    <input data-crossword-clue data-field="clue" type="text" value="${crosswordEscapeAttr(clue)}">
                </div>
            </div>
        </section>
    `;
}

function collectCrosswordEntries() {
    return [...document.querySelectorAll("[data-crossword-entry]")].map((card, index) => ({
        id: `crossword-${index + 1}`,
        answer: card.querySelector("[data-crossword-answer]")?.value.trim() || "",
        clue: card.querySelector("[data-crossword-clue]")?.value.trim() || ""
    }));
}

function renumberCrosswordEntries() {
    document.querySelectorAll("[data-crossword-label]").forEach((label, index) => {
        label.textContent = `Entrada ${index + 1}`;
    });
}

function addCrosswordEntry() {
    const stack = document.querySelector("[data-crossword-entries]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-crossword-entry]").length;
    stack.insertAdjacentHTML("beforeend", crosswordEntryTemplate(count));
    renumberCrosswordEntries();
    renderCrosswordPreview();
    document.dispatchEvent(new Event("input"));
}

function removeCrosswordEntry(trigger) {
    const entries = [...document.querySelectorAll("[data-crossword-entry]")];
    if (entries.length <= 2) return;

    const card = trigger.closest("[data-crossword-entry]");
    if (!card) return;

    card.remove();
    renumberCrosswordEntries();
    renderCrosswordPreview();
    document.dispatchEvent(new Event("input"));
}

function buildCrosswordClueMarkup(entries, emptyLabel) {
    const api = window.EducarIACrossword;
    if (!entries.length) {
        return `<p class="crossword-clues-empty">${api.escapeHtml(emptyLabel)}</p>`;
    }

    return `
        <ol class="crossword-clue-list">
            ${entries.map((entry) => `
                <li>
                    <strong>${entry.number}.</strong>
                    <span>${api.escapeHtml(entry.clue || entry.answer || "Sem pista")}</span>
                </li>
            `).join("")}
        </ol>
    `;
}

function renderCrosswordPreview() {
    const api = window.EducarIACrossword;
    if (!api) return;

    renumberCrosswordEntries();

    const title = document.getElementById("cruzada-titulo")?.value.trim() || "Nova cruzadinha";
    const subtitle = document.getElementById("cruzada-subtitulo")?.value.trim() || "Adicione respostas e pistas para montar a grade.";
    const size = Number(document.getElementById("cruzada-grade")?.value || 11);
    const entries = collectCrosswordEntries();
    const puzzle = api.createPuzzle({ size, entries });

    const titleRoot = document.querySelector("[data-crossword-preview-title]");
    const subtitleRoot = document.querySelector("[data-crossword-preview-subtitle]");
    const countRoot = document.querySelector("[data-crossword-preview-count]");
    const sizeRoot = document.querySelector("[data-crossword-preview-size]");
    const boardRoot = document.querySelector("[data-crossword-preview-board]");
    const acrossRoot = document.querySelector("[data-crossword-preview-across]");
    const downRoot = document.querySelector("[data-crossword-preview-down]");
    const noteRoot = document.querySelector("[data-crossword-preview-note]");

    if (titleRoot) titleRoot.textContent = title;
    if (subtitleRoot) subtitleRoot.textContent = subtitle;
    if (countRoot) countRoot.textContent = `${puzzle.placedEntries.length} ${puzzle.placedEntries.length === 1 ? "entrada" : "entradas"}`;
    if (sizeRoot) sizeRoot.textContent = `${puzzle.rows} x ${puzzle.cols}`;

    if (boardRoot) {
        if (puzzle.placedEntries.length >= 2) {
            boardRoot.innerHTML = api.buildBoardMarkup(puzzle, { mode: "preview", revealAnswers: true });
        } else {
            boardRoot.innerHTML = `
                <div class="crossword-empty-state">
                    <strong>Adicione pelo menos 2 entradas</strong>
                    <span>A grade aparece aqui assim que houver respostas suficientes.</span>
                </div>
            `;
        }
    }

    if (acrossRoot) {
        acrossRoot.innerHTML = buildCrosswordClueMarkup(puzzle.acrossEntries, "As pistas horizontais aparecem aqui.");
    }

    if (downRoot) {
        downRoot.innerHTML = buildCrosswordClueMarkup(puzzle.downEntries, "As pistas verticais aparecem aqui.");
    }

    if (noteRoot) {
        let message = "";
        if (puzzle.placedEntries.length < 2) {
            message = "O preview completo aparece quando houver pelo menos duas entradas válidas.";
        } else if (puzzle.omittedEntries.length) {
            message = `${puzzle.omittedEntries.length} ${puzzle.omittedEntries.length === 1 ? "entrada não entrou" : "entradas não entraram"} na grade atual.`;
        } else if (puzzle.sizeAdjusted) {
            message = `A grade foi ampliada para ${puzzle.size} x ${puzzle.size} para acomodar todas as respostas.`;
        }

        noteRoot.hidden = !message;
        noteRoot.textContent = message;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renumberCrosswordEntries();
    renderCrosswordPreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-crossword-entry]") || event.target.matches("#cruzada-titulo, #cruzada-subtitulo")) {
            renderCrosswordPreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (event.target.matches("#cruzada-grade")) {
            renderCrosswordPreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-crossword-add]");
        if (addButton) {
            event.preventDefault();
            addCrosswordEntry();
            return;
        }

        const removeButton = event.target.closest("[data-crossword-remove]");
        if (removeButton) {
            event.preventDefault();
            removeCrosswordEntry(removeButton);
            return;
        }

        const presentLink = event.target.closest('a[href="palavras-cruzadas-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("crossword");
        }
    });
});
