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

function writeMatchDraft(state) {
    try {
        localStorage.setItem(scopedStorageKey(MATCH_DRAFT_KEY), JSON.stringify(state));
    } catch (error) {
        console.warn("EducarIA match save unavailable:", error);
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

function escapeMatchAttr(value) {
    return escapeMatchText(value).replaceAll('"', "&quot;");
}

function serializeMatchPairs(pairs) {
    return pairs.map((pair, index) => `
        <section class="platform-question-card activity-content-card match-pair-card" data-match-pair>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-match-label>Par ${index + 1}</span>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field platform-field-wide">
                    <label>Coluna A</label>
                    <input data-match-left type="text" value="${escapeMatchAttr(pair.left)}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Coluna B</label>
                    <input data-match-right type="text" value="${escapeMatchAttr(pair.right)}">
                </div>
                <div class="platform-field">
                    <label>Cor</label>
                    <input data-match-color type="color" value="${escapeMatchAttr(pair.color || "#22c55e")}">
                </div>
            </div>
        </section>
    `).join("");
}

function renderMatchApplication() {
    const draft = readMatchDraft() || {};
    const controls = { ...(draft.controls || {}) };
    const pairs = parseMatchPairs(draft.stackHtml || "");
    const safePairs = (pairs.length ? pairs : [
        { left: "Brasil", right: "Brasilia", color: "#22c55e" },
        { left: "Franca", right: "Paris", color: "#0ea5e9" },
        { left: "Japao", right: "Toquio", color: "#f59e0b" },
        { left: "Argentina", right: "Buenos Aires", color: "#ec4899" }
    ]).map((pair, index) => ({ ...pair, index }));

    controls["ligar-titulo"] = controls["ligar-titulo"] || "Ligar pontos";
    controls["ligar-coluna-a"] = controls["ligar-coluna-a"] || "Coluna A";
    controls["ligar-coluna-b"] = controls["ligar-coluna-b"] || "Coluna B";
    controls["ligar-embaralhar"] = controls["ligar-embaralhar"] || "Sim";

    const state = {
        ...draft,
        controls,
        pairs: safePairs,
        stackHtml: serializeMatchPairs(safePairs)
    };

    const titleRoot = document.querySelector("[data-match-stage-title]");
    const leftLabelRoot = document.querySelector("[data-match-stage-left-label]");
    const rightLabelRoot = document.querySelector("[data-match-stage-right-label]");
    const statusRoot = document.querySelector("[data-match-stage-status]");
    const progressRoot = document.querySelector("[data-match-stage-progress]");
    const leftRoot = document.querySelector("[data-match-stage-left]");
    const rightRoot = document.querySelector("[data-match-stage-right]");
    const stageCard = document.querySelector(".match-stage-card");

    let selectedLeft = "";
    let selectedRight = "";
    let matchedIds = new Set();
    let rightItems = [];
    let saveTimer = 0;
    let inlineEdit = null;

    if (titleRoot) titleRoot.dataset.inlineEditable = "control:ligar-titulo";
    if (leftLabelRoot) leftLabelRoot.dataset.inlineEditable = "control:ligar-coluna-a";
    if (rightLabelRoot) rightLabelRoot.dataset.inlineEditable = "control:ligar-coluna-b";

    if (stageCard) {
        stageCard.dataset.matchDensity = state.pairs.length >= 9 ? "tight" : state.pairs.length >= 7 ? "compact" : "regular";
    }

    const persistState = () => {
        state.pairs = state.pairs.map((pair, index) => ({ ...pair, index }));
        state.stackHtml = serializeMatchPairs(state.pairs);
        writeMatchDraft(state);
    };

    const scheduleSave = () => {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(persistState, 140);
    };

    const updateStatus = (text) => {
        if (statusRoot) statusRoot.textContent = text;
    };

    const updateProgress = () => {
        if (progressRoot) {
            progressRoot.textContent = `${matchedIds.size} de ${state.pairs.length} pares encontrados`;
        }
    };

    const currentLeftItems = () => state.pairs.map((pair) => ({
        id: `pair-${pair.index}`,
        text: pair.left,
        color: pair.color
    }));

    const buildRightItems = () => {
        const items = state.pairs.map((pair) => ({
            id: `pair-${pair.index}`,
            text: pair.right,
            color: pair.color
        }));
        rightItems = (state.controls["ligar-embaralhar"] || "Sim") === "Sim" ? shuffle(items) : items;
    };

    const renderLists = () => {
        if (leftRoot) {
            leftRoot.innerHTML = currentLeftItems().map((item, index) => {
                const isMatched = !inlineEdit?.enabled && matchedIds.has(item.id);
                const isSelected = selectedLeft === item.id;
                return `
                    <button type="button" class="match-stage-item${isMatched ? " is-matched" : ""}${isSelected ? " is-selected" : ""}" data-match-left-item="${item.id}" style="--match-accent:${item.color};" ${isMatched ? "disabled" : ""}>
                        <span>${index + 1}</span>
                        <strong data-inline-editable="pair:${item.id}:left">${escapeMatchText(item.text)}</strong>
                    </button>
                `;
            }).join("");
        }

        if (rightRoot) {
            rightRoot.innerHTML = rightItems.map((item, index) => {
                const isMatched = !inlineEdit?.enabled && matchedIds.has(item.id);
                const isSelected = selectedRight === item.id;
                return `
                    <button type="button" class="match-stage-item${isMatched ? " is-matched" : ""}${isSelected ? " is-selected" : ""}" data-match-right-item="${item.id}" style="--match-accent:${item.color};" ${isMatched ? "disabled" : ""}>
                        <span>${String.fromCharCode(65 + index)}</span>
                        <strong data-inline-editable="pair:${item.id}:right">${escapeMatchText(item.text)}</strong>
                    </button>
                `;
            }).join("");
        }

        updateProgress();
        inlineEdit?.syncUi();
    };

    const clearSelection = () => {
        selectedLeft = "";
        selectedRight = "";
    };

    const checkSelection = () => {
        if (inlineEdit?.enabled || !selectedLeft || !selectedRight) return;

        if (selectedLeft === selectedRight) {
            matchedIds.add(selectedLeft);
            clearSelection();
            renderLists();

            if (matchedIds.size === state.pairs.length) {
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

    if (typeof createPresentationInlineEditController === "function") {
        inlineEdit = createPresentationInlineEditController({
            onModeChange(enabled) {
                if (enabled) {
                    resetGame();
                    updateStatus("Edite os textos e conclua quando terminar");
                } else {
                    resetGame();
                }
            },
            onInput(node) {
                const binding = String(node.dataset.inlineEditable || "");

                if (binding.startsWith("control:")) {
                    const key = binding.slice("control:".length);
                    const nextValue = readInlineEditableValue(node, false);
                    if (state.controls[key] === nextValue) return;
                    state.controls[key] = nextValue;
                    scheduleSave();
                    return;
                }

                const match = binding.match(/^pair:(pair-\d+):(left|right)$/);
                if (!match) return;

                const pairId = match[1];
                const field = match[2];
                const pairIndex = Number(pairId.replace("pair-", ""));
                const pair = state.pairs[pairIndex];
                const nextValue = readInlineEditableValue(node, false);
                if (!pair || pair[field] === nextValue) return;

                pair[field] = nextValue;
                if (field === "right") {
                    const rightItem = rightItems.find((item) => item.id === pairId);
                    if (rightItem) rightItem.text = nextValue;
                }
                scheduleSave();
            },
            onCommit() {
                if (titleRoot) titleRoot.textContent = state.controls["ligar-titulo"];
                if (leftLabelRoot) leftLabelRoot.textContent = state.controls["ligar-coluna-a"];
                if (rightLabelRoot) rightLabelRoot.textContent = state.controls["ligar-coluna-b"];
                renderLists();
            }
        });
    }

    if (titleRoot) titleRoot.textContent = state.controls["ligar-titulo"];
    if (leftLabelRoot) leftLabelRoot.textContent = state.controls["ligar-coluna-a"];
    if (rightLabelRoot) rightLabelRoot.textContent = state.controls["ligar-coluna-b"];

    buildRightItems();
    renderLists();
    updateStatus("Selecione um item de cada coluna");
    persistState();

    document.addEventListener("click", (event) => {
        const editable = event.target.closest("[data-inline-editable]");
        if (inlineEdit?.enabled && editable) {
            event.stopPropagation();
            return;
        }

        const leftItem = event.target.closest("[data-match-left-item]");
        if (leftItem) {
            if (inlineEdit?.enabled) return;
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
            if (inlineEdit?.enabled) return;
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
}

document.addEventListener("DOMContentLoaded", renderMatchApplication);
