function builderTemplateEscape(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function builderTemplateNormalize(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function builderTemplateSetSelect(select, value) {
    if (!select) return;

    const normalized = builderTemplateNormalize(value);
    const option = [...select.options].find((item) => {
        return builderTemplateNormalize(item.value || item.textContent) === normalized;
    });

    if (option) {
        select.value = option.value;
        return;
    }

    select.selectedIndex = 0;
}

function builderTemplateSetQuizType(select, value) {
    if (!select) return;

    const wanted = builderTemplateNormalize(value);
    const match = [...select.options].find((item) => {
        const raw = String(item.value || item.textContent || "").toLowerCase();
        if (wanted.includes("aberta")) return raw.includes("aberta");
        if (wanted.includes("verdadeiro")) return raw.includes("verdadeiro") || raw.includes("falso");
        return raw.includes("escolha") || raw.includes("multipla");
    });

    select.selectedIndex = match ? match.index : 0;
}

function builderTemplateClearField(field) {
    if (!field) return;
    if (field.tagName === "SELECT") {
        field.selectedIndex = 0;
        return;
    }
    if (field.type !== "color") {
        field.value = "";
    }
}

function builderTemplateCloneCard(template, labelPrefix, index) {
    const card = template.cloneNode(true);
    card.querySelectorAll("input, textarea, select").forEach(builderTemplateClearField);
    const label = card.querySelector("[data-card-label]");
    if (label) label.textContent = `${labelPrefix} ${index + 1}`;
    card.querySelectorAll(".activity-optional-disclosure").forEach((details) => {
        if (details instanceof HTMLDetailsElement) details.open = false;
    });
    return card;
}

function builderTemplateHasContent(stack) {
    if (!stack) return false;
    return [...stack.querySelectorAll("input, textarea")].some((field) => {
        if (field.type === "color" || field.type === "file") return false;
        return String(field.value || "").trim();
    });
}

function builderTemplateConfirmReplace(stack) {
    if (!builderTemplateHasContent(stack)) return true;
    return window.confirm("Substituir o conteudo atual por este modelo?");
}

function builderTemplateDispatch() {
    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
}

function builderTemplateStatusNode() {
    let node = document.querySelector("[data-builder-template-status]");
    if (node) return node;

    node = document.createElement("p");
    node.className = "sr-only";
    node.setAttribute("data-builder-template-status", "");
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-atomic", "true");
    document.body.appendChild(node);
    return node;
}

function builderTemplateAnnounce(message) {
    const node = builderTemplateStatusNode();
    node.textContent = "";
    window.setTimeout(() => {
        node.textContent = message;
    }, 20);
}

function builderTemplateSetBusy(stack, isBusy) {
    if (!stack) return;
    stack.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function builderTemplateApplyQuiz(templateId) {
    const stack = document.querySelector("[data-quiz-stack]");
    const templates = [...document.querySelectorAll("[data-quiz-question]")].map((card) => card.cloneNode(true));
    if (!stack || !templates.length || !builderTemplateConfirmReplace(stack)) return;

    const payloads = {
        review: {
            title: "Revisao em 5 min",
            format: "Misto",
            questions: [
                {
                    type: "Multipla escolha",
                    prompt: "Qual ideia principal da aula de hoje precisa ficar clara?",
                    correct: "Alternativa B",
                    options: ["Um detalhe secundario", "O conceito central", "Uma curiosidade", "Uma excecao"],
                    explanation: "A pergunta revisa o objetivo central antes de avancar."
                },
                {
                    type: "Verdadeiro ou falso",
                    prompt: "Consigo explicar o conceito principal usando um exemplo.",
                    correct: "Alternativa A",
                    options: ["Verdadeiro", "Falso"],
                    explanation: "A resposta deve ser discutida rapidamente com a turma."
                },
                {
                    type: "Pergunta aberta",
                    prompt: "Escreva um exemplo que mostre que voce entendeu o tema.",
                    criteria: "Exemplo coerente com o conceito",
                    model: "Resposta com exemplo proprio e justificativa curta.",
                    explanation: "Valorize respostas que conectem conceito e exemplo."
                }
            ]
        },
        diagnostic: {
            title: "Diagnostico rapido",
            format: "Misto",
            questions: [
                {
                    type: "Multipla escolha",
                    prompt: "Antes de comecar, o que voce ja sabe sobre este tema?",
                    correct: "Alternativa A",
                    options: ["Tenho uma ideia inicial", "Nunca ouvi falar", "Sei aplicar sozinho", "Nao tenho certeza"],
                    explanation: "Use a distribuicao de respostas para calibrar a aula."
                },
                {
                    type: "Pergunta aberta",
                    prompt: "Qual pergunta voce gostaria de responder ao final da aula?",
                    criteria: "Duvida relacionada ao tema",
                    model: "Pergunta clara sobre conceito, uso ou exemplo.",
                    explanation: "As respostas ajudam a ajustar a explicacao."
                },
                {
                    type: "Verdadeiro ou falso",
                    prompt: "Este tema aparece em situacoes do dia a dia.",
                    correct: "Alternativa A",
                    options: ["Verdadeiro", "Falso"],
                    explanation: "Abra uma conversa curta com exemplos dos alunos."
                }
            ]
        },
        exit: {
            title: "Ticket de saida",
            format: "Perguntas abertas",
            questions: [
                {
                    type: "Pergunta aberta",
                    prompt: "O que ficou mais claro para voce hoje?",
                    criteria: "Referencia a uma aprendizagem da aula",
                    model: "Hoje entendi que...",
                    explanation: "Cheque se o aluno nomeia uma aprendizagem concreta."
                },
                {
                    type: "Pergunta aberta",
                    prompt: "Que parte ainda precisa de revisao?",
                    criteria: "Duvida ou ponto de inseguranca",
                    model: "Ainda preciso rever...",
                    explanation: "Use as respostas para planejar retomada."
                }
            ]
        }
    };

    const payload = payloads[templateId] || payloads.review;
    builderTemplateSetBusy(stack, true);
    stack.innerHTML = "";
    payload.questions.forEach((question, index) => {
        const desiredType = builderTemplateNormalize(question.type).includes("aberta") ? "pergunta aberta" : "multipla escolha";
        const source = templates.find((card) => builderTemplateNormalize(card.querySelector('[data-field="type"]')?.value) === desiredType) || templates[0];
        const card = builderTemplateCloneCard(source, "Questao", index);
        const prompt = card.querySelector('[data-field="prompt"]');
        const type = card.querySelector('[data-field="type"]');
        const correct = card.querySelector('[data-field="correct"]');
        const explanation = card.querySelector('[data-field="explanation"]');
        const criteria = card.querySelector('[data-field="criteria"]');
        const model = card.querySelector('[data-field="model"]');

        if (prompt) prompt.value = question.prompt;
        builderTemplateSetQuizType(type, question.type);
        builderTemplateSetSelect(correct, question.correct);
        if (explanation) explanation.value = question.explanation || "";
        if (criteria) criteria.value = question.criteria || "";
        if (model) model.value = question.model || "";
        [...card.querySelectorAll("[data-option]")].forEach((field, optionIndex) => {
            field.value = question.options?.[optionIndex] || "";
        });
        stack.appendChild(card);
    });

    const topic = document.getElementById("quiz-tema");
    const format = document.getElementById("quiz-formato");
    const count = document.getElementById("quiz-quantidade");
    if (topic) topic.value = payload.title;
    builderTemplateSetSelect(format, payload.format);
    if (count) count.value = String(payload.questions.length);
    builderTemplateDispatch();
    builderTemplateSetBusy(stack, false);
    builderTemplateAnnounce(`Modelo ${payload.title} aplicado ao quiz.`);
}

function builderTemplateApplySlides(templateId) {
    const stack = document.querySelector("[data-slides-stack]");
    const template = document.querySelector("[data-slide-card]")?.cloneNode(true);
    if (!stack || !template || !builderTemplateConfirmReplace(stack)) return;

    const payloads = {
        opener: [
            ["Abertura da aula", "Tema, objetivo e combinados", "Hoje vamos entender a ideia principal, observar um exemplo e fechar com uma pergunta de revisao."],
            ["Por que isso importa?", "Conexao com a turma", "Mostre uma situacao real em que este conteudo aparece e convide os alunos a antecipar respostas."],
            ["Pergunta-guia", "Foco da investigacao", "Ao final, cada aluno deve conseguir responder: como eu reconheco e aplico este conceito?"]
        ],
        concept: [
            ["Conceito central", "Definicao curta", "Apresente a definicao em linguagem simples e destaque as palavras essenciais."],
            ["Exemplo resolvido", "Passo a passo", "Mostre um exemplo completo, explicando uma decisao por vez."],
            ["Agora tente", "Aplicacao guiada", "Proponha uma variacao curta para a turma resolver junto antes da atividade individual."]
        ],
        closing: [
            ["Retomada final", "Tres ideias para guardar", "Liste os pontos que nao podem ficar de fora da aula."],
            ["Cheque rapido", "Pergunta de saida", "Peca uma resposta curta que mostre se o objetivo foi alcancado."],
            ["Proxima aula", "Gancho", "Indique como o tema vai continuar e qual material pode ser revisado."]
        ]
    };

    const slides = payloads[templateId] || payloads.concept;
    builderTemplateSetBusy(stack, true);
    stack.innerHTML = "";
    slides.forEach(([title, subtitle, body], index) => {
        const card = builderTemplateCloneCard(template, "Slide", index);
        const titleField = card.querySelector('[data-field="slide-title"]');
        const subtitleField = card.querySelector('[data-field="slide-subtitle"]');
        const bodyField = card.querySelector('[data-field="slide-body"]');
        const imageMode = card.querySelector('[data-field="slide-image-mode"]');
        if (titleField) titleField.value = title;
        if (subtitleField) subtitleField.value = subtitle;
        if (bodyField) bodyField.value = body;
        builderTemplateSetSelect(imageMode, index === 0 ? "Placeholder local" : "Sem imagem");
        stack.appendChild(card);
    });
    builderTemplateDispatch();
    builderTemplateSetBusy(stack, false);
    builderTemplateAnnounce("Modelo aplicado aos slides.");
}

function builderTemplateApplyFlashcards(templateId) {
    const stack = document.querySelector("[data-flashcards-stack]");
    const template = document.querySelector("[data-flashcard]")?.cloneNode(true);
    if (!stack || !template || !builderTemplateConfirmReplace(stack)) return;

    const payloads = {
        vocab: [
            ["Conceito-chave", "Definicao curta", "Use um exemplo oral antes de virar o card."],
            ["Exemplo", "Situacao que mostra o conceito", "Peca aos alunos outro exemplo."],
            ["Contraexemplo", "Situacao parecida, mas incorreta", "Ajuda a evitar confusoes comuns."],
            ["Aplicacao", "Quando usar esta ideia", "Feche com uma pergunta rapida."]
        ],
        fractions: [
            ["Numerador", "Parte de cima da fracao", "Mostra quantas partes foram consideradas."],
            ["Denominador", "Parte de baixo da fracao", "Mostra em quantas partes o inteiro foi dividido."],
            ["Fracao equivalente", "Representa a mesma quantidade", "Ex.: 1/2 e 2/4."],
            ["Simplificar", "Escrever a fracao em forma menor", "Divida numerador e denominador pelo mesmo numero."]
        ],
        language: [
            ["Main idea", "Ideia principal", "Use para identificar o foco do texto."],
            ["Evidence", "Evidencia", "Trecho que sustenta uma resposta."],
            ["Inference", "Inferencia", "Conclusao feita com pistas do texto."],
            ["Context", "Contexto", "Informacoes ao redor que ajudam a entender."]
        ]
    };

    const cards = payloads[templateId] || payloads.vocab;
    builderTemplateSetBusy(stack, true);
    stack.innerHTML = "";
    cards.forEach(([front, back, example], index) => {
        const card = builderTemplateCloneCard(template, "Card", index);
        const frontField = card.querySelector('[data-field="front"]');
        const backField = card.querySelector('[data-field="back"]');
        const exampleField = card.querySelector('[data-field="example"]');
        if (frontField) frontField.value = front;
        if (backField) backField.value = back;
        if (exampleField) exampleField.value = example;
        stack.appendChild(card);
    });
    builderTemplateDispatch();
    builderTemplateSetBusy(stack, false);
    builderTemplateAnnounce("Modelo aplicado aos flashcards.");
}

function bindBuilderTemplates() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-builder-template]");
        if (!trigger) return;

        event.preventDefault();
        const type = document.body.dataset.materialType || "";
        const templateId = trigger.dataset.builderTemplate || "";

        if (type === "quiz") builderTemplateApplyQuiz(templateId);
        if (type === "slides") builderTemplateApplySlides(templateId);
        if (type === "flashcards") builderTemplateApplyFlashcards(templateId);
    });
}

document.addEventListener("DOMContentLoaded", bindBuilderTemplates);
