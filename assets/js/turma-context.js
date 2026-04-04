const TURMA_CONTEXT_KEY = "educaria:selectedClass";
const TURMA_LIST_KEY = "educaria:classList";
const EDUCARIA_RESET_KEY = "educaria:reset:empty-state-v1";
const DEFAULT_CLASSES = [];

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function normalizeClassLabel(value) {
    return typeof value === "string" ? value.trim() : "";
}

function ensureEmptyStartState() {
    try {
        const resetKey = scopedStorageKey(EDUCARIA_RESET_KEY);
        if (localStorage.getItem(resetKey) === "done") return;
        localStorage.setItem(resetKey, "done");
    } catch (error) {
        console.warn("EducarIA reset unavailable:", error);
    }
}

function readStoredClasses() {
    try {
        const parsed = JSON.parse(localStorage.getItem(scopedStorageKey(TURMA_LIST_KEY)) || "[]");
        return Array.isArray(parsed) ? parsed.map(normalizeClassLabel).filter(Boolean) : [];
    } catch (error) {
        console.warn("EducarIA class list unavailable:", error);
        return [];
    }
}

function saveClassList(classes) {
    try {
        localStorage.setItem(scopedStorageKey(TURMA_LIST_KEY), JSON.stringify(classes));
    } catch (error) {
        console.warn("EducarIA class list unavailable:", error);
    }
}

function getAvailableClasses() {
    const merged = [...DEFAULT_CLASSES, ...readStoredClasses()];
    return [...new Set(merged.map(normalizeClassLabel).filter(Boolean))];
}

function saveSelectedClass(value) {
    const turma = normalizeClassLabel(value);
    if (!turma) return;

    try {
        localStorage.setItem(scopedStorageKey(TURMA_CONTEXT_KEY), turma);
    } catch (error) {
        console.warn("EducarIA class context unavailable:", error);
    }
}

function readSelectedClass() {
    try {
        return normalizeClassLabel(localStorage.getItem(scopedStorageKey(TURMA_CONTEXT_KEY)));
    } catch (error) {
        console.warn("EducarIA class context unavailable:", error);
        return "";
    }
}

function syncSelectedOption(select, turma) {
    if (!select || !turma) return;

    const option = [...select.options].find((item) => {
        return normalizeClassLabel(item.value || item.textContent) === turma;
    });

    if (option) {
        select.value = option.value;
    }
}

function ensureClassOption(select, turma) {
    if (!select || !turma) return;

    const existing = [...select.options].find((item) => {
        return normalizeClassLabel(item.value || item.textContent) === turma;
    });

    if (existing) {
        existing.value = turma;
        existing.textContent = turma;
        select.value = turma;
        return;
    }

    const option = document.createElement("option");
    option.value = turma;
    option.textContent = turma;
    select.append(option);
    select.value = turma;
}

function populateClassPicker() {
    const picker = document.getElementById("turma-atalho");
    if (!picker) return;

    const current = readSelectedClass();
    const classes = getAvailableClasses();

    if (!classes.length) {
        picker.innerHTML = `<option value="">Nenhuma turma criada ainda</option>`;
        picker.value = "";
        return;
    }

    picker.innerHTML = classes.map((turma) => `<option value="${turma}">${turma}</option>`).join("");
    syncSelectedOption(picker, current || classes[0]);
}

function createClassFromForm() {
    const picker = document.getElementById("turma-atalho");
    const nameField = document.getElementById("nome-turma");
    const feedback = document.querySelector("[data-create-class-feedback]");
    if (!picker || !nameField) return;

    const turma = normalizeClassLabel(nameField.value);
    if (!turma) {
        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = "Digite um nome para criar a turma.";
        }
        nameField.focus();
        return;
    }

    const classes = getAvailableClasses();
    const alreadyExists = classes.some((item) => normalizeClassLabel(item) === turma);
    const nextClasses = alreadyExists ? classes : [...classes, turma];

    if (!alreadyExists) {
        saveClassList(nextClasses);
    }

    ensureClassOption(picker, turma);
    saveSelectedClass(turma);

    if (feedback) {
        feedback.hidden = false;
        feedback.textContent = alreadyExists
            ? `A turma ${turma} ja estava na lista e foi selecionada.`
            : `Turma ${turma} criada e pronta para usar.`;
    }
}

function initClassPicker() {
    const picker = document.getElementById("turma-atalho");
    if (!picker) return;

    populateClassPicker();

    const persistCurrentSelection = () => saveSelectedClass(picker.value);
    if (picker.value) persistCurrentSelection();

    picker.addEventListener("change", persistCurrentSelection);

    document.querySelectorAll("[data-uses-selected-class]").forEach((element) => {
        element.addEventListener("click", persistCurrentSelection);
    });

    const createButton = document.querySelector("[data-create-class]");
    if (createButton) {
        createButton.addEventListener("click", createClassFromForm);
    }
}

function hydrateCreateLessonPage() {
    const turma = readSelectedClass();
    if (!turma) return;

    syncSelectedOption(document.getElementById("turma"), turma);

    const currentClassTitle = document.querySelector("[data-current-class]");
    if (currentClassTitle) {
        currentClassTitle.textContent = turma;
    }
}

function hydrateClassPages() {
    const turma = readSelectedClass();
    if (!turma) return;

    document.querySelectorAll("[data-class-title]").forEach((element) => {
        element.textContent = turma;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    ensureEmptyStartState();
    initClassPicker();
    hydrateCreateLessonPage();
    hydrateClassPages();
});
