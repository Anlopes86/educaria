function readTextFile(file) {
    if (!file || file.type !== "text/plain") {
        return Promise.resolve("");
    }

    return file.text().catch(() => "");
}

function normalizeLines(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

function summarizeBlock(text, fallback = "") {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return fallback;
    return clean.length > 220 ? `${clean.slice(0, 217).trim()}...` : clean;
}

function splitParagraphs(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .split(/\n\s*\n/)
        .map((block) => block.replace(/\s+/g, " ").trim())
        .filter(Boolean);
}

function cloneCard(card) {
    const clone = card.cloneNode(true);
    clone.querySelectorAll("input, textarea, select").forEach((field) => {
        if (field.tagName === "SELECT") {
            field.selectedIndex = 0;
            return;
        }

        if (field.type === "color") return;
        field.value = "";
    });
    return clone;
}

function ensureCardCount(stackSelector, cardSelector, desiredCount) {
    const stack = document.querySelector(stackSelector);
    if (!stack || desiredCount < 1) return [];

    const cards = [...stack.querySelectorAll(cardSelector)];
    if (!cards.length) return [];

    while (stack.querySelectorAll(cardSelector).length < desiredCount) {
        stack.appendChild(cloneCard(stack.querySelector(`${cardSelector}:last-child`)));
    }

    while (stack.querySelectorAll(cardSelector).length > desiredCount) {
        const currentCards = stack.querySelectorAll(cardSelector);
        currentCards[currentCards.length - 1].remove();
    }

    return [...stack.querySelectorAll(cardSelector)];
}

function renumberGeneratedCards(selector, labelPrefix) {
    document.querySelectorAll(selector).forEach((card, index) => {
        const label = card.querySelector("[data-card-label]");
        if (label) {
            label.textContent = `${labelPrefix} ${index + 1}`;
        }
    });
}

function setSelectByText(select, desiredText) {
    if (!select) return;
    const match = [...select.options].find((option) => option.text.trim() === desiredText);
    select.selectedIndex = match ? match.index : 0;
}

function applyQuizFromStructuredData(payload) {
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];
    if (!questions.length) return false;

    const cards = ensureCardCount("[data-quiz-stack]", "[data-quiz-question]", questions.length);
    if (!cards.length) return false;

    questions.forEach((question, index) => {
        const card = cards[index];
        const prompt = card.querySelector('[data-field="prompt"]');
        const type = card.querySelector('[data-field="type"]');
        const correct = card.querySelector('[data-field="correct"]');
        const explanation = card.querySelector('[data-field="explanation"]');
        const criteria = card.querySelector('[data-field="criteria"]');
        const model = card.querySelector('[data-field="model"]');
        const options = [...card.querySelectorAll("[data-option]")];

        const normalizedType = question.type === "short_answer"
            ? "Pergunta aberta"
            : question.type === "true_false"
                ? "Verdadeiro ou falso"
                : "Múltipla escolha";

        if (prompt) prompt.value = question.prompt || "";
        if (explanation) explanation.value = question.explanation || "";
        if (criteria) criteria.value = question.criteria || "";
        if (model) model.value = question.model_answer || "";
        if (type) setSelectByText(type, normalizedType);

        if (normalizedType === "Pergunta aberta") {
            return;
        }

        options.forEach((field, optionIndex) => {
            field.value = question.options?.[optionIndex] || "";
        });

        if (correct) {
            const correctIndex = Math.max(0, (question.options || []).findIndex((option) => option === question.correct_answer));
            const key = `Alternativa ${String.fromCharCode(65 + correctIndex)}`;
            setSelectByText(correct, key);
        }
    });

    const titleField = document.getElementById("quiz-tema");
    if (titleField && payload.title) {
        titleField.value = payload.title;
    }

    renumberGeneratedCards("[data-quiz-question]", "Questão");
    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function applySlidesFromStructuredData(payload) {
    const slides = Array.isArray(payload?.slides) ? payload.slides : [];
    if (!slides.length) return false;

    const cards = ensureCardCount("[data-slides-stack]", "[data-slide-card]", slides.length);
    if (!cards.length) return false;

    slides.forEach((slide, index) => {
        const card = cards[index];
        const title = card.querySelector('[data-field="slide-title"]');
        const subtitle = card.querySelector('[data-field="slide-subtitle"]');
        const body = card.querySelector('[data-field="slide-body"]');
        const imageMode = card.querySelector('[data-field="slide-image-mode"]');
        const imagePrompt = card.querySelector('[data-field="slide-image-prompt"]');
        const layout = card.querySelector('[data-field="slide-layout"]');

        if (title) title.value = slide.title || "";
        if (subtitle) subtitle.value = slide.subtitle || "";
        if (body) body.value = slide.body || "";
        if (imagePrompt) imagePrompt.value = slide.image_prompt || "";

        if (imageMode) {
            const desiredMode = slide.image_prompt ? "Gerar com IA" : "Sem imagem";
            setSelectByText(imageMode, desiredMode);
        }

        if (layout) {
            const desiredLayout = slide.layout === "feature"
                ? "Imagem em destaque"
                : slide.layout === "split"
                    ? "Lado a lado"
                    : "Texto acima";
            setSelectByText(layout, desiredLayout);
        }
    });

    renumberGeneratedCards("[data-slide-card]", "Slide");
    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function buildFallbackSlides(sourceText) {
    const blocks = splitParagraphs(sourceText);
    const units = blocks.length ? blocks : normalizeLines(sourceText).join("\n").split(/(?<=[.!?])\s+/).filter(Boolean);
    const title = normalizeLines(sourceText)[0] || "Aula";
    const slides = (units.length ? units : ["Introdução ao tema", "Desenvolvimento do conteúdo", "Fechamento e revisão"])
        .slice(0, 8)
        .map((block, index) => ({
            type: index === 0 ? "cover" : "content",
            title: index === 0 ? title : `Ponto ${index}`,
            subtitle: index === 0 ? "Visão geral da aula" : "",
            body: summarizeBlock(block, "Conteúdo do slide"),
            image_prompt: index === 0 ? `Ilustração educativa sobre ${title}` : ""
        }));

    return { title, slides };
}

function buildFallbackQuiz(sourceText) {
    const lines = normalizeLines(sourceText);
    const prompts = lines.filter((line) => /\?$/.test(line) || /^\d+[.)-]/.test(line));

    if (!prompts.length) {
        if (typeof applyGeneratedQuiz === "function") {
            applyGeneratedQuiz();
            return null;
        }

        return {
            title: "Quiz",
            questions: []
        };
    }

    return {
        title: "Quiz estruturado",
        questions: prompts.slice(0, 8).map((prompt, index) => ({
            type: "short_answer",
            prompt: prompt.replace(/^\d+[.)-\s]*/, ""),
            explanation: "Revise a resposta antes de aplicar.",
            criteria: `Resposta alinhada ao material enviado ${index + 1}`,
            model_answer: "Resposta a ser revisada pelo professor."
        }))
    };
}

