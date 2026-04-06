const LESSONS_LIBRARY_KEY = "educaria:lessons";
const ACTIVE_LESSON_KEY = "educaria:activeLessonId";
const CLASS_CONTEXT_KEY = "educaria:selectedClass";
const LESSON_SCOPE_LIBRARY = "library";
const LESSON_SCOPE_CLASS = "class";

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

function readLessonsLibrary() {
    try {
        const raw = localStorage.getItem(LESSONS_LIBRARY_KEY);
        const scopedRaw = localStorage.getItem(scopedStorageKey(LESSONS_LIBRARY_KEY));
        return scopedRaw ? JSON.parse(scopedRaw) : (raw ? JSON.parse(raw) : []);
    } catch (error) {
        console.warn("EducarIA lessons unavailable:", error);
        return [];
    }
}

function writeLessonsLibrary(lessons) {
    try {
        localStorage.setItem(scopedStorageKey(LESSONS_LIBRARY_KEY), JSON.stringify(lessons));
    } catch (error) {
        console.warn("EducarIA lessons unavailable:", error);
    }
}

function normalizeLessonScope(lesson) {
    if (lesson?.scope) return lesson.scope;
    return lesson?.className ? LESSON_SCOPE_CLASS : LESSON_SCOPE_LIBRARY;
}

function removeLessonById(id) {
    const lessons = readLessonsLibrary().filter((lesson) => lesson.id !== id);
    writeLessonsLibrary(lessons);

    if (readActiveLessonId() === id) {
        writeActiveLessonId("");
    }
}

function duplicateLessonToClass(id, targetClass) {
    const lesson = readLessonsLibrary().find((item) => item.id === id);
    const turma = String(targetClass || "").trim();
    if (!lesson || !turma) return null;

    const copy = {
        ...lesson,
        id: `lesson-${Date.now()}`,
        className: turma,
        scope: LESSON_SCOPE_CLASS,
        updatedAt: new Date().toISOString()
    };

    const lessons = readLessonsLibrary();
    lessons.unshift(copy);
    writeLessonsLibrary(lessons);
    return copy;
}

function addLessonToLibrary(id) {
    const lesson = readLessonsLibrary().find((item) => item.id === id);
    if (!lesson) return null;

    const copy = {
        ...lesson,
        id: `lesson-${Date.now()}`,
        className: "",
        scope: LESSON_SCOPE_LIBRARY,
        updatedAt: new Date().toISOString()
    };

    const lessons = readLessonsLibrary();
    lessons.unshift(copy);
    writeLessonsLibrary(lessons);
    return copy;
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

    try {
        localStorage.setItem(draftKeyForType(type), JSON.stringify({
            controls,
            stackHtml: stack.innerHTML
        }));
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
        return { title: "Aula sem titulo", summary: "Material salvo sem resumo definido.", type: "Aula com slides", materialType: "slides" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const firstSlide = doc.querySelector("[data-slide-card]");
    const title = firstSlide?.querySelector('[data-field="slide-title"]')?.value?.trim() || "Aula sem titulo";
    const summary = firstSlide?.querySelector('[data-field="slide-body"]')?.value?.trim() || "Material salvo sem resumo definido.";
    return { title, summary, type: "Aula com slides", materialType: "slides" };
}

function summarizeFlashcardsDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Flashcards sem titulo", summary: "Material salvo sem resumo definido.", type: "Flashcards", materialType: "flashcards" };
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
        return { title: "Quiz sem titulo", summary: "Material salvo sem resumo definido.", type: "Quiz", materialType: "quiz" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const firstQuestion = doc.querySelector("[data-quiz-question]");
    const prompt = firstQuestion?.querySelector('[data-field="prompt"]')?.value?.trim() || "Quiz";
    const title = parsed.controls?.["quiz-tema"] || "Quiz";
    return { title, summary: prompt, type: "Quiz", materialType: "quiz" };
}

function summarizeWheelDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Roleta sem titulo", summary: "Material salvo sem resumo definido.", type: "Roleta", materialType: "wheel" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["roleta-titulo"] || "Roleta";
    const firstItem = doc.querySelector("[data-wheel-text]")?.value?.trim() || "Sem espaco inicial";
    const count = doc.querySelectorAll("[data-wheel-segment]").length || 0;
    return { title, summary: `${count} espacos - ${firstItem}`, type: "Roleta", materialType: "wheel" };
}

function summarizeHangmanDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "For\u00e7a sem titulo", summary: "Material salvo sem resumo definido.", type: "For\u00e7a", materialType: "hangman" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["forca-titulo"] || "For\u00e7a";
    const words = [...doc.querySelectorAll("[data-hangman-entry]")].map((card) => {
        return card.querySelector("[data-hangman-answer]")?.value?.trim()
            || card.querySelector('[data-field="answer"]')?.value?.trim()
            || "";
    }).filter(Boolean);
    const firstWord = words[0] || "Sem palavra inicial";
    return { title, summary: `${words.length} palavras - ${firstWord}`, type: "For\u00e7a", materialType: "hangman" };
}

function summarizeCrosswordDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Palavras cruzadas sem titulo", summary: "Material salvo sem resumo definido.", type: "Palavras cruzadas", materialType: "crossword" };
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
        return { title: "Caca-palavras sem titulo", summary: "Material salvo sem resumo definido.", type: "Caca-palavras", materialType: "wordsearch" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["caca-titulo"] || "Caca-palavras";
    const words = [...doc.querySelectorAll("[data-wordsearch-word]")].map((card) => {
        return card.querySelector("[data-wordsearch-term]")?.value?.trim()
            || card.querySelector('[data-field="term"]')?.value?.trim()
            || "";
    }).filter(Boolean);
    const firstWord = words[0] || "Sem palavra inicial";
    return { title, summary: `${words.length} palavras - ${firstWord}`, type: "Caca-palavras", materialType: "wordsearch" };
}

function summarizeMemoryDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Jogo da memoria sem titulo", summary: "Material salvo sem resumo definido.", type: "Jogo da memoria", materialType: "memory" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["memoria-titulo"] || "Jogo da memoria";
    const firstFront = doc.querySelector("[data-memory-front]")?.value?.trim() || "Sem frente inicial";
    const firstBack = doc.querySelector("[data-memory-back]")?.value?.trim() || "Sem verso inicial";
    return { title, summary: `${firstFront} - ${firstBack}`, type: "Jogo da memoria", materialType: "memory" };
}

function summarizeMatchDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Ligar pontos sem titulo", summary: "Material salvo sem resumo definido.", type: "Ligar pontos", materialType: "match" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["ligar-titulo"] || "Ligar pontos";
    const firstLeft = doc.querySelector("[data-match-left]")?.value?.trim() || "Sem item inicial";
    const firstRight = doc.querySelector("[data-match-right]")?.value?.trim() || "Sem resposta inicial";
    return { title, summary: `${firstLeft} - ${firstRight}`, type: "Ligar pontos", materialType: "match" };
}

function summarizeMindmapDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Mapa mental sem titulo", summary: "Material salvo sem resumo definido.", type: "Mapa mental", materialType: "mindmap" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["mapa-centro"] || "Mapa mental";
    const firstBranch = doc.querySelector("[data-mind-title]")?.value?.trim() || "Sem topico inicial";
    const count = doc.querySelectorAll("[data-mind-branch]").length || 0;
    return { title, summary: `${count} topicos - ${firstBranch}`, type: "Mapa mental", materialType: "mindmap" };
}

function summarizeDebateDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Debate guiado sem titulo", summary: "Material salvo sem resumo definido.", type: "Debate guiado", materialType: "debate" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["debate-titulo"] || "Debate guiado";
    const question = parsed.controls?.["debate-pergunta"] || "Sem pergunta central";
    const count = doc.querySelectorAll("[data-debate-step]").length || 0;
    return { title, summary: `${count} etapas - ${question}`, type: "Debate guiado", materialType: "debate" };
}

function summarizeLessonSequenceDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Aula completa sem titulo", summary: "Sequencia ainda sem blocos definidos.", type: "Aula completa", materialType: "lesson" };
    }

    try {
        const parsed = JSON.parse(rawDraft);
        const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
        const firstBlock = blocks[0];
        const totalDuration = Number(parsed.duration || 0);
        const title = (parsed.title || "").trim() || "Aula completa";
        const summary = blocks.length
            ? `${blocks.length} blocos - ${firstBlock?.label || firstBlock?.lessonTitle || "Inicio da sequencia"}${totalDuration ? ` - ${totalDuration} min` : ""}`
            : "Sequencia ainda sem blocos definidos.";
        return { title, summary, type: "Aula completa", materialType: "lesson" };
    } catch (error) {
        return { title: "Aula completa", summary: "Sequencia ainda sem blocos definidos.", type: "Aula completa", materialType: "lesson" };
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

    return {
        id: lessonId,
        className: scope === LESSON_SCOPE_CLASS ? turma : "",
        scope,
        title: summary.title,
        summary: summary.summary,
        type: summary.type,
        materialType,
        updatedAt: new Date().toISOString(),
        draft: rawDraft
    };
}

