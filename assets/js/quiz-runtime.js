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

    const turma = typeof readSelectedClass === "function" ? readSelectedClass() : "";
    const materialTheme = controls["quiz-tema"] || "Quiz";

    const isBinaryQuestion = (question) => question.type === "Verdadeiro ou falso";
    const normalizeCorrectKey = (question) => String(question.correct || "").trim();

    const closeModal = () => {
        if (modal) modal.hidden = true;
    };

    const openModal = (question) => {
        if (!modal || !modalTitle || !modalContent) return;
        modalTitle.textContent = question.prompt;
        modalContent.innerHTML = `
            <p>${escapeHtml(question.explanation || "Sem explicacao.")}</p>
            ${question.criteria ? `<p><strong>Criterio:</strong> ${escapeHtml(question.criteria)}</p>` : ""}
            ${question.model ? `<p><strong>Resposta modelo:</strong> ${escapeHtml(question.model)}</p>` : ""}
        `;
        modal.hidden = false;
    };

    const paint = () => {
        const question = questions[currentIndex];
        const isOpenQuestion = question.type === "Pergunta aberta";

        if (title) title.textContent = materialTheme;
        if (classLabel) classLabel.textContent = turma || materialTheme;
        if (counter) counter.textContent = `${currentIndex + 1} de ${questions.length}`;
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
                    <span class="option-text">${escapeHtml(option.value)}</span>
                </button>
            `).join("");
        }

        prevButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === questions.length - 1;
    };

    optionsRoot.addEventListener("click", (event) => {
        const button = event.target.closest("[data-runtime-option]");
        if (!button) return;

        const question = questions[currentIndex];
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
        openModal(questions[currentIndex]);
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
        if (currentIndex >= questions.length - 1) return;
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
            if (currentIndex >= questions.length - 1) return;
            currentIndex += 1;
            paint();
        }
    });

    paint();
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readQuizDraft();
    const questions = draft ? parseQuizQuestions(draft.stackHtml) : [];
    renderQuizApplication(questions.length ? questions : buildFallbackQuiz(), draft?.controls || {});
});
