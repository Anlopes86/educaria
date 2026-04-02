function parseQuizCount() {
    const field = document.getElementById("quiz-quantidade");
    if (!field) return 8;
    const match = field.value.match(/\d+/);
    return match ? Number(match[0]) : 8;
}

function normalizeQuizTopic(topic) {
    return String(topic || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
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
    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-generate-quiz]");
        if (!button) return;

        event.preventDefault();
        applyGeneratedQuiz();
    });
});
