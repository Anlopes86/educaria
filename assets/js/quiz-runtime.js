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
    const helper = document.querySelector("[data-quiz-application-helper]");
    const explanation = document.querySelector("[data-quiz-application-explanation]");
    const prevButton = document.querySelector("[data-quiz-application-prev]");
    const nextButton = document.querySelector("[data-quiz-application-next]");
    const revealButton = document.querySelector("[data-quiz-application-reveal]");
    let currentIndex = 0;

    const turma = typeof readSelectedClass === "function" ? readSelectedClass() : "";
    const materialTheme = controls["quiz-tema"] || "Quiz";

    const isBinaryQuestion = (question) => question.type === "Verdadeiro ou falso";
    const normalizeCorrectKey = (question) => String(question.correct || "").trim();

    const paint = () => {
        const question = questions[currentIndex];

        if (title) title.textContent = materialTheme;
        if (classLabel) classLabel.textContent = turma ? `${turma} - ${materialTheme}` : materialTheme;
        if (counter) counter.textContent = `${currentIndex + 1} de ${questions.length}`;
        prompt.textContent = question.prompt;
        if (helper) helper.textContent = question.type;
        explanation.hidden = true;
        explanation.textContent = "";

        if (question.type === "Pergunta aberta") {
            optionsRoot.innerHTML = `
                <article class="route-card">
                    <span class="route-tag">Resposta modelo</span>
                    <p>${question.model || "Sem resposta modelo."}</p>
                    <p style="margin-top: 10px;"><strong>Criterio:</strong> ${question.criteria || "Sem criterio definido."}</p>
                </article>
            `;
        } else {
            optionsRoot.innerHTML = question.options.map((option) => `
                <button type="button" class="option-btn ${isBinaryQuestion(question) ? "is-binary" : ""}" data-runtime-option="${option.key}">
                    <span class="option-letter">${isBinaryQuestion(question) ? option.value : option.key.replace("Alternativa ", "")}</span>
                    <span class="option-text">${option.value}</span>
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
            node.classList.remove("selected", "is-correct", "is-wrong");
        });
        button.classList.add("selected");

        if (selectedKey === correctKey) {
            button.classList.add("is-correct");
            explanation.hidden = false;
            explanation.textContent = question.explanation || "Sem explicacao.";
        } else {
            button.classList.add("is-wrong");
            explanation.hidden = true;
            explanation.textContent = "";
        }
    });

    revealButton.addEventListener("click", () => {
        explanation.hidden = false;
        explanation.textContent = questions[currentIndex].explanation || "Sem explicacao.";
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

    paint();
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readQuizDraft();
    const questions = draft ? parseQuizQuestions(draft.stackHtml) : [];
    renderQuizApplication(questions.length ? questions : buildFallbackQuiz(), draft?.controls || {});
});
