const HANGMAN_DRAFT_KEY = "educaria:builder:hangman";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readHangmanDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(HANGMAN_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA hangman unavailable:", error);
        return null;
    }
}

function parseHangmanEntries(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-hangman-entry]")].map((card, index) => ({
        id: `hangman-${index + 1}`,
        answer: card.querySelector("[data-hangman-answer]")?.value?.trim()
            || card.querySelector('[data-field="answer"]')?.value?.trim()
            || "",
        clue: card.querySelector("[data-hangman-clue]")?.value?.trim()
            || card.querySelector('[data-field="clue"]')?.value?.trim()
            || "",
        category: card.querySelector("[data-hangman-category]")?.value?.trim()
            || card.querySelector('[data-field="category"]')?.value?.trim()
            || ""
    }));
}

function renderHangmanApplication() {
    const api = window.EducarIAHangman;
    if (!api) return;

    const draft = readHangmanDraft();
    const controls = draft?.controls || {};
    const fallbackEntries = [
        { answer: "PLANETA", clue: "Corpo celeste que orbita uma estrela", category: "Astronomia" },
        { answer: "MAPA", clue: "Representacao visual de um territorio", category: "Geografia" },
        { answer: "FRASE", clue: "Conjunto organizado de palavras", category: "Lingua portuguesa" }
    ];
    const entries = api.sanitizeEntries(parseHangmanEntries(draft?.stackHtml || ""));
    const rounds = entries.length ? entries : api.sanitizeEntries(fallbackEntries);
    const title = String(controls["forca-titulo"] || "").trim() || "Jogo da Força";
    const subtitle = String(controls["forca-subtitulo"] || "").trim() || "Descubra as palavras usando as dicas.";
    const maxErrors = Math.max(4, Math.min(8, Number(controls["forca-tentativas"] || 6)));
    const titleRoot = document.querySelector("[data-hangman-stage-title]");
    const subtitleRoot = document.querySelector("[data-hangman-stage-subtitle]");
    const countRoot = document.querySelector("[data-hangman-stage-count]");
    const attemptsRoot = document.querySelector("[data-hangman-stage-attempts]");
    const roundRoot = document.querySelector("[data-hangman-stage-round]");
    const wordRoot = document.querySelector("[data-hangman-stage-word]");
    const clueRoot = document.querySelector("[data-hangman-stage-clue]");
    const categoryRoot = document.querySelector("[data-hangman-stage-category]");
    const wrongRoot = document.querySelector("[data-hangman-stage-wrong]");
    const figureRoot = document.querySelector("[data-hangman-stage-figure]");
    const keyboardRoot = document.querySelector("[data-hangman-stage-keyboard]");
    const noteRoot = document.querySelector("[data-hangman-stage-note]");
    const listRoot = document.querySelector("[data-hangman-stage-list]");
    const prevButton = document.querySelector("[data-hangman-prev]");
    const nextButton = document.querySelector("[data-hangman-next]");
    const resetButton = document.querySelector("[data-hangman-reset]");
    const revealButton = document.querySelector("[data-hangman-reveal]");
    let currentIndex = 0;
    let guessedLetters = new Set();
    let wrongLetters = new Set();
    let revealAnswer = false;

    function currentEntry() {
        return rounds[currentIndex] || rounds[0] || null;
    }

    function currentMaskedWord() {
        return api.buildMask(currentEntry(), guessedLetters, revealAnswer);
    }

    function roundSolved(entry) {
        return api.isSolved(entry, guessedLetters) || revealAnswer;
    }

    function roundFailed() {
        return wrongLetters.size >= maxErrors && !roundSolved(currentEntry());
    }

    function roundFinished() {
        return roundSolved(currentEntry()) || roundFailed();
    }

    function resetRound() {
        guessedLetters = new Set();
        wrongLetters = new Set();
        revealAnswer = false;
    }

    function statusMessage(entry) {
        if (!entry) return "Adicione palavras para jogar a for\u00e7a.";
        if (revealAnswer) return "Resposta exibida.";
        if (roundFailed()) return `Fim da rodada. A palavra era ${entry.answer || entry.cleanAnswer}.`;
        if (roundSolved(entry)) return "Palavra descoberta.";
        return "Escolha letras no teclado para tentar descobrir a palavra.";
    }

    function renderKeyboard() {
        if (!keyboardRoot) return;

        keyboardRoot.innerHTML = api.keyboardRows().map((row) => `
            <div class="hangman-keyboard-row">
                ${row.map((letter) => {
                    const guessed = guessedLetters.has(letter) || wrongLetters.has(letter);
                    const correct = guessedLetters.has(letter);
                    const wrong = wrongLetters.has(letter);

                    return `
                        <button
                            type="button"
                            class="hangman-key ${correct ? "is-correct" : ""} ${wrong ? "is-wrong" : ""}"
                            data-hangman-letter="${letter}"
                            ${guessed || roundFinished() ? "disabled" : ""}
                        >${letter}</button>
                    `;
                }).join("")}
            </div>
        `).join("");
    }

    function renderRounds() {
        if (!listRoot) return;

        listRoot.innerHTML = rounds.map((entry, index) => {
            const stateClass = index === currentIndex ? "is-current" : "";
            const solved = index === currentIndex && roundSolved(entry) ? "is-solved" : "";
            const summary = entry.clue || entry.category || "Dica não informada";
            return `
                <button type="button" class="hangman-round-item ${stateClass} ${solved}" data-hangman-round="${index}">
                    <strong>${index + 1}</strong>
                    <span>${api.escapeHtml(summary)}</span>
                </button>
            `;
        }).join("");
    }

    function renderWordMask(mask) {
        const groups = [];
        let currentGroup = [];

        mask.forEach((token) => {
            if (token.char === " ") {
                if (currentGroup.length) {
                    groups.push(currentGroup);
                    currentGroup = [];
                }
                return;
            }

            currentGroup.push(token);
        });

        if (currentGroup.length) {
            groups.push(currentGroup);
        }

        return groups.map((group) => `
            <span class="hangman-word-group">
                ${group.map((token) => `
                    <span class="hangman-letter-slot ${token.guessable ? "" : "is-static"} ${token.visible && token.guessable ? "is-revealed" : ""}">
                        ${api.escapeHtml(token.display)}
                    </span>
                `).join("")}
            </span>
        `).join("");
    }

    function renderStage() {
        const entry = currentEntry();
        const mask = currentMaskedWord();

        if (titleRoot) titleRoot.textContent = title;
        if (subtitleRoot) subtitleRoot.textContent = subtitle;
        if (countRoot) countRoot.textContent = `${rounds.length} ${rounds.length === 1 ? "palavra" : "palavras"}`;
        if (attemptsRoot) attemptsRoot.textContent = `${wrongLetters.size}/${maxErrors} erros`;
        if (roundRoot) roundRoot.textContent = `Rodada ${currentIndex + 1} de ${rounds.length}`;
        if (clueRoot) clueRoot.textContent = entry?.clue || "Sem dica informada.";
        if (categoryRoot) categoryRoot.textContent = entry?.category || "Sem categoria";
        if (wrongRoot) wrongRoot.textContent = wrongLetters.size ? [...wrongLetters].join(", ") : "Nenhuma letra errada ainda.";

        if (wordRoot) {
            wordRoot.innerHTML = renderWordMask(mask);
        }

        if (figureRoot) {
            figureRoot.dataset.errors = String(wrongLetters.size);
        }

        if (noteRoot) {
            noteRoot.hidden = false;
            noteRoot.textContent = statusMessage(entry);
        }

        if (prevButton) prevButton.disabled = currentIndex === 0;
        if (nextButton) nextButton.disabled = currentIndex === rounds.length - 1;
        if (revealButton) revealButton.textContent = revealAnswer ? "Ocultar resposta" : "Mostrar resposta";

        renderKeyboard();
        renderRounds();
    }

    function applyGuess(letter) {
        const entry = currentEntry();
        if (!entry || roundFinished()) return;

        const normalizedLetter = api.normalizeAnswer(letter).slice(0, 1);
        if (!normalizedLetter || guessedLetters.has(normalizedLetter) || wrongLetters.has(normalizedLetter)) return;

        if (entry.guessableSet.has(normalizedLetter)) {
            guessedLetters.add(normalizedLetter);
        } else {
            wrongLetters.add(normalizedLetter);
        }

        renderStage();
    }

    keyboardRoot?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-hangman-letter]");
        if (!button) return;
        applyGuess(button.dataset.hangmanLetter || "");
    });

    listRoot?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-hangman-round]");
        if (!button) return;

        currentIndex = Number(button.dataset.hangmanRound || 0);
        resetRound();
        renderStage();
    });

    prevButton?.addEventListener("click", () => {
        if (currentIndex <= 0) return;
        currentIndex -= 1;
        resetRound();
        renderStage();
    });

    nextButton?.addEventListener("click", () => {
        if (currentIndex >= rounds.length - 1) return;
        currentIndex += 1;
        resetRound();
        renderStage();
    });

    resetButton?.addEventListener("click", () => {
        resetRound();
        renderStage();
    });

    revealButton?.addEventListener("click", () => {
        revealAnswer = !revealAnswer;
        renderStage();
    });

    document.addEventListener("keydown", (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName)) return;

        const key = api.normalizeAnswer(event.key).slice(0, 1);
        if (!key) return;

        applyGuess(key);
    });

    renderStage();
}

document.addEventListener("DOMContentLoaded", renderHangmanApplication);
