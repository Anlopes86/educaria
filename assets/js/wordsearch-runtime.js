const WORDSEARCH_DRAFT_KEY = "educaria:builder:wordsearch";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readWordsearchDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(WORDSEARCH_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA wordsearch unavailable:", error);
        return null;
    }
}

function parseWordsearchWords(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-wordsearch-word]")].map((card, index) => ({
        id: `word-${index + 1}`,
        term: card.querySelector("[data-wordsearch-term]")?.value?.trim()
            || card.querySelector('[data-field="term"]')?.value?.trim()
            || "",
        clue: card.querySelector("[data-wordsearch-clue]")?.value?.trim()
            || card.querySelector('[data-field="clue"]')?.value?.trim()
            || ""
    }));
}

function buildRuntimeBankMarkup(entries) {
    const api = window.EducarIAWordsearch;
    return entries.map((entry) => {
        const modifier = entry.row >= 0 ? "" : " wordsearch-bank-item--muted";
        const disabled = entry.row >= 0 ? "" : " disabled";
        const clickable = entry.row >= 0 ? " data-wordsearch-entry-button" : "";
        const detail = entry.clue ? `<span>${api.escapeHtml(entry.clue)}</span>` : "";
        const status = entry.row >= 0 ? "" : `<em>Fora da grade atual</em>`;
        return `
            <button type="button" class="wordsearch-bank-item${modifier}" data-wordsearch-entry="${api.escapeHtml(entry.id || "")}"${clickable}${disabled}>
                <strong>${api.escapeHtml(entry.term || entry.cleanTerm || "Palavra")}</strong>
                ${detail}
                ${status}
            </button>
        `;
    }).join("");
}

