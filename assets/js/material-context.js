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

function normalizeMaterialType(type) {
    const value = String(type || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[_\s]+/g, "-");

    if (value === "aula-completa" || value === "lesson-sequence") return "lesson";
    if (value === "aula-com-slides" || value === "slide" || value === "slides-builder") return "slides";
    if (value === "quiz-builder" || value === "quiz-aplicacao") return "quiz";
    if (value === "flashcard" || value === "flashcards-builder") return "flashcards";
    if (value === "roleta") return "wheel";
    if (value === "forca") return "hangman";
    if (value === "palavras-cruzadas") return "crossword";
    if (value === "caca-palavras" || value === "caça-palavras") return "wordsearch";
    if (value === "jogo-da-memoria" || value === "jogo-memoria") return "memory";
    if (value === "ligar-pontos") return "match";
    if (value === "mapa-mental") return "mindmap";
    if (value === "debate-guiado") return "debate";
    return value || "slides";
}

function materialTypeFromPath(pathname = window.location.pathname) {
    const fileName = String(pathname || "").split("/").pop() || "";
    if (fileName === "aula-completa-apresentacao.html") return "lesson";
    if (fileName === "quiz-aplicacao.html") return "quiz";
    if (fileName === "flashcards-apresentacao.html") return "flashcards";
    if (fileName === "roleta-apresentacao.html") return "wheel";
    if (fileName === "forca-apresentacao.html") return "hangman";
    if (fileName === "palavras-cruzadas-apresentacao.html") return "crossword";
    if (fileName === "caca-palavras-apresentacao.html") return "wordsearch";
    if (fileName === "jogo-memoria-apresentacao.html") return "memory";
    if (fileName === "ligar-pontos-apresentacao.html") return "match";
    if (fileName === "mapa-mental-apresentacao.html") return "mindmap";
    if (fileName === "debate-guiado-apresentacao.html") return "debate";
    if (fileName === "apresentacao.html") return "slides";
    return "";
}

function presentationPathForMaterial(type) {
    const normalizedType = normalizeMaterialType(type);
    if (normalizedType === "lesson") return "aula-completa-apresentacao.html";
    if (normalizedType === "quiz") return "quiz-aplicacao.html";
    if (normalizedType === "flashcards") return "flashcards-apresentacao.html";
    if (normalizedType === "wheel") return "roleta-apresentacao.html";
    if (normalizedType === "hangman") return "forca-apresentacao.html";
    if (normalizedType === "crossword") return "palavras-cruzadas-apresentacao.html";
    if (normalizedType === "wordsearch") return "caca-palavras-apresentacao.html";
    if (normalizedType === "memory") return "jogo-memoria-apresentacao.html";
    if (normalizedType === "match") return "ligar-pontos-apresentacao.html";
    if (normalizedType === "mindmap") return "mapa-mental-apresentacao.html";
    if (normalizedType === "debate") return "debate-guiado-apresentacao.html";
    return "apresentacao.html";
}

function presentationLabelForMaterial(type) {
    if (type === "lesson") return "Aula completa";
    if (type === "flashcards") return "Flashcards";
    if (type === "quiz") return "Quiz";
    if (type === "wheel") return "Roleta";
    if (type === "hangman") return "Força";
    if (type === "crossword") return "Palavras cruzadas";
    if (type === "wordsearch") return "Caça-palavras";
    if (type === "memory") return "Jogo da memória";
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

function editorReturnPathFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const editor = params.get("editor");
        if (editor === "lesson") {
            return "criar-aula.html";
        }
    } catch (error) {
        console.warn("EducarIA editor url unavailable:", error);
    }

    return "";
}

function hydrateEditorReturnLinks() {
    const editorPath = editorReturnPathFromUrl();
    if (!editorPath) return;

    document.querySelectorAll("[data-return-to-editor]").forEach((link) => {
        link.setAttribute("href", editorPath);
    });
}

function bindEditorReturnTargets() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-return-to-editor]");
        if (!trigger || !trigger.getAttribute) return;

        const href = trigger.getAttribute("href");
        if (!href) return;

        if (window.top && window.top !== window) {
            event.preventDefault();
            window.top.location.href = href;
        }
    });
}

function hydratePresentationLinks() {
    const activeLessonId = lessonIdFromUrl();
    const activeLesson = activeLessonId
        ? readStoredLessonsCache().find((item) => String(item?.id || "") === activeLessonId)
        : null;
    const type = normalizeMaterialType(activeLesson?.materialType || document.body.dataset.materialType || materialTypeFromUrl() || readCurrentMaterialType());
    const path = presentationPathForMaterial(type);

    document.querySelectorAll("[data-presentation-link]").forEach((link) => {
        link.setAttribute("href", path);
    });

    const summaryType = document.querySelector("[data-summary-material-type]");
    if (summaryType) {
        summaryType.textContent = presentationLabelForMaterial(type);
    }
}

function redirectGenericPresentationIfNeeded() {
    const currentPath = String(window.location.pathname || "").split("/").pop() || "";
    if (currentPath !== "apresentacao.html") return;

    const type = normalizeMaterialType(materialTypeFromUrl() || readCurrentMaterialType());
    const targetPath = presentationPathForMaterial(type);
    if (!targetPath || targetPath === currentPath) return;

    window.location.replace(`${targetPath}${window.location.search || ""}${window.location.hash || ""}`);
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateLessonFromUrl();

    const urlType = materialTypeFromUrl();
    const pageType = document.body.dataset.materialType || urlType;
    if (pageType) {
        setCurrentMaterialType(pageType);
    }

    hydrateEditorReturnLinks();
    hydratePresentationLinks();
    redirectGenericPresentationIfNeeded();
    bindEditorReturnTargets();
});
