import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile(new URL('../../assets/js/landing-page.js', import.meta.url), 'utf8');
const html = await fs.readFile(new URL('../../index.html', import.meta.url), 'utf8');
const css = await fs.readFile(new URL('../../assets/css/pages/landing.css', import.meta.url), 'utf8');
function element(dataset = {}) {
    const classes = new Set(), listeners = new Map(), attributes = new Map();
    return { dataset, classes, listeners, attributes, hidden: false, disabled: false, style: {}, textContent: '',
        classList: { add(...names) { names.forEach(n => classes.add(n)); }, remove(...names) { names.forEach(n => classes.delete(n)); }, contains: n => classes.has(n), toggle(n, active) { active ? classes.add(n) : classes.delete(n); } },
        setAttribute(k, v) { attributes.set(k, v); }, getAttribute: k => attributes.get(k),
        addEventListener(k, fn) { listeners.set(k, fn); }, focus() { this.focused = true; },
        click() { listeners.get('click')?.(); }, key(key) { const event = {key, preventDefault() { this.prevented = true; }}; listeners.get('keydown')?.(event); return event; }
    };
}
function setup({teacher = null, reducedMotion = false} = {}) {
    const groups = new Map(), singles = new Map(), timers = [];
    const get = selector => { if (!singles.has(selector)) singles.set(selector, element()); return singles.get(selector); };
    const group = (selector, items) => { const value = items.map(item => element(item)); groups.set(selector, value); return value; };
    const formats = ['slides','quiz','flashcards','memory','mindmap','wheel'];
    const tabs = group('[data-demo-tab]', formats.map(demoTab => ({demoTab})));
    const panels = group('[role="tabpanel"]', formats.map(() => ({})));
    tabs.forEach((tab, i) => { tab.setAttribute('aria-controls', 'demo-' + formats[i]); panels[i].id = 'demo-' + formats[i]; });
    const slides = group('[data-sample-slide]', [0,1,2].map(sampleSlide => ({sampleSlide})));
    const steps = group('[data-slide-step]', [-1,1].map(slideStep => ({slideStep})));
    const answers = group('[data-quiz-answer]', ['venus','mars','jupiter','saturn'].map(quizAnswer => ({quizAnswer})));
    const cards = group('[data-memory-pair]', [['sun','Sol'],['earth','Nosso planeta'],['moon','Lua'],['moon','Satélite da Terra'],['sun','Nossa estrela'],['earth','Terra']].map(([memoryPair,memoryText]) => ({memoryPair,memoryText})));
    const map = group('[data-map-node]', ['sun','planets','moons'].map(mapNode => ({mapNode})));
    const root = get('[data-landing-showcase]');
    root.querySelector = get; root.querySelectorAll = selector => groups.get(selector) || [];
    const context = vm.createContext({
        document: {querySelector: get, querySelectorAll: selector => [get(selector)], addEventListener() {}},
        readCurrentTeacher: () => teacher,
        window: {matchMedia: () => ({matches: reducedMotion}), setTimeout(fn, delay) { timers.push({fn, delay}); }},
        Math: Object.assign(Object.create(Math), {random: () => .3})
    });
    vm.runInContext(source, context);
    context.initializeLandingShowcase();
    return {context, root, get, tabs, panels, slides, steps, answers, cards, map, timers, setTeacher(value) {teacher = value;}};
}
test('landing: six tabs have matching accessible panels and keyboard navigation wraps', () => {
    const h = setup();
    for (const tab of h.tabs) {
        assert.match(html, new RegExp('id="' + tab.getAttribute('aria-controls') + '" role="tabpanel"'));
    }
    h.tabs[0].key('ArrowLeft');
    assert.equal(h.tabs[5].attributes.get('aria-selected'), 'true');
    assert.equal(h.tabs[5].focused, true);
    assert.equal(h.panels.filter(p => !p.hidden).length, 1);
    h.tabs[5].key('Home'); assert.equal(h.tabs[0].tabIndex, 0);
    h.tabs[0].key('End'); assert.equal(h.tabs[5].tabIndex, 0);
    h.tabs[5].key('ArrowRight'); assert.equal(h.tabs[0].tabIndex, 0);
    h.tabs[2].click(); assert.equal(h.panels[2].hidden, false);
    assert.equal(h.tabs[2].key('Tab').prevented, undefined);
});
test('landing: slide controls cycle in both directions and announce position', () => {
    const h = setup(); h.steps[0].click();
    assert.equal(h.slides[2].hidden, false);
    assert.equal(h.get('[data-slide-counter]').textContent, 'Slide 3 de 3');
    h.steps[1].click(); assert.equal(h.slides[0].hidden, false);
});
test('landing: quiz gives textual feedback for both outcomes and resets', () => {
    const h = setup(); h.answers[0].click();
    assert.ok(h.answers[0].classes.has('is-incorrect'));
    assert.match(h.get('[data-quiz-feedback]').textContent, /Tente novamente/);
    h.answers[1].click(); assert.ok(h.answers[1].classes.has('is-correct'));
    assert.ok(!h.answers[0].classes.has('is-incorrect'));
    h.get('[data-quiz-reset]').click();
    assert.ok(h.answers.every(a => a.classes.size === 0));
});
test('landing: flashcard reveals the answer and returns to the question', () => {
    const h = setup(); const card = h.get('[data-demo-flip]'); card.click();
    assert.match(h.get('[data-flashcard-text]').textContent, /É uma estrela/);
    assert.match(card.attributes.get('aria-label'), /pergunta/);
    card.click(); assert.match(h.get('[data-flashcard-text]').textContent, /planeta ou uma estrela/);
});
test('landing: memory supports mismatches, all pairs and a complete reset without timers', () => {
    const h = setup(); const c = h.cards;
    c[0].click(); c[1].click(); assert.match(h.get('[data-memory-feedback]').textContent, /não formam um par/);
    c[0].click(); assert.ok(!c[1].classes.has('is-open')); c[4].click();
    c[0].click(); assert.match(h.get('[data-memory-feedback]').textContent, /1 de 3/);
    c[2].click(); c[3].click(); c[1].click(); c[5].click();
    assert.match(h.get('[data-memory-feedback]').textContent, /Todos os pares/);
    h.get('[data-memory-reset]').click(); assert.ok(c.every(card => card.classes.size === 0));
    assert.equal(h.timers.length, 0);
});
test('landing: mind map updates explanation and selection', () => {
    const h = setup(); h.map[2].click();
    assert.equal(h.get('[data-map-title]').textContent, 'Os satélites');
    assert.match(h.get('[data-map-text]').textContent, /Lua/);
    assert.equal(h.map[0].attributes.get('aria-pressed'), 'false');
});
test('landing: roulette result matches the pointer, blocks repeated spins and respects reduced motion', () => {
    for (const reducedMotion of [false, true]) {
        const h = setup({reducedMotion}); const spin = h.get('[data-wheel-spin]');
        spin.click(); spin.click(); assert.equal(h.timers.length, 1);
        assert.equal(h.get('[data-demo-wheel]').style.transform, 'rotate(990deg)');
        assert.equal(h.timers[0].delay, reducedMotion ? 0 : 1150);
        h.timers[0].fn(); assert.match(h.get('[data-wheel-feedback]').textContent, /Terra/);
        assert.equal(spin.disabled, false);
        spin.click(); assert.equal(h.get('[data-demo-wheel]').style.transform, 'rotate(1710deg)');
    }
});
test('landing: authenticated and signed-out visitors keep appropriate CTA destinations', () => {
    const h = setup(); h.context.renderLandingState();
    assert.equal(h.get('[data-landing-nav-secondary]').attributes.get('href'), 'login.html');
    assert.equal(h.get('[data-landing-example-cta]').attributes.get('href'), 'cadastro.html');
    h.setTeacher({uid:'example-teacher'}); h.context.renderLandingState();
    assert.equal(h.get('[data-landing-example-cta]').attributes.get('href'), 'plataforma/index.html');
    assert.equal(h.get('[data-landing-lesson-cta]').attributes.get('href'), 'plataforma/criar-aula.html');
    h.setTeacher(null); h.context.renderLandingState();
    assert.equal(h.get('[data-landing-lesson-cta]').attributes.get('href'), 'cadastro.html');
});
test('landing: examples are local, initialization is idempotent and credit promises stay accurate', () => {
    const h = setup(); const listener = h.tabs[0].listeners.get('click');
    h.context.initializeLandingShowcase(); assert.equal(h.tabs[0].listeners.get('click'), listener);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage\.setItem|generateMaterial\(/);
    assert.doesNotMatch(html, /5 gerações|ilimitad/i);
    assert.match(html, /Comece criando sua turma/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    for (const heading of html.matchAll(/<h3>(.*?)<\/h3>/g)) {
        assert.doesNotMatch(heading[1], /\S<br>\S/, 'hidden mobile line breaks must keep word spacing');
    }
});
