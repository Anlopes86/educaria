import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";

const recoverySource = await fs.readFile(new URL("../../assets/js/generation-recovery.js", import.meta.url), "utf8");
const generator = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
const importSource = generator.slice(generator.indexOf("function readDashboardQuickResult()"), generator.indexOf("function bindAiMaterialGenerator()"));

function harness(values = new Map()) {
    const state = { failWrite: false, failImport: false, applied: 0, lessons: [], errors: [], navigations: [] };
    const storage = {
        get length() { return values.size; }, key: (index) => [...values.keys()][index],
        getItem: (key) => values.get(key) ?? null,
        setItem(key, value) { if (state.failWrite) throw new Error("Quota exceeded"); values.set(key, String(value)); },
        removeItem: (key) => values.delete(key)
    };
    const teacher = (uid) => storage.setItem("educaria:auth:teacher-cache", JSON.stringify({ uid }));
    teacher("Teacher-A");
    const location = { search: "", pathname: "/plataforma/quiz-builder.html", hash: "", href: "quiz-builder.html",
        replace: (url) => state.navigations.push(url) };
    const window = { location, history: { replaceState(_, __, url) { location.search = new URL(url, "https://example.test").search; } },
        requestAnimationFrame(callback) { state.onFrame?.(); callback(); } };
    const field = { value: "", dispatchEvent() {} };
    const document = {
        getElementById: () => field, querySelector: () => null, dispatchEvent() {},
        body: { classList: { remove() {} } }
    };
    const context = vm.createContext({ window, document, localStorage: storage, crypto: { randomUUID }, URLSearchParams,
        Event: class {}, CustomEvent: class {},
        currentBuilderMaterialType: () => "quiz",
        materialConfig: () => ({ textId: "source", apply() { state.applied++; return true; } }),
        readLessonsLibrary: () => state.lessons,
        writeActiveLessonId() {}, saveSelectedClass() {},
        buildLessonRecord: () => ({ materialType: "quiz", draft: '{"text":"gerado"}', title: "Gerado" }),
        persistLessonRecord(record) { if (state.failImport) throw new Error("Disk full"); state.lessons.push(record); return record; },
        syncLessonRecordWithFirebase: async () => ({ synced: false }),
        activateLessonById: (id) => state.lessons.find((lesson) => lesson.id === id),
        builderPresentationPath: () => "quiz-aplicacao.html", reviewGeneratedMaterial() {},
        recordError: (message) => state.errors.push(message)
    });
    vm.runInContext(recoverySource, context);
    vm.runInContext(`let dashboardQuickImportRunning = false; ${importSource}\nshowQuickImportError = recordError;`, context);
    const api = window.educariaGenerationRecovery;
    function create(extra = {}) {
        return api.create({ ownerUid: api.currentUid(), materialType: "quiz", topic: "Ciências", className: "", label: "Quiz",
            payload: { material: { title: "Ciências", questions: [{ prompt: "O que é energia?" }] }, charge: { cost: 12 } }, ...extra });
    }
    function open(record) { location.search = new URL(api.editorUrl(record), "https://example.test").search; }
    return { api, state, values, storage, teacher, create, open, consume: () => vm.runInContext("consumeDashboardQuickResult()", context) };
}

test("pending results survive reload and do not expire after fifteen minutes", () => {
    const first = harness(); const record = first.create(); record.createdAt -= 48 * 60 * 60 * 1000;
    assert.equal(first.api.save(record), true);
    const reloaded = harness(first.values);
    assert.equal(reloaded.api.get(record.id).topic, "Ciências");
    assert.equal(reloaded.api.isDurable(reloaded.api.get(record.id)), true);
});

test("multiple generations are kept separately and exact UID isolates case-colliding scopes", () => {
    const h = harness(); const one = h.create(); const two = h.create(); h.api.save(one); h.api.save(two);
    assert.equal(h.api.list().length, 2);
    h.teacher("teacher-a"); assert.equal(h.api.list().length, 0);
    const other = h.create(); h.api.save(other);
    h.teacher("Teacher-A"); assert.equal(h.api.list().length, 2);
    assert.equal(h.api.get(other.id), null);
});

test("quota failure keeps a volatile copy and retry makes it durable", () => {
    const h = harness(); const record = h.create(); h.state.failWrite = true;
    assert.equal(h.api.save(record), false); assert.equal(h.api.get(record.id).topic, record.topic);
    assert.equal(h.api.isDurable(record), false);
    assert.equal(h.api.hasUnsaved(), true);
    h.state.failWrite = false; assert.equal(h.api.save(record), true); assert.equal(h.api.isDurable(record), true);
    assert.equal(h.api.hasUnsaved(), false);
});

test("a result arriving after account switching is stored only for its original account", () => {
    const h = harness(); const record = h.create(); h.teacher("Teacher-B"); h.api.save(record);
    assert.equal(h.api.list().length, 0); assert.throws(() => h.api.editorUrl(record));
    h.teacher("Teacher-A"); assert.equal(h.api.get(record.id).id, record.id);
});

test("navigation uses known editor routes, never a stored target URL", () => {
    const h = harness(); const record = h.create(); record.target = "https://malicious.invalid";
    assert.match(h.api.editorUrl(record), /^quiz-builder\.html\?/);
    assert.match(h.api.editorUrl(record, "present"), /quickDestination=present$/);
    assert.throws(() => h.create({ materialType: "__proto__" }));
});

test("corrupt entries do not hide valid results and completion requires a matching saved lesson", () => {
    const h = harness(); const record = h.create(); h.api.save(record); h.values.set("educaria:ai-result:broken", "{");
    assert.equal(h.api.list().length, 1); assert.equal(h.api.complete(record.id, { id: "other" }), false);
    assert.equal(h.api.complete(record.id, { id: h.api.lessonId(record), materialType: "quiz", draft: "{}" }), true);
    assert.equal(h.api.list().length, 0);
});

test("failed editor save preserves recovery; retry persists before acknowledgment", async () => {
    const h = harness(); const record = h.create(); h.api.save(record); h.open(record); h.state.failImport = true;
    await h.consume(); assert.equal(h.api.list().length, 1); assert.equal(h.state.lessons.length, 0);
    assert.equal(h.state.errors.length, 1);
    h.state.failImport = false; await h.consume();
    assert.equal(h.api.list().length, 0); assert.equal(h.state.lessons[0].id, h.api.lessonId(record));
});

test("replaying a result opens the saved lesson without overwriting subsequent edits", async () => {
    const h = harness(); const record = h.create(); h.api.save(record); h.open(record);
    h.state.lessons.push({ id: h.api.lessonId(record), materialType: "quiz", draft: '{"text":"edição do professor"}' });
    await h.consume(); assert.equal(h.state.applied, 0); assert.equal(h.state.lessons.length, 1);
    assert.match(h.state.lessons[0].draft, /edição do professor/); assert.equal(h.state.navigations.length, 1);
});

test("account switching during import cannot save the material under the new account", async () => {
    const h = harness(); const record = h.create(); h.api.save(record); h.open(record);
    h.state.onFrame = () => h.teacher("Teacher-B"); await h.consume();
    assert.equal(h.state.lessons.length, 0); h.teacher("Teacher-A"); assert.equal(h.api.list().length, 1);
});
