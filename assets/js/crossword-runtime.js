const CROSSWORD_DRAFT_KEY = "educaria:builder:crossword";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readCrosswordDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(CROSSWORD_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA crossword unavailable:", error);
        return null;
    }
}

function parseCrosswordEntries(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-crossword-entry]")].map((card, index) => ({
        id: `crossword-${index + 1}`,
        answer: card.querySelector("[data-crossword-answer]")?.value?.trim()
            || card.querySelector('[data-field="answer"]')?.value?.trim()
            || "",
        clue: card.querySelector("[data-crossword-clue]")?.value?.trim()
            || card.querySelector('[data-field="clue"]')?.value?.trim()
            || ""
    }));
}

function buildRuntimeClueMarkup(entries, solvedIds) {
    const api = window.EducarIACrossword;
    if (!entries.length) {
        return `<p class="crossword-clues-empty">Nenhuma pista neste grupo.</p>`;
    }

    return `
        <ol class="crossword-clue-list">
            ${entries.map((entry) => `
                <li class="${solvedIds.has(entry.id) ? "is-solved" : ""}">
                    <strong>${entry.number}.</strong>
                    <span>${api.escapeHtml(entry.clue || entry.answer || "Sem pista")}</span>
                </li>
            `).join("")}
        </ol>
    `;
}

function buildCrosswordNavigation(puzzle) {
    const cells = new Map();

    function ensureCell(key) {
        if (!cells.has(key)) {
            cells.set(key, { across: null, down: null });
        }
        return cells.get(key);
    }

    puzzle.placedEntries.forEach((entry) => {
        for (let index = 0; index < entry.cleanAnswer.length; index += 1) {
            const row = entry.orientation === "across" ? entry.row : entry.row + index;
            const col = entry.orientation === "across" ? entry.col + index : entry.col;
            const key = `${row}-${col}`;
            const previousKey = index > 0
                ? (entry.orientation === "across"
                    ? `${row}-${col - 1}`
                    : `${row - 1}-${col}`)
                : "";
            const nextKey = index < entry.cleanAnswer.length - 1
                ? (entry.orientation === "across"
                    ? `${row}-${col + 1}`
                    : `${row + 1}-${col}`)
                : "";

            ensureCell(key)[entry.orientation] = {
                previousKey,
                nextKey,
                entryId: entry.id
            };
        }
    });

    return cells;
}

