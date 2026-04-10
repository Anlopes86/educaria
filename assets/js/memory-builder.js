function parseMemoryCount() {
    const field = document.getElementById("memoria-pares");
    if (!field) return 6;
    const match = field.value.match(/\d+/);
    return match ? Number(match[0]) : 6;
}

function escapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

const memoryPalette = ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1", "#84cc16", "#f97316", "#06b6d4", "#a855f7"];

function memoryPairTemplate(index, front = "", back = "", color = "#22c55e") {
    return `
        <section class="platform-question-card activity-content-card memory-pair-card" data-memory-pair>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-memory-label>Par ${index + 1}</span>
                    <h3>Conteúdo do par</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-memory-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Frente</label>
                    <input data-memory-front type="text" value="${escapeAttr(front)}">
                </div>
                <div class="platform-field">
                    <label>Verso</label>
                    <input data-memory-back type="text" value="${escapeAttr(back)}">
                </div>
                <div class="platform-field">
                    <label>Cor do par</label>
                    <input data-memory-color type="color" value="${color}">
                </div>
            </div>
        </section>
    `;
}

function collectMemoryPairs() {
    return [...document.querySelectorAll("[data-memory-pair]")].map((pair, index) => ({
        index,
        front: pair.querySelector("[data-memory-front]")?.value.trim() || `Card ${index + 1}`,
        back: pair.querySelector("[data-memory-back]")?.value.trim() || "Resposta",
        color: pair.querySelector("[data-memory-color]")?.value || memoryPalette[index % memoryPalette.length]
    }));
}

function setMemoryCountSelect(count) {
    const quantity = document.getElementById("memoria-pares");
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

function syncMemoryPairCount() {
    const stack = document.querySelector("[data-memory-pairs]");
    if (!stack) return;

    const desired = parseMemoryCount();
    const current = [...stack.querySelectorAll("[data-memory-pair]")];

    if (current.length < desired) {
        for (let i = current.length; i < desired; i += 1) {
            stack.insertAdjacentHTML("beforeend", memoryPairTemplate(i, "", "", memoryPalette[i % memoryPalette.length]));
        }
    }

    if (current.length > desired) {
        [...stack.querySelectorAll("[data-memory-pair]")].slice(desired).forEach((node) => node.remove());
    }

    [...stack.querySelectorAll("[data-memory-label]")].forEach((label, index) => {
        label.textContent = `Par ${index + 1}`;
    });
}

function addMemoryPair() {
    const stack = document.querySelector("[data-memory-pairs]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-memory-pair]").length;
    stack.insertAdjacentHTML("beforeend", memoryPairTemplate(count, "", "", memoryPalette[count % memoryPalette.length]));
    setMemoryCountSelect(count + 1);
    renderMemoryPreview();
    document.dispatchEvent(new Event("input"));
}

function removeMemoryPair(trigger) {
    const pairs = [...document.querySelectorAll("[data-memory-pair]")];
    if (pairs.length <= 2) return;

    const pair = trigger.closest("[data-memory-pair]");
    if (!pair) return;

    pair.remove();
    setMemoryCountSelect(pairs.length - 1);
    renderMemoryPreview();
    document.dispatchEvent(new Event("input"));
}

function buildMemoryCards(pairs) {
    return pairs.flatMap((pair, index) => ([
        { key: `${index}-front`, role: "Frente", text: pair.front, color: pair.color, tone: "front" },
        { key: `${index}-back`, role: "Verso", text: pair.back, color: pair.color, tone: "back" }
    ]));
}

function renderMemoryPreview() {
    syncMemoryPairCount();

    const title = document.getElementById("memoria-titulo")?.value.trim() || "Jogo da memória";
    const pairs = collectMemoryPairs();
    const cards = buildMemoryCards(pairs);
    const titleRoot = document.querySelector("[data-memory-preview-title]");
    const countRoot = document.querySelector("[data-memory-preview-count]");
    const gridRoot = document.querySelector("[data-memory-preview-grid]");

    if (titleRoot) titleRoot.textContent = title;
    if (countRoot) countRoot.textContent = `${pairs.length} pares`;

    if (gridRoot) {
        gridRoot.innerHTML = cards.map((card) => `
            <article class="memory-preview-item memory-preview-item--${card.tone}" style="--memory-accent:${card.color};">
                <span class="memory-preview-role">${card.role}</span>
                <strong>${escapeAttr(card.text)}</strong>
            </article>
        `).join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    syncMemoryPairCount();
    renderMemoryPreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-memory-pair]") || event.target.id === "memoria-titulo") {
            renderMemoryPreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (event.target.id === "memoria-pares") {
            renderMemoryPreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-memory-add]");
        if (addButton) {
            event.preventDefault();
            addMemoryPair();
            return;
        }

        const removeButton = event.target.closest("[data-memory-remove]");
        if (removeButton) {
            event.preventDefault();
            removeMemoryPair(removeButton);
        }

        const presentLink = event.target.closest('a[href="jogo-memoria-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("memory");
        }
    });
});
