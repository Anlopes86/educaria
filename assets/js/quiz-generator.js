let quizCardTemplatesCache = [];

function parseQuizCount() {
    const field = document.getElementById("quiz-quantidade");
    if (!field) return 8;
    const value = Number(field.value);
    return Number.isFinite(value) && value > 0 ? value : 8;
}

function readQuizModelFile(file) {
    if (!file) return Promise.resolve("");

    return file.text().then((content) => {
        const fileName = String(file.name || "").toLowerCase();

        if (file.type === "text/plain" || fileName.endsWith(".txt")) {
            return content;
        }

        if (fileName.endsWith(".rtf")) {
            return String(content || "")
                .replace(/\\par[d]?/g, "\n")
                .replace(/\\'[0-9a-fA-F]{2}/g, "")
                .replace(/\\[a-z]+\d* ?/g, "")
                .replace(/[{}]/g, "")
                .replace(/\r/g, "")
                .replace(/\n{2,}/g, "\n")
                .trim();
        }

        return "";
    }).catch(() => "");
}

function normalizeQuizTopic(topic) {
    return String(topic || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function setQuizSelectByText(select, desiredText) {
    if (!select) return;

    const normalizedDesiredText = normalizeQuizTopic(desiredText);
    const match = [...select.options].find((option) => (
        normalizeQuizTopic(option.textContent || option.text || option.value) === normalizedDesiredText
    ));

    select.selectedIndex = match ? match.index : 0;
}

function normalizeQuizQuestionType(rawType) {
    const normalized = normalizeQuizTopic(rawType);

    if (normalized.includes("aberta")) return "short_answer";
    if (
        normalized.includes("verdadeiro") ||
        normalized === "vf" ||
        normalized === "v/f" ||
        normalized === "v ou f"
    ) {
        return "true_false";
    }

    return "multiple_choice";
}

function normalizeQuizFormat(rawFormat, questions) {
    const normalized = normalizeQuizTopic(rawFormat);

    if (normalized.includes("multipla")) return "M\u00faltipla escolha";
    if (normalized.includes("aberta")) return "Perguntas abertas";
    if (normalized.includes("verdadeiro")) return "Verdadeiro ou falso";
    if (normalized === "misto") return "Misto";

    const kinds = [...new Set((questions || []).map((question) => question.kind))];
    if (kinds.length !== 1) return "Misto";
    if (kinds[0] === "short_answer") return "Perguntas abertas";
    if (kinds[0] === "true_false") return "Verdadeiro ou falso";
    return "M\u00faltipla escolha";
}

function resolveQuizCorrectLabel(question) {
    if (!question || question.kind === "short_answer") return "";

    const raw = String(question.correct || "").trim();
    const normalized = normalizeQuizTopic(raw);

    if (question.kind === "true_false") {
        return normalized === "falso" || normalized === "false"
            ? "Alternativa B"
            : "Alternativa A";
    }

    const alternativeMatch = normalized.match(/^alternativa\s*([abcd])$/);
    if (alternativeMatch) {
        return `Alternativa ${alternativeMatch[1].toUpperCase()}`;
    }

    const singleLetterMatch = normalized.match(/^([abcd])$/);
    if (singleLetterMatch) {
        return `Alternativa ${singleLetterMatch[1].toUpperCase()}`;
    }

    const numericMatch = normalized.match(/^[1-4]$/);
    if (numericMatch) {
        return `Alternativa ${String.fromCharCode(64 + Number(numericMatch[0]))}`;
    }

    const optionIndex = (question.options || []).findIndex((option) => (
        normalizeQuizTopic(option) === normalized
    ));

    if (optionIndex >= 0) {
        return `Alternativa ${String.fromCharCode(65 + optionIndex)}`;
    }

    return "Alternativa A";
}

function ensureQuizQuestionEntry(map, index) {
    if (!map.has(index)) {
        map.set(index, {
            prompt: "",
            rawType: "",
            options: { A: "", B: "", C: "", D: "" },
            correct: "",
            explanation: "",
            criteria: "",
            modelAnswer: ""
        });
    }

    return map.get(index);
}

function parseQuizTemplateText(sourceText) {
    const lines = String(sourceText || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    const questionsMap = new Map();
    let title = "";
    let format = "";

    lines.forEach((line) => {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex < 0) return;

        const key = normalizeQuizTopic(line.slice(0, separatorIndex).replace(/\s+/g, " ").trim());
        const value = String(line.slice(separatorIndex + 1) || "").trim();

        if (!key) return;

        if (key === "tema" || key === "tema do quiz" || key === "titulo do quiz") {
            title = value;
            return;
        }

        if (key === "formato") {
            format = value;
            return;
        }

        let match = key.match(/^questao\s*(\d+)$/);
        if (match) {
            ensureQuizQuestionEntry(questionsMap, Number(match[1])).prompt = value;
            return;
        }

        match = key.match(/^tipo\s*(\d+)$/);
        if (match) {
            ensureQuizQuestionEntry(questionsMap, Number(match[1])).rawType = value;
            return;
        }

        match = key.match(/^alternativa\s*([abcd])\s*(\d+)$/);
        if (match) {
            ensureQuizQuestionEntry(questionsMap, Number(match[2])).options[match[1].toUpperCase()] = value;
            return;
        }

        match = key.match(/^resposta correta\s*(\d+)$/);
        if (match) {
            ensureQuizQuestionEntry(questionsMap, Number(match[1])).correct = value;
            return;
        }

        match = key.match(/^explicacao\s*(\d+)$/);
        if (match) {
            ensureQuizQuestionEntry(questionsMap, Number(match[1])).explanation = value;
            return;
        }

        match = key.match(/^criterio\s*(\d+)$/);
        if (match) {
            ensureQuizQuestionEntry(questionsMap, Number(match[1])).criteria = value;
            return;
        }

        match = key.match(/^resposta modelo\s*(\d+)$/);
        if (match) {
            ensureQuizQuestionEntry(questionsMap, Number(match[1])).modelAnswer = value;
        }
    });

    const questions = [...questionsMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, entry]) => {
            const kind = normalizeQuizQuestionType(entry.rawType);
            const options = kind === "true_false"
                ? ["Verdadeiro", "Falso"]
                : ["A", "B", "C", "D"].map((letter) => entry.options[letter] || "");

            return {
                kind,
                prompt: String(entry.prompt || "").trim(),
                options,
                correct: entry.correct || "",
                explanation: entry.explanation || "",
                criteria: entry.criteria || "",
                modelAnswer: entry.modelAnswer || ""
            };
        })
        .filter((question) => question.prompt);

    if (!questions.length) {
        throw new Error("Preencha pelo menos uma questao no modelo do quiz.");
    }

    return {
        title,
        format: normalizeQuizFormat(format, questions),
        questions
    };
}

function cacheQuizTemplates() {
    const stack = document.querySelector("[data-quiz-stack]");
    if (!stack) return;

    const cards = [...stack.querySelectorAll("[data-quiz-question]")];
    if (!cards.length) return;

    quizCardTemplatesCache = cards.map((card) => card.cloneNode(true));
}

function quizTemplateForKind(templates, kind) {
    const desiredType = kind === "short_answer"
        ? "Pergunta aberta"
        : "M\u00faltipla escolha";

    return templates.find((card) => {
        const typeField = card.querySelector('[data-field="type"]');
        return normalizeQuizTopic(typeField?.value || typeField?.options?.[typeField?.selectedIndex]?.text || "") === normalizeQuizTopic(desiredType);
    }) || templates[0] || null;
}

function applyQuizTemplateData(payload) {
    const stack = document.querySelector("[data-quiz-stack]");
    const templates = (quizCardTemplatesCache.length ? quizCardTemplatesCache : [...document.querySelectorAll("[data-quiz-question]")])
        .map((card) => card.cloneNode(true));
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];

    if (!stack || !templates.length || !questions.length) return false;

    stack.innerHTML = "";

    questions.forEach((question, index) => {
        const template = quizTemplateForKind(templates, question.kind);
        if (!template) return;

        const card = template.cloneNode(true);
        const label = card.querySelector("[data-card-label]");
        const prompt = card.querySelector('[data-field="prompt"]');
        const type = card.querySelector('[data-field="type"]');
        const correct = card.querySelector('[data-field="correct"]');
        const explanation = card.querySelector('[data-field="explanation"]');
        const criteria = card.querySelector('[data-field="criteria"]');
        const model = card.querySelector('[data-field="model"]');
        const optionFields = [...card.querySelectorAll("[data-option]")];

        if (label) label.textContent = `Quest\u00e3o ${index + 1}`;
        if (prompt) prompt.value = question.prompt || "";
        if (explanation) explanation.value = question.explanation || "";
        if (criteria) criteria.value = question.criteria || "";
        if (model) model.value = question.modelAnswer || "";

        if (type) {
            setQuizSelectByText(
                type,
                question.kind === "short_answer"
                    ? "Pergunta aberta"
                    : question.kind === "true_false"
                        ? "Verdadeiro ou falso"
                        : "M\u00faltipla escolha"
            );
        }

        if (question.kind !== "short_answer") {
            optionFields.forEach((field, optionIndex) => {
                field.value = question.options?.[optionIndex] || "";
            });

            if (correct) {
                setQuizSelectByText(correct, resolveQuizCorrectLabel(question));
            }
        }

        stack.appendChild(card);
    });

    const titleField = document.getElementById("quiz-tema");
    const formatField = document.getElementById("quiz-formato");
    const countField = document.getElementById("quiz-quantidade");

    if (titleField && payload.title) titleField.value = payload.title;
    if (formatField && payload.format) setQuizSelectByText(formatField, payload.format);
    if (countField) countField.value = String(questions.length);

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

async function loadQuizModelFile(button) {
    const fileField = document.getElementById("quiz-arquivo-modelo");
    const file = fileField?.files?.[0] || null;

    if (!file) {
        window.alert("Selecione um arquivo de apoio do quiz antes de gerar.");
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Lendo modelo...";

    try {
        const fileText = await readQuizModelFile(file);
        if (!fileText) {
            throw new Error("Use o arquivo modelo do quiz em formato RTF ou TXT.");
        }

        const payload = parseQuizTemplateText(fileText);
        if (!applyQuizTemplateData(payload)) {
            throw new Error("O arquivo modelo do quiz nao trouxe dados suficientes.");
        }
    } catch (error) {
        const detail = error instanceof Error ? error.message : "Erro desconhecido.";
        window.alert(`Nao foi possivel montar o quiz com o arquivo modelo.\n\nDetalhe: ${detail}`);
    } finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

function baseQuizBank(topic) {
    const text = normalizeQuizTopic(topic);

    if (text.includes("solar") || text.includes("planeta")) {
        return [
            { type: "Múltipla escolha", prompt: "Qual é o maior planeta do sistema solar?", correct: "Alternativa C", options: ["Marte", "Terra", "Júpiter", "Netuno"], explanation: "Júpiter é o maior planeta do sistema solar." },
            { type: "Verdadeiro ou falso", prompt: "Saturno é conhecido por seus anéis.", correct: "True", options: ["True", "False"], explanation: "Saturno é um dos planetas mais lembrados por seus anéis visíveis." },
            { type: "Pergunta aberta", prompt: "Explique por que a Terra é especial no sistema solar.", criteria: "Água líquida ou vida", model: "A Terra é especial porque possui água líquida e condições favoráveis à vida.", explanation: "Busque resposta com justificativa simples e correta." }
        ];
    }

    if (text.includes("frac")) {
        return [
            { type: "Múltipla escolha", prompt: "Qual fração representa a metade?", correct: "Alternativa A", options: ["1/2", "1/3", "2/3", "3/4"], explanation: "A metade corresponde a uma de duas partes iguais." },
            { type: "Verdadeiro ou falso", prompt: "2/4 é equivalente a 1/2.", correct: "True", options: ["True", "False"], explanation: "Frações equivalentes representam a mesma quantidade." },
            { type: "Pergunta aberta", prompt: "Explique a diferença entre numerador e denominador.", criteria: "Parte de cima e parte de baixo", model: "O numerador mostra quantas partes foram consideradas e o denominador em quantas partes o inteiro foi dividido.", explanation: "A resposta deve explicar a função de cada parte." }
        ];
    }

    return [
        { type: "Múltipla escolha", prompt: "Which sentence uses the present perfect correctly?", correct: "Alternativa B", options: ["I have saw this movie before.", "I have seen this movie before.", "I seen this movie yesterday.", "I has seen this movie before."], explanation: "Use 'have seen' because the structure is subject + have/has + past participle." },
        { type: "Pergunta aberta", prompt: "Write one sentence about how technology has changed your school life.", criteria: "Present perfect + school context", model: "Technology has changed my school life because we have used more digital tools in class.", explanation: "Observe se o aluno usa present perfect de forma inteligível e contextualizada." },
        { type: "Verdadeiro ou falso", prompt: "Present perfect connects a past action to the present.", correct: "True", options: ["True", "False"], explanation: "This tense links past actions or experiences to the present moment." }
    ];
}

function questionTemplateByType(cards, type) {
    return cards.find((card) => {
        const select = card.querySelector('[data-field="type"]');
        return select && select.value === type;
    }) || cards[0];
}

function applyQuizQuestion(card, question, index) {
    const label = card.querySelector("[data-card-label]");
    if (label) label.textContent = `Questão ${index + 1}`;

    const prompt = card.querySelector('[data-field="prompt"]');
    const type = card.querySelector('[data-field="type"]');
    const correct = card.querySelector('[data-field="correct"]');
    const explanation = card.querySelector('[data-field="explanation"]');
    const criteria = card.querySelector('[data-field="criteria"]');
    const model = card.querySelector('[data-field="model"]');
    const options = [...card.querySelectorAll("[data-option]")];

    if (prompt) prompt.value = question.prompt || "";
    if (type) type.value = question.type || "Múltipla escolha";
    if (correct) {
        const desired = question.correct || correct.options[0]?.text || "";
        const match = [...correct.options].find((option) => option.text.trim() === desired);
        correct.selectedIndex = match ? match.index : 0;
    }
    if (explanation) explanation.value = question.explanation || "";
    if (criteria) criteria.value = question.criteria || "";
    if (model) model.value = question.model || "";

    options.forEach((field, optionIndex) => {
        field.value = question.options?.[optionIndex] || "";
    });
}

function applyGeneratedQuiz() {
    const stack = document.querySelector("[data-quiz-stack]");
    if (!stack) return;

    const formatField = document.getElementById("quiz-formato");
    const topicField = document.getElementById("quiz-tema");
    const templates = [...stack.querySelectorAll("[data-quiz-question]")].map((card) => card.cloneNode(true));
    const count = parseQuizCount();
    const topic = topicField ? topicField.value.trim() : "Quiz";
    const format = formatField ? formatField.options[formatField.selectedIndex].text.trim() : "Misto";
    const base = baseQuizBank(topic);
    const questions = [];

    while (questions.length < count) {
        questions.push(base[questions.length % base.length]);
    }

    const filtered = questions.map((question, index) => {
        if (format === "Múltipla escolha") return { ...base[0], prompt: `${question.prompt}` };
        if (format === "Perguntas abertas") return { ...base[1], prompt: `${question.prompt}` };
        if (format === "Verdadeiro ou falso") return { ...base[2], prompt: `${question.prompt}` };
        return question;
    });

    stack.innerHTML = "";
    filtered.forEach((question, index) => {
        const template = questionTemplateByType(templates, question.type);
        if (!template) return;
        const card = template.cloneNode(true);
        applyQuizQuestion(card, question, index);
        stack.appendChild(card);
    });

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
}

document.addEventListener("DOMContentLoaded", () => {
    cacheQuizTemplates();

    document.addEventListener("click", (event) => {
        const loadModelButton = event.target.closest("[data-quiz-load-model]");
        if (loadModelButton) {
            event.preventDefault();
            loadQuizModelFile(loadModelButton);
            return;
        }

        const button = event.target.closest("[data-generate-quiz]");
        if (!button) return;

        event.preventDefault();
        applyGeneratedQuiz();
    });
});
