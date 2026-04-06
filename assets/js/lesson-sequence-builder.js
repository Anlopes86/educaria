const LESSON_SEQUENCE_DRAFT_KEY = "educaria:builder:lesson";
const ACTIVE_LESSON_SEQUENCE_KEY = "educaria:activeLessonSequenceId";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

const LESSON_SEQUENCE_TYPES = [
    { value: "slides", label: "Slides" },
    { value: "flashcards", label: "Flashcards" },
    { value: "wheel", label: "Roleta" },
    { value: "quiz", label: "Quiz" },
    { value: "memory", label: "Jogo da memoria" },
    { value: "match", label: "Ligar pontos" },
    { value: "mindmap", label: "Mapa mental" },
    { value: "debate", label: "Debate guiado" }
];

let lessonSequenceState = {
    title: "",
    objective: "",
    duration: 0,
    blocks: []
};

let selectedBlockId = "";

function readLessonSequenceDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(LESSON_SEQUENCE_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA lesson draft unavailable:", error);
        return null;
    }
}

function writeLessonSequenceDraft(state) {
    try {
        localStorage.setItem(scopedStorageKey(LESSON_SEQUENCE_DRAFT_KEY), JSON.stringify(state));
    } catch (error) {
        console.warn("EducarIA lesson draft unavailable:", error);
    }
}

function classLessonsForSequence() {
    const turma = typeof currentClassName === "function" ? currentClassName() : "";
    return readLessonsLibrary()
        .filter((lesson) => lesson.className === turma)
        .filter((lesson) => (lesson.materialType || "slides") !== "lesson");
}

function lessonSequenceTypesAvailable() {
    const lessons = classLessonsForSequence();
    return LESSON_SEQUENCE_TYPES.filter((type) => lessons.some((lesson) => lesson.materialType === type.value));
}

function findLessonById(id) {
    return readLessonsLibrary().find((lesson) => lesson.id === id) || null;
}

function buildDefaultLessonSequenceState() {
    const turma = typeof currentClassName === "function" ? currentClassName() : "Turma";
    return {
        title: `Aula completa - ${turma}`,
        objective: "",
        duration: 50,
        blocks: []
    };
}

