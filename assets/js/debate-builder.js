function parseDebateStepCount() {
    const field = document.getElementById("debate-etapas");
    if (!field) return 3;
    const match = field.value.match(/\d+/);
    return match ? Number(match[0]) : 3;
}

function escapeDebateAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function debateStepTemplate(index, title = "", time = "", question = "", guidance = "") {
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
                    <input data-debate-title type="text" value="${escapeDebateAttr(title)}">
                </div>
                <div class="platform-field">
                    <label>Tempo sugerido</label>
                    <input data-debate-time type="text" value="${escapeDebateAttr(time)}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Pergunta da etapa</label>
                    <input data-debate-question type="text" value="${escapeDebateAttr(question)}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Orientação de mediação</label>
                    <textarea data-debate-guidance rows="4">${escapeDebateAttr(guidance)}</textarea>
                </div>
            </div>
        </section>
    `;
}

function collectDebateSteps() {
    return [...document.querySelectorAll("[data-debate-step]")].map((step, index) => ({
        index,
        title: step.querySelector("[data-debate-title]")?.value.trim() || `Etapa ${index + 1}`,
        time: step.querySelector("[data-debate-time]")?.value.trim() || "5 min",
        question: step.querySelector("[data-debate-question]")?.value.trim() || "Pergunta da etapa",
        guidance: step.querySelector("[data-debate-guidance]")?.value.trim() || "Orientação para conduzir esta etapa."
    }));
}

function setDebateStepSelect(count) {
    const quantity = document.getElementById("debate-etapas");
    if (!quantity) return;

    const options = [...quantity.options];
    const exact = options.find((option) => {
        const match = option.text.match(/\d+/);
        return match && Number(match[0]) === count;
    });

    if (exact) {
        quantity.value = exact.value;
        return;
    }

    const highest = options[options.length - 1];
    if (highest) {
        highest.textContent = `${count} etapas`;
        highest.value = highest.textContent;
        quantity.value = highest.value;
    }
}

function syncDebateStepCount() {
    const stack = document.querySelector("[data-debate-steps]");
    if (!stack) return;

    const desired = parseDebateStepCount();
    const current = [...stack.querySelectorAll("[data-debate-step]")];

    if (current.length < desired) {
        for (let i = current.length; i < desired; i += 1) {
            stack.insertAdjacentHTML("beforeend", debateStepTemplate(i));
        }
    }

    if (current.length > desired) {
        [...stack.querySelectorAll("[data-debate-step]")].slice(desired).forEach((node) => node.remove());
    }

    [...stack.querySelectorAll("[data-debate-label]")].forEach((label, index) => {
        label.textContent = `Etapa ${index + 1}`;
    });
}

function addDebateStep() {
    const stack = document.querySelector("[data-debate-steps]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-debate-step]").length;
    stack.insertAdjacentHTML("beforeend", debateStepTemplate(count));
    setDebateStepSelect(count + 1);
    renderDebatePreview();
    document.dispatchEvent(new Event("input"));
}

function removeDebateStep(trigger) {
    const steps = [...document.querySelectorAll("[data-debate-step]")];
    if (steps.length <= 2) return;

    const step = trigger.closest("[data-debate-step]");
    if (!step) return;

    step.remove();
    setDebateStepSelect(steps.length - 1);
    renderDebatePreview();
    document.dispatchEvent(new Event("input"));
}

function renderDebatePreview() {
    syncDebateStepCount();

    const title = document.getElementById("debate-titulo")?.value.trim() || "Debate guiado";
    const question = document.getElementById("debate-pergunta")?.value.trim() || "Pergunta central do debate";
    const format = document.getElementById("debate-formato")?.value || "Dois lados";
    const sideA = document.getElementById("debate-lado-a")?.value.trim() || "Posição A";
    const sideB = document.getElementById("debate-lado-b")?.value.trim() || "Posição B";
    const steps = collectDebateSteps();
    const titleRoot = document.querySelector("[data-debate-preview-title]");
    const formatRoot = document.querySelector("[data-debate-preview-format]");
    const countRoot = document.querySelector("[data-debate-preview-count]");
    const sideARoot = document.querySelector("[data-debate-preview-side-a]");
    const sideBRoot = document.querySelector("[data-debate-preview-side-b]");
    const questionRoot = document.querySelector("[data-debate-preview-question]");
    const stepsRoot = document.querySelector("[data-debate-preview-steps]");

    if (titleRoot) titleRoot.textContent = title;
    if (formatRoot) formatRoot.textContent = format;
    if (countRoot) countRoot.textContent = `${steps.length} etapas`;
    if (sideARoot) sideARoot.textContent = sideA;
    if (sideBRoot) sideBRoot.textContent = sideB;
    if (questionRoot) questionRoot.textContent = question;

    if (stepsRoot) {
        stepsRoot.innerHTML = steps.map((step, index) => `
            <article class="debate-preview-step">
                <span>Etapa ${index + 1} - ${escapeDebateAttr(step.time)}</span>
                <strong>${escapeDebateAttr(step.title)}</strong>
                <p>${escapeDebateAttr(step.question)}</p>
            </article>
        `).join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    syncDebateStepCount();
    renderDebatePreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-debate-step]") || ["debate-titulo", "debate-pergunta", "debate-lado-a", "debate-lado-b"].includes(event.target.id)) {
            renderDebatePreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (["debate-formato", "debate-etapas"].includes(event.target.id)) {
            renderDebatePreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-debate-add]");
        if (addButton) {
            event.preventDefault();
            addDebateStep();
            return;
        }

        const removeButton = event.target.closest("[data-debate-remove]");
        if (removeButton) {
            event.preventDefault();
            removeDebateStep(removeButton);
            return;
        }

        const presentLink = event.target.closest('a[href="debate-guiado-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("debate");
        }
    });
});