function persistLessonRecord(record) {
    const lessons = readLessonsLibrary();
    const nextLessons = lessons.filter((lesson) => lesson.id !== record.id);
    nextLessons.unshift(record);
    writeLessonsLibrary(nextLessons);
    writeActiveLessonId(record.id);
    if (record.className) {
        updateCurrentClass(record.className);
    }
    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(record.materialType || "slides");
    }
    return record;
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
    if (lesson.materialType === "hangman") return "atividade-reservada.html";
    if (lesson.materialType === "crossword") return "palavras-cruzadas-builder.html";
    if (lesson.materialType === "wordsearch") return "caca-palavras-builder.html";
    if (lesson.materialType === "memory") return "jogo-memoria-builder.html";
    if (lesson.materialType === "match") return "ligar-pontos-builder.html";
    if (lesson.materialType === "mindmap") return "mapa-mental-builder.html";
    if (lesson.materialType === "debate") return "debate-guiado-builder.html";
    return "slides-builder.html";
}

function presentationPathForLesson(lesson) {
    if (typeof presentationPathForMaterial === "function") {
        return presentationPathForMaterial(lesson.materialType || "slides");
    }
    return "apresentacao.html";
}

function materialGroupLabel(type) {
    if (type === "lesson") return "Aula completa";
    if (type === "quiz") return "Quiz";
    if (type === "flashcards") return "Flashcards";
    if (type === "wheel") return "Roleta";
    if (type === "hangman") return "For\u00e7a";
    if (type === "crossword") return "Palavras cruzadas";
    if (type === "wordsearch") return "Caca-palavras";
    if (type === "memory") return "Jogo da memoria";
    if (type === "match") return "Ligar pontos";
    if (type === "mindmap") return "Mapa mental";
    if (type === "debate") return "Debate guiado";
    return "Slides";
}

function materialGroupDescription(type) {
    if (type === "lesson") return "Sequencias que combinam varias atividades em uma unica aula.";
    if (type === "quiz") return "Perguntas para revisar, aplicar e projetar em sala.";
    if (type === "flashcards") return "Cards para retomada rapida e revisao visual.";
    if (type === "wheel") return "Sorteios, comandos e desafios prontos para a turma.";
    if (type === "hangman") return "Palavras com dicas para revisar vocabulario, ortografia e conceitos de forma dinamica.";
    if (type === "crossword") return "Grades com respostas cruzadas para revisar conceitos, vocabulario e definicoes.";
    if (type === "wordsearch") return "Grades com palavras escondidas para revisar vocabulario, conceitos e temas.";
    if (type === "memory") return "Pares para jogar, revisar e memorizar em sala.";
    if (type === "match") return "Associacoes em duas colunas para ligar e revisar em sala.";
    if (type === "mindmap") return "Topicos conectados para organizar, explicar e revisar conteudos.";
    if (type === "debate") return "Roteiros de mediacao para discutir, argumentar e fechar o tema em sala.";
    return "Sequencias para conduzir a aula projetada.";
}

function selectedClassFromAvailableClasses() {
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const current = currentClassName() || "";
    if (current && classes.includes(current)) return current;
    return classes[0] || "";
}

