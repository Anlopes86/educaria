let lessonPlayerState = {
    title: "Aula completa",
    objective: "",
    blocks: []
};

let lessonPlayerIndex = 0;
const ACTIVE_LESSON_SEQUENCE_KEY = "educaria:activeLessonSequenceId";

function escapeLessonPlayerHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function withLessonEditorContext(path) {
    const base = String(path || "").trim();
    if (!base) return "criar-aula.html?editor=lesson";
    return `${base}${base.includes("?") ? "&" : "?"}editor=lesson`;
}

function lessonPlayerMaterialType(block, fallbackLesson = null) {
    const rawType = block?.materialType || fallbackLesson?.materialType || block?.type || "slides";
    return typeof normalizeMaterialType === "function"
        ? normalizeMaterialType(rawType)
        : String(rawType || "slides").trim() || "slides";
}

function withMaterialContext(path, materialType) {
    const base = String(path || "").trim();
    if (!base) return "";

    const hashIndex = base.indexOf("#");
    const pathWithoutHash = hashIndex >= 0 ? base.slice(0, hashIndex) : base;
    const hash = hashIndex >= 0 ? base.slice(hashIndex) : "";
    const queryIndex = pathWithoutHash.indexOf("?");
    const pagePath = queryIndex >= 0 ? pathWithoutHash.slice(0, queryIndex) : pathWithoutHash;
    const query = queryIndex >= 0 ? pathWithoutHash.slice(queryIndex + 1) : "";
    const params = new URLSearchParams(query);
    params.set("material", materialType);

    return `${pagePath}?${params.toString()}${hash}`;
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

    const materialType = lessonPlayerMaterialType(block, fallbackLesson);
    const draft = block.lessonDraft || fallbackLesson?.draft || "";
    if (draft && typeof writeCurrentDraftByType === "function") {
        writeCurrentDraftByType(materialType, draft);
    }

    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(materialType);
    }
}

function blockPresentationPath(block, lesson) {
    const materialType = lessonPlayerMaterialType(block, lesson);
    const lessonForPath = lesson ? { ...lesson, materialType } : { materialType };
    const contextualPath = withLessonEditorContext(withMaterialContext(presentationPathForLesson(lessonForPath), materialType));
    const blockId = String(block?.id || "").trim();
    return blockId
        ? `${contextualPath}${contextualPath.includes("?") ? "&" : "?"}lessonBlock=${encodeURIComponent(blockId)}`
        : contextualPath;
}

function renderLessonPlayerList() {
    const list = document.querySelector("[data-lesson-player-list]");
    if (!list) return;

    const blocks = lessonPlayerBlocks();
    list.innerHTML = blocks.map((block, index) => `
        <button type="button" class="lesson-sequence-player-item ${index === lessonPlayerIndex ? "is-active" : ""}" data-lesson-player-select="${index}" ${index === lessonPlayerIndex ? 'aria-current="step"' : ""}>
            <span class="lesson-sequence-player-order">${index + 1}</span>
            <span>
                <strong>${escapeLessonPlayerHtml(block.label || block.lessonTitle || "Bloco")}</strong>
                <small>${escapeLessonPlayerHtml(materialGroupLabel(lessonPlayerMaterialType(block)))} - ${Math.max(0, Number(block.duration) || 0)} min</small>
            </span>
        </button>
    `).join("");

    requestAnimationFrame(() => {
        const activeItem = list.querySelector(".lesson-sequence-player-item.is-active");
        if (!activeItem) return;
        const centeredLeft = activeItem.offsetLeft - ((list.clientWidth - activeItem.offsetWidth) / 2);
        list.scrollTo({ left: Math.max(0, centeredLeft), behavior: "smooth" });
    });
}

function setLessonPlayerTransition(isVisible) {
    const transition = document.querySelector("[data-lesson-player-transition]");
    const embed = document.querySelector("[data-lesson-player-embed]");
    if (transition) transition.hidden = !isVisible;
    if (embed) embed.classList.toggle("is-loading", isVisible);
}

