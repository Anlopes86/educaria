function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function lessonLibraryTranslate(key, fallback) {
    if (typeof window !== "undefined" && typeof window.educariaTranslate === "function") {
        return window.educariaTranslate(key, fallback);
    }
    return fallback || key;
}

const LESSONS_LIBRARY_KEY = "educaria:lessons";
const ACTIVE_LESSON_KEY = "educaria:activeLessonId";
const CLASS_CONTEXT_KEY = "educaria:selectedClass";
const DELETED_LESSONS_KEY = "educaria:deletedLessons";
const LESSON_SCOPE_LIBRARY = "library";
const LESSON_SCOPE_CLASS = "class";
const LESSONS_REMOTE_COLLECTION = "lessons";
const LESSON_STATUS_DRAFT = "draft";
const LESSON_STATUS_READY = "ready";
const CLASS_MATERIAL_FILTERS = [
    { id: "all", label: "Todos", labelKey: "classDetail.filters.all", types: null },
    { id: "lesson", label: "Aulas", labelKey: "classDetail.filters.lesson", types: ["lesson"] },
    { id: "slides", label: "Slides", labelKey: "classDetail.filters.slides", types: ["slides"] },
    { id: "quiz", label: "Quizzes", labelKey: "classDetail.filters.quiz", types: ["quiz"] },
    { id: "flashcards", label: "Flashcards", labelKey: "classDetail.filters.flashcards", types: ["flashcards"] },
    { id: "others", label: "Outros", labelKey: "classDetail.filters.others", types: ["wheel", "hangman", "crossword", "wordsearch", "memory", "match", "mindmap", "debate"] }
];

