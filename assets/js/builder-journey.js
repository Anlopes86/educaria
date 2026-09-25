const EDUCARIA_BUILDER_JOURNEY_CONFIGS = {
    quiz: {
        draftKey: "educaria:builder:quiz",
        classId: "quiz-turma",
        subjectId: "quiz-disciplina",
        gradeId: "quiz-ano",
        sourceId: "quiz-fonte-texto",
        fileId: "quiz-arquivo",
        titleId: "quiz-tema",
        meaningfulSelector: '[data-quiz-question] [data-field="prompt"]'
    },
    slides: {
        draftKey: "educaria:builder:slides",
        classId: "slides-turma",
        subjectId: "slides-disciplina",
        gradeId: "slides-publico",
        sourceId: "slides-fonte-texto",
        fileId: "slides-arquivo",
        meaningfulSelector: '[data-slide-card] [data-field="slide-title"], [data-slide-card] [data-field="slide-body"]'
    },
    flashcards: {
        draftKey: "educaria:builder:flashcards",
        classId: "cards-turma",
        subjectId: "cards-disciplina",
        gradeId: "cards-ano",
        sourceId: "cards-fonte-texto",
        fileId: "cards-arquivo",
        titleId: "cards-tema",
        meaningfulSelector: '[data-flashcard] [data-field="front"], [data-flashcard] [data-field="back"]'
    },
    memory: {
        draftKey: "educaria:builder:memory",
        classId: "memoria-turma",
        subjectId: "memoria-disciplina",
        gradeId: "memoria-ano",
        sourceId: "memoria-fonte-texto",
        fileId: "memoria-arquivo",
        titleId: "memoria-titulo",
        meaningfulSelector: "[data-memory-front], [data-memory-back]"
    },
    hangman: {
        draftKey: "educaria:builder:hangman",
        classId: "forca-turma",
        subjectId: "forca-disciplina",
        gradeId: "forca-ano",
        sourceId: "forca-fonte-texto",
        fileId: "forca-arquivo",
        titleId: "forca-titulo",
        meaningfulSelector: "[data-hangman-answer], [data-hangman-clue]"
    },
    wheel: {
        draftKey: "educaria:builder:wheel",
        classId: "roleta-turma",
        subjectId: "roleta-disciplina",
        gradeId: "roleta-ano",
        sourceId: "roleta-fonte-texto",
        fileId: "roleta-arquivo",
        titleId: "roleta-titulo",
        meaningfulSelector: "[data-wheel-text]"
    },
    match: {
        draftKey: "educaria:builder:match",
        classId: "ligar-turma",
        subjectId: "ligar-disciplina",
        gradeId: "ligar-ano",
        sourceId: "ligar-fonte-texto",
        fileId: "ligar-arquivo",
        titleId: "ligar-titulo",
        meaningfulSelector: "[data-match-left], [data-match-right]"
    }
};

function educariaBuilderJourneyConfig() {
    return EDUCARIA_BUILDER_JOURNEY_CONFIGS[document.body?.dataset.materialType || ""] || null;
}

(function prepareBuilderJourney() {
    const config = educariaBuilderJourneyConfig();
    if (!config) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;

    const scopedKey = (key) => typeof educariaScopedKey === "function" ? educariaScopedKey(key) : key;
    try {
        localStorage.removeItem(scopedKey(config.draftKey));
        localStorage.removeItem(scopedKey("educaria:activeLessonId"));
    } catch (error) {
        console.warn("EducarIA new material state unavailable:", error);
    }

    params.delete("new");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
})();

