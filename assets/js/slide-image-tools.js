const SLIDE_UPLOAD_MODE = "Enviar imagem";
const SLIDE_NO_IMAGE_MODE = "Sem imagem";
const slideUploadVersions = new WeakMap();

function panelFor(card) {
    return card?.querySelector("[data-image-panel]") || null;
}

function modeFieldFor(card) {
    return card?.querySelector('[data-field="slide-image-mode"]') || null;
}

function updateHiddenField(card, name, value) {
    const field = card?.querySelector(`[data-field="${name}"]`);
    if (field) field.value = value;
}

function clearImageSelection(card) {
    updateHiddenField(card, "slide-image-url", "");
    updateHiddenField(card, "slide-image-prompt", "");
}

function setUploadStatus(card, message, tone = "neutral") {
    const source = panelFor(card)?.querySelector(".resource-source-card");
    if (!source) return;

    let status = source.querySelector("[data-upload-status]");
    if (!status) {
        status = document.createElement("p");
        status.dataset.uploadStatus = "";
        status.setAttribute("role", "status");
        source.appendChild(status);
    }

    status.textContent = message;
    status.dataset.tone = tone;
}

async function handleLocalUpload(card, file, input) {
    if (!file) return;
    const version = (slideUploadVersions.get(card) || 0) + 1;
    slideUploadVersions.set(card, version);

    setUploadStatus(card, "Preparando imagem...");
    if (input) input.disabled = true;

    try {
        const optimizedUrl = await window.educariaImages.optimize(file);
        if (!card.isConnected || slideUploadVersions.get(card) !== version) return;
        const readableName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
        updateHiddenField(card, "slide-image-prompt", readableName || "Imagem enviada pelo professor");
        updateHiddenField(card, "slide-image-url", optimizedUrl);
        const modeField = modeFieldFor(card);
        if (modeField) modeField.value = SLIDE_UPLOAD_MODE;
        setUploadStatus(card, "Imagem adicionada. A prévia foi atualizada.", "success");
        dispatchBuilderContentChange("input");
        dispatchBuilderContentChange("change");
    } catch (error) {
        if (!card.isConnected || slideUploadVersions.get(card) !== version) return;
        setUploadStatus(card, error.message || "Não foi possível adicionar a imagem.", "error");
        if (input) input.value = "";
    } finally {
        if (input) input.disabled = false;
    }
}

function bindSlideImageTools() {
    document.addEventListener("change", (event) => {
        const modeSelect = event.target.closest('[data-field="slide-image-mode"]');
        if (modeSelect) {
            const card = modeSelect.closest("[data-slide-card]");
            const panel = panelFor(card);
            if (!card || !panel) return;

            if (modeSelect.value === SLIDE_NO_IMAGE_MODE) {
                slideUploadVersions.set(card, (slideUploadVersions.get(card) || 0) + 1);
                clearImageSelection(card);
                panel.hidden = true;
                dispatchBuilderContentChange("input");
                return;
            }

            panel.hidden = false;
        }

        const uploadInput = event.target.closest("[data-upload-input]");
        if (uploadInput) {
            const card = uploadInput.closest("[data-slide-card]");
            const file = uploadInput.files?.[0];
            if (card && file) handleLocalUpload(card, file, uploadInput);
        }
    });

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-open-resource]");
        if (!trigger) return;

        event.preventDefault();
        const card = trigger.closest("[data-slide-card]");
        const panel = panelFor(card);
        const modeField = modeFieldFor(card);
        if (!card || !panel || !modeField) return;

        if (panel.hidden) {
            modeField.value = SLIDE_UPLOAD_MODE;
            panel.hidden = false;
            panel.querySelector("[data-upload-input]")?.focus();
            return;
        }

        panel.hidden = true;
    });
}

document.addEventListener("DOMContentLoaded", bindSlideImageTools);
