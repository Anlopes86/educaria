function persistMaterializedFields(scope) {
    scope.querySelectorAll("input, textarea, select").forEach((field) => {
        if (field.tagName === "TEXTAREA") {
            field.textContent = field.value;
            return;
        }

        if (field.tagName === "SELECT") {
            [...field.options].forEach((option, index) => {
                const isSelected = field.selectedIndex === index;
                option.selected = isSelected;
                option.defaultSelected = isSelected;

                if (isSelected) {
                    option.setAttribute("selected", "selected");
                } else {
                    option.removeAttribute("selected");
                }
            });
            return;
        }

        if (field.type === "file") {
            return;
        }

        field.setAttribute("value", field.value);
    });
}

function restoreControls(values) {
    if (!values) return;

    Object.entries(values).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field) return;
        field.value = value;
    });
}

function captureControls() {
    const controls = {};
    document.querySelectorAll("input[id], textarea[id], select[id]").forEach((field) => {
        if (field.type === "file") return;
        controls[field.id] = field.value;
    });
    return controls;
}

function builderConfig() {
    if (document.querySelector("[data-quiz-stack]")) {
        return {
            key: "educaria:builder:quiz",
            stackSelector: "[data-quiz-stack]",
            cardSelector: "[data-quiz-question]",
            labelPrefix: "Questao",
            labelSelector: "[data-card-label]"
        };
    }

    if (document.querySelector("[data-flashcards-stack]")) {
        return {
            key: "educaria:builder:flashcards",
            stackSelector: "[data-flashcards-stack]",
            cardSelector: "[data-flashcard]",
            labelPrefix: "Card",
            labelSelector: "[data-card-label]"
        };
    }

    if (document.querySelector("[data-slides-stack]")) {
        return {
            key: "educaria:builder:slides",
            stackSelector: "[data-slides-stack]",
            cardSelector: "[data-slide-card]",
            labelPrefix: "Slide",
            labelSelector: "[data-card-label]"
        };
    }

    if (document.querySelector("[data-wheel-segments]")) {
        return {
            key: "educaria:builder:wheel",
            stackSelector: "[data-wheel-segments]",
            cardSelector: "[data-wheel-segment]",
            labelPrefix: "Espaco",
            labelSelector: "[data-wheel-label]"
        };
    }

    if (document.querySelector("[data-memory-pairs]")) {
        return {
            key: "educaria:builder:memory",
            stackSelector: "[data-memory-pairs]",
            cardSelector: "[data-memory-pair]",
            labelPrefix: "Par",
            labelSelector: "[data-memory-label]"
        };
    }

    if (document.querySelector("[data-match-pairs]")) {
        return {
            key: "educaria:builder:match",
            stackSelector: "[data-match-pairs]",
            cardSelector: "[data-match-pair]",
            labelPrefix: "Par",
            labelSelector: "[data-match-label]"
        };
    }

    if (document.querySelector("[data-mind-branches]")) {
        return {
            key: "educaria:builder:mindmap",
            stackSelector: "[data-mind-branches]",
            cardSelector: "[data-mind-branch]",
            labelPrefix: "Ramo",
            labelSelector: "[data-mind-label]"
        };
    }

    if (document.querySelector("[data-debate-steps]")) {
        return {
            key: "educaria:builder:debate",
            stackSelector: "[data-debate-steps]",
            cardSelector: "[data-debate-step]",
            labelPrefix: "Etapa",
            labelSelector: "[data-debate-label]"
        };
    }

    return null;
}

function renumberRestoredCards(cardSelector, labelPrefix, labelSelector = "[data-card-label]") {
    document.querySelectorAll(cardSelector).forEach((card, index) => {
        const label = card.querySelector(labelSelector);
        if (label) {
            label.textContent = `${labelPrefix} ${index + 1}`;
        }
    });
}

function buildHiddenField(name, tagName = "input") {
    const wrapper = document.createElement("div");
    wrapper.className = "platform-field platform-field-wide";
    wrapper.hidden = true;

    if (tagName === "textarea") {
        const label = document.createElement("label");
        label.textContent = "Campo interno";
        const field = document.createElement("textarea");
        field.setAttribute("data-field", name);
        wrapper.append(label, field);
        return wrapper;
    }

    const field = document.createElement("input");
    field.type = "text";
    field.value = "";
    field.setAttribute("data-field", name);
    wrapper.append(field);
    return wrapper;
}

function buildColorField(name, labelText, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "platform-field";
    wrapper.innerHTML = `
        <label>${labelText}</label>
        <input data-field="${name}" type="color" value="${value}">
    `;
    return wrapper;
}

