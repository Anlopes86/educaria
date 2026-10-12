import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const read = path => fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const source = await read("assets/js/app-sidebar.js");

function harness(path = "index.html") {
    const classes = () => {
        const values = new Set();
        return { contains: key => values.has(key), add: key => values.add(key), remove: key => values.delete(key),
            toggle(key, on) { if (on) values.add(key); else values.delete(key); } };
    };
    const document = {body: {classList: classes()}, activeElement: null, addEventListener() {}};
    const node = (attrs = {}, dataset = {}) => ({
        attrs, dataset, classList: classes(), inert: false, isConnected: true, innerHTML: "",
        getAttribute(key) { return this.attrs[key] ?? null; },
        hasAttribute(key) { return key in this.attrs; },
        setAttribute(key, value) { this.attrs[key] = String(value); },
        removeAttribute(key) { delete this.attrs[key]; },
        toggleAttribute(key, on) { if (on) this.attrs[key] = ""; else delete this.attrs[key]; },
        focus() { document.activeElement = this; },
        getClientRects() { return this.hidden ? [] : [{}]; },
        closest() { return null; }
    });
    const nodes = {sidebar: node(), content: node(), toggle: node(), close: node(), backdrop: node(), profile: node(), root: node(), formats: node(), core: node({}, {sidebarFormatList:"core"}), extra: node({}, {sidebarFormatList:"extra"})};
    const state = {mobile: false, selected:"Turma B", classes:["Turma A", "Turma B"], links:[], toggles:[], panels:[], focusable:[nodes.profile,nodes.close]};
    const selectors = {".app-sidebar": nodes.sidebar, ".app-content":nodes.content, "[data-sidebar-mobile-toggle]":nodes.toggle, "[data-sidebar-mobile-close]":nodes.close, "[data-sidebar-backdrop]":nodes.backdrop, "[data-sidebar-class-list]":nodes.root};
    document.querySelector = key => selectors[key] || state.panels.find(panel => key === `[data-sidebar-panel="${panel.dataset.sidebarPanel}"]`) || null;
    document.querySelectorAll = key => ({
        ".sidebar-nav-link[href], .sidebar-subitem[href]":state.links,
        "[data-sidebar-toggle]":state.toggles,
        "[data-sidebar-panel]":state.panels,
        '[data-sidebar-panel="formats"]':[nodes.formats],
        "[data-sidebar-format-list]":[nodes.core,nodes.extra]
    }[key] || []);
    nodes.sidebar.querySelector = () => nodes.profile;
    nodes.sidebar.querySelectorAll = () => state.focusable;
    nodes.sidebar.contains = element => state.focusable.includes(element);
    nodes.toggle.focus();
    const windowListeners = {};
    const scope = vm.createContext({document, window: {addEventListener:(event, callback) => { windowListeners[event] = callback; }, location:{pathname:`/plataforma/${path}`}, matchMedia:() => ({matches:state.mobile})}, readSelectedClass:()=>state.selected, getAvailableClasses:()=>state.classes});
    vm.runInContext(source, scope);
    return {node, nodes, state, document, scope, windowListeners, run: code=>vm.runInContext(code,scope)};
}