function renderCrosswordApplication() {
    const api = window.EducarIACrossword;
    if (!api) return;

    const draft = readCrosswordDraft();
    const controls = draft?.controls || {};
    const entries = parseCrosswordEntries(draft?.stackHtml || "");
    const fallbackEntries = [
        { answer: "RIO", clue: "Curso de água" },
        { answer: "SERRA", clue: "Relevo elevado" },
        { answer: "CLIMA", clue: "Condição atmosférica" },
        { answer: "MAPA", clue: "Representação de um espaço" }
    ];
    const title = String(controls["cruzada-titulo"] || "").trim() || "Palavras cruzadas";
    const subtitle = String(controls["cruzada-subtitulo"] || "").trim() || "Preencha as respostas usando as pistas horizontais e verticais.";
    const size = Number(controls["cruzada-grade"] || 11);
    const puzzle = api.createPuzzle({
        size,
        entries: entries.length ? entries : fallbackEntries
    });

    const titleRoot = document.querySelector("[data-crossword-stage-title]");
    const subtitleRoot = document.querySelector("[data-crossword-stage-subtitle]");
    const countRoot = document.querySelector("[data-crossword-stage-count]");
    const sizeRoot = document.querySelector("[data-crossword-stage-size]");
    const boardRoot = document.querySelector("[data-crossword-stage-board]");
    const acrossRoot = document.querySelector("[data-crossword-stage-across]");
    const downRoot = document.querySelector("[data-crossword-stage-down]");
    const noteRoot = document.querySelector("[data-crossword-stage-note]");
    const toggleButton = document.querySelector("[data-crossword-toggle-solution]");
    const checkButton = document.querySelector("[data-crossword-check]");

    const values = {};
    const correctCells = new Set();
    const incorrectCells = new Set();
    const solvedIds = new Set();
    const navigation = buildCrosswordNavigation(puzzle);
    let revealAnswers = false;
    let activeCellKey = "";
    let activeDirection = "across";

    function keyForEntryCell(entry, index) {
        return entry.orientation === "across"
            ? `${entry.row}-${entry.col + index}`
            : `${entry.row + index}-${entry.col}`;
    }

    function cellMeta(key) {
        return navigation.get(key) || null;
    }

    function resolveDirection(key, preferredDirection = activeDirection) {
        const meta = cellMeta(key);
        if (!meta) return "";
        if (preferredDirection && meta[preferredDirection]) return preferredDirection;
        if (meta.across) return "across";
        if (meta.down) return "down";
        return "";
    }

    function neighborKey(key, direction, step) {
        const meta = cellMeta(key);
        if (!meta || !meta[direction]) return "";
        return meta[direction][step] || "";
    }

    function setActiveCell(key, options = {}) {
        const meta = cellMeta(key);
        if (!meta) return;

        const toggleIfSame = options.toggleIfSame === true;
        const preferredDirection = options.preferredDirection || activeDirection;
        let nextDirection = resolveDirection(key, preferredDirection);
        if (!nextDirection) return;

        if (toggleIfSame && key === activeCellKey) {
            const alternateDirection = nextDirection === "across" ? "down" : "across";
            if (meta[alternateDirection]) {
                nextDirection = alternateDirection;
            }
        }

        activeCellKey = key;
        activeDirection = nextDirection;
    }

    function focusCell(key, options = {}) {
        if (!key || revealAnswers) return false;
        setActiveCell(key, options);

        const input = boardRoot?.querySelector(`[data-crossword-input="${key}"]`);
        if (!input) return false;

        input.focus();
        if (options.select !== false) {
            input.select();
        }
        return true;
    }

    function recomputeSolvedEntries() {
        solvedIds.clear();

        puzzle.placedEntries.forEach((entry) => {
            const typed = Array.from({ length: entry.cleanAnswer.length }, (_, index) => {
                return String(values[keyForEntryCell(entry, index)] || "").toUpperCase();
            }).join("");

            if (typed && typed === entry.cleanAnswer) {
                solvedIds.add(entry.id);
            }
        });
    }

    function renderClues() {
        if (acrossRoot) acrossRoot.innerHTML = buildRuntimeClueMarkup(puzzle.acrossEntries, solvedIds);
        if (downRoot) downRoot.innerHTML = buildRuntimeClueMarkup(puzzle.downEntries, solvedIds);
    }

    function paintBoard() {
        if (!boardRoot) return;
        boardRoot.innerHTML = api.buildBoardMarkup(puzzle, {
            mode: "play",
            revealAnswers,
            values,
            correctCells,
            incorrectCells
        });

        if (!revealAnswers && activeCellKey) {
            window.requestAnimationFrame(() => {
                focusCell(activeCellKey, {
                    preferredDirection: activeDirection
                });
            });
        }
    }

    function resetNote() {
        if (!noteRoot) return;

        let message = "Preencha as letras e use Conferir para validar a cruzadinha.";
        if (puzzle.omittedEntries.length) {
            message = `${puzzle.omittedEntries.length} ${puzzle.omittedEntries.length === 1 ? "entrada ficou de fora" : "entradas ficaram de fora"} da grade atual.`;
        } else if (puzzle.sizeAdjusted) {
            message = `A grade foi ampliada para ${puzzle.size} x ${puzzle.size} para acomodar todas as respostas.`;
        }

        noteRoot.hidden = false;
        noteRoot.textContent = message;
    }

    function evaluateBoard() {
        correctCells.clear();
        incorrectCells.clear();

        puzzle.grid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (!cell) return;
                const key = `${rowIndex}-${colIndex}`;
                const typed = String(values[key] || "").toUpperCase();
                if (!typed) return;

                if (typed === cell.letter) {
                    correctCells.add(key);
                } else {
                    incorrectCells.add(key);
                }
            });
        });

        recomputeSolvedEntries();
        renderClues();
        paintBoard();

        if (noteRoot) {
            const totalActive = puzzle.grid.flat().filter(Boolean).length;
            noteRoot.hidden = false;
            noteRoot.textContent = `${correctCells.size} de ${totalActive} letras corretas.`;
        }
    }

    if (titleRoot) titleRoot.textContent = title;
    if (subtitleRoot) subtitleRoot.textContent = subtitle;
    if (countRoot) countRoot.textContent = `${puzzle.placedEntries.length} ${puzzle.placedEntries.length === 1 ? "entrada" : "entradas"}`;
    if (sizeRoot) sizeRoot.textContent = `${puzzle.rows} x ${puzzle.cols}`;

    renderClues();
    paintBoard();
    resetNote();

    boardRoot?.addEventListener("focusin", (event) => {
        const input = event.target.closest("[data-crossword-input]");
        if (!input) return;

        setActiveCell(input.dataset.crosswordInput || "", {
            preferredDirection: activeDirection
        });
    });

    boardRoot?.addEventListener("keydown", (event) => {
        const input = event.target.closest("[data-crossword-input]");
        if (!input) return;

        const key = input.dataset.crosswordInput || "";
        const direction = resolveDirection(key);
        if (!direction) return;

        if (event.key === "Backspace") {
            const currentValue = api.normalizeAnswer(input.value).slice(0, 1);
            if (currentValue) {
                return;
            }

            const previousKey = neighborKey(key, direction, "previousKey");
            if (!previousKey) return;

            event.preventDefault();
            values[previousKey] = "";
            correctCells.delete(previousKey);
            incorrectCells.delete(previousKey);
            recomputeSolvedEntries();
            renderClues();
            focusCell(previousKey, {
                preferredDirection: direction
            });
            const previousInput = boardRoot.querySelector(`[data-crossword-input="${previousKey}"]`);
            if (previousInput) {
                previousInput.value = "";
            }
            return;
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            focusCell(neighborKey(key, "across", "nextKey") || key, {
                preferredDirection: "across"
            });
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            focusCell(neighborKey(key, "across", "previousKey") || key, {
                preferredDirection: "across"
            });
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusCell(neighborKey(key, "down", "nextKey") || key, {
                preferredDirection: "down"
            });
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            focusCell(neighborKey(key, "down", "previousKey") || key, {
                preferredDirection: "down"
            });
        }
    });

    boardRoot?.addEventListener("input", (event) => {
        const input = event.target.closest("[data-crossword-input]");
        if (!input) return;

        const key = input.dataset.crosswordInput || "";
        const value = api.normalizeAnswer(input.value).slice(0, 1);
        const direction = resolveDirection(key);
        values[key] = value;
        input.value = value;
        correctCells.delete(key);
        incorrectCells.delete(key);
        recomputeSolvedEntries();
        renderClues();

        if (value && direction) {
            const nextKey = neighborKey(key, direction, "nextKey");
            if (nextKey) {
                focusCell(nextKey, {
                    preferredDirection: direction
                });
            }
        }
    });

    checkButton?.addEventListener("click", () => {
        revealAnswers = false;
        if (toggleButton) toggleButton.textContent = "Mostrar gabarito";
        evaluateBoard();
    });

    toggleButton?.addEventListener("click", () => {
        revealAnswers = !revealAnswers;
        toggleButton.textContent = revealAnswers ? "Ocultar gabarito" : "Mostrar gabarito";
        if (revealAnswers) {
            correctCells.clear();
            incorrectCells.clear();
            if (noteRoot) {
                noteRoot.hidden = false;
                noteRoot.textContent = "Gabarito exibido.";
            }
        } else {
            resetNote();
        }
        paintBoard();
    });
}

document.addEventListener("DOMContentLoaded", renderCrosswordApplication);
