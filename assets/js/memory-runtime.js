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

    const tileStyle = window.getComputedStyle(tile);
    const availableWidth = Math.max(1, tile.clientWidth - parseFloat(tileStyle.paddingLeft) - parseFloat(tileStyle.paddingRight));
    const availableHeight = Math.max(1, tile.clientHeight - parseFloat(tileStyle.paddingTop) - parseFloat(tileStyle.paddingBottom));
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
        { front: "Capital", back: "Brasília", color: "#0ea5e9" }
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
    let mismatchTimer = 0;
    let attempts = 0;
    const titleRoot = document.querySelector("[data-memory-title]");
    if (titleRoot) titleRoot.textContent = controls["memoria-titulo"] || "Encontre os pares";

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
        let cols = 2;
        let bestScore = Infinity;
        const gap = parseFloat(window.getComputedStyle(gridRoot).gap) || 8;
        for (let candidate = 2; candidate <= Math.min(8, totalCards); candidate++) {
            const rows = Math.ceil(totalCards / candidate);
            const width = Math.max(1, (gridRoot.clientWidth - gap * (candidate - 1)) / candidate);
            const height = Math.max(1, (gridRoot.clientHeight - gap * (rows - 1)) / rows);
            const score = Math.abs(Math.log(width / height / 2.3)) + (candidate * rows - totalCards) / totalCards * .8
                + Math.max(0, 80 - height) * .03 + Math.max(0, 170 - width) * .02;
            if (score < bestScore) { bestScore = score; cols = candidate; }
        }

        gridRoot.style.setProperty("--memory-cols", String(cols));
        gridRoot.style.setProperty("--memory-rows", String(Math.ceil(totalCards / cols)));
    }

    let inlineEdit = null;

    function paint() {
        if (!gridRoot) return;

        updateGridMetrics();

        const focusedId = document.activeElement?.dataset?.memoryTile;
        gridRoot.innerHTML = cards.map((card, index) => {
            const isOpen = inlineEdit?.enabled || selected.includes(card.id) || card.found;
            const editableAttrs = inlineEdit?.enabled
                ? ` data-inline-editable="pair:${card.pairId}:${card.field}"`
                : "";
            return `
                <button type="button" class="memory-stage-tile ${isOpen ? "is-open" : ""} ${card.found ? "is-found" : ""} ${inlineEdit?.enabled ? "is-editing" : ""}" data-memory-tile="${card.id}" style="--memory-accent:${card.color};" aria-label="Carta ${index + 1}${isOpen ? ': ' + escapeMemoryAttr(card.text) : ', fechada'}${card.found ? ', par encontrado' : ''}" aria-pressed="${Boolean(isOpen)}">
                    ${isOpen ? `<span class="memory-tile-number" aria-hidden="true">${index + 1}${card.found ? " ✓" : ""}</span>` : ""}
                    <strong${editableAttrs}>${isOpen ? escapeMemoryText(card.text) : index + 1}</strong>
                </button>
            `;
        }).join("");

        window.requestAnimationFrame(fitVisibleLabels);
        const found = cards.filter((card) => card.found).length / 2;
        const progress = document.querySelector("[data-memory-progress]");
        const tries = document.querySelector("[data-memory-attempts]");
        if (progress) progress.textContent = found === state.pairs.length ? `✓ Todos os ${found} pares encontrados!` : `${found} de ${state.pairs.length} pares`;
        if (tries) tries.textContent = `${attempts} ${attempts === 1 ? "tentativa" : "tentativas"}`;
        if (focusedId) gridRoot.querySelector(`[data-memory-tile="${focusedId}"]`)?.focus({ preventScroll: true });
        inlineEdit?.syncUi();
    }

    function resetGame() {
        if (inlineEdit?.enabled) return;
        window.clearTimeout(mismatchTimer);
        attempts = 0;
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
                    window.clearTimeout(mismatchTimer);
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

        attempts += 1;
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

        paint();
        mismatchTimer = window.setTimeout(() => {
            selected = [];
            locked = false;
            paint();
        }, 1600);
    });

    document.querySelector("[data-memory-restart]")?.addEventListener("click", resetGame);

    window.educariaPresentationProgress = {
        capture: () => ({ cards: cards.map((card) => ({ ...card })), attempts }),
        restore(saved) {
            if (!Array.isArray(saved?.cards) || saved.cards.length !== cards.length) return;
            window.clearTimeout(mismatchTimer);
            cards.splice(0, cards.length, ...saved.cards);
            attempts = Number(saved.attempts) || 0;
            selected = []; locked = false;
            paint();
        }
    };

    persistState();
    paint();
    const resizeBoard = () => { updateGridMetrics(); window.requestAnimationFrame(fitVisibleLabels); };
    window.addEventListener("resize", resizeBoard);
    if (typeof ResizeObserver === "function" && gridRoot) new ResizeObserver(resizeBoard).observe(gridRoot);
}

document.addEventListener("DOMContentLoaded", renderMemoryApplication);
