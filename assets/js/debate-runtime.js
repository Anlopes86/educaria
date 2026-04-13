const DEBATE_DRAFT_KEY = "educaria:builder:debate";

const DEBATE_RENDER_INDEX_KEY = "educaria:debate:renderIndex";

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

    const readStepField = (step, selector) => {
        const field = step.querySelector(selector);
        if (!field) return "";

        if (field.tagName === "TEXTAREA") {
            return String(field.value || field.textContent || "").trim();
        }

        if (field.tagName === "INPUT") {
            return String(field.value || field.getAttribute("value") || field.defaultValue || field.textContent || "").trim();
        }

        return String(field.value || field.textContent || "").trim();
    };

    return [...doc.querySelectorAll("[data-debate-step]")].map((step, index) => ({
        index,
        title: readStepField(step, "[data-debate-title]") || `Etapa ${index + 1}`,
        time: readStepField(step, "[data-debate-time]") || "5 min",
        question: readStepField(step, "[data-debate-question]") || `Pergunta da etapa ${index + 1}`,
        guidance: readStepField(step, "[data-debate-guidance]") || `Orientação para conduzir a etapa ${index + 1}.`
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

function setDebateDensityClass(cardRoot, densityClass) {
    if (!cardRoot) return;
    cardRoot.classList.remove("debate-stage-card--compact", "debate-stage-card--dense");
    if (densityClass) {
        cardRoot.classList.add(densityClass);
    }
}

function isDebateOverflowing(cardRoot) {
    if (!cardRoot) return false;
    return cardRoot.scrollHeight > cardRoot.clientHeight + 4;
}

function applyDebateDensity(cardRoot, steps = [], viewport = {}) {
    if (!cardRoot) return;

    const densityOrder = ["", "debate-stage-card--compact", "debate-stage-card--dense"];
    const totalQuestionLength = steps.reduce((sum, step) => sum + String(step?.question || "").length, 0);
    const totalGuidanceLength = steps.reduce((sum, step) => sum + String(step?.guidance || "").length, 0);
    const longestQuestion = steps.reduce((max, step) => Math.max(max, String(step?.question || "").length), 0);
    const longestGuidance = steps.reduce((max, step) => Math.max(max, String(step?.guidance || "").length), 0);
    const stageHeight = Number(viewport.stageHeight || window.innerHeight);
    const stageWidth = Number(viewport.stageWidth || window.innerWidth);
    const viewportPenalty = Math.max(0, 860 - stageHeight) * 1.2 + Math.max(0, 1240 - stageWidth) * 0.18;
    const densityScore = (longestQuestion * 1.2)
        + (longestGuidance * 0.8)
        + (totalQuestionLength * 0.08)
        + (totalGuidanceLength * 0.04)
        + viewportPenalty;

    let densityIndex = 0;
    if (densityScore > 300) {
        densityIndex = 2;
    } else if (densityScore > 190) {
        densityIndex = 1;
    }

    for (let index = densityIndex; index < densityOrder.length; index += 1) {
        setDebateDensityClass(cardRoot, densityOrder[index]);
        if (!isDebateOverflowing(cardRoot)) {
            return;
        }
    }

    setDebateDensityClass(cardRoot, densityOrder[densityOrder.length - 1]);
}

function syncDebateGuidanceUi(runtime) {
    const isOpen = Boolean(runtime?.guidanceOpen);
    document.querySelectorAll("[data-debate-guidance-panel]").forEach((panel) => {
        panel.hidden = !isOpen;
    });
    document.querySelectorAll("[data-debate-guidance-toggle]").forEach((button) => {
        button.setAttribute("aria-expanded", String(isOpen));
        button.textContent = isOpen ? "Ocultar mediação" : "Mediação";
    });
}

function renderDebateApplication() {
    const runtime = window.__educariaDebateRuntime || {
        activeIndex: 0,
        steps: [],
        guidanceOpen: false
    };

    const draft = readDebateDraft();
    const controls = draft?.controls || {};
    const steps = Array.isArray(draft?.steps) && draft.steps.length
        ? draft.steps.map((step, index) => ({
            index,
            title: String(step?.title || "").trim() || `Etapa ${index + 1}`,
            time: String(step?.time || "").trim() || "5 min",
            question: String(step?.question || "").trim() || `Pergunta da etapa ${index + 1}`,
            guidance: String(step?.guidance || "").trim() || `Orientação para conduzir a etapa ${index + 1}.`
        }))
        : parseDebateSteps(draft?.stackHtml || "");
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
    const layoutRoot = document.querySelector(".debate-stage-layout--full");
    const topbar = document.querySelector(".debate-stage-shell > .presentation-topbar");
    const controlsRoot = document.querySelector(".debate-floating-controls");
    let viewport = {
        stageHeight: window.innerHeight,
        stageWidth: window.innerWidth
    };
    let resizeFrame = 0;

    const setTextAll = (selector, value) => {
        document.querySelectorAll(selector).forEach((node) => {
            node.textContent = value;
        });
    };

    const setHtmlAll = (selector, value) => {
        document.querySelectorAll(selector).forEach((node) => {
            node.innerHTML = value;
        });
    };

    runtime.steps = safeSteps;
    if (runtime.activeIndex >= safeSteps.length) {
        runtime.activeIndex = Math.max(0, safeSteps.length - 1);
    }
    window.__educariaDebateRuntime = runtime;

    const updateViewportMetrics = () => {
        const shell = document.querySelector(".debate-stage-shell");
        const shellStyles = shell ? getComputedStyle(shell) : null;
        const shellPadding = shellStyles
            ? parseFloat(shellStyles.paddingTop || 0) + parseFloat(shellStyles.paddingBottom || 0)
            : 0;
        const shellGap = shellStyles ? parseFloat(shellStyles.rowGap || shellStyles.gap || 0) : 0;
        const topbarHeight = topbar?.offsetHeight || 0;
        const controlsHeight = controlsRoot?.offsetHeight || 0;
        const layoutGap = layoutRoot ? parseFloat(getComputedStyle(layoutRoot).rowGap || 0) : 0;

        viewport = {
            stageHeight: Math.max(320, window.innerHeight - shellPadding - shellGap - topbarHeight - controlsHeight - layoutGap - 24),
            stageWidth: Math.max(320, layoutRoot?.clientWidth || window.innerWidth)
        };
    };
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

    setTextAll("[data-debate-stage-title]", title);
    setTextAll("[data-debate-stage-format]", format);
    setTextAll("[data-debate-stage-main-question]", mainQuestion);
    setTextAll("[data-debate-stage-side-a]", sideA);
    setTextAll("[data-debate-stage-side-b]", sideB);

    setTextAll("[data-debate-stage-side-a-label]", variantClass === "debate-variant--groups" ? "Grupo 1" : "Lado A");
    setTextAll("[data-debate-stage-side-b-label]", variantClass === "debate-variant--groups" ? "Grupo 2" : "Lado B");
    const guidanceLabel = modeClass === "debate-mode--guided" ? "Condução" : "Mediação";
    setTextAll("[data-debate-stage-guidance-label]", guidanceLabel);

    const renderStep = () => {
        const step = runtime.steps[runtime.activeIndex];
        if (!step) return;

        const guidanceHtml = formatDebateGuidanceHtml(step.guidance);
        const stepCounter = `${runtime.activeIndex + 1} de ${runtime.steps.length}`;
        const sideALabel = variantClass === "debate-variant--groups" ? "Grupo 1" : "Lado A";
        const sideBLabel = variantClass === "debate-variant--groups" ? "Grupo 2" : "Lado B";

        if (cardRoot) {
            cardRoot.classList.remove("debate-variant--circle", "debate-variant--groups", "debate-variant--sides");
            cardRoot.classList.remove("debate-mode--question", "debate-mode--guided", "debate-mode--balanced");
            cardRoot.classList.add(variantClass, modeClass);
        }

        if (sidesRoot) {
            sidesRoot.hidden = variantClass === "debate-variant--circle";
        }

        setTextAll("[data-debate-stage-counter]", stepCounter);
        setTextAll("[data-debate-stage-time]", step.time);
        setTextAll("[data-debate-stage-step-title]", step.title);
        setTextAll("[data-debate-stage-step-question]", step.question);
        setTextAll("[data-debate-stage-side-a-label]", sideALabel);
        setTextAll("[data-debate-stage-side-b-label]", sideBLabel);
        setHtmlAll("[data-debate-stage-guidance]", guidanceHtml);

        document.querySelectorAll("[data-debate-stage-prev]").forEach((button) => {
            button.disabled = runtime.activeIndex === 0;
        });

        document.querySelectorAll("[data-debate-stage-next]").forEach((button) => {
            button.disabled = runtime.activeIndex === runtime.steps.length - 1;
            button.textContent = runtime.activeIndex === runtime.steps.length - 1 ? "Última etapa" : "Próxima";
        });

        syncDebateGuidanceUi(runtime);
        applyDebateDensity(cardRoot, runtime.steps, viewport);
    };

    updateViewportMetrics();
    renderStep();

    if (!document.body?.dataset?.debateRuntimeBound) {
        document.body.dataset.debateRuntimeBound = "true";
        window.__educariaDebateRuntime = runtime;
        document.addEventListener("click", (event) => {
            const guidanceToggle = event.target.closest("[data-debate-guidance-toggle]");
            if (guidanceToggle) {
                event.preventDefault();
                runtime.guidanceOpen = !runtime.guidanceOpen;
                syncDebateGuidanceUi(runtime);
                return;
            }

            const guidanceClose = event.target.closest("[data-debate-guidance-close]");
            if (guidanceClose) {
                event.preventDefault();
                runtime.guidanceOpen = false;
                syncDebateGuidanceUi(runtime);
                return;
            }

            const prevTrigger = event.target.closest("[data-debate-stage-prev]");
            if (prevTrigger) {
                event.preventDefault();
                const now = Date.now();
                if (runtime.lastAdvanceAt && now - runtime.lastAdvanceAt < 150) return;
                runtime.lastAdvanceAt = now;
                if (runtime.activeIndex <= 0) return;
                runtime.activeIndex -= 1;
                renderStep();
                return;
            }

            const nextTrigger = event.target.closest("[data-debate-stage-next]");
            if (nextTrigger) {
                event.preventDefault();
                const now = Date.now();
                if (runtime.lastAdvanceAt && now - runtime.lastAdvanceAt < 150) return;
                runtime.lastAdvanceAt = now;
                if (runtime.activeIndex >= runtime.steps.length - 1) return;
                runtime.activeIndex += 1;
                renderStep();
            }
        });
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && runtime.guidanceOpen) {
            runtime.guidanceOpen = false;
            syncDebateGuidanceUi(runtime);
            return;
        }

        if (event.key === "ArrowLeft" && runtime.activeIndex > 0) {
            runtime.activeIndex -= 1;
            renderStep();
        }

        if (event.key === "ArrowRight" && runtime.activeIndex < runtime.steps.length - 1) {
            runtime.activeIndex += 1;
            renderStep();
        }
    });

    window.addEventListener("resize", () => {
        if (resizeFrame) {
            window.cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = window.requestAnimationFrame(() => {
            updateViewportMetrics();
            renderStep();
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDebateApplication);
} else {
    renderDebateApplication();
}
