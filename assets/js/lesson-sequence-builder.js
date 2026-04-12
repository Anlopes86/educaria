const LESSON_SEQUENCE_DRAFT_KEY = "educaria:builder:lesson";
const ACTIVE_LESSON_SEQUENCE_KEY = "educaria:activeLessonSequenceId";
const LESSON_SEQUENCE_EDITING_BLOCK_KEY = "educaria:lessonSequenceEditingBlock";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

const LESSON_SEQUENCE_TYPES = [
    { value: "slides", label: "Slides" },
    { value: "flashcards", label: "Flashcards" },
    { value: "quiz", label: "Quiz" },
    { value: "memory", label: "Jogo da memória" },
    { value: "match", label: "Ligar pontos" },
    { value: "wheel", label: "Roleta" },
    { value: "mindmap", label: "Mapa mental" },
    { value: "debate", label: "Debate guiado" },
    { value: "hangman", label: "Forca" },
    { value: "crossword", label: "Palavras cruzadas" },
    { value: "wordsearch", label: "Caça-palavras" }
];

const INLINE_BLOCK_EDITOR_CONFIG = {
    slides: {
        itemSelector: "[data-slide-card]",
        itemLabel: "Slide",
        emptyPayload: () => ({ slides: [{ title: "", subtitle: "", body: "" }] }),
        controls: [],
        fields: [
            { selector: '[data-field="slide-title"]', label: "Titulo" },
            { selector: '[data-field="slide-subtitle"]', label: "Subtitulo" },
            { selector: '[data-field="slide-body"]', label: "Conteudo", kind: "textarea", wide: true },
            { selector: '[data-field="slide-image-prompt"]', label: "Descricao da imagem", kind: "textarea", wide: true },
            { selector: '[data-field="slide-image-url"]', label: "URL da imagem", wide: true },
            {
                selector: '[data-field="slide-image-url"]',
                label: "Upload da imagem",
                kind: "file",
                accept: "image/*",
                wide: true,
                modeSelector: '[data-field="slide-image-mode"]'
            }
        ]
    },
    flashcards: {
        itemSelector: "[data-flashcard]",
        itemLabel: "Card",
        emptyPayload: () => ({ title: "Flashcards", cards: [{ front: "", back: "", example: "" }] }),
        controls: [{ key: "cards-tema", label: "Tema do bloco" }],
        fields: [
            { selector: '[data-field="front"]', label: "Frente" },
            { selector: '[data-field="back"]', label: "Verso" },
            { selector: '[data-field="example"]', label: "Exemplo", wide: true }
        ]
    },
    quiz: {
        itemSelector: "[data-quiz-question]",
        itemLabel: "Questao",
        emptyPayload: () => ({
            title: "Quiz",
            questions: [{
                type: "multiple_choice",
                prompt: "",
                options: ["", "", "", ""],
                correct_index: 0,
                explanation: ""
            }]
        }),
        controls: [{ key: "quiz-tema", label: "Tema do quiz" }],
        fields: [
            { selector: '[data-field="type"]', label: "Tipo" },
            { selector: '[data-field="prompt"]', label: "Pergunta", kind: "textarea", wide: true },
            { selector: "[data-option]", label: "Alternativa", multiple: true },
            { selector: '[data-field="correct"]', label: "Resposta correta" },
            { selector: '[data-field="explanation"]', label: "Explicacao", kind: "textarea", wide: true }
        ]
    },
    memory: {
        itemSelector: "[data-memory-pair]",
        itemLabel: "Par",
        emptyPayload: () => ({ title: "Jogo da memoria", pairs: [{ front: "", back: "" }, { front: "", back: "" }] }),
        controls: [{ key: "memoria-titulo", label: "Titulo do jogo" }],
        fields: [
            { selector: "[data-memory-front]", label: "Frente" },
            { selector: "[data-memory-back]", label: "Verso" }
        ]
    },
    match: {
        itemSelector: "[data-match-pair]",
        itemLabel: "Par",
        emptyPayload: () => ({
            title: "Ligar pontos",
            left_label: "Coluna A",
            right_label: "Coluna B",
            shuffle_right: false,
            pairs: [{ left: "", right: "" }, { left: "", right: "" }]
        }),
        controls: [
            { key: "ligar-titulo", label: "Titulo do bloco" },
            { key: "ligar-coluna-a", label: "Nome da coluna A" },
            { key: "ligar-coluna-b", label: "Nome da coluna B" },
            {
                key: "ligar-cores",
                label: "Cores dos pares",
                kind: "select",
                options: [
                    { value: "manual", label: "Selecao manual" },
                    { value: "same", label: "Todos com a mesma cor" },
                    { value: "shuffle", label: "Embaralhar cores" }
                ]
            },
            { key: "ligar-cor-unica", label: "Cor unica", kind: "color" }
        ],
        fields: [
            { selector: "[data-match-left]", label: "Lado esquerdo" },
            { selector: "[data-match-right]", label: "Lado direito" }
        ]
    },
    wheel: {
        itemSelector: "[data-wheel-segment]",
        itemLabel: "Segmento",
        emptyPayload: () => ({ title: "Roleta", segments: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }] }),
        controls: [{ key: "roleta-titulo", label: "Titulo da roleta" }],
        fields: [{ selector: "[data-wheel-text]", label: "Texto do segmento", wide: true }]
    },
    wordsearch: {
        itemSelector: "[data-wordsearch-word]",
        itemLabel: "Termo",
        emptyPayload: () => ({
            title: "Caca-palavras",
            subtitle: "Encontre os termos principais do conteudo.",
            words: [{ term: "", clue: "" }, { term: "", clue: "" }, { term: "", clue: "" }, { term: "", clue: "" }]
        }),
        controls: [
            { key: "caca-titulo", label: "Titulo do bloco" },
            { key: "caca-subtitulo", label: "Subtitulo", kind: "textarea", wide: true }
        ],
        fields: [
            { selector: "[data-wordsearch-term]", label: "Palavra" },
            { selector: "[data-wordsearch-clue]", label: "Dica", wide: true }
        ]
    },
    mindmap: {
        itemSelector: "[data-mind-branch]",
        itemLabel: "Ramo",
        emptyPayload: () => ({
            title: "Mapa mental",
            subtitle: "",
            branches: [{ title: "", subtitle: "", detail: "" }, { title: "", subtitle: "", detail: "" }, { title: "", subtitle: "", detail: "" }]
        }),
        controls: [
            { key: "mapa-centro", label: "Tema central" },
            { key: "mapa-subtitulo", label: "Subtitulo", kind: "textarea", wide: true }
        ],
        fields: [
            { selector: "[data-mind-title]", label: "Titulo" },
            { selector: "[data-mind-subtitle]", label: "Subtitulo" },
            { selector: "[data-mind-detail]", label: "Detalhe", kind: "textarea", wide: true }
        ]
    },
    debate: {
        itemSelector: "[data-debate-step]",
        itemLabel: "Etapa",
        emptyPayload: () => ({
            title: "Debate guiado",
            question: "",
            side_a: "",
            side_b: "",
            steps: [{ title: "", time: "", question: "", guidance: "" }, { title: "", time: "", question: "", guidance: "" }]
        }),
        controls: [
            { key: "debate-titulo", label: "Titulo do debate" },
            { key: "debate-pergunta", label: "Pergunta central", kind: "textarea", wide: true },
            { key: "debate-lado-a", label: "Lado A" },
            { key: "debate-lado-b", label: "Lado B" }
        ],
        fields: [
            { selector: "[data-debate-title]", label: "Titulo da etapa" },
            { selector: "[data-debate-time]", label: "Tempo" },
            { selector: "[data-debate-question]", label: "Pergunta" },
            { selector: "[data-debate-guidance]", label: "Orientacao", kind: "textarea", wide: true }
        ]
    },
    crossword: {
        itemSelector: "[data-crossword-entry]",
        itemLabel: "Entrada",
        emptyPayload: () => ({
            title: "Palavras cruzadas",
            subtitle: "Complete a cruzadinha usando as pistas.",
            entries: [{ answer: "", clue: "" }, { answer: "", clue: "" }, { answer: "", clue: "" }, { answer: "", clue: "" }]
        }),
        controls: [
            { key: "cruzada-titulo", label: "Titulo do bloco" },
            { key: "cruzada-subtitulo", label: "Subtitulo", kind: "textarea", wide: true }
        ],
        fields: [
            { selector: "[data-crossword-answer]", label: "Resposta" },
            { selector: "[data-crossword-clue]", label: "Dica", wide: true }
        ]
    },
    hangman: {
        itemSelector: "[data-hangman-entry]",
        itemLabel: "Palavra",
        emptyPayload: () => ({
            title: "Jogo da Forca",
            subtitle: "Descubra as palavras usando as dicas.",
            max_errors: 6,
            entries: [{ answer: "", clue: "", category: "" }, { answer: "", clue: "", category: "" }]
        }),
        controls: [
            { key: "forca-titulo", label: "Titulo do bloco" },
            { key: "forca-subtitulo", label: "Subtitulo", kind: "textarea", wide: true },
            { key: "forca-tentativas", label: "Tentativas" }
        ],
        fields: [
            { selector: "[data-hangman-answer]", label: "Resposta" },
            { selector: "[data-hangman-clue]", label: "Dica" },
            { selector: "[data-hangman-category]", label: "Categoria" }
        ]
    }
};

let lessonSequenceState = {
    title: "",
    objective: "",
    duration: 0,
    blocks: []
};

let selectedBlockId = "";
let draggedLessonBlockId = "";
let dragHoverLessonBlockId = "";
let lessonSequenceGenerating = false;
let lessonSequencePointerDrag = null;
let openLessonEditorBlockIds = new Set();

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
}

function parseLessonDraftState(rawDraft) {
    try {
        const parsed = JSON.parse(String(rawDraft || ""));
        return {
            controls: parsed?.controls && typeof parsed.controls === "object" ? { ...parsed.controls } : {},
            stackHtml: typeof parsed?.stackHtml === "string" ? parsed.stackHtml : ""
        };
    } catch (error) {
        return {
            controls: {},
            stackHtml: ""
        };
    }
}

function inlineEditorConfig(materialType) {
    return INLINE_BLOCK_EDITOR_CONFIG[materialType || "slides"] || INLINE_BLOCK_EDITOR_CONFIG.slides;
}

function seedInlineDraftForBlock(block) {
    const config = inlineEditorConfig(block?.materialType || "slides");
    const draftState = parseLessonDraftState(block?.lessonDraft);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${draftState.stackHtml || ""}</div>`, "text/html");
    if (doc.querySelector(config.itemSelector)) return;

    block.lessonDraft = buildLessonDraftFromPayload(block?.materialType || "slides", config.emptyPayload());
}

function updateBlockDraftSnapshot(block, rawDraft) {
    if (!block) return;

    const previousTitle = block.lessonTitle || block.label || "";
    const summary = buildDraftSummary(block.materialType || "slides", rawDraft);
    block.lessonDraft = rawDraft;
    block.lessonTitle = summary.title || block.lessonTitle || materialGroupLabel(block.materialType || "slides");
    block.lessonSummary = summary.summary || block.lessonSummary || "Conteudo ainda em edicao.";
    if ((block.materialType || "slides") === "slides"
        && block.id
        && block.id === selectedBlockId
        && typeof writeCurrentDraftByType === "function") {
        writeCurrentDraftByType("slides", rawDraft);
    }
    if (isAutoNamedBlock(block, previousTitle)) {
        block.label = block.lessonTitle;
    }
}

function syncRenderedBlockCard(block) {
    if (!block) return;

    const lesson = effectiveLessonForBlock(block);
    const title = block.label || effectiveTitleForBlock(block, lesson);
    const summary = effectiveSummaryForBlock(block, lesson);
    const statusText = blockStatusText(block);
    const statusClass = blockStatusClass(block);

    document.querySelectorAll(`[data-lesson-block-title="${block.id}"]`).forEach((node) => {
        node.textContent = title;
    });

    document.querySelectorAll(`[data-lesson-block-summary="${block.id}"]`).forEach((node) => {
        node.textContent = summary;
    });

    document.querySelectorAll(`[data-lesson-block-status="${block.id}"]`).forEach((node) => {
        node.textContent = statusText;
        node.className = `lesson-sequence-status-chip ${statusClass}`;
    });
}

function refreshLessonSequencePanels(blockId = "") {
    const block = blockId ? lessonSequenceState.blocks.find((item) => item.id === blockId) : null;
    if (block) {
        syncRenderedBlockCard(block);
    }
    renderSequenceMeta();
    renderReadinessPanel();
    renderPreview();
}

function inlineFieldLabel(descriptor, node, index) {
    if (node?.dataset?.optionKey) return node.dataset.optionKey;
    if (descriptor.multiple) return `${descriptor.label} ${index + 1}`;
    return descriptor.label;
}

function renderInlineEditorControl(block, descriptor, value) {
    let fieldMarkup = "";

    if (descriptor.kind === "textarea") {
        fieldMarkup = `<textarea data-block-draft-control="${block.id}" data-draft-control-key="${descriptor.key}">${escapeHtml(value || "")}</textarea>`;
    } else if (descriptor.kind === "select") {
        const options = Array.isArray(descriptor.options) ? descriptor.options : [];
        fieldMarkup = `
            <select data-block-draft-control="${block.id}" data-draft-control-key="${descriptor.key}">
                ${options.map((option) => `
                    <option value="${escapeAttr(option.value || "")}" ${String(value || "") === String(option.value || "") ? "selected" : ""}>
                        ${escapeHtml(option.label || option.value || "")}
                    </option>
                `).join("")}
            </select>
        `;
    } else if (descriptor.kind === "color") {
        fieldMarkup = `<input type="color" value="${escapeAttr(value || "#22c55e")}" data-block-draft-control="${block.id}" data-draft-control-key="${descriptor.key}">`;
    } else {
        fieldMarkup = `<input type="text" value="${escapeAttr(value || "")}" data-block-draft-control="${block.id}" data-draft-control-key="${descriptor.key}">`;
    }

    return `
        <div class="platform-field ${descriptor.wide ? "platform-field-wide" : ""}">
            <label>${escapeHtml(descriptor.label)}</label>
            ${fieldMarkup}
        </div>
    `;
}

