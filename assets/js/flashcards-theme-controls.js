const FLASHCARD_THEME_PRESETS = {
    moderno: {
        front: "#ffffff",
        back: "#dbeafe",
        text: "#0f172a"
    },
    academico: {
        front: "#f8fafc",
        back: "#e0e7ff",
        text: "#172554"
    },
    vibrante: {
        front: "#fff7ed",
        back: "#ffedd5",
        text: "#7c2d12"
    },
    minimalista: {
        front: "#f8fafc",
        back: "#e2e8f0",
        text: "#0f172a"
    },
    infantil: {
        front: "#fff1f2",
        back: "#fce7f3",
        text: "#4a044e"
    }
};

function flashcardThemeFields() {
    return {
        preset: document.getElementById("cards-tema-visual"),
        front: document.getElementById("cards-tema-front"),
        back: document.getElementById("cards-tema-back"),
        text: document.getElementById("cards-tema-text")
    };
}

function syncFlashcardPresetToControls() {
    const fields = flashcardThemeFields();
    if (!fields.preset) return;

    const preset = FLASHCARD_THEME_PRESETS[fields.preset.value];
    if (!preset) return;

    if (fields.front) fields.front.value = preset.front;
    if (fields.back) fields.back.value = preset.back;
    if (fields.text) fields.text.value = preset.text;
}

function applyThemeToAllFlashcards() {
    const fields = flashcardThemeFields();
    const cards = [...document.querySelectorAll("[data-flashcard]")];
    if (!cards.length) return;

    cards.forEach((card) => {
        const front = card.querySelector('[data-field="front-color"]');
        const back = card.querySelector('[data-field="back-color"]');
        const text = card.querySelector('[data-field="text-color"]');

        if (front && fields.front) front.value = fields.front.value;
        if (back && fields.back) back.value = fields.back.value;
        if (text && fields.text) text.value = fields.text.value;
    });

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
}

function bindFlashcardsThemeControls() {
    const fields = flashcardThemeFields();
    if (!fields.preset) return;

    syncFlashcardPresetToControls();

    fields.preset.addEventListener("change", () => {
        syncFlashcardPresetToControls();
    });

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-apply-flashcards-theme]");
        if (!button) return;

        event.preventDefault();
        applyThemeToAllFlashcards();
    });
}

document.addEventListener("DOMContentLoaded", bindFlashcardsThemeControls);
