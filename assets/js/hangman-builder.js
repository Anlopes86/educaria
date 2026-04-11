function hangmanEscapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function readHangmanModelFile(file) {
    if (!file) return Promise.resolve("");

    return file.text().then((content) => {
        const fileName = String(file.name || "").toLowerCase();

        if (file.type === "text/plain" || fileName.endsWith(".txt")) {
            return content;
        }

        if (fileName.endsWith(".rtf")) {
            return String(content || "")
                .replace(/\\par[d]?/g, "\n")
                .replace(/\\'[0-9a-fA-F]{2}/g, "")
                .replace(/\\[a-z]+\d* ?/g, "")
                .replace(/[{}]/g, "")
                .replace(/\r/g, "")
                .replace(/\n{2,}/g, "\n")
                .trim();
        }

        return "";
    }).catch(() => "");
}

function hangmanEntryTemplate(index, answer = "", clue = "", category = "") {
    return `
        <section class="platform-question-card activity-content-card hangman-entry-card" data-hangman-entry>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-hangman-label>Palavra ${index + 1}</span>
                    <h3>Resposta e dica</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-hangman-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Palavra</label>
                    <input data-hangman-answer data-field="answer" type="text" value="${hangmanEscapeAttr(answer)}">
                </div>
                <div class="platform-field">
                    <label>Dica</label>
                    <input data-hangman-clue data-field="clue" type="text" value="${hangmanEscapeAttr(clue)}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Categoria opcional</label>
                    <input data-hangman-category data-field="category" type="text" value="${hangmanEscapeAttr(category)}">
                </div>
            </div>
        </section>
    `;
}

function parseHangmanTemplateText(sourceText) {
    const normalizedLines = String(sourceText || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    const entriesMap = new Map();
    let title = "";
    let subtitle = "";

    normalizedLines.forEach((line) => {
        const titleMatch = line.match(/^titulo da atividade\s*:\s*(.*)$/i);
        if (titleMatch) {
            title = String(titleMatch[1] || "").trim();
            return;
        }

        const subtitleMatch = line.match(/^instruc[aã]o ou contexto\s*:\s*(.*)$/i);
        if (subtitleMatch) {
            subtitle = String(subtitleMatch[1] || "").trim();
            return;
        }

        const answerMatch = line.match(/^palavra\s*(\d+)\s*:\s*(.*)$/i);
        if (answerMatch) {
            const index = Number(answerMatch[1] || 0);
            if (!entriesMap.has(index)) entriesMap.set(index, { answer: "", clue: "", category: "" });
            entriesMap.get(index).answer = String(answerMatch[2] || "").trim();
            return;
        }

        const clueMatch = line.match(/^dica\s*(\d+)\s*:\s*(.*)$/i);
        if (clueMatch) {
            const index = Number(clueMatch[1] || 0);
            if (!entriesMap.has(index)) entriesMap.set(index, { answer: "", clue: "", category: "" });
            entriesMap.get(index).clue = String(clueMatch[2] || "").trim();
            return;
        }

        const categoryMatch = line.match(/^categoria\s*(\d+)\s*:\s*(.*)$/i);
        if (categoryMatch) {
            const index = Number(categoryMatch[1] || 0);
            if (!entriesMap.has(index)) entriesMap.set(index, { answer: "", clue: "", category: "" });
            entriesMap.get(index).category = String(categoryMatch[2] || "").trim();
        }
    });

    const entries = [...entriesMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, value]) => value)
        .filter((entry) => entry.answer);

    if (entries.length < 2) {
        throw new Error("Preencha pelo menos duas palavras no modelo da forca.");
    }

    return { title, subtitle, entries };
}