function renderInlineEditorField(block, config, itemIndex, descriptor, occurrenceIndex, value, label) {
    const inputMarkup = descriptor.kind === "textarea"
        ? `<textarea data-block-draft-field="${block.id}" data-draft-item-selector="${escapeAttr(config.itemSelector)}" data-draft-item-index="${itemIndex}" data-draft-field-selector="${escapeAttr(descriptor.selector)}" data-draft-field-occurrence="${occurrenceIndex}">${escapeHtml(value || "")}</textarea>`
        : descriptor.kind === "file"
            ? `<input type="file" ${descriptor.accept ? `accept="${escapeAttr(descriptor.accept)}"` : ""} data-block-draft-file="${block.id}" data-draft-item-selector="${escapeAttr(config.itemSelector)}" data-draft-item-index="${itemIndex}" data-draft-file-selector="${escapeAttr(descriptor.selector)}" data-draft-file-occurrence="${occurrenceIndex}" ${descriptor.modeSelector ? `data-draft-file-mode-selector="${escapeAttr(descriptor.modeSelector)}"` : ""}>`
            : `<input type="text" value="${escapeAttr(value || "")}" data-block-draft-field="${block.id}" data-draft-item-selector="${escapeAttr(config.itemSelector)}" data-draft-item-index="${itemIndex}" data-draft-field-selector="${escapeAttr(descriptor.selector)}" data-draft-field-occurrence="${occurrenceIndex}">`;

    return `
        <div class="platform-field ${descriptor.wide ? "platform-field-wide" : ""}">
            <label>${escapeHtml(label)}</label>
            ${inputMarkup}
        </div>
    `;
}

function renderInlineEditor(block) {
    const config = inlineEditorConfig(block.materialType || "slides");
    const draftState = parseLessonDraftState(effectiveDraftForBlock(block));
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${draftState.stackHtml || ""}</div>`, "text/html");
    const sections = [...doc.querySelectorAll(config.itemSelector)];
    const controlsMarkup = config.controls.length
        ? `
            <div class="lesson-sequence-inline-editor-grid">
                ${config.controls.map((descriptor) => renderInlineEditorControl(block, descriptor, draftState.controls?.[descriptor.key] || "")).join("")}
            </div>
        `
        : "";

    const itemsMarkup = sections.map((section, index) => `
        <article class="lesson-sequence-inline-editor-item">
            <div class="lesson-sequence-inline-editor-item-head">
                <strong>${escapeHtml(`${config.itemLabel} ${index + 1}`)}</strong>
            </div>
            <div class="lesson-sequence-inline-editor-grid">
                ${config.fields.map((descriptor) => {
                    const nodes = descriptor.multiple
                        ? [...section.querySelectorAll(descriptor.selector)]
                        : [section.querySelector(descriptor.selector)];

                    return nodes.map((node, occurrenceIndex) => renderInlineEditorField(
                        block,
                        config,
                        index,
                        descriptor,
                        occurrenceIndex,
                        node?.value?.trim?.() || "",
                        inlineFieldLabel(descriptor, node, occurrenceIndex)
                    )).join("");
                }).join("")}
            </div>
            ${(block.materialType || "slides") === "slides"
                ? `
                <div class="lesson-sequence-inline-actions">
                    <button type="button" class="platform-link-button platform-link-primary" data-apply-slide-image="${block.id}" data-apply-slide-index="${index}">
                        Aplicar imagem
                    </button>
                    <span class="lesson-sequence-inline-confirm" data-slide-image-confirm="${block.id}" data-slide-image-confirm-index="${index}" hidden>
                        Imagem aplicada
                    </span>
                </div>
                `
                : ""}
        </article>
    `).join("");

    return `
        <section class="lesson-sequence-inline-editor">
            <div class="lesson-sequence-inline-editor-copy">
                <div>
                    <span class="platform-section-label">Edicao rapida</span>
                    <h4>Editar este bloco sem sair da aula</h4>
                </div>
                <p>Essas alteracoes valem para este bloco dentro da aula pronta. O builder individual continua disponivel para ajustes avancados.</p>
            </div>
            ${controlsMarkup}
            <div class="lesson-sequence-inline-editor-list">
                ${itemsMarkup}
            </div>
        </section>
    `;
}

function updateBlockDraftControlField(blockId, controlKey, value) {
    const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
    if (!block) return;

    seedInlineDraftForBlock(block);
    const draftState = parseLessonDraftState(block.lessonDraft);
    draftState.controls[controlKey] = value;
    if ((block.materialType || "slides") === "match" && ["ligar-cores", "ligar-cor-unica"].includes(controlKey)) {
        applyMatchColorControl(draftState);
    }
    updateBlockDraftSnapshot(block, JSON.stringify(draftState));
    persistLessonSequence();
    refreshLessonSequencePanels(blockId);
}

function updateBlockDraftStackField(blockId, itemSelector, itemIndex, fieldSelector, occurrenceIndex, value) {
    const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
    if (!block) return;

    seedInlineDraftForBlock(block);
    const draftState = parseLessonDraftState(block.lessonDraft);
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${draftState.stackHtml || ""}</div>`, "text/html");
    const sections = [...doc.querySelectorAll(itemSelector)];
    const section = sections[itemIndex];
    if (!section) return;

    const nodes = [...section.querySelectorAll(fieldSelector)];
    let target = nodes[occurrenceIndex] || section.querySelector(fieldSelector);

    if (!target && (block.materialType || "slides") === "slides") {
        const selectorKey = String(fieldSelector || "");
        if (selectorKey.includes("slide-image-url")) {
            target = document.createElement("input");
            target.type = "text";
            target.setAttribute("data-field", "slide-image-url");
            section.appendChild(target);
        } else if (selectorKey.includes("slide-image-mode")) {
            target = document.createElement("input");
            target.type = "text";
            target.setAttribute("data-field", "slide-image-mode");
            section.appendChild(target);
        } else if (selectorKey.includes("slide-image-prompt")) {
            target = document.createElement("textarea");
            target.setAttribute("data-field", "slide-image-prompt");
            section.appendChild(target);
        }
    }
    if (!target) return;

    const safeValue = value ?? "";
    if (target.tagName === "TEXTAREA") {
        target.textContent = String(safeValue);
    } else if (target.tagName === "INPUT") {
        target.value = String(safeValue);
        target.setAttribute("value", String(safeValue));
    } else if ("value" in target) {
        target.value = String(safeValue);
    }

    if ((block.materialType || "slides") === "slides") {
        const selectorKey = String(fieldSelector || "");
        if (selectorKey.includes("slide-image-url") && String(safeValue || "").trim()) {
            const modeField = section.querySelector('[data-field="slide-image-mode"]');
            if (modeField) {
                modeField.value = "Upload";
                modeField.setAttribute("value", "Upload");
            }
        }
    }

    draftState.stackHtml = doc.body.firstElementChild?.innerHTML || "";
    updateBlockDraftSnapshot(block, JSON.stringify(draftState));
    persistLessonSequence();
    refreshLessonSequencePanels(blockId);
}

function blankActivityDraft() {
    return JSON.stringify({
        controls: {},
        stackHtml: ""
    });
}

function withLessonEditorContext(path) {
    const base = String(path || "").trim();
    if (!base) return "criar-aula.html?editor=lesson";
    return `${base}${base.includes("?") ? "&" : "?"}editor=lesson`;
}

function withLessonEditorFocus(path, focusKey = "edit") {
    const base = withLessonEditorContext(path);
    return `${base}${base.includes("?") ? "&" : "?"}focus=${encodeURIComponent(focusKey)}`;
}

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

function readEditingBlockMarker() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(LESSON_SEQUENCE_EDITING_BLOCK_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA lesson block marker unavailable:", error);
        return null;
    }
}

function writeEditingBlockMarker(payload) {
    try {
        localStorage.setItem(scopedStorageKey(LESSON_SEQUENCE_EDITING_BLOCK_KEY), JSON.stringify(payload));
    } catch (error) {
        console.warn("EducarIA lesson block marker unavailable:", error);
    }
}

function clearEditingBlockMarker() {
    try {
        localStorage.removeItem(scopedStorageKey(LESSON_SEQUENCE_EDITING_BLOCK_KEY));
    } catch (error) {
        console.warn("EducarIA lesson block marker unavailable:", error);
    }
}

function currentTurmaName() {
    return typeof currentClassName === "function" ? currentClassName() : "Turma";
}

function detectLessonScope(lesson) {
    if (!lesson) return "library";
    if (typeof normalizeLessonScope === "function") return normalizeLessonScope(lesson);
    return lesson.className ? "class" : "library";
}

function sourceLabel(source) {
    if (source === "class") return "Turma";
    if (source === "library") return "Biblioteca";
    return "Criar novo";
}

function buildDraftSummary(type, rawDraft) {
    if (!rawDraft) {
        return {
            title: materialGroupLabel(type || "slides"),
            summary: "Conteúdo ainda em edição.",
            type: materialGroupLabel(type || "slides"),
            materialType: type || "slides"
        };
    }

    if (type === "lesson" && typeof summarizeLessonSequenceDraft === "function") return summarizeLessonSequenceDraft(rawDraft);
    if (type === "flashcards" && typeof summarizeFlashcardsDraft === "function") return summarizeFlashcardsDraft(rawDraft);
    if (type === "quiz" && typeof summarizeQuizDraft === "function") return summarizeQuizDraft(rawDraft);
    if (type === "wheel" && typeof summarizeWheelDraft === "function") return summarizeWheelDraft(rawDraft);
    if (type === "hangman" && typeof summarizeHangmanDraft === "function") return summarizeHangmanDraft(rawDraft);
    if (type === "crossword" && typeof summarizeCrosswordDraft === "function") return summarizeCrosswordDraft(rawDraft);
    if (type === "wordsearch" && typeof summarizeWordsearchDraft === "function") return summarizeWordsearchDraft(rawDraft);
    if (type === "memory" && typeof summarizeMemoryDraft === "function") return summarizeMemoryDraft(rawDraft);
    if (type === "match" && typeof summarizeMatchDraft === "function") return summarizeMatchDraft(rawDraft);
    if (type === "mindmap" && typeof summarizeMindmapDraft === "function") return summarizeMindmapDraft(rawDraft);
    if (type === "debate" && typeof summarizeDebateDraft === "function") return summarizeDebateDraft(rawDraft);
    if (typeof summarizeSlidesDraft === "function") return summarizeSlidesDraft(rawDraft);

    return {
        title: materialGroupLabel(type || "slides"),
        summary: "Conteúdo ainda em edição.",
        type: materialGroupLabel(type || "slides"),
        materialType: type || "slides"
    };
}

function normalizeLessonSourceLines(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
}

function summarizeLessonSnippet(text, fallback = "", maxLength = 120) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return fallback;
    if (clean.length <= maxLength) return clean;
    return `${clean.slice(0, maxLength - 3).trim()}...`;
}

function lessonColorPalette() {
    return ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1"];
}

function hexToRgb(value) {
    const hex = String(value || "").replace("#", "").trim();
    if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b };
    }

    if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return { r, g, b };
    }

    return { r: 14, g: 165, b: 233 };
}

