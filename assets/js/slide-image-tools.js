const SLIDE_UPLOAD_MODE = "Enviar imagem";
const SLIDE_NO_IMAGE_MODE = "Sem imagem";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 1000;

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

function fitImageDimensions(width, height) {
    const scale = Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale))
    };
}

function readImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
        reader.addEventListener("error", () => reject(new Error("Não foi possível ler a imagem.")), { once: true });
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", () => reject(new Error("O arquivo não contém uma imagem válida.")), { once: true });
        image.src = dataUrl;
    });
}

async function optimizeImage(file) {
    if (!file.type.match(/^image\/(?:jpeg|png|webp)$/)) {
        throw new Error("Envie uma imagem JPG, PNG ou WebP.");
    }

    if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("A imagem deve ter no máximo 8 MB.");
    }

    const original = await readImageFile(file);
    const image = await loadImage(original);
    const dimensions = fitImageDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d");
    if (!context) return original;

    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    return canvas.toDataURL("image/webp", 0.84);
}

async function handleLocalUpload(card, file, input) {
    if (!file) return;

    setUploadStatus(card, "Preparando imagem...");
    if (input) input.disabled = true;

    try {
        const optimizedUrl = await optimizeImage(file);
        const readableName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
        updateHiddenField(card, "slide-image-prompt", readableName || "Imagem enviada pelo professor");
        updateHiddenField(card, "slide-image-url", optimizedUrl);
        const modeField = modeFieldFor(card);
        if (modeField) modeField.value = SLIDE_UPLOAD_MODE;
        setUploadStatus(card, "Imagem adicionada. A prévia foi atualizada.", "success");
        dispatchBuilderContentChange("input");
        dispatchBuilderContentChange("change");
    } catch (error) {
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
