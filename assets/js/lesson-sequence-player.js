let lessonPlayerState = {
    title: "Aula completa",
    objective: "",
    blocks: []
};

let lessonPlayerIndex = 0;
const ACTIVE_LESSON_SEQUENCE_KEY = "educaria:activeLessonSequenceId";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function withLessonEditorContext(path) {
    const base = String(path || "").trim();
    if (!base) return "criar-aula.html?editor=lesson";
    return `${base}${base.includes("?") ? "&" : "?"}editor=lesson`;
}

function readActiveLessonSequenceRecord() {
    let lesson = typeof readActiveLesson === "function" ? readActiveLesson() : null;
    if ((!lesson || lesson.materialType !== "lesson") && typeof readLessonsLibrary === "function") {
        try {
            const preservedId = localStorage.getItem(scopedStorageKey(ACTIVE_LESSON_SEQUENCE_KEY)) || "";
            if (preservedId) {
                lesson = readLessonsLibrary().find((item) => item.id === preservedId) || lesson;
            }
        } catch (error) {
            console.warn("EducarIA lesson player unavailable:", error);
        }
    }
    if (!lesson || lesson.materialType !== "lesson") return null;
    return lesson;
}

function readActiveLessonSequence() {
    const lesson = readActiveLessonSequenceRecord();
    if (!lesson || !lesson.draft) {
        try {
            const rawDraft = localStorage.getItem(scopedStorageKey("educaria:builder:lesson")) || "";
            return rawDraft ? JSON.parse(rawDraft) : null;
        } catch (error) {
            console.warn("EducarIA lesson player unavailable:", error);
            return null;
        }
    }

    try {
        return JSON.parse(lesson.draft);
    } catch (error) {
        console.warn("EducarIA lesson player unavailable:", error);
        return null;
    }
}

function lessonPlayerBlocks() {
    return Array.isArray(lessonPlayerState.blocks) ? lessonPlayerState.blocks : [];
}

function lessonForPlayerBlock(block) {
    if (!block?.lessonRefId || typeof readLessonsLibrary !== "function") return null;
    return readLessonsLibrary().find((lesson) => lesson.id === block.lessonRefId) || null;
}

function hydrateBlockDraft(block, fallbackLesson = null) {
    if (!block) return;

    const draft = block.lessonDraft || fallbackLesson?.draft || "";
    if (draft && typeof writeCurrentDraftByType === "function") {
        writeCurrentDraftByType(block.materialType || "slides", draft);
    }

    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(block.materialType || fallbackLesson?.materialType || "slides");
    }
}

function blockPresentationPath(block, lesson) {
    return withLessonEditorContext(presentationPathForLesson(lesson || { materialType: block?.materialType || "slides" }));
}

function renderLessonPlayerList() {
    const list = document.querySelector("[data-lesson-player-list]");
    if (!list) return;

    const blocks = lessonPlayerBlocks();
    list.innerHTML = blocks.map((block, index) => `
        <button type="button" class="lesson-sequence-player-item ${index === lessonPlayerIndex ? "is-active" : ""}" data-lesson-player-select="${index}">
            <span class="lesson-sequence-player-order">${index + 1}</span>
            <span>
                <strong>${block.label || block.lessonTitle || "Bloco"}</strong>
                <small>${materialGroupLabel(block.materialType || "slides")} - ${block.duration || 0} min</small>
            </span>
        </button>
    `).join("");
}