let lessonsSyncPromise = null;
let lastLessonsSyncUid = "";
let activeClassMaterialFilter = "all";
let activeLibraryMaterialFilter = "all";
let activeLibraryStatusFilter = "all";
let activeLibrarySort = "recent";
let librarySearchQuery = "";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function draftKeyForType(type) {
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

function stackSelectorForType(type) {
    if (type === "lesson") return "[data-lesson-sequence-list]";
    if (type === "quiz") return "[data-quiz-stack]";
    if (type === "flashcards") return "[data-flashcards-stack]";
    if (type === "wheel") return "[data-wheel-segments]";
    if (type === "hangman") return "[data-hangman-entries]";
    if (type === "crossword") return "[data-crossword-entries]";
    if (type === "wordsearch") return "[data-wordsearch-words]";
    if (type === "memory") return "[data-memory-pairs]";
    if (type === "match") return "[data-match-pairs]";
    if (type === "mindmap") return "[data-mind-branches]";
    if (type === "debate") return "[data-debate-steps]";
    return "[data-slides-stack]";
}

function lessonTimestampValue(lesson) {
    const parsed = Date.parse(lesson?.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
}

function isoTimestampOrEmpty(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function normalizeLessonStatus(value) {
    return String(value || "").trim().toLowerCase() === LESSON_STATUS_READY
        ? LESSON_STATUS_READY
        : LESSON_STATUS_DRAFT;
}

function normalizeStringList(value, limit = 8) {
    const list = Array.isArray(value) ? value : String(value || "").split(",");
    const seen = new Set();
    return list
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .filter((item) => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, limit);
}

function extractBnccCodesFromText(value) {
    const matches = String(value || "").match(/\b(?:EF\d{2}[A-Z]{2}\d{2}|EM\d{2}[A-Z]{3}\d{3})\b/gi) || [];
    return normalizeStringList(matches.map((code) => code.toUpperCase()), 12);
}

function inferPedagogicalTags(lesson) {
    const text = normalizeSearchText([
        lesson?.title,
        lesson?.summary,
        lesson?.type,
        lesson?.materialType
    ].join(" "));
    const tags = [];

    if (text.includes("avaliacao") || text.includes("quiz")) tags.push("avaliacao");
    if (text.includes("revisao") || text.includes("flashcard")) tags.push("revisao");
    if (text.includes("debate") || text.includes("argument")) tags.push("argumentacao");
    if (text.includes("vocabulario") || text.includes("palavra")) tags.push("vocabulario");
    if (text.includes("mapa") || text.includes("conceito")) tags.push("organizacao");

    return normalizeStringList(tags, 6);
}

function sortLessonsByUpdatedAt(lessons) {
    return [...lessons].sort((left, right) => {
        const timestampDiff = lessonTimestampValue(right) - lessonTimestampValue(left);
        if (timestampDiff !== 0) return timestampDiff;
        return String(right?.id || "").localeCompare(String(left?.id || ""));
    });
}

function normalizeLessonRecord(lesson) {
    if (!lesson || typeof lesson !== "object") return null;

    const materialType = String(lesson.materialType || "slides").trim() || "slides";
    const className = String(lesson.className || "").trim();
    const scope = lesson.scope || (className ? LESSON_SCOPE_CLASS : LESSON_SCOPE_LIBRARY);
    const updatedAt = isoTimestampOrEmpty(lesson.updatedAt) || new Date().toISOString();
    const createdAt = isoTimestampOrEmpty(lesson.createdAt) || updatedAt;
    const normalizedType = materialType === "hangman"
        ? "Forca"
        : (String(lesson.type || materialGroupLabel(materialType)).trim() || materialGroupLabel(materialType));
    const baseRecord = {
        title: String(lesson.title || "").trim() || "Material sem titulo",
        summary: String(lesson.summary || "").trim() || "Material salvo sem resumo definido.",
        type: normalizedType,
        materialType
    };
    const bnccCodes = normalizeStringList([
        ...normalizeStringList(lesson.bnccCodes, 12),
        ...extractBnccCodesFromText(`${baseRecord.title} ${baseRecord.summary} ${String(lesson.draft || "").slice(0, 5000)}`)
    ], 12);

    return {
        id: String(lesson.id || `lesson-${Date.now()}`),
        className: scope === LESSON_SCOPE_CLASS ? className : "",
        scope,
        ...baseRecord,
        createdAt,
        updatedAt,
        status: normalizeLessonStatus(lesson.status),
        bnccCodes,
        tags: normalizeStringList([
            ...normalizeStringList(lesson.tags, 6),
            ...inferPedagogicalTags(baseRecord)
        ], 6),
        lastOpenedAt: isoTimestampOrEmpty(lesson.lastOpenedAt),
        lastPresentedAt: isoTimestampOrEmpty(lesson.lastPresentedAt),
        lastUsedAt: isoTimestampOrEmpty(lesson.lastUsedAt),
        usageCount: Number.isFinite(Number(lesson.usageCount)) ? Math.max(0, Number(lesson.usageCount)) : 0,
        draft: typeof lesson.draft === "string" ? lesson.draft : ""
    };
}

function mergeLessonRecords(localLessons, remoteLessons) {
    const merged = new Map();

    remoteLessons.forEach((lesson) => {
        const normalized = normalizeLessonRecord(lesson);
        if (normalized) {
            merged.set(normalized.id, normalized);
        }
    });

    localLessons.forEach((lesson) => {
        const normalized = normalizeLessonRecord(lesson);
        if (!normalized) return;

        const existing = merged.get(normalized.id);
        if (!existing || lessonTimestampValue(normalized) >= lessonTimestampValue(existing)) {
            merged.set(normalized.id, normalized);
        }
    });

    return sortLessonsByUpdatedAt([...merged.values()]);
}

function lessonsAreEqual(leftLessons, rightLessons) {
    const left = sortLessonsByUpdatedAt(leftLessons.map(normalizeLessonRecord).filter(Boolean));
    const right = sortLessonsByUpdatedAt(rightLessons.map(normalizeLessonRecord).filter(Boolean));
    return JSON.stringify(left) === JSON.stringify(right);
}

function emitLessonsUpdated(source = "local") {
    document.dispatchEvent(new CustomEvent("educaria-lessons-updated", {
        detail: {
            source,
            lessons: readLessonsLibrary()
        }
    }));
}

function firebaseLessonsCollection() {
    if (typeof firebaseServices !== "function" || typeof readCurrentTeacher !== "function") return null;

    const teacher = readCurrentTeacher();
    if (!teacher?.uid) return null;

    const services = firebaseServices();
    if (!services?.db) return null;

    return services.db
        .collection("teachers")
        .doc(teacher.uid)
        .collection(LESSONS_REMOTE_COLLECTION);
}

function readDeletedLessonIds() {
    try {
        const parsed = JSON.parse(localStorage.getItem(scopedStorageKey(DELETED_LESSONS_KEY)) || "[]");
        return [...new Set((Array.isArray(parsed) ? parsed : []).map((item) => String(item || "").trim()).filter(Boolean))];
    } catch (error) {
        console.warn("EducarIA deleted lessons unavailable:", error);
        return [];
    }
}

function writeDeletedLessonIds(ids) {
    const normalized = [...new Set((Array.isArray(ids) ? ids : []).map((item) => String(item || "").trim()).filter(Boolean))];

    try {
        localStorage.setItem(scopedStorageKey(DELETED_LESSONS_KEY), JSON.stringify(normalized));
    } catch (error) {
        console.warn("EducarIA deleted lessons unavailable:", error);
    }

    return normalized;
}

function queueDeletedLessonId(id) {
    const lessonId = String(id || "").trim();
    if (!lessonId) return;
    writeDeletedLessonIds([...readDeletedLessonIds(), lessonId]);
}

function clearDeletedLessonId(id) {
    const lessonId = String(id || "").trim();
    if (!lessonId) return;
    writeDeletedLessonIds(readDeletedLessonIds().filter((item) => item !== lessonId));
}

function readLessonsLibrary() {
    try {
        const raw = localStorage.getItem(LESSONS_LIBRARY_KEY);
        const scopedRaw = localStorage.getItem(scopedStorageKey(LESSONS_LIBRARY_KEY));
        const parsed = scopedRaw ? JSON.parse(scopedRaw) : (raw ? JSON.parse(raw) : []);
        return mergeLessonRecords(Array.isArray(parsed) ? parsed : [], []);
    } catch (error) {
        console.warn("EducarIA lessons unavailable:", error);
        return [];
    }
}

function writeLessonsLibrary(lessons, options = {}) {
    const normalized = mergeLessonRecords(Array.isArray(lessons) ? lessons : [], []);

    try {
        localStorage.setItem(scopedStorageKey(LESSONS_LIBRARY_KEY), JSON.stringify(normalized));
    } catch (error) {
        console.warn("EducarIA lessons unavailable:", error);
    }

    emitLessonsUpdated(options.source || "local");

    if (!options.skipSync) {
        syncLessonsWithFirebase();
    }

    return normalized;
}

function normalizeLessonScope(lesson) {
    if (lesson?.scope) return lesson.scope;
    return lesson?.className ? LESSON_SCOPE_CLASS : LESSON_SCOPE_LIBRARY;
}

function removeLessonById(id) {
    const lessons = readLessonsLibrary().filter((lesson) => lesson.id !== id);
    queueDeletedLessonId(id);
    writeLessonsLibrary(lessons);

    if (readActiveLessonId() === id) {
        writeActiveLessonId("");
    }
}

function updateLessonRecordById(id, updater, options = {}) {
    const lessonId = String(id || "").trim();
    if (!lessonId || typeof updater !== "function") return null;

    const lessons = readLessonsLibrary();
    const current = lessons.find((lesson) => lesson.id === lessonId);
    if (!current) return null;

    const nextRecord = normalizeLessonRecord(updater({ ...current }));
    if (!nextRecord) return null;

    const nextLessons = lessons.filter((lesson) => lesson.id !== lessonId);
    nextLessons.unshift(nextRecord);
    writeLessonsLibrary(nextLessons, options);
    return nextRecord;
}

function markLessonOpened(id) {
    const now = new Date().toISOString();
    return updateLessonRecordById(id, (lesson) => ({
        ...lesson,
        lastOpenedAt: now
    }), { source: "usage" });
}

function markLessonPresented(id) {
    const now = new Date().toISOString();
    return updateLessonRecordById(id, (lesson) => ({
        ...lesson,
        status: lesson.status || LESSON_STATUS_DRAFT,
        lastPresentedAt: now,
        lastUsedAt: now,
        usageCount: Number(lesson.usageCount || 0) + 1
    }), { source: "usage" });
}

function updateLessonStatus(id, status) {
    return updateLessonRecordById(id, (lesson) => ({
        ...lesson,
        status: normalizeLessonStatus(status)
    }));
}

function markLessonReady(id) {
    return updateLessonStatus(id, LESSON_STATUS_READY);
}

function duplicateLessonToClass(id, targetClass) {
    const lesson = readLessonsLibrary().find((item) => item.id === id);
    const turma = String(targetClass || "").trim();
    if (!lesson || !turma) return null;

    const now = new Date().toISOString();
    const copy = {
        ...lesson,
        id: `lesson-${Date.now()}`,
        className: turma,
        scope: LESSON_SCOPE_CLASS,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: "",
        lastPresentedAt: "",
        lastUsedAt: "",
        usageCount: 0
    };

    return persistLessonRecord(copy);
}

function addLessonToLibrary(id) {
    const lesson = readLessonsLibrary().find((item) => item.id === id);
    if (!lesson) return null;

    const now = new Date().toISOString();
    const copy = {
        ...lesson,
        id: `lesson-${Date.now()}`,
        className: "",
        scope: LESSON_SCOPE_LIBRARY,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: "",
        lastPresentedAt: "",
        lastUsedAt: "",
        usageCount: 0
    };

    return persistLessonRecord(copy);
}

async function syncLessonsWithFirebase() {
    const teacher = typeof readCurrentTeacher === "function" ? readCurrentTeacher() : null;
    const uid = teacher?.uid || "";
    const collection = firebaseLessonsCollection();

    if (!uid || !collection) {
        lastLessonsSyncUid = "";
        return readLessonsLibrary();
    }

    if (lessonsSyncPromise) return lessonsSyncPromise;

    lessonsSyncPromise = (async () => {
        try {
            const localLessons = readLessonsLibrary();
            const deletedIds = readDeletedLessonIds();
            const snapshot = await collection.get();
            const remoteLessons = [];

            snapshot.forEach((doc) => {
                if (deletedIds.includes(doc.id)) return;
                const normalized = normalizeLessonRecord({ id: doc.id, ...doc.data() });
                if (normalized) {
                    remoteLessons.push(normalized);
                }
            });

            const mergedLessons = mergeLessonRecords(localLessons, remoteLessons);
            const remoteNeedsRefresh = lastLessonsSyncUid !== uid
                || deletedIds.length > 0
                || !lessonsAreEqual(remoteLessons, mergedLessons);

            writeLessonsLibrary(mergedLessons, { skipSync: true, source: "firebase" });

            if (deletedIds.length) {
                await Promise.all(deletedIds.map(async (lessonId) => {
                    try {
                        await collection.doc(lessonId).delete();
                    } catch (error) {
                        console.warn("EducarIA lesson delete unavailable:", error);
                    }
                }));
                writeDeletedLessonIds([]);
            }

            if (remoteNeedsRefresh) {
                await Promise.all(mergedLessons.map((lesson) => {
                    return collection.doc(lesson.id).set(lesson, { merge: true });
                }));
            }

            lastLessonsSyncUid = uid;
            return mergedLessons;
        } catch (error) {
            console.warn("EducarIA lessons sync unavailable:", error);
            return readLessonsLibrary();
        } finally {
            lessonsSyncPromise = null;
        }
    })();

    return lessonsSyncPromise;
}

function ensureLibraryToast() {
    let toast = document.querySelector("[data-library-toast]");
    if (toast) return toast;

    toast = document.createElement("div");
    toast.className = "platform-toast";
    toast.hidden = true;
    toast.setAttribute("data-library-toast", "");
    document.body.appendChild(toast);
    return toast;
}

let libraryToastTimer = 0;

function showLibraryToast(message) {
    const toast = ensureLibraryToast();
    if (!toast) return;

    toast.textContent = message;
    toast.hidden = false;
    toast.dataset.visible = "true";
    window.clearTimeout(libraryToastTimer);
    libraryToastTimer = window.setTimeout(() => {
        toast.dataset.visible = "false";
        toast.hidden = true;
    }, 2200);
}

function readActiveLessonId() {
    try {
        return localStorage.getItem(scopedStorageKey(ACTIVE_LESSON_KEY)) || "";
    } catch (error) {
        console.warn("EducarIA active lesson unavailable:", error);
        return "";
    }
}

function writeActiveLessonId(id) {
    try {
        localStorage.setItem(scopedStorageKey(ACTIVE_LESSON_KEY), id);
    } catch (error) {
        console.warn("EducarIA active lesson unavailable:", error);
    }
}

function currentClassName() {
    if (typeof readSelectedClass === "function") {
        return readSelectedClass();
    }

    try {
        return localStorage.getItem(scopedStorageKey(CLASS_CONTEXT_KEY)) || "";
    } catch (error) {
        console.warn("EducarIA class context unavailable:", error);
        return "";
    }
}

function updateCurrentClass(value) {
    if (typeof saveSelectedClass === "function") {
        saveSelectedClass(value);
        return;
    }

    try {
        localStorage.setItem(scopedStorageKey(CLASS_CONTEXT_KEY), value);
    } catch (error) {
        console.warn("EducarIA class context unavailable:", error);
    }
}

function readCurrentDraftByType(type) {
    try {
        return localStorage.getItem(draftKeyForType(type)) || "";
    } catch (error) {
        console.warn("EducarIA draft unavailable:", error);
        return "";
    }
}

function writeCurrentDraftByType(type, rawDraft) {
    if (!rawDraft) return;

    try {
        localStorage.setItem(draftKeyForType(type), rawDraft);
    } catch (error) {
        console.warn("EducarIA draft unavailable:", error);
    }
}

function forceSyncDraftFromPage(type) {
    const stack = document.querySelector(stackSelectorForType(type));
    if (!stack) return;

    const materialize = typeof persistMaterializedFields === "function" ? persistMaterializedFields : null;
    if (materialize) {
        materialize(stack);
        materialize(document);
    }

    const controls = {};
    document.querySelectorAll("input[id], textarea[id], select[id]").forEach((field) => {
        if (field.type === "file") return;
        controls[field.id] = field.value;
    });

    const draftPayload = {
        controls,
        stackHtml: stack.innerHTML
    };

    if (type === "debate") {
        draftPayload.steps = [...document.querySelectorAll("[data-debate-step]")].map((step, index) => ({
            index,
            title: step.querySelector("[data-debate-title]")?.value?.trim() || `Etapa ${index + 1}`,
            time: step.querySelector("[data-debate-time]")?.value?.trim() || "5 min",
            question: step.querySelector("[data-debate-question]")?.value?.trim() || `Pergunta da etapa ${index + 1}`,
            guidance: step.querySelector("[data-debate-guidance]")?.value?.trim() || `Orientação para conduzir a etapa ${index + 1}.`
        }));
    }

    try {
        localStorage.setItem(draftKeyForType(type), JSON.stringify(draftPayload));
    } catch (error) {
        console.warn("EducarIA draft unavailable:", error);
    }
}

function parseDraftHtml(rawDraft) {
    try {
        const parsed = JSON.parse(rawDraft);
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${parsed.stackHtml || ""}</div>`, "text/html");
        return { parsed, doc };
    } catch (error) {
        return { parsed: {}, doc: document.implementation.createHTMLDocument("") };
    }
}

function summarizeSlidesDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Aula sem título", summary: "Material salvo sem resumo definido.", type: "Aula com slides", materialType: "slides" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const firstSlide = doc.querySelector("[data-slide-card]");
    const title = firstSlide?.querySelector('[data-field="slide-title"]')?.value?.trim() || "Aula sem título";
    const summary = firstSlide?.querySelector('[data-field="slide-body"]')?.value?.trim() || "Material salvo sem resumo definido.";
    return { title, summary, type: "Aula com slides", materialType: "slides" };
}

function summarizeFlashcardsDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Flashcards sem título", summary: "Material salvo sem resumo definido.", type: "Flashcards", materialType: "flashcards" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["cards-tema"] || "Flashcards";
    const firstCard = doc.querySelector("[data-flashcard]");
    const front = firstCard?.querySelector('[data-field="front"]')?.value?.trim() || "Sem card inicial";
    const back = firstCard?.querySelector('[data-field="back"]')?.value?.trim() || "Sem verso";
    return { title, summary: `${front} - ${back}`, type: "Flashcards", materialType: "flashcards" };
}

function summarizeQuizDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Quiz sem título", summary: "Material salvo sem resumo definido.", type: "Quiz", materialType: "quiz" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const firstQuestion = doc.querySelector("[data-quiz-question]");
    const prompt = firstQuestion?.querySelector('[data-field="prompt"]')?.value?.trim() || "Quiz";
    const title = parsed.controls?.["quiz-tema"] || "Quiz";
    return { title, summary: prompt, type: "Quiz", materialType: "quiz" };
}

function summarizeWheelDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Roleta sem título", summary: "Material salvo sem resumo definido.", type: "Roleta", materialType: "wheel" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["roleta-titulo"] || "Roleta";
    const firstItem = doc.querySelector("[data-wheel-text]")?.value?.trim() || "Sem espaço inicial";
    const count = doc.querySelectorAll("[data-wheel-segment]").length || 0;
    return { title, summary: `${count} espaços - ${firstItem}`, type: "Roleta", materialType: "wheel" };
}

function summarizeHangmanDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Forca sem título", summary: "Material salvo sem resumo definido.", type: "Forca", materialType: "hangman" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["forca-titulo"] || "Forca";
    const words = [...doc.querySelectorAll("[data-hangman-entry]")].map((card) => {
        return card.querySelector("[data-hangman-answer]")?.value?.trim()
            || card.querySelector('[data-field="answer"]')?.value?.trim()
            || "";
    }).filter(Boolean);
    const firstWord = words[0] || "Sem palavra inicial";
    return { title, summary: `${words.length} palavras - ${firstWord}`, type: "Forca", materialType: "hangman" };
}

function summarizeCrosswordDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Palavras cruzadas sem título", summary: "Material salvo sem resumo definido.", type: "Palavras cruzadas", materialType: "crossword" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["cruzada-titulo"] || "Palavras cruzadas";
    const entries = [...doc.querySelectorAll("[data-crossword-entry]")].map((card) => {
        return card.querySelector("[data-crossword-answer]")?.value?.trim()
            || card.querySelector('[data-field="answer"]')?.value?.trim()
            || "";
    }).filter(Boolean);
    const firstEntry = entries[0] || "Sem resposta inicial";
    return { title, summary: `${entries.length} entradas - ${firstEntry}`, type: "Palavras cruzadas", materialType: "crossword" };
}

function summarizeWordsearchDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Caça-palavras sem título", summary: "Material salvo sem resumo definido.", type: "Caça-palavras", materialType: "wordsearch" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["caca-titulo"] || "Caça-palavras";
    const words = [...doc.querySelectorAll("[data-wordsearch-word]")].map((card) => {
        return card.querySelector("[data-wordsearch-term]")?.value?.trim()
            || card.querySelector('[data-field="term"]')?.value?.trim()
            || "";
    }).filter(Boolean);
    const firstWord = words[0] || "Sem palavra inicial";
    return { title, summary: `${words.length} palavras - ${firstWord}`, type: "Caça-palavras", materialType: "wordsearch" };
}

function summarizeMemoryDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Jogo da memória sem título", summary: "Material salvo sem resumo definido.", type: "Jogo da memória", materialType: "memory" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["memoria-titulo"] || "Jogo da memória";
    const firstFront = doc.querySelector("[data-memory-front]")?.value?.trim() || "Sem frente inicial";
    const firstBack = doc.querySelector("[data-memory-back]")?.value?.trim() || "Sem verso inicial";
    return { title, summary: `${firstFront} - ${firstBack}`, type: "Jogo da memória", materialType: "memory" };
}

function summarizeMatchDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Ligar pontos sem título", summary: "Material salvo sem resumo definido.", type: "Ligar pontos", materialType: "match" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["ligar-titulo"] || "Ligar pontos";
    const firstLeft = doc.querySelector("[data-match-left]")?.value?.trim() || "Sem item inicial";
    const firstRight = doc.querySelector("[data-match-right]")?.value?.trim() || "Sem resposta inicial";
    return { title, summary: `${firstLeft} - ${firstRight}`, type: "Ligar pontos", materialType: "match" };
}

function summarizeMindmapDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Mapa mental sem título", summary: "Material salvo sem resumo definido.", type: "Mapa mental", materialType: "mindmap" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["mapa-centro"] || "Mapa mental";
    const firstBranch = doc.querySelector("[data-mind-title]")?.value?.trim() || "Sem tópico inicial";
    const count = doc.querySelectorAll("[data-mind-branch]").length || 0;
    return { title, summary: `${count} tópicos - ${firstBranch}`, type: "Mapa mental", materialType: "mindmap" };
}

function summarizeDebateDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Debate guiado sem título", summary: "Material salvo sem resumo definido.", type: "Debate guiado", materialType: "debate" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["debate-titulo"] || "Debate guiado";
    const question = parsed.controls?.["debate-pergunta"] || "Sem pergunta central";
    const count = doc.querySelectorAll("[data-debate-step]").length || 0;
    return { title, summary: `${count} etapas - ${question}`, type: "Debate guiado", materialType: "debate" };
}

function summarizeLessonSequenceDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Aula completa sem título", summary: "Sequência ainda sem blocos definidos.", type: "Aula completa", materialType: "lesson" };
    }

    try {
        const parsed = JSON.parse(rawDraft);
        const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
        const firstBlock = blocks[0];
        const totalDuration = Number(parsed.duration || 0);
        const title = (parsed.title || "").trim() || "Aula completa";
        const summary = blocks.length
            ? `${blocks.length} blocos - ${firstBlock?.label || firstBlock?.lessonTitle || "Início da sequência"}${totalDuration ? ` - ${totalDuration} min` : ""}`
            : "Sequência ainda sem blocos definidos.";
        return { title, summary, type: "Aula completa", materialType: "lesson" };
    } catch (error) {
        return { title: "Aula completa", summary: "Sequência ainda sem blocos definidos.", type: "Aula completa", materialType: "lesson" };
    }
}

function summarizeCurrentDraft(preferredType = "") {
    const currentType = preferredType || (typeof readCurrentMaterialType === "function" ? readCurrentMaterialType() : "slides");
    const currentDraft = readCurrentDraftByType(currentType);

    if (currentDraft) {
        if (currentType === "lesson") return { rawDraft: currentDraft, summary: summarizeLessonSequenceDraft(currentDraft), materialType: "lesson" };
        if (currentType === "flashcards") return { rawDraft: currentDraft, summary: summarizeFlashcardsDraft(currentDraft), materialType: "flashcards" };
        if (currentType === "quiz") return { rawDraft: currentDraft, summary: summarizeQuizDraft(currentDraft), materialType: "quiz" };
        if (currentType === "wheel") return { rawDraft: currentDraft, summary: summarizeWheelDraft(currentDraft), materialType: "wheel" };
        if (currentType === "hangman") return { rawDraft: currentDraft, summary: summarizeHangmanDraft(currentDraft), materialType: "hangman" };
        if (currentType === "crossword") return { rawDraft: currentDraft, summary: summarizeCrosswordDraft(currentDraft), materialType: "crossword" };
        if (currentType === "wordsearch") return { rawDraft: currentDraft, summary: summarizeWordsearchDraft(currentDraft), materialType: "wordsearch" };
        if (currentType === "memory") return { rawDraft: currentDraft, summary: summarizeMemoryDraft(currentDraft), materialType: "memory" };
        if (currentType === "match") return { rawDraft: currentDraft, summary: summarizeMatchDraft(currentDraft), materialType: "match" };
        if (currentType === "mindmap") return { rawDraft: currentDraft, summary: summarizeMindmapDraft(currentDraft), materialType: "mindmap" };
        if (currentType === "debate") return { rawDraft: currentDraft, summary: summarizeDebateDraft(currentDraft), materialType: "debate" };
        return { rawDraft: currentDraft, summary: summarizeSlidesDraft(currentDraft), materialType: "slides" };
    }

    const fallbackOrder = ["lesson", "slides", "flashcards", "quiz", "wheel", "hangman", "crossword", "wordsearch", "memory", "match", "mindmap", "debate"];
    for (const type of fallbackOrder) {
        const draft = readCurrentDraftByType(type);
        if (!draft) continue;
        return summarizeCurrentDraft(type);
    }

    return { rawDraft: "", summary: summarizeSlidesDraft(""), materialType: "slides" };
}

function formatLessonDate(isoString) {
    if (!isoString) return "Agora";

    try {
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(isoString));
    } catch (error) {
        return "Agora";
    }
}

function markClassPageReady() {
    if (!document.body?.classList.contains("theme-class")) return;
    document.body.dataset.classPageReady = "true";
}

function duplicateModalTemplate() {
    return `
        <div class="platform-modal-backdrop" data-duplicate-modal hidden>
            <div class="platform-modal-card" role="dialog" aria-modal="true" aria-labelledby="duplicate-lesson-title">
                <div class="page-section-title page-section-title--compact">
                    <div>
                        <span class="platform-section-label">Duplicar atividade</span>
                        <h2 id="duplicate-lesson-title">Para qual turma você quer duplicar?</h2>
                    </div>
                    <p data-duplicate-modal-summary>Escolha a turma de destino para criar uma cópia desta atividade.</p>
                </div>
                <div class="platform-field">
                    <label for="duplicate-lesson-class">Turma de destino</label>
                    <select id="duplicate-lesson-class" data-duplicate-modal-select></select>
                </div>
                <p class="sidebar-feedback" data-duplicate-modal-feedback hidden></p>
                <div class="utility-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-duplicate-modal-cancel>Cancelar</button>
                    <button type="button" class="platform-link-button platform-link-primary" data-duplicate-modal-confirm>Confirmar</button>
                </div>
            </div>
        </div>
    `;
}

function ensureDuplicateModal() {
    let modal = document.querySelector("[data-duplicate-modal]");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend", duplicateModalTemplate());
    return document.querySelector("[data-duplicate-modal]");
}

function openDuplicateModal(lessonId) {
    const modal = ensureDuplicateModal();
    const select = modal?.querySelector("[data-duplicate-modal-select]");
    const summary = modal?.querySelector("[data-duplicate-modal-summary]");
    const feedback = modal?.querySelector("[data-duplicate-modal-feedback]");
    const lesson = readLessonsLibrary().find((item) => item.id === lessonId);
    const current = currentClassName();
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses().filter((item) => item !== current) : [];
    if (!modal || !select || !lesson) return;

    modal.dataset.duplicateLessonId = lessonId;
    if (summary) {
        summary.textContent = `Você vai criar uma cópia de "${lesson.title}" em outra turma.`;
    }
    if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
    }

    select.innerHTML = classes.length
        ? classes.map((className) => `<option value="${className}">${className}</option>`).join("")
        : `<option value="">Nenhuma outra turma disponível</option>`;
    select.disabled = !classes.length;
    modal.hidden = false;
}

function closeDuplicateModal() {
    const modal = document.querySelector("[data-duplicate-modal]");
    if (!modal) return;
    modal.hidden = true;
    modal.dataset.duplicateLessonId = "";
}

function confirmDuplicateModal() {
    const modal = document.querySelector("[data-duplicate-modal]");
    const select = modal?.querySelector("[data-duplicate-modal-select]");
    const feedback = modal?.querySelector("[data-duplicate-modal-feedback]");
    if (!modal || !select) return;

    const lessonId = modal.dataset.duplicateLessonId || "";
    const targetClass = select.value || "";
    if (!targetClass) {
        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = "Escolha uma turma para continuar.";
        }
        return;
    }

    duplicateLessonToClass(lessonId, targetClass);
    closeDuplicateModal();
}

function buildLessonRecord(preferredType = "", scope = LESSON_SCOPE_CLASS) {
    const turma = currentClassName() || "Turma";
    if (preferredType && typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(preferredType);
    }

    if (preferredType) {
        forceSyncDraftFromPage(preferredType);
    }

    const { rawDraft, summary, materialType } = summarizeCurrentDraft(preferredType);
    const lessons = readLessonsLibrary();
    const activeId = readActiveLessonId();
    const existing = lessons.find((lesson) => lesson.id === activeId);
    const lessonId = existing
        && (existing.materialType || "slides") === materialType
        && normalizeLessonScope(existing) === scope
        ? existing.id
        : `lesson-${Date.now()}`;
    const now = new Date().toISOString();
    const createdAt = existing?.createdAt || now;
    const bnccCodes = normalizeStringList([
        ...normalizeStringList(existing?.bnccCodes, 12),
        ...extractBnccCodesFromText(`${summary.title} ${summary.summary} ${rawDraft.slice(0, 5000)}`)
    ], 12);
    const tags = normalizeStringList([
        ...normalizeStringList(existing?.tags, 6),
        ...inferPedagogicalTags({
            title: summary.title,
            summary: summary.summary,
            type: summary.type,
            materialType
        })
    ], 6);

    return {
        id: lessonId,
        className: scope === LESSON_SCOPE_CLASS ? turma : "",
        scope,
        title: summary.title,
        summary: summary.summary,
        type: summary.type,
        materialType,
        createdAt,
        updatedAt: now,
        status: existing?.status || LESSON_STATUS_DRAFT,
        bnccCodes,
        tags,
        lastOpenedAt: existing?.lastOpenedAt || "",
        lastPresentedAt: existing?.lastPresentedAt || "",
        lastUsedAt: existing?.lastUsedAt || "",
        usageCount: Number(existing?.usageCount || 0),
        draft: rawDraft
    };
}

function persistLessonRecord(record) {
    const lessons = readLessonsLibrary();
    const normalizedRecord = normalizeLessonRecord(record);
    if (!normalizedRecord) return null;

    const nextLessons = lessons.filter((lesson) => lesson.id !== normalizedRecord.id);
    nextLessons.unshift(normalizedRecord);
    clearDeletedLessonId(normalizedRecord.id);
    writeLessonsLibrary(nextLessons);
    writeActiveLessonId(normalizedRecord.id);
    if (normalizedRecord.className) {
        updateCurrentClass(normalizedRecord.className);
    }
    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(normalizedRecord.materialType || "slides");
    }
    return normalizedRecord;
}

function saveCurrentLessonToClass(preferredType = "") {
    const record = buildLessonRecord(preferredType, LESSON_SCOPE_CLASS);
    return persistLessonRecord(record);
}

function saveCurrentLessonToLibrary(preferredType = "") {
    const record = buildLessonRecord(preferredType, LESSON_SCOPE_LIBRARY);
    return persistLessonRecord(record);
}

function libraryMaterials() {
    return readLessonsLibrary().filter((lesson) => normalizeLessonScope(lesson) === LESSON_SCOPE_LIBRARY);
}

function classMaterials(className) {
    return readLessonsLibrary().filter((lesson) => {
        return normalizeLessonScope(lesson) === LESSON_SCOPE_CLASS && lesson.className === className;
    });
}

function allActivityMaterials() {
    return readLessonsLibrary().filter((lesson) => (lesson.materialType || "slides") !== "lesson");
}

function activateLessonById(id) {
    const lesson = readLessonsLibrary().find((item) => item.id === id);
    if (!lesson) return null;

    writeActiveLessonId(lesson.id);
    if ((lesson.materialType || "slides") === "lesson") {
        try {
            localStorage.setItem(scopedStorageKey("educaria:activeLessonSequenceId"), lesson.id);
        } catch (error) {
            console.warn("EducarIA lesson unavailable:", error);
        }
    }
    if (lesson.className) {
        updateCurrentClass(lesson.className);
    }
    writeCurrentDraftByType(lesson.materialType || "slides", lesson.draft);
    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(lesson.materialType || "slides");
    }
    return lesson;
}

function readActiveLesson() {
    const activeId = readActiveLessonId();
    if (!activeId) return null;
    return readLessonsLibrary().find((item) => item.id === activeId) || null;
}

function editorPathForLesson(lesson) {
    if (lesson.materialType === "lesson") return "criar-aula.html";
    if (lesson.materialType === "quiz") return "quiz-builder.html";
    if (lesson.materialType === "flashcards") return "flashcards-builder.html";
    if (lesson.materialType === "wheel") return "roleta-builder.html";
    if (lesson.materialType === "hangman") return "forca-builder.html";
    if (lesson.materialType === "crossword") return "palavras-cruzadas-builder.html";
    if (lesson.materialType === "wordsearch") return "caca-palavras-builder.html";
    if (lesson.materialType === "memory") return "jogo-memoria-builder.html";
    if (lesson.materialType === "match") return "ligar-pontos-builder.html";
    if (lesson.materialType === "mindmap") return "mapa-mental-builder.html";
    if (lesson.materialType === "debate") return "debate-guiado-builder.html";
    return "slides-builder.html";
}

function presentationPathForLesson(lesson) {
    const materialPath = typeof presentationPathForMaterial === "function"
        ? presentationPathForMaterial(lesson.materialType || "slides")
        : "apresentacao.html";

    if (!lesson?.id) {
        return materialPath;
    }

    const params = new URLSearchParams();
    params.set("lesson", lesson.id);
    if (lesson.materialType) {
        params.set("material", lesson.materialType);
    }

    const query = params.toString();
    if (!query) return materialPath;

    return `${materialPath}?${query}`;
}

function materialGroupLabel(type) {
    if (type === "lesson") return "Aula completa";
    if (type === "quiz") return "Quiz";
    if (type === "flashcards") return "Flashcards";
    if (type === "wheel") return "Roleta";
    if (type === "hangman") return "Forca";
    if (type === "crossword") return "Palavras cruzadas";
    if (type === "wordsearch") return "Caça-palavras";
    if (type === "memory") return "Jogo da memória";
    if (type === "match") return "Ligar pontos";
    if (type === "mindmap") return "Mapa mental";
    if (type === "debate") return "Debate guiado";
    return "Slides";
}

function materialGroupDescription(type) {
    if (type === "lesson") return "Sequências que combinam várias atividades em uma única aula.";
    if (type === "quiz") return "Perguntas para revisar, aplicar e projetar em sala.";
    if (type === "flashcards") return "Cards para retomada rápida e revisão visual.";
    if (type === "wheel") return "Sorteios, comandos e desafios prontos para a turma.";
    if (type === "hangman") return "Palavras com dicas para revisar vocabulário, ortografia e conceitos de forma dinâmica.";
    if (type === "crossword") return "Grades com respostas cruzadas para revisar conceitos, vocabulário e definições.";
    if (type === "wordsearch") return "Grades com palavras escondidas para revisar vocabulário, conceitos e temas.";
    if (type === "memory") return "Pares para jogar, revisar e memorizar em sala.";
    if (type === "match") return "Associações em duas colunas para ligar e revisar em sala.";
    if (type === "mindmap") return "Tópicos conectados para organizar, explicar e revisar conteúdos.";
    if (type === "debate") return "Roteiros de mediação para discutir, argumentar e fechar o tema em sala.";
    return "Sequências para conduzir a aula projetada.";
}

function classMaterialFilterLabel(filter) {
    if (!filter) return "";
    return lessonLibraryTranslate(filter.labelKey, filter.label);
}

function classMaterialFilterDefinition(filterId) {
    return CLASS_MATERIAL_FILTERS.find((filter) => filter.id === filterId) || CLASS_MATERIAL_FILTERS[0];
}

function classMaterialFilterCount(lessons, filterId) {
    const filter = classMaterialFilterDefinition(filterId);
    if (!Array.isArray(lessons) || !lessons.length) return 0;
    if (!Array.isArray(filter.types) || !filter.types.length) return lessons.length;

    return lessons.filter((lesson) => filter.types.includes(lesson.materialType || "slides")).length;
}

function classMaterialFilterApply(lessons, filterId) {
    const filter = classMaterialFilterDefinition(filterId);
    if (!Array.isArray(lessons) || !lessons.length) return [];
    if (!Array.isArray(filter.types) || !filter.types.length) return [...lessons];

    return lessons.filter((lesson) => filter.types.includes(lesson.materialType || "slides"));
}

function normalizeSearchText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function lessonMatchesLibrarySearch(lesson, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;

    const haystack = normalizeSearchText([
        lesson.title,
        lesson.summary,
        lesson.type,
        lesson.materialType,
        materialGroupLabel(lesson.materialType || "slides"),
        lessonStatusLabel(lesson.status),
        ...(lesson.bnccCodes || []),
        ...(lesson.tags || [])
    ].join(" "));

    return haystack.includes(normalizedQuery);
}

function sortLibraryMaterials(lessons, sortId) {
    const sorted = [...lessons];
    if (sortId === "title") {
        return sorted.sort((left, right) => String(left.title || "").localeCompare(String(right.title || ""), "pt-BR"));
    }

    if (sortId === "used") {
        return sorted.sort((left, right) => {
            const usageDiff = Number(right.usageCount || 0) - Number(left.usageCount || 0);
            if (usageDiff !== 0) return usageDiff;
            return lessonTimestampValue(right) - lessonTimestampValue(left);
        });
    }

    return sortLessonsByUpdatedAt(sorted);
}

function applyLibraryFilters(lessons) {
    let filteredLessons = classMaterialFilterApply(lessons, activeLibraryMaterialFilter);

    if (activeLibraryStatusFilter !== "all") {
        filteredLessons = filteredLessons.filter((lesson) => normalizeLessonStatus(lesson.status) === activeLibraryStatusFilter);
    }

    filteredLessons = filteredLessons.filter((lesson) => lessonMatchesLibrarySearch(lesson, librarySearchQuery));
    return sortLibraryMaterials(filteredLessons, activeLibrarySort);
}

function lessonPedagogyTagsHtml(lesson) {
    const chips = [
        ...(lesson.bnccCodes || []),
        ...(lesson.tags || [])
    ].slice(0, 5);

    if (!chips.length) return "";

    return `
        <div class="lesson-pedagogy-tags" aria-label="Metadados pedagogicos">
            ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
        </div>
    `;
}

function lessonStatusLabel(status) {
    return normalizeLessonStatus(status) === LESSON_STATUS_READY
        ? lessonLibraryTranslate("classDetail.status.ready", "Pronto para projetar")
        : lessonLibraryTranslate("classDetail.status.draft", "Rascunho");
}

function classFilterSummaryLabel(filterId, filteredCount, totalCount) {
    const filter = classMaterialFilterDefinition(filterId);
    const filterLabel = classMaterialFilterLabel(filter).toLowerCase();
    if (filter.id === "all") {
        const noun = lessonLibraryTranslate(totalCount === 1 ? "dashboard.count.activity" : "dashboard.count.activities", totalCount === 1 ? "atividade" : "atividades");
        return `${totalCount} ${noun} ${lessonLibraryTranslate("classDetail.filters.summaryInClass", "nesta turma.")}`;
    }

    if (!filteredCount) {
        return `${lessonLibraryTranslate("classDetail.filters.summaryNone", "Sem resultados em")} ${filterLabel} ${lessonLibraryTranslate("classDetail.filters.summaryForClass", "para esta turma.")}`;
    }

    const noun = lessonLibraryTranslate(filteredCount === 1 ? "dashboard.count.activity" : "dashboard.count.activities", filteredCount === 1 ? "atividade" : "atividades");
    return `${filteredCount} ${noun} ${lessonLibraryTranslate("classes.filters.summaryIn", "em")} ${filterLabel}.`;
}

function libraryFilterSummaryLabel(filterId, filteredCount, totalCount) {
    const filter = classMaterialFilterDefinition(filterId);
    const filterLabel = classMaterialFilterLabel(filter).toLowerCase();
    if (filter.id === "all") {
        const noun = lessonLibraryTranslate(totalCount === 1 ? "library.count.material" : "library.count.materials", totalCount === 1 ? "material" : "materiais");
        return `${totalCount} ${noun} ${lessonLibraryTranslate("library.filters.summaryInLibrary", "na biblioteca.")}`;
    }

    if (!filteredCount) {
        return `${lessonLibraryTranslate("library.filters.summaryNone", "Sem resultados em")} ${filterLabel} ${lessonLibraryTranslate("library.filters.summaryInLibrary", "na biblioteca.")}`;
    }

    const noun = lessonLibraryTranslate(filteredCount === 1 ? "library.count.material" : "library.count.materials", filteredCount === 1 ? "material" : "materiais");
    return `${filteredCount} ${noun} ${lessonLibraryTranslate("classes.filters.summaryIn", "em")} ${filterLabel}.`;
}

function selectedClassFromAvailableClasses() {
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const current = currentClassName() || "";
    if (current && classes.includes(current)) return current;
    return classes[0] || "";
}

function classActivitySummary(lessons) {
    if (!Array.isArray(lessons) || !lessons.length) {
        return lessonLibraryTranslate("classes.empty.noActivitiesYet", "Nenhuma atividade criada ainda.");
    }

    const counts = lessons.reduce((result, lesson) => {
        const key = lesson.materialType || "slides";
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});

    const ordered = Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([type, count]) => `${materialGroupLabel(type)} (${count})`);

    return ordered.join(" \u2022 ");
}

function countClassMaterialsByTypes(lessons, types) {
    const normalizedTypes = Array.isArray(types) ? types : [types];
    return (Array.isArray(lessons) ? lessons : []).filter((lesson) => {
        return normalizedTypes.includes(lesson.materialType || "slides");
    }).length;
}

function hydrateClassFocusPanel(classes, turma, lessons) {
    const summaryNode = document.querySelector("[data-class-focus-summary]");
    const actionsNode = document.querySelector("[data-class-primary-actions]");
    const recentNode = document.querySelector("[data-class-recent-lesson]");
    const materialCountNode = document.querySelector("[data-class-material-count]");
    const slideCountNode = document.querySelector("[data-class-slide-count]");
    const quizCountNode = document.querySelector("[data-class-quiz-count]");
    const libraryCountNode = document.querySelector("[data-class-library-count]");
    if (!summaryNode && !actionsNode && !recentNode && !materialCountNode && !slideCountNode && !quizCountNode && !libraryCountNode) {
        return;
    }

    const classLessons = Array.isArray(lessons) ? lessons : [];
    const slideLikeCount = countClassMaterialsByTypes(classLessons, ["slides", "lesson"]);
    const quizCount = countClassMaterialsByTypes(classLessons, "quiz");
    const libraryCount = typeof libraryMaterials === "function" ? libraryMaterials().length : 0;
    const latestLesson = classLessons[0] || null;

    const renderRecentLesson = () => {
        if (!recentNode) return;

        if (!classes.length) {
            recentNode.innerHTML = `
                <article class="class-recent-lesson-card class-recent-lesson-card--empty">
                    <span class="route-tag">${lessonLibraryTranslate("classDetail.empty.noSelectedClass", "Sem turma selecionada")}</span>
                    <h3>${lessonLibraryTranslate("classDetail.empty.selectClassTitle", "Crie ou selecione uma turma para continuar")}</h3>
                    <p>${lessonLibraryTranslate("classDetail.empty.selectClassCopy", "Depois disso, as atividades mais recentes desta turma aparecem aqui com acoes rapidas.")}</p>
                </article>
            `;
            return;
        }

        if (!latestLesson) {
            recentNode.innerHTML = `
                <article class="class-recent-lesson-card class-recent-lesson-card--empty">
                    <span class="route-tag">${lessonLibraryTranslate("classDetail.empty.noRecentActivity", "Sem atividade recente")}</span>
                    <h3>${escapeHtml(turma)} ainda não tem atividade salva</h3>
                    <p>${lessonLibraryTranslate("classDetail.empty.startWithSlides", "Comece com Slides para conduzir a aula e finalize com Quiz para revisar em poucos minutos.")}</p>
                    <div class="lesson-history-actions">
                        <a href="slides-builder.html" class="platform-link-button platform-link-primary">${lessonLibraryTranslate("classDetail.actions.createSlides", "Criar slides (10-15 min)")}</a>
                        <a href="quiz-builder.html" class="platform-link-button platform-link-secondary">${lessonLibraryTranslate("classDetail.actions.createQuiz", "Criar quiz (5-8 min)")}</a>
                    </div>
                </article>
            `;
            return;
        }

        const safeMaterial = latestLesson.materialType || "slides";
        const safeTitle = escapeHtml(latestLesson.title || materialGroupLabel(safeMaterial));
        const safeSummary = escapeHtml(latestLesson.summary || materialGroupDescription(safeMaterial));
        const safeType = escapeHtml(latestLesson.type || materialGroupLabel(safeMaterial));
        const safeStatus = escapeHtml(lessonStatusLabel(latestLesson.status));
        const statusClass = escapeHtml(normalizeLessonStatus(latestLesson.status));
        const safeUpdatedAt = escapeHtml(formatLessonDate(latestLesson.updatedAt));
        const safeId = escapeHtml(latestLesson.id || "");
        const editorPath = escapeHtml(editorPathForLesson(latestLesson));
        const presentationPath = escapeHtml(presentationPathForLesson(latestLesson));

        recentNode.innerHTML = `
            <article class="class-recent-lesson-card">
                <span class="route-tag">${lessonLibraryTranslate("classDetail.latest.mostRecent", "Atividade mais recente")}</span>
                <h3>${safeTitle}</h3>
                <p>${safeSummary}</p>
                <div class="lesson-history-meta">
                    <span>${lessonLibraryTranslate("classes.latest.updatedAt", "Atualizado em")} ${safeUpdatedAt}</span>
                    <span>${safeType}</span>
                    <span class="lesson-status-chip lesson-status-chip--${statusClass}">${safeStatus}</span>
                </div>
                <div class="lesson-history-actions">
                    <a href="${editorPath}" class="platform-link-button platform-link-primary" data-edit-lesson="${safeId}">${lessonLibraryTranslate("classes.actions.continueEditing", "Continuar edicao")}</a>
                    <a href="${presentationPath}" class="platform-link-button platform-link-secondary" data-present-lesson="${safeId}">${lessonLibraryTranslate("classes.actions.presentNow", "Apresentar agora")}</a>
                </div>
            </article>
        `;
    };

    if (materialCountNode) materialCountNode.textContent = `${classLessons.length}`;
    if (slideCountNode) slideCountNode.textContent = `${slideLikeCount}`;
    if (quizCountNode) quizCountNode.textContent = `${quizCount}`;
    if (libraryCountNode) libraryCountNode.textContent = `${libraryCount}`;

    if (!classes.length) {
        if (summaryNode) {
            summaryNode.textContent = lessonLibraryTranslate("classDetail.flow.noClassesSummary", "Crie a primeira turma para iniciar o fluxo principal: Slides (10-15 min), Quiz (5-8 min) e Biblioteca para reaproveitar.");
        }

        if (actionsNode) {
            actionsNode.innerHTML = `
                <a href="index.html" class="platform-link-button platform-link-primary">${lessonLibraryTranslate("classDetail.actions.backToDashboard", "Voltar ao painel")}</a>
                <a href="biblioteca.html" class="platform-link-button platform-link-secondary">${lessonLibraryTranslate("dashboard.actions.openLibrary", "Abrir biblioteca")}</a>
            `;
        }
        renderRecentLesson();
        return;
    }

    if (summaryNode) {
        if (!classLessons.length) {
            summaryNode.textContent = `${turma} ${lessonLibraryTranslate("classDetail.flow.noMaterialsSummary", "ainda nao tem materiais salvos. Sugestao: comece com Slides (10-15 min), feche com Quiz (5-8 min) e salve na Biblioteca.")}`;
        } else {
            const latestLabel = classLessons[0]?.updatedAt ? formatLessonDate(classLessons[0].updatedAt) : lessonLibraryTranslate("classDetail.time.now", "agora");
            summaryNode.textContent = `${turma} ${lessonLibraryTranslate("classDetail.flow.hasMaterialsPrefix", "tem")} ${classLessons.length} ${lessonLibraryTranslate("classDetail.flow.hasMaterialsSuffix", "materiais salvos. Ultima atualizacao:")} ${latestLabel}. ${lessonLibraryTranslate("classDetail.flow.recommended", "Fluxo recomendado: Slides -> Quiz -> Biblioteca.")}`;
        }
    }

    if (actionsNode) {
        actionsNode.innerHTML = `
            <a href="gerar-aula.html" class="platform-link-button platform-link-primary">${lessonLibraryTranslate("classDetail.actions.chooseFormat", "Escolher formato para esta turma")}</a>
            <a href="slides-builder.html" class="platform-link-button platform-link-secondary">${lessonLibraryTranslate("classDetail.actions.createSlides", "Criar slides (10-15 min)")}</a>
            <a href="quiz-builder.html" class="platform-link-button platform-link-secondary">${lessonLibraryTranslate("classDetail.actions.createQuiz", "Criar quiz (5-8 min)")}</a>
            <a href="criar-aula.html" class="platform-link-button platform-link-secondary">${lessonLibraryTranslate("classDetail.actions.buildFullLesson", "Montar aula completa (15-25 min)")}</a>
            <a href="biblioteca.html" class="platform-link-button platform-link-secondary">${lessonLibraryTranslate("dashboard.actions.openLibrary", "Abrir biblioteca")}</a>
        `;
    }

    renderRecentLesson();
}

function hydrateClassCards() {
    const root = document.querySelector("[data-class-cards]");
    if (!root) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const selectedClass = selectedClassFromAvailableClasses();
    if (selectedClass && selectedClass !== currentClassName()) {
        updateCurrentClass(selectedClass);
    }

    if (!classes.length) {
        root.innerHTML = `
            <article class="quick-class-card quick-class-card--active">
                <span class="route-tag">${lessonLibraryTranslate("dashboard.empty.noClasses", "Sem turmas")}</span>
                <h3>${lessonLibraryTranslate("dashboard.empty.noClassesTitle", "Nenhuma turma criada ainda")}</h3>
                <p>${lessonLibraryTranslate("classDetail.empty.noClassesCardCopy", "Use o botao Criar turma na lateral para montar a primeira turma e comecar a salvar atividades.")}</p>
            </article>
        `;
        return;
    }

    root.innerHTML = classes.map((className) => {
        const lessons = classMaterials(className);
        const latest = lessons[0]?.updatedAt ? formatLessonDate(lessons[0].updatedAt) : lessonLibraryTranslate("classes.empty.noActivitiesShort", "Sem atividades ainda");
        const countLabel = `${lessons.length} ${lessons.length === 1 ? "atividade" : "atividades"}`;
        const activeClass = className === selectedClass ? " quick-class-card--active" : "";

        return `
            <a href="#atividades-salvas" class="quick-class-card${activeClass}" data-class-card-link="${className}">
                <span class="route-tag">${countLabel}</span>
                <h3>${className}</h3>
                <p>${classActivitySummary(lessons)}</p>
                <div class="lesson-history-meta">
                    <span>${latest}</span>
                    <span>${lessons.length ? `${new Set(lessons.map((lesson) => lesson.materialType || "slides")).size} ${lessonLibraryTranslate("classes.count.formats", "formatos")}` : `0 ${lessonLibraryTranslate("classes.count.formats", "formatos")}`}</span>
                </div>
            </a>
        `;
    }).join("");
}

function bindSaveLessonAction() {
    const buttons = document.querySelectorAll("[data-save-lesson]");
    if (!buttons.length) return;

        buttons.forEach((button) => {
            button.addEventListener("click", (event) => {
                event.preventDefault();
                const material = button.dataset.saveMaterial || "";
                const previousLessonsCount = readLessonsLibrary().length;
                if (material && typeof setCurrentMaterialType === "function") {
                    setCurrentMaterialType(material);
                }
                if (material === "lesson" && typeof saveLessonSequenceToClass === "function") {
                    const saveMode = button.dataset.saveScope || LESSON_SCOPE_CLASS;
                    saveLessonSequenceToClass(saveMode);
                    if (typeof window.educariaEvaluateActivationMilestones === "function") {
                        window.educariaEvaluateActivationMilestones("save_lesson_sequence", {
                            markCompletion: true
                        });
                    }
                    window.location.href = button.dataset.saveTarget || "turma.html";
                    return;
                }
                const saveMode = button.dataset.saveScope || LESSON_SCOPE_CLASS;
                const savedRecord = saveMode === LESSON_SCOPE_LIBRARY
                    ? saveCurrentLessonToLibrary(material)
                    : saveCurrentLessonToClass(material);
                if (typeof educariaTrack === "function") {
                    educariaTrack("lesson_saved", {
                        materialType: savedRecord?.materialType || material || "slides",
                        scope: saveMode,
                        target: button.dataset.saveTarget || ""
                    });
                }

                const lessonsCount = readLessonsLibrary().length;
                const createdFirstActivity = lessonsCount > 0 && previousLessonsCount === 0;
                if (createdFirstActivity && typeof window.educariaMarkMilestone === "function") {
                    window.educariaMarkMilestone("activation_first_activity_saved", {
                        source: "save_lesson_action",
                        materialType: savedRecord?.materialType || material || "slides",
                        scope: saveMode,
                        lessonsCount
                    });
                }
                if (typeof window.educariaEvaluateActivationMilestones === "function") {
                    window.educariaEvaluateActivationMilestones("save_lesson_action", {
                        markCompletion: true
                    });
                }
                window.location.href = button.dataset.saveTarget || "turma.html";
            });
        });
}

function hydrateBuilderCommonActions() {
    document.querySelectorAll("[data-save-lesson]").forEach((button) => {
        const saveScope = button.dataset.saveScope || LESSON_SCOPE_CLASS;
        if (saveScope === LESSON_SCOPE_LIBRARY) {
            button.textContent = lessonLibraryTranslate("builder.actions.saveLibrary", "Salvar na biblioteca");
            return;
        }

        button.textContent = lessonLibraryTranslate("builder.actions.saveClass", "Salvar na turma");
        button.setAttribute("aria-label", lessonLibraryTranslate("builder.actions.saveClassPrimary", "Salvar na turma (acao principal)"));
    });

    document.querySelectorAll(".builder-floating-actions a").forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (/apresentacao|aplicacao/.test(href)) {
            link.textContent = lessonLibraryTranslate("classDetail.actions.present", "Apresentar");
        }
    });

    document.querySelectorAll(".platform-top-actions a").forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (href === "index.html") {
            link.textContent = lessonLibraryTranslate("library.actions.backDashboard", "Voltar para painel");
        } else if (href === "biblioteca.html") {
            link.textContent = lessonLibraryTranslate("builder.actions.backLibrary", "Voltar a biblioteca");
        } else if (href.includes("#activity-toolkit")) {
            link.textContent = lessonLibraryTranslate("builder.actions.chooseOther", "Escolher outra atividade");
        }
    });
}

function deleteLessonAndRefresh(id) {
    if (!id) return;
    removeLessonById(id);
    window.location.reload();
}

function hydrateCompletionSummary() {
    const lesson = readActiveLesson();
    if (!lesson) return;

    const summary = document.querySelector("[data-lesson-summary]");
    if (summary) {
        summary.innerHTML = `<strong>Turma:</strong> ${escapeHtml(lesson.className)}<br><strong>Conteúdo:</strong> ${escapeHtml(lesson.title)}<br><strong>Tipo:</strong> ${escapeHtml(lesson.type)}.`;
    }
}

function hydrateClassPage() {
    const listRoot = document.querySelector("[data-saved-lessons]");
    const selectRoot = document.querySelector("[data-saved-lessons-select]");
    const actionsRoot = document.querySelector("[data-saved-lessons-actions]");
    const filterRoot = document.querySelector("[data-class-material-filters]");
    const filterSummaryRoot = document.querySelector("[data-class-material-filter-summary]");
    if (!listRoot && !selectRoot && !filterRoot && !filterSummaryRoot) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const turma = selectedClassFromAvailableClasses();
    if (turma && turma !== currentClassName()) {
        updateCurrentClass(turma);
    }

    document.querySelectorAll("[data-class-title]").forEach((node) => {
        node.textContent = turma || lessonLibraryTranslate("classDetail.empty.noSelectedClass", "Nenhuma turma selecionada");
    });

    const allLessons = classMaterials(turma);
    hydrateClassFocusPanel(classes, turma, allLessons);

    const filterExists = CLASS_MATERIAL_FILTERS.some((filter) => filter.id === activeClassMaterialFilter);
    if (!filterExists) {
        activeClassMaterialFilter = "all";
    }

    let filteredLessons = classMaterialFilterApply(allLessons, activeClassMaterialFilter);
    if (allLessons.length && !filteredLessons.length && activeClassMaterialFilter !== "all") {
        activeClassMaterialFilter = "all";
        filteredLessons = [...allLessons];
    }

    if (filterRoot) {
        if (!classes.length || !allLessons.length) {
            filterRoot.innerHTML = "";
        } else {
            filterRoot.innerHTML = CLASS_MATERIAL_FILTERS.map((filter) => {
                const count = classMaterialFilterCount(allLessons, filter.id);
                const isActive = filter.id === activeClassMaterialFilter;
                return `
                    <button
                        type="button"
                        class="class-material-filter${isActive ? " is-active" : ""}"
                        data-class-material-filter="${filter.id}"
                        aria-pressed="${isActive ? "true" : "false"}"
                        ${count === 0 && !isActive ? "disabled" : ""}
                    >
                        <span>${classMaterialFilterLabel(filter)}</span>
                        <small>${count}</small>
                    </button>
                `;
            }).join("");
        }
    }
    if (filterSummaryRoot) {
        if (!classes.length || !allLessons.length) {
            filterSummaryRoot.hidden = true;
            filterSummaryRoot.textContent = "";
        } else {
            filterSummaryRoot.hidden = false;
            filterSummaryRoot.textContent = classFilterSummaryLabel(activeClassMaterialFilter, filteredLessons.length, allLessons.length);
        }
    }

    if (!classes.length) {
        if (listRoot) {
            listRoot.innerHTML = `
                <article class="lesson-history-card">
                    <span class="route-tag">${lessonLibraryTranslate("dashboard.empty.noClasses", "Sem turmas")}</span>
                    <h3>${lessonLibraryTranslate("classDetail.empty.createFirstClassTitle", "Crie a primeira turma para comecar")}</h3>
                    <p>${lessonLibraryTranslate("classDetail.empty.createFirstClassCopy", "Depois de criar a turma, as atividades salvas vao aparecer organizadas aqui.")}</p>
                </article>
            `;
        }

        if (selectRoot) {
            selectRoot.innerHTML = `<option>${lessonLibraryTranslate("dashboard.empty.noClassesTitle", "Nenhuma turma criada ainda")}</option>`;
            selectRoot.disabled = true;
        }

        if (actionsRoot) {
            actionsRoot.innerHTML = "";
        }
        if (filterRoot) {
            filterRoot.innerHTML = "";
        }
        if (filterSummaryRoot) {
            filterSummaryRoot.hidden = true;
            filterSummaryRoot.textContent = "";
        }
        markClassPageReady();
        return;
    }

    if (!allLessons.length) {
        if (listRoot) {
            listRoot.innerHTML = `
                <article class="lesson-history-card">
                    <span class="route-tag">${lessonLibraryTranslate("classDetail.empty.noSavedActivities", "Sem atividades salvas")}</span>
                    <h3>${lessonLibraryTranslate("classDetail.empty.noReadyActivityTitle", "Nenhuma atividade pronta ainda")}</h3>
                    <p>${lessonLibraryTranslate("classDetail.empty.noReadyActivityCopy", "Salve uma atividade finalizada para ela aparecer aqui e poder ser reaberta depois.")}</p>
                </article>
            `;
        }

        if (selectRoot) {
            selectRoot.innerHTML = `<option>${lessonLibraryTranslate("classDetail.empty.noSavedInClass", "Nenhuma atividade salva nesta turma")}</option>`;
            selectRoot.disabled = true;
        }

        if (actionsRoot) {
            actionsRoot.innerHTML = "";
        }
        if (filterRoot) {
            filterRoot.innerHTML = "";
        }
        if (filterSummaryRoot) {
            filterSummaryRoot.hidden = true;
            filterSummaryRoot.textContent = "";
        }
        markClassPageReady();
        return;
    }

    if (!filteredLessons.length) {
        const filter = classMaterialFilterDefinition(activeClassMaterialFilter);
        if (listRoot) {
            listRoot.innerHTML = `
                <article class="lesson-history-card">
                    <span class="route-tag">${lessonLibraryTranslate("classes.filters.tag", "Filtro")}: ${classMaterialFilterLabel(filter)}</span>
                    <h3>${lessonLibraryTranslate("classDetail.empty.noFilterActivityTitle", "Nenhuma atividade neste filtro")}</h3>
                    <p>${lessonLibraryTranslate("classDetail.empty.noFilterActivityCopy", "Troque o filtro para ver outros formatos salvos nesta turma.")}</p>
                </article>
            `;
        }

        if (selectRoot) {
            selectRoot.innerHTML = `<option>${lessonLibraryTranslate("classDetail.empty.noActivityIn", "Nenhuma atividade em")} ${classMaterialFilterLabel(filter).toLowerCase()}</option>`;
            selectRoot.disabled = true;
        }

        if (actionsRoot) {
            actionsRoot.innerHTML = "";
        }

        markClassPageReady();
        return;
    }

    if (listRoot) {
        const groupedLessons = filteredLessons.reduce((groups, lesson) => {
            const key = lesson.materialType || "slides";
            if (!groups[key]) groups[key] = [];
            groups[key].push(lesson);
            return groups;
        }, {});

        const groupOrder = ["lesson", "quiz", "slides", "flashcards", "wheel", "hangman", "crossword", "wordsearch", "memory", "match", "mindmap", "debate"];
        const visibleGroupOrder = groupOrder.filter((key) => (groupedLessons[key] || []).length > 0);
        listRoot.innerHTML = visibleGroupOrder
            .map((key) => {
                const groupItems = groupedLessons[key] || [];
                const count = groupItems.length;

                return `
                <details class="editor-disclosure lesson-group-section lesson-group-disclosure">
                    <summary>
                        <span>${materialGroupLabel(key)}</span>
                        <small>${count} ${lessonLibraryTranslate(count === 1 ? "dashboard.count.activity" : "dashboard.count.activities", count === 1 ? "atividade" : "atividades")}</small>
                    </summary>
                    <div class="editor-disclosure-body lesson-group-body">
                        ${count ? `
                        <div class="lesson-history-grid class-lesson-grid">
                            ${groupItems.map((lesson) => `
                                <article class="lesson-history-card lesson-history-card--grouped">
                                    <span class="route-tag">${materialGroupLabel(key)}</span>
                                    <h3>${lesson.title}</h3>
                                    <p>${lesson.summary}</p>
                                    <div class="lesson-history-meta">
                                        <span>${lessonLibraryTranslate("classes.latest.updatedAt", "Atualizado em")} ${formatLessonDate(lesson.updatedAt)}</span>
                                        <span>${lesson.type}</span>
                                        <span class="lesson-status-chip lesson-status-chip--${lesson.status || LESSON_STATUS_DRAFT}">${lessonStatusLabel(lesson.status)}</span>
                                    </div>
                                    <div class="lesson-history-actions">
                                        <a href="${presentationPathForLesson(lesson)}" class="platform-link-button platform-link-primary" data-present-lesson="${lesson.id}">${lessonLibraryTranslate("classDetail.actions.present", "Apresentar")}</a>
                                        <a href="${editorPathForLesson(lesson)}" class="platform-link-button platform-link-secondary" data-edit-lesson="${lesson.id}">${lessonLibraryTranslate("classDetail.actions.edit", "Editar")}</a>
                                        <button type="button" class="platform-link-button platform-link-secondary" data-library-lesson="${lesson.id}">${lessonLibraryTranslate("classDetail.actions.addToLibrary", "Adicionar a biblioteca")}</button>
                                        <button type="button" class="platform-link-button platform-link-secondary" data-duplicate-lesson="${lesson.id}">${lessonLibraryTranslate("classDetail.actions.duplicateToClass", "Duplicar para outra turma")}</button>
                                        <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${lesson.id}">${lessonLibraryTranslate("classDetail.actions.remove", "Remover")}</button>
                                    </div>
                                </article>
                            `).join("")}
                        </div>
                        ` : `
                        <article class="lesson-history-card lesson-history-card--empty">
                            <span class="route-tag">${materialGroupLabel(key)}</span>
                            <h3>${lessonLibraryTranslate("classDetail.empty.noSavedActivityTitle", "Nenhuma atividade salva")}</h3>
                            <p>${materialGroupDescription(key)}</p>
                        </article>
                        `}
                    </div>
                </details>
            `;
            }).join("");
    }

    if (selectRoot) {
        selectRoot.disabled = false;
        selectRoot.innerHTML = filteredLessons.map((lesson, index) => `
            <option value="${escapeHtml(lesson.id)}" ${index === 0 ? "selected" : ""}>${escapeHtml(lesson.title)} - ${escapeHtml(lesson.type)} - ${escapeHtml(formatLessonDate(lesson.updatedAt))}</option>
        `).join("");
    }

    if (actionsRoot) {
        const activeLesson = filteredLessons[0];
        actionsRoot.innerHTML = `
            <a href="${escapeHtml(presentationPathForLesson(activeLesson))}" class="platform-link-button platform-link-primary" data-present-lesson="${escapeHtml(activeLesson.id)}" data-lesson-action="present">${lessonLibraryTranslate("classDetail.actions.present", "Apresentar")}</a>
            <a href="${escapeHtml(editorPathForLesson(activeLesson))}" class="platform-link-button platform-link-secondary" data-edit-lesson="${escapeHtml(activeLesson.id)}" data-lesson-action="edit">${lessonLibraryTranslate("classDetail.actions.edit", "Editar")}</a>
            <button type="button" class="platform-link-button platform-link-secondary" data-library-lesson="${escapeHtml(activeLesson.id)}" data-lesson-action="library">${lessonLibraryTranslate("classDetail.actions.addToLibrary", "Adicionar a biblioteca")}</button>
            <button type="button" class="platform-link-button platform-link-secondary" data-duplicate-lesson="${escapeHtml(activeLesson.id)}" data-lesson-action="duplicate">${lessonLibraryTranslate("classDetail.actions.duplicateToClass", "Duplicar para outra turma")}</button>
            <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${escapeHtml(activeLesson.id)}" data-lesson-action="delete">${lessonLibraryTranslate("classDetail.actions.remove", "Remover")}</button>
        `;
    }

    markClassPageReady();
}

function bindLessonActivationLinks() {
    document.addEventListener("click", (event) => {
        const libraryFilterTrigger = event.target.closest("[data-library-material-filter]");
        if (libraryFilterTrigger) {
            event.preventDefault();
            const nextFilter = libraryFilterTrigger.dataset.libraryMaterialFilter || "all";
            if (nextFilter !== activeLibraryMaterialFilter) {
                activeLibraryMaterialFilter = nextFilter;
                if (typeof educariaTrack === "function") {
                    educariaTrack("library_material_filter_changed", {
                        filter: nextFilter
                    });
                }
            }
            hydrateLibraryPage();
            return;
        }

        const classFilterTrigger = event.target.closest("[data-class-material-filter]");
        if (classFilterTrigger) {
            event.preventDefault();
            const nextFilter = classFilterTrigger.dataset.classMaterialFilter || "all";
            if (nextFilter !== activeClassMaterialFilter) {
                activeClassMaterialFilter = nextFilter;
                if (typeof educariaTrack === "function") {
                    educariaTrack("class_material_filter_changed", {
                        filter: nextFilter
                    });
                }
            }
            hydrateClassPage();
            return;
        }

        const classCardTrigger = event.target.closest("[data-class-card-link]");
        if (classCardTrigger) {
            event.preventDefault();
            const className = classCardTrigger.dataset.classCardLink || "";
            if (!className) return;
            updateCurrentClass(className);
            hydrateClassCards();
            hydrateClassPage();
            document.querySelector("#atividades-salvas")?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }

        const libraryTrigger = event.target.closest("[data-library-lesson]");
        if (libraryTrigger) {
            event.preventDefault();
            const duplicated = addLessonToLibrary(libraryTrigger.dataset.libraryLesson || "");
            if (duplicated) {
                if (typeof educariaTrack === "function") {
                    educariaTrack("lesson_added_to_library", {
                        lessonId: duplicated.id,
                        materialType: duplicated.materialType || ""
                    });
                }
                showLibraryToast("Atividade adicionada a biblioteca com sucesso.");
            }
            return;
        }

        const duplicateTrigger = event.target.closest("[data-duplicate-lesson]");
        if (duplicateTrigger) {
            event.preventDefault();
            openDuplicateModal(duplicateTrigger.dataset.duplicateLesson || "");
            return;
        }

        const trigger = event.target.closest("[data-edit-lesson], [data-present-lesson]");
        if (!trigger) return;

        const lessonId = trigger.dataset.editLesson || trigger.dataset.presentLesson;
        if (!lessonId) return;
        if (trigger.dataset.editLesson) {
            markLessonOpened(lessonId);
            if (typeof educariaTrack === "function") {
                educariaTrack("lesson_editor_opened", { lessonId });
            }
        } else if (trigger.dataset.presentLesson) {
            markLessonPresented(lessonId);
            if (typeof educariaTrack === "function") {
                educariaTrack("lesson_presented", { lessonId });
            }
        }
        activateLessonById(lessonId);
    });

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-delete-lesson]");
        if (!trigger) return;

        event.preventDefault();
        if (typeof educariaTrack === "function") {
            educariaTrack("lesson_deleted", {
                lessonId: trigger.dataset.deleteLesson || ""
            });
        }
        deleteLessonAndRefresh(trigger.dataset.deleteLesson || "");
    });

    const selectRoot = document.querySelector("[data-saved-lessons-select]");
    const actionsRoot = document.querySelector("[data-saved-lessons-actions]");
    if (selectRoot && actionsRoot) {
        selectRoot.addEventListener("change", () => {
            const lessonId = selectRoot.value;
            const lesson = readLessonsLibrary().find((item) => item.id === lessonId);
            if (!lesson) return;

            const edit = actionsRoot.querySelector('[data-lesson-action="edit"]');
            const present = actionsRoot.querySelector('[data-lesson-action="present"]');
            const library = actionsRoot.querySelector('[data-lesson-action="library"]');
            const duplicate = actionsRoot.querySelector('[data-lesson-action="duplicate"]');
            const remove = actionsRoot.querySelector('[data-lesson-action="delete"]');

            if (edit) {
                edit.dataset.editLesson = lessonId;
                edit.setAttribute("href", editorPathForLesson(lesson));
            }
            if (present) {
                present.dataset.presentLesson = lessonId;
                present.setAttribute("href", presentationPathForLesson(lesson));
            }
            if (library) library.dataset.libraryLesson = lessonId;
            if (duplicate) duplicate.dataset.duplicateLesson = lessonId;
            if (remove) remove.dataset.deleteLesson = lessonId;
        });
    }

    document.addEventListener("click", (event) => {
        if (event.target.closest("[data-duplicate-modal-cancel]")) {
            closeDuplicateModal();
            return;
        }

        if (event.target.closest("[data-duplicate-modal-confirm]")) {
            confirmDuplicateModal();
            return;
        }

        if (event.target.matches("[data-duplicate-modal]")) {
            closeDuplicateModal();
        }
    });
}

function bindClassPageRefresh() {
    document.addEventListener("click", (event) => {
        const createClassButton = event.target.closest("[data-sidebar-create-class]");
        const sidebarClassLink = event.target.closest("[data-sidebar-class-link]");
        if (!createClassButton && !sidebarClassLink) return;

        window.setTimeout(() => {
            hydrateClassCards();
            hydrateClassPage();
        }, 0);
    });
}

function bindLibraryFilterControls() {
    document.addEventListener("input", (event) => {
        const searchInput = event.target.closest("[data-library-search]");
        if (!searchInput) return;

        librarySearchQuery = searchInput.value || "";
        hydrateLibraryPage();
    });

    document.addEventListener("change", (event) => {
        const statusFilter = event.target.closest("[data-library-status-filter]");
        if (statusFilter) {
            activeLibraryStatusFilter = statusFilter.value || "all";
            hydrateLibraryPage();
            return;
        }

        const sortSelect = event.target.closest("[data-library-sort]");
        if (sortSelect) {
            activeLibrarySort = sortSelect.value || "recent";
            hydrateLibraryPage();
        }
    });
}

function hydrateLibraryPage() {
    const root = document.querySelector("[data-library-materials]");
    const countNode = document.querySelector("[data-library-count]");
    const filterRoot = document.querySelector("[data-library-material-filters]");
    const filterSummaryRoot = document.querySelector("[data-library-material-filter-summary]");
    const searchInput = document.querySelector("[data-library-search]");
    const statusFilter = document.querySelector("[data-library-status-filter]");
    const sortSelect = document.querySelector("[data-library-sort]");
    if (!root && !countNode && !filterRoot && !filterSummaryRoot) return;
    if (root) {
        root.setAttribute("aria-busy", "true");
    }

    const lessons = libraryMaterials();
    if (countNode) {
        countNode.textContent = `${lessons.length} ${lessonLibraryTranslate(lessons.length === 1 ? "library.count.savedMaterial" : "library.count.savedMaterials", lessons.length === 1 ? "material salvo" : "materiais salvos")}`;
    }

    const filterExists = CLASS_MATERIAL_FILTERS.some((filter) => filter.id === activeLibraryMaterialFilter);
    if (!filterExists) {
        activeLibraryMaterialFilter = "all";
    }

    if (!["all", LESSON_STATUS_READY, LESSON_STATUS_DRAFT].includes(activeLibraryStatusFilter)) {
        activeLibraryStatusFilter = "all";
    }

    if (!["recent", "title", "used"].includes(activeLibrarySort)) {
        activeLibrarySort = "recent";
    }

    if (searchInput && searchInput.value !== librarySearchQuery) {
        searchInput.value = librarySearchQuery;
    }

    if (statusFilter && statusFilter.value !== activeLibraryStatusFilter) {
        statusFilter.value = activeLibraryStatusFilter;
    }

    if (sortSelect && sortSelect.value !== activeLibrarySort) {
        sortSelect.value = activeLibrarySort;
    }

    let filteredLessons = applyLibraryFilters(lessons);
    if (lessons.length && !filteredLessons.length && activeLibraryMaterialFilter !== "all") {
        activeLibraryMaterialFilter = "all";
        filteredLessons = applyLibraryFilters(lessons);
    }

    if (filterRoot) {
        if (!lessons.length) {
            filterRoot.innerHTML = "";
        } else {
            filterRoot.innerHTML = CLASS_MATERIAL_FILTERS.map((filter) => {
                const count = classMaterialFilterCount(lessons, filter.id);
                const isActive = filter.id === activeLibraryMaterialFilter;
                return `
                    <button
                        type="button"
                        class="class-material-filter${isActive ? " is-active" : ""}"
                        data-library-material-filter="${filter.id}"
                        aria-pressed="${isActive ? "true" : "false"}"
                        ${count === 0 && !isActive ? "disabled" : ""}
                    >
                        <span>${classMaterialFilterLabel(filter)}</span>
                        <small>${count}</small>
                    </button>
                `;
            }).join("");
        }
    }
    if (filterSummaryRoot) {
        if (!lessons.length) {
            filterSummaryRoot.hidden = true;
            filterSummaryRoot.textContent = "";
        } else {
            filterSummaryRoot.hidden = false;
            filterSummaryRoot.textContent = libraryFilterSummaryLabel(activeLibraryMaterialFilter, filteredLessons.length, lessons.length);
        }
    }

    if (!root) return;
    if (!lessons.length) {
        root.innerHTML = `
            <article class="lesson-history-card">
                <span class="route-tag">${lessonLibraryTranslate("library.empty.label", "Biblioteca vazia")}</span>
                <h3>${lessonLibraryTranslate("library.empty.title", "Nenhum material salvo na biblioteca ainda")}</h3>
                <p>${lessonLibraryTranslate("library.empty.copy", "Use Salvar na biblioteca em qualquer atividade para montar seu acervo reutilizavel.")}</p>
            </article>
        `;
        root.setAttribute("aria-busy", "false");
        return;
    }

    if (!filteredLessons.length) {
        const filter = classMaterialFilterDefinition(activeLibraryMaterialFilter);
        const hasSearch = Boolean(normalizeSearchText(librarySearchQuery));
        const statusLabel = activeLibraryStatusFilter === LESSON_STATUS_READY
            ? lessonLibraryTranslate("library.status.readyPlural", "prontos")
            : lessonLibraryTranslate("library.status.draftPlural", "rascunhos");
        const message = hasSearch
            ? lessonLibraryTranslate("library.empty.searchCopy", "Revise a busca ou limpe os filtros para ver mais materiais.")
            : activeLibraryStatusFilter !== "all"
                ? `${lessonLibraryTranslate("library.empty.noStatusPrefix", "Nao ha materiais")} ${statusLabel} ${lessonLibraryTranslate("library.empty.noStatusSuffix", "com estes filtros.")}`
                : lessonLibraryTranslate("library.empty.noFilterCopy", "Troque o filtro para visualizar outros formatos salvos na biblioteca.");
        root.innerHTML = `
            <article class="lesson-history-card">
                <span class="route-tag">${lessonLibraryTranslate("classes.filters.tag", "Filtro")}: ${classMaterialFilterLabel(filter)}</span>
                <h3>${lessonLibraryTranslate("library.empty.noFilterTitle", "Nenhum material neste filtro")}</h3>
                <p>${message}</p>
            </article>
        `;
        root.setAttribute("aria-busy", "false");
        return;
    }

    const groupedLessons = filteredLessons.reduce((groups, lesson) => {
        const key = lesson.materialType || "slides";
        if (!groups[key]) groups[key] = [];
        groups[key].push(lesson);
        return groups;
    }, {});

    const groupOrder = ["lesson", "quiz", "slides", "flashcards", "wheel", "hangman", "crossword", "wordsearch", "memory", "match", "mindmap", "debate"];
    const visibleGroupOrder = groupOrder.filter((key) => (groupedLessons[key] || []).length > 0);
    root.innerHTML = visibleGroupOrder.map((key) => {
        const groupItems = groupedLessons[key] || [];
        const count = groupItems.length;

        return `
            <details class="editor-disclosure lesson-group-section lesson-group-disclosure">
                <summary>
                    <span>${materialGroupLabel(key)}</span>
                    <small>${count} ${lessonLibraryTranslate(count === 1 ? "library.count.material" : "library.count.materials", count === 1 ? "material" : "materiais")}</small>
                </summary>
                <div class="editor-disclosure-body lesson-group-body">
                    ${count ? `
                    <div class="lesson-history-grid class-lesson-grid">
                        ${groupItems.map((lesson) => `
                            <article class="lesson-history-card lesson-history-card--grouped">
                                <span class="route-tag">${escapeHtml(materialGroupLabel(key))}</span>
                                <h3>${escapeHtml(lesson.title)}</h3>
                                <p>${escapeHtml(lesson.summary)}</p>
                                <div class="lesson-history-meta">
                                    <span>${lessonLibraryTranslate("classes.latest.updatedAt", "Atualizado em")} ${escapeHtml(formatLessonDate(lesson.updatedAt))}</span>
                                    <span>${escapeHtml(lesson.type)}</span>
                                    <span class="lesson-status-chip lesson-status-chip--${escapeHtml(lesson.status || LESSON_STATUS_DRAFT)}">${escapeHtml(lessonStatusLabel(lesson.status))}</span>
                                </div>
                                ${lessonPedagogyTagsHtml(lesson)}
                                <div class="lesson-history-actions">
                                    <a href="${escapeHtml(editorPathForLesson(lesson))}" class="platform-link-button platform-link-primary" data-edit-lesson="${escapeHtml(lesson.id)}">${lessonLibraryTranslate("classDetail.actions.edit", "Editar")}</a>
                                    <a href="${escapeHtml(presentationPathForLesson(lesson))}" class="platform-link-button platform-link-secondary" data-present-lesson="${escapeHtml(lesson.id)}">${lessonLibraryTranslate("classDetail.actions.present", "Apresentar")}</a>
                                    <button type="button" class="platform-link-button platform-link-secondary" data-duplicate-lesson="${escapeHtml(lesson.id)}">${lessonLibraryTranslate("library.actions.addToClass", "Adicionar a turma")}</button>
                                    <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${escapeHtml(lesson.id)}">${lessonLibraryTranslate("library.actions.delete", "Excluir")}</button>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                    ` : `
                    <article class="lesson-history-card lesson-history-card--empty">
                        <span class="route-tag">${materialGroupLabel(key)}</span>
                        <h3>${lessonLibraryTranslate("library.empty.noSavedMaterialTitle", "Nenhum material salvo")}</h3>
                        <p>${materialGroupDescription(key)}</p>
                    </article>
                    `}
                </div>
            </details>
        `;
    }).join("");
    root.setAttribute("aria-busy", "false");
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateBuilderCommonActions();
    bindSaveLessonAction();
    hydrateCompletionSummary();
    hydrateClassCards();
    hydrateClassPage();
    hydrateLibraryPage();
    bindLessonActivationLinks();
    bindClassPageRefresh();
    bindLibraryFilterControls();
    syncLessonsWithFirebase();
});

document.addEventListener("educaria-auth-changed", () => {
    syncLessonsWithFirebase();
});

document.addEventListener("educaria-classes-updated", () => {
    hydrateClassCards();
    hydrateClassPage();
});

document.addEventListener("educaria-lessons-updated", () => {
    hydrateCompletionSummary();
    hydrateClassCards();
    hydrateClassPage();
    hydrateLibraryPage();
});

document.addEventListener("educaria-language-changed", () => {
    hydrateBuilderCommonActions();
    hydrateCompletionSummary();
    hydrateClassCards();
    hydrateClassPage();
    hydrateLibraryPage();
});

window.markLessonOpened = markLessonOpened;
window.markLessonPresented = markLessonPresented;
window.markLessonReady = markLessonReady;
window.updateLessonStatus = updateLessonStatus;

window.addEventListener("pageshow", (event) => {
    hydrateCompletionSummary();
    hydrateClassCards();
    hydrateClassPage();
    hydrateLibraryPage();

    if (event.persisted) {
        syncLessonsWithFirebase();
    }
});