function renderWordsearchApplication() {
    const api = window.EducarIAWordsearch;
    if (!api) return;

    const draft = readWordsearchDraft();
    const controls = draft?.controls || {};
    const words = parseWordsearchWords(draft?.stackHtml || "");
    const fallbackWords = [
        { term: "RIO", clue: "Curso de agua" },
        { term: "SERRA", clue: "Relevo elevado" },
        { term: "PLANALTO", clue: "Forma de relevo" },
        { term: "CLIMA", clue: "Condicao atmosferica" }
    ];
    const title = String(controls["caca-titulo"] || "").trim() || "Caça-palavras";
    const subtitle = String(controls["caca-subtitulo"] || "").trim() || "Encontre os termos escondidos na grade.";
    const requestedSize = Number(controls["caca-grade"] || 12);
    const mode = controls["caca-direcoes"] || "diagonal";
    const puzzle = api.createPuzzle({
        size: requestedSize,
        mode,
        words: words.length ? words : fallbackWords,
        seed: `${title}|${subtitle}|${requestedSize}|${mode}`
    });

    const titleRoot = document.querySelector("[data-wordsearch-stage-title]");
    const subtitleRoot = document.querySelector("[data-wordsearch-stage-subtitle]");
    const countRoot = document.querySelector("[data-wordsearch-stage-count]");
    const sizeRoot = document.querySelector("[data-wordsearch-stage-size]");
    const modeRoot = document.querySelector("[data-wordsearch-stage-mode]");
    const boardRoot = document.querySelector("[data-wordsearch-stage-board]");
    const bankRoot = document.querySelector("[data-wordsearch-stage-bank]");
    const noteRoot = document.querySelector("[data-wordsearch-stage-note]");
    const toggleButton = document.querySelector("[data-wordsearch-toggle-solution]");
    const highlightPalette = ["#14b8a6", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#22c55e", "#ef4444", "#6366f1"];

    let revealSolution = false;
    const activeEntryIds = [];
    const foundEntryIds = [];
    let pendingStartKey = "";
    let pendingSelectionCells = new Set();
    let feedbackTimer = 0;
    const entryColors = new Map(
        puzzle.placedEntries.map((entry, index) => [
            entry.id,
            highlightPalette[index % highlightPalette.length]
        ])
    );
    const placedEntryMap = new Map(
        puzzle.placedEntries.flatMap((entry) => {
            const cells = cellsForEntry(entry);
            const key = cells.join("|");
            const reversedKey = [...cells].reverse().join("|");
            return [[key, entry], [reversedKey, entry]];
        })
    );

    function directionVectorByKey(key) {
        return [
            { key: "E", row: 0, col: 1 },
            { key: "W", row: 0, col: -1 },
            { key: "S", row: 1, col: 0 },
            { key: "N", row: -1, col: 0 },
            { key: "SE", row: 1, col: 1 },
            { key: "SW", row: 1, col: -1 },
            { key: "NE", row: -1, col: 1 },
            { key: "NW", row: -1, col: -1 }
        ].find((item) => item.key === key) || { row: 0, col: 1 };
    }

    function cellsForEntry(entry) {
        const direction = directionVectorByKey(entry.direction);
        return Array.from({ length: entry.cleanTerm.length }, (_, index) => {
            const row = entry.row + direction.row * index;
            const col = entry.col + direction.col * index;
            return `${row}-${col}`;
        });
    }

    function highlightMapForActiveEntries() {
        const map = new Map();

        const visibleEntryIds = [...new Set([...foundEntryIds, ...activeEntryIds])];

        visibleEntryIds.forEach((entryId) => {
            const entry = puzzle.placedEntries.find((item) => item.id === entryId);
            if (!entry) return;

            const color = entryColors.get(entry.id) || "#14b8a6";
            cellsForEntry(entry).forEach((cellKey) => {
                map.set(cellKey, { style: `--wordsearch-highlight:${color};` });
            });
        });

        pendingSelectionCells.forEach((cellKey) => {
            if (!map.has(cellKey)) {
                map.set(cellKey, { className: "is-selection-preview" });
            }
        });

        return map;
    }

    function showInstruction(message) {
        if (!noteRoot) return;
        window.clearTimeout(feedbackTimer);
        noteRoot.hidden = false;
        noteRoot.textContent = message;
    }

    function resetNoteMessage() {
        if (!noteRoot) return;

        window.clearTimeout(feedbackTimer);
        let message = "Clique na primeira e na última letra da palavra para tentar encontrá-la.";
        if (puzzle.omittedEntries.length) {
            message = `${puzzle.omittedEntries.length} ${puzzle.omittedEntries.length === 1 ? "palavra ficou de fora" : "palavras ficaram de fora"} da grade atual.`;
        } else if (puzzle.sizeAdjusted) {
            message = `A grade foi ampliada automaticamente para ${puzzle.rows} x ${puzzle.cols}. Clique na primeira e na última letra da palavra para tentar encontrá-la.`;
        }
        noteRoot.hidden = false;
        noteRoot.textContent = message;
    }

    function syncBankSelectionState() {
        bankRoot?.querySelectorAll("[data-wordsearch-entry]").forEach((button) => {
            const entryId = button.getAttribute("data-wordsearch-entry") || "";
            const color = entryColors.get(entryId) || "#cbd5e1";
            button.style.setProperty("--wordsearch-highlight", color);
            button.classList.toggle("is-selected", activeEntryIds.includes(entryId) || foundEntryIds.includes(entryId));
            button.classList.toggle("is-found", foundEntryIds.includes(entryId));
        });
    }

    function paintBoard() {
        if (!boardRoot) return;
        const shouldHighlight = revealSolution || foundEntryIds.length > 0 || activeEntryIds.length > 0 || pendingSelectionCells.size > 0;
        boardRoot.innerHTML = api.buildBoardMarkup(puzzle, {
            highlightMap: shouldHighlight ? highlightMapForActiveEntries() : new Map()
        });
    }

    function activateAllPlacedEntries() {
        activeEntryIds.length = 0;
        puzzle.placedEntries.forEach((entry) => {
            activeEntryIds.push(entry.id);
        });
    }

    function clearActiveEntries() {
        activeEntryIds.length = 0;
    }

    function toggleEntry(entryId) {
        if (foundEntryIds.includes(entryId)) {
            syncBankSelectionState();
            paintBoard();
            return;
        }

        const currentIndex = activeEntryIds.indexOf(entryId);
        if (currentIndex >= 0) {
            activeEntryIds.splice(currentIndex, 1);
        } else {
            activeEntryIds.push(entryId);
        }

        revealSolution = activeEntryIds.length > 0;
        if (toggleButton) {
            toggleButton.textContent = revealSolution ? "Ocultar gabarito" : "Mostrar gabarito";
        }
        syncBankSelectionState();
        paintBoard();
    }

    function parseCellKey(key) {
        const [row, col] = String(key || "").split("-").map((value) => Number(value));
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        return { row, col };
    }

    function buildPathBetween(startKey, endKey) {
        const start = parseCellKey(startKey);
        const end = parseCellKey(endKey);
        if (!start || !end) return [];

        const rowDiff = end.row - start.row;
        const colDiff = end.col - start.col;
        const rowStep = Math.sign(rowDiff);
        const colStep = Math.sign(colDiff);

        const isStraight = rowDiff === 0 || colDiff === 0 || Math.abs(rowDiff) === Math.abs(colDiff);
        if (!isStraight) return [];

        const length = Math.max(Math.abs(rowDiff), Math.abs(colDiff)) + 1;
        return Array.from({ length }, (_, index) => `${start.row + rowStep * index}-${start.col + colStep * index}`);
    }

    function markFoundEntry(entry) {
        if (!entry || foundEntryIds.includes(entry.id)) return;
        foundEntryIds.push(entry.id);
        const previewIndex = activeEntryIds.indexOf(entry.id);
        if (previewIndex >= 0) {
            activeEntryIds.splice(previewIndex, 1);
        }
    }

    function clearPendingSelection() {
        pendingStartKey = "";
        pendingSelectionCells = new Set();
    }

    function handleBoardCellClick(cellKey) {
        if (!cellKey) return;

        if (!pendingStartKey) {
            pendingStartKey = cellKey;
            pendingSelectionCells = new Set([cellKey]);
            paintBoard();
            return;
        }

        if (pendingStartKey === cellKey) {
            clearPendingSelection();
            paintBoard();
            return;
        }

        const path = buildPathBetween(pendingStartKey, cellKey);
        if (!path.length) {
            pendingStartKey = cellKey;
            pendingSelectionCells = new Set([cellKey]);
            showInstruction("Selecione em linha reta: horizontal, vertical ou diagonal.");
            feedbackTimer = window.setTimeout(resetNoteMessage, 1400);
            paintBoard();
            return;
        }

        pendingSelectionCells = new Set(path);
        const matchedEntry = placedEntryMap.get(path.join("|"));
        if (matchedEntry) {
            markFoundEntry(matchedEntry);
            showInstruction(`Boa! Você encontrou "${matchedEntry.term || matchedEntry.cleanTerm}".`);
            feedbackTimer = window.setTimeout(resetNoteMessage, 1400);
        } else {
            showInstruction("Essa sequência não corresponde a uma palavra da lista.");
            feedbackTimer = window.setTimeout(resetNoteMessage, 1400);
        }

        clearPendingSelection();
        syncBankSelectionState();
        paintBoard();
    }

    if (titleRoot) titleRoot.textContent = title;
    if (subtitleRoot) subtitleRoot.textContent = subtitle;
    if (countRoot) countRoot.textContent = `${puzzle.entries.length} ${puzzle.entries.length === 1 ? "palavra" : "palavras"}`;
    if (sizeRoot) sizeRoot.textContent = `${puzzle.rows} x ${puzzle.cols}`;
    if (modeRoot) modeRoot.textContent = api.directionLabel(mode);
    if (bankRoot) bankRoot.innerHTML = buildRuntimeBankMarkup(puzzle.entries);

    paintBoard();
    syncBankSelectionState();
    resetNoteMessage();

    bankRoot?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-wordsearch-entry-button]");
        if (!button) return;
        const entryId = button.getAttribute("data-wordsearch-entry") || "";
        if (!entryId) return;
        toggleEntry(entryId);
    });

    boardRoot?.addEventListener("click", (event) => {
        const cell = event.target.closest("[data-wordsearch-cell]");
        if (!cell) return;
        handleBoardCellClick(cell.getAttribute("data-wordsearch-cell") || "");
    });

    toggleButton?.addEventListener("click", () => {
        revealSolution = !revealSolution;
        if (revealSolution) {
            activateAllPlacedEntries();
        } else {
            clearActiveEntries();
        }
        toggleButton.textContent = revealSolution ? "Ocultar gabarito" : "Mostrar gabarito";
        syncBankSelectionState();
        paintBoard();
        resetNoteMessage();
    });
}

document.addEventListener("DOMContentLoaded", renderWordsearchApplication);