function sequenceAccentStyle(index) {
    const base = lessonColorPalette()[index % lessonColorPalette().length];
    const { r, g, b } = hexToRgb(base);
    return `--sequence-accent:${base};--sequence-accent-soft:rgba(${r}, ${g}, ${b}, 0.28);--sequence-accent-strong:rgba(${r}, ${g}, ${b}, 0.6);--sequence-accent-border:rgba(${r}, ${g}, ${b}, 0.68);`;
}

function normalizeWordsearchPayload(payload) {
    if (!payload || typeof payload !== "object") {
        return { title: "", subtitle: "", words: [] };
    }

    const rawWords = Array.isArray(payload.words)
        ? payload.words
        : Array.isArray(payload.entries)
            ? payload.entries
            : Array.isArray(payload.terms)
                ? payload.terms
                : [];

    const words = rawWords.map((entry) => {
        if (typeof entry === "string") {
            return { term: entry, clue: "" };
        }

        return {
            term: entry?.term || entry?.word || entry?.answer || "",
            clue: entry?.clue || entry?.hint || ""
        };
    }).filter((entry) => String(entry.term || "").trim().length > 0);

    return {
        ...payload,
        words
    };
}

function normalizeCrosswordPayload(payload) {
    if (!payload || typeof payload !== "object") {
        return { title: "", subtitle: "", entries: [] };
    }

    const rawEntries = Array.isArray(payload.entries)
        ? payload.entries
        : Array.isArray(payload.words)
            ? payload.words
            : Array.isArray(payload.items)
                ? payload.items
                : [];

    const entries = rawEntries.map((entry) => {
        if (typeof entry === "string") {
            return { answer: entry, clue: "" };
        }

        return {
            answer: entry?.answer || entry?.term || entry?.word || "",
            clue: entry?.clue || entry?.hint || ""
        };
    }).filter((entry) => String(entry.answer || "").trim().length > 0);

    return {
        ...payload,
        entries
    };
}

function matchPaletteColor(index) {
    const palette = lessonColorPalette();
    return palette[(index * 5 + 2) % palette.length];
}