function applyHangmanTemplateData(payload) {
    const stack = document.querySelector("[data-hangman-entries]");
    if (!stack) return false;

    const entries = Array.isArray(payload?.entries) ? payload.entries.filter((entry) => entry?.answer) : [];
    if (entries.length < 2) return false;

    const titleField = document.getElementById("forca-titulo");
    const subtitleField = document.getElementById("forca-subtitulo");

    if (titleField && payload.title) titleField.value = payload.title;
    if (subtitleField && payload.subtitle) subtitleField.value = payload.subtitle;

    stack.innerHTML = entries.map((entry, index) => (
        hangmanEntryTemplate(index, entry.answer || "", entry.clue || "", entry.category || "")
    )).join("");

    renumberHangmanEntries();
    renderHangmanPreview();
    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

async function loadHangmanModelFile(button) {
    const fileField = document.getElementById("forca-arquivo-modelo");
    const file = fileField?.files?.[0] || null;

    if (!file) {
        window.alert("Selecione um arquivo de apoio da forca antes de gerar.");
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Lendo modelo...";

    try {
        const fileText = await readHangmanModelFile(file);
        if (!fileText) {
            throw new Error("Use o arquivo modelo da forca em formato RTF ou TXT.");
        }

        const payload = parseHangmanTemplateText(fileText);
        if (!applyHangmanTemplateData(payload)) {
            throw new Error("O arquivo modelo da forca não trouxe dados suficientes.");
        }
    } catch (error) {
        const detail = error instanceof Error ? error.message : "Erro desconhecido.";
        window.alert(`Não foi possível montar a forca com o arquivo modelo.\n\nDetalhe: ${detail}`);
    } finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

function collectHangmanEntries() {
    return [...document.querySelectorAll("[data-hangman-entry]")].map((card, index) => ({
        id: `hangman-${index + 1}`,
        answer: card.querySelector("[data-hangman-answer]")?.value.trim() || "",
        clue: card.querySelector("[data-hangman-clue]")?.value.trim() || "",
        category: card.querySelector("[data-hangman-category]")?.value.trim() || ""
    }));
}

function renumberHangmanEntries() {
    document.querySelectorAll("[data-hangman-label]").forEach((label, index) => {
        label.textContent = `Palavra ${index + 1}`;
    });
}

function addHangmanEntry() {
    const stack = document.querySelector("[data-hangman-entries]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-hangman-entry]").length;
    stack.insertAdjacentHTML("beforeend", hangmanEntryTemplate(count));
    renumberHangmanEntries();
    renderHangmanPreview();
    document.dispatchEvent(new Event("input"));
}

function removeHangmanEntry(trigger) {
    const entries = [...document.querySelectorAll("[data-hangman-entry]")];
    if (entries.length <= 2) return;

    const card = trigger.closest("[data-hangman-entry]");
    if (!card) return;

    card.remove();
    renumberHangmanEntries();
    renderHangmanPreview();
    document.dispatchEvent(new Event("input"));
}

function renderHangmanPreview() {
    const api = window.EducarIAHangman;
    if (!api) return;

    renumberHangmanEntries();

    const title = document.getElementById("forca-titulo")?.value.trim() || "Jogo da Forca";
    const subtitle = document.getElementById("forca-subtitulo")?.value.trim() || "Descubra as palavras usando as dicas.";
    const maxErrors = Number(document.getElementById("forca-tentativas")?.value || 6);
    const entries = api.sanitizeEntries(collectHangmanEntries());
    const entry = entries[0] || null;
    const titleRoot = document.querySelector("[data-hangman-preview-title]");
    const subtitleRoot = document.querySelector("[data-hangman-preview-subtitle]");
    const countRoot = document.querySelector("[data-hangman-preview-count]");
    const attemptsRoot = document.querySelector("[data-hangman-preview-attempts]");
    const wordRoot = document.querySelector("[data-hangman-preview-word]");
    const clueRoot = document.querySelector("[data-hangman-preview-clue]");
    const categoryRoot = document.querySelector("[data-hangman-preview-category]");
    const noteRoot = document.querySelector("[data-hangman-preview-note]");
    const listRoot = document.querySelector("[data-hangman-preview-list]");

    if (titleRoot) titleRoot.textContent = title;
    if (subtitleRoot) subtitleRoot.textContent = subtitle;
    if (countRoot) countRoot.textContent = `${entries.length} ${entries.length === 1 ? "palavra" : "palavras"}`;
    if (attemptsRoot) attemptsRoot.textContent = `${maxErrors} erros`;

    if (entry) {
        const mask = api.buildMask(entry, new Set(), false);
        if (wordRoot) {
            wordRoot.innerHTML = mask.map((token) => `
                <span class="hangman-letter-slot ${token.guessable ? "" : "is-static"}">${api.escapeHtml(token.display)}</span>
            `).join("");
        }
        if (clueRoot) clueRoot.textContent = entry.clue || "Adicione uma dica para orientar a turma.";
        if (categoryRoot) {
            categoryRoot.textContent = entry.category || "Sem categoria";
        }
    } else {
        if (wordRoot) {
            wordRoot.innerHTML = `
                <div class="hangman-empty-state">
                    <strong>Adicione pelo menos 2 palavras v&aacute;lidas</strong>
                    <span>O preview da for&ccedil;a aparece aqui assim que houver conte&uacute;do suficiente.</span>
                </div>
            `;
        }
        if (clueRoot) clueRoot.textContent = "As dicas aparecem aqui.";
        if (categoryRoot) categoryRoot.textContent = "Sem categoria";
    }

    if (listRoot) {
        listRoot.innerHTML = entries.length
            ? entries.map((item, index) => `
                <li>
                    <strong>${index + 1}.</strong>
                    <span>${api.escapeHtml(item.clue || item.answer)}</span>
                </li>
            `).join("")
            : `<li><span>Nenhuma palavra pronta ainda.</span></li>`;
    }

    if (noteRoot) {
        const message = entries.length < 2
            ? "Cadastre pelo menos duas palavras para montar uma rodada completa."
            : "O preview mostra a primeira palavra da sequ&ecirc;ncia.";
        noteRoot.hidden = false;
        noteRoot.textContent = message;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renumberHangmanEntries();
    renderHangmanPreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-hangman-entry]") || event.target.matches("#forca-titulo, #forca-subtitulo")) {
            renderHangmanPreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (event.target.matches("#forca-tentativas")) {
            renderHangmanPreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-hangman-add]");
        if (addButton) {
            event.preventDefault();
            addHangmanEntry();
            return;
        }

        const removeButton = event.target.closest("[data-hangman-remove]");
        if (removeButton) {
            event.preventDefault();
            removeHangmanEntry(removeButton);
            return;
        }

        const presentLink = event.target.closest('a[href="forca-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("hangman");
        }

        const loadModelButton = event.target.closest("[data-hangman-load-model]");
        if (loadModelButton) {
            event.preventDefault();
            loadHangmanModelFile(loadModelButton);
        }
    });
});