function classActivitySummary(lessons) {
    if (!Array.isArray(lessons) || !lessons.length) {
        return "Nenhuma atividade criada ainda.";
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

    return ordered.join(" • ");
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
                <span class="route-tag">Sem turmas</span>
                <h3>Nenhuma turma criada ainda</h3>
                <p>Use o botao Criar turma na lateral para montar a primeira turma e comecar a salvar atividades.</p>
            </article>
        `;
        return;
    }

    root.innerHTML = classes.map((className) => {
        const lessons = classMaterials(className);
        const latest = lessons[0]?.updatedAt ? formatLessonDate(lessons[0].updatedAt) : "Sem atividades ainda";
        const countLabel = `${lessons.length} ${lessons.length === 1 ? "atividade" : "atividades"}`;
        const activeClass = className === selectedClass ? " quick-class-card--active" : "";

        return `
            <a href="#atividades-salvas" class="quick-class-card${activeClass}" data-class-card-link="${className}">
                <span class="route-tag">${countLabel}</span>
                <h3>${className}</h3>
                <p>${classActivitySummary(lessons)}</p>
                <div class="lesson-history-meta">
                    <span>${latest}</span>
                    <span>${lessons.length ? `${new Set(lessons.map((lesson) => lesson.materialType || "slides")).size} formatos` : "0 formatos"}</span>
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
                if (material && typeof setCurrentMaterialType === "function") {
                    setCurrentMaterialType(material);
                }
                if (material === "lesson" && typeof saveLessonSequenceToClass === "function") {
                    const saveMode = button.dataset.saveScope || LESSON_SCOPE_CLASS;
                    saveLessonSequenceToClass(saveMode);
                    window.location.href = button.dataset.saveTarget || "turma.html";
                    return;
                }
                const saveMode = button.dataset.saveScope || LESSON_SCOPE_CLASS;
                if (saveMode === LESSON_SCOPE_LIBRARY) {
                    saveCurrentLessonToLibrary(material);
                } else {
                    saveCurrentLessonToClass(material);
                }
                window.location.href = button.dataset.saveTarget || "turma.html";
            });
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
        summary.innerHTML = `<strong>Turma:</strong> ${lesson.className}<br><strong>Conteudo:</strong> ${lesson.title}<br><strong>Tipo:</strong> ${lesson.type}.`;
    }
}

function hydrateClassPage() {
    const listRoot = document.querySelector("[data-saved-lessons]");
    const selectRoot = document.querySelector("[data-saved-lessons-select]");
    const actionsRoot = document.querySelector("[data-saved-lessons-actions]");
    if (!listRoot && !selectRoot) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const turma = selectedClassFromAvailableClasses();
    if (turma && turma !== currentClassName()) {
        updateCurrentClass(turma);
    }

    document.querySelectorAll("[data-class-title]").forEach((node) => {
        node.textContent = turma || "Nenhuma turma selecionada";
    });

    if (!classes.length) {
        if (listRoot) {
            listRoot.innerHTML = `
                <article class="lesson-history-card">
                    <span class="route-tag">Sem turmas</span>
                    <h3>Crie a primeira turma para começar</h3>
                    <p>Depois de criar a turma, as atividades salvas vao aparecer organizadas aqui.</p>
                </article>
            `;
        }

        if (selectRoot) {
            selectRoot.innerHTML = `<option>Nenhuma turma criada ainda</option>`;
            selectRoot.disabled = true;
        }

        if (actionsRoot) {
            actionsRoot.innerHTML = "";
        }
        markClassPageReady();
        return;
    }

    const lessons = classMaterials(turma);
    if (!lessons.length) {
        if (listRoot) {
            listRoot.innerHTML = `
                <article class="lesson-history-card">
                    <span class="route-tag">Sem atividades salvas</span>
                    <h3>Nenhuma atividade pronta ainda</h3>
                    <p>Salve uma atividade finalizada para ela aparecer aqui e poder ser reaberta depois.</p>
                </article>
            `;
        }

        if (selectRoot) {
            selectRoot.innerHTML = `<option>Nenhuma atividade salva nesta turma</option>`;
            selectRoot.disabled = true;
        }

        if (actionsRoot) {
            actionsRoot.innerHTML = "";
        }
        markClassPageReady();
        return;
    }

    if (listRoot) {
        const groupedLessons = lessons.reduce((groups, lesson) => {
            const key = lesson.materialType || "slides";
            if (!groups[key]) groups[key] = [];
            groups[key].push(lesson);
            return groups;
        }, {});

        const groupOrder = ["lesson", "quiz", "slides", "flashcards", "wheel", "hangman", "crossword", "wordsearch", "memory", "match", "mindmap", "debate"];
        listRoot.innerHTML = groupOrder
            .map((key) => {
                const groupItems = groupedLessons[key] || [];
                const count = groupItems.length;

                return `
                <details class="editor-disclosure lesson-group-section lesson-group-disclosure">
                    <summary>
                        <span>${materialGroupLabel(key)}</span>
                        <small>${count} ${count === 1 ? "atividade" : "atividades"}</small>
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
                                        <span>Atualizado em ${formatLessonDate(lesson.updatedAt)}</span>
                                        <span>${lesson.type}</span>
                                    </div>
                                    <div class="lesson-history-actions">
                                        <a href="${presentationPathForLesson(lesson)}" class="platform-link-button platform-link-primary" data-present-lesson="${lesson.id}">Apresentar</a>
                                        <a href="${editorPathForLesson(lesson)}" class="platform-link-button platform-link-secondary" data-edit-lesson="${lesson.id}">Editar</a>
                                        <button type="button" class="platform-link-button platform-link-secondary" data-library-lesson="${lesson.id}">Adicionar a biblioteca</button>
                                        <button type="button" class="platform-link-button platform-link-secondary" data-duplicate-lesson="${lesson.id}">Duplicar para outra turma</button>
                                        <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${lesson.id}">Remover</button>
                                    </div>
                                </article>
                            `).join("")}
                        </div>
                        ` : `
                        <article class="lesson-history-card lesson-history-card--empty">
                            <span class="route-tag">${materialGroupLabel(key)}</span>
                            <h3>Nenhuma atividade salva</h3>
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
        selectRoot.innerHTML = lessons.map((lesson, index) => `
            <option value="${lesson.id}" ${index === 0 ? "selected" : ""}>${lesson.title} - ${lesson.type} - ${formatLessonDate(lesson.updatedAt)}</option>
        `).join("");
    }

    if (actionsRoot) {
        const activeLesson = lessons[0];
        actionsRoot.innerHTML = `
            <a href="${presentationPathForLesson(activeLesson)}" class="platform-link-button platform-link-primary" data-present-lesson="${activeLesson.id}" data-lesson-action="present">Apresentar</a>
            <a href="${editorPathForLesson(activeLesson)}" class="platform-link-button platform-link-secondary" data-edit-lesson="${activeLesson.id}" data-lesson-action="edit">Editar</a>
            <button type="button" class="platform-link-button platform-link-secondary" data-library-lesson="${activeLesson.id}" data-lesson-action="library">Adicionar a biblioteca</button>
            <button type="button" class="platform-link-button platform-link-secondary" data-duplicate-lesson="${activeLesson.id}" data-lesson-action="duplicate">Duplicar para outra turma</button>
            <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${activeLesson.id}" data-lesson-action="delete">Remover</button>
        `;
    }

    markClassPageReady();
}