function normalizeLessonSequenceState(rawState) {
    const base = buildDefaultLessonSequenceState();
    if (!rawState || typeof rawState !== "object") return base;

    return {
        title: typeof rawState.title === "string" ? rawState.title : base.title,
        objective: typeof rawState.objective === "string" ? rawState.objective : "",
        duration: Number(rawState.duration || 0),
        blocks: Array.isArray(rawState.blocks)
            ? rawState.blocks.map((block) => ({
                id: block.id || `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                lessonRefId: block.lessonRefId || "",
                materialType: block.materialType || "slides",
                label: block.label || block.lessonTitle || "Bloco",
                duration: Number(block.duration || 0),
                note: block.note || "",
                lessonTitle: block.lessonTitle || "Material",
                lessonSummary: block.lessonSummary || "",
                lessonDraft: block.lessonDraft || ""
            }))
            : []
    };
}

function activeLessonSequenceRecord() {
    try {
        const preservedId = localStorage.getItem(scopedStorageKey(ACTIVE_LESSON_SEQUENCE_KEY)) || "";
        if (preservedId) {
            const preservedLesson = findLessonById(preservedId);
            if (preservedLesson?.materialType === "lesson") {
                return preservedLesson;
            }
        }
    } catch (error) {
        console.warn("EducarIA lesson record unavailable:", error);
    }

    const lesson = typeof readActiveLesson === "function" ? readActiveLesson() : null;
    if (!lesson || lesson.materialType !== "lesson") return null;
    return lesson;
}

function hydrateMetaFields() {
    const title = document.getElementById("lesson-title");
    const objective = document.getElementById("lesson-objective");
    const duration = document.getElementById("lesson-duration");
    if (title) title.value = lessonSequenceState.title || "";
    if (objective) objective.value = lessonSequenceState.objective || "";
    if (duration) duration.value = lessonSequenceState.duration || "";
}

function syncStateFromFields() {
    lessonSequenceState.title = document.getElementById("lesson-title")?.value?.trim() || lessonSequenceState.title || buildDefaultLessonSequenceState().title;
    lessonSequenceState.objective = document.getElementById("lesson-objective")?.value?.trim() || lessonSequenceState.objective || "";
    lessonSequenceState.duration = Number(document.getElementById("lesson-duration")?.value || lessonSequenceState.duration || 0);
}

function populateTypeSelect() {
    const typeSelect = document.querySelector("[data-lesson-block-type]");
    if (!typeSelect) return;

    const availableTypes = lessonSequenceTypesAvailable();
    typeSelect.innerHTML = availableTypes.length
        ? availableTypes.map((type) => `<option value="${type.value}">${type.label}</option>`).join("")
        : `<option value="">Nenhuma atividade salva</option>`;
    typeSelect.disabled = !availableTypes.length;
}

function populateMaterialSelect() {
    const typeSelect = document.querySelector("[data-lesson-block-type]");
    const materialSelect = document.querySelector("[data-lesson-block-material]");
    if (!typeSelect || !materialSelect) return;

    const lessons = classLessonsForSequence().filter((lesson) => lesson.materialType === typeSelect.value);
    materialSelect.innerHTML = lessons.length
        ? lessons.map((lesson) => `<option value="${lesson.id}">${lesson.title}</option>`).join("")
        : `<option value="">Nenhum material salvo deste tipo</option>`;
    materialSelect.disabled = !lessons.length;
}

function totalBlocksDuration() {
    return lessonSequenceState.blocks.reduce((total, block) => total + Number(block.duration || 0), 0);
}

function selectBlock(id) {
    selectedBlockId = id;
    renderLessonSequence();
}

function renderPreview() {
    const previewCard = document.querySelector("[data-lesson-preview-card]");
    const previewActions = document.querySelector("[data-lesson-preview-actions]");
    const editLink = document.querySelector("[data-lesson-preview-edit]");
    const presentLink = document.querySelector("[data-lesson-preview-present]");
    if (!previewCard || !previewActions || !editLink || !presentLink) return;

    const block = lessonSequenceState.blocks.find((item) => item.id === selectedBlockId);
    const lesson = block ? findLessonById(block.lessonRefId) : null;
    const summary = block?.lessonSummary || lesson?.summary || "Material sem resumo.";
    const sourceTitle = block?.lessonTitle || lesson?.title || block?.label || "Material";

    if (!block) {
        previewCard.innerHTML = `
            <span class="route-tag">Sem bloco</span>
            <h3>Selecione uma atividade</h3>
            <p>Ao clicar em um bloco da sequÃªncia, os detalhes aparecem aqui.</p>
        `;
        previewActions.hidden = true;
        return;
    }

    previewCard.innerHTML = `
        <span class="route-tag">${materialGroupLabel(block.materialType)}</span>
        <h3>${block.label}</h3>
        <p>${summary}</p>
        <div class="lesson-sequence-preview-meta">
            <span>${block.duration || 0} min</span>
            <span>${sourceTitle}</span>
        </div>
        ${block.note ? `<div class="lesson-sequence-note">${block.note}</div>` : ""}
    `;
    previewActions.hidden = false;
    editLink.href = editorPathForLesson(lesson || { materialType: block.materialType });
    editLink.dataset.lessonPreviewEdit = block.id;
    presentLink.href = presentationPathForLesson(lesson || { materialType: block.materialType });
    presentLink.dataset.lessonPreviewPresent = block.id;
}

function renderLessonSequence() {
    const list = document.querySelector("[data-lesson-sequence-list]");
    const empty = document.querySelector("[data-lesson-sequence-empty]");
    const count = document.querySelector("[data-lesson-sequence-count]");
    const duration = document.querySelector("[data-lesson-sequence-duration]");
    const classNode = document.querySelector("[data-lesson-sequence-class]");
    if (!list || !empty) return;

    const turma = typeof currentClassName === "function" ? currentClassName() : "Turma";
    if (classNode) classNode.textContent = turma || "Turma";
    if (count) count.textContent = `${lessonSequenceState.blocks.length} ${lessonSequenceState.blocks.length === 1 ? "bloco" : "blocos"}`;
    if (duration) duration.textContent = `${lessonSequenceState.duration || totalBlocksDuration()} min`;

    if (!lessonSequenceState.blocks.length) {
        empty.hidden = false;
        list.innerHTML = "";
        renderPreview();
        return;
    }

    empty.hidden = true;
    list.innerHTML = lessonSequenceState.blocks.map((block, index) => {
        const linkedLesson = findLessonById(block.lessonRefId);
        const summary = block.lessonSummary || linkedLesson?.summary || "Material sem resumo.";
        const title = block.lessonTitle || linkedLesson?.title || block.label;
        return `
        <article class="lesson-sequence-item ${block.id === selectedBlockId ? "is-selected" : ""}" data-lesson-block-id="${block.id}">
            <button type="button" class="lesson-sequence-item-main" data-select-lesson-block="${block.id}">
                <div class="lesson-sequence-item-head">
                    <span class="platform-badge-soft">${index + 1}</span>
                    <span class="platform-block-chip">${materialGroupLabel(block.materialType)}</span>
                </div>
                <h3>${block.label}</h3>
                <p>${summary}</p>
            </button>

            <div class="lesson-sequence-item-fields">
                <div class="platform-field">
                    <label>Nome do bloco</label>
                    <input type="text" value="${block.label}" data-block-field="label" data-block-id="${block.id}">
                </div>
                <div class="platform-field">
                    <label>Tempo</label>
                    <input type="number" min="1" step="1" value="${block.duration || 0}" data-block-field="duration" data-block-id="${block.id}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>ObservaÃ§Ã£o do professor</label>
                    <input type="text" value="${block.note || ""}" placeholder="Ex.: retomar a resposta da turma antes do quiz" data-block-field="note" data-block-id="${block.id}">
                </div>
            </div>

            <div class="lesson-history-actions">
                <button type="button" class="platform-link-button platform-link-secondary" data-move-lesson-block="${block.id}" data-direction="up" ${index === 0 ? "disabled" : ""}>Subir</button>
                <button type="button" class="platform-link-button platform-link-secondary" data-move-lesson-block="${block.id}" data-direction="down" ${index === lessonSequenceState.blocks.length - 1 ? "disabled" : ""}>Descer</button>
                <a href="${editorPathForLesson(linkedLesson || { materialType: block.materialType })}" class="platform-link-button platform-link-secondary" data-open-lesson-block-editor="${block.id}" title="${title}">Editar material</a>
                <button type="button" class="platform-link-button platform-link-secondary" data-remove-lesson-block="${block.id}">Remover</button>
            </div>
        </article>
    `;
    }).join("");

    if (!selectedBlockId && lessonSequenceState.blocks[0]) {
        selectedBlockId = lessonSequenceState.blocks[0].id;
    }

    renderPreview();
}

function addBlockToSequence() {
    const materialSelect = document.querySelector("[data-lesson-block-material]");
    const durationField = document.getElementById("lesson-block-duration");
    if (!materialSelect || !materialSelect.value) return;

    const lesson = findLessonById(materialSelect.value);
    if (!lesson) return;

    const block = {
        id: `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        lessonRefId: lesson.id,
        materialType: lesson.materialType || "slides",
        label: lesson.title,
        duration: Number(durationField?.value || 8),
        note: "",
        lessonTitle: lesson.title,
        lessonSummary: lesson.summary || "",
        lessonDraft: lesson.draft || ""
    };

    lessonSequenceState.blocks.push(block);
    selectedBlockId = block.id;
    syncStateFromFields();
    writeLessonSequenceDraft(lessonSequenceState);
    renderLessonSequence();
}

function updateBlockField(blockId, field, value) {
    const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
    if (!block) return;
    if (field === "duration") {
        block.duration = Number(value || 0);
    } else {
        block[field] = value;
    }
    syncStateFromFields();
    writeLessonSequenceDraft(lessonSequenceState);
    renderPreview();
    const duration = document.querySelector("[data-lesson-sequence-duration]");
    if (duration) duration.textContent = `${lessonSequenceState.duration || totalBlocksDuration()} min`;
}

function moveBlock(blockId, direction) {
    const index = lessonSequenceState.blocks.findIndex((item) => item.id === blockId);
    if (index === -1) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= lessonSequenceState.blocks.length) return;

    const [block] = lessonSequenceState.blocks.splice(index, 1);
    lessonSequenceState.blocks.splice(nextIndex, 0, block);
    writeLessonSequenceDraft(lessonSequenceState);
    renderLessonSequence();
}

function removeBlock(blockId) {
    lessonSequenceState.blocks = lessonSequenceState.blocks.filter((item) => item.id !== blockId);
    if (selectedBlockId === blockId) {
        selectedBlockId = lessonSequenceState.blocks[0]?.id || "";
    }
    writeLessonSequenceDraft(lessonSequenceState);
    renderLessonSequence();
}

function bindLessonSequenceEvents() {
    document.querySelector("[data-lesson-block-type]")?.addEventListener("change", () => {
        populateMaterialSelect();
    });

    document.querySelector("[data-add-lesson-block]")?.addEventListener("click", () => {
        addBlockToSequence();
    });

    document.addEventListener("click", (event) => {
        const selectTrigger = event.target.closest("[data-select-lesson-block]");
        if (selectTrigger) {
            selectBlock(selectTrigger.dataset.selectLessonBlock || "");
            return;
        }

        const moveTrigger = event.target.closest("[data-move-lesson-block]");
        if (moveTrigger) {
            moveBlock(moveTrigger.dataset.moveLessonBlock || "", moveTrigger.dataset.direction || "down");
            return;
        }

        const removeTrigger = event.target.closest("[data-remove-lesson-block]");
        if (removeTrigger) {
            removeBlock(removeTrigger.dataset.removeLessonBlock || "");
            return;
        }

        const openEditorTrigger = event.target.closest("[data-open-lesson-block-editor]");
        if (openEditorTrigger) {
            const block = lessonSequenceState.blocks.find((item) => item.id === (openEditorTrigger.dataset.openLessonBlockEditor || ""));
            if (block?.lessonDraft && typeof writeCurrentDraftByType === "function") {
                writeCurrentDraftByType(block.materialType || "slides", block.lessonDraft);
            }
            if (typeof setCurrentMaterialType === "function") {
                setCurrentMaterialType(block?.materialType || "slides");
            }
            return;
        }

        const previewTrigger = event.target.closest("[data-lesson-preview-edit], [data-lesson-preview-present]");
        if (previewTrigger) {
            const blockId = previewTrigger.dataset.lessonPreviewEdit || previewTrigger.dataset.lessonPreviewPresent || "";
            const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
            if (block?.lessonDraft && typeof writeCurrentDraftByType === "function") {
                writeCurrentDraftByType(block.materialType || "slides", block.lessonDraft);
            }
            if (typeof setCurrentMaterialType === "function") {
                setCurrentMaterialType(block?.materialType || "slides");
            }
        }
    });

    document.addEventListener("input", (event) => {
        const blockField = event.target.closest("[data-block-field]");
        if (blockField) {
            updateBlockField(blockField.dataset.blockId || "", blockField.dataset.blockField || "", blockField.value);
            return;
        }

        if (event.target.matches("#lesson-title, #lesson-objective, #lesson-duration")) {
            syncStateFromFields();
            writeLessonSequenceDraft(lessonSequenceState);
            renderLessonSequence();
        }
    });
}

function loadInitialLessonSequence() {
    const activeLesson = activeLessonSequenceRecord();
    if (activeLesson?.draft) {
        try {
            lessonSequenceState = normalizeLessonSequenceState(JSON.parse(activeLesson.draft));
            writeLessonSequenceDraft(lessonSequenceState);
            return;
        } catch (error) {
            console.warn("EducarIA lesson record unavailable:", error);
        }
    }

    const localDraft = readLessonSequenceDraft();
    lessonSequenceState = normalizeLessonSequenceState(localDraft);
}

function saveLessonSequenceToLibrary(scope = "class") {
    syncStateFromFields();
    const turma = typeof currentClassName === "function" ? currentClassName() : "Turma";
    const lessons = readLessonsLibrary();
    const activeLesson = activeLessonSequenceRecord();
    const lessonId = activeLesson && ((activeLesson.scope || (activeLesson.className ? "class" : "library")) === scope)
        ? activeLesson.id
        : `lesson-${Date.now()}`;
    const rawDraft = JSON.stringify(lessonSequenceState);
    const summary = typeof summarizeLessonSequenceDraft === "function"
        ? summarizeLessonSequenceDraft(rawDraft)
        : { title: lessonSequenceState.title || "Aula completa", summary: `${lessonSequenceState.blocks.length} blocos`, type: "Aula completa", materialType: "lesson" };

    const record = {
        id: lessonId,
        className: scope === "class" ? (turma || "Turma") : "",
        scope,
        title: summary.title,
        summary: summary.summary,
        type: summary.type,
        materialType: "lesson",
        updatedAt: new Date().toISOString(),
        draft: rawDraft
    };

    const nextLessons = lessons.filter((lesson) => lesson.id !== lessonId);
    nextLessons.unshift(record);
    writeLessonsLibrary(nextLessons);
    writeActiveLessonId(lessonId);
    try {
            localStorage.setItem(scopedStorageKey(ACTIVE_LESSON_SEQUENCE_KEY), lessonId);
    } catch (error) {
        console.warn("EducarIA lesson draft unavailable:", error);
    }
    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType("lesson");
    }
    writeLessonSequenceDraft(lessonSequenceState);
    return record;
}

function initLessonSequenceBuilder() {
    if (!document.body.matches('[data-material-type="lesson"]')) return;

    loadInitialLessonSequence();
    hydrateMetaFields();
    populateTypeSelect();
    populateMaterialSelect();
    bindLessonSequenceEvents();
    selectedBlockId = lessonSequenceState.blocks[0]?.id || "";
    renderLessonSequence();
}

window.saveLessonSequenceToClass = saveLessonSequenceToLibrary;

document.addEventListener("DOMContentLoaded", initLessonSequenceBuilder);



