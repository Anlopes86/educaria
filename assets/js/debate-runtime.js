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
        guidance: step.querySelector("[data-debate-guidance]")?.value?.trim() || "Orienta??o para conduzir esta etapa."
    }));
}

function escapeDebateText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function normalizeDebateToken(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
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
        { title: "Abertura", time: "5 min", question: "Qual ? a pergunta que vai orientar o debate?", guidance: "Apresente o tema e organize as primeiras falas." },
        { title: "Argumentação", time: "8 min", question: "Quais são os argumentos mais fortes de cada lado?", guidance: "Estimule justificativas e exemplos concretos." },
        { title: "Fechamento", time: "5 min", question: "O que podemos concluir com base no que foi discutido?", guidance: "Retome os pontos principais e feche a atividade." }
    ];

    const title = controls["debate-titulo"] || "Debate guiado";
    const format = controls["debate-formato"] || "Dois lados";
    const aiMode = controls["debate-acao-ia"] || "Organizar roteiro de debate";
    const mainQuestion = controls["debate-pergunta"] || "Pergunta central do debate";
    const sideA = controls["debate-lado-a"] || "Posição A";
    const sideB = controls["debate-lado-b"] || "Posição B";

    const cardRoot = document.querySelector(".debate-stage-card");
    const sidesRoot = document.querySelector(".debate-stage-sides");
    const sideALabelRoot = document.querySelector("[data-debate-stage-side-a-label]");
    const sideBLabelRoot = document.querySelector("[data-debate-stage-side-b-label]");
    const guidanceLabelRoot = document.querySelector("[data-debate-stage-guidance-label]");
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
    const normalizedFormat = normalizeDebateToken(format);
    const normalizedAiMode = normalizeDebateToken(aiMode);

    const variantClass = normalizedFormat.includes("roda guiada")
        ? "debate-variant--circle"
        : normalizedFormat.includes("grupos")
            ? "debate-variant--groups"
            : "debate-variant--sides";

    const modeClass = normalizedAiMode.includes("criar pergunta central")
        ? "debate-mode--question"
        : normalizedAiMode.includes("discussao guiada")
            ? "debate-mode--guided"
            : "debate-mode--balanced";

    if (cardRoot) {
        cardRoot.classList.remove("debate-variant--circle", "debate-variant--groups", "debate-variant--sides");
        cardRoot.classList.remove("debate-mode--question", "debate-mode--guided", "debate-mode--balanced");
        cardRoot.classList.add(variantClass, modeClass);
    }

    if (titleRoot) titleRoot.textContent = title;
    if (formatRoot) formatRoot.textContent = format;
    if (mainQuestionRoot) mainQuestionRoot.textContent = mainQuestion;
    if (sideARoot) sideARoot.textContent = sideA;
    if (sideBRoot) sideBRoot.textContent = sideB;

    if (sidesRoot) {
        sidesRoot.hidden = variantClass === "debate-variant--circle";
    }

    if (sideALabelRoot) {
        sideALabelRoot.textContent = variantClass === "debate-variant--groups" ? "Grupo 1" : "Lado A";
    }

    if (sideBLabelRoot) {
        sideBLabelRoot.textContent = variantClass === "debate-variant--groups" ? "Grupo 2" : "Lado B";
    }

    if (guidanceLabelRoot) {
        guidanceLabelRoot.textContent = modeClass === "debate-mode--guided"
            ? "Condução"
                        : "Mediação";
    }

    const renderStep = () => {
        const step = safeSteps[activeIndex];
        if (!step) return;

        if (counterRoot) counterRoot.textContent = `${activeIndex + 1} de ${safeSteps.length}`;
        if (timeRoot) timeRoot.textContent = step.time;
        if (stepTitleRoot) stepTitleRoot.textContent = step.title;
        if (stepQuestionRoot) stepQuestionRoot.textContent = step.question;
        if (guidanceRoot) guidanceRoot.innerHTML = formatDebateGuidanceHtml(step.guidance);
        if (prevButton) prevButton.disabled = activeIndex === 0;
        if (nextButton) {
            nextButton.disabled = activeIndex === safeSteps.length - 1;
            nextButton.textContent = activeIndex === safeSteps.length - 1 ? "Última etapa" : "Próxima etapa";
        }
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

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" && activeIndex > 0) {
            activeIndex -= 1;
            renderStep();
        }

        if (event.key === "ArrowRight" && activeIndex < safeSteps.length - 1) {
            activeIndex += 1;
            renderStep();
        }
    });
}

document.addEventListener("DOMContentLoaded", renderDebateApplication);

