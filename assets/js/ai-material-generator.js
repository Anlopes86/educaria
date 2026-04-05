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

function trimWords(text, maxWords = 11) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return words.join(" ");

    const source = words.join(" ");
    const punctuationIndex = source.search(/[,:;.!?](?=\s|$)/);
    if (punctuationIndex > 0 && punctuationIndex < source.length - 1) {
        return source.slice(0, punctuationIndex + 1).trim();
    }

    return words.slice(0, maxWords + 3).join(" ");
}

function normalizeSlideBodyText(body, slideType = "content") {
    const raw = String(body || "").replace(/\r/g, "\n").trim();
    if (!raw) {
        return slideType === "cover" ? "Visao geral da aula" : "- Conteudo principal";
    }

    const lineParts = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const units = (lineParts.length > 1 ? lineParts : raw.split(/(?<=[.!?;:])\s+/))
        .map((item) => item.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, slideType === "cover" ? 2 : 5);

    if (!units.length) {
        return slideType === "cover" ? "Visao geral da aula" : "- Conteudo principal";
    }

    if (slideType === "cover") {
        return units.map((item) => trimWords(item, 9)).join("\n");
    }

    return units.map((item) => `- ${trimWords(item, 11)}`).join("\n");
}

function refineSlideBodyText(body, slideType = "content") {
    const normalized = normalizeSlideBodyText(body, slideType);
    const lines = String(normalized || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => {
            const clean = line.replace(/^[-*•â€¢]\s*/, "").trim();
            return clean
                .split(/(?<=:)\s+|;\s+|(?<=[.!?])\s+/)
                .map((part) => part.trim())
                .filter(Boolean);
        })
        .slice(0, slideType === "cover" ? 2 : 5);

    if (!lines.length) {
        return slideType === "cover" ? "Visao geral da aula" : "- Conteudo principal";
    }

    if (slideType === "cover") {
        return lines.map((line) => trimWords(line, 8)).join("\n");
    }

    return lines.map((line) => `- ${trimWords(line, 8)}`).join("\n");
}

function protectSlideAbbreviationsSafe(text) {
    return String(text || "")
        .replace(/\bD\./g, "D§")
        .replace(/\bDr\./g, "Dr§")
        .replace(/\bSr\./g, "Sr§")
        .replace(/\bSra\./g, "Sra§");
}

function restoreSlideAbbreviationsSafe(text) {
    return String(text || "")
        .replaceAll("D§", "D.")
        .replaceAll("Dr§", "Dr.")
        .replaceAll("Sr§", "Sr.")
        .replaceAll("Sra§", "Sra.");
}

function refineSlideBodyTextSafe(body, slideType = "content") {
    const raw = String(body || "").replace(/\r/g, "\n").trim();
    if (!raw) {
        return slideType === "cover" ? "Visao geral da aula" : "- Conteudo principal";
    }

    const protectedRaw = protectSlideAbbreviationsSafe(raw);
    const sourceLines = protectedRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const logicalUnits = (sourceLines.length > 1 ? sourceLines : protectedRaw.split(/(?<=[!?;])\s+|(?<=\.)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/))
        .map((item) => restoreSlideAbbreviationsSafe(item).replace(/^[-*•â€¢Ã¢â‚¬Â¢]\s*/, "").trim())
        .filter(Boolean)
        .flatMap((item) => protectSlideAbbreviationsSafe(item)
            .split(/;\s+|(?<=[!?])\s+|(?<=\.)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/)
            .map((part) => restoreSlideAbbreviationsSafe(part).trim())
            .filter(Boolean))
        .slice(0, slideType === "cover" ? 2 : 5);

    if (!logicalUnits.length) {
        return slideType === "cover" ? "Visao geral da aula" : "- Conteudo principal";
    }

    if (slideType === "cover") {
        return logicalUnits.map((line) => trimWords(line, 9)).join("\n");
    }

    return logicalUnits.map((line) => `- ${trimWords(line, 11)}`).join("\n");
}

function compactSlideBodyText(body, slideType = "content") {
    const raw = String(body || "").replace(/\r/g, "\n").trim();
    if (!raw) {
        return slideType === "cover" ? "Visao geral da aula" : "- Conteudo principal";
    }

    const protectedRaw = raw
        .replace(/\bD\./g, "__ABBR_D__")
        .replace(/\bDr\./g, "__ABBR_DR__")
        .replace(/\bSr\./g, "__ABBR_SR__")
        .replace(/\bSra\./g, "__ABBR_SRA__");

    const restore = (text) => String(text || "")
        .replaceAll("__ABBR_D__", "D.")
        .replaceAll("__ABBR_DR__", "Dr.")
        .replaceAll("__ABBR_SR__", "Sr.")
        .replaceAll("__ABBR_SRA__", "Sra.");

    const baseUnits = protectedRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line) => line.split(/;\s+|(?<=[!?])\s+|(?<=\.)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/))
        .map((line) => restore(line).replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, slideType === "cover" ? 2 : 5);

    if (!baseUnits.length) {
        return slideType === "cover" ? "Visao geral da aula" : "- Conteudo principal";
    }

    if (slideType === "cover") {
        return baseUnits.map((line) => trimWords(line, 10)).join("\n");
    }

    return baseUnits.map((line) => `- ${line}`).join("\n");
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

