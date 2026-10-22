import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { normalizeSlidesMaterial } from "../materials/slides.js";
import { promptFor } from "../materials/prompts.js";
import { normalizeSlideGenerationOptions } from "../slide-generation-policy.js";
import { schemaFor } from "../materials/schemas.js";

const luminance = hex => {
    const rgb = [1, 3, 5].map(offset => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
const normalize = visual_theme => normalizeSlidesMaterial({ visual_theme, slides: [] }).visual_theme;

test("visual selection has an explicit contract independent of the action wording", () => {
    assert.equal(normalizeSlideGenerationOptions({}, "Modo visual: personalizado.").visualMode, "ai");
    assert.equal(normalizeSlideGenerationOptions({ visualMode: "standard" }, "Modo visual: personalizado.").visualMode, "standard");
    for (const invalid of ["random", true, {}, 1]) assert.throws(() => normalizeSlideGenerationOptions({ visualMode: invalid }), { code: "invalid_slide_options" });
    for (const includeIllustration of [false, true]) for (const visualMode of ["standard", "ai"]) {
        const options = normalizeSlideGenerationOptions({ visualMode, includeIllustration });
        const schema = schemaFor("slides", options, { contentMode: "auto" }).schema.properties.slides.items;
        assert.equal(Object.hasOwn(schema.properties, "composition"), visualMode === "ai");
        if (visualMode === "ai") assert.deepEqual(schema.properties.composition.enum, ["editorial", "focus", "panels"]);
        const prompt = promptFor("slides", "Gerar slides.", "Tema", options, { contentMode: "auto" });
        assert.equal(prompt.includes("composition:"), visualMode === "ai");
        const source = { slides: [{ title: "Conceito", body: "Primeira ideia\nSegunda ideia", type: "content", composition: "panels" }] };
        const output = normalizeSlidesMaterial(source, options);
        assert.equal(output.visual_mode, visualMode);
        assert.equal(output.slides[0].composition, visualMode === "ai" ? "panels" : "classic");
        assert.equal(output.slides[0].body, source.slides[0].body);
    }
    const safe = normalizeSlidesMaterial({ slides: [{ type: "content", composition: "<script>" }] }, { visualMode: "ai" });
    assert.equal(safe.slides[0].composition, "editorial");
});

test("the medium-grey AI palette becomes a clear reading canvas, not a washed-out slide", () => {
    const source = Object.freeze({ background: "#bdc3c7", alternate_background: "#95a5a6", text: "#2c3e50", accent: "#16a085", secondary_accent: "#c0392b", contrast_background: "#7f8c8d", contrast_text: "#ffffff" });
    const theme = normalize(source);
    assert.notEqual(theme.background, source.background);
    assert.ok(luminance(theme.background) >= .88);
    assert.ok(luminance(theme.alternate_background) >= .88);
    assert.ok(luminance(theme.contrast_background) <= .09);
    assert.ok(contrast(theme.background, theme.text) >= 7);
    assert.ok(contrast(theme.alternate_background, theme.text) >= 7);
    assert.ok(contrast(theme.contrast_background, theme.contrast_text) >= 7);
    assert.equal(theme.text, source.text);
    assert.equal(theme.accent, source.accent);
    assert.equal(theme.secondary_accent, source.secondary_accent);
    assert.equal(source.background, "#bdc3c7");
    assert.deepEqual(normalize(theme), theme, "normalization must be idempotent");
});

test("AI palettes retain their hue and safe existing colours rather than imposing one preset", () => {
    const clear = { background: "#fffaf0", alternate_background: "#f0fff5", text: "#173c43", contrast_background: "#153c41", contrast_text: "#f8f9ec", accent: "#226963" };
    const theme = normalize(clear);
    for (const key of Object.keys(clear)) assert.equal(theme[key], clear[key], key);
    const tinted = ["#bb5522", "#2266bb", "#339955"].map(background => normalize({ background }).background);
    assert.equal(new Set(tinted).size, 3);
    assert.ok(parseInt(tinted[0].slice(1, 3), 16) > parseInt(tinted[0].slice(5, 7), 16), "warm stays warm");
    assert.ok(parseInt(tinted[1].slice(5, 7), 16) > parseInt(tinted[1].slice(1, 3), 16), "blue stays blue");
});

test("extreme and malformed AI palettes always produce opaque colours and readable text", () => {
    const colors = ["#000000", "#ffffff", "#777777", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#eeeeee", "#444444", "transparent", "rgba(0,0,0,.5)", "url(secret)", null];
    for (const background of colors) for (const text of colors) {
        const theme = normalize({ background, alternate_background: text, text, contrast_background: background, contrast_text: text });
        for (const key of ["background", "alternate_background", "text", "contrast_background", "contrast_text", "accent", "secondary_accent"]) assert.match(theme[key], /^#[0-9a-f]{6}$/);
        assert.ok(luminance(theme.background) >= .88);
        assert.ok(luminance(theme.alternate_background) >= .88);
        assert.ok(luminance(theme.contrast_background) <= .09);
        assert.ok(contrast(theme.background, theme.text) >= 7);
        assert.ok(contrast(theme.alternate_background, theme.text) >= 7);
        assert.ok(contrast(theme.contrast_background, theme.contrast_text) >= 7);
    }
});

test("only opening and closing use dark variants, and the editor applies the same normalized palette", async () => {
    const source = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
    const context = vm.createContext({});
    vm.runInContext(source.slice(source.indexOf("function aiSlideVisualFor("), source.indexOf("function renderAiSlideThemeSummary(")), context);
    const input = { visual_theme: { background: "#bdc3c7" }, slides: [
        { type: "cover", visual_variant: "light" }, { type: "content", visual_variant: "contrast" },
        { type: "content", visual_variant: "hero" }, { type: "question", visual_variant: "contrast" },
        { type: "closing", visual_variant: "light" }
    ].map(slide => ({ ...slide, title: "Título", body: "Texto original." })) };
    const original = structuredClone(input);
    const output = normalizeSlidesMaterial(input);
    assert.deepEqual(input, original);
    assert.deepEqual(output.slides.map(slide => slide.visual_variant), ["hero", "alternate", "light", "question", "contrast"]);
    output.slides.forEach((slide, index) => {
        const visual = context.aiSlideVisualFor(output.visual_theme, slide.type, index, slide.visual_variant);
        assert.equal(slide.body, original.slides[index].body);
        assert.ok(contrast(visual.background, visual.text) >= 7);
        assert.equal(luminance(visual.background) < .1, index === 0 || index === 4);
    });
});

test("personalized instructions prevent muddy backgrounds without inflating the free-tier prompt", () => {
    for (const includeIllustration of [false, true]) {
        const prompt = promptFor("slides", "Gerar 6 slides. Modo visual: personalizado pela IA de acordo com o tema.", "Explique um tema para o ensino médio.", { includeIllustration });
        assert.match(prompt, /quase brancos/);
        assert.match(prompt, /evite cinza médio/);
        assert.match(prompt, /7:1/);
        assert.ok(Math.ceil(prompt.length / 3) < 4000, `prompt is too large: ${prompt.length}`);
    }
});

test("factual guidance preserves source material and does not pretend to perform external verification", () => {
    const source = "Texto do professor: preserve os dados e o idioma.";
    for (const includeIllustration of [false, true]) {
        const prompt = promptFor("slides", "Gerar 6 slides. Modo visual: personalizado pela IA de acordo com o tema.", source, { includeIllustration, detail: "detailed", tone: "explanatory", audience: "Ensino médio", subject: "Ciências" });
        assert.match(prompt, /RIGOR FACTUAL/);
        assert.match(prompt, /não complete lacunas com datas, números, citações ou nomes específicos sem segurança/);
        assert.match(prompt, /não substitua silenciosamente informações por suposições/);
        assert.match(prompt, /não é uma checagem independente de fontes/);
        assert.ok(prompt.includes(source));
        assert.ok(Math.ceil(prompt.length / 3) < 4000, `detailed prompt is too large: ${prompt.length}`);
    }
});

test("presentation and editor no longer fade instructional text", async () => {
    for (const [file, selector] of [
        ["presentation-stages.css", ".presentation-page .presentation-slide h2"],
        ["presentation-stages.css", ".presentation-page .presentation-slide-body p"],
        ["presentation-stages.css", ".presentation-slide-kicker span:last-child"],
        ["activity-visual-system.css", ".presentation-page .presentation-slide h2"],
        ["cards.css", ".slide-preview-text h4"]
    ]) {
        const css = await fs.readFile(new URL(`../../assets/css/components/${file}`, import.meta.url), "utf8");
        const start = css.indexOf(`${selector} {`);
        assert.ok(start >= 0, selector);
        assert.match(css.slice(start, css.indexOf("}", start)), /opacity:\s*1\s*;/);
    }
});
