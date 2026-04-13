const MEMORY_DRAFT_KEY = "educaria:builder:memory";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readMemoryDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(MEMORY_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA memory unavailable:", error);
        return null;
    }
}

function writeMemoryDraft(state) {
    try {
        localStorage.setItem(scopedStorageKey(MEMORY_DRAFT_KEY), JSON.stringify(state));
    } catch (error) {
        console.warn("EducarIA memory save unavailable:", error);
    }
}

function parseMemoryPairs(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-memory-pair]")].map((pair, index) => ({
        index,
        front: pair.querySelector("[data-memory-front]")?.value?.trim() || `Card ${index + 1}`,
        back: pair.querySelector("[data-memory-back]")?.value?.trim() || "Resposta",
        color: pair.querySelector("[data-memory-color]")?.value || "#22c55e"
    }));
}

function escapeMemoryText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function escapeMemoryAttr(value) {
    return escapeMemoryText(value).replaceAll('"', "&quot;");
}

function serializeMemoryPairs(pairs) {
    return pairs.map((pair, index) => `
        <section class="platform-question-card activity-content-card memory-pair-card" data-memory-pair>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-memory-label>Par ${index + 1}</span>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-memory-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Frente</label>
                    <input data-memory-front type="text" value="${escapeMemoryAttr(pair.front)}">
                </div>
                <div class="platform-field">
                    <label>Verso</label>
                    <input data-memory-back type="text" value="${escapeMemoryAttr(pair.back)}">
                </div>
                <div class="platform-field">
                    <label>Cor</label>
                    <input data-memory-color type="color" value="${escapeMemoryAttr(pair.color || "#22c55e")}">
                </div>
            </div>
        </section>
    `).join("");
}

function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
    }
    return copy;
}

function fitMemoryTileLabel(label) {
    if (!label) return;

    const tile = label.closest(".memory-stage-tile");
    if (!tile) return;

    const availableWidth = Math.max(tile.clientWidth - 36, 72);
    const availableHeight = Math.max(tile.clientHeight - 36, 52);
    let fontSize = Math.min(48, availableWidth / 4.2, availableHeight / 2.2);
    const minFontSize = 14;

    label.style.maxWidth = `${availableWidth}px`;
    label.style.fontSize = `${Math.max(fontSize, minFontSize)}px`;

    let safety = 0;
    while (fontSize > minFontSize && safety < 40) {
        const exceedsWidth = label.scrollWidth > availableWidth + 1;
        const exceedsHeight = label.scrollHeight > availableHeight + 1;

        if (!exceedsWidth && !exceedsHeight) break;

        fontSize -= 1;
        label.style.fontSize = `${fontSize}px`;
        safety += 1;
    }
}

