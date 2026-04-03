function parseMatchCount() {
    const field = document.getElementById("ligar-pares");
    if (!field) return 4;
    const match = field.value.match(/\d+/);
    return match ? Number(match[0]) : 4;
}

function escapeMatchAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

const matchPalette = ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1", "#84cc16", "#f97316", "#06b6d4", "#a855f7"];

function getMatchColorMode() {
    return document.getElementById("ligar-cores")?.value || "manual";
}

function getSingleMatchColor() {
    return document.getElementById("ligar-cor-unica")?.value || "#22c55e";
}

function getShuffledPaletteColor(index) {
    return matchPalette[(index * 5 + 2) % matchPalette.length];
}

function syncMatchColorInputs() {
    const mode = getMatchColorMode();
    const singleColorField = document.getElementById("ligar-cor-unica");
    const colorInputs = [...document.querySelectorAll("[data-match-color]")];

    if (singleColorField) {
        singleColorField.disabled = mode !== "same";
    }

    colorInputs.forEach((input, index) => {
        if (!(input instanceof HTMLInputElement)) return;

        if (mode === "same") {
            input.value = getSingleMatchColor();
        } else if (mode === "shuffle") {
            input.value = getShuffledPaletteColor(index);
        }

        input.disabled = mode !== "manual";
    });
}

function matchPairTemplate(index, left = "", right = "", color = "#22c55e") {
    return `
        <section class="platform-question-card activity-content-card match-pair-card" data-match-pair>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-match-label>Par ${index + 1}</span>
                    <h3>Conteudo da ligacao</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-match-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Item da coluna A</label>
                    <input data-match-left type="text" value="${escapeMatchAttr(left)}">
                </div>
                <div class="platform-field">
                    <label>Item da coluna B</label>
                    <input data-match-right type="text" value="${escapeMatchAttr(right)}">
                </div>
                <div class="platform-field">
                    <label>Cor do par</label>
                    <input data-match-color type="color" value="${color}">
                </div>
            </div>
        </section>
    `;
}

function collectMatchPairs() {
    syncMatchColorInputs();
    return [...document.querySelectorAll("[data-match-pair]")].map((pair, index) => ({
        index,
        left: pair.querySelector("[data-match-left]")?.value.trim() || `Item ${index + 1}`,
        right: pair.querySelector("[data-match-right]")?.value.trim() || `Resposta ${index + 1}`,
        color: pair.querySelector("[data-match-color]")?.value || matchPalette[index % matchPalette.length]
    }));
}

function setMatchCountSelect(count) {
    const quantity = document.getElementById("ligar-pares");
    if (!quantity) return;

    const options = [...quantity.options];
    const exact = options.find((option) => {
        const match = option.text.match(/\d+/);
        return match && Number(match[0]) === count;
    });

    if (exact) {
        quantity.value = exact.value;
        return;
    }

    const highest = options[options.length - 1];
    if (highest) {
        highest.textContent = `${count} pares`;
        highest.value = highest.textContent;
        quantity.value = highest.value;
    }
}

function syncMatchPairCount() {
    const stack = document.querySelector("[data-match-pairs]");
    if (!stack) return;

    const desired = parseMatchCount();
    const current = [...stack.querySelectorAll("[data-match-pair]")];

    if (current.length < desired) {
        for (let i = current.length; i < desired; i += 1) {
            stack.insertAdjacentHTML("beforeend", matchPairTemplate(i, "", "", matchPalette[i % matchPalette.length]));
        }
    }

    if (current.length > desired) {
        [...stack.querySelectorAll("[data-match-pair]")].slice(desired).forEach((node) => node.remove());
    }

    [...stack.querySelectorAll("[data-match-label]")].forEach((label, index) => {
        label.textContent = `Par ${index + 1}`;
    });

    syncMatchColorInputs();
}

function addMatchPair() {
    const stack = document.querySelector("[data-match-pairs]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-match-pair]").length;
    stack.insertAdjacentHTML("beforeend", matchPairTemplate(count, "", "", matchPalette[count % matchPalette.length]));
    setMatchCountSelect(count + 1);
    renderMatchPreview();
    document.dispatchEvent(new Event("input"));
}

function removeMatchPair(trigger) {
    const pairs = [...document.querySelectorAll("[data-match-pair]")];
    if (pairs.length <= 2) return;

    const pair = trigger.closest("[data-match-pair]");
    if (!pair) return;

    pair.remove();
    setMatchCountSelect(pairs.length - 1);
    renderMatchPreview();
    document.dispatchEvent(new Event("input"));
}

function renderMatchPreview() {
    syncMatchPairCount();

    const title = document.getElementById("ligar-titulo")?.value.trim() || "Ligar pontos";
    const format = document.getElementById("ligar-formato")?.value || "Texto com texto";
    const leftLabel = document.getElementById("ligar-coluna-a")?.value.trim() || "Coluna A";
    const rightLabel = document.getElementById("ligar-coluna-b")?.value.trim() || "Coluna B";
    const pairs = collectMatchPairs();
    const titleRoot = document.querySelector("[data-match-preview-title]");
    const formatRoot = document.querySelector("[data-match-preview-format]");
    const countRoot = document.querySelector("[data-match-preview-count]");
    const leftLabelRoot = document.querySelector("[data-match-preview-left-label]");
    const rightLabelRoot = document.querySelector("[data-match-preview-right-label]");
    const leftRoot = document.querySelector("[data-match-preview-left]");
    const rightRoot = document.querySelector("[data-match-preview-right]");

    if (titleRoot) titleRoot.textContent = title;
    if (formatRoot) formatRoot.textContent = format;
    if (countRoot) countRoot.textContent = `${pairs.length} pares`;
    if (leftLabelRoot) leftLabelRoot.textContent = leftLabel;
    if (rightLabelRoot) rightLabelRoot.textContent = rightLabel;

    if (leftRoot) {
        leftRoot.innerHTML = pairs.map((pair, index) => `
            <article class="match-preview-item" style="--match-accent:${pair.color};">
                <span>${index + 1}</span>
                <strong>${escapeMatchAttr(pair.left)}</strong>
            </article>
        `).join("");
    }

    if (rightRoot) {
        rightRoot.innerHTML = pairs.map((pair, index) => `
            <article class="match-preview-item" style="--match-accent:${pair.color};">
                <span>${String.fromCharCode(65 + index)}</span>
                <strong>${escapeMatchAttr(pair.right)}</strong>
            </article>
        `).join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    syncMatchPairCount();
    renderMatchPreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-match-pair]") || ["ligar-titulo", "ligar-coluna-a", "ligar-coluna-b"].includes(event.target.id)) {
            renderMatchPreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (["ligar-pares", "ligar-formato", "ligar-embaralhar", "ligar-cores", "ligar-cor-unica"].includes(event.target.id)) {
            renderMatchPreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-match-add]");
        if (addButton) {
            event.preventDefault();
            addMatchPair();
            return;
        }

        const removeButton = event.target.closest("[data-match-remove]");
        if (removeButton) {
            event.preventDefault();
            removeMatchPair(removeButton);
            return;
        }

        const presentLink = event.target.closest('a[href="ligar-pontos-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("match");
        }
    });
});
