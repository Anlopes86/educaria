function wordsearchEscapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function wordsearchCardTemplate(index, term = "", clue = "") {
    return `
        <section class="platform-question-card activity-content-card wordsearch-word-card" data-wordsearch-word>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-wordsearch-label>Palavra ${index + 1}</span>
                    <h3>Conteúdo da palavra</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-wordsearch-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Palavra</label>
                    <input data-wordsearch-term data-field="term" type="text" value="${wordsearchEscapeAttr(term)}">
                </div>
                <div class="platform-field">
                    <label>Pista opcional</label>
                    <input data-wordsearch-clue data-field="clue" type="text" value="${wordsearchEscapeAttr(clue)}">
                </div>
            </div>
        </section>
    `;
}

function collectWordsearchWords() {
    return [...document.querySelectorAll("[data-wordsearch-word]")].map((card, index) => ({
        id: `word-${index + 1}`,
        term: card.querySelector("[data-wordsearch-term]")?.value.trim() || "",
        clue: card.querySelector("[data-wordsearch-clue]")?.value.trim() || ""
    }));
}

function renumberWordsearchCards() {
    document.querySelectorAll("[data-wordsearch-label]").forEach((label, index) => {
        label.textContent = `Palavra ${index + 1}`;
    });
}

function addWordsearchCard() {
    const stack = document.querySelector("[data-wordsearch-words]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-wordsearch-word]").length;
    stack.insertAdjacentHTML("beforeend", wordsearchCardTemplate(count));
    renumberWordsearchCards();
    renderWordsearchPreview();
    document.dispatchEvent(new Event("input"));
}

function removeWordsearchCard(trigger) {
    const cards = [...document.querySelectorAll("[data-wordsearch-word]")];
    if (cards.length <= 2) return;

    const card = trigger.closest("[data-wordsearch-word]");
    if (!card) return;

    card.remove();
    renumberWordsearchCards();
    renderWordsearchPreview();
    document.dispatchEvent(new Event("input"));
}

function buildWordsearchBankMarkup(entries) {
    const api = window.EducarIAWordsearch;
    return entries.map((entry) => {
        const modifier = entry.row >= 0 ? "" : " wordsearch-bank-item--muted";
        const detail = entry.clue ? `<span>${api.escapeHtml(entry.clue)}</span>` : "";
        const status = entry.row >= 0 ? "" : `<em>Não coube na grade atual</em>`;
        return `
            <article class="wordsearch-bank-item${modifier}">
                <strong>${api.escapeHtml(entry.term || entry.cleanTerm || "Palavra")}</strong>
                ${detail}
                ${status}
            </article>
        `;
    }).join("");
}

function renderWordsearchPreview() {
    const api = window.EducarIAWordsearch;
    if (!api) return;

    renumberWordsearchCards();

    const title = document.getElementById("caca-titulo")?.value.trim() || "Novo caça-palavras";
    const subtitle = document.getElementById("caca-subtitulo")?.value.trim() || "Adicione palavras para montar a grade.";
    const requestedSize = Number(document.getElementById("caca-grade")?.value || 12);
    const mode = document.getElementById("caca-direcoes")?.value || "diagonal";
    const words = collectWordsearchWords();
    const puzzle = api.createPuzzle({
        size: requestedSize,
        mode,
        words,
        seed: `${title}|${subtitle}|${requestedSize}|${mode}`
    });

    const titleRoot = document.querySelector("[data-wordsearch-preview-title]");
    const subtitleRoot = document.querySelector("[data-wordsearch-preview-subtitle]");
    const countRoot = document.querySelector("[data-wordsearch-preview-count]");
    const sizeRoot = document.querySelector("[data-wordsearch-preview-size]");
    const modeRoot = document.querySelector("[data-wordsearch-preview-mode]");
    const boardRoot = document.querySelector("[data-wordsearch-preview-board]");
    const bankRoot = document.querySelector("[data-wordsearch-preview-bank]");
    const noteRoot = document.querySelector("[data-wordsearch-preview-note]");

    if (titleRoot) titleRoot.textContent = title;
    if (subtitleRoot) subtitleRoot.textContent = subtitle;
    if (countRoot) countRoot.textContent = `${puzzle.entries.length} ${puzzle.entries.length === 1 ? "palavra" : "palavras"}`;
    if (sizeRoot) sizeRoot.textContent = `${puzzle.rows} x ${puzzle.cols}`;
    if (modeRoot) modeRoot.textContent = api.directionLabel(mode);

    if (boardRoot) {
        if (puzzle.entries.length >= 2) {
            boardRoot.innerHTML = api.buildBoardMarkup(puzzle);
        } else {
            boardRoot.innerHTML = `
                <div class="wordsearch-empty-state">
                    <strong>Adicione pelo menos 2 palavras</strong>
                    <span>A grade aparece aqui assim que houver conteúdo suficiente.</span>
                </div>
            `;
        }
    }

    if (bankRoot) {
        if (puzzle.entries.length) {
            bankRoot.innerHTML = buildWordsearchBankMarkup(puzzle.entries);
        } else {
            bankRoot.innerHTML = `
                <article class="wordsearch-bank-item wordsearch-bank-item--muted">
                    <strong>Lista vazia</strong>
                    <span>Use os cards ao lado para montar o banco de palavras.</span>
                </article>
            `;
        }
    }

    if (noteRoot) {
        let message = "";

        if (puzzle.entries.length < 2) {
            message = "O preview completo aparece quando houver pelo menos duas palavras válidas.";
        } else if (puzzle.omittedEntries.length) {
            message = `${puzzle.omittedEntries.length} ${puzzle.omittedEntries.length === 1 ? "palavra não entrou" : "palavras não entraram"} na grade atual. Tente aumentar o tamanho ou reduzir a lista.`;
        } else if (puzzle.sizeAdjusted) {
            message = `A grade foi ampliada para ${puzzle.rows} x ${puzzle.cols} para acomodar todas as palavras.`;
        }

        noteRoot.hidden = !message;
        noteRoot.textContent = message;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renumberWordsearchCards();
    renderWordsearchPreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-wordsearch-word]") || event.target.matches("#caca-titulo, #caca-subtitulo")) {
            renderWordsearchPreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (event.target.matches("#caca-grade, #caca-direcoes")) {
            renderWordsearchPreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-wordsearch-add]");
        if (addButton) {
            event.preventDefault();
            addWordsearchCard();
            return;
        }

        const removeButton = event.target.closest("[data-wordsearch-remove]");
        if (removeButton) {
            event.preventDefault();
            removeWordsearchCard(removeButton);
            return;
        }

        const presentLink = event.target.closest('a[href="caca-palavras-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("wordsearch");
        }
    });
});
