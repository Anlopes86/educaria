import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../../assets/js/teacher-dashboard.js", import.meta.url), "utf8");
const html = await fs.readFile(new URL("../../plataforma/index.html", import.meta.url), "utf8");
const dictionaries = await Promise.all(["pt-BR", "en-US", "es-ES"].map(async (lang) => JSON.parse(await fs.readFile(new URL(`../../assets/i18n/${lang}.json`, import.meta.url), "utf8"))));
const tourSource = source.slice(source.indexOf("function dashboardTourStorageKeys("), source.indexOf('document.addEventListener("DOMContentLoaded"'));
function element() {
    return { style: { removeProperty() {} }, removeAttribute() {}, focus() { this.focused = true; }, hidden: false, open: false, inert: false };
}
function harness() {
    const storage = new Map(), nodes = new Map(), classes = new Set(), listeners = new Map();
    const data = { teacher: { uid: "new-teacher" }, groups: [], lessons: [], recovered: [], timer: null, mobile: false };
    const context = vm.createContext({
        console: { warn() {} }, DASHBOARD_TOUR_STORAGE_PREFIX: "educaria:dashboard-tour:", DASHBOARD_TOUR_SESSION_KEY: "educaria:auth:session",
        DASHBOARD_TOUR_FOCUSABLE_SELECTOR: "button", dashboardTourSeenOnPage: new Set(), dashboardTourState: null, dashboardTourAutoTimer: 0,
        readCurrentTeacher: () => data.teacher, getAvailableClasses: () => data.groups, readLessonsLibrary: () => data.lessons,
        dashboardTranslate: (_, fallback) => fallback,
        localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
        document: {
            body: { classList: { contains: (value) => classes.has(value), add: (value) => classes.add(value), remove: (value) => classes.delete(value) } },
            querySelector: (selector) => nodes.get(selector) || null, querySelectorAll: () => [], activeElement: null,
            addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: (name) => listeners.delete(name)
        },
        window: {
            educariaGenerationRecovery: { list: () => data.recovered }, setTimeout: (handler) => { data.timer = handler; return 1; }, clearTimeout() {},
            addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false })
        },
        setMobileSidebarOpen: (value) => { data.mobile = value; }
    });
    vm.runInContext(tourSource, context);
    return { context, data, storage, nodes, classes, listeners };
}

test("six translated steps cover the new creator and always start with classes", () => {
    const h = harness(), steps = h.context.dashboardTourSteps();
    assert.deepEqual(Array.from(steps, (step) => step.id), ["class", "source", "format", "personalize", "generate", "reuse"]);
    for (const step of steps) {
        const attribute = step.selector.slice(1, -1);
        assert.ok(html.includes(attribute), `Missing target ${step.selector}`);
        for (const dictionary of dictionaries) for (const part of ["title", "description", "tip"]) assert.ok(dictionary[`dashboard.guide.${step.id}.${part}`]);
    }
    for (const dictionary of dictionaries) for (const key of ["progress", "skip", "back", "next", "finish"]) assert.ok(dictionary[`dashboard.guide.${key}`]);
});

test("first access waits for identity and skips returning or experienced teachers", () => {
    const h = harness();
    h.data.teacher = null; assert.equal(h.context.shouldAutoStartDashboardTour(), false);
    h.data.teacher = { uid: "new-teacher" }; assert.equal(h.context.shouldAutoStartDashboardTour(), true);
    h.data.groups = ["7º A"]; assert.equal(h.context.shouldAutoStartDashboardTour(), true);
    h.data.lessons = [{}]; assert.equal(h.context.shouldAutoStartDashboardTour(), false);
    h.data.lessons = []; h.storage.set("educaria:dashboard-tour:new-teacher", "done");
    assert.equal(h.context.shouldAutoStartDashboardTour(), false);
    h.data.teacher = { uid: "another-teacher" }; assert.equal(h.context.shouldAutoStartDashboardTour(), true);
});

