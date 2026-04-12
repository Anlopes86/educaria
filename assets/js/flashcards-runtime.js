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

function normalizeFlashcardText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeFlashcardForStage(card) {
    return {
        ...card,
        front: normalizeFlashcardText(card.front),
        back: normalizeFlashcardText(card.back),
        example: normalizeFlashcardText(card.example)
    };
}

function flashcardDensityForText(text, includeExample = false) {
    const content = String(text || "").replace(/\s+/g, " ").trim();
    const length = content.length;
    const words = content ? content.split(" ").filter(Boolean).length : 0;

    if (includeExample || length > 78 || words > 12) return "dense";
    if (length > 52 || words > 8) return "compact";
    return "comfort";
}

function fitFlashcardFaceContent(face) {
    if (!face) return;

    const title = face.querySelector("strong");
    if (!title) return;

    if (face.clientWidth < 220 || face.clientHeight < 220) {
        return false;
    }

    const exampleBlock = face.querySelector("[data-flashcard-example-block]");
    const exampleText = exampleBlock?.querySelector("p");
    const exampleVisible = Boolean(exampleText && !exampleBlock?.hidden);
    const availableWidth = Math.max(face.clientWidth - 56, 220);
    const density = face.dataset.density || "comfort";
    const maxTitleSize = density === "dense"
        ? Math.min(face.clientWidth * 0.12, face.clientHeight * 0.16, 72)
        : density === "compact"
            ? Math.min(face.clientWidth * 0.15, face.clientHeight * 0.19, 90)
            : Math.min(face.clientWidth * 0.19, face.clientHeight * 0.24, 116);
    const minTitleSize = density === "dense" ? 28 : density === "compact" ? 34 : 44;
    const initialTitleSize = Math.max(minTitleSize, Math.round(maxTitleSize));
    const maxExampleSize = exampleVisible ? Math.min(face.clientWidth * 0.03, 22) : 0;
    const minExampleSize = 15;

    title.style.maxWidth = `${availableWidth}px`;
    title.style.fontSize = `${initialTitleSize}px`;
    title.style.lineHeight = initialTitleSize >= 84 ? "0.94" : initialTitleSize >= 64 ? "0.98" : "1.02";

    if (exampleBlock) {
        exampleBlock.style.maxWidth = `${availableWidth}px`;
    }

    if (exampleText) {
        exampleText.style.fontSize = `${Math.max(minExampleSize, Math.round(maxExampleSize || 18))}px`;
        exampleText.style.lineHeight = "1.45";
    }

    let titleSize = parseFloat(window.getComputedStyle(title).fontSize) || initialTitleSize;
    let exampleSize = exampleText ? parseFloat(window.getComputedStyle(exampleText).fontSize) || 16 : 0;
    let attempts = 0;

    while (face.scrollHeight > face.clientHeight - 8 && attempts < 100) {
        if (titleSize > minTitleSize) {
            titleSize -= titleSize > 72 ? 2 : 1;
            title.style.fontSize = `${titleSize}px`;
            title.style.lineHeight = titleSize >= 84 ? "0.94" : titleSize >= 64 ? "0.98" : "1.02";
        } else if (exampleText && !exampleBlock?.hidden && exampleSize > minExampleSize) {
            exampleSize -= 0.5;
            exampleText.style.fontSize = `${exampleSize}px`;
            exampleText.style.lineHeight = exampleSize > 14 ? "1.45" : "1.35";
        } else {
            break;
        }

        attempts += 1;
    }

    return true;
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

    const fitVisibleText = () => {
        const frontReady = fitFlashcardFaceContent(frontFace);
        const backReady = fitFlashcardFaceContent(backFace);
        if (!frontReady || !backReady) {
            window.requestAnimationFrame(() => {
                fitFlashcardFaceContent(frontFace);
                fitFlashcardFaceContent(backFace);
            });
        }
    };

    const paint = () => {
        const card = normalizeFlashcardForStage(cards[currentIndex]);
        const frontDensity = flashcardDensityForText(card.front, false);
        const backDensity = flashcardDensityForText(card.back, includeExample && Boolean(card.example));

        front.textContent = card.front;
        back.textContent = card.back;
        example.textContent = card.example || "Sem anotacoes.";
        exampleBlock.hidden = !includeExample || !card.example;
        counter.textContent = `${currentIndex + 1} de ${cards.length}`;
        theme.textContent = materialTheme;
        classLabel.textContent = turma ? `${turma} • ${materialTheme}` : materialTheme;

        frontFace.style.background = card.frontColor;
        backFace.style.background = card.backColor;
        frontFace.style.color = card.textColor;
        backFace.style.color = card.textColor;
        exampleBlock.style.color = card.textColor;
        frontFace.dataset.density = frontDensity;
        backFace.dataset.density = backDensity;

        cardRoot.classList.toggle("is-flipped", isFlipped);
        flipButton.textContent = isFlipped ? "Ver frente" : "Ver verso";
        prevButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === cards.length - 1;
        cardRoot.style.visibility = "visible";

        window.requestAnimationFrame(() => {
            fitVisibleText();
            window.setTimeout(fitVisibleText, 80);
        });
    };

    flipButton.addEventListener("click", () => {
        isFlipped = !isFlipped;
        paint();
    });

    cardRoot.addEventListener("click", (event) => {
        if (event.target.closest("button, a")) return;
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
    window.addEventListener("resize", fitVisibleText);
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readFlashcardsDraft();
    const cards = draft ? parseFlashcards(draft.stackHtml) : [];
    renderFlashcardsPresentation(cards.length ? cards : buildFallbackFlashcards(), draft?.controls || {});
});
