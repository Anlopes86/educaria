const QUIZ_DRAFT_KEY = "educaria:builder:quiz";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readQuizDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(QUIZ_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA quiz unavailable:", error);
        return null;
    }
}

function writeQuizDraft(state) {
    try {
        localStorage.setItem(scopedStorageKey(QUIZ_DRAFT_KEY), JSON.stringify(state));
    } catch (error) {
        console.warn("EducarIA quiz save unavailable:", error);
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function parseQuizQuestions(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");
    const cards = [...doc.querySelectorAll("[data-quiz-question]")];

    return cards.map((card, index) => {
        const fieldValue = (name) => card.querySelector(`[data-field="${name}"]`)?.value?.trim() || "";
        const fieldLabel = (name) => {
            const field = card.querySelector(`[data-field="${name}"]`);
            if (!field || field.tagName !== "SELECT") return fieldValue(name);
            return field.options[field.selectedIndex]?.text?.trim() || "";
        };

        const prompt = fieldValue("prompt");
        const explanation = fieldValue("explanation");
        const criteria = fieldValue("criteria");
        const model = fieldValue("model");
        const options = [...card.querySelectorAll("[data-option]")].map((field) => ({
            key: field.dataset.optionKey || "",
            value: field.value.trim()
        })).filter((option) => option.value);

        if (![prompt, explanation, criteria, model, ...options.map((option) => option.value)].some(Boolean)) {
            return null;
        }

        return {
            index,
            type: fieldLabel("type") || "Múltipla escolha",
            prompt: prompt || `Questão ${index + 1}`,
            correct: fieldLabel("correct"),
            explanation,
            criteria,
            model,
            options
        };
    }).filter(Boolean).map((question, index) => {
        question.index = index;
        if (question.type === "Verdadeiro ou falso" && question.options.length < 2) {
            return {
                ...question,
                options: [
                    { key: "Alternativa A", value: "Verdadeiro" },
                    { key: "Alternativa B", value: "Falso" }
                ]
            };
        }

        return question;
    });
}

function serializeQuizQuestions(questions) {
    return questions.map((question, index) => `
        <section class="platform-question-card activity-content-card" data-quiz-question>
            <div class="platform-form-grid">
                <div class="platform-field platform-field-wide">
                    <label>Enunciado</label>
                    <textarea data-field="prompt" rows="3">${escapeHtml(question.prompt)}</textarea>
                </div>
                <div class="platform-field">
                    <label>Tipo</label>
                    <select data-field="type">
                        <option selected>${escapeHtml(question.type || "Múltipla escolha")}</option>
                    </select>
                </div>
                <div class="platform-field">
                    <label>Correta</label>
                    <select data-field="correct">
                        <option selected>${escapeHtml(question.correct || "")}</option>
                    </select>
                </div>
                ${(question.options || []).map((option) => `
                    <div class="platform-field platform-field-wide">
                        <label>${escapeHtml(option.key)}</label>
                        <input data-option data-option-key="${escapeHtml(option.key)}" type="text" value="${escapeHtml(option.value)}">
                    </div>
                `).join("")}
                <div class="platform-field platform-field-wide">
                    <label>Explicação</label>
                    <textarea data-field="explanation" rows="3">${escapeHtml(question.explanation || "")}</textarea>
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Critério</label>
                    <input data-field="criteria" type="text" value="${escapeHtml(question.criteria || "")}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Resposta modelo</label>
                    <textarea data-field="model" rows="3">${escapeHtml(question.model || "")}</textarea>
                </div>
            </div>
        </section>
    `).join("");
}

function renderQuizApplication(questions, controls = {}) {
    const title = document.querySelector("[data-quiz-application-title]");
    const classLabel = document.querySelector("[data-quiz-application-class]");
    const counter = document.querySelector("[data-quiz-application-counter]");
    const prompt = document.querySelector("[data-quiz-application-prompt]");
    const optionsRoot = document.querySelector("[data-quiz-application-options]");
    const cardRoot = document.querySelector(".quiz-application-card");
    const helper = document.querySelector("[data-quiz-application-helper]");
    const prevButton = document.querySelector("[data-quiz-application-prev]");
    const nextButton = document.querySelector("[data-quiz-application-next]");
    const revealButton = document.querySelector("[data-quiz-application-reveal]");
    const modal = document.querySelector("[data-quiz-explanation-modal]");
    const modalTitle = document.querySelector("[data-quiz-explanation-title]");
    const modalContent = document.querySelector("[data-quiz-explanation-content]");
    const closeModalButton = document.querySelector("[data-quiz-explanation-close]");
    let currentIndex = 0;
    let saveTimer = 0;
    let inlineEdit = null;
    const answers = {};
    const feedback = document.querySelector("[data-quiz-answer-feedback]");
    let modalReturnFocus = null;

    const state = {
        controls: {
            ...controls,
            "quiz-tema": controls["quiz-tema"] || "Quiz"
        },
        questions: questions.map((question, index) => ({ ...question, index })),
        stackHtml: serializeQuizQuestions(questions)
    };

    title.dataset.inlineEditable = "control:quiz-tema";
    prompt.dataset.inlineEditable = "question:prompt";
    prompt.dataset.inlineEditableMultiline = "true";

    const turma = typeof readSelectedClass === "function" ? readSelectedClass() : "";

    const isBinaryQuestion = (question) => question.type === "Verdadeiro ou falso";
    const normalizeCorrectKey = (question) => String(question.correct || "").trim();

    const persistState = () => {
        state.questions = state.questions.map((question, index) => ({ ...question, index }));
        state.stackHtml = serializeQuizQuestions(state.questions);
        writeQuizDraft(state);
    };

    const scheduleSave = () => {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(persistState, 140);
    };

    const closeModal = () => {
        if (modal && !modal.hidden) {
            modal.hidden = true;
            modalReturnFocus?.focus?.({ preventScroll: true });
        }
    };

    const openModal = (question) => {
        if (!modal || !modalTitle || !modalContent) return;
        modalTitle.textContent = question.prompt;
        modalContent.innerHTML = `
            <p data-inline-editable="question:explanation" data-inline-editable-multiline="true">${escapeHtml(question.explanation || "Sem explicação.")}</p>
            ${question.criteria ? `<p><strong>Critério:</strong> <span data-inline-editable="question:criteria">${escapeHtml(question.criteria)}</span></p>` : ""}
            ${question.model ? `<p><strong>Resposta modelo:</strong> <span data-inline-editable="question:model" data-inline-editable-multiline="true">${escapeHtml(question.model)}</span></p>` : ""}
        `;
        modalReturnFocus = document.activeElement;
        modal.hidden = false;
        closeModalButton?.focus();
        inlineEdit?.syncUi();
    };

    const paintAnswer = () => {
        const question = state.questions[currentIndex];
        const selectedKey = answers[currentIndex];
        const correctKey = normalizeCorrectKey(question);
        optionsRoot.querySelectorAll(".option-btn").forEach((node) => {
            const key = node.dataset.runtimeOption;
            node.classList.toggle("selected", key === selectedKey);
            node.classList.toggle("is-correct", Boolean(selectedKey && correctKey && key === correctKey));
            node.classList.toggle("is-wrong", Boolean(selectedKey && correctKey && key === selectedKey && key !== correctKey));
            node.classList.toggle("is-neutral", Boolean(selectedKey && correctKey && key !== selectedKey && key !== correctKey));
            node.setAttribute("aria-pressed", String(key === selectedKey));
        });
        if (!feedback) return;
        const correctOption = question.options.find((option) => option.key === correctKey);
        feedback.dataset.state = !selectedKey || !correctKey ? "idle" : selectedKey === correctKey ? "correct" : "wrong";
        feedback.textContent = question.type === "Pergunta aberta" ? "Converse com a turma e revele a resposta quando quiser."
            : !selectedKey ? "Escolha uma alternativa para conferir a resposta."
            : !correctKey ? "Resposta selecionada. Confira a explicação com a turma."
            : selectedKey === correctKey ? "✓ Resposta correta! Veja a explicação para aprofundar."
            : `↻ Vamos revisar. Resposta correta: ${correctOption?.value || correctKey}.`;
    };

    const paint = () => {
        const question = state.questions[currentIndex];
        const isOpenQuestion = question.type === "Pergunta aberta";

        if (title) title.textContent = state.controls["quiz-tema"];
        if (classLabel) classLabel.textContent = turma || state.controls["quiz-tema"];
        if (counter) counter.textContent = `${currentIndex + 1} de ${state.questions.length}`;
        const stageCounter = document.querySelector("[data-quiz-stage-counter]");
        if (stageCounter) stageCounter.textContent = `Questão ${currentIndex + 1} de ${state.questions.length}`;
        prompt.textContent = question.prompt;
        if (helper) helper.textContent = question.type;
        prompt.classList.toggle("quiz-application-prompt--open", isOpenQuestion);
        optionsRoot.classList.toggle("quiz-application-options--open", isOpenQuestion);
        cardRoot?.classList.toggle("quiz-application-card--open", isOpenQuestion);
        optionsRoot.classList.toggle("quiz-application-options--binary", isBinaryQuestion(question));
        closeModal();

        if (isOpenQuestion) {
            optionsRoot.innerHTML = `
                <article class="route-card quiz-open-card" aria-hidden="true"></article>
            `;
        } else {
            const binaryQuestion = isBinaryQuestion(question);
            optionsRoot.innerHTML = question.options.map((option) => `
                <button type="button" class="option-btn ${binaryQuestion ? "is-binary" : ""}" data-runtime-option="${escapeHtml(option.key)}">
                    ${binaryQuestion ? "" : `<span class="option-letter">${escapeHtml(option.key.replace("Alternativa ", ""))}</span>`}
                    <span class="option-text" data-inline-editable="question:option:${escapeHtml(option.key)}">${escapeHtml(option.value)}</span>
                </button>
            `).join("");
        }

        prevButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === state.questions.length - 1;
        paintAnswer();
        inlineEdit?.syncUi();
    };

    if (typeof createPresentationInlineEditController === "function") {
        inlineEdit = createPresentationInlineEditController({
            onInput(node) {
                const binding = String(node.dataset.inlineEditable || "");
                const nextValue = readInlineEditableValue(node, node.dataset.inlineEditableMultiline === "true");

                if (binding.startsWith("control:")) {
                    const key = binding.slice("control:".length);
                    if (state.controls[key] === nextValue) return;
                    state.controls[key] = nextValue;
                    scheduleSave();
                    return;
                }

                const question = state.questions[currentIndex];
                if (!question) return;

                if (binding === "question:prompt") {
                    if (question.prompt === nextValue) return;
                    question.prompt = nextValue;
                    scheduleSave();
                    return;
                }

                if (binding === "question:explanation" || binding === "question:criteria" || binding === "question:model") {
                    const field = binding.replace("question:", "");
                    if (question[field] === nextValue) return;
                    question[field] = nextValue;
                    scheduleSave();
                    return;
                }

                const optionMatch = binding.match(/^question:option:(.+)$/);
                if (!optionMatch) return;

                const key = optionMatch[1];
                const option = question.options.find((item) => item.key === key);
                if (!option || option.value === nextValue) return;
                option.value = nextValue;
                scheduleSave();
            },
            onCommit() {
                const question = state.questions[currentIndex];
                paint();
                if (modal && !modal.hidden && question) {
                    openModal(question);
                }
            }
        });
    }

    optionsRoot.addEventListener("click", (event) => {
        if (inlineEdit?.enabled) return;

        const button = event.target.closest("[data-runtime-option]");
        if (!button) return;

        const selectedKey = button.dataset.runtimeOption || "";
        answers[currentIndex] = selectedKey;
        paintAnswer();
    });

    revealButton.addEventListener("click", () => {
        openModal(state.questions[currentIndex]);
    });

    closeModalButton?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
    });

    prevButton.addEventListener("click", () => {
        if (currentIndex === 0) return;
        currentIndex -= 1;
        paint();
    });

    nextButton.addEventListener("click", () => {
        if (currentIndex >= state.questions.length - 1) return;
        currentIndex += 1;
        paint();
    });

    document.addEventListener("keydown", (event) => {
        if (modal && !modal.hidden) {
            if (event.key === "Escape") { event.preventDefault(); closeModal(); }
            if (event.key === "Tab") {
                const nodes = [...modal.querySelectorAll('button, [contenteditable="true"]')];
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
            return;
        }
        if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (currentIndex === 0) return;
            currentIndex -= 1;
            paint();
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            if (currentIndex >= state.questions.length - 1) return;
            currentIndex += 1;
            paint();
        }
    });

    window.educariaPresentationProgress = {
        capture: () => ({ currentIndex, answers: { ...answers } }),
        restore(saved) {
            currentIndex = Math.max(0, Math.min(state.questions.length - 1, Number(saved?.currentIndex) || 0));
            Object.assign(answers, saved?.answers || {});
            paint();
        }
    };

    persistState();
    paint();
}

