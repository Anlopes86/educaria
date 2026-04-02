const MEMORY_DRAFT_KEY = "educaria:builder:memory";

function readMemoryDraft() {
    try {
        const raw = localStorage.getItem(MEMORY_DRAFT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA memory unavailable:", error);
        return null;
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

function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const randomIndex = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
    }
    return copy;
}

function renderMemoryApplication() {
    const draft = readMemoryDraft();
    const controls = draft?.controls || {};
    const pairs = parseMemoryPairs(draft?.stackHtml || "");
    const safePairs = pairs.length ? pairs : [
        { front: "Planeta", back: "Terra", color: "#22c55e" },
        { front: "Capital", back: "Brasilia", color: "#0ea5e9" }
    ];

    const cards = shuffle(safePairs.flatMap((pair, index) => ([
        { id: `${index}-front`, role: "Frente", text: pair.front, pairId: index, color: pair.color },
        { id: `${index}-back`, role: "Verso", text: pair.back, pairId: index, color: pair.color }
    ])));

    const gridRoot = document.querySelector("[data-memory-stage-grid]");

    let selected = [];
    let locked = false;

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

    function paint() {
        if (!gridRoot) return;

        updateGridMetrics();

        gridRoot.innerHTML = cards.map((card) => {
            const isOpen = selected.includes(card.id) || card.found;
            return `
                <button type="button" class="memory-stage-tile ${isOpen ? "is-open" : ""} ${card.found ? "is-found" : ""}" data-memory-tile="${card.id}" style="--memory-accent:${card.color};">
                    <span class="memory-stage-tile-role">${isOpen ? card.role : ""}</span>
                    <strong>${isOpen ? card.text : "?"}</strong>
                </button>
            `;
        }).join("");
    }

    function resetGame() {
        selected = [];
        locked = false;
        foundPairs = 0;
        cards.forEach((card) => {
            delete card.found;
        });
        const shuffled = shuffle(cards);
        cards.splice(0, cards.length, ...shuffled);
        paint();
    }

    gridRoot?.addEventListener("click", (event) => {
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
        }, 900);
    });

    paint();
}

document.addEventListener("DOMContentLoaded", renderMemoryApplication);
