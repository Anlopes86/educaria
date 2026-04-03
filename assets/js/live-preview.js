function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function textValue(scope, field) {
    const el = scope.querySelector(`[data-field="${field}"]`);
    return el ? el.value.trim() : "";
}

function selectValue(scope, field) {
    const el = scope.querySelector(`[data-field="${field}"]`);
    return el ? el.options[el.selectedIndex].text.trim() : "";
}

function colorValue(scope, field, fallback = "#dff6f8") {
    const el = scope.querySelector(`[data-field="${field}"]`);
    const value = el ? el.value.trim() : "";
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function renderQuestionOptions(options, correctKey) {
    return `
        <div class="preview-option-list">
            ${options.map((item) => `
                <div class="preview-option ${item.key === correctKey ? "is-correct" : ""}">
                    <span>${escapeHtml(item.value || "Sem op&ccedil;&atilde;o")}</span>
                    <span class="preview-badge">${item.key === correctKey ? "Correta" : item.label}</span>
                </div>
            `).join("")}
        </div>
    `;
}

function renderSlideMedia(title, imagePrompt, imageUrl) {
    return `
        <div class="slide-image-preview">
            ${imageUrl ? `
                <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}">
            ` : `
                <div class="slide-image-preview-placeholder">
                    <div>
                        <strong>Imagem do slide</strong>
                        <p style="margin-top: 10px;">${escapeHtml(imagePrompt)}</p>
                    </div>
                </div>
            `}
        </div>
    `;
}

function buildQuizPreview() {
    const root = document.querySelector("[data-quiz-preview]");
    if (!root) return;

    const totalEl = document.getElementById("quiz-quantidade");
    const formatEl = document.getElementById("quiz-formato");
    const total = totalEl ? totalEl.options[totalEl.selectedIndex].text.trim() : "Quiz";
    const format = formatEl ? formatEl.options[formatEl.selectedIndex].text.trim() : "Misto";
    const cards = [...document.querySelectorAll("[data-quiz-question]")];

    root.innerHTML = `
        <section class="live-preview-card live-preview-card--teal">
            <span class="platform-section-label">Pr&eacute;-visualiza&ccedil;&atilde;o</span>
            <h3>Quiz completo</h3>
            <div class="preview-chip-row">
                <span class="preview-chip">${escapeHtml(total)}</span>
                <span class="preview-chip">${escapeHtml(format)}</span>
                <span class="preview-chip">${cards.length} quest&otilde;es na tela</span>
            </div>
        </section>
        ${cards.map((card, index) => {
            const type = selectValue(card, "type");
            const prompt = textValue(card, "prompt") || "Sem enunciado";
            const explanation = textValue(card, "explanation") || "Sem explica&ccedil;&atilde;o";

            if (type === "Pergunta aberta") {
                const model = textValue(card, "model") || "Sem resposta modelo";
                const criteria = textValue(card, "criteria") || "Sem crit&eacute;rio";
                return `
                    <section class="live-preview-card">
                        <span class="platform-section-label">Quest&atilde;o ${index + 1}</span>
                        <h3>${escapeHtml(prompt)}</h3>
                        <ul class="preview-mini-list">
                            <li><span>Tipo</span><strong>${escapeHtml(type)}</strong></li>
                            <li><span>Modelo</span><strong>${escapeHtml(model)}</strong></li>
                            <li><span>Crit&eacute;rio</span><strong>${escapeHtml(criteria)}</strong></li>
                        </ul>
                        <p style="margin-top: 14px;">${escapeHtml(explanation)}</p>
                    </section>
                `;
            }

            const correct = selectValue(card, "correct");
            const options = [...card.querySelectorAll("[data-option]")].map((option, optionIndex) => ({
                label: String.fromCharCode(65 + optionIndex),
                key: option.dataset.optionKey || "",
                value: option.value.trim()
            })).filter((option) => option.value);

            return `
                <section class="live-preview-card">
                    <span class="platform-section-label">Quest&atilde;o ${index + 1}</span>
                    <h3>${escapeHtml(prompt)}</h3>
                    <div class="preview-chip-row">
                        <span class="preview-chip">${escapeHtml(type || "Sem tipo")}</span>
                    </div>
                    ${renderQuestionOptions(options, correct)}
                    <p style="margin-top: 14px;">${escapeHtml(explanation)}</p>
                </section>
            `;
        }).join("")}
    `;
}