test("automatic guide never overlaps generation, recovered results or another tour", () => {
    const h = harness();
    h.data.recovered = [{}]; assert.equal(h.context.shouldAutoStartDashboardTour(), false);
    h.data.recovered = []; h.classes.add("dashboard-ai-result-open"); assert.equal(h.context.shouldAutoStartDashboardTour(), false);
    h.classes.clear(); h.nodes.set("[data-dashboard-quick-form]", { dataset: { generating: "true" } }); assert.equal(h.context.shouldAutoStartDashboardTour(), false);
    h.nodes.clear(); h.context.dashboardTourState = { root: { hidden: false } }; assert.equal(h.context.shouldAutoStartDashboardTour(), false);
});

test("unavailable local storage does not repeatedly interrupt the same teacher", () => {
    const h = harness();
    h.context.localStorage.getItem = h.context.localStorage.setItem = () => { throw new Error("Storage unavailable"); };
    assert.equal(h.context.shouldAutoStartDashboardTour(), true);
    h.context.markDashboardTourSeen(); assert.equal(h.context.shouldAutoStartDashboardTour(), false);
    h.data.teacher = { uid: "different-teacher" }; assert.equal(h.context.shouldAutoStartDashboardTour(), true);
});

test("opening options for a step preserves both the original state and entered values", () => {
    const h = harness(), disclosure = { open: false, value: "EJA" }, other = { open: true };
    h.nodes.set(".dashboard-personalize", disclosure);
    h.context.dashboardTourState = { disclosures: [{ element: disclosure, open: false }, { element: other, open: true }] };
    h.context.prepareDashboardTourStep({ disclosure: ".dashboard-personalize" }); assert.equal(disclosure.open, true);
    h.context.prepareDashboardTourStep({ panel: "create-class" }); assert.equal(disclosure.open, false); assert.equal(other.open, true); assert.equal(disclosure.value, "EJA"); assert.equal(h.data.mobile, true);
});

function openTour(h) {
    const priorFocus = element(), background = element(), disclosure = element(), classInput = element(), topic = element();
    background.inert = true; disclosure.open = true;
    h.nodes.set("#sidebar-nome-turma", classInput); h.nodes.set("[data-dashboard-quick-topic]", topic);
    h.context.dashboardTourState = {
        root: element(), card: element(), highlight: element(), index: 0, startedAt: 0,
        disclosures: [{ element: disclosure, open: false }], backgroundElements: [{ element: background, inert: false }],
        previousPanel: "", previousMobileOpen: false, lastFocusedElement: priorFocus,
        repositionHandler: null, keyHandler: null
    };
    return { priorFocus, background, disclosure, classInput, topic };
}

test("skipping restores the page, disclosure state and keyboard focus", () => {
    const h = harness(), elements = openTour(h);
    h.context.closeDashboardTour(true, "skipped");
    assert.equal(h.context.dashboardTourState.root.hidden, true); assert.equal(elements.background.inert, false);
    assert.equal(elements.disclosure.open, false); assert.equal(elements.priorFocus.focused, true); assert.equal(h.data.mobile, false);
    assert.equal(h.context.hasSeenDashboardTour(), true);
});

test("finishing starts at class creation for new teachers and topic entry for existing classes", () => {
    const h = harness(); let elements = openTour(h);
    h.context.closeDashboardTour(true, "completed"); assert.equal(elements.classInput.focused, true); assert.equal(h.data.mobile, true);
    h.data.groups = ["7º A"]; elements = openTour(h);
    h.context.closeDashboardTour(true, "completed"); assert.equal(elements.topic.focused, true); assert.equal(h.data.mobile, false);
});

test("scheduled onboarding checks identity after authentication becomes available", () => {
    const h = harness(); let starts = 0;
    h.context.startDashboardTour = () => { starts++; };
    h.data.teacher = null; h.context.scheduleDashboardTourAutoStart(); h.data.timer(); assert.equal(starts, 0);
    h.data.teacher = { uid: "new-teacher" }; h.context.scheduleDashboardTourAutoStart(); h.data.timer(); assert.equal(starts, 1);
});