function applyMatchColorControl(draftState) {
    if (!draftState?.stackHtml) return;

    const mode = draftState.controls?.["ligar-cores"] || "manual";
    if (mode === "manual") return;

    const singleColor = draftState.controls?.["ligar-cor-unica"] || lessonColorPalette()[0];
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${draftState.stackHtml || ""}</div>`, "text/html");
    const inputs = [...doc.querySelectorAll("[data-match-color]")];

    inputs.forEach((input, index) => {
        if (mode === "same") {
            input.value = singleColor;
            return;
        }

        if (mode === "shuffle") {
            input.value = matchPaletteColor(index);
        }
    });

    draftState.stackHtml = doc.body.firstElementChild?.innerHTML || "";
}

function resolveLessonAiEndpoint() {
    if (window.EDUCARIA_AI_ENDPOINT) {
        return window.EDUCARIA_AI_ENDPOINT;
    }

    const hostname = window.location.hostname || "";
    const isLocal = window.location.protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1";
    return isLocal
        ? "http://localhost:8787/api/ai/generate"
        : "/api/ai/generate";
}

async function requestLessonAiMaterial(materialType, sourceText, action) {
    const endpoint = resolveLessonAiEndpoint();
    const formData = new FormData();
    formData.append("materialType", materialType);
    formData.append("sourceText", sourceText || "");
    formData.append("text", sourceText || "");
    if (action) {
        formData.append("action", action);
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: typeof window.educariaAiAuthHeaders === "function" ? await window.educariaAiAuthHeaders() : {},
        body: formData
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        if (errorPayload?.credits) {
            document.dispatchEvent(new CustomEvent("educaria-ai-credits-updated", {
                detail: { credits: errorPayload.credits }
            }));
        }
        throw new Error(errorPayload?.error || "Não foi possível gerar o material.");
    }

    const payload = await response.json().catch(() => ({}));
    if (payload?.credits) {
        document.dispatchEvent(new CustomEvent("educaria-ai-credits-updated", {
            detail: { credits: payload.credits }
        }));
    }
    return payload?.material || payload || null;
}

function lessonGenerationHint(block, index, sourceText) {
    const order = index + 1;
    const objective = lessonSequenceState.objective ? `Objetivo da aula: ${lessonSequenceState.objective}.` : "";
    const source = sourceText ? `Baseie-se no conteúdo enviado pelo professor.` : "";
    return [
        `Este é o bloco ${order} da aula completa.`,
        `Tipo da atividade: ${materialGroupLabel(block.materialType || "slides")}.`,
        `Nome do bloco: ${block.label || materialGroupLabel(block.materialType || "slides")}.`,
        objective,
        source,
        "Estruture o material para uso direto em sala, com linguagem clara e progressão didática."
    ].filter(Boolean).join(" ");
}

function selectedLessonSequenceContext() {
    const blocks = Array.isArray(lessonSequenceState.blocks) ? lessonSequenceState.blocks : [];
    if (!blocks.length) return "";

    return blocks.map((block, index) => {
        const typeLabel = materialGroupLabel(block.materialType || "slides");
        const title = block.label || block.lessonTitle || typeLabel;
        return `${index + 1}. ${typeLabel}: ${title}`;
    }).join(" | ");
}

function blockSpecificGenerationHint(materialType) {
    if (materialType === "slides") return "Crie slides com abertura, desenvolvimento e fechamento.";
    if (materialType === "flashcards") return "Crie flashcards curtos e claros para revisao rapida.";
    if (materialType === "quiz") return "Crie um quiz de verificacao alinhado ao que veio antes.";
    if (materialType === "memory") return "Crie pares simples e pedagogicos para associacao.";
    if (materialType === "match") return "Crie pares de ligacao claros entre conceito e correspondente.";
    if (materialType === "wheel") return "Crie itens curtos e variados para sorteio em sala.";
    if (materialType === "wordsearch") return "Crie termos curtos e pistas objetivas para caca-palavras.";
    if (materialType === "mindmap") return "Crie topicos organizados com boa hierarquia visual.";
    if (materialType === "debate") return "Crie etapas de debate com pergunta orientadora e mediacao.";
    if (materialType === "crossword") return "Crie entradas curtas com pistas diretas e didaticas.";
    return "Crie um material claro, direto e pronto para uso em sala.";
}

function fallbackSlidesPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const title = lines[0] || blockLabel || "Aula";
    const units = (lines.length > 1 ? lines : [
        "Introdução ao tema",
        "Conceitos centrais",
        "Aplicação prática",
        "Fechamento e revisão"
    ]).slice(0, 5);

    return {
        title,
        slides: units.map((item, index) => ({
            type: index === 0 ? "cover" : "content",
            title: index === 0 ? summarizeLessonSnippet(title, "Aula", 40) : `Ponto ${index}`,
            subtitle: index === 0 ? "Visão geral da aula" : "",
            body: index === 0 ? summarizeLessonSnippet(item, "Panorama inicial", 100) : `- ${summarizeLessonSnippet(item, "Conteúdo principal", 80)}`,
            image_prompt: index === 0 ? `Ilustração educativa sobre ${summarizeLessonSnippet(title, "o tema", 60)}` : ""
        }))
    };
}

function fallbackQuizPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const title = blockLabel || "Quiz";
    const questions = (lines.length ? lines : ["Qual é a ideia principal do conteúdo?", "Que exemplo ajuda a explicar o tema?", "Como aplicar o conceito em sala?"])
        .slice(0, 5)
        .map((line, index) => ({
            type: "multiple_choice",
            prompt: `${summarizeLessonSnippet(line, `Questão ${index + 1}`, 90)}?`,
            options: [
                `Síntese correta do ponto ${index + 1}`,
                `Interpretação alternativa ${index + 1}`,
                `Exemplo relacionado ${index + 1}`,
                `Conclusão possível ${index + 1}`
            ],
            correct_index: 0,
            explanation: "Revise a explicação antes de aplicar em sala."
        }));

    return { title, questions };
}

function fallbackFlashcardsPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    return {
        title: blockLabel || "Flashcards",
        cards: (lines.length ? lines : ["Conceito principal - Definição curta", "Termo importante - Explicação objetiva", "Exemplo - Aplicação prática"])
            .slice(0, 6)
            .map((line, index) => {
                const parts = line.split(/\s*[-:]\s*/).filter(Boolean);
                return {
                    front: summarizeLessonSnippet(parts[0] || `Card ${index + 1}`, `Card ${index + 1}`, 48),
                    back: summarizeLessonSnippet(parts.slice(1).join(" - ") || line, "Definição", 100),
                    example: ""
                };
            })
    };
}

function fallbackMemoryPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const palette = lessonColorPalette();
    return {
        title: blockLabel || "Jogo da memória",
        pairs: (lines.length ? lines : ["Conceito - Definição", "Autor - Obra", "Tema - Exemplo"])
            .slice(0, 6)
            .map((line, index) => {
                const parts = line.split(/\s*[-:]\s*/).filter(Boolean);
                return {
                    front: summarizeLessonSnippet(parts[0] || `Par ${index + 1}`, `Par ${index + 1}`, 40),
                    back: summarizeLessonSnippet(parts.slice(1).join(" - ") || line, "Resposta", 60),
                    color: palette[index % palette.length]
                };
            })
    };
}

function fallbackMatchPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const palette = lessonColorPalette();
    return {
        title: blockLabel || "Ligar pontos",
        left_label: "Coluna A",
        right_label: "Coluna B",
        shuffle_right: true,
        pairs: (lines.length ? lines : ["Conceito - Definição", "País - Capital", "Pergunta - Resposta"])
            .slice(0, 6)
            .map((line, index) => {
                const parts = line.split(/\s*[-:]\s*/).filter(Boolean);
                return {
                    left: summarizeLessonSnippet(parts[0] || `Item ${index + 1}`, `Item ${index + 1}`, 42),
                    right: summarizeLessonSnippet(parts.slice(1).join(" - ") || line, `Resposta ${index + 1}`, 60),
                    color: palette[index % palette.length]
                };
            })
    };
}

function fallbackWheelPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const palette = lessonColorPalette();
    return {
        title: blockLabel || "Roleta",
        eliminate_used: false,
        segments: (lines.length ? lines : ["Pergunta rápida", "Desafio", "Exemplo", "Revisão", "Curiosidade", "Síntese"])
            .slice(0, 8)
            .map((line, index) => ({
                text: summarizeLessonSnippet(line, `Espaço ${index + 1}`, 36),
                color: palette[index % palette.length]
            }))
    };
}

function fallbackWordsearchPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const words = (lines.length ? lines : ["Tema", "Conceito", "Exemplo", "Aula", "Termo", "Conteúdo"])
        .slice(0, 10)
        .map((line) => ({
            term: summarizeLessonSnippet(line.split(/\s*[-:]\s*/)[0] || line, "Palavra", 18).replace(/\s+/g, ""),
            clue: summarizeLessonSnippet(line, "", 60)
        }))
        .filter((entry) => entry.term);

    return {
        title: blockLabel || "Caça-palavras",
        subtitle: "Encontre os termos principais do conteúdo.",
        words: words.length >= 2 ? words : [
            { term: "TEMA", clue: "Palavra principal" },
            { term: "AULA", clue: "Contexto da atividade" }
        ]
    };
}

function fallbackMindmapPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const palette = lessonColorPalette();
    return {
        title: blockLabel || lines[0] || "Mapa mental",
        subtitle: "Panorama dos conceitos principais",
        branches: (lines.length ? lines : ["Contexto", "Ideia central", "Exemplo", "Aplicação", "Síntese"])
            .slice(0, 6)
            .map((line, index) => ({
                title: summarizeLessonSnippet(line, `Tópico ${index + 1}`, 32),
                subtitle: `Ideia-chave ${index + 1}`,
                detail: summarizeLessonSnippet(line, "Explique o ponto principal.", 120),
                color: palette[index % palette.length]
            }))
    };
}

function fallbackDebatePayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const centralQuestion = lines.find((line) => line.includes("?")) || "Como analisar o tema por perspectivas diferentes?";
    return {
        title: blockLabel || "Debate guiado",
        question: centralQuestion,
        format: "Dois lados",
        side_a: "Posição A",
        side_b: "Posição B",
        steps: [
            { title: "Aquecimento", time: "5 min", question: centralQuestion, guidance: "Ative conhecimentos prévios e organize ideias iniciais." },
            { title: "Argumentação", time: "8 min", question: "Quais argumentos sustentam cada lado?", guidance: "Peça justificativas, exemplos e escuta ativa." },
            { title: "Fechamento", time: "5 min", question: "Que síntese podemos construir?", guidance: "Retome os pontos centrais e as conclusões da turma." }
        ]
    };
}

function fallbackCrosswordPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const entries = (lines.length ? lines : ["Tema - Palavra principal do conteúdo", "Exemplo - Situação que explica a aula", "Síntese - Fechamento do estudo"])
        .slice(0, 8)
        .map((line, index) => {
            const parts = line.split(/\s*[-:]\s*/).filter(Boolean);
            return {
                answer: summarizeLessonSnippet(parts[0] || `Tema${index + 1}`, `Tema${index + 1}`, 18).replace(/\s+/g, ""),
                clue: summarizeLessonSnippet(parts.slice(1).join(" - ") || line, `Pista ${index + 1}`, 80)
            };
        })
        .filter((entry) => entry.answer.length >= 2);

    return {
        title: blockLabel || "Palavras cruzadas",
        subtitle: "Complete a cruzadinha com base no tema estudado.",
        entries: entries.length >= 2 ? entries : [
            { answer: "TEMA", clue: "Palavra principal do conteúdo" },
            { answer: "AULA", clue: "Contexto do estudo" }
        ]
    };
}

function fallbackHangmanPayload(sourceText, blockLabel) {
    const lines = normalizeLessonSourceLines(sourceText);
    const entries = (lines.length ? lines : ["Planeta - Corpo celeste - Astronomia", "Mapa - Representação visual - Geografia", "Frase - Conjunto de palavras - Língua portuguesa"])
        .slice(0, 5)
        .map((line, index) => {
            const parts = line.split(/\s*[-:]\s*/).filter(Boolean);
            return {
                answer: summarizeLessonSnippet(parts[0] || `Palavra ${index + 1}`, `Palavra ${index + 1}`, 18).toUpperCase(),
                clue: summarizeLessonSnippet(parts[1] || line, `Dica ${index + 1}`, 72),
                category: summarizeLessonSnippet(parts[2] || "Tema da aula", "Tema da aula", 32)
            };
        })
        .filter((entry) => entry.answer.length >= 2);

    return {
        title: blockLabel || "Jogo da Forca",
        subtitle: "Descubra as palavras usando as dicas.",
        max_errors: 6,
        entries: entries.length ? entries : [
            { answer: "TEMA", clue: "Palavra principal", category: "Aula" }
        ]
    };
}

function fallbackPayloadForType(materialType, sourceText, blockLabel) {
    if (materialType === "slides") return fallbackSlidesPayload(sourceText, blockLabel);
    if (materialType === "quiz") return fallbackQuizPayload(sourceText, blockLabel);
    if (materialType === "flashcards") return fallbackFlashcardsPayload(sourceText, blockLabel);
    if (materialType === "memory") return fallbackMemoryPayload(sourceText, blockLabel);
    if (materialType === "match") return fallbackMatchPayload(sourceText, blockLabel);
    if (materialType === "wheel") return fallbackWheelPayload(sourceText, blockLabel);
    if (materialType === "wordsearch") return fallbackWordsearchPayload(sourceText, blockLabel);
    if (materialType === "mindmap") return fallbackMindmapPayload(sourceText, blockLabel);
    if (materialType === "debate") return fallbackDebatePayload(sourceText, blockLabel);
    if (materialType === "crossword") return fallbackCrosswordPayload(sourceText, blockLabel);
    return fallbackHangmanPayload(sourceText, blockLabel);
}

function lessonAiSupported(materialType) {
    return ["slides", "quiz", "flashcards", "memory", "match", "wheel", "wordsearch", "mindmap", "debate", "crossword"].includes(materialType);
}

function controlStateForDraft(materialType, payload) {
    if (materialType === "flashcards") {
        return { "cards-tema": payload.title || "Flashcards" };
    }
    if (materialType === "quiz") {
        return { "quiz-tema": payload.title || "Quiz" };
    }
    if (materialType === "memory") {
        return { "memoria-titulo": payload.title || "Jogo da memória" };
    }
    if (materialType === "match") {
        const pairColors = (Array.isArray(payload.pairs) ? payload.pairs : [])
            .map((pair) => pair?.color)
            .filter(Boolean);
        const firstColor = pairColors[0] || lessonColorPalette()[0];
        const allSame = pairColors.length > 0 && pairColors.every((color) => color === firstColor);
        return {
            "ligar-titulo": payload.title || "Ligar pontos",
            "ligar-coluna-a": payload.left_label || "Coluna A",
            "ligar-coluna-b": payload.right_label || "Coluna B",
            "ligar-embaralhar": payload.shuffle_right ? "Sim" : "Nao",
            "ligar-cores": allSame ? "same" : "manual",
            "ligar-cor-unica": firstColor
        };
    }
    if (materialType === "wheel") {
        return {
            "roleta-titulo": payload.title || "Roleta",
            "roleta-eliminacao": payload.eliminate_used ? "Sim" : "Nao"
        };
    }
    if (materialType === "wordsearch") {
        const normalized = normalizeWordsearchPayload(payload);
        return {
            "caca-titulo": normalized.title || "Caça-palavras",
            "caca-subtitulo": normalized.subtitle || "Encontre os termos principais do conteúdo."
        };
    }
    if (materialType === "mindmap") {
        return {
            "mapa-centro": payload.title || "Mapa mental",
            "mapa-subtitulo": payload.subtitle || ""
        };
    }
    if (materialType === "debate") {
        return {
            "debate-titulo": payload.title || "Debate guiado",
            "debate-pergunta": payload.question || "",
            "debate-formato": payload.format || "Dois lados",
            "debate-lado-a": payload.side_a || "",
            "debate-lado-b": payload.side_b || ""
        };
    }
    if (materialType === "crossword") {
        const normalized = normalizeCrosswordPayload(payload);
        return {
            "cruzada-titulo": normalized.title || "Palavras cruzadas",
            "cruzada-subtitulo": normalized.subtitle || "Complete a cruzadinha usando as pistas.",
            "cruzada-grade": "11"
        };
    }
    if (materialType === "hangman") {
        return {
            "forca-titulo": payload.title || "Jogo da Forca",
            "forca-subtitulo": payload.subtitle || "Descubra as palavras usando as dicas.",
            "forca-tentativas": String(payload.max_errors || 6)
        };
    }
    return {};
}

function buildDraftStackHtml(materialType, payload) {
    const colors = lessonColorPalette();

    if (materialType === "slides") {
        return (Array.isArray(payload.slides) ? payload.slides : []).map((slide, index) => `
            <section data-slide-card>
                <input data-field="slide-title" type="text" value="${escapeAttr(slide.title || `Slide ${index + 1}`)}">
                <input data-field="slide-subtitle" type="text" value="${escapeAttr(slide.subtitle || "")}">
                <textarea data-field="slide-body">${escapeHtml(slide.body || "")}</textarea>
                <input data-field="slide-layout" type="text" value="Lado a lado">
                <input data-field="slide-image-mode" type="text" value="${escapeAttr(slide.image_prompt || slide.imagePrompt ? "Gerar com IA" : (slide.image_url || slide.imageUrl ? "Upload" : "Sem imagem"))}">
                <textarea data-field="slide-image-prompt">${escapeHtml(slide.image_prompt || slide.imagePrompt || "")}</textarea>
                <input data-field="slide-image-url" type="text" value="${escapeAttr(slide.image_url || slide.imageUrl || "")}">
                <input data-field="slide-accent-color" type="color" value="#0ea5e9">
                <input data-field="slide-color" type="color" value="#d7f5f6">
                <input data-field="slide-text-color" type="color" value="#0f172a">
            </section>
        `).join("");
    }

    if (materialType === "quiz") {
        return (Array.isArray(payload.questions) ? payload.questions : []).map((question, index) => `
            <section data-quiz-question>
                <input data-field="type" type="text" value="${escapeAttr(question.type === "short_answer" ? "Resposta curta" : question.type === "true_false" ? "Verdadeiro ou falso" : "Multipla escolha")}">
                <input data-field="prompt" type="text" value="${escapeAttr(question.prompt || `Questão ${index + 1}`)}">
                ${(Array.isArray(question.options) ? question.options : []).map((option, optionIndex) => `
                    <input data-option data-option-key="Alternativa ${String.fromCharCode(65 + optionIndex)}" value="${escapeAttr(option.value || option)}">
                `).join("")}
                <input data-field="correct" type="text" value="${escapeAttr(`Alternativa ${String.fromCharCode(65 + Number(question.correct_index || 0))}`)}">
                <textarea data-field="explanation">${escapeHtml(question.explanation || "")}</textarea>
                <textarea data-field="criteria">${escapeHtml(question.criteria || "")}</textarea>
                <textarea data-field="model">${escapeHtml(question.model_answer || "")}</textarea>
            </section>
        `).join("");
    }

    if (materialType === "flashcards") {
        return (Array.isArray(payload.cards) ? payload.cards : []).map((card) => `
            <section data-flashcard>
                <input data-field="front" type="text" value="${escapeAttr(card.front || "")}">
                <input data-field="back" type="text" value="${escapeAttr(card.back || "")}">
                <input data-field="example" type="text" value="${escapeAttr(card.example || "")}">
                <input data-field="front-color" type="color" value="#ffffff">
                <input data-field="back-color" type="color" value="#dbeafe">
                <input data-field="text-color" type="color" value="#0f172a">
            </section>
        `).join("");
    }

    if (materialType === "memory") {
        return (Array.isArray(payload.pairs) ? payload.pairs : []).map((pair, index) => `
            <section data-memory-pair>
                <input data-memory-front type="text" value="${escapeAttr(pair.front || "")}">
                <input data-memory-back type="text" value="${escapeAttr(pair.back || "")}">
                <input data-memory-color type="color" value="${escapeAttr(pair.color || colors[index % colors.length])}">
            </section>
        `).join("");
    }

    if (materialType === "match") {
        return (Array.isArray(payload.pairs) ? payload.pairs : []).map((pair, index) => `
            <section data-match-pair>
                <input data-match-left type="text" value="${escapeAttr(pair.left || "")}">
                <input data-match-right type="text" value="${escapeAttr(pair.right || "")}">
                <input data-match-color type="color" value="${escapeAttr(pair.color || colors[index % colors.length])}">
            </section>
        `).join("");
    }

    if (materialType === "wheel") {
        return (Array.isArray(payload.segments) ? payload.segments : []).map((segment, index) => `
            <section data-wheel-segment>
                <input data-wheel-text type="text" value="${escapeAttr(segment.text || "")}">
                <input data-wheel-color type="color" value="${escapeAttr(segment.color || colors[index % colors.length])}">
            </section>
        `).join("");
    }

    if (materialType === "wordsearch") {
        const normalized = normalizeWordsearchPayload(payload);
        return (Array.isArray(normalized.words) ? normalized.words : []).map((word) => `
            <section data-wordsearch-word>
                <input data-wordsearch-term data-field="term" type="text" value="${escapeAttr(word.term || "")}">
                <input data-wordsearch-clue data-field="clue" type="text" value="${escapeAttr(word.clue || "")}">
            </section>
        `).join("");
    }

    if (materialType === "mindmap") {
        return (Array.isArray(payload.branches) ? payload.branches : []).map((branch, index) => `
            <section data-mind-branch>
                <input data-mind-title type="text" value="${escapeAttr(branch.title || "")}">
                <input data-mind-subtitle type="text" value="${escapeAttr(branch.subtitle || "")}">
                <textarea data-mind-detail>${escapeHtml(branch.detail || "")}</textarea>
                <input data-mind-color type="color" value="${escapeAttr(branch.color || colors[index % colors.length])}">
            </section>
        `).join("");
    }

    if (materialType === "debate") {
        return (Array.isArray(payload.steps) ? payload.steps : []).map((step) => `
            <section data-debate-step>
                <input data-debate-title type="text" value="${escapeAttr(step.title || "")}">
                <input data-debate-time type="text" value="${escapeAttr(step.time || "")}">
                <input data-debate-question type="text" value="${escapeAttr(step.question || "")}">
                <textarea data-debate-guidance>${escapeHtml(step.guidance || "")}</textarea>
            </section>
        `).join("");
    }

    if (materialType === "crossword") {
        const normalized = normalizeCrosswordPayload(payload);
        return (Array.isArray(normalized.entries) ? normalized.entries : []).map((entry) => `
            <section data-crossword-entry>
                <input data-crossword-answer data-field="answer" type="text" value="${escapeAttr(entry.answer || "")}">
                <input data-crossword-clue data-field="clue" type="text" value="${escapeAttr(entry.clue || "")}">
            </section>
        `).join("");
    }

    return (Array.isArray(payload.entries) ? payload.entries : []).map((entry) => `
        <section data-hangman-entry>
            <input data-hangman-answer data-field="answer" type="text" value="${escapeAttr(entry.answer || "")}">
            <input data-hangman-clue data-field="clue" type="text" value="${escapeAttr(entry.clue || "")}">
            <input data-hangman-category data-field="category" type="text" value="${escapeAttr(entry.category || "")}">
        </section>
    `).join("");
}

function buildLessonDraftFromPayload(materialType, payload) {
    return JSON.stringify({
        controls: controlStateForDraft(materialType, payload || {}),
        stackHtml: buildDraftStackHtml(materialType, payload || {})
    });
}

function payloadHasContent(materialType, payload) {
    if (!payload || typeof payload !== "object") return false;
    if (materialType === "slides") return Array.isArray(payload.slides) && payload.slides.length > 0;
    if (materialType === "quiz") return Array.isArray(payload.questions) && payload.questions.length > 0;
    if (materialType === "flashcards") return Array.isArray(payload.cards) && payload.cards.length > 0;
    if (materialType === "memory" || materialType === "match") return Array.isArray(payload.pairs) && payload.pairs.length > 0;
    if (materialType === "wheel") return Array.isArray(payload.segments) && payload.segments.length > 0;
    if (materialType === "wordsearch") return normalizeWordsearchPayload(payload).words.length > 1;
    if (materialType === "mindmap") return Array.isArray(payload.branches) && payload.branches.length > 0;
    if (materialType === "debate") return Array.isArray(payload.steps) && payload.steps.length > 0;
    if (materialType === "crossword") return normalizeCrosswordPayload(payload).entries.length > 1;
    return Array.isArray(payload.entries) && payload.entries.length > 0;
}

async function generatePayloadForBlock(block, index, sourceText) {
    const materialType = block.materialType || "slides";
    const blockLabel = block.label || materialGroupLabel(materialType);
    const sequenceContext = selectedLessonSequenceContext();
    const generationInstructions = [
        lessonGenerationHint(block, index, sourceText),
        sequenceContext ? `Sequencia atual da aula: ${sequenceContext}.` : "",
        blockSpecificGenerationHint(materialType)
    ].filter(Boolean).join(" ");

    if (!lessonAiSupported(materialType)) {
        return {
            payload: fallbackPayloadForType(materialType, sourceText, blockLabel),
            usedFallback: true
        };
    }

    try {
        const payload = await requestLessonAiMaterial(materialType, sourceText, generationInstructions);
        if (!payloadHasContent(materialType, payload)) {
            throw new Error("IA sem payload");
        }
        return { payload, usedFallback: false };
    } catch (error) {
        return {
            payload: fallbackPayloadForType(materialType, sourceText, blockLabel),
            usedFallback: true
        };
    }
}

function readAllActivityLessons() {
    return readLessonsLibrary().filter((lesson) => (lesson.materialType || "slides") !== "lesson");
}

function classLessonsForSequence() {
    const turma = currentTurmaName();
    return readAllActivityLessons().filter((lesson) => detectLessonScope(lesson) === "class" && lesson.className === turma);
}

function libraryLessonsForSequence() {
    return readAllActivityLessons().filter((lesson) => detectLessonScope(lesson) === "library");
}

function lessonsForSource(type, source) {
    const base = source === "library" ? libraryLessonsForSequence() : classLessonsForSequence();
    return base.filter((lesson) => (lesson.materialType || "slides") === type);
}

function lessonCountsForType(type) {
    return {
        classCount: lessonsForSource(type, "class").length,
        libraryCount: lessonsForSource(type, "library").length
    };
}

function findLessonById(id) {
    return readLessonsLibrary().find((lesson) => lesson.id === id) || null;
}

function buildDefaultLessonSequenceState() {
    const turma = currentTurmaName() || "Turma";
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
        duration: Number(rawState.duration || base.duration),
        blocks: Array.isArray(rawState.blocks)
            ? rawState.blocks.map((block) => ({
                id: block.id || `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                lessonRefId: block.lessonRefId || "",
                materialType: block.materialType || "slides",
                sourceScope: ["class", "library", "new"].includes(block.sourceScope) ? block.sourceScope : (block.lessonRefId ? "class" : "new"),
                label: block.label || materialGroupLabel(block.materialType || "slides"),
                duration: Math.max(1, Number(block.duration || 8)),
                note: block.note || "",
                lessonTitle: block.lessonTitle || "",
                lessonSummary: block.lessonSummary || "",
                lessonDraft: typeof block.lessonDraft === "string" ? block.lessonDraft : ""
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
    if (duration) duration.value = lessonSequenceState.duration || buildDefaultLessonSequenceState().duration;
}

