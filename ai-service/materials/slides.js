import { normalizeGeneratedSlideBody } from "../slide-generation-policy.js";
import { normalizeSlideIllustration } from "../slide-illustration-policy.js";

function trimWords(text, maxWords = 12) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
        return words.join(" ");
    }

    return `${words.slice(0, maxWords).join(" ")}...`;
}

const DEFAULT_SLIDE_VISUAL_THEME = Object.freeze({
    name: "EducarIA moderno",
    rationale: "Paleta clara e contrastante para leitura confortável em projeção.",
    font: "Destaque moderno",
    accent: "#0ea5e9",
    secondary_accent: "#7c3aed",
    background: "#eff6ff",
    alternate_background: "#f0fdfa",
    text: "#0f172a",
    contrast_background: "#102a43",
    contrast_text: "#f8fafc"
});

function normalizeHexColor(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function hexColorLuminance(value) {
    const color = normalizeHexColor(value, "#000000").slice(1);
    const channels = [0, 2, 4].map((offset) => {
        const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function slideColorContrast(first, second) {
    const lighter = Math.max(hexColorLuminance(first), hexColorLuminance(second));
    const darker = Math.min(hexColorLuminance(first), hexColorLuminance(second));
    return (lighter + 0.05) / (darker + 0.05);
}

function readableSlideText(background, proposed, fallbackDark = "#0f172a", fallbackLight = "#f8fafc") {
    const safeBackground = normalizeHexColor(background, "#ffffff");
    const safeProposed = normalizeHexColor(proposed, fallbackDark);
    if (slideColorContrast(safeBackground, safeProposed) >= 4.5) return safeProposed;

    const candidates = [fallbackDark, fallbackLight];
    return candidates.sort((left, right) => (
        slideColorContrast(safeBackground, right) - slideColorContrast(safeBackground, left)
    ))[0];
}

function normalizeSlideVisualTheme(theme) {
    const source = theme && typeof theme === "object" ? theme : {};
    const background = normalizeHexColor(source.background, DEFAULT_SLIDE_VISUAL_THEME.background);
    const text = readableSlideText(background, source.text, DEFAULT_SLIDE_VISUAL_THEME.text, DEFAULT_SLIDE_VISUAL_THEME.contrast_text);
    const proposedAlternate = normalizeHexColor(source.alternate_background, DEFAULT_SLIDE_VISUAL_THEME.alternate_background);
    const alternateBackground = slideColorContrast(proposedAlternate, text) >= 4.5
        ? proposedAlternate
        : background;
    const contrastBackground = normalizeHexColor(source.contrast_background, DEFAULT_SLIDE_VISUAL_THEME.contrast_background);
    const contrastText = readableSlideText(
        contrastBackground,
        source.contrast_text,
        DEFAULT_SLIDE_VISUAL_THEME.text,
        DEFAULT_SLIDE_VISUAL_THEME.contrast_text
    );
    const allowedFonts = new Set(["Destaque moderno", "Leitura limpa", "Serifada clássica"]);

    return {
        name: trimWords(source.name || DEFAULT_SLIDE_VISUAL_THEME.name, 6),
        rationale: trimWords(source.rationale || DEFAULT_SLIDE_VISUAL_THEME.rationale, 24),
        font: allowedFonts.has(source.font) ? source.font : DEFAULT_SLIDE_VISUAL_THEME.font,
        accent: normalizeHexColor(source.accent, DEFAULT_SLIDE_VISUAL_THEME.accent),
        secondary_accent: normalizeHexColor(source.secondary_accent, DEFAULT_SLIDE_VISUAL_THEME.secondary_accent),
        background,
        alternate_background: alternateBackground,
        text,
        contrast_background: contrastBackground,
        contrast_text: contrastText
    };
}

function normalizeSlideVisualVariant(value, slideType, index) {
    const allowedVariants = new Set(["hero", "light", "alternate", "question", "contrast"]);
    if (allowedVariants.has(value)) return value;
    if (slideType === "cover") return "hero";
    if (slideType === "question") return "question";
    if (slideType === "closing") return "contrast";
    return index % 2 === 0 ? "light" : "alternate";
}

/**
 * Normalizes slide formatting and visual tokens without cutting off explanations.
 * @param {{ slides: Array<object> }} material - Raw slides object from the provider
 * @returns {{ slides: Array<object> }} Normalised slides object, safe for the builder
 */
export function normalizeSlidesMaterial(material, options = {}) {
    if (!material || !Array.isArray(material.slides)) {
        return material;
    }

    return {
        ...material,
        visual_theme: normalizeSlideVisualTheme(material.visual_theme),
        slides: material.slides.map((slide, index, slides) => {
            const slideType = slide?.type || (index === 0 ? "cover" : index === slides.length - 1 ? "closing" : "content");
            const illustration = normalizeSlideIllustration(slide?.illustration, options.includeIllustration);
            const layout = illustration.elements.length ? "split" : "stack";

            return {
                ...slide,
                illustration,
                image_prompt: "",
                type: slideType,
                body: normalizeGeneratedSlideBody(slide?.body, slideType),
                teacher_notes: String(slide?.teacher_notes || "").trim(),
                visual_variant: normalizeSlideVisualVariant(slide?.visual_variant, slideType, index),
                layout
            };
        })
    };
}
