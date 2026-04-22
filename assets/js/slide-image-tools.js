function escapeSvgText(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

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
            <text x="120" y="230" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#0f172a">${escapeSvgText(title)}</text>
            <text x="120" y="310" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="#0f172a">${escapeSvgText(subtitle)}</text>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const LOCAL_PLACEHOLDER_IMAGE_MODE = "Placeholder local";
const LEGACY_AI_IMAGE_MODE = "Gerar com IA";

function resolveAiGenerateEndpoint() {
    if (window.EDUCARIA_AI_ENDPOINT) {
        return window.EDUCARIA_AI_ENDPOINT;
    }

    if (window.location.protocol === "file:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return "http://localhost:8787/api/ai/generate";
    }

    return "/api/ai/generate";
}

function resolveAiImageEndpoint() {
    return resolveAiGenerateEndpoint().replace(/\/api\/ai\/generate$/, "/api/ai/generate-image");
}

function aiImageGenerationEnabled() {
    return window.EDUCARIA_AI_IMAGE_GENERATION_ENABLED === true;
}

function isGeneratedImageMode(mode) {
    return mode === LOCAL_PLACEHOLDER_IMAGE_MODE || mode === LEGACY_AI_IMAGE_MODE;
}

async function requestAiSlideImage(payload) {
    const response = await fetch(resolveAiImageEndpoint(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(typeof window.educariaAiAuthHeaders === "function" ? await window.educariaAiAuthHeaders() : {})
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload?.detail || errorPayload?.error || "Falha ao gerar imagem.");
    }

    return response.json();
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
    if (aiButton) aiButton.hidden = !isGeneratedImageMode(mode);
    if (aiButton && isGeneratedImageMode(mode) && !aiImageGenerationEnabled()) {
        aiButton.textContent = "Usar placeholder local";
    }
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
                modeField.value = LOCAL_PLACEHOLDER_IMAGE_MODE;
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
            const existingPrompt = card.querySelector('[data-field="slide-image-prompt"]')?.value.trim() || "";
            const prompt = existingPrompt || subtitle || body || "Ilustracao educacional";
            const originalText = generate.textContent;

            if (!aiImageGenerationEnabled()) {
                const url = createSvgDataUrl(title, prompt, ["#99f6e4", "#dbeafe"]);
                applySelectedImage(card, prompt, url);
                return;
            }

            generate.disabled = true;
            generate.textContent = "Gerando imagem...";

            requestAiSlideImage({ title, subtitle, body, prompt })
                .then((result) => {
                    const mimeType = result?.mimeType || "image/png";
                    const imageBase64 = result?.imageBase64 || "";
                    if (!imageBase64) {
                        throw new Error("O backend não retornou imagem.");
                    }

                    const url = `data:${mimeType};base64,${imageBase64}`;
                    applySelectedImage(card, prompt, url);
                })
                .catch((error) => {
                    console.warn("EducarIA image generation fallback:", error);
                    const url = createSvgDataUrl(title, prompt, ["#99f6e4", "#dbeafe"]);
                    applySelectedImage(card, prompt, url);
                    window.alert(`A imagem real não foi gerada. Foi usado um placeholder local.\n\nDetalhe: ${error.message}`);
                })
                .finally(() => {
                    generate.disabled = false;
                    generate.textContent = originalText;
                });
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    bindSlideImageTools();
    document.querySelectorAll("[data-slide-card]").forEach((card) => {
        syncPanelMode(card);
    });
});