function syncStateFromFields() {
    lessonSequenceState.title = document.getElementById("lesson-title")?.value?.trim() || buildDefaultLessonSequenceState().title;
    lessonSequenceState.objective = document.getElementById("lesson-objective")?.value?.trim() || "";
    lessonSequenceState.duration = Math.max(1, Number(document.getElementById("lesson-duration")?.value || lessonSequenceState.duration || buildDefaultLessonSequenceState().duration));
}

function totalBlocksDuration() {
    return lessonSequenceState.blocks.reduce((total, block) => total + Math.max(1, Number(block.duration || 0)), 0);
}

function effectiveLessonForBlock(block) {
    return block?.lessonRefId ? findLessonById(block.lessonRefId) : null;
}

function effectiveSourceForBlock(block, lesson = effectiveLessonForBlock(block)) {
    return lesson ? detectLessonScope(lesson) : (block?.sourceScope || "new");
}

function effectiveTitleForBlock(block, lesson = effectiveLessonForBlock(block)) {
    return block?.lessonTitle || lesson?.title || block?.label || materialGroupLabel(block?.materialType || "slides");
}

function effectiveSummaryForBlock(block, lesson = effectiveLessonForBlock(block)) {
    if (block?.lessonSummary) return block.lessonSummary;
    if (lesson?.summary) return lesson.summary;
    if (effectiveSourceForBlock(block, lesson) === "new") {
        return "Conteúdo novo. Abra o builder para montar esse bloco com o material que quiser.";
    }
    return "Escolha um conteúdo para esse bloco.";
}

function effectiveDraftForBlock(block, lesson = effectiveLessonForBlock(block)) {
    if (block?.lessonDraft) return block.lessonDraft;
    if (lesson?.draft) return lesson.draft;
    return effectiveSourceForBlock(block, lesson) === "new" ? blankActivityDraft() : "";
}

function isAutoNamedBlock(block, previousTitle = "") {
    const currentLabel = String(block?.label || "").trim().toLowerCase();
    const candidates = [
        materialGroupLabel(block?.materialType || "slides"),
        `Novo ${materialGroupLabel(block?.materialType || "slides")}`,
        block?.lessonTitle || "",
        previousTitle || ""
    ]
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean);

    return !currentLabel || candidates.includes(currentLabel);
}

function syncBlockFromLesson(block) {
    const lesson = effectiveLessonForBlock(block);
    if (!lesson) return block;

    block.sourceScope = detectLessonScope(lesson);
    if (!block.lessonTitle) block.lessonTitle = lesson.title || block.lessonTitle;
    if (!block.lessonSummary) block.lessonSummary = lesson.summary || block.lessonSummary;
    if (!block.lessonDraft) block.lessonDraft = lesson.draft || block.lessonDraft;
    return block;
}

function syncBlocksWithSavedMaterials() {
    lessonSequenceState.blocks.forEach(syncBlockFromLesson);
}

function blockReady(block) {
    if (!block) return false;
    const lesson = effectiveLessonForBlock(block);
    if (lesson) return true;
    if (effectiveSourceForBlock(block, lesson) === "new") return true;
    return Boolean(block.lessonDraft);
}

function blockStatusText(block) {
    const source = effectiveSourceForBlock(block);
    if (source === "new") return "Novo";
    return blockReady(block) ? "Pronto" : "Falta conteúdo";
}

function blockStatusClass(block) {
    const source = effectiveSourceForBlock(block);
    if (source === "new") return "is-new";
    return blockReady(block) ? "is-ready" : "is-pending";
}

function preferredSourceForType(type) {
    const classMatches = lessonsForSource(type, "class");
    if (classMatches.length) return "class";
    const libraryMatches = lessonsForSource(type, "library");
    if (libraryMatches.length) return "library";
    return "new";
}

