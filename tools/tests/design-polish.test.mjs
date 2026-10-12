import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";

const read = path => fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const stages = await read("assets/css/components/presentation-stages.css");

test("editor section spacing survives the hidden or sticky item navigator", async () => {
    const css = await read("assets/css/components/cards.css");
    assert.match(css, /\.activity-builder-pane\s*>\s*\.editor-disclosure\s*~\s*:is\(\.editor-disclosure,\s*\.builder-item-navigator\)\s*\{\s*margin-top:\s*14px/);
    assert.match(css, /\.builder-item-navigator\[hidden\]\s*\{\s*display:\s*none/);
    assert.match(await read("assets/js/editor-disclosure.js"), /manualDisclosure\.before\(navigator\)/);
});

test("shared presentation controls center one icon or label without anonymous grid rows", () => {
    const button = stages.match(/\.presentation-nav-button\s*\{([^}]+)\}/)[1];
    assert.match(button, /display:\s*inline-flex/);
    assert.match(button, /align-items:\s*center/);
    assert.match(button, /justify-content:\s*center/);
    assert.match(button, /line-height:\s*1\.2/);
    assert.doesNotMatch(stages, /\.presentation-nav-button[^{}]*::(?:before|after)\s*\{/);
    assert.match(stages, /\.presentation-page--compact[^{}]*\.presentation-nav-label\s*\{\s*display:\s*block/);
});

for (const page of ["apresentacao", "flashcards-apresentacao", "debate-guiado-apresentacao"]) {
    test(`${page}: both directions retain labels, hooks and centered decorative SVGs`, async () => {
        const html = await read(`plataforma/${page}.html`);
        const buttons = [...html.matchAll(/<button\b[^>]*class="presentation-nav-button[^>]*>[\s\S]*?<\/button>/g)].map(match => match[0]);
        assert.equal(buttons.length, 2);
        for (const button of buttons) {
            assert.match(button, /aria-label="[^"]+"/);
            assert.match(button, /data-(?:presentation|flashcard|debate-stage)-(?:prev|next)/);
            assert.match(button, /<svg class="presentation-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">/);
            assert.match(button, /<span class="presentation-nav-label">[^<]+<\/span>/);
        }
        // Mirrored chevrons both occupy x=8..16 and y=4..20: center (12,12).
        assert.match(buttons[0], /d="m16 4-8 8 8 8"/);
        assert.match(buttons[1], /d="m8 4 8 8-8 8"/);
    });
}

test("flashcards and debate keep their compact arrow controls without duplicate text", async () => {
    for (const [file, prefix] of [["presentation-fit", ".flashcards-stage-actions"], ["debate", ".debate-floating-controls"]]) {
        const css = await read(`assets/css/components/${file}.css`);
        assert.ok(css.includes(`${prefix} .presentation-nav-icon`));
        assert.ok(css.includes(`${prefix} .presentation-nav-label`));
        assert.doesNotMatch(css, /\.presentation-nav-button::(?:before|after)/);
    }
});

test("debate updates the navigation label without replacing its decorative icon", async () => {
    const runtime = await read("assets/js/debate-runtime.js");
    assert.match(runtime, /const label = button\.querySelector\("\.presentation-nav-label"\) \|\| button;/);
    assert.match(runtime, /label\.textContent = button\.disabled \? "Última etapa" : "Próxima"/);
    assert.doesNotMatch(runtime, /button\.textContent = runtime\.activeIndex/);
});

test("narrow slide presentations stack copy and uncropped media in separate rows", async () => {
    const css = await read("assets/css/components/presentation-fit.css");
    const narrow = css.slice(css.indexOf("@media screen and (max-width: 760px)"));
    assert.match(narrow, /\.presentation-slide--split\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(narrow, /\.presentation-slide-copy\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1/);
    assert.match(narrow, /\.presentation-media\s*\{\s*grid-column:\s*1;\s*grid-row:\s*2/);
    assert.match(narrow, /min-height:\s*0;\s*max-height:\s*100%;\s*object-fit:\s*contain/);
});
