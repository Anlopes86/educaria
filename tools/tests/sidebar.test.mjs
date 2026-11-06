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
        scrollIntoView(options) { this.scrolled = options; },
        getClientRects() { return this.hidden ? [] : [{}]; },
        closest() { return null; }
    });
    const nodes = {sidebar: node(), content: node(), toggle: node(), close: node(), backdrop: node(), profile: node(), root: node(), topic: node()};
    const state = {mobile: false, reducedMotion: false, selected:"Turma B", classes:["Turma A", "Turma B"], links:[], toggles:[], panels:[], focusable:[nodes.profile,nodes.close]};
    const selectors = {".app-sidebar": nodes.sidebar, ".app-content":nodes.content, "[data-sidebar-mobile-toggle]":nodes.toggle, "[data-sidebar-mobile-close]":nodes.close, "[data-sidebar-backdrop]":nodes.backdrop, "[data-sidebar-class-list]":nodes.root, "[data-dashboard-quick-topic]":nodes.topic};
    document.createElement = () => node();
    document.querySelector = key => selectors[key] || state.panels.find(panel => key === `[data-sidebar-panel="${panel.dataset.sidebarPanel}"]`) || null;
    document.querySelectorAll = key => ({
        ".sidebar-nav-link[href], .sidebar-subitem[href]":state.links,
        "[data-sidebar-toggle]":state.toggles,
        "[data-sidebar-panel]":state.panels
    }[key] || []);
    nodes.sidebar.querySelector = () => nodes.profile;
    nodes.sidebar.querySelectorAll = () => state.focusable;
    nodes.sidebar.contains = element => state.focusable.includes(element);
    nodes.toggle.focus();
    const windowListeners = {};
    const scope = vm.createContext({document, window: {addEventListener:(event, callback) => { windowListeners[event] = callback; }, location:{pathname:`/plataforma/${path}`}, matchMedia:query => ({matches:query.includes("reduced-motion") ? state.reducedMotion : state.mobile})}, readSelectedClass:()=>state.selected, getAvailableClasses:()=>state.classes});
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

test("one creation link replaces the former catalogue and stays unique after language changes", () => {
    const h = harness(); let link = null, oldToggle = true, removedPanels = 0, inserted = 0;
    const nav = {
        querySelector: selector => selector === "[data-sidebar-create-activity]" ? link : oldToggle ? {
            replaceWith(value) { link = value; oldToggle = false; inserted += 1; }
        } : null,
        querySelectorAll: () => removedPanels ? [] : [{remove() { removedPanels += 1; }}],
        prepend() { throw Error("The existing navigation slot should be reused"); }
    };
    h.document.querySelectorAll = selector => selector === ".app-sidebar-nav" ? [nav] : [];
    h.run("ensureSidebarCreationLink()");
    assert.equal(link.getAttribute("href"), "index.html#quick-ai-create");
    assert.equal(link.textContent, "Criar atividade");
    assert.equal(link.hasAttribute("data-sidebar-toggle"), false);
    assert.equal(removedPanels, 1);
    h.scope.window.educariaTranslate = (key,fallback) => key === "dashboard.nav.createActivity" ? "Create activity" : fallback;
    h.run("ensureSidebarCreationLink()");
    assert.equal(link.textContent, "Create activity");
    assert.equal(inserted, 1);
    h.scope.link = link;
    assert.equal(h.run("sidebarNavKey(link)"), "create-activity");
});

test("the creator shortcut focuses the current request without clearing it and closes the mobile menu", () => {
    const h = harness(); h.state.mobile = true;
    h.nodes.topic.value = "Use meu texto já digitado";
    h.run("setMobileSidebarOpen(true)");
    const link = h.node({href:"index.html#quick-ai-create", "data-sidebar-create-activity":""});
    let prevented = false;
    h.scope.event = {target:{closest:()=>link}, button:0, preventDefault(){prevented=true;}};
    h.run("handleSidebarNavigation(event)");
    assert.equal(prevented,true);
    assert.equal(h.document.activeElement,h.nodes.topic);
    assert.equal(h.nodes.topic.value,"Use meu texto já digitado");
    assert.equal(h.nodes.topic.scrolled.block,"center");
    assert.equal(h.nodes.topic.scrolled.behavior,"smooth");
    assert.equal(h.document.body.classList.contains("app-sidebar-open"),false);
    assert.equal(h.nodes.content.inert,false);
    h.state.reducedMotion = true; h.run("focusSidebarCreator()");
    assert.equal(h.nodes.topic.scrolled.behavior,"auto");
});