function buildFlashcardsPreview() {
    const root = document.querySelector("[data-flashcards-preview]");
    if (!root) return;

    const totalEl = document.getElementById("cards-quantidade");
    const formatEl = document.getElementById("cards-formato");
    const exampleEl = document.getElementById("cards-exemplo");
    const total = totalEl ? totalEl.options[totalEl.selectedIndex].text.trim() : "Cards";
    const format = formatEl ? formatEl.options[formatEl.selectedIndex].text.trim() : "Palavra e tradu&ccedil;&atilde;o";
    const includeExample = exampleEl ? exampleEl.options[exampleEl.selectedIndex].text.trim() : "Sim";
    const cards = [...document.querySelectorAll("[data-flashcard]")];

    root.innerHTML = `
        <section class="live-preview-card live-preview-card--teal">
            <span class="platform-section-label">Pr&eacute;-visualiza&ccedil;&atilde;o</span>
            <h3>Todos os cards</h3>
            <div class="preview-chip-row">
                <span class="preview-chip">${escapeHtml(total)}</span>
                <span class="preview-chip">${escapeHtml(format)}</span>
                <span class="preview-chip">${cards.length} cards na tela</span>
            </div>
        </section>
        ${cards.map((card, index) => {
            const front = textValue(card, "front") || "Sem frente";
            const back = textValue(card, "back") || "Sem verso";
            const example = textValue(card, "example") || "Sem exemplo";
            const frontColor = colorValue(card, "front-color", "#ffffff");
            const backColor = colorValue(card, "back-color", "#dbeafe");
            const textColor = colorValue(card, "text-color", "#0f172a");

            return `
                <section class="live-preview-card">
                    <span class="platform-section-label">Card ${index + 1}</span>
                    <div class="flashcard-preview">
                        <div class="flashcard-preview-face" style="background: ${escapeHtml(frontColor)}; color: ${escapeHtml(textColor)};">
                            <strong>Frente</strong>
                            <span>${escapeHtml(front)}</span>
                        </div>
                        <div class="flashcard-preview-face" style="background: ${escapeHtml(backColor)}; color: ${escapeHtml(textColor)};">
                            <strong>Verso</strong>
                            <span>${escapeHtml(back)}</span>
                        </div>
                        ${includeExample === "Sim" ? `
                            <div class="flashcard-preview-example" style="color: ${escapeHtml(textColor)};">
                                <strong>Exemplo</strong>
                                <p>${escapeHtml(example)}</p>
                            </div>
                        ` : ""}
                    </div>
                </section>
            `;
        }).join("")}
    `;
}

function buildSlidesPreview() {
    const root = document.querySelector("[data-slides-preview]");
    if (!root) return;

    const slides = [...document.querySelectorAll("[data-slide-card]")];
    const totalEl = document.getElementById("slides-quantidade");
    const formatEl = document.getElementById("slides-tipo");
    const total = totalEl ? totalEl.options[totalEl.selectedIndex].text.trim() : "Slides";
    const format = formatEl ? formatEl.options[formatEl.selectedIndex].text.trim() : "Misto";

    root.innerHTML = `
        <section class="live-preview-card live-preview-card--teal">
            <span class="platform-section-label">Pr&eacute;-visualiza&ccedil;&atilde;o</span>
            <h3>Sequ&ecirc;ncia de slides</h3>
            <div class="preview-chip-row">
                <span class="preview-chip">${escapeHtml(total)}</span>
                <span class="preview-chip">${escapeHtml(format)}</span>
                <span class="preview-chip">${slides.length} slides na tela</span>
            </div>
        </section>
        ${slides.map((slide, index) => {
            const title = textValue(slide, "slide-title") || "Sem t&iacute;tulo";
            const subtitle = textValue(slide, "slide-subtitle");
            const body = textValue(slide, "slide-body") || "Sem conte&uacute;do";
            const imageMode = selectValue(slide, "slide-image-mode") || "Sem imagem";
            const imagePrompt = textValue(slide, "slide-image-prompt") || "Sem imagem definida";
            const imageUrl = textValue(slide, "slide-image-url");
            const slideColor = colorValue(slide, "slide-color");
            const textColor = colorValue(slide, "slide-text-color", "#0f172a");
            const accentColor = colorValue(slide, "slide-accent-color", "#0ea5e9");
            const slideFont = selectValue(slide, "slide-font") || "Destaque moderno";
            const slideLayout = selectValue(slide, "slide-layout") || "Texto acima";

            const textBlock = `
                <div class="slide-preview-text slide-preview-text--${escapeHtml(slideFont.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"))}" style="color: ${escapeHtml(textColor)};">
                    <h3>${escapeHtml(title)}</h3>
                    ${subtitle ? `<h4>${escapeHtml(subtitle)}</h4>` : ""}
                    <p style="margin-top: 14px;">${escapeHtml(body)}</p>
                </div>
            `;

            const mediaBlock = imageMode !== "Sem imagem" ? renderSlideMedia(title, imagePrompt, imageUrl) : "";
            let slideBody = textBlock;

            if (imageMode !== "Sem imagem" && slideLayout === "Lado a lado") {
                slideBody = `
                    <div class="slide-preview-layout slide-preview-layout--split">
                        ${textBlock}
                        ${mediaBlock}
                    </div>
                `;
            } else if (imageMode !== "Sem imagem" && slideLayout === "Imagem em destaque") {
                slideBody = `
                    <div class="slide-preview-layout slide-preview-layout--feature">
                        ${mediaBlock}
                        ${textBlock}
                    </div>
                `;
            } else if (imageMode !== "Sem imagem") {
                slideBody = `
                    <div class="slide-preview-layout slide-preview-layout--stack">
                        ${textBlock}
                        ${mediaBlock}
                    </div>
                `;
            }

            return `
                <section class="live-preview-card live-preview-card--teal slide-preview-card" style="--slide-preview-accent: ${escapeHtml(accentColor)}; background: linear-gradient(180deg, ${escapeHtml(slideColor)} 0%, #ffffff 100%); border-color: ${escapeHtml(slideColor)};">
                    <span class="platform-section-label">Slide ${index + 1}</span>
                    <div class="preview-chip-row">
                        <span class="preview-chip">${escapeHtml(imageMode)}</span>
                        <span class="preview-chip">${escapeHtml(slideLayout)}</span>
                        <span class="preview-chip">${escapeHtml(slideFont)}</span>
                    </div>
                    ${slideBody}
                </section>
            `;
        }).join("")}
    `;
}

function renderLivePreviews() {
    buildQuizPreview();
    buildFlashcardsPreview();
    buildSlidesPreview();
}

document.addEventListener("DOMContentLoaded", renderLivePreviews);
document.addEventListener("input", renderLivePreviews);
document.addEventListener("change", renderLivePreviews);
