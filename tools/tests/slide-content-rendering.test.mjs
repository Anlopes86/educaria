import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { detailedSlide, expectedInterviewCards } from "../fixtures/ai-content-cases.mjs";
import { normalizeSlidesMaterial } from "../../ai-service/materials/slides.js";
const read = path => fs.readFile(new URL(`../../assets/js/${path}.js`, import.meta.url), "utf8");
const [presentation, preview, generator, flashcards] = await Promise.all(["presentation-runtime", "live-preview", "ai-material-generator", "flashcards-runtime"].map(read));
const context = vm.createContext({ escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") });
vm.runInContext(presentation.slice(presentation.indexOf("function renderSlideBody("), presentation.indexOf("function clearMediaAspect(")), context);
vm.runInContext(preview.slice(preview.indexOf("function renderSlidePreviewBody("), preview.indexOf("function buildSlidesPreview(")), context);
vm.runInContext(generator.slice(generator.indexOf("function compactSlideBodyText("), generator.indexOf("function splitParagraphs(")), context);
vm.runInContext(flashcards.slice(flashcards.indexOf("function normalizeFlashcardText("), flashcards.indexOf("function flashcardDensityForText(")), context);
test("an explanation longer than five sentences survives import, preview and presentation", () => {
    const imported = context.compactSlideBodyText(detailedSlide);
    assert.equal(imported, detailedSlide);
    for (const render of [context.renderSlideBody, context.renderStructuredSlideBody, context.renderSlidePreviewBody]) {
        assert.equal(render(imported), `<p>${detailedSlide}</p>`);
    }
});
test("preview and projector agree on paragraphs, bullets and numbered content", () => {
    const body = "Uma explicação.\n- Primeira causa\n- Segunda causa\nUm exemplo.\n1. Primeiro caso\n2. Segundo caso";
    const expected = "<p>Uma explicação.</p><ul><li>Primeira causa</li><li>Segunda causa</li></ul><p>Um exemplo.</p><p>1. Primeiro caso</p><p>2. Segundo caso</p>";
    assert.equal(context.renderStructuredSlideBody(body), expected);
    assert.equal(context.renderSlidePreviewBody(body), expected);
});

test("detailed inspiring blocks survive server normalization, editor import, preview and presentation", () => {
    const blocks = { essential: "Como contar o que aconteceu ontem?", explanation: "Verbos irregulares têm formas próprias no passado; não basta acrescentar -ed.",
        example: "Yesterday I went to school. Went é o passado de go e situa a ação no passado.", challenge: "Conte uma experiência usando went." };
    const material = normalizeSlidesMaterial({ slides: [{ type: "content", title: "Verbos irregulares", body: blocks }] });
    const imported = context.compactSlideBodyText(material.slides[0].body);
    const expected = Object.values(blocks).map(block => `<p>${block}</p>`).join("");
    assert.equal(context.renderStructuredSlideBody(imported), expected);
    assert.equal(context.renderSlidePreviewBody(imported), expected);
    assert.doesNotMatch(imported, /essential|explanation|challenge|\[object Object\]/);
});
test("rendering never injects HTML from a generated explanation", () => {
    const body = "<img src=x onerror=alert(1)>\n- <script>test</script>";
    for (const render of [context.renderStructuredSlideBody, context.renderSlidePreviewBody]) {
        assert.doesNotMatch(render(body), /<img|<script/);
        assert.match(render(body), /&lt;img/);
    }
});
test("all eight English flashcards retain number, full answer, scoring and line breaks", () => {
    for (const card of expectedInterviewCards) {
        const normalized = context.normalizeFlashcardForStage(card);
        assert.equal(normalized.front, card.front);
        assert.equal(normalized.back, card.back);
        assert.equal(normalized.example, "");
    }
});
