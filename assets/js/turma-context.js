function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const TURMA_CONTEXT_KEY = "educaria:selectedClass";
const TURMA_LIST_KEY = "educaria:classList";
const TURMA_PROFILES_KEY = "educaria:classProfiles";
const EDUCARIA_RESET_KEY = "educaria:reset:empty-state-v1";
const DEFAULT_CLASSES = [];
const TURMA_REMOTE_COLLECTION = "platform";
const TURMA_REMOTE_DOC = "classes";

let classesSyncPromise = null;
let lastClassesSyncUid = "";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function normalizeClassLabel(value) {
    return typeof value === "string" ? value.trim() : "";
}

function uniqueClassList(classes) {
    return [...new Set((Array.isArray(classes) ? classes : []).map(normalizeClassLabel).filter(Boolean))];
}

function emitClassesUpdated(source = "local") {
    document.dispatchEvent(new CustomEvent("educaria-classes-updated", {
        detail: {
            source,
            classes: getAvailableClasses()
        }
    }));
}

function firebaseClassesRef() {
    if (typeof firebaseServices !== "function" || typeof readCurrentTeacher !== "function") return null;

    const teacher = readCurrentTeacher();
    if (!teacher?.uid) return null;

    const services = firebaseServices();
    if (!services?.db) return null;

    return services.db
        .collection("teachers")
        .doc(teacher.uid)
        .collection(TURMA_REMOTE_COLLECTION)
        .doc(TURMA_REMOTE_DOC);
}

function normalizeClassProfile(className, profile = {}) {
    const normalizedName = normalizeClassLabel(className);
    if (!normalizedName) return null;

    const studentCount = Number.parseInt(profile.studentCount, 10);
    return {
        school: String(profile.school || "").trim().slice(0, 120),
        subject: String(profile.subject || "").trim().slice(0, 80),
        studentCount: Number.isFinite(studentCount) ? Math.min(500, Math.max(0, studentCount)) : 0,
        notes: String(profile.notes || "").trim().slice(0, 500),
        updatedAt: String(profile.updatedAt || "").trim()
    };
}

function normalizeClassProfiles(profiles) {
    if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) return {};
    return Object.entries(profiles).reduce((result, [className, profile]) => {
        const normalizedName = normalizeClassLabel(className);
        const normalizedProfile = normalizeClassProfile(normalizedName, profile);
        if (normalizedName && normalizedProfile) result[normalizedName] = normalizedProfile;
        return result;
    }, {});
}

function readStoredClassProfiles() {
    try {
        const parsed = JSON.parse(localStorage.getItem(scopedStorageKey(TURMA_PROFILES_KEY)) || "{}");
        return normalizeClassProfiles(parsed);
    } catch (error) {
        console.warn("EducarIA class profiles unavailable:", error);
        return {};
    }
}

function writeClassProfilesLocally(profiles, source = "local", notify = true) {
    const normalized = normalizeClassProfiles(profiles);
    try {
        localStorage.setItem(scopedStorageKey(TURMA_PROFILES_KEY), JSON.stringify(normalized));
    } catch (error) {
        console.warn("EducarIA class profiles unavailable:", error);
    }
    if (notify) emitClassesUpdated(source);
    return normalized;
}

function mergeClassProfiles(remoteProfiles, localProfiles) {
    const remote = normalizeClassProfiles(remoteProfiles);
    const local = normalizeClassProfiles(localProfiles);
    const merged = { ...remote };

    Object.entries(local).forEach(([className, profile]) => {
        const remoteTimestamp = Date.parse(remote[className]?.updatedAt || "") || 0;
        const localTimestamp = Date.parse(profile.updatedAt || "") || 0;
        if (!remote[className] || localTimestamp >= remoteTimestamp) merged[className] = profile;
    });
    return merged;
}

function readRemoteClassesPayload(snapshot) {
    if (!snapshot?.exists) return { classes: [], profiles: {} };
    const data = snapshot.data() || {};
    return {
        classes: uniqueClassList(data.classes || []),
        profiles: normalizeClassProfiles(data.profiles || {})
    };
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
        return uniqueClassList(parsed);
    } catch (error) {
        console.warn("EducarIA class list unavailable:", error);
        return [];
    }
}

function writeClassListLocally(classes, source = "local") {
    const normalized = uniqueClassList(classes);

    try {
        localStorage.setItem(scopedStorageKey(TURMA_LIST_KEY), JSON.stringify(normalized));
    } catch (error) {
        console.warn("EducarIA class list unavailable:", error);
    }

    emitClassesUpdated(source);
    return normalized;
}

