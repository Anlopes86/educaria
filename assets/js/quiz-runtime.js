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

        return {
            index,
            type: fieldLabel("type") || "Multipla escolha",
            prompt: fieldValue("prompt") || `Questao ${index + 1}`,
            correct: fieldLabel("correct"),
            explanation: fieldValue("explanation"),
            criteria: fieldValue("criteria"),
            model: fieldValue("model"),
            options: [...card.querySelectorAll("[data-option]")].map((field) => ({
                key: field.dataset.optionKey || "",
                value: field.value.trim()
            })).filter((option) => option.value)
        };
    }).map((question) => {
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
                        <option selected>${escapeHtml(question.type || "Multipla escolha")}</option>
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

function buildFallbackQuiz() {
    return [{
        index: 0,
        type: "Multipla escolha",
        prompt: "Which sentence uses the present perfect correctly?",
        correct: "Alternativa B",
        explanation: "Use 'have seen' because the structure is subject + have/has + past participle.",
        options: [
            { key: "Alternativa A", value: "I have saw this movie before." },
            { key: "Alternativa B", value: "I have seen this movie before." },
            { key: "Alternativa C", value: "I seen this movie yesterday." },
            { key: "Alternativa D", value: "I has seen this movie before." }
        ]
    }];
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
        if (modal) modal.hidden = true;
    };

    const openModal = (question) => {
        if (!modal || !modalTitle || !modalContent) return;
        modalTitle.textContent = question.prompt;
        modalContent.innerHTML = `
            <p data-inline-editable="question:explanation" data-inline-editable-multiline="true">${escapeHtml(question.explanation || "Sem explicação.")}</p>
            ${question.criteria ? `<p><strong>Critério:</strong> <span data-inline-editable="question:criteria">${escapeHtml(question.criteria)}</span></p>` : ""}
            ${question.model ? `<p><strong>Resposta modelo:</strong> <span data-inline-editable="question:model" data-inline-editable-multiline="true">${escapeHtml(question.model)}</span></p>` : ""}
        `;
        modal.hidden = false;
        inlineEdit?.syncUi();
    };

    const paint = () => {
        const question = state.questions[currentIndex];
        const isOpenQuestion = question.type === "Pergunta aberta";

        if (title) title.textContent = state.controls["quiz-tema"];
        if (classLabel) classLabel.textContent = turma || state.controls["quiz-tema"];
        if (counter) counter.textContent = `${currentIndex + 1} de ${state.questions.length}`;
        prompt.textContent = question.prompt;
        if (helper) helper.textContent = question.type;
        prompt.classList.toggle("quiz-application-prompt--open", isOpenQuestion);
        optionsRoot.classList.toggle("quiz-application-options--open", isOpenQuestion);
        cardRoot?.classList.toggle("quiz-application-card--open", isOpenQuestion);
        closeModal();

        if (isOpenQuestion) {
            optionsRoot.innerHTML = `
                <article class="route-card quiz-open-card" aria-hidden="true"></article>
            `;
        } else {
            optionsRoot.innerHTML = question.options.map((option) => `
                <button type="button" class="option-btn ${isBinaryQuestion(question) ? "is-binary" : ""}" data-runtime-option="${escapeHtml(option.key)}">
                    <span class="option-letter">${isBinaryQuestion(question) ? escapeHtml(option.value) : escapeHtml(option.key.replace("Alternativa ", ""))}</span>
                    <span class="option-text" data-inline-editable="question:option:${escapeHtml(option.key)}">${escapeHtml(option.value)}</span>
                </button>
            `).join("");
        }

        prevButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === state.questions.length - 1;
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

        const question = state.questions[currentIndex];
        const selectedKey = button.dataset.runtimeOption || "";
        const correctKey = normalizeCorrectKey(question);

        optionsRoot.querySelectorAll(".option-btn").forEach((node) => {
            node.classList.remove("selected", "is-correct", "is-wrong", "is-neutral");
        });

        optionsRoot.querySelectorAll(".option-btn").forEach((node) => {
            const optionKey = node.dataset.runtimeOption || "";

            if (optionKey === correctKey) {
                node.classList.add("is-correct");
                return;
            }

            if (optionKey === selectedKey && selectedKey !== correctKey) {
                node.classList.add("is-wrong", "selected");
                return;
            }

            node.classList.add("is-neutral");
        });

        if (selectedKey === correctKey) {
            button.classList.add("selected");
        }
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

    persistState();
    paint();
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readQuizDraft();
    const questions = draft ? parseQuizQuestions(draft.stackHtml) : [];
    renderQuizApplication(questions.length ? questions : buildFallbackQuiz(), draft?.controls || {});
});
