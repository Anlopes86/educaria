import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../../assets/js/landing-page.js', import.meta.url), 'utf8');
const html = await fs.readFile(new URL('../../index.html', import.meta.url), 'utf8');
const css = await fs.readFile(new URL('../../assets/css/pages/landing.css', import.meta.url), 'utf8');
const formats = ['slides', 'quiz', 'flashcards', 'memory', 'mindmap', 'wheel'];

function element(dataset = {}) {
    const listeners = new Map(), attributes = new Map();
    return {
        dataset, listeners, attributes, hidden: false, textContent: '', isConnected: true,
        setAttribute(k, v) { attributes.set(k, v); }, getAttribute: k => attributes.get(k),
        removeAttribute(k) { attributes.delete(k); if (k === 'src') this.src = ''; },
        addEventListener(k, fn) { listeners.set(k, fn); }, focus() { this.focused = true; },
        emit(name, options = {}) {
            const event = { target: this, preventDefault() { this.prevented = true; }, ...options };
            listeners.get(name)?.(event);
            return event;
        },
        click(options) { return this.emit('click', options); },
        key(key) { return this.emit('keydown', { key }); }
    };
}

function setup({ teacher = null, modalSupported = true } = {}) {
    const singles = new Map(), groups = new Map(), documentEvents = new Map();
    const get = selector => { if (!singles.has(selector)) singles.set(selector, element()); return singles.get(selector); };
    const tabs = formats.map(demoTab => element({ demoTab }));
    const panels = formats.map(format => ({ id: `demo-${format}`, hidden: format !== 'slides' }));
    tabs.forEach((tab, index) => tab.setAttribute('aria-controls', panels[index].id));
    groups.set('[data-demo-tab]', tabs);
    groups.set('[role="tabpanel"]', panels);
    const links = [...formats, 'worksheet'].map(format => {
        const link = element({ exampleTitle: `${format}: exemplo real`, exampleDescription: 'Tema: Sistema Solar · 6º ano' });
        link.setAttribute('href', `assets/img/examples/${format}.jpg`);
        link.querySelector = selector => selector === 'img' ? { alt: `Captura de ${format}` } : null;
        return link;
    });
    groups.set('[data-example-open]', links);
    const root = get('[data-landing-showcase]');
    root.querySelectorAll = selector => groups.get(selector) || [];
    const dialog = get('#landing-example-dialog');
    dialog.querySelector = get;
    dialog.getBoundingClientRect = () => ({ left: 20, right: 1200, top: 20, bottom: 700 });
    dialog.close = () => { dialog.open = false; dialog.emit('close'); };
    if (modalSupported) dialog.showModal = () => { dialog.open = true; };
    const context = vm.createContext({
        document: {
            querySelector: get,
            querySelectorAll: selector => groups.get(selector) || [get(selector)],
            addEventListener: (name, callback) => documentEvents.set(name, callback)
        },
        readCurrentTeacher: () => teacher
    });
    vm.runInContext(source, context);
    context.initializeLandingShowcase();
    context.initializeLandingExampleViewer();
    return { context, get, tabs, panels, links, dialog, documentEvents, setTeacher(value) { teacher = value; } };
}

test('six accessible tabs select only their panel and support keyboard navigation', () => {
    const h = setup();
    for (const tab of h.tabs) assert.match(html, new RegExp(`id="${tab.getAttribute('aria-controls')}" role="tabpanel"`));
    h.tabs[0].key('ArrowLeft');
    assert.equal(h.tabs[5].getAttribute('aria-selected'), 'true');
    assert.equal(h.tabs[5].focused, true);
    assert.equal(h.panels.filter(panel => !panel.hidden).length, 1);
    h.tabs[5].key('Home'); assert.equal(h.tabs[0].tabIndex, 0);
    h.tabs[0].key('End'); assert.equal(h.tabs[5].tabIndex, 0);
    h.tabs[5].key('ArrowRight'); assert.equal(h.tabs[0].tabIndex, 0);
    h.tabs[2].click(); assert.equal(h.panels[2].hidden, false);
    assert.equal(h.tabs[2].key('Tab').prevented, undefined);
});

test('each gallery entry opens its original capture in a labelled native dialog', () => {
    const h = setup();
    for (const link of h.links) {
        const event = link.click();
        assert.equal(event.prevented, true);
        assert.equal(h.dialog.open, true);
        assert.equal(h.get('[data-example-image]').src, link.getAttribute('href'));
        assert.equal(h.get('[data-example-image]').alt, link.querySelector('img').alt);
        assert.equal(h.get('#landing-example-title').textContent, link.dataset.exampleTitle);
        assert.equal(h.get('[data-example-close]').focused, true);
        h.get('[data-example-close]').click();
        assert.equal(h.dialog.open, false);
        assert.equal(h.get('[data-example-image]').src, '');
        assert.equal(link.focused, true);
    }
    assert.match(html, /<dialog[^>]*aria-labelledby="landing-example-title"[^>]*aria-describedby="landing-example-description"/);
});

