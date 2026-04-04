const FLASHCARDS_DRAFT_KEY = "educaria:builder:flashcards";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readFlashcardsDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(FLASHCARDS_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA flashcards unavailable:", error);
        return null;
    }
}

function parseFlashcards(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");
    const cards = [...doc.querySelectorAll("[data-flashcard]")];

    return cards.map((card, index) => {
        const fieldValue = (name) => card.querySelector(`[data-field="${name}"]`)?.value?.trim() || "";

        return {
            index,
            front: fieldValue("front") || `Card ${index + 1}`,
            back: fieldValue("back") || "Sem verso",
            example: fieldValue("example"),
            frontColor: fieldValue("front-color") || "#ffffff",
            backColor: fieldValue("back-color") || "#dbeafe",
            textColor: fieldValue("text-color") || "#0f172a"
        };
    });
}

function buildFallbackFlashcards() {
    return [
        {
            index: 0,
            front: "keyboard",
            back: "teclado",
            example: "The keyboard is on the desk.",
            frontColor: "#ffffff",
            backColor: "#dbeafe",
            textColor: "#0f172a"
        }
    ];
}

function renderFlashcardsPresentation(cards, controls = {}) {
    const front = document.querySelector("[data-flashcard-front]");
    const back = document.querySelector("[data-flashcard-back]");
    const example = document.querySelector("[data-flashcard-example]");
    const exampleBlock = document.querySelector("[data-flashcard-example-block]");
    const counter = document.querySelector("[data-flashcard-counter]");
    const theme = document.querySelector("[data-flashcard-theme]");
    const classLabel = document.querySelector("[data-flashcard-class]");
    const cardRoot = document.querySelector("[data-flashcard-stage]");
    const frontFace = document.querySelector("[data-flashcard-front-face]");
    const backFace = document.querySelector("[data-flashcard-back-face]");
    const flipButton = document.querySelector("[data-flashcard-flip]");
    const prevButton = document.querySelector("[data-flashcard-prev]");
    const nextButton = document.querySelector("[data-flashcard-next]");
    let currentIndex = 0;
    let isFlipped = false;

    const turma = typeof readSelectedClass === "function" ? readSelectedClass() : "";
    const includeExample = (controls["cards-exemplo"] || "Sim") === "Sim";
    const materialTheme = controls["cards-tema"] || "Flashcards";

    const paint = () => {
        const card = cards[currentIndex];

        front.textContent = card.front;
        back.textContent = card.back;
        example.textContent = card.example || "Sem exemplo.";
        exampleBlock.hidden = !includeExample || !card.example;
        counter.textContent = `${currentIndex + 1} de ${cards.length}`;
        theme.textContent = materialTheme;
        classLabel.textContent = turma ? `${turma} • ${materialTheme}` : materialTheme;

        frontFace.style.background = card.frontColor;
        backFace.style.background = card.backColor;
        frontFace.style.color = card.textColor;
        backFace.style.color = card.textColor;
        exampleBlock.style.color = card.textColor;

        cardRoot.classList.toggle("is-flipped", isFlipped);
        flipButton.textContent = isFlipped ? "Ver frente" : "Ver verso";
        prevButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === cards.length - 1;
    };

    flipButton.addEventListener("click", () => {
        isFlipped = !isFlipped;
        paint();
    });

    prevButton.addEventListener("click", () => {
        if (currentIndex === 0) return;
        currentIndex -= 1;
        isFlipped = false;
        paint();
    });

    nextButton.addEventListener("click", () => {
        if (currentIndex >= cards.length - 1) return;
        currentIndex += 1;
        isFlipped = false;
        paint();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (currentIndex === 0) return;
            currentIndex -= 1;
            isFlipped = false;
            paint();
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            if (currentIndex >= cards.length - 1) return;
            currentIndex += 1;
            isFlipped = false;
            paint();
        }

        if (event.key === " " || event.code === "Space") {
            event.preventDefault();
            isFlipped = !isFlipped;
            paint();
        }
    });

    paint();
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readFlashcardsDraft();
    const cards = draft ? parseFlashcards(draft.stackHtml) : [];
    renderFlashcardsPresentation(cards.length ? cards : buildFallbackFlashcards(), draft?.controls || {});
});