function renderLessonPlayerCurrent() {
    const embed = document.querySelector("[data-lesson-player-embed]");
    const empty = document.querySelector("[data-lesson-player-empty]");
    const iframe = document.querySelector("[data-lesson-player-iframe]");
    const counter = document.querySelector("[data-lesson-player-counter]");
    const prevButton = document.querySelector("[data-lesson-player-prev]");
    const nextButton = document.querySelector("[data-lesson-player-next]");
    const openLink = document.querySelector("[data-lesson-player-open]");
    const titleNode = document.querySelector("[data-lesson-player-current-title]");
    if (!embed || !iframe || !prevButton || !nextButton) return;

    const blocks = lessonPlayerBlocks();
    const currentBlock = blocks[lessonPlayerIndex];
    const currentLesson = lessonForPlayerBlock(currentBlock);
    const currentTitle = currentBlock?.lessonTitle || currentLesson?.title || currentBlock?.label || "Material";

    if (!currentBlock) {
        embed.hidden = true;
        if (empty) empty.hidden = false;
        if (titleNode) titleNode.textContent = "Sem atividade";
        if (counter) counter.textContent = "0 de 0";
        prevButton.disabled = true;
        nextButton.disabled = true;
        if (openLink) openLink.setAttribute("href", "criar-aula.html");
        return;
    }

    if (currentLesson && typeof writeActiveLessonId === "function") {
        writeActiveLessonId(currentLesson.id);
    }
    hydrateBlockDraft(currentBlock, currentLesson);

    embed.hidden = false;
    if (empty) empty.hidden = true;
    if (titleNode) titleNode.textContent = currentBlock.label || currentTitle;
    iframe.src = blockPresentationPath(currentBlock, currentLesson);
    if (openLink) openLink.setAttribute("href", blockPresentationPath(currentBlock, currentLesson));
    if (counter) counter.textContent = `${lessonPlayerIndex + 1} de ${blocks.length}`;
    prevButton.disabled = lessonPlayerIndex === 0;
    nextButton.disabled = lessonPlayerIndex === blocks.length - 1;
}

function renderLessonPlayerMeta() {
    const title = document.querySelector("[data-lesson-player-title]");
    const classNode = document.querySelector("[data-lesson-player-class]");
    const objective = document.querySelector("[data-lesson-player-objective]");
    const turma = typeof currentClassName === "function" ? currentClassName() : "Turma";

    if (title) title.textContent = lessonPlayerState.title || "Aula completa";
    if (classNode) classNode.textContent = turma || "Turma";
    if (objective) {
        objective.textContent = lessonPlayerState.objective
            ? lessonPlayerState.objective
            : "Use os controles para avançar pelos blocos da aula em sequência.";
    }
}

function renderLessonPlayer() {
    renderLessonPlayerMeta();
    renderLessonPlayerList();
    renderLessonPlayerCurrent();
}

function selectLessonPlayerIndex(nextIndex) {
    const blocks = lessonPlayerBlocks();
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    lessonPlayerIndex = nextIndex;
    renderLessonPlayer();
}

function bindLessonPlayerEvents() {
    document.addEventListener("click", (event) => {
        const selectTrigger = event.target.closest("[data-lesson-player-select]");
        if (selectTrigger) {
            selectLessonPlayerIndex(Number(selectTrigger.dataset.lessonPlayerSelect || 0));
            return;
        }

        if (event.target.closest("[data-lesson-player-prev]")) {
            selectLessonPlayerIndex(lessonPlayerIndex - 1);
            return;
        }

        if (event.target.closest("[data-lesson-player-next]")) {
            selectLessonPlayerIndex(lessonPlayerIndex + 1);
            return;
        }

        if (event.target.closest("[data-lesson-player-open]")) {
            const block = lessonPlayerBlocks()[lessonPlayerIndex];
            const lesson = lessonForPlayerBlock(block);
            hydrateBlockDraft(block, lesson);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            selectLessonPlayerIndex(lessonPlayerIndex - 1);
        }

        if (event.key === "ArrowRight") {
            selectLessonPlayerIndex(lessonPlayerIndex + 1);
        }
    });
}

function initLessonSequencePlayer() {
    if (!document.body.matches('[data-material-type="lesson"]')) return;

    const activeLesson = readActiveLessonSequenceRecord() || (typeof readActiveLesson === "function" ? readActiveLesson() : null);
    const parentLesson = readActiveLessonSequence();
    try {
        const currentLessonId = activeLesson?.id || "";
        if (currentLessonId) {
            localStorage.setItem(scopedStorageKey(ACTIVE_LESSON_SEQUENCE_KEY), currentLessonId);
        }
    } catch (error) {
        console.warn("EducarIA lesson player unavailable:", error);
    }

    lessonPlayerState = parentLesson || { title: activeLesson?.title || "Aula completa", objective: "", blocks: [] };
    bindLessonPlayerEvents();
    renderLessonPlayer();
}

document.addEventListener("DOMContentLoaded", initLessonSequencePlayer);