function buildBaseBlock(type) {
    return {
        id: `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        lessonRefId: "",
        materialType: type,
        sourceScope: "new",
        label: materialGroupLabel(type),
        duration: 8,
        note: "",
        lessonTitle: "",
        lessonSummary: "",
        lessonDraft: ""
    };
}

function applyLessonToBlock(block, lesson, sourceScope) {
    if (!block || !lesson) return block;

    const previousTitle = block.lessonTitle || block.label || "";
    block.lessonRefId = lesson.id;
    block.materialType = lesson.materialType || block.materialType || "slides";
    block.sourceScope = sourceScope;
    block.lessonTitle = lesson.title || materialGroupLabel(block.materialType);
    block.lessonSummary = lesson.summary || "Material salvo sem resumo definido.";
    block.lessonDraft = lesson.draft || "";

    if (isAutoNamedBlock(block, previousTitle)) {
        block.label = block.lessonTitle;
    }

    return block;
}

function applyNewSourceToBlock(block) {
    if (!block) return block;

    const previousTitle = block.lessonTitle || block.label || "";
    block.lessonRefId = "";
    block.sourceScope = "new";
    block.lessonTitle = `Novo ${materialGroupLabel(block.materialType || "slides")}`;
    block.lessonSummary = "Conteúdo novo. Abra o builder para montar esse bloco com o material que quiser.";
    block.lessonDraft = blankActivityDraft();

    if (isAutoNamedBlock(block, previousTitle)) {
        block.label = materialGroupLabel(block.materialType || "slides");
    }

    return block;
}

function clearBlockSelection(block, sourceScope) {
    if (!block) return block;
    block.lessonRefId = "";
    block.sourceScope = sourceScope;
    block.lessonTitle = "";
    block.lessonSummary = "";
    block.lessonDraft = "";
    return block;
}

function buildBlockForType(type) {
    const block = buildBaseBlock(type);
    const source = preferredSourceForType(type);
    if (source === "new") {
        return applyNewSourceToBlock(block);
    }

    const lesson = lessonsForSource(type, source)[0];
    return lesson ? applyLessonToBlock(block, lesson, source) : clearBlockSelection(block, source);
}

function addTypeToSequence(type) {
    const existingBlock = lessonSequenceState.blocks.find((item) => item.materialType === type);
    if (existingBlock) {
        removeBlock(existingBlock.id);
        return;
    }

    const block = buildBlockForType(type);
    lessonSequenceState.blocks.push(block);
    selectedBlockId = block.id;
    persistLessonSequence();
    renderLessonSequence();
}

function setBlockSource(blockId, sourceScope) {
    const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
    if (!block) return;

    if (sourceScope === "new") {
        applyNewSourceToBlock(block);
    } else {
        const lessons = lessonsForSource(block.materialType || "slides", sourceScope);
        if (lessons.length) {
            applyLessonToBlock(block, lessons[0], sourceScope);
        } else {
            clearBlockSelection(block, sourceScope);
        }
    }

    selectedBlockId = block.id;
    persistLessonSequence();
    renderLessonSequence();
}

function setBlockMaterial(blockId, lessonId) {
    const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
    const lesson = findLessonById(lessonId);
    if (!block || !lesson) return;

    applyLessonToBlock(block, lesson, detectLessonScope(lesson));
    persistLessonSequence();
    renderLessonSequence();
}

function selectBlock(id) {
    selectedBlockId = id;
    renderLessonSequence();
}

function updateBlockField(blockId, field, value) {
    const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
    if (!block) return;

    if (field === "duration") {
        block.duration = Math.max(1, Number(value || 1));
    } else {
        block[field] = value;
    }

    persistLessonSequence();
    refreshLessonSequencePanels(blockId);
}

function moveBlock(blockId, direction) {
    const index = lessonSequenceState.blocks.findIndex((item) => item.id === blockId);
    if (index === -1) return;

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= lessonSequenceState.blocks.length) return;

    const [block] = lessonSequenceState.blocks.splice(index, 1);
    lessonSequenceState.blocks.splice(nextIndex, 0, block);
    persistLessonSequence();
    renderLessonSequence();
}

function removeBlock(blockId) {
    lessonSequenceState.blocks = lessonSequenceState.blocks.filter((item) => item.id !== blockId);
    openLessonEditorBlockIds.delete(blockId);
    if (selectedBlockId === blockId) {
        selectedBlockId = lessonSequenceState.blocks[0]?.id || "";
    }
    persistLessonSequence();
    renderLessonSequence();
}

function moveBlockToIndex(blockId, targetIndex) {
    const index = lessonSequenceState.blocks.findIndex((item) => item.id === blockId);
    if (index === -1 || targetIndex < 0 || targetIndex >= lessonSequenceState.blocks.length || index === targetIndex) return;

    const [block] = lessonSequenceState.blocks.splice(index, 1);
    lessonSequenceState.blocks.splice(targetIndex, 0, block);
    persistLessonSequence();
    renderLessonSequence();
}

function targetIndexFromPointerY(clientY) {
    const items = [...document.querySelectorAll("[data-drag-lesson-block]")];
    if (!items.length) return -1;

    const target = items.find((item) => {
        const rect = item.getBoundingClientRect();
        return clientY < rect.top + (rect.height / 2);
    });

    if (!target) return items.length - 1;
    return items.findIndex((item) => item === target);
}

function finishLessonSequencePointerDrag() {
    if (!lessonSequencePointerDrag) return;

    lessonSequencePointerDrag = null;
    draggedLessonBlockId = "";
    dragHoverLessonBlockId = "";
    document.body.classList.remove("lesson-sequence-sort-active");
    renderReadinessPanel();
}

function updateLessonSequencePointerDrag(clientY) {
    if (!lessonSequencePointerDrag?.blockId) return;

    const targetIndex = targetIndexFromPointerY(clientY);
    const currentIndex = lessonSequenceState.blocks.findIndex((item) => item.id === lessonSequencePointerDrag.blockId);
    if (targetIndex === -1 || currentIndex === -1) return;

    const targetBlock = lessonSequenceState.blocks[targetIndex];
    const hoverChanged = !!targetBlock && dragHoverLessonBlockId !== targetBlock.id;
    if (targetBlock && dragHoverLessonBlockId !== targetBlock.id) {
        dragHoverLessonBlockId = targetBlock.id;
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (targetIndex !== currentIndex) {
        const timeSinceLastSwap = now - (lessonSequencePointerDrag.lastSwapAt || 0);
        if (timeSinceLastSwap < 120) {
            if (hoverChanged) renderReadinessPanel();
            return;
        }

        lessonSequencePointerDrag.lastSwapAt = now;
        lessonSequencePointerDrag.lastTargetIndex = targetIndex;
        moveBlockToIndex(lessonSequencePointerDrag.blockId, targetIndex);
        return;
    }

    lessonSequencePointerDrag.lastTargetIndex = currentIndex;
    if (hoverChanged) {
        renderReadinessPanel();
    }
}

function prepareLessonSequencePresentation() {
    persistLessonSequence();
    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType("lesson");
    }
}

function readLessonAiSourceText(button) {
    const targetId = button?.dataset?.lessonAiSource || "";
    if (targetId) {
        const field = document.getElementById(targetId);
        if (field?.value?.trim()) return field.value.trim();
    }

    const inlineField = document.getElementById("lesson-ai-source-inline");
    if (inlineField?.value?.trim()) return inlineField.value.trim();

    const defaultField = document.getElementById("lesson-ai-source");
    return defaultField?.value?.trim() || "";
}

async function generateWholeLessonSequence(button) {
    if (lessonSequenceGenerating) return;
    if (!lessonSequenceState.blocks.length) {
        window.alert("Adicione pelo menos uma atividade antes de gerar todo o conteúdo.");
        return;
    }

    const typedSource = readLessonAiSourceText(button);
    const sourceText = typedSource || lessonSequenceState.objective || lessonSequenceState.title || "";
    if (!sourceText.trim()) {
        window.alert("Escreva um texto-base ou pelo menos o objetivo da aula para gerar todos os blocos.");
        return;
    }

    lessonSequenceGenerating = true;
    const originalLabel = button.textContent;
    let fallbackCount = 0;

    button.disabled = true;
    button.textContent = "Gerando aula...";

    try {
        for (let index = 0; index < lessonSequenceState.blocks.length; index += 1) {
            const block = lessonSequenceState.blocks[index];
            const { payload, usedFallback } = await generatePayloadForBlock(block, index, sourceText);
            const rawDraft = buildLessonDraftFromPayload(block.materialType || "slides", payload || {});
            const previousTitle = block.lessonTitle || block.label || "";
            const summary = buildDraftSummary(block.materialType || "slides", rawDraft);

            block.lessonRefId = "";
            block.sourceScope = "new";
            block.lessonDraft = rawDraft;
            block.lessonTitle = payload?.title || summary.title || block.lessonTitle || materialGroupLabel(block.materialType || "slides");
            block.lessonSummary = summary.summary || block.lessonSummary || "Conteúdo estruturado para a sequência.";

            if (isAutoNamedBlock(block, previousTitle)) {
                block.label = block.lessonTitle;
            }

            if (usedFallback) {
                fallbackCount += 1;
            }
        }

        persistLessonSequence();
        renderLessonSequence();

        if (fallbackCount) {
            window.alert(`A sequência foi gerada. ${fallbackCount} bloco(s) usaram fallback local para não interromper o fluxo.`);
        }
    } finally {
        lessonSequenceGenerating = false;
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

function prepareBlockNavigation(block) {
    if (!block) return;

    const lesson = effectiveLessonForBlock(block);
    const draft = effectiveDraftForBlock(block, lesson);
    const materialType = block.materialType || lesson?.materialType || "slides";

    writeEditingBlockMarker({
        blockId: block.id,
        materialType
    });

    if (draft && typeof writeCurrentDraftByType === "function") {
        writeCurrentDraftByType(materialType, draft);
    }

    if (lesson?.id && typeof activateLessonById === "function") {
        activateLessonById(lesson.id);
    } else if (typeof writeActiveLessonId === "function") {
        writeActiveLessonId("");
    }

    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(materialType);
    }
}

function syncEditedBlockFromMarker() {
    const marker = readEditingBlockMarker();
    if (!marker?.blockId) return;

    const block = lessonSequenceState.blocks.find((item) => item.id === marker.blockId);
    if (!block) {
        clearEditingBlockMarker();
        return;
    }

    const rawDraft = typeof readCurrentDraftByType === "function"
        ? readCurrentDraftByType(marker.materialType || block.materialType || "slides")
        : "";

    if (!rawDraft) {
        clearEditingBlockMarker();
        return;
    }

    const lesson = effectiveLessonForBlock(block);
    if (lesson) {
        const previousTitle = block.lessonTitle || block.label || "";
        const summary = buildDraftSummary(block.materialType || "slides", rawDraft);
        block.sourceScope = detectLessonScope(lesson);
        block.lessonTitle = summary.title || lesson.title || block.lessonTitle;
        block.lessonSummary = summary.summary || lesson.summary || block.lessonSummary;
        block.lessonDraft = rawDraft;
        if (isAutoNamedBlock(block, previousTitle)) {
            block.label = block.lessonTitle || lesson.title || block.label;
        }
    } else {
        const previousTitle = block.lessonTitle || block.label || "";
        const summary = buildDraftSummary(block.materialType || "slides", rawDraft);
        block.lessonDraft = rawDraft;
        block.lessonTitle = summary.title || block.lessonTitle || materialGroupLabel(block.materialType || "slides");
        block.lessonSummary = summary.summary || block.lessonSummary || "Conteúdo ainda em edição.";
        if (isAutoNamedBlock(block, previousTitle)) {
            block.label = block.lessonTitle;
        }
    }

    persistLessonSequence();
    clearEditingBlockMarker();
}

function persistLessonSequence() {
    syncStateFromFields();
    writeLessonSequenceDraft(lessonSequenceState);
}

function renderToolPicker() {
    const root = document.querySelector("[data-lesson-tool-grid]");
    if (!root) return;

    root.innerHTML = LESSON_SEQUENCE_TYPES.map((type) => {
        const counts = lessonCountsForType(type.value);
        const selectedIndex = lessonSequenceState.blocks.findIndex((block) => block.materialType === type.value);
        return `
            <button type="button" class="lesson-sequence-tool-button ${selectedIndex !== -1 ? "is-selected" : ""}" data-add-lesson-type="${type.value}">
                ${selectedIndex !== -1 ? `<span class="lesson-sequence-tool-order" aria-label="Selecionado na posição ${selectedIndex + 1}">${selectedIndex + 1}</span>` : ""}
                <strong>${escapeHtml(type.label)}</strong>
                <p>${escapeHtml(materialGroupDescription(type.value))}</p>
                <div class="lesson-sequence-tool-meta">
                    <span>${counts.classCount} na turma</span>
                    <span>${counts.libraryCount} na biblioteca</span>
                </div>
            </button>
        `;
    }).join("");
}

function renderPreview() {
    const previewCard = document.querySelector("[data-lesson-preview-card]");
    const previewActions = document.querySelector("[data-lesson-preview-actions]");
    const editLink = document.querySelector("[data-lesson-preview-edit]");
    const presentLink = document.querySelector("[data-lesson-preview-present]");
    if (!previewCard || !previewActions || !editLink || !presentLink) return;

    const block = lessonSequenceState.blocks.find((item) => item.id === selectedBlockId);
    const lesson = effectiveLessonForBlock(block);
    if (!block) {
        previewCard.innerHTML = `
            <span class="route-tag">Sem bloco</span>
            <h3>Selecione uma atividade</h3>
            <p>Ao clicar em um bloco da sequência, os detalhes aparecem aqui.</p>
        `;
        previewActions.hidden = true;
        return;
    }

    const title = effectiveTitleForBlock(block, lesson);
    const summary = effectiveSummaryForBlock(block, lesson);
    const source = effectiveSourceForBlock(block, lesson);

    previewCard.innerHTML = `
        <span class="route-tag">${escapeHtml(materialGroupLabel(block.materialType || "slides"))}</span>
        <h3>${escapeHtml(block.label || title)}</h3>
        <p>${escapeHtml(summary)}</p>
        <div class="lesson-sequence-preview-meta">
            <span>${Math.max(1, Number(block.duration || 0))} min</span>
            <span>${escapeHtml(sourceLabel(source))}</span>
            <span>${escapeHtml(title)}</span>
        </div>
        ${block.note ? `<div class="lesson-sequence-note">${escapeHtml(block.note)}</div>` : ""}
    `;

    previewActions.hidden = false;
    editLink.href = editorPathForLesson(lesson || { materialType: block.materialType });
    editLink.textContent = source === "new" ? "Criar material" : "Editar material";
    editLink.dataset.lessonPreviewEdit = block.id;
    presentLink.href = withLessonEditorContext(presentationPathForLesson(lesson || { materialType: block.materialType }));
    presentLink.dataset.lessonPreviewPresent = block.id;
}

function animateProgressListReflow(progressList, nextMarkup) {
    if (!progressList) return;

    const previousPositions = new Map(
        [...progressList.querySelectorAll("[data-progress-item-id]")].map((item) => [
            item.dataset.progressItemId || "",
            item.getBoundingClientRect()
        ])
    );

    progressList.innerHTML = nextMarkup;

    [...progressList.querySelectorAll("[data-progress-item-id]")].forEach((item) => {
        const key = item.dataset.progressItemId || "";
        if (draggedLessonBlockId && (key === draggedLessonBlockId || key === dragHoverLessonBlockId)) return;
        const previousRect = previousPositions.get(key);
        if (!previousRect) return;

        const nextRect = item.getBoundingClientRect();
        const deltaX = previousRect.left - nextRect.left;
        const deltaY = previousRect.top - nextRect.top;
        if (!deltaX && !deltaY) return;

        item.animate([
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0, 0)" }
        ], {
            duration: 220,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
        });
    });
}

function renderReadinessPanel() {
    const readiness = document.querySelector("[data-lesson-sequence-readiness]");
    const progressList = document.querySelector("[data-lesson-sequence-progress-list]");
    if (!readiness || !progressList) return;

    const blocks = lessonSequenceState.blocks;
    const readyCount = blocks.filter(blockReady).length;
    const missingCount = Math.max(0, blocks.length - readyCount);

    readiness.innerHTML = `
        <strong>${readyCount} de ${blocks.length} blocos prontos</strong>
        <p>${blocks.length ? (missingCount ? `${missingCount} bloco${missingCount === 1 ? "" : "s"} ainda precisa${missingCount === 1 ? "" : "m"} de revisão.` : "A sequência já está pronta para apresentação.") : "Escolha as atividades para começar."}</p>
    `;

    if (!blocks.length) {
        progressList.innerHTML = `
            <div class="lesson-sequence-progress-empty">
                <h3>A sequência aparece aqui</h3>
                <p>Depois de adicionar os blocos, você acompanha o andamento da aula por este painel.</p>
            </div>
        `;
        return;
    }

    const markup = blocks.map((block, index) => {
        const lesson = effectiveLessonForBlock(block);
        const source = effectiveSourceForBlock(block, lesson);
        const previewLink = withLessonEditorContext(presentationPathForLesson(lesson || { materialType: block.materialType || "slides" }));
        const statusText = blockStatusText(block);
        const statusMarkup = statusText === "Novo"
            ? ""
            : `<span class="lesson-sequence-progress-state ${blockStatusClass(block)}">${escapeHtml(statusText)}</span>`;
        const accent = sequenceAccentStyle(index);
        return `
            <article
                class="lesson-sequence-progress-item ${block.id === selectedBlockId ? "is-selected" : ""} ${block.id === draggedLessonBlockId ? "is-dragging" : ""} ${block.id === dragHoverLessonBlockId && block.id !== draggedLessonBlockId ? "is-drop-target" : ""}"
                data-progress-item-id="${block.id}"
                data-drag-lesson-block="${block.id}"
                style="${accent}"
            >
                <button type="button" class="lesson-sequence-progress-grip" data-drag-handle="${block.id}" aria-label="Arrastar ${escapeAttr(block.label || effectiveTitleForBlock(block, lesson))}"></button>
                <button type="button" class="lesson-sequence-progress-main" data-select-lesson-block="${block.id}">
                    <span class="lesson-sequence-progress-order">${index + 1}</span>
                    <span class="lesson-sequence-progress-copy">
                        <strong>${escapeHtml(block.label || effectiveTitleForBlock(block, lesson))}</strong>
                        <small>${escapeHtml(materialGroupLabel(block.materialType || "slides"))} - ${escapeHtml(sourceLabel(source))}</small>
                    </span>
                    ${statusMarkup}
                </button>
                <button type="button" class="lesson-sequence-progress-remove" data-remove-lesson-block="${block.id}" aria-label="Remover ${escapeAttr(block.label || effectiveTitleForBlock(block, lesson))}">X</button>
                <div class="lesson-sequence-progress-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-open-lesson-block-inline="${block.id}">Editar material</button>
                    <a href="${previewLink}" class="platform-link-button platform-link-primary" data-open-lesson-block-preview="${block.id}">Testar</a>
                </div>
            </article>
        `;
    }).join("");

    animateProgressListReflow(progressList, markup);
}

function renderSequenceMeta() {
    const count = document.querySelector("[data-lesson-sequence-count]");
    const duration = document.querySelector("[data-lesson-sequence-duration]");
    const classNode = document.querySelector("[data-lesson-sequence-class]");
    const status = document.querySelector("[data-lesson-sequence-status]");
    const blocks = lessonSequenceState.blocks;
    const readyCount = blocks.filter(blockReady).length;
    const lessonDuration = lessonSequenceState.duration || totalBlocksDuration();

    if (count) count.textContent = `${blocks.length} ${blocks.length === 1 ? "bloco" : "blocos"}`;
    if (duration) duration.textContent = `${lessonDuration} min`;
    if (classNode) classNode.textContent = currentTurmaName() || "Turma";

    if (!status) return;
    if (!blocks.length) {
        status.textContent = "Escolha as atividades";
        return;
    }

    if (readyCount === blocks.length) {
        status.textContent = "Apresentação pronta";
        return;
    }

    status.textContent = `${readyCount}/${blocks.length} blocos definidos`;
}

function renderSourceOptions(block) {
    const source = effectiveSourceForBlock(block);
    const lessons = source === "new" ? [] : lessonsForSource(block.materialType || "slides", source);

    if (source === "new") {
        return `
            <div class="lesson-sequence-source-card lesson-sequence-source-card--new">
                <div>
                    <strong>${escapeHtml(block.lessonTitle || `Novo ${materialGroupLabel(block.materialType || "slides")}`)}</strong>
                    <p>${escapeHtml(block.lessonSummary || "Abra o builder para montar esse conteúdo do zero.")}</p>
                </div>
                <a href="${editorPathForLesson({ materialType: block.materialType || "slides" })}" class="platform-link-button platform-link-primary" data-open-lesson-block-editor="${block.id}">Abrir builder</a>
            </div>
        `;
    }

    if (!lessons.length) {
        return `
            <div class="lesson-sequence-source-empty">
                <strong>Nenhum ${escapeHtml(materialGroupLabel(block.materialType || "slides")).toLowerCase()} salvo em ${escapeHtml(sourceLabel(source)).toLowerCase()}</strong>
                <p>Troque a origem para biblioteca ou criar novo para continuar este bloco.</p>
            </div>
        `;
    }

    const lesson = effectiveLessonForBlock(block);
    const title = effectiveTitleForBlock(block, lesson);
    const summary = effectiveSummaryForBlock(block, lesson);

    return `
        <div class="lesson-sequence-source-card">
            <div class="platform-field platform-field-wide">
                <label>${source === "class" ? "Conteúdo salvo na turma" : "Conteúdo salvo na biblioteca"}</label>
                <select data-block-select-material="${block.id}">
                    ${lessons.map((item) => `
                        <option value="${item.id}" ${item.id === block.lessonRefId ? "selected" : ""}>${escapeHtml(item.title)}</option>
                    `).join("")}
                </select>
            </div>
            <div class="lesson-sequence-source-summary">
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
            </div>
        </div>
    `;
}

function renderBlockCard(block, index) {
    const lesson = effectiveLessonForBlock(block);
    const title = effectiveTitleForBlock(block, lesson);
    const summary = effectiveSummaryForBlock(block, lesson);
    const source = effectiveSourceForBlock(block, lesson);
    const typeLabel = materialGroupLabel(block.materialType || "slides");
    const editorLabel = source === "new" ? "Criar material" : "Editar material";

    return `
        <article class="lesson-sequence-item ${block.id === selectedBlockId ? "is-selected" : ""}" data-lesson-block-id="${block.id}">
            <button type="button" class="lesson-sequence-item-main" data-select-lesson-block="${block.id}">
                <div class="lesson-sequence-item-head">
                    <span class="platform-badge-soft">${index + 1}</span>
                    <span class="platform-block-chip">${escapeHtml(typeLabel)}</span>
                    <span class="lesson-sequence-status-chip ${blockStatusClass(block)}">${escapeHtml(blockStatusText(block))}</span>
                </div>
                <h3>${escapeHtml(block.label || title)}</h3>
                <p>${escapeHtml(summary)}</p>
            </button>

            <div class="lesson-sequence-source-switch" role="tablist" aria-label="Origem do conteúdo">
                <button type="button" class="lesson-sequence-source-pill ${source === "class" ? "is-active" : ""}" data-set-block-source="${block.id}" data-source-scope="class">Turma</button>
                <button type="button" class="lesson-sequence-source-pill ${source === "library" ? "is-active" : ""}" data-set-block-source="${block.id}" data-source-scope="library">Biblioteca</button>
                <button type="button" class="lesson-sequence-source-pill ${source === "new" ? "is-active" : ""}" data-set-block-source="${block.id}" data-source-scope="new">Criar novo</button>
            </div>

            ${renderSourceOptions(block)}

            <div class="lesson-sequence-item-fields lesson-sequence-item-fields--expanded">
                <div class="platform-field">
                    <label>Nome deste bloco na sequência</label>
                    <input type="text" value="${escapeAttr(block.label || title)}" data-block-field="label" data-block-id="${block.id}">
                </div>
                <div class="platform-field">
                    <label>Tempo deste bloco</label>
                    <input type="number" min="1" step="1" value="${Math.max(1, Number(block.duration || 1))}" data-block-field="duration" data-block-id="${block.id}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Observação do professor</label>
                    <input type="text" value="${escapeAttr(block.note || "")}" placeholder="Ex.: retomar a resposta da turma antes de avançar" data-block-field="note" data-block-id="${block.id}">
                </div>
            </div>

            <div class="lesson-history-actions lesson-sequence-actions">
                <button type="button" class="platform-link-button platform-link-secondary" data-move-lesson-block="${block.id}" data-direction="up" ${index === 0 ? "disabled" : ""}>Subir</button>
                <button type="button" class="platform-link-button platform-link-secondary" data-move-lesson-block="${block.id}" data-direction="down" ${index === lessonSequenceState.blocks.length - 1 ? "disabled" : ""}>Descer</button>
                <a href="${editorPathForLesson(lesson || { materialType: block.materialType || "slides" })}" class="platform-link-button platform-link-secondary" data-open-lesson-block-editor="${block.id}">${escapeHtml(editorLabel)}</a>
                <a href="${withLessonEditorContext(presentationPathForLesson(lesson || { materialType: block.materialType || "slides" }))}" class="platform-link-button platform-link-primary" data-open-lesson-block-preview="${block.id}">Testar bloco</a>
                <button type="button" class="platform-link-button platform-link-secondary" data-remove-lesson-block="${block.id}">Remover</button>
            </div>
        </article>
    `;
}

function renderSourceOptions(block) {
    const source = effectiveSourceForBlock(block);
    const lessons = source === "new" ? [] : lessonsForSource(block.materialType || "slides", source);

    if (source === "new") {
        return `
            <div class="lesson-sequence-source-card lesson-sequence-source-card--new">
                <div>
                    <strong>${escapeHtml(block.lessonTitle || `Novo ${materialGroupLabel(block.materialType || "slides")}`)}</strong>
                    <p>${escapeHtml(block.lessonSummary || "Voce pode editar este conteudo logo abaixo ou abrir o builder completo se quiser mais recursos.")}</p>
                </div>
                <a href="${editorPathForLesson({ materialType: block.materialType || "slides" })}" class="platform-link-button platform-link-secondary" data-open-lesson-block-editor="${block.id}">Builder avancado</a>
            </div>
        `;
    }

    if (!lessons.length) {
        return `
            <div class="lesson-sequence-source-empty">
                <strong>Nenhum ${escapeHtml(materialGroupLabel(block.materialType || "slides")).toLowerCase()} salvo em ${escapeHtml(sourceLabel(source)).toLowerCase()}</strong>
                <p>Troque a origem para biblioteca ou criar novo para continuar este bloco.</p>
            </div>
        `;
    }

    const lesson = effectiveLessonForBlock(block);
    const title = effectiveTitleForBlock(block, lesson);
    const summary = effectiveSummaryForBlock(block, lesson);

    return `
        <div class="lesson-sequence-source-card">
            <div class="platform-field platform-field-wide">
                <label>${source === "class" ? "Conteudo salvo na turma" : "Conteudo salvo na biblioteca"}</label>
                <select data-block-select-material="${block.id}">
                    ${lessons.map((item) => `
                        <option value="${item.id}" ${item.id === block.lessonRefId ? "selected" : ""}>${escapeHtml(item.title)}</option>
                    `).join("")}
                </select>
            </div>
            <div class="lesson-sequence-source-summary">
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(summary)}</p>
            </div>
        </div>
    `;
}

function renderBlockCard(block, index) {
    seedInlineDraftForBlock(block);
    const lesson = effectiveLessonForBlock(block);
    const title = effectiveTitleForBlock(block, lesson);
    const summary = effectiveSummaryForBlock(block, lesson);
    const source = effectiveSourceForBlock(block, lesson);
    const typeLabel = materialGroupLabel(block.materialType || "slides");
    const editorLabel = source === "new" ? "Criar material" : "Editar material";
    const isOpen = openLessonEditorBlockIds.has(block.id);
    const accent = sequenceAccentStyle(index);

    return `
        <details class="lesson-sequence-item lesson-sequence-item-disclosure ${block.id === selectedBlockId ? "is-selected" : ""}" data-lesson-block-id="${block.id}" data-lesson-block-disclosure="${block.id}" ${isOpen ? "open" : ""} style="${accent}">
            <summary class="lesson-sequence-item-summary">
                <div class="lesson-sequence-item-head">
                    <span class="platform-badge-soft">${index + 1}</span>
                    <span class="platform-block-chip">${escapeHtml(typeLabel)}</span>
                    <span class="lesson-sequence-status-chip ${blockStatusClass(block)}" data-lesson-block-status="${block.id}">${escapeHtml(blockStatusText(block))}</span>
                </div>
                <div class="lesson-sequence-item-copy">
                    <h3 data-lesson-block-title="${block.id}">${escapeHtml(block.label || title)}</h3>
                    <p data-lesson-block-summary="${block.id}">${escapeHtml(summary)}</p>
                </div>
                <span class="lesson-sequence-item-toggle" aria-hidden="true"></span>
            </summary>

            <div class="lesson-sequence-item-body">
                <div class="lesson-sequence-source-switch" role="tablist" aria-label="Origem do conteudo">
                    <button type="button" class="lesson-sequence-source-pill ${source === "class" ? "is-active" : ""}" data-set-block-source="${block.id}" data-source-scope="class">Turma</button>
                    <button type="button" class="lesson-sequence-source-pill ${source === "library" ? "is-active" : ""}" data-set-block-source="${block.id}" data-source-scope="library">Biblioteca</button>
                    <button type="button" class="lesson-sequence-source-pill ${source === "new" ? "is-active" : ""}" data-set-block-source="${block.id}" data-source-scope="new">Criar novo</button>
                </div>

                ${renderSourceOptions(block)}

                <div class="lesson-sequence-item-fields lesson-sequence-item-fields--expanded">
                    <div class="platform-field">
                        <label>Nome deste bloco na sequencia</label>
                        <input type="text" value="${escapeAttr(block.label || title)}" data-block-field="label" data-block-id="${block.id}">
                    </div>
                    <div class="platform-field">
                        <label>Tempo deste bloco</label>
                        <input type="number" min="1" step="1" value="${Math.max(1, Number(block.duration || 1))}" data-block-field="duration" data-block-id="${block.id}">
                    </div>
                    <div class="platform-field platform-field-wide">
                        <label>Observacao do professor</label>
                        <input type="text" value="${escapeAttr(block.note || "")}" placeholder="Ex.: retomar a resposta da turma antes de avancar" data-block-field="note" data-block-id="${block.id}">
                    </div>
                </div>

                ${renderInlineEditor(block)}

                <div class="lesson-history-actions lesson-sequence-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-move-lesson-block="${block.id}" data-direction="up" ${index === 0 ? "disabled" : ""}>Subir</button>
                    <button type="button" class="platform-link-button platform-link-secondary" data-move-lesson-block="${block.id}" data-direction="down" ${index === lessonSequenceState.blocks.length - 1 ? "disabled" : ""}>Descer</button>
                    <a href="${editorPathForLesson(lesson || { materialType: block.materialType || "slides" })}" class="platform-link-button platform-link-secondary" data-open-lesson-block-editor="${block.id}">${escapeHtml(editorLabel)}</a>
                    <a href="${withLessonEditorContext(presentationPathForLesson(lesson || { materialType: block.materialType || "slides" }))}" class="platform-link-button platform-link-primary" data-open-lesson-block-preview="${block.id}">Testar bloco</a>
                    <button type="button" class="platform-link-button platform-link-secondary" data-remove-lesson-block="${block.id}">Remover</button>
                </div>
            </div>
        </details>
    `;
}

function renderLessonSequence() {
    const list = document.querySelector("[data-lesson-sequence-list]");
    const empty = document.querySelector("[data-lesson-sequence-empty]");
    if (!list || !empty) return;

    syncBlocksWithSavedMaterials();
    renderSequenceMeta();
    renderToolPicker();

    if (!lessonSequenceState.blocks.length) {
        empty.hidden = false;
        list.innerHTML = "";
        selectedBlockId = "";
        renderReadinessPanel();
        renderPreview();
        return;
    }

    empty.hidden = true;
    if (!selectedBlockId || !lessonSequenceState.blocks.some((block) => block.id === selectedBlockId)) {
        selectedBlockId = lessonSequenceState.blocks[0].id;
    }

    list.innerHTML = lessonSequenceState.blocks.map(renderBlockCard).join("");
    renderReadinessPanel();
    renderPreview();
}

function bindLessonSequenceEvents() {
    document.addEventListener("click", (event) => {
        const addTypeTrigger = event.target.closest("[data-add-lesson-type]");
        if (addTypeTrigger) {
            addTypeToSequence(addTypeTrigger.dataset.addLessonType || "slides");
            return;
        }

        const selectTrigger = event.target.closest("[data-select-lesson-block]");
        if (selectTrigger) {
            selectBlock(selectTrigger.dataset.selectLessonBlock || "");
            return;
        }

        const sourceTrigger = event.target.closest("[data-set-block-source]");
        if (sourceTrigger) {
            setBlockSource(
                sourceTrigger.dataset.setBlockSource || "",
                sourceTrigger.dataset.sourceScope || "class"
            );
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
            prepareBlockNavigation(block);
            return;
        }

        const openInlineTrigger = event.target.closest("[data-open-lesson-block-inline]");
        if (openInlineTrigger) {
            event.preventDefault();
            const blockId = openInlineTrigger.dataset.openLessonBlockInline || "";
            if (!blockId) return;

            const stepTwo = document.querySelector('[data-lesson-step="2"]');
            if (stepTwo instanceof HTMLDetailsElement) {
                stepTwo.open = true;
            }

            openLessonEditorBlockIds.add(blockId);
            selectBlock(blockId);

            requestAnimationFrame(() => {
                const disclosure = document.querySelector(`[data-lesson-block-disclosure="${blockId}"]`);
                if (disclosure instanceof HTMLDetailsElement) {
                    disclosure.open = true;
                    disclosure.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
            return;
        }

        const previewTrigger = event.target.closest("[data-open-lesson-block-preview], [data-lesson-preview-edit], [data-lesson-preview-present]");
        if (previewTrigger) {
            const blockId = previewTrigger.dataset.openLessonBlockPreview
                || previewTrigger.dataset.lessonPreviewEdit
                || previewTrigger.dataset.lessonPreviewPresent
                || "";
            const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
            prepareBlockNavigation(block);
            return;
        }

        const applyImageTrigger = event.target.closest("[data-apply-slide-image]");
        if (applyImageTrigger) {
            const blockId = applyImageTrigger.dataset.applySlideImage || "";
            const slideIndex = Number(applyImageTrigger.dataset.applySlideIndex || 0);
            const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
            if (!block) return;

            const root = applyImageTrigger.closest(".lesson-sequence-inline-editor-item");
            const urlField = root?.querySelector('[data-block-draft-field][data-draft-field-selector="[data-field=\\"slide-image-url\\"]"]');
            const promptField = root?.querySelector('[data-block-draft-field][data-draft-field-selector="[data-field=\\"slide-image-prompt\\"]"]');

            if (urlField) {
                updateBlockDraftStackField(
                    blockId,
                    "[data-slide-card]",
                    slideIndex,
                    '[data-field="slide-image-url"]',
                    0,
                    urlField.value
                );
            }

            if (promptField) {
                updateBlockDraftStackField(
                    blockId,
                    "[data-slide-card]",
                    slideIndex,
                    '[data-field="slide-image-prompt"]',
                    0,
                    promptField.value
                );
            }

            const confirm = root?.querySelector('[data-slide-image-confirm]');
            if (confirm) {
                confirm.hidden = false;
                clearTimeout(confirm._hideTimer);
                confirm._hideTimer = setTimeout(() => {
                    confirm.hidden = true;
                }, 1800);
            }
            return;
        }

        const generateAllTrigger = event.target.closest("[data-generate-lesson-sequence]");
        if (generateAllTrigger) {
            event.preventDefault();
            generateWholeLessonSequence(generateAllTrigger);
            return;
        }

        const openPresentationTrigger = event.target.closest("[data-open-lesson-sequence-presentation]");
        if (openPresentationTrigger) {
            prepareLessonSequencePresentation();
        }
    });

    document.addEventListener("change", (event) => {
        const select = event.target.closest("[data-block-select-material]");
        if (select) {
            setBlockMaterial(select.dataset.blockSelectMaterial || "", select.value);
            return;
        }

        const fileField = event.target.closest("[data-block-draft-file]");
        if (fileField) {
            const file = fileField.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = typeof reader.result === "string" ? reader.result : "";
                const inlineRoot = fileField.closest(".lesson-sequence-inline-editor-item");
                const urlField = inlineRoot?.querySelector('[data-block-draft-field][data-draft-field-selector="[data-field=\\"slide-image-url\\"]"]');
                if (urlField) {
                    urlField.value = dataUrl;
                }

                updateBlockDraftStackField(
                    fileField.dataset.blockDraftFile || "",
                    fileField.dataset.draftItemSelector || "",
                    Number(fileField.dataset.draftItemIndex || 0),
                    fileField.dataset.draftFileSelector || "",
                    Number(fileField.dataset.draftFileOccurrence || 0),
                    dataUrl
                );

                const modeSelector = fileField.dataset.draftFileModeSelector || "";
                if (modeSelector) {
                    updateBlockDraftStackField(
                        fileField.dataset.blockDraftFile || "",
                        fileField.dataset.draftItemSelector || "",
                        Number(fileField.dataset.draftItemIndex || 0),
                        modeSelector,
                        0,
                        "Upload"
                    );
                }

                const blockId = fileField.dataset.blockDraftFile || "";
                if (blockId) {
                    const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
                    if (block?.lessonDraft && typeof writeCurrentDraftByType === "function") {
                        writeCurrentDraftByType("slides", block.lessonDraft);
                    }
                }
            };
            reader.readAsDataURL(file);
            return;
        }

        const draftControl = event.target.closest("[data-block-draft-control]");
        if (draftControl) {
            updateBlockDraftControlField(
                draftControl.dataset.blockDraftControl || "",
                draftControl.dataset.draftControlKey || "",
                draftControl.value
            );
            return;
        }

        const draftField = event.target.closest("[data-block-draft-field]");
        if (draftField) {
            updateBlockDraftStackField(
                draftField.dataset.blockDraftField || "",
                draftField.dataset.draftItemSelector || "",
                Number(draftField.dataset.draftItemIndex || 0),
                draftField.dataset.draftFieldSelector || "",
                Number(draftField.dataset.draftFieldOccurrence || 0),
                draftField.value
            );
            return;
        }

        if (event.target.matches("#lesson-duration")) {
            persistLessonSequence();
            renderLessonSequence();
        }
    });

    document.addEventListener("input", (event) => {
        const blockField = event.target.closest("[data-block-field]");
        if (blockField) {
            updateBlockField(blockField.dataset.blockId || "", blockField.dataset.blockField || "", blockField.value);
            return;
        }

        const draftField = event.target.closest("[data-block-draft-field]");
        if (draftField) {
            updateBlockDraftStackField(
                draftField.dataset.blockDraftField || "",
                draftField.dataset.draftItemSelector || "",
                Number(draftField.dataset.draftItemIndex || 0),
                draftField.dataset.draftFieldSelector || "",
                Number(draftField.dataset.draftFieldOccurrence || 0),
                draftField.value
            );
            return;
        }

        if (event.target.matches("#lesson-title, #lesson-objective, #lesson-duration")) {
            persistLessonSequence();
            renderLessonSequence();
        }
    });

    document.addEventListener("educaria-lessons-updated", () => {
        syncBlocksWithSavedMaterials();
        renderLessonSequence();
    });

    document.addEventListener("toggle", (event) => {
        const disclosure = event.target.closest("[data-lesson-block-disclosure]");
        if (!disclosure || event.target !== disclosure) return;

        const blockId = disclosure.dataset.lessonBlockDisclosure || "";
        if (!blockId) return;

        if (disclosure.open) {
            openLessonEditorBlockIds.add(blockId);
        } else {
            openLessonEditorBlockIds.delete(blockId);
        }

        selectedBlockId = blockId;
        refreshLessonSequencePanels(blockId);
    });

    document.addEventListener("pointerdown", (event) => {
        const handle = event.target.closest("[data-drag-handle]");
        if (!handle) return;

        event.preventDefault();
        event.stopPropagation();

        const blockId = handle.dataset.dragHandle || "";
        if (!blockId) return;

        lessonSequencePointerDrag = {
            blockId,
            pointerId: event.pointerId,
            lastTargetIndex: lessonSequenceState.blocks.findIndex((item) => item.id === blockId),
            lastSwapAt: 0
        };
        draggedLessonBlockId = blockId;
        dragHoverLessonBlockId = blockId;
        document.body.classList.add("lesson-sequence-sort-active");
        renderReadinessPanel();
    });

    document.addEventListener("pointermove", (event) => {
        if (!lessonSequencePointerDrag || event.pointerId !== lessonSequencePointerDrag.pointerId) return;
        event.preventDefault();
        updateLessonSequencePointerDrag(event.clientY);
    });

    document.addEventListener("pointerup", (event) => {
        if (!lessonSequencePointerDrag || event.pointerId !== lessonSequencePointerDrag.pointerId) return;
        finishLessonSequencePointerDrag();
    });

    document.addEventListener("pointercancel", (event) => {
        if (!lessonSequencePointerDrag || event.pointerId !== lessonSequencePointerDrag.pointerId) return;
        finishLessonSequencePointerDrag();
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
    syncBlocksWithSavedMaterials();
    persistLessonSequence();

    const turma = currentTurmaName();
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
    syncEditedBlockFromMarker();
    syncBlocksWithSavedMaterials();
    hydrateMetaFields();
    renderToolPicker();
    bindLessonSequenceEvents();
    selectedBlockId = lessonSequenceState.blocks[0]?.id || "";
    renderLessonSequence();
}

window.saveLessonSequenceToClass = saveLessonSequenceToLibrary;

document.addEventListener("DOMContentLoaded", initLessonSequenceBuilder);
