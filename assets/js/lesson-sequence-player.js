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
    if (!block?.lessonRefId) return null;
    return readLessonsLibrary().find((lesson) => lesson.id === block.lessonRefId) || null;
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
    const currentCard = document.querySelector("[data-lesson-player-current]");
    const embed = document.querySelector("[data-lesson-player-embed]");
    const iframe = document.querySelector("[data-lesson-player-iframe]");
    const counter = document.querySelector("[data-lesson-player-counter]");
    const prevButton = document.querySelector("[data-lesson-player-prev]");
    const nextButton = document.querySelector("[data-lesson-player-next]");
    const openLink = document.querySelector("[data-lesson-player-open]");
    if (!currentCard || !embed || !iframe || !counter || !prevButton || !nextButton || !openLink) return;

    const blocks = lessonPlayerBlocks();
    const currentBlock = blocks[lessonPlayerIndex];
    const currentLesson = lessonForPlayerBlock(currentBlock);

    if (!currentBlock || !currentLesson) {
        currentCard.innerHTML = `
            <span class="route-tag">Sem bloco</span>
            <h2>Essa aula ainda não tem atividades na sequência</h2>
            <p>Volte para o editor e adicione pelo menos um material salvo.</p>
        `;
        embed.hidden = true;
        counter.textContent = "0 de 0";
        prevButton.disabled = true;
        nextButton.disabled = true;
        openLink.setAttribute("href", "criar-aula.html");
        return;
    }

    if (typeof writeActiveLessonId === "function") {
        writeActiveLessonId(currentLesson.id);
    }
    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(currentLesson.materialType || "slides");
    }

    currentCard.innerHTML = `
        <span class="route-tag">${materialGroupLabel(currentBlock.materialType || "slides")}</span>
        <h2>${currentBlock.label || currentLesson.title}</h2>
        <p>${currentLesson.summary || "Material sem resumo definido."}</p>
        <div class="lesson-sequence-player-meta">
            <span>${currentBlock.duration || 0} min</span>
            <span>${currentLesson.title}</span>
        </div>
        ${currentBlock.note ? `<div class="lesson-sequence-note">${currentBlock.note}</div>` : ""}
    `;

    embed.hidden = false;
    iframe.src = presentationPathForLesson(currentLesson);
    openLink.setAttribute("href", presentationPathForLesson(currentLesson));
    openLink.dataset.presentLesson = currentLesson.id;
    counter.textContent = `${lessonPlayerIndex + 1} de ${blocks.length}`;
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
            : "Selecione um bloco para trocar a atividade exibida.";
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