test("the creation link in each page's HTML is reused without adding another entry", async () => {
    for (const page of ["index", "biblioteca", "turmas", "turma", "configuracoes"]) {
        const html = await read(`plataforma/${page}.html`);
        const nav = html.match(/<nav\b[^>]*class="[^"]*\bapp-sidebar-nav\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
        assert.ok(nav, `${page}: navigation exists`);
        const links = [...nav.matchAll(/<a\b[^>]*href="index\.html#quick-ai-create"[^>]*>/g)];
        assert.equal(links.length, 1, `${page}: exactly one creation link`);
        const attrs = Object.fromEntries([...links[0][0].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? ""]));
        assert.ok("data-sidebar-create-activity" in attrs, `${page}: initial link is recognized by the sidebar`);
        const h = harness(`${page}.html`);
        const link = h.node(attrs);
        const navigation = {
            querySelector: selector => selector === "[data-sidebar-create-activity]" ? link : null,
            querySelectorAll: () => [],
            prepend() { assert.fail(`${page}: must reuse the HTML link`); }
        };
        h.document.querySelectorAll = selector => selector === ".app-sidebar-nav" ? [navigation] : [];
        h.run("ensureSidebarCreationLink(); ensureSidebarCreationLink()");
        h.scope.link = link;
        assert.equal(h.run("sidebarNavKey(link)"), "create-activity");
        assert.equal(link.getAttribute("href"), "index.html#quick-ai-create");
    }
});

test("creation from another page follows the normal link and preserves browser navigation modifiers", () => {
    const h = harness("biblioteca.html");
    const link = h.node({href:"index.html#quick-ai-create", "data-sidebar-create-activity":""});
    h.scope.event = {target:{closest:()=>link}, preventDefault(){throw Error("Other pages must navigate normally");}};
    h.run("handleSidebarNavigation(event)");
    assert.notEqual(h.document.activeElement,h.nodes.topic);
    h.state.mobile = true; h.run("setMobileSidebarOpen(true)");
    for (const modifier of ["ctrlKey","metaKey","shiftKey","altKey"]) {
        h.scope.event[modifier] = true;
        h.run("handleSidebarNavigation(event)");
        assert.equal(h.document.body.classList.contains("app-sidebar-open"),true);
        h.scope.event[modifier] = false;
    }
});

test("entering the dashboard with the creation anchor focuses the field except during the first-access guide", () => {
    const h = harness();
    h.scope.window.location.hash = "#quick-ai-create";
    h.windowListeners.hashchange();
    assert.equal(h.document.activeElement,h.nodes.topic);
    h.nodes.toggle.focus(); h.document.body.classList.add("dashboard-tour-active");
    h.windowListeners.hashchange();
    assert.equal(h.document.activeElement,h.nodes.toggle);
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
    const dashboard = await read("plataforma/index.html");
    const cssVersion = dashboard.match(/estilo-premium\.css\?v=(\d{8}-\d+)/)?.[1];
    const scriptVersion = dashboard.match(/app-sidebar\.js\?v=(\d{8}-\d+)/)?.[1];
    assert.ok(cssVersion && cssVersion >= "20261028-1", "shared stylesheet must include the simplified navigation");
    assert.ok(scriptVersion && scriptVersion >= "20261028-1", "sidebar script must include the direct creator link");
    for (const page of ["index","biblioteca","turmas","turma","configuracoes"]) {
        const html = await read(`plataforma/${page}.html`);
        assert.equal(html.match(/app-sidebar\.js\?v=(\d{8}-\d+)/)?.[1], scriptVersion);
        assert.equal(html.match(/estilo-premium\.css\?v=(\d{8}-\d+)/)?.[1], cssVersion);
    }
    const componentVersion = (await read("assets/css/estilo-premium.css")).match(/components\/sidebar\.css\?v=(\d{8}-\d+)/)?.[1];
    assert.ok(componentVersion && componentVersion >= "20261028-1");
});