async function requestStructuredMaterial(materialType, sourceText, file, action) {
    const endpoint = window.EDUCARIA_AI_ENDPOINT || "/api/ai/generate";
    const formData = new FormData();
    formData.append("materialType", materialType);
    formData.append("sourceText", sourceText || "");
    formData.append("action", action || "");

    if (file) {
        formData.append("file", file);
    }

    const response = await fetch(endpoint, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || "Não foi possível gerar o material com IA.");
    }

    return response.json();
}

function materialConfig(materialType) {
    if (materialType === "quiz") {
        return {
            textId: "quiz-fonte-texto",
            fileId: "quiz-arquivo",
            actionId: "quiz-acao-ia",
            apply: applyQuizFromStructuredData,
            fallback: buildFallbackQuiz
        };
    }

    if (materialType === "slides") {
        return {
            textId: "slides-fonte-texto",
            fileId: "slides-arquivo",
            actionId: "slides-acao-ia",
            apply: applySlidesFromStructuredData,
            fallback: buildFallbackSlides
        };
    }

    return null;
}

async function generateMaterial(materialType, button) {
    const config = materialConfig(materialType);
    if (!config) return;

    const textField = document.getElementById(config.textId);
    const fileField = document.getElementById(config.fileId);
    const actionField = document.getElementById(config.actionId);
    const file = fileField?.files?.[0] || null;
    const typedText = textField?.value.trim() || "";
    const fileText = await readTextFile(file);
    const sourceText = [typedText, fileText].filter(Boolean).join("\n\n").trim();
    const action = actionField ? actionField.options[actionField.selectedIndex].text.trim() : "";

    if (!sourceText && !file) {
        window.alert("Adicione um texto-base ou envie um arquivo para a IA estruturar.");
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Gerando...";

    try {
        const payload = await requestStructuredMaterial(materialType, sourceText, file, action);
        const applied = config.apply(payload?.material);
        if (!applied) {
            throw new Error("A resposta da IA não trouxe dados suficientes para preencher o editor.");
        }
    } catch (error) {
        console.warn("EducarIA AI generation fallback:", error);
        const fallbackPayload = config.fallback(sourceText);
        if (fallbackPayload) {
            config.apply(fallbackPayload);
        }
    } finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

function bindAiMaterialGenerator() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-generate-material]");
        if (!button) return;

        event.preventDefault();
        const materialType = button.dataset.generateMaterial;
        generateMaterial(materialType, button);
    });
}

document.addEventListener("DOMContentLoaded", bindAiMaterialGenerator);