function normalizeSlideBuilder(stack) {
    if (!stack || !stack.matches("[data-slides-stack]")) return;

    stack.querySelectorAll("[data-slide-card]").forEach((card) => {
        const grid = card.querySelector(".platform-form-grid");
        const titleField = card.querySelector('[data-field="slide-title"]')?.closest(".platform-field");
        const bodyField = card.querySelector('[data-field="slide-body"]')?.closest(".platform-field");
        const subtitleField = card.querySelector('[data-field="slide-subtitle"]');

        card.querySelector('[data-field="slide-type"]')?.closest(".platform-field")?.remove();
        card.querySelector('[data-field="slide-image-resource"]')?.closest(".platform-field")?.remove();
        card.querySelector('[data-field="slide-note"]')?.closest(".platform-field")?.remove();
        card.querySelector(".platform-card-meta span:not([data-card-label])")?.remove();

        if (!subtitleField && grid && titleField && bodyField) {
            const wrapper = document.createElement("div");
            wrapper.className = "platform-field platform-field-wide";
            wrapper.innerHTML = `
                <label>Subtitulo do slide</label>
                <input data-field="slide-subtitle" type="text" value="">
            `;
            grid.insertBefore(wrapper, bodyField);
        }

        if (!card.querySelector('[data-field="slide-image-prompt"]') && grid) {
            grid.appendChild(buildHiddenField("slide-image-prompt", "textarea"));
        }

        if (!card.querySelector('[data-field="slide-image-url"]') && grid) {
            grid.appendChild(buildHiddenField("slide-image-url"));
        }
    });
}

function normalizeFlashcardsBuilder(stack) {
    if (!stack || !stack.matches("[data-flashcards-stack]")) return;

    stack.querySelectorAll("[data-flashcard]").forEach((card) => {
        const grid = card.querySelector(".platform-form-grid");
        const exampleField = card.querySelector('[data-field="example"]')?.closest(".platform-field");
        if (!grid || !exampleField) return;

        if (!card.querySelector('[data-field="front-color"]')) {
            grid.appendChild(buildColorField("front-color", "Cor da frente", "#ffffff"));
        }

        if (!card.querySelector('[data-field="back-color"]')) {
            grid.appendChild(buildColorField("back-color", "Cor do verso", "#dbeafe"));
        }

        if (!card.querySelector('[data-field="text-color"]')) {
            grid.appendChild(buildColorField("text-color", "Cor da fonte", "#0f172a"));
        }
    });
}

function saveBuilderState(config) {
    const stack = document.querySelector(config.stackSelector);
    if (!stack) return;

    persistMaterializedFields(stack);
    persistMaterializedFields(document);

    const state = {
        controls: captureControls(),
        stackHtml: stack.innerHTML
    };

    try {
        localStorage.setItem(config.key, JSON.stringify(state));
    } catch (error) {
        console.warn("EducarIA local persistence unavailable:", error);
    }
}

function restoreBuilderState(config) {
    const stack = document.querySelector(config.stackSelector);
    if (!stack) return;

    try {
        const raw = localStorage.getItem(config.key);
        if (!raw) return;

        const state = JSON.parse(raw);
        if (state?.controls) {
            restoreControls(state.controls);
        }

        if (state?.stackHtml) {
            stack.innerHTML = state.stackHtml;
            normalizeSlideBuilder(stack);
            normalizeFlashcardsBuilder(stack);
            renumberRestoredCards(config.cardSelector, config.labelPrefix, config.labelSelector);
        }

        document.dispatchEvent(new Event("input"));
        document.dispatchEvent(new Event("change"));
    } catch (error) {
        console.warn("EducarIA local restore unavailable:", error);
    }
}

function clearBuilderState(config) {
    try {
        localStorage.removeItem(config.key);
    } catch (error) {
        console.warn("EducarIA local clear unavailable:", error);
    }
}

function bindDraftReset(config) {
    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-clear-draft]");
        if (!button) return;

        event.preventDefault();
        clearBuilderState(config);
        window.location.reload();
    });
}

function initLocalPersistence() {
    const config = builderConfig();
    if (!config) return;

    bindDraftReset(config);

    let saveTimer;
    const scheduleSave = () => {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveBuilderState(config), 120);
    };

    document.addEventListener("input", scheduleSave);
    document.addEventListener("change", scheduleSave);

    restoreBuilderState(config);
    saveBuilderState(config);
}

document.addEventListener("DOMContentLoaded", initLocalPersistence);
