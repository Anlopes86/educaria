function readTextFile(file) {
    if (!file || file.type !== "text/plain") {
        return Promise.resolve("");
    }

    return file.text().catch(() => "");
}

function readTemplateFile(file) {
    if (!file) {
        return Promise.resolve("");
    }

    return file.text().then((content) => {
        const fileName = String(file.name || "").toLowerCase();

        if (file.type === "text/plain" || fileName.endsWith(".txt")) {
            return content;
        }

        if (fileName.endsWith(".rtf")) {
            return String(content || "")
                .replace(/\\par[d]?/g, "\n")
                .replace(/\\'[0-9a-fA-F]{2}/g, "")
                .replace(/\\[a-z]+\d* ?/g, "")
                .replace(/[{}]/g, "")
                .replace(/\r/g, "")
                .replace(/\n{2,}/g, "\n")
                .trim();
        }

        return "";
    }).catch(() => "");
}

function escapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function aiReadyModalTemplate() {
    return `
        <div class="platform-modal-backdrop" data-ai-ready-modal hidden>
            <div class="platform-modal-card" role="dialog" aria-modal="true" aria-labelledby="ai-ready-modal-title">
                <div class="page-section-title page-section-title--compact">
                    <div>
                        <span class="platform-section-label">Montar com IA</span>
                        <h2 id="ai-ready-modal-title">Apresentação pronta!</h2>
                    </div>
                    <p>Apresentação pronta! Confira as informações em 'editar manualmente' antes de utilizar.</p>
                </div>
                <div class="utility-actions">
                    <button type="button" class="platform-link-button platform-link-primary" data-ai-ready-modal-close>Entendi</button>
                </div>
            </div>
        </div>
    `;
}

function ensureAiReadyModal() {
    let modal = document.querySelector("[data-ai-ready-modal]");
    if (modal) return modal;

    document.body.insertAdjacentHTML("beforeend", aiReadyModalTemplate());
    return document.querySelector("[data-ai-ready-modal]");
}

function closeAiReadyModal() {
    const modal = document.querySelector("[data-ai-ready-modal]");
    if (!modal) return;
    modal.hidden = true;
}

function openAiReadyModal() {
    const modal = ensureAiReadyModal();
    if (!modal) return;
    modal.hidden = false;
}

function normalizeLines(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

function parseWheelTemplateTextLocal(sourceText) {
    const normalizedLines = String(sourceText || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    const segments = normalizedLines
        .map((line) => {
            const match = line.match(/^espac[oó]\s*\d+\s*:\s*(.+)$/i);
            if (!match) return null;

            const value = String(match[1] || "").trim().replace(/^_+|_+$/g, "").trim();
            if (!value) return null;
            if (/^revisão rápida$/i.test(value) || /^pergunta surpresa$/i.test(value) || /^explique um conceito$/i.test(value)) {
                return { text: value, example: true };
            }

            return { text: value, example: false };
        })
        .filter(Boolean);

    const usableSegments = (segments.filter((item) => !item.example).length >= 2
        ? segments.filter((item) => !item.example)
        : segments)
        .slice(0, 24)
        .map((segment, index) => ({
            text: segment.text,
            color: activityColorPalette()[index % activityColorPalette().length]
        }));

    if (usableSegments.length < 2) {
        throw new Error("Preencha pelo menos dois campos do modelo da roleta antes de gerar.");
    }

    return {
        title: "Roleta estruturada pelo modelo",
        eliminate_used: false,
        segments: usableSegments
    };
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
        return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
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
        return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
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
            const clean = line.replace(/^[-*••]\s*/, "").trim();
            return clean
                .split(/(?<=:)\s+|;\s+|(?<=[.!?])\s+/)
                .map((part) => part.trim())
                .filter(Boolean);
        })
        .slice(0, slideType === "cover" ? 2 : 5);

    if (!lines.length) {
        return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
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
        return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
    }

    const protectedRaw = protectSlideAbbreviationsSafe(raw);
    const sourceLines = protectedRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const logicalUnits = (sourceLines.length > 1 ? sourceLines : protectedRaw.split(/(?<=[!?;])\s+|(?<=\.)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/))
        .map((item) => restoreSlideAbbreviationsSafe(item).replace(/^[-*••ââ‚¬Â¢]\s*/, "").trim())
        .filter(Boolean)
        .flatMap((item) => protectSlideAbbreviationsSafe(item)
            .split(/;\s+|(?<=[!?])\s+|(?<=\.)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/)
            .map((part) => restoreSlideAbbreviationsSafe(part).trim())
            .filter(Boolean))
        .slice(0, slideType === "cover" ? 2 : 5);

    if (!logicalUnits.length) {
        return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
    }

    if (slideType === "cover") {
        return logicalUnits.map((line) => trimWords(line, 9)).join("\n");
    }

    return logicalUnits.map((line) => `- ${trimWords(line, 11)}`).join("\n");
}

function compactSlideBodyText(body, slideType = "content") {
    const raw = String(body || "").replace(/\r/g, "\n").trim();
    if (!raw) {
        return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
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
        return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
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

function applyFlashcardsFromStructuredData(payload) {
    const cardsPayload = Array.isArray(payload?.cards) ? payload.cards : [];
    if (!cardsPayload.length) return false;

    const cards = ensureCardCount("[data-flashcards-stack]", "[data-flashcard]", cardsPayload.length);
    if (!cards.length) return false;

    cardsPayload.forEach((item, index) => {
        const card = cards[index];
        const front = card.querySelector('[data-field="front"]');
        const back = card.querySelector('[data-field="back"]');
        const example = card.querySelector('[data-field="example"]');

        const fitFlashcardText = (value, maxChars, maxWords) => {
            const clean = String(value || "").replace(/\s+/g, " ").trim();
            if (!clean) return "";

            const words = clean.split(" ").filter(Boolean);
            let candidate = words.slice(0, maxWords).join(" ");

            if (candidate.length > maxChars) {
                candidate = candidate.slice(0, maxChars);
                const punctuationBreak = Math.max(
                    candidate.lastIndexOf("."),
                    candidate.lastIndexOf(":"),
                    candidate.lastIndexOf(";"),
                    candidate.lastIndexOf(",")
                );
                const wordBreak = candidate.lastIndexOf(" ");
                const breakAt = punctuationBreak > maxChars * 0.55 ? punctuationBreak + 1 : wordBreak;
                candidate = candidate.slice(0, breakAt > 0 ? breakAt : maxChars).trim();
            }

            return candidate.trim();
        };

        if (front) front.value = fitFlashcardText(item.front, 56, 8);
        if (back) back.value = fitFlashcardText(item.back, 120, 18);
        if (example) example.value = fitFlashcardText(item.example, 140, 20);
    });

    const titleField = document.getElementById("cards-tema");
    if (titleField && payload.title) {
        titleField.value = payload.title;
    }

    renumberGeneratedCards("[data-flashcard]", "Card");
    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function activityColorPalette() {
    return ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1", "#84cc16", "#f97316", "#06b6d4", "#a855f7"];
}

function applyMemoryFromStructuredData(payload) {
    const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
    if (!pairs.length) return false;

    const titleField = document.getElementById("memoria-titulo");
    if (titleField) {
        titleField.value = payload.title || "Jogo da memória";
    }

    if (typeof setMemoryCountSelect === "function") {
        setMemoryCountSelect(pairs.length);
    }
    if (typeof syncMemoryPairCount === "function") {
        syncMemoryPairCount();
    }

    const cards = ensureCardCount("[data-memory-pairs]", "[data-memory-pair]", pairs.length);
    if (!cards.length) return false;

    cards.forEach((card, index) => {
        const pair = pairs[index] || {};
        const label = card.querySelector("[data-memory-label]");
        const front = card.querySelector("[data-memory-front]");
        const back = card.querySelector("[data-memory-back]");
        const color = card.querySelector("[data-memory-color]");

        if (label) label.textContent = `Par ${index + 1}`;
        if (front) front.value = pair.front || "";
        if (back) back.value = pair.back || "";
        if (color) color.value = pair.color || activityColorPalette()[index % activityColorPalette().length];
    });

    if (typeof renderMemoryPreview === "function") {
        renderMemoryPreview();
    }

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function applyMatchFromStructuredData(payload) {
    const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
    if (!pairs.length) return false;

    const titleField = document.getElementById("ligar-titulo");
    const leftLabelField = document.getElementById("ligar-coluna-a");
    const rightLabelField = document.getElementById("ligar-coluna-b");
    const shuffleField = document.getElementById("ligar-embaralhar");
    const colorModeField = document.getElementById("ligar-cores");

    if (titleField) titleField.value = payload.title || "Ligar pontos";
    if (leftLabelField) leftLabelField.value = payload.left_label || "Coluna A";
    if (rightLabelField) rightLabelField.value = payload.right_label || "Coluna B";
    if (shuffleField) shuffleField.value = payload.shuffle_right ? "Sim" : "Nao";
    if (colorModeField) colorModeField.value = "manual";

    if (typeof setMatchCountSelect === "function") {
        setMatchCountSelect(pairs.length);
    }
    if (typeof syncMatchPairCount === "function") {
        syncMatchPairCount();
    }

    const cards = ensureCardCount("[data-match-pairs]", "[data-match-pair]", pairs.length);
    if (!cards.length) return false;

    cards.forEach((card, index) => {
        const pair = pairs[index] || {};
        const label = card.querySelector("[data-match-label]");
        const left = card.querySelector("[data-match-left]");
        const right = card.querySelector("[data-match-right]");
        const color = card.querySelector("[data-match-color]");

        if (label) label.textContent = `Par ${index + 1}`;
        if (left) left.value = pair.left || "";
        if (right) right.value = pair.right || "";
        if (color) color.value = pair.color || activityColorPalette()[index % activityColorPalette().length];
    });

    if (typeof renderMatchPreview === "function") {
        renderMatchPreview();
    }

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function normalizeCrosswordWord(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase();
}

function suggestedCrosswordSize(entries) {
    const options = [9, 11, 13, 15, 17];
    const longest = entries.reduce((max, entry) => Math.max(max, normalizeCrosswordWord(entry.answer).length), 0);
    const density = Math.max(longest + 2, Math.ceil(entries.length * 1.2) + 4);
    return String(options.find((size) => size >= density) || 17);
}

function applyCrosswordFromStructuredData(payload) {
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    if (!entries.length) return false;

    const normalizedEntries = entries
        .map((entry, index) => ({
            answer: String(entry?.answer || "").trim(),
            clue: String(entry?.clue || "").trim() || `Pista ${index + 1}`
        }))
        .filter((entry) => normalizeCrosswordWord(entry.answer).length >= 2);
    if (!normalizedEntries.length) return false;

    const titleField = document.getElementById("cruzada-titulo");
    const subtitleField = document.getElementById("cruzada-subtitulo");
    const sizeField = document.getElementById("cruzada-grade");
    const aiTitleField = document.getElementById("cruzada-titulo-ia");

    if (titleField) {
        titleField.value = payload.title || aiTitleField?.value.trim() || "Palavras cruzadas";
    }
    if (subtitleField) {
        subtitleField.value = payload.subtitle || "Complete a cruzadinha usando as pistas.";
    }
    if (sizeField) {
        sizeField.value = suggestedCrosswordSize(normalizedEntries);
    }

    const cards = ensureCardCount("[data-crossword-entries]", "[data-crossword-entry]", normalizedEntries.length);
    if (!cards.length) return false;

    cards.forEach((card, index) => {
        const item = normalizedEntries[index] || {};
        const label = card.querySelector("[data-crossword-label]");
        const answer = card.querySelector("[data-crossword-answer]");
        const clue = card.querySelector("[data-crossword-clue]");

        if (label) label.textContent = `Entrada ${index + 1}`;
        if (answer) answer.value = item.answer || "";
        if (clue) clue.value = item.clue || "";
    });

    if (typeof renumberCrosswordEntries === "function") {
        renumberCrosswordEntries();
    }
    if (typeof renderCrosswordPreview === "function") {
        renderCrosswordPreview();
    }

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function applyWheelFromStructuredData(payload) {
    const segments = Array.isArray(payload?.segments) ? payload.segments : [];
    if (!segments.length) return false;

    const titleField = document.getElementById("roleta-titulo");
    const eliminationField = document.getElementById("roleta-eliminacao");

    if (titleField) titleField.value = payload.title || "Roleta";
    if (eliminationField) eliminationField.value = payload.eliminate_used ? "Sim" : "Nao";

    if (typeof setWheelCountSelect === "function") {
        setWheelCountSelect(segments.length);
    }
    if (typeof syncWheelSegmentCount === "function") {
        syncWheelSegmentCount();
    }

    const cards = ensureCardCount("[data-wheel-segments]", "[data-wheel-segment]", segments.length);
    if (!cards.length) return false;

    cards.forEach((card, index) => {
        const segment = segments[index] || {};
        const label = card.querySelector("[data-wheel-label]");
        const text = card.querySelector("[data-wheel-text]");
        const color = card.querySelector("[data-wheel-color]");

        if (label) label.textContent = `Espaço ${index + 1}`;
        if (text) text.value = segment.text || "";
        if (color) color.value = segment.color || activityColorPalette()[index % activityColorPalette().length];
    });

    if (typeof renderWheelPreview === "function") {
        renderWheelPreview();
    }

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function applyWordsearchFromStructuredData(payload) {
    const words = Array.isArray(payload?.words) ? payload.words : [];
    const normalizedWords = words
        .map((entry) => ({
            term: String(entry?.term || "").trim(),
            clue: String(entry?.clue || "").trim()
        }))
        .filter((entry) => entry.term);
    const stack = document.querySelector("[data-wordsearch-words]");

    if (!stack || normalizedWords.length < 2) return false;

    const titleField = document.getElementById("caca-titulo");
    const subtitleField = document.getElementById("caca-subtitulo");

    if (titleField) titleField.value = payload.title || "Novo caça-palavras";
    if (subtitleField) subtitleField.value = payload.subtitle || "Encontre os termos principais do conteúdo.";

    stack.innerHTML = normalizedWords.map((entry, index) => `
        <section class="platform-question-card activity-content-card wordsearch-word-card" data-wordsearch-word>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-wordsearch-label>Palavra ${index + 1}</span>
                    <h3>Conteúdo da palavra</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-wordsearch-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Palavra</label>
                    <input data-wordsearch-term data-field="term" type="text" value="${escapeAttr(entry.term)}">
                </div>
                <div class="platform-field">
                    <label>Pista opcional</label>
                    <input data-wordsearch-clue data-field="clue" type="text" value="${escapeAttr(entry.clue)}">
                </div>
            </div>
        </section>
    `).join("");

    if (typeof renumberWordsearchCards === "function") {
        renumberWordsearchCards();
    }
    if (typeof renderWordsearchPreview === "function") {
        renderWordsearchPreview();
    }

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function applyMindmapFromStructuredData(payload) {
    const branches = Array.isArray(payload?.branches) ? payload.branches : [];
    if (!branches.length) return false;

    const titleField = document.getElementById("mapa-centro");
    const subtitleField = document.getElementById("mapa-subtitulo");
    const layoutField = document.getElementById("mapa-layout");
    const countField = document.getElementById("mapa-ramos");

    if (titleField) titleField.value = payload.title || "";
    if (subtitleField) subtitleField.value = payload.subtitle || "";
    if (layoutField) setSelectByText(layoutField, "Tópicos");

    if (typeof setMindCountSelect === "function") {
        setMindCountSelect(branches.length);
    } else if (countField) {
        const option = [...countField.options].find((item) => String(item.textContent || "").includes(String(branches.length)));
        if (option) countField.value = option.value;
    }

    if (typeof syncMindBranchCount === "function") {
        syncMindBranchCount();
    }

    const cards = ensureCardCount("[data-mind-branches]", "[data-mind-branch]", branches.length);
    if (!cards.length) return false;

    cards.forEach((card, index) => {
        const branch = branches[index];
        const label = card.querySelector("[data-mind-label]");
        const title = card.querySelector("[data-mind-title]");
        const subtitle = card.querySelector("[data-mind-subtitle]");
        const detail = card.querySelector("[data-mind-detail]");
        const color = card.querySelector("[data-mind-color]");

        if (label) label.textContent = `Tópico ${index + 1}`;
        if (title) title.value = branch?.title || "";
        if (subtitle) subtitle.value = branch?.subtitle || "";
        if (detail) detail.value = branch?.detail || "";
        if (color && branch?.color) color.value = branch.color;
    });

    if (typeof renderMindPreview === "function") {
        renderMindPreview();
    }

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function applyDebateFromStructuredData(payload) {
    const steps = Array.isArray(payload?.steps) ? payload.steps : [];
    if (!steps.length) return false;

    const titleField = document.getElementById("debate-titulo");
    const questionField = document.getElementById("debate-pergunta");
    const formatField = document.getElementById("debate-formato");
    const sideAField = document.getElementById("debate-lado-a");
    const sideBField = document.getElementById("debate-lado-b");
    const countField = document.getElementById("debate-etapas");

    if (titleField) titleField.value = payload.title || "";
    if (questionField) questionField.value = payload.question || "";
    if (formatField && payload.format) setSelectByText(formatField, payload.format);
    if (sideAField) sideAField.value = payload.side_a || "";
    if (sideBField) sideBField.value = payload.side_b || "";

    if (typeof setDebateStepSelect === "function") {
        setDebateStepSelect(steps.length);
    } else if (countField) {
        const option = [...countField.options].find((item) => String(item.textContent || "").includes(String(steps.length)));
        if (option) countField.value = option.value;
    }

    if (typeof syncDebateStepCount === "function") {
        syncDebateStepCount();
    }

    const cards = ensureCardCount("[data-debate-steps]", "[data-debate-step]", steps.length);
    if (!cards.length) return false;

    cards.forEach((card, index) => {
        const step = steps[index];
        const label = card.querySelector("[data-debate-label]");
        const title = card.querySelector("[data-debate-title]");
        const time = card.querySelector("[data-debate-time]");
        const question = card.querySelector("[data-debate-question]");
        const guidance = card.querySelector("[data-debate-guidance]");

        if (label) label.textContent = `Etapa ${index + 1}`;
        if (title) title.value = step?.title || "";
        if (time) time.value = step?.time || "";
        if (question) question.value = step?.question || "";
        if (guidance) guidance.value = step?.guidance || "";
    });

    if (typeof renderDebatePreview === "function") {
        renderDebatePreview();
    }

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
    return true;
}

function buildFallbackSlides(sourceText, requestedCount) {
    const blocks = splitParagraphs(sourceText);
    const lines = normalizeLines(sourceText);
    const sentenceUnits = lines.join(" ").split(/(?<=[.!?])\s+/).filter(Boolean);
    const units = blocks.length > 1 ? blocks : sentenceUnits;
    const title = lines[0] || "Aula";
    const slides = (units.length ? units : ["Introdução ao tema", "Desenvolvimento do conteúdo", "Fechamento e revisão"])
        .slice(0, requestedCount || 6)
        .map((block, index) => ({
            type: index === 0 ? "cover" : "content",
            title: index === 0 ? summarizeBlock(title, "Aula") : `Ponto ${index}`,
            subtitle: index === 0 ? "Visão geral da aula" : "",
            body: summarizeBlock(block, "Conteúdo do slide"),
            image_prompt: index === 0 ? `Ilustração educativa sobre ${summarizeBlock(title, "o tema")}` : ""
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

function buildFallbackFlashcards(sourceText, requestedCount) {
    const lines = normalizeLines(sourceText);
    const cards = (lines.length ? lines : ["Conceito principal", "Definição importante", "Exemplo de aplicação"])
        .slice(0, requestedCount || 10)
        .map((line, index) => {
            const pair = line.split(/\s*[-:]\s*/);
            return {
                front: pair[0] || `Card ${index + 1}`,
                back: pair.slice(1).join(" - ") || summarizeBlock(line, "Definição curta"),
                example: ""
            };
        });

    return {
        title: "Flashcards estruturados",
        cards
    };
}

function buildFallbackMindmap(sourceText) {
    const lines = normalizeLines(sourceText);
    const title = lines[0] || "Tema da aula";
    const branches = (lines.slice(1).length ? lines.slice(1) : ["Contexto", "Ideias centrais", "Exemplos", "Fechamento"])
        .slice(0, 6)
        .map((line, index) => ({
            title: summarizeBlock(line, `Tópico ${index + 1}`),
            subtitle: `Ideia-chave ${index + 1}`,
            detail: summarizeBlock(line, "Explique o conceito principal."),
            color: ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"][index % 6]
        }));

    return {
        title,
        subtitle: "Panorama dos conceitos principais",
        branches
    };
}

function buildFallbackDebate(sourceText) {
    const lines = normalizeLines(sourceText);
    const title = lines[0] || "Debate guiado";
    const question = lines.find((line) => line.includes("?")) || "Como podemos analisar esse tema por perspectivas diferentes?";

    return {
        title,
        question,
        format: "Dois lados",
        side_a: "Posição A",
        side_b: "Posição B",
        steps: [
            {
                title: "Aquecimento",
                time: "5 min",
                question: question,
                guidance: "Ative conhecimentos previos e organize as primeiras opinioes."
            },
            {
                title: "Confronto de argumentos",
                time: "8 min",
                question: "Quais argumentos apoiam cada lado?",
                guidance: "Peca justificativas, exemplos e respeito ao turno de fala."
            },
            {
                title: "Fechamento",
                time: "5 min",
                question: "O que aprendemos com as duas perspectivas?",
                guidance: "Sintetize ideias centrais e destaque pontos de convergencia."
            }
        ]
    };
}

function buildFallbackMemory(sourceText, requestedCount) {
    const lines = normalizeLines(sourceText);
    const palette = activityColorPalette();
    const pairs = (lines.length ? lines : ["Conceito principal - Definição curta", "Pergunta - Resposta objetiva", "Evento - Data importante"])
        .map((line, index) => {
            const parts = line.split(/\s*[—–:-]\s*/).filter(Boolean);
            return {
                front: summarizeBlock(parts[0] || line, `Par ${index + 1}`),
                back: summarizeBlock(parts.slice(1).join(" - ") || line, "Resposta"),
                color: palette[index % palette.length]
            };
        })
        .slice(0, requestedCount || 6);

    return {
        title: "Jogo da memória estruturado",
        pairs
    };
}

function buildFallbackMatch(sourceText, requestedCount) {
    const lines = normalizeLines(sourceText);
    const palette = activityColorPalette();
    const pairs = (lines.length ? lines : ["Conceito - Definição", "País - Capital", "Autor - Obra", "Evento - Data"])
        .map((line, index) => {
            const parts = line.split(/\s*[—–:-]\s*/).filter(Boolean);
            return {
                left: summarizeBlock(parts[0] || `Item ${index + 1}`, `Item ${index + 1}`),
                right: summarizeBlock(parts.slice(1).join(" - ") || line, `Resposta ${index + 1}`),
                color: palette[index % palette.length]
            };
        })
        .slice(0, requestedCount || 6);

    return {
        title: "Ligar pontos estruturado",
        left_label: "Coluna A",
        right_label: "Coluna B",
        shuffle_right: true,
        pairs
    };
}

function extractCrosswordEntriesFromDelimitedLines(lines, requestedCount) {
    return lines
        .map((line) => {
            const parts = line.split(/\s*[—–:-]\s*/).filter(Boolean);
            if (parts.length < 2) return null;
            return {
                answer: summarizeBlock(parts[0], "Termo"),
                clue: summarizeBlock(parts.slice(1).join(" - "), "Pista")
            };
        })
        .filter(Boolean)
        .slice(0, requestedCount || 8);
}

function buildKeywordEntriesForCrossword(sourceText, requestedCount) {
    const lines = normalizeLines(sourceText);
    const cleanSentences = String(sourceText || "")
        .replace(/\r/g, "")
        .split(/(?<=[.!?])\s+|\n+/)
        .map((item) => item.replace(/\s+/g, " ").trim())
        .filter(Boolean);
    const stopwords = new Set([
        "A", "AS", "O", "OS", "UM", "UMA", "UNS", "UMAS", "DE", "DA", "DO", "DAS", "DOS", "E", "EM", "NO", "NA", "NOS", "NAS",
        "PARA", "POR", "COM", "SEM", "SOBRE", "AO", "AOS", "QUE", "SE", "SER", "SAO", "EH", "FOI", "ERA", "COMO", "MAIS",
        "MENOS", "MUITO", "MUITA", "MUITOS", "MUITAS", "JA", "TAMBEM", "ENTRE", "SEU", "SUA", "SEUS", "SUAS", "NUM", "NUMA",
        "NESTE", "NESTA", "NESSE", "NESSA", "ESTE", "ESTA", "ESSE", "ESSA", "TEMA", "AULA", "ASSUNTO", "TOPICO"
    ]);
    const frequency = new Map();
    const displayMap = new Map();

    cleanSentences.forEach((sentence) => {
        sentence.split(/[^A-Za-zÀ-ÿ0-9]+/)
            .map((word) => String(word || "").trim())
            .filter(Boolean)
            .forEach((word) => {
                const normalized = normalizeCrosswordWord(word);
                if (normalized.length < 3 || normalized.length > 14 || stopwords.has(normalized)) return;

                frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
                if (!displayMap.has(normalized)) {
                    displayMap.set(normalized, word);
                }
            });
    });

    return [...frequency.entries()]
        .sort((left, right) => {
            if (right[1] !== left[1]) return right[1] - left[1];
            if (right[0].length !== left[0].length) return right[0].length - left[0].length;
            return left[0].localeCompare(right[0]);
        })
        .slice(0, requestedCount || 8)
        .map(([normalized], index) => {
            const answer = displayMap.get(normalized) || normalized;
            const sentence = cleanSentences.find((item) => normalizeCrosswordWord(item).includes(normalized)) || lines[index] || "";
            const clue = sentence && normalizeCrosswordWord(sentence) !== normalized
                ? summarizeBlock(sentence, "Palavra-chave do tema")
                : "Palavra-chave relacionada ao tema.";
            return { answer, clue };
        });
}

function buildFallbackCrossword(sourceText, requestedCount) {
    const lines = normalizeLines(sourceText);
    const requested = Math.max(4, Math.min(12, requestedCount || 8));
    const explicitEntries = extractCrosswordEntriesFromDelimitedLines(lines, requested);
    const generatedEntries = explicitEntries.length >= 2
        ? explicitEntries
        : buildKeywordEntriesForCrossword(sourceText, requested);
    const topic = lines[0] || "tema";

    return {
        title: document.getElementById("cruzada-titulo-ia")?.value.trim() || `Cruzadinha sobre ${summarizeBlock(topic, "o tema")}`,
        subtitle: `Complete a cruzadinha com base no tema estudado: ${summarizeBlock(topic, "conteúdo da aula")}.`,
        entries: generatedEntries.length >= 2
            ? generatedEntries
            : [
                { answer: summarizeBlock(topic.split(/\s+/)[0] || "Tema", "Tema"), clue: "Palavra principal do tema." },
                { answer: summarizeBlock(topic.split(/\s+/)[1] || "Aula", "Aula"), clue: "Segunda palavra relacionada ao tema." }
            ]
    };
}

function buildFallbackWheel(sourceText, requestedCount) {
    const lines = normalizeLines(sourceText);
    const palette = activityColorPalette();
    const segments = (lines.length ? lines : ["Pergunta 1", "Pergunta 2", "Desafio rápido", "Curiosidade", "Revisão", "Exemplo"])
        .slice(0, requestedCount || 8)
        .map((line, index) => ({
            text: summarizeBlock(line, `Espaço ${index + 1}`),
            color: palette[index % palette.length]
        }));

    return {
        title: "Roleta estruturada",
        eliminate_used: false,
        segments
    };
}

function buildFallbackWordsearch(sourceText, requestedCount) {
    const lines = normalizeLines(sourceText);
    const requested = Math.max(2, Math.min(20, requestedCount || 8));
    const words = (lines.length ? lines : ["Tema", "Conceito", "Exemplo", "Revisão", "Conteúdo", "Aula", "Termo", "Palavra"])
        .map((line) => {
            const parts = line.split(/\s*[—–:-]\s*/).filter(Boolean);
            return {
                term: summarizeBlock(parts[0] || line, "Palavra"),
                clue: summarizeBlock(parts.slice(1).join(" - "), "")
            };
        })
        .filter((entry) => entry.term)
        .slice(0, requested);

    const topic = lines[0] || "o tema";
    return {
        title: `Caça-palavras sobre ${summarizeBlock(topic, "o tema")}`,
        subtitle: "Encontre os termos principais escondidos na grade.",
        words
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

function resolveTemplateEndpoint() {
    const endpoint = resolveAiEndpoint();
    return endpoint.replace(/\/api\/ai\/generate$/, "/api/model-template/generate");
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
        headers: typeof window.educariaAiAuthHeaders === "function" ? await window.educariaAiAuthHeaders() : {},
        body: formData
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        if (errorPayload?.credits) {
            document.dispatchEvent(new CustomEvent("educaria-ai-credits-updated", {
                detail: { credits: errorPayload.credits }
            }));
        }
        throw new Error(errorPayload?.error || "Não foi possível gerar o material com IA.");
    }

    const payload = await response.json();
    document.dispatchEvent(new CustomEvent("educaria-ai-credits-updated", {
        detail: { credits: payload?.credits || null }
    }));
    return payload;
}

async function requestTemplateStructuredMaterial(materialType, file) {
    const endpoint = resolveTemplateEndpoint();
    const formData = new FormData();
    formData.append("materialType", materialType);

    if (file) {
        formData.append("file", file);
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: typeof window.educariaAiAuthHeaders === "function" ? await window.educariaAiAuthHeaders() : {},
        body: formData
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.error || "Não foi possível estruturar o arquivo modelo.");
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

    if (materialType === "flashcards") {
        return {
            textId: "cards-fonte-texto",
            fileId: "cards-arquivo",
            actionId: "cards-acao-ia",
            countId: "cards-quantidade-livre",
            apply: applyFlashcardsFromStructuredData,
            fallback: buildFallbackFlashcards
        };
    }

    if (materialType === "memory") {
        return {
            textId: "memoria-fonte-texto",
            fileId: "memoria-arquivo",
            actionId: "memoria-acao-ia",
            countId: "memoria-quantidade-livre",
            apply: applyMemoryFromStructuredData,
            fallback: buildFallbackMemory
        };
    }

    if (materialType === "crossword") {
        return {
            textId: "cruzada-fonte-texto",
            fileId: "cruzada-arquivo",
            actionId: "cruzada-acao-ia",
            countId: "cruzada-quantidade",
            apply: applyCrosswordFromStructuredData,
            fallback: buildFallbackCrossword
        };
    }

    if (materialType === "match") {
        return {
            textId: "ligar-fonte-texto",
            fileId: "ligar-arquivo",
            actionId: "ligar-acao-ia",
            countId: "ligar-quantidade-livre",
            apply: applyMatchFromStructuredData,
            fallback: buildFallbackMatch
        };
    }

    if (materialType === "wheel") {
        return {
            textId: "roleta-fonte-texto",
            fileId: "roleta-arquivo",
            actionId: "roleta-acao-ia",
            countId: "roleta-quantidade-livre",
            apply: applyWheelFromStructuredData,
            fallback: buildFallbackWheel
        };
    }

    if (materialType === "wordsearch") {
        return {
            textId: "caca-fonte-texto",
            fileId: "caca-arquivo",
            countId: "caca-quantidade-ia",
            apply: applyWordsearchFromStructuredData,
            fallback: buildFallbackWordsearch
        };
    }

    if (materialType === "mindmap") {
        return {
            textId: "mind-fonte-texto",
            fileId: "mind-arquivo",
            actionId: "mind-acao-ia",
            countId: "mind-quantidade",
            layoutId: "mind-layout-ia",
            apply: applyMindmapFromStructuredData,
            fallback: buildFallbackMindmap
        };
    }

    if (materialType === "debate") {
        return {
            textId: "debate-fonte-texto",
            fileId: "debate-arquivo",
            actionId: "debate-acao-ia",
            countId: "debate-etapas-livre",
            formatId: "debate-formato-ia",
            apply: applyDebateFromStructuredData,
            fallback: buildFallbackDebate
        };
    }

    return null;
}

async function generateMaterialFromTemplate(materialType, button) {
    const config = materialConfig(materialType);
    if (!config) return;

    const fileField = document.getElementById(config.fileId);
    const file = fileField?.files?.[0] || null;

    if (!file) {
        window.alert("Envie um arquivo preenchido com o modelo antes de usar esta opcao.");
        return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Lendo modelo...";

    try {
        let material = null;

        if (materialType === "wheel") {
            const fileText = await readTemplateFile(file);
            if (!fileText) {
                throw new Error("Use o arquivo modelo baixado da roleta em formato RTF ou TXT.");
            }
            material = parseWheelTemplateTextLocal(fileText);
        } else {
            const payload = await requestTemplateStructuredMaterial(materialType, file);
            material = payload?.material;
        }

        const applied = config.apply(material);
        if (!applied) {
            throw new Error("O arquivo modelo não trouxe dados suficientes para preencher o editor.");
        }

        openAiReadyModal();
    } catch (error) {
        const detail = error instanceof Error ? error.message : "Erro desconhecido.";
        window.alert(`Não foi possível montar o material a partir do arquivo modelo.\n\nDetalhe: ${detail}`);
    } finally {
        button.disabled = false;
        button.textContent = originalLabel;
    }
}

async function generateMaterial(materialType, button) {
    const config = materialConfig(materialType);
    if (!config) return;

    const textField = document.getElementById(config.textId);
    const fileField = document.getElementById(config.fileId);
    const actionField = document.getElementById(config.actionId);
    const countField = config.countId ? document.getElementById(config.countId) : null;
    const formatField = config.formatId ? document.getElementById(config.formatId) : null;
    const layoutField = config.layoutId ? document.getElementById(config.layoutId) : null;
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
    const layoutText = layoutField ? layoutField.options[layoutField.selectedIndex].text.trim() : "";
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

        let generationHints = materialType === "quiz"
            ? [
                action,
                requestedCount ? `Gerar ${requestedCount} perguntas.` : "",
                formatText ? `Formato desejado: ${formatText}.` : ""
            ].filter(Boolean).join(" ")
            : materialType === "slides"
                ? [
                action,
                requestedCount ? `Gerar ${requestedCount} slides.` : "",
                audienceText ? `Público ou ano: ${audienceText}.` : "",
                objectiveText ? `Objetivo da aula: ${objectiveText}.` : "",
                toneText ? `Tom desejado: ${toneText}.` : "",
                detailText ? `Nível de detalhamento: ${detailText}.` : "",
                imagePrefText ? `Uso de imagens: ${imagePrefText}.` : ""
            ].filter(Boolean).join(" ")
                : materialType === "flashcards"
                    ? [
                action,
                requestedCount ? `Gerar ${requestedCount} cards.` : "",
                document.getElementById("cards-exemplo")?.value ? `Incluir exemplos: ${document.getElementById("cards-exemplo").value}.` : ""
            ].filter(Boolean).join(" ")
                    : materialType === "mindmap"
                        ? [
                action,
                requestedCount ? `Gerar ${requestedCount} tópicos.` : "",
                layoutText ? `Leitura desejada: ${layoutText}.` : ""
            ].filter(Boolean).join(" ")
                        : materialType === "crossword"
                            ? [
                action,
                requestedCount ? `Gerar ${requestedCount} entradas.` : "",
                document.getElementById("cruzada-titulo-ia")?.value ? `Título desejado: ${document.getElementById("cruzada-titulo-ia").value}.` : "",
                "Retornar respostas curtas e pistas objetivas em portugues do Brasil."
            ].filter(Boolean).join(" ")
                        : materialType === "memory"
                            ? [
                action,
                requestedCount ? `Gerar ${requestedCount} pares.` : "",
                document.getElementById("memoria-titulo")?.value ? `Título desejado: ${document.getElementById("memoria-titulo").value}.` : ""
            ].filter(Boolean).join(" ")
                            : materialType === "match"
                                ? [
                action,
                requestedCount ? `Gerar ${requestedCount} pares.` : "",
                document.getElementById("ligar-coluna-a")?.value ? `Nome da coluna A: ${document.getElementById("ligar-coluna-a").value}.` : "",
                document.getElementById("ligar-coluna-b")?.value ? `Nome da coluna B: ${document.getElementById("ligar-coluna-b").value}.` : "",
                document.getElementById("ligar-embaralhar")?.value === "Sim" ? "Embaralhar a coluna B." : "Manter a coluna B na ordem normal."
            ].filter(Boolean).join(" ")
                                : materialType === "wheel"
                                    ? [
                action,
                requestedCount ? `Gerar ${requestedCount} espaços.` : "",
                document.getElementById("roleta-eliminacao")?.value === "Sim" ? "Eliminar item sorteado após uso." : "Não eliminar item sorteado."
            ].filter(Boolean).join(" ")
                        : [
                action,
                requestedCount ? `Gerar ${requestedCount} etapas.` : "",
                formatText ? `Formato desejado: ${formatText}.` : ""
            ].filter(Boolean).join(" ");

        if (materialType === "wordsearch") {
            generationHints = [
                requestedCount ? `Gerar ${requestedCount} palavras.` : "",
                "Prefira termos curtos, claros e adequados para um caca-palavras."
            ].filter(Boolean).join(" ");
        }

        const payload = await requestStructuredMaterial(materialType, sourceText, file, generationHints);
        const applied = config.apply(payload?.material);
        if (!applied) {
            throw new Error("A resposta da IA não trouxe dados suficientes para preencher o editor.");
        }

        openAiReadyModal();
    } catch (error) {
        console.warn("EducarIA AI generation fallback:", error);
        const fallbackPayload = config.fallback(sourceText, requestedCount);
        if (fallbackPayload) {
            config.apply(fallbackPayload);
        }
        const endpoint = resolveAiEndpoint();
        const detail = error instanceof Error ? error.message : "Erro desconhecido.";
        const normalizedDetail = String(detail).toLowerCase();
        const quotaMessage = normalizedDetail.includes("quota") || normalizedDetail.includes("429") || normalizedDetail.includes("resource_exhausted")
            ? "A cota da API Gemini foi excedida. O editor usou um modo local simplificado."
            : "A IA real não respondeu. O editor usou um modo local simplificado.";
        window.alert(`${quotaMessage}\n\nDetalhe: ${detail}\nEndpoint: ${endpoint}`);
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

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-generate-model-material]");
        if (!button) return;

        event.preventDefault();
        const materialType = button.dataset.generateModelMaterial;
        generateMaterialFromTemplate(materialType, button);
    });

    document.addEventListener("click", (event) => {
        if (event.target.matches("[data-ai-ready-modal]") || event.target.closest("[data-ai-ready-modal-close]")) {
            closeAiReadyModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAiReadyModal();
        }
    });
}

document.addEventListener("DOMContentLoaded", bindAiMaterialGenerator);