function renderMemoryApplication() {
    const draft = readMemoryDraft() || {};
    const controls = { ...(draft.controls || {}) };
    const pairs = parseMemoryPairs(draft.stackHtml || "");
    const safePairs = (pairs.length ? pairs : [
        { front: "Planeta", back: "Terra", color: "#22c55e" },
        { front: "Capital", back: "Brasilia", color: "#0ea5e9" }
    ]).map((pair, index) => ({ ...pair, index }));

    const state = {
        ...draft,
        controls,
        pairs: safePairs,
        stackHtml: serializeMemoryPairs(safePairs)
    };

    const cards = shuffle(state.pairs.flatMap((pair, index) => ([
        { id: `${index}-front`, field: "front", text: pair.front, pairId: index, color: pair.color },
        { id: `${index}-back`, field: "back", text: pair.back, pairId: index, color: pair.color }
    ])));

    const gridRoot = document.querySelector("[data-memory-stage-grid]");
    let selected = [];
    let locked = false;
    let saveTimer = 0;

    const persistState = () => {
        state.pairs = state.pairs.map((pair, index) => ({ ...pair, index }));
        state.stackHtml = serializeMemoryPairs(state.pairs);
        writeMemoryDraft(state);
    };

    const scheduleSave = () => {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(persistState, 140);
    };

    function fitVisibleLabels() {
        if (!gridRoot) return;
        gridRoot.querySelectorAll(".memory-stage-tile strong").forEach((label) => {
            fitMemoryTileLabel(label);
        });
    }

    function updateGridMetrics() {
        if (!gridRoot) return;

        const totalCards = cards.length;
        let cols = 4;
        let rows = 2;

        if (totalCards <= 4) {
            cols = 2;
            rows = 2;
        } else if (totalCards <= 6) {
            cols = 3;
            rows = 2;
        } else if (totalCards <= 8) {
            cols = 4;
            rows = 2;
        } else if (totalCards <= 10) {
            cols = 5;
            rows = 2;
        } else {
            cols = 4;
            rows = Math.ceil(totalCards / 4);
        }

        gridRoot.style.setProperty("--memory-cols", String(cols));
        gridRoot.style.setProperty("--memory-rows", String(rows));
    }

    let inlineEdit = null;

    function paint() {
        if (!gridRoot) return;

        updateGridMetrics();

        gridRoot.innerHTML = cards.map((card) => {
            const isOpen = inlineEdit?.enabled || selected.includes(card.id) || card.found;
            const editableAttrs = inlineEdit?.enabled
                ? ` data-inline-editable="pair:${card.pairId}:${card.field}"`
                : "";
            return `
                <button type="button" class="memory-stage-tile ${isOpen ? "is-open" : ""} ${card.found ? "is-found" : ""} ${inlineEdit?.enabled ? "is-editing" : ""}" data-memory-tile="${card.id}" style="--memory-accent:${card.color};">
                    <strong${editableAttrs}>${isOpen ? escapeMemoryText(card.text) : "?"}</strong>
                </button>
            `;
        }).join("");

        window.requestAnimationFrame(fitVisibleLabels);
        inlineEdit?.syncUi();
    }

    function resetGame() {
        if (inlineEdit?.enabled) return;
        selected = [];
        locked = false;
        cards.forEach((card) => {
            delete card.found;
        });
        const shuffled = shuffle(cards);
        cards.splice(0, cards.length, ...shuffled);
        paint();
    }

    if (typeof createPresentationInlineEditController === "function") {
        inlineEdit = createPresentationInlineEditController({
            onModeChange(enabled) {
                if (enabled) {
                    selected = [];
                    locked = false;
                }
                paint();
            },
            onInput(node) {
                const match = String(node.dataset.inlineEditable || "").match(/^pair:(\d+):(front|back)$/);
                if (!match) return;

                const pairIndex = Number(match[1]);
                const field = match[2];
                const nextValue = readInlineEditableValue(node, false);
                const pair = state.pairs[pairIndex];
                if (!pair || pair[field] === nextValue) return;

                pair[field] = nextValue;
                cards.forEach((card) => {
                    if (card.pairId === pairIndex && card.field === field) {
                        card.text = nextValue;
                    }
                });
                scheduleSave();
            },
            onCommit() {
                paint();
            }
        });
    }

    gridRoot?.addEventListener("click", (event) => {
        if (inlineEdit?.enabled) return;

        const tile = event.target.closest("[data-memory-tile]");
        if (!tile || locked) return;

        const id = tile.dataset.memoryTile;
        const card = cards.find((item) => item.id === id);
        if (!card || card.found || selected.includes(id)) return;

        selected.push(id);
        paint();

        if (selected.length < 2) return;

        locked = true;
        const [first, second] = selected.map((cardId) => cards.find((item) => item.id === cardId));

        if (first && second && first.pairId === second.pairId) {
            first.found = true;
            second.found = true;
            selected = [];
            locked = false;
            paint();
            return;
        }

        window.setTimeout(() => {
            selected = [];
            locked = false;
            paint();
        }, 1600);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !inlineEdit?.enabled) return;
        resetGame();
    });

    persistState();
    paint();
    window.addEventListener("resize", fitVisibleLabels);
}

document.addEventListener("DOMContentLoaded", renderMemoryApplication);