test('native Escape closing restores focus; removed openers are not focused', () => {
    const h = setup();
    h.links[0].click();
    // Escape is handled by the browser's native dialog; test the close notification.
    h.dialog.close();
    assert.equal(h.links[0].focused, true);
    h.links[1].click(); h.links[1].isConnected = false; h.dialog.close();
    assert.equal(h.links[1].focused, undefined);
});

test('backdrop clicks close the viewer but clicks inside its padding do not', () => {
    const h = setup(); h.links[0].click();
    h.dialog.click({ clientX: 30, clientY: 30 });
    assert.equal(h.dialog.open, true);
    h.dialog.click({ clientX: 5, clientY: 30 });
    assert.equal(h.dialog.open, false);
});

test('direct image links remain usable without dialog support and with browser modifiers', () => {
    const fallback = setup({ modalSupported: false });
    assert.equal(fallback.links[0].click().prevented, undefined);
    assert.equal(fallback.links[0].getAttribute('href'), 'assets/img/examples/slides.jpg');
    const h = setup();
    for (const options of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
        assert.equal(h.links[0].click(options).prevented, undefined);
        assert.equal(h.dialog.open, undefined);
    }
});

test('hero, six formats and printing use real captures instead of bespoke activity simulations', () => {
    for (const format of [...formats, 'worksheet']) assert.match(html, new RegExp(`src="assets/img/examples/${format}\\.jpg"`));
    assert.match(html, /Atividades reais criadas na EducarIA/);
    assert.match(html, /Ver exemplos não usa créditos/);
    assert.match(html, /data-landing-print-cta/);
    assert.match(html, /<a href="#para-imprimir">Para imprimir<\/a>/);
    assert.doesNotMatch(html, /landing-solar\.svg|data-quiz-answer|data-memory-pair|data-demo-wheel|data-demo-flip|data-sample-slide/);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage\.setItem|generateMaterial\(|Math\.random/);
});

test('authenticated and signed-out visitors keep their appropriate creation destinations', () => {
    const h = setup();
    h.context.renderLandingState();
    assert.equal(h.get('[data-landing-example-cta]').getAttribute('href'), 'cadastro.html');
    assert.equal(h.get('[data-landing-print-cta]').getAttribute('href'), 'cadastro.html');
    h.setTeacher({ uid: 'example-teacher' }); h.context.renderLandingState();
    assert.equal(h.get('[data-landing-example-cta]').getAttribute('href'), 'plataforma/index.html');
    assert.equal(h.get('[data-landing-lesson-cta]').getAttribute('href'), 'plataforma/criar-aula.html');
    assert.equal(h.get('[data-landing-print-cta]').getAttribute('href'), 'plataforma/folha-atividades-builder.html?new=1');
    assert.equal(h.get('[data-landing-print-cta]').textContent, 'Criar folha de atividades →');
    h.setTeacher(null); h.context.renderLandingState();
    assert.equal(h.get('[data-landing-lesson-cta]').getAttribute('href'), 'cadastro.html');
    assert.equal(h.get('[data-landing-print-cta]').getAttribute('href'), 'cadastro.html');
});

test('login opens its inline form, focuses email and closes with Escape', () => {
    const h = setup(); h.context.initializeLandingLogin();
    const toggle = h.get('[data-landing-login-toggle]');
    const panel = h.get('#landing-login-panel'); panel.hidden = true;
    toggle.click();
    assert.equal(panel.hidden, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(h.get('#landing-login-email').focused, true);
    h.documentEvents.get('keydown')({ key: 'Escape' });
    assert.equal(panel.hidden, true);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(toggle.focused, true);
    assert.match(html, /data-login-form/);
    assert.match(html, /href="cadastro\.html"[^>]*>Cadastre-se/);
});

test('initialization is idempotent and availability and first-class guidance remain accurate', () => {
    const h = setup();
    const tabListener = h.tabs[0].listeners.get('click');
    const previewListener = h.links[0].listeners.get('click');
    h.context.initializeLandingShowcase(); h.context.initializeLandingExampleViewer();
    assert.equal(h.tabs[0].listeners.get('click'), tabListener);
    assert.equal(h.links[0].listeners.get('click'), previewListener);
    assert.doesNotMatch(html, /5 gerações|ilimitad/i);
    assert.match(html, /disponibilidade compartilhada/);
    assert.match(html, /Comece criando sua turma/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    for (const heading of html.matchAll(/<h3>(.*?)<\/h3>/g)) assert.doesNotMatch(heading[1], /\S<br>\S/);
});
