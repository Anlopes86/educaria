const DEBATE_DRAFT_KEY = "educaria:builder:debate";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readDebateDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(DEBATE_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA debate unavailable:", error);
        return null;
    }
}

function parseDebateSteps(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-debate-step]")].map((step, index) => ({
        index,
        title: step.querySelector("[data-debate-title]")?.value?.trim() || `Etapa ${index + 1}`,
        time: step.querySelector("[data-debate-time]")?.value?.trim() || "5 min",
        question: step.querySelector("[data-debate-question]")?.value?.trim() || "Pergunta da etapa",
        guidance: step.querySelector("[data-debate-guidance]")?.value?.trim() || "Orientacao para conduzir essa etapa."
    }));
}

function escapeDebateText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function formatDebateGuidanceHtml(text) {
    const lines = String(text || "").split(/\r?\n/);
    const blocks = [];
    let paragraph = [];
    let bullets = [];

    const flushParagraph = () => {
        if (!paragraph.length) return;
        blocks.push(`<p>${paragraph.map((line) => escapeDebateText(line)).join("<br>")}</p>`);
        paragraph = [];
    };

    const flushBullets = () => {
        if (!bullets.length) return;
        blocks.push(`<ul>${bullets.map((line) => `<li>${escapeDebateText(line)}</li>`).join("")}</ul>`);
        bullets = [];
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            flushParagraph();
            flushBullets();
            return;
        }

        if (/^[-*]\s+/.test(line)) {
            flushParagraph();
            bullets.push(line.replace(/^[-*]\s+/, ""));
            return;
        }

        flushBullets();
        paragraph.push(line);
    });

    flushParagraph();
    flushBullets();

    return blocks.join("") || `<p>${escapeDebateText(text)}</p>`;
}

function renderDebateApplication() {
    const draft = readDebateDraft();
    const controls = draft?.controls || {};
    const steps = parseDebateSteps(draft?.stackHtml || "");
    const safeSteps = steps.length ? steps : [
        { title: "Abertura", time: "5 min", question: "Qual e a pergunta que vai orientar o debate?", guidance: "Apresente o tema e organize as primeiras falas." },
        { title: "Argumentacao", time: "8 min", question: "Quais sao os argumentos mais fortes de cada lado?", guidance: "Estimule justificativas e exemplos concretos." },
        { title: "Fechamento", time: "5 min", question: "O que podemos concluir com base no que foi discutido?", guidance: "Retome os pontos principais e feche a atividade." }
    ];

    const title = controls["debate-titulo"] || "Debate guiado";
    const format = controls["debate-formato"] || "Dois lados";
    const mainQuestion = controls["debate-pergunta"] || "Pergunta central do debate";
    const sideA = controls["debate-lado-a"] || "Posicao A";
    const sideB = controls["debate-lado-b"] || "Posicao B";

    const titleRoot = document.querySelector("[data-debate-stage-title]");
    const formatRoot = document.querySelector("[data-debate-stage-format]");
    const counterRoot = document.querySelector("[data-debate-stage-counter]");
    const mainQuestionRoot = document.querySelector("[data-debate-stage-main-question]");
    const sideARoot = document.querySelector("[data-debate-stage-side-a]");
    const sideBRoot = document.querySelector("[data-debate-stage-side-b]");
    const timeRoot = document.querySelector("[data-debate-stage-time]");
    const stepTitleRoot = document.querySelector("[data-debate-stage-step-title]");
    const stepQuestionRoot = document.querySelector("[data-debate-stage-step-question]");
    const guidanceRoot = document.querySelector("[data-debate-stage-guidance]");
    const prevButton = document.querySelector("[data-debate-stage-prev]");
    const nextButton = document.querySelector("[data-debate-stage-next]");

    let activeIndex = 0;

    if (titleRoot) titleRoot.textContent = title;
    if (formatRoot) formatRoot.textContent = format;
    if (mainQuestionRoot) mainQuestionRoot.textContent = mainQuestion;
    if (sideARoot) sideARoot.textContent = sideA;
    if (sideBRoot) sideBRoot.textContent = sideB;

    const renderStep = () => {
        const step = safeSteps[activeIndex];
        if (!step) return;

        if (counterRoot) counterRoot.textContent = `${activeIndex + 1} de ${safeSteps.length}`;
        if (timeRoot) timeRoot.textContent = step.time;
        if (stepTitleRoot) stepTitleRoot.textContent = step.title;
        if (stepQuestionRoot) stepQuestionRoot.textContent = step.question;
        if (guidanceRoot) guidanceRoot.innerHTML = formatDebateGuidanceHtml(step.guidance);
        if (prevButton) prevButton.disabled = activeIndex === 0;
        if (nextButton) nextButton.disabled = activeIndex === safeSteps.length - 1;
    };

    renderStep();

    if (prevButton) {
        prevButton.addEventListener("click", () => {
            if (activeIndex <= 0) return;
            activeIndex -= 1;
            renderStep();
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            if (activeIndex >= safeSteps.length - 1) return;
            activeIndex += 1;
            renderStep();
        });
    }
}

document.addEventListener("DOMContentLoaded", renderDebateApplication);