function enhanceEmbeddedLesson() {
    const iframe = document.querySelector("[data-lesson-player-iframe]");
    if (!iframe) return;

    try {
        iframe.contentDocument?.body?.classList.add("lesson-sequence-embedded");
    } catch (error) {
        console.warn("EducarIA embedded lesson unavailable:", error);
    }

    setLessonPlayerTransition(false);
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
    const navigation = document.querySelector("[data-lesson-player-navigation]");
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
        if (navigation) navigation.hidden = true;
        setLessonPlayerTransition(false);
        if (openLink) openLink.setAttribute("href", "criar-aula.html");
        return;
    }

    if (currentLesson && typeof writeActiveLessonId === "function") {
        writeActiveLessonId(currentLesson.id);
    }
    hydrateBlockDraft(currentBlock, currentLesson);

    embed.hidden = false;
    if (navigation) navigation.hidden = false;
    if (empty) empty.hidden = true;
    if (titleNode) titleNode.textContent = currentBlock.label || currentTitle;
    const presentationPath = blockPresentationPath(currentBlock, currentLesson);
    if (iframe.dataset.lessonPlayerSrc !== presentationPath) {
        setLessonPlayerTransition(true);
        iframe.dataset.lessonPlayerSrc = presentationPath;
        iframe.src = presentationPath;
    }
    if (openLink) openLink.setAttribute("href", presentationPath);
    if (counter) counter.textContent = `${lessonPlayerIndex + 1} de ${blocks.length}`;
    prevButton.disabled = lessonPlayerIndex === 0;
    nextButton.disabled = lessonPlayerIndex === blocks.length - 1;

    const previousTitle = blocks[lessonPlayerIndex - 1]?.label || blocks[lessonPlayerIndex - 1]?.lessonTitle || "Atividade anterior";
    const nextTitle = blocks[lessonPlayerIndex + 1]?.label || blocks[lessonPlayerIndex + 1]?.lessonTitle || "Fim da aula";
    const previousLabel = prevButton.querySelector("strong");
    const nextLabel = nextButton.querySelector("strong");
    if (previousLabel) previousLabel.textContent = previousTitle;
    if (nextLabel) nextLabel.textContent = nextTitle;
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

function toggleLessonPlayerRoute() {
    const trigger = document.querySelector("[data-lesson-player-toggle-route]");
    const routeIsHidden = document.body.classList.toggle("lesson-sequence-route-hidden");
    if (!trigger) return;
    trigger.setAttribute("aria-pressed", String(routeIsHidden));
    trigger.textContent = routeIsHidden ? "Mostrar roteiro" : "Ocultar roteiro";
}

async function toggleLessonPlayerFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen?.();
        } else {
            await document.exitFullscreen?.();
        }
    } catch (error) {
        console.warn("EducarIA fullscreen unavailable:", error);
    }
}

function syncLessonPlayerFullscreenLabel() {
    const trigger = document.querySelector("[data-lesson-player-fullscreen]");
    if (trigger) trigger.textContent = document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia";
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

        if (event.target.closest("[data-lesson-player-toggle-route]")) {
            toggleLessonPlayerRoute();
            return;
        }

        if (event.target.closest("[data-lesson-player-fullscreen]")) {
            toggleLessonPlayerFullscreen();
            return;
        }

        if (event.target.closest("[data-lesson-player-open]")) {
            const block = lessonPlayerBlocks()[lessonPlayerIndex];
            const lesson = lessonForPlayerBlock(block);
            hydrateBlockDraft(block, lesson);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.defaultPrevented) return;
        if (event.target?.closest?.("input, textarea, select, [contenteditable='true'], [data-inline-editable]")) return;

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            selectLessonPlayerIndex(lessonPlayerIndex - 1);
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            selectLessonPlayerIndex(lessonPlayerIndex + 1);
        }
    });

    document.addEventListener("fullscreenchange", syncLessonPlayerFullscreenLabel);

    const iframe = document.querySelector("[data-lesson-player-iframe]");
    iframe?.addEventListener("load", enhanceEmbeddedLesson);
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
