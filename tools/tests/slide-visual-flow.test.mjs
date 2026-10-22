import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = name => fs.readFile(new URL(`../../assets/js/${name}.js`, import.meta.url), "utf8");
const runtime = await read("presentation-runtime");
const generator = await read("ai-material-generator");
const visuals = await read("activity-visuals");
const part = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));

test("decorative overflow does not reduce type; actual text overflow still does", () => {
    const scope = vm.createContext({ getComputedStyle: () => ({ display: "block", visibility: "visible" }) });
    vm.runInContext(part(runtime, "function isSlideOverflowing(", "function applySlideDensity("), scope);
    const root = { scrollHeight: 752, clientHeight: 529, getBoundingClientRect: () => ({ bottom: 634 }) };
    const copy = { scrollHeight: 493, clientHeight: 493, scrollWidth: 1000, clientWidth: 1000,
        getBoundingClientRect: () => ({ top: 122, bottom: 615 }), children: [{ getBoundingClientRect: () => ({ bottom: 450 }) }] };
    assert.equal(scope.isSlideOverflowing(root, copy), false);
    copy.scrollHeight = 610;
    assert.equal(scope.isSlideOverflowing(root, copy), true);
    copy.scrollHeight = 493; copy.scrollWidth = 1020;
    assert.equal(scope.isSlideOverflowing(root, copy), true);
    copy.scrollWidth = 1000; copy.children[0].getBoundingClientRect = () => ({ bottom: 620 });
    assert.equal(scope.isSlideOverflowing(root, copy), true);
});

test("editor import and presentation parsing preserve palette provenance and composition", () => {
    const fields = new Map();
    const card = { dataset: {}, querySelector(selector) {
        if (!fields.has(selector)) fields.set(selector, { value: "", tagName: "INPUT" });
        return fields.get(selector);
    } };
    const scope = vm.createContext({ window: {}, document: { getElementById: () => null },
        ensureCardCount: () => [card], renderAiSlideThemeSummary() {}, renumberGeneratedCards() {}, dispatchBuilderContentChange() {},
        setSelectByText: (field, value) => { field.value = value; },
        DOMParser: class { parseFromString() { return { querySelectorAll: () => [card] }; } }
    });
    vm.runInContext(visuals, scope);
    vm.runInContext(part(generator, "const DEFAULT_AI_SLIDE_THEME =", "function renderAiSlideThemeSummary("), scope);
    vm.runInContext(part(generator, "function compactSlideBodyText(", "function splitParagraphs("), scope);
    vm.runInContext(part(generator, "function slideVisualFor(", "function applyFlashcardsFromStructuredData("), scope);
    vm.runInContext(part(runtime, "function parseSlideCards(", "function serializeSlideCards("), scope);
    vm.runInContext(part(runtime, "function escapeHtml(", "function parseSlideCards("), scope);
    vm.runInContext(part(runtime, "function serializeSlideCards(", "function renderSlideBody("), scope);
    scope.applySlidesFromStructuredData({ visual_mode: "ai", visual_theme: { contrast_background: "#102a43", contrast_text: "#f8fafc", accent: "#2dd4bf" },
        slides: [{ type: "cover", title: "Abertura", body: "Uma pergunta?", composition: "focus" }] });
    const [slide] = scope.parseSlideCards("fixture");
    assert.equal(slide.visualMode, "ai"); assert.equal(slide.composition, "focus");
    assert.equal(scope.window.EducariaVisuals.slide(slide).slideColor, "#102a43");
    assert.match(scope.serializeSlideCards([slide]), /data-slide-visual-mode="ai" data-slide-composition="focus"/);
    scope.applySlidesFromStructuredData({ visual_mode: "standard", slides: [{ type: "content", title: "Padrão", body: "Explicação" }] });
    assert.equal(card.dataset.slideComposition, "classic"); assert.equal(card.dataset.slideVisualMode, "standard");
});
