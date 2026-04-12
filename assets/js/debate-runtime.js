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
    const runtime = window.__educariaDebateRuntime || {
        activeIndex: 0,
        steps: []
    };

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
    const prevButton = document.querySelector("[data-debate-stage-prev]");
    const nextButton = document.querySelector("[data-debate-stage-next]");

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
        const sidesHidden = variantClass === "debate-variant--circle" ? "hidden" : "";
        const sideALabel = variantClass === "debate-variant--groups" ? "Grupo 1" : "Lado A";
        const sideBLabel = variantClass === "debate-variant--groups" ? "Grupo 2" : "Lado B";

        const layoutRoot = document.querySelector(".debate-stage-layout");
        const cardMarkup = `
            <article class="debate-stage-card debate-stage-card--full">
                <div class="debate-stage-head">
                    <div>
                        <span class="platform-section-label" data-debate-stage-format>${escapeDebateText(format)}</span>
                        <h1 data-debate-stage-title>${escapeDebateText(title)}</h1>
                    </div>
                    <div class="debate-stage-counter" data-debate-stage-counter>${escapeDebateText(stepCounter)}</div>
                </div>
                <div class="debate-stage-question" data-debate-stage-main-question>${escapeDebateText(mainQuestion)}</div>
                <div class="debate-stage-sides" ${sidesHidden}>
                    <article class="debate-stage-side">
                        <span class="platform-section-label" data-debate-stage-side-a-label>${escapeDebateText(sideALabel)}</span>
                        <strong data-debate-stage-side-a>${escapeDebateText(sideA)}</strong>
                    </article>
                    <article class="debate-stage-side">
                        <span class="platform-section-label" data-debate-stage-side-b-label>${escapeDebateText(sideBLabel)}</span>
                        <strong data-debate-stage-side-b>${escapeDebateText(sideB)}</strong>
                    </article>
                </div>
                <div class="debate-stage-content">
                    <section class="debate-stage-step">
                        <span class="platform-section-label" data-debate-stage-time>${escapeDebateText(step.time)}</span>
                        <h2 data-debate-stage-step-title>${escapeDebateText(step.title)}</h2>
                        <h3 data-debate-stage-step-question>${escapeDebateText(step.question)}</h3>
                    </section>
                    <aside class="debate-stage-guidance">
                        <span class="platform-section-label" data-debate-stage-guidance-label>${escapeDebateText(guidanceLabel)}</span>
                        <div class="debate-stage-guidance-text" data-debate-stage-guidance>${guidanceHtml}</div>
                    </aside>
                </div>
                <div class="debate-stage-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-debate-stage-prev>Anterior</button>
                    <button type="button" class="platform-link-button platform-link-primary" data-debate-stage-next>Próxima etapa</button>
                </div>
            </article>
        `;

        if (layoutRoot) {
            layoutRoot.innerHTML = cardMarkup;
        } else if (cardRoot) {
            cardRoot.innerHTML = cardMarkup;
        } else {
            setTextAll("[data-debate-stage-counter]", stepCounter);
            setTextAll("[data-debate-stage-time]", step.time);
            setTextAll("[data-debate-stage-step-title]", step.title);
            setTextAll("[data-debate-stage-step-question]", step.question);
            setHtmlAll("[data-debate-stage-guidance]", guidanceHtml);
        }

        const prevNow = document.querySelector("[data-debate-stage-prev]");
        const nextNow = document.querySelector("[data-debate-stage-next]");
        if (prevNow) prevNow.disabled = runtime.activeIndex === 0;
        if (nextNow) {
            nextNow.disabled = runtime.activeIndex === runtime.steps.length - 1;
            nextNow.textContent = runtime.activeIndex === runtime.steps.length - 1 ? "Última etapa" : "Próxima etapa";
        }
    };

    renderStep();

    if (!document.body?.dataset?.debateRuntimeBound) {
        document.body.dataset.debateRuntimeBound = "true";
        window.__educariaDebateRuntime = runtime;
        document.addEventListener("click", (event) => {
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
        if (event.key === "ArrowLeft" && runtime.activeIndex > 0) {
            runtime.activeIndex -= 1;
            renderStep();
        }

        if (event.key === "ArrowRight" && runtime.activeIndex < runtime.steps.length - 1) {
            runtime.activeIndex += 1;
            renderStep();
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDebateApplication);
} else {
    renderDebateApplication();
}