function normalizeOptionText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function quizTemplates() {
    const cards = [...document.querySelectorAll("[data-quiz-stack] [data-quiz-question]")];
    if (cards.length < 2) return null;

    return {
        choice: cards[0].cloneNode(true),
        open: cards[1].cloneNode(true)
    };
}

function buildQuizCardsFromQuestions(questions) {
    const stack = document.querySelector("[data-quiz-stack]");
    const templates = quizTemplates();
    if (!stack || !templates) return [];

    stack.innerHTML = "";

    questions.forEach((question) => {
        const isOpen = question.type === "short_answer";
        stack.appendChild(cloneCard(isOpen ? templates.open : templates.choice));
    });

    return [...stack.querySelectorAll("[data-quiz-question]")];
}

function applyQuizFromStructuredData(payload) {
    const questions = Array.isArray(payload?.questions) ? payload.questions : [];
    if (!questions.length) return false;

    const cards = buildQuizCardsFromQuestions(questions);
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

        const normalizedOptions = question.type === "true_false"
            ? ["Verdadeiro", "Falso"]
            : (question.options || []);

        if (prompt) prompt.value = question.prompt || "";
        if (explanation) explanation.value = question.explanation || "";
        if (criteria) criteria.value = question.criteria || "";
        if (model) model.value = question.model_answer || "";
        if (type) setSelectByText(type, normalizedType);

        if (normalizedType === "Pergunta aberta") {
            return;
        }

        options.forEach((field, optionIndex) => {
            field.value = normalizedOptions[optionIndex] || "";
        });

        if (correct) {
            const correctAnswer = normalizeOptionText(question.correct_answer);
            const correctIndex = Math.max(0, normalizedOptions.findIndex((option) => {
                const normalizedOption = normalizeOptionText(option);
                if (normalizedOption === correctAnswer) return true;
                if (correctAnswer === "true" && normalizedOption === "verdadeiro") return true;
                if (correctAnswer === "false" && normalizedOption === "falso") return true;
                return false;
            }));
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
        if (body) body.value = compactSlideBodyText(slide.body || "", slide.type || (index === 0 ? "cover" : "content"));
        if (imagePrompt) imagePrompt.value = slide.image_prompt || "";

        const imageUrl = card.querySelector('[data-field="slide-image-url"]');
        if (imageUrl && slide.image_prompt && !imageUrl.value && typeof createSvgDataUrl === "function") {
            imageUrl.value = createSvgDataUrl(
                slide.title || "Slide",
                slide.image_prompt,
                ["#99f6e4", "#dbeafe"]
            );
        }

        if (imageMode) {
            const desiredMode = slide.image_prompt ? "Gerar com IA" : "Sem imagem";
            setSelectByText(imageMode, desiredMode);
        }

        if (layout) {
            setSelectByText(layout, "Lado a lado");
        }
    });

    renumberGeneratedCards("[data-slide-card]", "Slide");
    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function buildFallbackSlides(sourceText) {
    const blocks = splitParagraphs(sourceText);
    const lines = normalizeLines(sourceText);
    const sentenceUnits = lines.join(" ").split(/(?<=[.!?])\s+/).filter(Boolean);
    const units = blocks.length > 1 ? blocks : sentenceUnits;
    const title = lines[0] || "Aula";
    const slides = (units.length ? units : ["Introducao ao tema", "Desenvolvimento do conteudo", "Fechamento e revisao"])
        .slice(0, 6)
        .map((block, index) => ({
            type: index === 0 ? "cover" : "content",
            title: index === 0 ? summarizeBlock(title, "Aula") : `Ponto ${index}`,
            subtitle: index === 0 ? "Visao geral da aula" : "",
            body: summarizeBlock(block, "Conteudo do slide"),
            image_prompt: index === 0 ? `Ilustracao educativa sobre ${summarizeBlock(title, "o tema")}` : ""
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

function resolveAiEndpoint() {
    if (window.EDUCARIA_AI_ENDPOINT) {
        return window.EDUCARIA_AI_ENDPOINT;
    }

    if (window.location.protocol === "file:") {
        return "http://localhost:8787/api/ai/generate";
    }

    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return "http://localhost:8787/api/ai/generate";
    }

    return "/api/ai/generate";
}

function resolveAiHealthEndpoint() {
    const endpoint = resolveAiEndpoint();
    return endpoint.replace(/\/api\/ai\/generate$/, "/api/health");
}

async function checkAiHealth() {
    const response = await fetch(resolveAiHealthEndpoint(), {
        method: "GET"
    });

    if (!response.ok) {
        throw new Error(`Health check falhou com status ${response.status}.`);
    }

    return response.json();
}

async function requestStructuredMaterial(materialType, sourceText, file, action) {
    const endpoint = resolveAiEndpoint();
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
        throw new Error(errorPayload?.error || "Nao foi possivel gerar o material com IA.");
    }

    return response.json();
}

function materialConfig(materialType) {
    if (materialType === "quiz") {
        return {
            textId: "quiz-fonte-texto",
            fileId: "quiz-arquivo",
            actionId: "quiz-acao-ia",
            countId: "quiz-quantidade",
            formatId: "quiz-formato",
            apply: applyQuizFromStructuredData,
            fallback: buildFallbackQuiz
        };
    }

    if (materialType === "slides") {
        return {
            textId: "slides-fonte-texto",
            fileId: "slides-arquivo",
            actionId: "slides-acao-ia",
            countId: "slides-quantidade",
            detailId: "slides-detalhamento",
            imagePrefId: "slides-imagens-preferencia",
            audienceId: "slides-publico",
            toneId: "slides-tom",
            objectiveId: "slides-objetivo",
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
    const countField = config.countId ? document.getElementById(config.countId) : null;
    const formatField = config.formatId ? document.getElementById(config.formatId) : null;
    const detailField = config.detailId ? document.getElementById(config.detailId) : null;
    const imagePrefField = config.imagePrefId ? document.getElementById(config.imagePrefId) : null;
    const audienceField = config.audienceId ? document.getElementById(config.audienceId) : null;
    const toneField = config.toneId ? document.getElementById(config.toneId) : null;
    const objectiveField = config.objectiveId ? document.getElementById(config.objectiveId) : null;
    const file = fileField?.files?.[0] || null;
    const typedText = textField?.value.trim() || "";
    const fileText = await readTextFile(file);
    const sourceText = [typedText, fileText].filter(Boolean).join("\n\n").trim();
    const action = actionField ? actionField.options[actionField.selectedIndex].text.trim() : "";
    const countText = countField ? String(countField.value || "").trim() : "";
    const formatText = formatField ? formatField.options[formatField.selectedIndex].text.trim() : "";
    const detailText = detailField ? detailField.options[detailField.selectedIndex].text.trim() : "";
    const imagePrefText = imagePrefField ? imagePrefField.options[imagePrefField.selectedIndex].text.trim() : "";
    const audienceText = audienceField ? String(audienceField.value || "").trim() : "";
    const toneText = toneField ? toneField.options[toneField.selectedIndex].text.trim() : "";
    const objectiveText = objectiveField ? String(objectiveField.value || "").trim() : "";
    const requestedCount = Number(countText) || undefined;

    if (!sourceText && !file) {
        window.alert("Adicione um texto-base ou envie um arquivo para a IA estruturar.");
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Gerando...";

    try {
        await checkAiHealth();

        const generationHints = materialType === "quiz"
            ? [
                action,
                requestedCount ? `Gerar ${requestedCount} perguntas.` : "",
                formatText ? `Formato desejado: ${formatText}.` : ""
            ].filter(Boolean).join(" ")
            : [
                action,
                requestedCount ? `Gerar ${requestedCount} slides.` : "",
                audienceText ? `Publico ou ano: ${audienceText}.` : "",
                objectiveText ? `Objetivo da aula: ${objectiveText}.` : "",
                toneText ? `Tom desejado: ${toneText}.` : "",
                detailText ? `Nivel de detalhamento: ${detailText}.` : "",
                imagePrefText ? `Uso de imagens: ${imagePrefText}.` : ""
            ].filter(Boolean).join(" ");

        const payload = await requestStructuredMaterial(materialType, sourceText, file, generationHints);
        const applied = config.apply(payload?.material);
        if (!applied) {
            throw new Error("A resposta da IA nao trouxe dados suficientes para preencher o editor.");
        }
    } catch (error) {
        console.warn("EducarIA AI generation fallback:", error);
        const fallbackPayload = config.fallback(sourceText);
        if (fallbackPayload) {
            config.apply(fallbackPayload);
        }
        const endpoint = resolveAiEndpoint();
        const detail = error instanceof Error ? error.message : "Erro desconhecido.";
        window.alert(`A IA real nao respondeu. O editor usou um modo local simplificado.\n\nDetalhe: ${detail}\nEndpoint: ${endpoint}`);
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