function renderQuizEmptyState() {
    const cardRoot = document.querySelector(".quiz-application-card");
    const classLabel = document.querySelector("[data-quiz-application-class]");
    const topMeta = document.querySelector(".quiz-application-top-meta");
    const inlineEditToggle = document.querySelector("[data-inline-edit-toggle]");

    if (!cardRoot) return;
    if (classLabel) classLabel.textContent = "Quiz ainda sem perguntas";
    if (topMeta) topMeta.hidden = true;
    if (inlineEditToggle) inlineEditToggle.hidden = true;

    cardRoot.className = "question-card quiz-application-card quiz-application-card--empty";
    cardRoot.innerHTML = `
        <div class="presentation-empty-state" role="status">
            <span class="presentation-empty-state__icon" aria-hidden="true">?</span>
            <span class="platform-section-label">Material não finalizado</span>
            <h1>Este quiz ainda está vazio</h1>
            <p>Volte ao editor para escrever ou gerar as perguntas antes de aplicar a atividade.</p>
            <a href="quiz-builder.html" class="platform-link-button platform-link-primary" data-return-to-editor>Voltar ao editor</a>
        </div>
    `;
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readQuizDraft();
    const questions = draft ? parseQuizQuestions(draft.stackHtml) : [];
    if (!questions.length) {
        renderQuizEmptyState();
        return;
    }
    renderQuizApplication(questions, draft?.controls || {});
});