async function syncClassesWithFirebase() {
    const teacher = typeof readCurrentTeacher === "function" ? readCurrentTeacher() : null;
    const uid = teacher?.uid || "";
    const ref = firebaseClassesRef();

    if (!uid || !ref) {
        lastClassesSyncUid = "";
        return getAvailableClasses();
    }

    if (classesSyncPromise) return classesSyncPromise;

    classesSyncPromise = (async () => {
        try {
            const localClasses = getAvailableClasses();
            const snapshot = await ref.get();
            const remotePayload = readRemoteClassesPayload(snapshot);
            const remoteClasses = remotePayload.classes;
            const localProfiles = readStoredClassProfiles();
            const mergedProfiles = mergeClassProfiles(remotePayload.profiles, localProfiles);
            const mergedClasses = uniqueClassList([...remoteClasses, ...localClasses]);

            writeClassProfilesLocally(mergedProfiles, "firebase", false);
            writeClassListLocally(mergedClasses, "firebase");

            const remoteChanged = mergedClasses.length !== remoteClasses.length
                || mergedClasses.some((item, index) => item !== remoteClasses[index])
                || JSON.stringify(mergedProfiles) !== JSON.stringify(remotePayload.profiles);

            if (remoteChanged || lastClassesSyncUid !== uid) {
                await ref.set({
                    classes: mergedClasses,
                    profiles: mergedProfiles,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }

            lastClassesSyncUid = uid;
            return mergedClasses;
        } catch (error) {
            console.warn("EducarIA class sync unavailable:", error);
            return getAvailableClasses();
        } finally {
            classesSyncPromise = null;
        }
    })();

    return classesSyncPromise;
}

function saveClassList(classes) {
    const normalized = writeClassListLocally(classes, "local");
    syncClassesWithFirebase();
    return normalized;
}

function getAvailableClasses() {
    const merged = [...DEFAULT_CLASSES, ...readStoredClasses()];
    return uniqueClassList(merged);
}

function getClassProfile(className) {
    const turma = normalizeClassLabel(className);
    return turma ? (readStoredClassProfiles()[turma] || normalizeClassProfile(turma)) : null;
}

function saveClassProfile(className, details = {}) {
    const turma = normalizeClassLabel(className);
    if (!turma) return null;

    const profiles = readStoredClassProfiles();
    const profile = normalizeClassProfile(turma, {
        ...(profiles[turma] || {}),
        ...details,
        updatedAt: new Date().toISOString()
    });
    writeClassProfilesLocally({ ...profiles, [turma]: profile });
    syncClassesWithFirebase();
    return profile;
}

function renameClass(currentName, nextName, details = {}) {
    const current = normalizeClassLabel(currentName);
    const next = normalizeClassLabel(nextName);
    const classes = getAvailableClasses();
    if (!current || !next) return { ok: false, error: "Digite um nome válido para a turma." };
    if (current !== next && classes.some((item) => item !== current && normalizeClassLabel(item).toLowerCase() === next.toLowerCase())) {
        return { ok: false, error: "Já existe uma turma com esse nome." };
    }

    const profiles = readStoredClassProfiles();
    const nextProfiles = { ...profiles };
    delete nextProfiles[current];
    nextProfiles[next] = normalizeClassProfile(next, {
        ...(profiles[current] || {}),
        ...details,
        updatedAt: new Date().toISOString()
    });
    writeClassProfilesLocally(nextProfiles, "rename", false);

    if (current !== next && typeof readLessonsLibrary === "function" && typeof writeLessonsLibrary === "function") {
        const now = new Date().toISOString();
        const lessons = readLessonsLibrary().map((lesson) => {
            if (lesson.className !== current) return lesson;
            return { ...lesson, className: next, updatedAt: now };
        });
        writeLessonsLibrary(lessons, { source: "class-renamed" });
    }

    const nextClasses = classes.map((item) => item === current ? next : item);
    saveSelectedClass(next);
    writeClassListLocally(nextClasses, "rename");

    const ref = firebaseClassesRef();
    if (ref) {
        ref.set({
            classes: nextClasses,
            profiles: nextProfiles,
            updatedAt: new Date().toISOString()
        }, { merge: true }).catch((error) => {
            console.warn("EducarIA class rename sync unavailable:", error);
        });
    }
    return { ok: true, className: next, profile: nextProfiles[next] };
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

    picker.innerHTML = classes.map((turma) => `<option value="${escapeHtml(turma)}">${escapeHtml(turma)}</option>`).join("");
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

    if (!alreadyExists && classes.length === 0 && typeof window.educariaMarkMilestone === "function") {
        window.educariaMarkMilestone("activation_first_class_created", {
            source: "turma_context_form",
            className: turma
        });
    }
    if (typeof window.educariaEvaluateActivationMilestones === "function") {
        window.educariaEvaluateActivationMilestones("turma_context_create", {
            markCompletion: true
        });
    }

    if (feedback) {
        feedback.hidden = false;
        feedback.textContent = alreadyExists
            ? `A turma ${turma} já estava na lista e foi selecionada.`
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
    syncClassesWithFirebase();
});

document.addEventListener("educaria-auth-changed", () => {
    syncClassesWithFirebase();
});

document.addEventListener("educaria-classes-updated", () => {
    populateClassPicker();
    hydrateCreateLessonPage();
    hydrateClassPages();
});
