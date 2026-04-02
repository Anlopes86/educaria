const EDUCARIA_MATERIAL_TYPE_KEY = "educaria:currentMaterialType";

function setCurrentMaterialType(type) {
    try {
        localStorage.setItem(EDUCARIA_MATERIAL_TYPE_KEY, type);
    } catch (error) {
        console.warn("EducarIA material context unavailable:", error);
    }
}

function readCurrentMaterialType() {
    try {
        return localStorage.getItem(EDUCARIA_MATERIAL_TYPE_KEY) || "slides";
    } catch (error) {
        console.warn("EducarIA material context unavailable:", error);
        return "slides";
    }
}

function presentationPathForMaterial(type) {
    if (type === "quiz") return "quiz-aplicacao.html";
    if (type === "flashcards") return "flashcards-apresentacao.html";
    if (type === "wheel") return "roleta-apresentacao.html";
    if (type === "memory") return "jogo-memoria-apresentacao.html";
    return "apresentacao.html";
}

function presentationLabelForMaterial(type) {
    if (type === "flashcards") return "Flashcards";
    if (type === "quiz") return "Quiz";
    if (type === "wheel") return "Roleta";
    if (type === "memory") return "Jogo da memoria";
    return "Aula com slides";
}

function materialTypeFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const value = params.get("material");
        if (["flashcards", "slides", "quiz", "wheel", "memory"].includes(value)) {
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
    const urlType = materialTypeFromUrl();
    const pageType = document.body.dataset.materialType || urlType;
    if (pageType) {
        setCurrentMaterialType(pageType);
    }

    hydratePresentationLinks();
});