function bindLessonActivationLinks() {
    document.addEventListener("click", (event) => {
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
        activateLessonById(lessonId);
    });

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-delete-lesson]");
        if (!trigger) return;

        event.preventDefault();
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

function hydrateLibraryPage() {
    const root = document.querySelector("[data-library-materials]");
    const countNode = document.querySelector("[data-library-count]");
    if (!root && !countNode) return;

    const lessons = libraryMaterials();
    if (countNode) {
        countNode.textContent = `${lessons.length} ${lessons.length === 1 ? "material salvo" : "materiais salvos"}`;
    }

    if (!root) return;
    if (!lessons.length) {
        root.innerHTML = `
            <article class="lesson-history-card">
                <span class="route-tag">Biblioteca vazia</span>
                <h3>Nenhum material salvo na biblioteca ainda</h3>
                <p>Use “Salvar na biblioteca” em qualquer atividade para montar seu acervo reutilizável.</p>
            </article>
        `;
        return;
    }

    root.innerHTML = lessons.map((lesson) => `
        <article class="lesson-history-card lesson-history-card--grouped">
            <span class="route-tag">${materialGroupLabel(lesson.materialType || "slides")}</span>
            <h3>${lesson.title}</h3>
            <p>${lesson.summary}</p>
            <div class="lesson-history-meta">
                <span>Atualizado em ${formatLessonDate(lesson.updatedAt)}</span>
                <span>${lesson.type}</span>
            </div>
            <div class="lesson-history-actions">
                <a href="${editorPathForLesson(lesson)}" class="platform-link-button platform-link-primary" data-edit-lesson="${lesson.id}">Editar</a>
                <a href="${presentationPathForLesson(lesson)}" class="platform-link-button platform-link-secondary" data-present-lesson="${lesson.id}">Apresentar</a>
                <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${lesson.id}">Excluir</button>
            </div>
        </article>
    `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
    bindSaveLessonAction();
    hydrateCompletionSummary();
    hydrateClassCards();
    hydrateClassPage();
    hydrateLibraryPage();
    bindLessonActivationLinks();
    bindClassPageRefresh();
});
