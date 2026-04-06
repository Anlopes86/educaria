const EDUCARIA_MATERIAL_TYPE_KEY = "educaria:currentMaterialType";
const EDUCARIA_ACTIVE_LESSON_KEY = "educaria:activeLessonId";
const EDUCARIA_ACTIVE_LESSON_SEQUENCE_KEY = "educaria:activeLessonSequenceId";
const EDUCARIA_CLASS_CONTEXT_KEY = "educaria:selectedClass";
const EDUCARIA_LESSONS_LIBRARY_KEY = "educaria:lessons";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function draftStorageKeyForType(type) {
    if (type === "lesson") return scopedStorageKey("educaria:builder:lesson");
    if (type === "quiz") return scopedStorageKey("educaria:builder:quiz");
    if (type === "flashcards") return scopedStorageKey("educaria:builder:flashcards");
    if (type === "wheel") return scopedStorageKey("educaria:builder:wheel");
    if (type === "hangman") return scopedStorageKey("educaria:builder:hangman");
    if (type === "crossword") return scopedStorageKey("educaria:builder:crossword");
    if (type === "wordsearch") return scopedStorageKey("educaria:builder:wordsearch");
    if (type === "memory") return scopedStorageKey("educaria:builder:memory");
    if (type === "match") return scopedStorageKey("educaria:builder:match");
    if (type === "mindmap") return scopedStorageKey("educaria:builder:mindmap");
    if (type === "debate") return scopedStorageKey("educaria:builder:debate");
    return scopedStorageKey("educaria:builder:slides");
}

function readStoredLessonsCache() {
    try {
        const raw = localStorage.getItem(EDUCARIA_LESSONS_LIBRARY_KEY);
        const scopedRaw = localStorage.getItem(scopedStorageKey(EDUCARIA_LESSONS_LIBRARY_KEY));
        const parsed = scopedRaw ? JSON.parse(scopedRaw) : (raw ? JSON.parse(raw) : []);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("EducarIA lesson cache unavailable:", error);
        return [];
    }
}

function lessonIdFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get("lesson") || "";
    } catch (error) {
        console.warn("EducarIA lesson url unavailable:", error);
        return "";
    }
}

function hydrateLessonFromUrl() {
    const lessonId = lessonIdFromUrl();
    if (!lessonId) return;

    const lesson = readStoredLessonsCache().find((item) => String(item?.id || "") === lessonId);
    if (!lesson) return;

    const materialType = String(lesson.materialType || "slides").trim() || "slides";

    try {
        localStorage.setItem(scopedStorageKey(EDUCARIA_ACTIVE_LESSON_KEY), lesson.id);
        if (materialType === "lesson") {
            localStorage.setItem(scopedStorageKey(EDUCARIA_ACTIVE_LESSON_SEQUENCE_KEY), lesson.id);
        }
        if (lesson.className) {
            localStorage.setItem(scopedStorageKey(EDUCARIA_CLASS_CONTEXT_KEY), lesson.className);
        }
        if (typeof lesson.draft === "string" && lesson.draft) {
            localStorage.setItem(draftStorageKeyForType(materialType), lesson.draft);
        }
    } catch (error) {
        console.warn("EducarIA lesson hydration unavailable:", error);
    }

    setCurrentMaterialType(materialType);
}

function setCurrentMaterialType(type) {
    try {
        localStorage.setItem(scopedStorageKey(EDUCARIA_MATERIAL_TYPE_KEY), type);
    } catch (error) {
        console.warn("EducarIA material context unavailable:", error);
    }
}

function readCurrentMaterialType() {
    try {
        return localStorage.getItem(scopedStorageKey(EDUCARIA_MATERIAL_TYPE_KEY)) || "slides";
    } catch (error) {
        console.warn("EducarIA material context unavailable:", error);
        return "slides";
    }
}

function presentationPathForMaterial(type) {
    if (type === "lesson") return "aula-completa-apresentacao.html";
    if (type === "quiz") return "quiz-aplicacao.html";
    if (type === "flashcards") return "flashcards-apresentacao.html";
    if (type === "wheel") return "roleta-apresentacao.html";
    if (type === "hangman") return "forca-apresentacao.html";
    if (type === "crossword") return "palavras-cruzadas-apresentacao.html";
    if (type === "wordsearch") return "caca-palavras-apresentacao.html";
    if (type === "memory") return "jogo-memoria-apresentacao.html";
    if (type === "match") return "ligar-pontos-apresentacao.html";
    if (type === "mindmap") return "mapa-mental-apresentacao.html";
    if (type === "debate") return "debate-guiado-apresentacao.html";
    return "apresentacao.html";
}

function presentationLabelForMaterial(type) {
    if (type === "lesson") return "Aula completa";
    if (type === "flashcards") return "Flashcards";
    if (type === "quiz") return "Quiz";
    if (type === "wheel") return "Roleta";
    if (type === "hangman") return "Forca";
    if (type === "crossword") return "Palavras cruzadas";
    if (type === "wordsearch") return "Caca-palavras";
    if (type === "memory") return "Jogo da memoria";
    if (type === "match") return "Ligar pontos";
    if (type === "mindmap") return "Mapa mental";
    if (type === "debate") return "Debate guiado";
    return "Aula com slides";
}

function materialTypeFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const value = params.get("material");
        if (["lesson", "flashcards", "slides", "quiz", "wheel", "hangman", "crossword", "wordsearch", "memory", "match", "mindmap", "debate"].includes(value)) {
            return value;
        }
    } catch (error) {
        console.warn("EducarIA material url unavailable:", error);
    }

    return "";
}

function hydratePresentationLinks() {
    const type = readCurrentMaterialType();
    const path = presentationPathForMaterial(type);

    document.querySelectorAll("[data-presentation-link]").forEach((link) => {
        link.setAttribute("href", path);
    });

    const summaryType = document.querySelector("[data-summary-material-type]");
    if (summaryType) {
        summaryType.textContent = presentationLabelForMaterial(type);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateLessonFromUrl();

    const urlType = materialTypeFromUrl();
    const pageType = document.body.dataset.materialType || urlType;
    if (pageType) {
        setCurrentMaterialType(pageType);
    }

    hydratePresentationLinks();
});
