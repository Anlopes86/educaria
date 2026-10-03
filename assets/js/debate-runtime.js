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

function writeDebateDraft(state) {
    try {
        localStorage.setItem(scopedStorageKey(DEBATE_DRAFT_KEY), JSON.stringify(state));
    } catch (error) {
        console.warn("EducarIA debate save unavailable:", error);
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

function escapeDebateAttr(value) {
    return escapeDebateText(value).replaceAll('"', "&quot;");
}

function normalizeDebateToken(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function normalizeDebateEditableValue(value, multiline = false) {
    const text = String(value ?? "").replace(/\r/g, "").replace(/\u00a0/g, " ");
    if (multiline) {
        return text
            .split("\n")
            .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
            .join("\n")
            .trim();
    }

    return text.replace(/\s+/g, " ").trim();
}

function readDebateEditableValue(node, multiline = false) {
    const rawValue = multiline ? node.innerText : node.textContent;
    return normalizeDebateEditableValue(rawValue, multiline);
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

function debateStepTemplate(index, step = {}) {
    const title = escapeDebateAttr(step.title || "");
    const time = escapeDebateAttr(step.time || "");
    const question = escapeDebateAttr(step.question || "");
    const guidance = escapeDebateText(step.guidance || "");

    return `
        <section class="platform-question-card activity-content-card debate-step-card" data-debate-step>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-debate-label>Etapa ${index + 1}</span>
                    <h3>Conteúdo da etapa</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-debate-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Título da etapa</label>
                    <input data-debate-title type="text" value="${title}">
                </div>
                <div class="platform-field">
                    <label>Tempo sugerido</label>
                    <input data-debate-time type="text" value="${time}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Pergunta da etapa</label>
                    <input data-debate-question type="text" value="${question}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Orientação de mediação</label>
                    <textarea data-debate-guidance rows="4">${guidance}</textarea>
                </div>
            </div>
        </section>
    `;
}

function serializeDebateSteps(steps) {
    return steps.map((step, index) => debateStepTemplate(index, step)).join("");
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

function debateDurationSeconds(value) {
    const text = String(value || "").trim().toLowerCase();
    const clock = text.match(/^(\d+):(\d{1,2})$/);
    const number = text.match(/\d+(?:[.,]\d+)?/);
    const seconds = clock ? Number(clock[1]) * 60 + Number(clock[2])
        : number ? Number(number[0].replace(",", ".")) * (/\b(s|seg|segundos?)\b/.test(text) ? 1 : 60) : 300;
    return Math.max(1, Math.min(14400, Math.round(seconds)));
}

function createDebateTimer(seconds, now = () => Date.now()) {
    let remaining = seconds * 1000;
    let deadline = null;
    const read = () => deadline === null ? remaining : Math.max(0, deadline - now());
    return {
        seconds: () => Math.ceil(read() / 1000),
        running: () => deadline !== null && read() > 0,
        start() { if (deadline === null && remaining > 0) deadline = now() + remaining; },
        pause() { remaining = read(); deadline = null; },
        reset(value = seconds) { remaining = value * 1000; deadline = null; }
    };
}

function renderDebateApplication() {
    const runtime = window.__educariaDebateRuntime || {
        activeIndex: 0,
        steps: [],
        guidanceOpen: false,
        inlineEditEnabled: false,
        draftState: null,
        saveTimer: 0
    };

    const initialDraft = readDebateDraft() || {};
    const controls = { ...(initialDraft.controls || {}) };
    const parsedSteps = Array.isArray(initialDraft.steps) && initialDraft.steps.length
        ? initialDraft.steps.map((step, index) => ({
            index,
            title: String(step?.title || "").trim() || `Etapa ${index + 1}`,
            time: String(step?.time || "").trim() || "5 min",
            question: String(step?.question || "").trim() || `Pergunta da etapa ${index + 1}`,
            guidance: String(step?.guidance || "").trim() || `Orientação para conduzir a etapa ${index + 1}.`
        }))
        : parseDebateSteps(initialDraft.stackHtml || "");

    const safeSteps = parsedSteps.length ? parsedSteps : [
        { title: "Abertura", time: "5 min", question: "Qual é a pergunta que vai orientar o debate?", guidance: "Apresente o tema e organize as primeiras falas." },
        { title: "Argumentação", time: "8 min", question: "Quais são os argumentos mais fortes de cada lado?", guidance: "Estimule justificativas e exemplos concretos." },
        { title: "Fechamento", time: "5 min", question: "O que podemos concluir com base no que foi discutido?", guidance: "Retome os pontos principais e feche a atividade." }
    ].map((step, index) => ({ ...step, index }));

    controls["debate-titulo"] = controls["debate-titulo"] || "Debate guiado";
    controls["debate-formato"] = normalizeDebateToken(controls["debate-formato"]).includes("roda guiada")
        ? "Roda guiada"
        : "Dois lados";
    controls["debate-acao-ia"] = controls["debate-acao-ia"] || "Organizar roteiro de debate";
    controls["debate-pergunta"] = controls["debate-pergunta"] || "Pergunta central do debate";
    controls["debate-lado-a"] = controls["debate-lado-a"] || "Posição A";
    controls["debate-lado-b"] = controls["debate-lado-b"] || "Posição B";

    runtime.draftState = {
        ...initialDraft,
        controls,
        steps: safeSteps.map((step, index) => ({ ...step, index })),
        stackHtml: serializeDebateSteps(safeSteps)
    };
    runtime.steps = runtime.draftState.steps;
    if (runtime.activeIndex >= runtime.steps.length) {
        runtime.activeIndex = Math.max(0, runtime.steps.length - 1);
    }
    window.__educariaDebateRuntime = runtime;

    const cardRoot = document.querySelector(".debate-stage-card");
    const sidesRoot = document.querySelector(".debate-stage-sides");
    const progressRoot = document.querySelector("[data-debate-stage-progress]");
    const layoutRoot = document.querySelector(".debate-stage-layout--full");
    const topbar = document.querySelector(".debate-stage-shell > .presentation-topbar");
    const controlsRoot = document.querySelector(".debate-floating-controls");
    let viewport = {
        stageHeight: window.innerHeight,
        stageWidth: window.innerWidth
    };
    let resizeFrame = 0;
    const roundTimers = new Map();
    let timerIndex = runtime.activeIndex;
    const activeTimer = () => {
        if (!roundTimers.has(runtime.activeIndex)) roundTimers.set(runtime.activeIndex, createDebateTimer(debateDurationSeconds(runtime.steps[runtime.activeIndex]?.time)));
        return roundTimers.get(runtime.activeIndex);
    };
    const paintTimer = () => {
        const timer = activeTimer();
        const seconds = timer.seconds();
        const output = document.querySelector("[data-debate-timer]");
        const toggle = document.querySelector("[data-debate-timer-toggle]");
        const status = document.querySelector("[data-debate-timer-status]");
        const clockText = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
        if (output) { if (output.textContent !== clockText) output.textContent = clockText; output.dataset.finished = String(seconds === 0); }
        if (toggle) { toggle.textContent = timer.running() ? "Pausar" : "Iniciar"; toggle.disabled = seconds === 0; }
        const statusText = seconds === 0 ? "Tempo encerrado" : "";
        if (status && status.textContent !== statusText) status.textContent = statusText;
    };
    document.querySelector("[data-debate-timer-toggle]")?.addEventListener("click", () => {
        const timer = activeTimer(); if (timer.running()) timer.pause(); else timer.start(); paintTimer();
    });
    document.querySelector("[data-debate-timer-reset]")?.addEventListener("click", () => {
        activeTimer().reset(debateDurationSeconds(runtime.steps[runtime.activeIndex]?.time)); paintTimer();
    });
    const timerInterval = window.setInterval(paintTimer, 250);
    window.addEventListener("pagehide", () => window.clearInterval(timerInterval), { once: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { activeTimer().pause(); paintTimer(); } });

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

    const format = runtime.draftState.controls["debate-formato"];
    const aiMode = runtime.draftState.controls["debate-acao-ia"];
    const normalizedFormat = normalizeDebateToken(format);
    const normalizedAiMode = normalizeDebateToken(aiMode);

    const variantClass = normalizedFormat.includes("roda guiada")
        ? "debate-variant--circle"
        : "debate-variant--sides";

    const modeClass = normalizedAiMode.includes("criar pergunta central")
        ? "debate-mode--question"
        : normalizedAiMode.includes("discussao guiada")
            ? "debate-mode--guided"
            : "debate-mode--balanced";

    const applyCardVariant = () => {
        if (!cardRoot) return;
        cardRoot.classList.remove("debate-variant--circle", "debate-variant--sides");
        cardRoot.classList.remove("debate-mode--question", "debate-mode--guided", "debate-mode--balanced");
        cardRoot.classList.add(variantClass, modeClass);
    };

    const syncDebateInlineEditUi = () => {
        document.body.classList.toggle("debate-inline-editing", Boolean(runtime.inlineEditEnabled));

        document.querySelectorAll("[data-debate-inline-edit-toggle]").forEach((button) => {
            button.setAttribute("aria-pressed", String(Boolean(runtime.inlineEditEnabled)));
            button.textContent = runtime.inlineEditEnabled ? "Concluir edição" : "Editar aqui";
        });

        document.querySelectorAll("[data-debate-inline-edit-note]").forEach((note) => {
            note.hidden = !runtime.inlineEditEnabled;
        });

        document.querySelectorAll("[data-debate-editable]").forEach((node) => {
            if (runtime.inlineEditEnabled) {
                node.setAttribute("contenteditable", "true");
                node.setAttribute("spellcheck", "true");
                node.setAttribute("tabindex", "0");
                node.setAttribute("role", "textbox");
                return;
            }

            node.removeAttribute("contenteditable");
            node.removeAttribute("spellcheck");
            node.removeAttribute("tabindex");
            node.removeAttribute("role");
        });
    };

    const persistRuntimeDraft = () => {
        runtime.draftState.steps = runtime.steps.map((step, index) => ({
            index,
            title: String(step?.title || ""),
            time: String(step?.time || ""),
            question: String(step?.question || ""),
            guidance: String(step?.guidance || "")
        }));
        runtime.draftState.stackHtml = serializeDebateSteps(runtime.draftState.steps);
        writeDebateDraft(runtime.draftState);
    };

    const scheduleDraftSave = () => {
        window.clearTimeout(runtime.saveTimer);
        runtime.saveTimer = window.setTimeout(persistRuntimeDraft, 140);
    };

    const renderStaticFields = () => {
        applyCardVariant();
        setTextAll("[data-debate-stage-title]", runtime.draftState.controls["debate-titulo"]);
        setTextAll("[data-debate-stage-format]", runtime.draftState.controls["debate-formato"]);
        setTextAll("[data-debate-stage-main-question]", runtime.draftState.controls["debate-pergunta"]);
        setTextAll("[data-debate-stage-side-a]", runtime.draftState.controls["debate-lado-a"]);
        setTextAll("[data-debate-stage-side-b]", runtime.draftState.controls["debate-lado-b"]);
        setTextAll("[data-debate-stage-side-a-label]", "Defende");
        setTextAll("[data-debate-stage-side-b-label]", "Contesta");
        setTextAll("[data-debate-stage-guidance-label]", modeClass === "debate-mode--guided" ? "Condução" : "Mediação");
    };

    const renderProgress = () => {
        if (!progressRoot) return;

        progressRoot.innerHTML = runtime.steps.map((step, index) => {
            const stateClass = index === runtime.activeIndex
                ? " is-active"
                : index < runtime.activeIndex
                    ? " is-complete"
                    : "";
            const ariaCurrent = index === runtime.activeIndex ? ' aria-current="step"' : "";
            const title = escapeDebateText(step.title || `Etapa ${index + 1}`);
            const time = escapeDebateText(step.time || "5 min");
            const accessibleLabel = escapeDebateAttr(`Ir para a etapa ${index + 1}: ${step.title || `Etapa ${index + 1}`}`);

            return `
                <button type="button" class="debate-stage-progress-item${stateClass}" data-debate-stage-jump="${index}" aria-label="${accessibleLabel}"${ariaCurrent}>
                    <span class="debate-stage-progress-number">${index + 1}</span>
                    <span class="debate-stage-progress-copy">
                        <strong>${title}</strong>
                        <small>${time}</small>
                    </span>
                </button>
            `;
        }).join("");

        const activeProgress = progressRoot.querySelector(".is-active");
        if (activeProgress) {
            const itemLeft = activeProgress.offsetLeft;
            const itemRight = itemLeft + activeProgress.offsetWidth;
            const visibleLeft = progressRoot.scrollLeft;
            const visibleRight = visibleLeft + progressRoot.clientWidth;
            if (itemLeft < visibleLeft || itemRight > visibleRight) {
                progressRoot.scrollTo({
                    left: Math.max(0, itemLeft - ((progressRoot.clientWidth - activeProgress.offsetWidth) / 2)),
                    behavior: "smooth"
                });
            }
        }
    };

    const renderStep = () => {
        const step = runtime.steps[runtime.activeIndex];
        if (!step) return;
        if (timerIndex !== runtime.activeIndex) roundTimers.get(timerIndex)?.pause();
        timerIndex = runtime.activeIndex;
        paintTimer();

        const guidanceHtml = formatDebateGuidanceHtml(step.guidance);
        const stepCounter = `${runtime.activeIndex + 1} de ${runtime.steps.length}`;
        const sideALabel = "Defende";
        const sideBLabel = "Contesta";

        renderStaticFields();

        if (sidesRoot) {
            sidesRoot.hidden = variantClass === "debate-variant--circle";
        }

        setTextAll("[data-debate-stage-counter]", stepCounter);
        setTextAll("[data-debate-stage-round]", `Rodada ${runtime.activeIndex + 1}`);
        setTextAll("[data-debate-stage-time]", step.time);
        setTextAll("[data-debate-stage-step-title]", step.title);
        setTextAll("[data-debate-stage-step-question]", step.question);
        setTextAll("[data-debate-stage-side-a-label]", sideALabel);
        setTextAll("[data-debate-stage-side-b-label]", sideBLabel);
        setHtmlAll("[data-debate-stage-guidance]", guidanceHtml);
        renderProgress();

        document.querySelectorAll("[data-debate-stage-prev]").forEach((button) => {
            button.disabled = runtime.activeIndex === 0;
        });

        document.querySelectorAll("[data-debate-stage-next]").forEach((button) => {
            button.disabled = runtime.activeIndex === runtime.steps.length - 1;
            button.textContent = runtime.activeIndex === runtime.steps.length - 1 ? "Última etapa" : "Próxima";
        });

        syncDebateGuidanceUi(runtime);
        syncDebateInlineEditUi();
        applyDebateDensity(cardRoot, runtime.steps, viewport);
    };

    const updateEditableBinding = (node, rerender = false) => {
        const binding = node?.dataset?.debateEditable;
        if (!binding) return false;

        const multiline = node.dataset.debateEditableMultiline === "true";
        const value = readDebateEditableValue(node, multiline);

        if (binding.startsWith("control:")) {
            const key = binding.slice("control:".length);
            const changed = runtime.draftState.controls[key] !== value;
            if (changed) {
                runtime.draftState.controls[key] = value;
                scheduleDraftSave();
            }
            if (rerender) {
                renderStep();
            } else if (changed) {
                applyDebateDensity(cardRoot, runtime.steps, viewport);
            }
            return changed || rerender;
        }

        if (binding.startsWith("step:")) {
            const key = binding.slice("step:".length);
            const step = runtime.steps[runtime.activeIndex];
            if (!step) return false;
            const changed = step[key] !== value;
            if (changed) {
                step[key] = value;
                scheduleDraftSave();
            }
            if (rerender) {
                renderStep();
            } else if (changed) {
                applyDebateDensity(cardRoot, runtime.steps, viewport);
            }
            return changed || rerender;
        }

        return false;
    };

    updateViewportMetrics();
    window.educariaPresentationProgress = {
        capture() {
            roundTimers.forEach((timer) => timer.pause());
            return { activeIndex: runtime.activeIndex, guidanceOpen: runtime.guidanceOpen, timers: [...roundTimers].map(([index, timer]) => [index, timer.seconds()]) };
        },
        restore(saved) {
            if (!saved) return;
            runtime.activeIndex = Math.max(0, Math.min(runtime.steps.length - 1, Number(saved.activeIndex) || 0));
            runtime.guidanceOpen = Boolean(saved.guidanceOpen);
            (saved.timers || []).forEach(([index, seconds]) => roundTimers.set(index, createDebateTimer(seconds)));
            renderStep();
        }
    };
    renderStep();
    persistRuntimeDraft();

    if (!document.body?.dataset?.debateRuntimeBound) {
        document.body.dataset.debateRuntimeBound = "true";

        document.addEventListener("click", (event) => {
            const editToggle = event.target.closest("[data-debate-inline-edit-toggle]");
            if (editToggle) {
                event.preventDefault();
                runtime.inlineEditEnabled = !runtime.inlineEditEnabled;
                if (!runtime.inlineEditEnabled && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                syncDebateInlineEditUi();
                return;
            }

            const guidanceToggle = event.target.closest("[data-debate-guidance-toggle]");
            if (guidanceToggle) {
                event.preventDefault();
                runtime.guidanceOpen = !runtime.guidanceOpen;
                syncDebateGuidanceUi(runtime);
                syncDebateInlineEditUi();
                return;
            }

            const guidanceClose = event.target.closest("[data-debate-guidance-close]");
            if (guidanceClose) {
                event.preventDefault();
                runtime.guidanceOpen = false;
                syncDebateGuidanceUi(runtime);
                return;
            }

            const progressTrigger = event.target.closest("[data-debate-stage-jump]");
            if (progressTrigger) {
                event.preventDefault();
                const targetIndex = Number(progressTrigger.dataset.debateStageJump);
                if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= runtime.steps.length) return;
                runtime.activeIndex = targetIndex;
                renderStep();
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

        document.addEventListener("input", (event) => {
            const editable = event.target.closest("[data-debate-editable][contenteditable='true']");
            if (!editable) return;
            updateEditableBinding(editable, false);
        });

        document.addEventListener("focusout", (event) => {
            const editable = event.target.closest("[data-debate-editable][contenteditable='true']");
            if (!editable) return;
            updateEditableBinding(editable, true);
        }, true);

        document.addEventListener("paste", (event) => {
            const editable = event.target.closest("[data-debate-editable][contenteditable='true']");
            if (!editable) return;

            event.preventDefault();
            const pastedText = (event.clipboardData || window.clipboardData)?.getData("text") || "";
            document.execCommand("insertText", false, pastedText);
        });

        document.addEventListener("keydown", (event) => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
            const editable = event.target.closest("[data-debate-editable][contenteditable='true']");
            if (editable) {
                const multiline = editable.dataset.debateEditableMultiline === "true";
                if (!multiline && event.key === "Enter") {
                    event.preventDefault();
                    editable.blur();
                }

                if (event.key === "Escape") {
                    event.preventDefault();
                    editable.blur();
                }
                return;
            }

            if (event.key === "Escape" && runtime.guidanceOpen) {
                runtime.guidanceOpen = false;
                syncDebateGuidanceUi(runtime);
                return;
            }

            if (event.key === "ArrowLeft" && runtime.activeIndex > 0) {
                event.preventDefault();
                runtime.activeIndex -= 1;
                renderStep();
            }

            if (event.key === "ArrowRight" && runtime.activeIndex < runtime.steps.length - 1) {
                event.preventDefault();
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
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDebateApplication);
} else {
    renderDebateApplication();
}
