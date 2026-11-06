import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const html = await fs.readFile(new URL("../../plataforma/index.html", import.meta.url), "utf8");
const scriptNames = ["material-context.js", "lesson-library.js", "teacher-dashboard.js"];
const sources = new Map(await Promise.all(scriptNames.map(async (name) => [
    name, await fs.readFile(new URL(`../../assets/js/${name}`, import.meta.url), "utf8")
])));
const dashboardScripts = [...html.matchAll(/<script\b([^>]*?)src="([^"]+)"([^>]*)><\/script>/g)]
    .map(([, before, src, after]) => ({ name: src.split("/").pop().split("?")[0], attributes: `${before} ${after}` }))
    .filter(({ name }) => scriptNames.includes(name));

function setup(materialType, status = "ready") {
    const lesson = {
        id: `lesson ${materialType}+1`, materialType, className: "6º ano A", scope: "class",
        title: "Atividade de revisão", status, updatedAt: "2026-10-28T12:00:00.000Z",
        draft: JSON.stringify({ title: "Conteúdo salvo", materialType })
    };
    const storage = new Map([["educaria:lessons", JSON.stringify([lesson])]]);
    const section = { hidden: false };
    const root = { innerHTML: "", closest: () => section, setAttribute() {}, replaceChildren() { this.innerHTML = ""; } };
    const location = { pathname: "/plataforma/index.html", search: "", hash: "" };
    const context = vm.createContext({
        console, URLSearchParams,
        document: {
            body: { dataset: {} }, addEventListener() {},
            querySelector: (selector) => selector === "[data-dashboard-recent-classes]" ? root : null
        },
        window: { location, addEventListener() {} },
        localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: (key) => storage.delete(key)
        },
        getAvailableClasses: () => [lesson.className]
    });
    // Load the complete production scripts in the page's real order; do not stub the routing helpers.
    for (const { name } of dashboardScripts) vm.runInContext(sources.get(name), context, { filename: name });
    context.hydrateTeacherDashboard();
    return { context, root, storage, location, lesson };
}

test("dashboard loads material routes before the library and recent-class renderer", () => {
    assert.deepEqual(dashboardScripts.map(({ name }) => name), scriptNames);
    for (const script of dashboardScripts) assert.match(script.attributes, /\bdefer\b/, script.name);
});

const destinations = [
    ["worksheet", "folha-atividades-builder.html", "folha-atividades-builder.html"],
    ["quiz", "quiz-aplicacao.html", "quiz-builder.html"],
    ["memory", "jogo-memoria-apresentacao.html", "jogo-memoria-builder.html"],
    ["slides", "apresentacao.html", "slides-builder.html"]
];

for (const [type, presentationPath, editorPath] of destinations) {
    test(`recent class ${type}: correct destination restores the selected material by ID`, () => {
        const h = setup(type);
        const present = h.root.innerHTML.match(/<a href="([^"]+)"[^>]*data-present-lesson="([^"]+)"[^>]*>(.*?)<\/a>/);
        const edit = h.root.innerHTML.match(/<a href="([^"]+)"[^>]*data-edit-lesson="([^"]+)"/);
        assert.ok(present, "Recent activity must offer its appropriate view action");
        assert.ok(edit, "Recent activity must offer an editor shortcut");
        assert.equal(edit[1], editorPath);
        assert.equal(edit[2], h.lesson.id);
        assert.equal(present[2], h.lesson.id);
        const target = new URL(present[1].replaceAll("&amp;", "&"), "https://example.test/plataforma/");
        assert.equal(target.pathname, `/plataforma/${presentationPath}`);
        assert.equal(target.searchParams.get("lesson"), h.lesson.id);
        assert.equal(target.searchParams.get("material"), type);

        // Exercise the destination's real hydration, so a link cannot silently open a stale draft.
        h.location.pathname = target.pathname;
        h.location.search = target.search;
        h.context.hydrateLessonFromUrl();
        assert.equal(h.storage.get("educaria:activeLessonId"), h.lesson.id);
        assert.equal(h.storage.get("educaria:currentMaterialType"), type);
        assert.equal(h.storage.get(`educaria:builder:${type}`), h.lesson.draft);
        if (type === "worksheet") {
            assert.equal(present[3], "Ver folha");
            assert.match(h.root.innerHTML, /Pronta para imprimir/);
            assert.match(h.root.innerHTML, /<strong>A4<\/strong>/);
            assert.doesNotMatch(h.root.innerHTML, /Apresentar|Pronto para projetar/);
        } else {
            assert.equal(present[3], "Apresentar");
        }
    });
}

test("recent worksheet draft keeps its draft status and print-specific action", () => {
    const h = setup("worksheet", "draft");
    assert.match(h.root.innerHTML, /Rascunho/);
    assert.match(h.root.innerHTML, />Ver folha<\/a>/);
    assert.doesNotMatch(h.root.innerHTML, /Pronta para imprimir|Apresentar/);
});