(function initBuilderJourney() {
    const config = educariaBuilderJourneyConfig();
    if (!config) return;
    const materialType = document.body.dataset.materialType;
    const AUTOSAVE_DELAY_MS = 1100;
    let autosaveTimer = 0;
    let autosaveRunning = false;
    let autosaveQueued = false;
    let journeyStarted = false;
    let lastSavedFingerprint = "";

    function statusNodes() {
        return {
            root: document.querySelector("[data-builder-save-status], [data-quiz-save-status]"),
            label: document.querySelector("[data-builder-save-status-label], [data-quiz-save-status-label]")
        };
    }

    function setSaveStatus(state, message) {
        const { root, label } = statusNodes();
        if (!root || !label) return;
        root.dataset.state = state;
        label.textContent = message;
    }

    function builderHasMeaningfulContent() {
        const title = config.titleId ? document.getElementById(config.titleId)?.value?.trim() || "" : "";
        const source = document.getElementById(config.sourceId)?.value?.trim() || "";
        const prompts = [...document.querySelectorAll(config.meaningfulSelector)]
            .some((field) => field.value.trim());
        return Boolean(title || source || prompts);
    }

    function builderFingerprint() {
        const controls = [...document.querySelectorAll("input[id], textarea[id], select[id]")]
            .filter((field) => field.type !== "file")
            .map((field) => `${field.id}:${field.value}`);
        const cardSelectors = {
            quiz: "[data-quiz-question]",
            slides: "[data-slide-card]",
            flashcards: "[data-flashcard]",
            memory: "[data-memory-pair]",
            hangman: "[data-hangman-entry]",
            wheel: "[data-wheel-segment]",
            match: "[data-match-pair]"
        };
        const cardSelector = cardSelectors[materialType] || "[data-builder-card]";
        const questions = [...document.querySelectorAll(cardSelector)].map((card) => {
            return [...card.querySelectorAll("input, textarea, select")]
                .map((field) => field.value)
                .join("|");
        });
        return JSON.stringify([controls, questions]);
    }

    function trackJourney(name, metadata = {}) {
        if (typeof window.educariaTrack !== "function") return;
        window.educariaTrack(name, {
            materialType,
            className: document.getElementById(config.classId)?.value || "",
            subject: document.getElementById(config.subjectId)?.value || "",
            grade: document.getElementById(config.gradeId)?.value || "",
            ...metadata
        });
    }

    function hydrateClassContext() {
        const select = document.getElementById(config.classId);
        if (!select) return;

        const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
        const activeLesson = typeof readActiveLesson === "function" ? readActiveLesson() : null;
        const selectedClass = activeLesson?.className
            || (typeof readSelectedClass === "function" ? readSelectedClass() : "");
        const options = [
            '<option value="">Biblioteca pessoal</option>',
            ...classes.map((className) => `<option value="${escapeBuilderJourneyHtml(className)}">${escapeBuilderJourneyHtml(className)}</option>`)
        ];
        select.innerHTML = options.join("");
        if (classes.includes(selectedClass)) select.value = selectedClass;
        syncClassSaveAvailability();
    }

    function syncClassSaveAvailability() {
        const hasClass = Boolean(document.getElementById(config.classId)?.value);
        const button = document.querySelector('[data-save-lesson][data-save-target="turma.html"]');
        if (!button) return;
        button.disabled = !hasClass;
        button.setAttribute("aria-disabled", hasClass ? "false" : "true");
        button.title = hasClass ? "" : "Selecione uma turma para salvar nela.";
    }

    function escapeBuilderJourneyHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    function persistBeforeLeaving() {
        if (!builderHasMeaningfulContent()) return;
        try {
            if (typeof forceSyncDraftFromPage === "function") forceSyncDraftFromPage(materialType);
            if (typeof buildLessonRecord !== "function" || typeof persistLessonRecord !== "function") return;
            const active = typeof readActiveLesson === "function" ? readActiveLesson() : null;
            const selectedClass = document.getElementById(config.classId)?.value || "";
            const scope = active
                ? (typeof normalizeLessonScope === "function" ? normalizeLessonScope(active) : (active.className ? "class" : "library"))
                : (selectedClass ? "class" : "library");
            persistLessonRecord(buildLessonRecord(materialType, scope), { skipSync: true, source: "pagehide" });
        } catch (error) {
            console.warn("EducarIA builder local recovery unavailable:", error);
        }
    }

    async function runAutosave(reason = "editing") {
        window.clearTimeout(autosaveTimer);
        if (!builderHasMeaningfulContent() || typeof autosaveCurrentLesson !== "function") {
            setSaveStatus("local", "Comece a editar para salvar");
            return;
        }

        const fingerprint = builderFingerprint();
        if (fingerprint === lastSavedFingerprint && reason === "editing") return;
        if (autosaveRunning) {
            autosaveQueued = true;
            return;
        }

        autosaveRunning = true;
        setSaveStatus("saving", "Salvando…");
        try {
            const result = await autosaveCurrentLesson(materialType);
            lastSavedFingerprint = builderFingerprint();
            const remoteReady = Boolean(result?.synced);
            setSaveStatus(
                remoteReady ? "saved" : "local",
                remoteReady ? "Salvo na nuvem" : "Salvo neste dispositivo — sincronização pendente"
            );
            trackJourney(`${materialType}_autosave_succeeded`, {
                reason,
                lessonId: result?.record?.id || "",
                synced: remoteReady,
                sourceMode: result?.record?.sourceMode || "manual"
            });
            document.dispatchEvent(new CustomEvent("educaria-builder-autosaved", { detail: result }));
        } catch (error) {
            setSaveStatus("error", "Não foi possível salvar — seu rascunho continua neste dispositivo");
            trackJourney(`${materialType}_autosave_failed`, { reason });
        } finally {
            autosaveRunning = false;
            if (autosaveQueued) {
                autosaveQueued = false;
                scheduleAutosave("queued");
            }
        }
    }

    function scheduleAutosave(reason = "editing") {
        window.clearTimeout(autosaveTimer);
        if (!builderHasMeaningfulContent()) {
            setSaveStatus("local", "Comece a editar para salvar");
            return;
        }

        if (!journeyStarted) {
            journeyStarted = true;
            trackJourney(`${materialType}_creation_started`, {
                hasFile: Boolean(document.getElementById(config.fileId)?.files?.length),
                hasSourceText: Boolean(document.getElementById(config.sourceId)?.value?.trim())
            });
        }
        setSaveStatus("saving", "Alterações pendentes…");
        autosaveTimer = window.setTimeout(() => runAutosave(reason), AUTOSAVE_DELAY_MS);
    }

    function bindJourney() {
        hydrateClassContext();

        const activeLesson = typeof readActiveLesson === "function" ? readActiveLesson() : null;
        if (activeLesson?.materialType === materialType) {
            const labels = {
                quiz: "Quiz",
                slides: "Slides",
                flashcards: "Flashcards",
                memory: "Jogo da mem\u00f3ria",
                hangman: "Força",
                wheel: "Roleta",
                match: "Ligar pontos"
            };
            const label = labels[materialType] || "Material";
            setSaveStatus("saved", navigator.onLine ? `${label} recuperado` : `${label} recuperado neste dispositivo`);
            trackJourney(`${materialType}_draft_recovered`, { lessonId: activeLesson.id || "" });
        } else {
            setSaveStatus("local", "Comece a editar para salvar");
        }

        document.addEventListener("input", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target?.closest(".activity-editor-shell")) return;
            scheduleAutosave("input");
        });
        document.addEventListener("change", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target?.closest(".activity-editor-shell")) return;
            if (target.id === config.classId && typeof saveSelectedClass === "function") {
                const nextClass = target.value || "";
                saveSelectedClass(nextClass);
                const activeLesson = typeof readActiveLesson === "function" ? readActiveLesson() : null;
                if (activeLesson?.materialType === materialType && typeof updateLessonRecordById === "function") {
                    updateLessonRecordById(activeLesson.id, (lesson) => ({
                        ...lesson,
                        className: nextClass,
                        scope: nextClass ? "class" : "library",
                        updatedAt: new Date().toISOString()
                    }), { skipSync: true, source: `${materialType}-context` });
                }
                syncClassSaveAvailability();
                trackJourney(`${materialType}_context_changed`, { context: "class" });
            }
            scheduleAutosave("change");
        });

        const generateButton = document.querySelector(`[data-generate-material="${materialType}"]`);
        if (generateButton) {
            new MutationObserver(() => {
                if (!generateButton.disabled && builderHasMeaningfulContent()) scheduleAutosave("generation");
            }).observe(generateButton, { attributes: true, attributeFilter: ["disabled"] });
        }

        window.addEventListener("online", async () => {
            if (typeof syncLessonsWithFirebase !== "function") return;
            setSaveStatus("saving", "Sincronizando…");
            await syncLessonsWithFirebase();
            setSaveStatus("saved", "Salvo na nuvem");
        });
        window.addEventListener("pagehide", persistBeforeLeaving);
        document.addEventListener("educaria-auth-changed", () => scheduleAutosave("authentication"));
        document.addEventListener("educaria-classes-updated", hydrateClassContext);
    }

    document.addEventListener("DOMContentLoaded", bindJourney);
})();
