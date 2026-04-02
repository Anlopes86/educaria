function createSvgDataUrl(title, subtitle, palette) {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${palette[0]}"/>
                    <stop offset="100%" stop-color="${palette[1]}"/>
                </linearGradient>
            </defs>
            <rect width="1200" height="720" fill="url(#g)"/>
            <circle cx="980" cy="140" r="120" fill="rgba(255,255,255,0.18)"/>
            <circle cx="180" cy="580" r="160" fill="rgba(255,255,255,0.14)"/>
            <rect x="90" y="96" width="1020" height="528" rx="36" fill="rgba(255,255,255,0.18)"/>
            <text x="120" y="230" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#0f172a">${title}</text>
            <text x="120" y="310" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="#0f172a">${subtitle}</text>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function panelFor(card) {
    return card.querySelector("[data-image-panel]");
}

function getMode(card) {
    return card.querySelector('[data-field="slide-image-mode"]')?.value || "Sem imagem";
}

function updateImageUrl(card, url) {
    const field = card.querySelector('[data-field="slide-image-url"]');
    if (field) field.value = url;
}

function updateImagePrompt(card, value) {
    const field = card.querySelector('[data-field="slide-image-prompt"]');
    if (field) field.value = value;
}

function clearImageSelection(card) {
    updateImageUrl(card, "");
    updateImagePrompt(card, "");
}

function syncPanelMode(card) {
    const panel = panelFor(card);
    if (!panel) return;

    const mode = getMode(card);
    const sourceCards = panel.querySelectorAll(".resource-source-card");
    const results = panel.querySelectorAll(".resource-result-card");
    const aiButton = panel.querySelector("[data-generate-ai-image]");

    sourceCards.forEach((section) => {
        section.hidden = true;
    });

    results.forEach((result, index) => {
        if (mode === "Biblioteca") {
            result.hidden = index !== 0;
            return;
        }

        if (mode === "Buscar gratis") {
            result.hidden = index === 0;
            return;
        }

        if (mode === "Buscar grátis") {
            result.hidden = index === 0;
            return;
        }

        result.hidden = true;
    });

    if (sourceCards[0]) sourceCards[0].hidden = mode !== "Upload";
    if (sourceCards[1]) sourceCards[1].hidden = mode !== "Biblioteca";
    if (sourceCards[2]) sourceCards[2].hidden = mode !== "Buscar gr&aacute;tis" && mode !== "Buscar grátis" && mode !== "Buscar gratis";
    if (aiButton) aiButton.hidden = mode !== "Gerar com IA";
}

function applySelectedImage(card, prompt, url) {
    updateImagePrompt(card, prompt);
    updateImageUrl(card, url);
    document.dispatchEvent(new Event("input"));
}

function handleLocalUpload(card, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        applySelectedImage(card, file.name, reader.result);
    };
    reader.readAsDataURL(file);
}

function bindSlideImageTools() {
    document.addEventListener("change", (event) => {
        const modeSelect = event.target.closest('[data-field="slide-image-mode"]');
        if (modeSelect) {
            const card = modeSelect.closest("[data-slide-card]");
            const panel = panelFor(card);
            if (!card || !panel) return;

            if (modeSelect.value === "Sem imagem") {
                clearImageSelection(card);
                panel.hidden = true;
                document.dispatchEvent(new Event("input"));
                return;
            }

            syncPanelMode(card);
            panel.hidden = false;
        }

        const uploadInput = event.target.closest("[data-upload-input]");
        if (uploadInput) {
            const card = uploadInput.closest("[data-slide-card]");
            const file = uploadInput.files && uploadInput.files[0];
            if (card && file) handleLocalUpload(card, file);
        }
    });

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-open-resource]");
        if (trigger) {
            event.preventDefault();
            const card = trigger.closest("[data-slide-card]");
            const panel = panelFor(card);
            if (!card || !panel) return;

            const modeField = card.querySelector('[data-field="slide-image-mode"]');
            if (modeField && modeField.value === "Sem imagem") {
                modeField.value = "Gerar com IA";
            }

            syncPanelMode(card);
            panel.hidden = !panel.hidden;
        }

        const pick = event.target.closest("[data-pick-image]");
        if (pick) {
            event.preventDefault();
            const card = pick.closest("[data-slide-card]");
            if (!card) return;

            const label = pick.dataset.label || "Imagem selecionada";
            const prompt = pick.dataset.prompt || label;
            const theme = pick.dataset.theme || label;
            const palette = (pick.dataset.palette || "#c7f0f3,#eff6ff").split(",");
            const url = createSvgDataUrl(label, theme, palette);
            applySelectedImage(card, prompt, url);
        }

        const generate = event.target.closest("[data-generate-ai-image]");
        if (generate) {
            event.preventDefault();
            const card = generate.closest("[data-slide-card]");
            if (!card) return;

            const title = card.querySelector('[data-field="slide-title"]')?.value.trim() || "Slide";
            const subtitle = card.querySelector('[data-field="slide-subtitle"]')?.value.trim() || "";
            const body = card.querySelector('[data-field="slide-body"]')?.value.trim() || "";
            const prompt = subtitle || body || "Ilustracao educacional";
            const url = createSvgDataUrl(title, prompt, ["#99f6e4", "#dbeafe"]);
            applySelectedImage(card, prompt, url);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    bindSlideImageTools();
    document.querySelectorAll("[data-slide-card]").forEach((card) => {
        syncPanelMode(card);
    });
});