test("admin navigation is removed on page leave and revalidated on browser return", async () => {
    const h = harness();
    let removed = 0;
    h.document.querySelectorAll = selector => selector === "[data-sidebar-admin-link]" ? [{ remove: () => { removed += 1; } }] : [];
    h.windowListeners.pagehide();
    assert.equal(removed, 1);
    let checked = 0;
    h.scope.window.educariaAdminApi = { access: async () => { checked += 1; return false; } };
    h.windowListeners.pageshow({ persisted: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(checked, 1);
    assert.equal(removed, 2);
});

test("class detail highlights only the selected class and its parent section", () => {
    const h = harness("turma.html");
    const parent = h.node({href:"turmas.html"});
    parent.classList.add("sidebar-nav-link");
    const a = h.node({href:"turma.html", "data-sidebar-class-link":"Turma A"},{sidebarClassLink:"Turma A"});
    const b = h.node({href:"turma.html", "data-sidebar-class-link":"Turma B"},{sidebarClassLink:"Turma B"});
    h.state.links = [parent,a,b]; h.run("setActiveSidebarLinks()");
    assert.equal(parent.classList.contains("is-active"),true);
    assert.equal(parent.getAttribute("aria-current"),null);
    assert.equal(a.classList.contains("is-active"),false);
    assert.equal(b.getAttribute("aria-current"),"page");
    h.state.selected = "Turma A"; h.run("setActiveSidebarLinks()");
    assert.equal(a.getAttribute("aria-current"),"page");
    assert.equal(b.getAttribute("aria-current"),null);
});

test("dashboard anchors are actions, not duplicate current-page links", () => {
    const h = harness();
    const page = h.node({href:"index.html"}); const shortcut = h.node({href:"index.html#quick-ai-create"});
    h.state.links = [page,shortcut]; h.run("setActiveSidebarLinks()");
    assert.equal(page.getAttribute("aria-current"),"page");
    assert.equal(shortcut.getAttribute("aria-current"),null);
});

test("class names are escaped and the empty state starts with creating a class", () => {
    const h = harness(); h.state.classes = ['<img src=x onerror="bad()">'];
    h.run("renderSidebarClasses()");
    assert.doesNotMatch(h.nodes.root.innerHTML, /<img/);
    assert.match(h.nodes.root.innerHTML, /&lt;img/);
    assert.match(h.nodes.root.innerHTML, /&quot;/);
    h.state.classes = []; h.run("renderSidebarClasses()");
    assert.match(h.nodes.root.innerHTML, /Criar turma/);
});

test("all twelve formats remain available, with a shortcut to the main AI creator", () => {
    const h = harness(); h.run("renderSidebarFormats()");
    assert.match(h.nodes.formats.innerHTML, /index.html#quick-ai-create/);
    assert.match(h.nodes.formats.innerHTML, /Começar com IA/);
    assert.equal((h.nodes.core.innerHTML.match(/<a /g) || []).length,3);
    assert.equal((h.nodes.extra.innerHTML.match(/<a /g) || []).length,9);
    h.scope.window.educariaTranslate = (key,fallback) => key === "sidebar.creator.title" ? "Start with AI" : fallback;
    h.run("renderSidebarFormats()");
    assert.match(h.nodes.formats.innerHTML, /Start with AI/);
});

test("accordion regions have accessible names and synchronized expanded states", () => {
    const h = harness();
    h.state.toggles = [h.node({}, {sidebarToggle:"formats"}),h.node({}, {sidebarToggle:"classes"})];
    h.state.panels = [h.node({}, {sidebarPanel:"formats"}),h.node({}, {sidebarPanel:"classes"})];
    h.run('enhanceSidebarPanels(); openSidebarPanel("classes")');
    assert.equal(h.state.toggles[1].getAttribute("aria-expanded"),"true");
    assert.equal(h.state.panels[1].getAttribute("aria-labelledby"),"sidebar-toggle-classes");
    assert.equal(h.state.panels[0].hidden,true);
    h.run("closeSidebarPanels()");
    assert.equal(h.state.panels[1].hidden,true);
});

test("closed mobile menus cannot receive focus; opening isolates background and returns focus on close", () => {
    const h = harness(); h.state.mobile = true;
    h.run("setMobileSidebarOpen(false)");
    assert.equal(h.nodes.sidebar.inert,true);
    assert.equal(h.nodes.sidebar.getAttribute("aria-hidden"),"true");
    h.run("setMobileSidebarOpen(true)");
    assert.equal(h.nodes.sidebar.inert,false);
    assert.equal(h.nodes.content.inert,true);
    assert.equal(h.nodes.sidebar.getAttribute("aria-modal"),"true");
    assert.equal(h.document.activeElement,h.nodes.close);
    h.run("setMobileSidebarOpen(false)");
    assert.equal(h.document.activeElement,h.nodes.toggle);
    assert.equal(h.nodes.content.inert,false);
    assert.equal(h.nodes.sidebar.getAttribute("aria-modal"),null);
});

test("keyboard focus wraps both ways and Escape closes the mobile menu", () => {
    const h = harness(); h.state.mobile = true; h.run("setMobileSidebarOpen(true)");
    let prevented = false;
    h.scope.event = {key:"Tab",shiftKey:false,preventDefault(){prevented=true;}};
    h.run("handleSidebarKeydown(event)");
    assert.equal(prevented,true); assert.equal(h.document.activeElement,h.nodes.profile);
    h.scope.event.shiftKey = true; h.run("handleSidebarKeydown(event)");
    assert.equal(h.document.activeElement,h.nodes.close);
    h.scope.event.key = "Escape"; h.run("handleSidebarKeydown(event)");
    assert.equal(h.document.body.classList.contains("app-sidebar-open"),false);
});

test("resizing to desktop restores navigation without leaving the page inert", () => {
    const h = harness(); h.state.mobile = true; h.run("setMobileSidebarOpen(true)");
    h.state.mobile = false; h.run("setMobileSidebarOpen(true)");
    assert.equal(h.nodes.sidebar.inert,false);
    assert.equal(h.nodes.sidebar.getAttribute("aria-hidden"),null);
    assert.equal(h.nodes.content.inert,false);
    assert.equal(h.document.activeElement,h.nodes.profile);
});

test("the first-access guide retains control of focus and its own keyboard handling", () => {
    const h = harness(); h.state.mobile = true;
    h.document.body.classList.add("dashboard-tour-active");
    h.run("setMobileSidebarOpen(true)");
    assert.equal(h.document.activeElement,h.nodes.toggle);
    assert.equal(h.nodes.sidebar.getAttribute("aria-modal"),null);
    h.scope.event = {key:"Escape",preventDefault(){throw Error("guide owns Escape");}};
    h.run("handleSidebarKeydown(event)");
    assert.equal(h.document.body.classList.contains("app-sidebar-open"),true);
});

test("pre-existing background inert state is preserved", () => {
    const h = harness(); h.state.mobile = true; h.nodes.content.inert = true;
    h.run("setMobileSidebarOpen(true); setMobileSidebarOpen(false)");
    assert.equal(h.nodes.content.inert,true);
});

test("class navigation stays unique after language changes and reordering", () => {
    const h = harness(); const button = h.node(); const existing = h.node();
    button.parentElement = {querySelector:()=>existing,insertBefore(){throw Error("Duplicate class link");}};
    h.document.querySelectorAll = () => [button];
    h.run("ensureSidebarClassesPageLink(); ensureSidebarClassesPageLink()");
    assert.equal(button.textContent,"Turmas recentes");
    assert.equal(existing.textContent,"Minhas turmas");
    assert.equal(existing.getAttribute("data-i18n"),"dashboard.nav.myClasses");
});

test("all sidebar pages request the shared updated assets", async () => {
    for (const page of ["index","biblioteca","turmas","turma","configuracoes"]) {
        const html = await read(`plataforma/${page}.html`);
        assert.match(html,/app-sidebar\.js\?v=20261012-2/);
        assert.match(html,/estilo-premium\.css\?v=20261012-1/);
    }
    assert.match(await read("assets/css/estilo-premium.css"), /components\/sidebar\.css\?v=20261012-1/);
});
