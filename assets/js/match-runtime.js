const MATCH_DRAFT_KEY = "educaria:builder:match";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readMatchDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(MATCH_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA match unavailable:", error);
        return null;
    }
}

function parseMatchPairs(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-match-pair]")].map((pair, index) => ({
        index,
        left: pair.querySelector("[data-match-left]")?.value?.trim() || `Item ${index + 1}`,
        right: pair.querySelector("[data-match-right]")?.value?.trim() || `Resposta ${index + 1}`,
        color: pair.querySelector("[data-match-color]")?.value || "#22c55e"
    }));
}

function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
    }
    return copy;
}

function escapeMatchText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function renderMatchApplication() {
    const draft = readMatchDraft();
    const controls = draft?.controls || {};
    const pairs = parseMatchPairs(draft?.stackHtml || "");
    const safePairs = pairs.length ? pairs : [
        { left: "Brasil", right: "Brasilia", color: "#22c55e" },
        { left: "Franca", right: "Paris", color: "#0ea5e9" },
        { left: "Japao", right: "Toquio", color: "#f59e0b" },
        { left: "Argentina", right: "Buenos Aires", color: "#ec4899" }
    ];

    const title = controls["ligar-titulo"] || "Ligar pontos";
    const leftLabel = controls["ligar-coluna-a"] || "Coluna A";
    const rightLabel = controls["ligar-coluna-b"] || "Coluna B";
    const shuffleRight = (controls["ligar-embaralhar"] || "Sim") === "Sim";

    const titleRoot = document.querySelector("[data-match-stage-title]");
    const leftLabelRoot = document.querySelector("[data-match-stage-left-label]");
    const rightLabelRoot = document.querySelector("[data-match-stage-right-label]");
    const statusRoot = document.querySelector("[data-match-stage-status]");
    const progressRoot = document.querySelector("[data-match-stage-progress]");
    const leftRoot = document.querySelector("[data-match-stage-left]");
    const rightRoot = document.querySelector("[data-match-stage-right]");
    const resetButton = document.querySelector("[data-match-reset]");
    const stageCard = document.querySelector(".match-stage-card");

    let selectedLeft = "";
    let selectedRight = "";
    let matchedIds = new Set();
    let rightItems = [];

    if (titleRoot) titleRoot.textContent = title;
    if (leftLabelRoot) leftLabelRoot.textContent = leftLabel;
    if (rightLabelRoot) rightLabelRoot.textContent = rightLabel;
    if (stageCard) {
        stageCard.dataset.matchDensity = safePairs.length >= 9 ? "tight" : safePairs.length >= 7 ? "compact" : "regular";
    }

    const updateStatus = (text) => {
        if (statusRoot) statusRoot.textContent = text;
    };

    const updateProgress = () => {
        if (progressRoot) {
            progressRoot.textContent = `${matchedIds.size} de ${safePairs.length} pares encontrados`;
        }
    };

    const currentLeftItems = () => safePairs.map((pair) => ({
        id: `pair-${pair.index}`,
        text: pair.left,
        color: pair.color
    }));

    const buildRightItems = () => {
        const items = safePairs.map((pair) => ({
            id: `pair-${pair.index}`,
            text: pair.right,
            color: pair.color
        }));
        rightItems = shuffleRight ? shuffle(items) : items;
    };

    const renderLists = () => {
        if (leftRoot) {
            leftRoot.innerHTML = currentLeftItems().map((item, index) => {
                const isMatched = matchedIds.has(item.id);
                const isSelected = selectedLeft === item.id;
                return `
                    <button type="button" class="match-stage-item${isMatched ? " is-matched" : ""}${isSelected ? " is-selected" : ""}" data-match-left-item="${item.id}" style="--match-accent:${item.color};" ${isMatched ? "disabled" : ""}>
                        <span>${index + 1}</span>
                        <strong>${escapeMatchText(item.text)}</strong>
                    </button>
                `;
            }).join("");
        }

        if (rightRoot) {
            rightRoot.innerHTML = rightItems.map((item, index) => {
                const isMatched = matchedIds.has(item.id);
                const isSelected = selectedRight === item.id;
                return `
                    <button type="button" class="match-stage-item${isMatched ? " is-matched" : ""}${isSelected ? " is-selected" : ""}" data-match-right-item="${item.id}" style="--match-accent:${item.color};" ${isMatched ? "disabled" : ""}>
                        <span>${String.fromCharCode(65 + index)}</span>
                        <strong>${escapeMatchText(item.text)}</strong>
                    </button>
                `;
            }).join("");
        }

        updateProgress();
    };

    const clearSelection = () => {
        selectedLeft = "";
        selectedRight = "";
    };

    const checkSelection = () => {
        if (!selectedLeft || !selectedRight) return;

        if (selectedLeft === selectedRight) {
            matchedIds.add(selectedLeft);
            clearSelection();
            renderLists();

            if (matchedIds.size === safePairs.length) {
                updateStatus("Todos os pares foram ligados");
                return;
            }

            updateStatus("Par correto. Continue ligando os demais");
            return;
        }

        updateStatus("Esse par não corresponde. Tente novamente");
        clearSelection();
        renderLists();
    };

    const resetGame = () => {
        matchedIds = new Set();
        clearSelection();
        buildRightItems();
        renderLists();
        updateStatus("Selecione um item de cada coluna");
    };

    buildRightItems();
    renderLists();
    updateStatus("Selecione um item de cada coluna");

    document.addEventListener("click", (event) => {
        const leftItem = event.target.closest("[data-match-left-item]");
        if (leftItem) {
            const id = leftItem.dataset.matchLeftItem || "";
            if (!matchedIds.has(id)) {
                selectedLeft = selectedLeft === id ? "" : id;
                renderLists();
                checkSelection();
            }
            return;
        }

        const rightItem = event.target.closest("[data-match-right-item]");
        if (rightItem) {
            const id = rightItem.dataset.matchRightItem || "";
            if (!matchedIds.has(id)) {
                selectedRight = selectedRight === id ? "" : id;
                renderLists();
                checkSelection();
            }
            return;
        }

        const resetTrigger = event.target.closest("[data-match-reset]");
        if (resetTrigger) {
            event.preventDefault();
            resetGame();
        }
    });

    if (resetButton) {
        updateProgress();
    }
}

document.addEventListener("DOMContentLoaded", renderMatchApplication);
