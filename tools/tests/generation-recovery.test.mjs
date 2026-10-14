import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";

const recoverySource = await fs.readFile(new URL("../../assets/js/generation-recovery.js", import.meta.url), "utf8");
const generator = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
const importSource = generator.slice(generator.indexOf("function applyGenerationOptionsToEditor("), generator.indexOf("function bindAiMaterialGenerator()"));

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
        getElementById: () => field, querySelector: () => null, dispatchEvent() {}, addEventListener() {},
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
    return { api, state, values, storage, teacher, create, open, context, consume: () => vm.runInContext("consumeDashboardQuickResult()", context) };
}

function libraryHarness() {
    const h = harness();
    h.context.getAvailableClasses = () => ["Turma A", "Turma B"];
    h.context.writeLessonsLibrary = records => { if (h.state.failWrite) throw new Error("Disk full"); h.state.lessons = records; };
    h.context.persistLessonRecord = record => {
        if (h.state.failImport) throw new Error("Disk full");
        h.state.lessons = [record, ...h.state.lessons.filter(item => item.id !== record.id)];
        return record;
    };
    return h;
}

test("archiving preserves the chosen class even while the class list is not yet available", async () => {
    const h = libraryHarness(); h.context.getAvailableClasses = () => [];
    const record = h.create({ className: "7º ano B" });
    assert.equal(h.api.save(record), true);
    assert.equal(h.state.lessons[0].className, "7º ano B");
    assert.equal(h.state.lessons[0].scope, "class");
    h.open(h.api.get(record.id)); await h.consume();
    assert.equal(h.state.lessons[0].className, "7º ano B");
});

test("an archived result's old recovery link reopens later edits without recreating a pending result", async () => {
    const h = libraryHarness(); const record = h.create(); h.api.save(record);
    h.open(h.api.get(record.id)); await h.consume();
    h.state.lessons[0].draft = '{"text":"edição posterior"}';
    h.api.save(record); h.open(record); await h.consume();
    assert.equal(h.state.applied, 1);
    assert.equal(h.state.lessons.length, 1);
    assert.match(h.state.lessons[0].draft, /edição posterior/);
    assert.equal(h.api.list().length, 0);
    assert.equal(h.state.navigations.length, 1);
});

test("the original recovery link never opens a pending copy instead of its edited original", async () => {
    const h = libraryHarness(); const record = h.create(); h.api.save(record);
    const copy = { ...h.state.lessons[0], id: "independent-copy", scope: "class", className: "Turma B" };
    h.open(h.api.get(record.id)); await h.consume();
    h.state.lessons.unshift(copy);
    assert.equal(h.api.get(record.id).libraryId, h.api.lessonId(record));
    assert.equal(h.api.get(record.id, copy.id).libraryId, copy.id);
    h.open(record); await h.consume();
    assert.equal(h.state.applied, 1);
    assert.ok(h.api.fromLesson(h.state.lessons.find(lesson => lesson.id === copy.id)));
});

test("a dashboard result becomes a separate library draft before opening an editor", () => {
    const h = libraryHarness(); const first = h.create(); const second = h.create();
    assert.equal(h.api.save(first), true); assert.equal(h.api.save(second), true);
    assert.equal(h.state.lessons.length, 2);
    assert.equal(h.state.lessons[0].scope, "library"); assert.equal(h.state.lessons[0].status, "draft");
    assert.equal(h.api.isDurable(first), true);
    assert.equal(h.api.list().length, 2);
    assert.equal([...h.values.keys()].filter(key => key.startsWith("educaria:ai-result:")).length, 0);
    h.state.lessons = h.state.lessons.filter(lesson => lesson.id !== h.api.lessonId(first));
    assert.equal(h.api.get(first.id), null, "deleting an archived draft must not leave a dashboard copy");
});

test("an archived, moved draft opens without another generation and preserves its identity", async () => {
    const h = libraryHarness(); const record = h.create(); h.api.save(record);
    const lesson = h.state.lessons[0]; lesson.scope = "class"; lesson.className = "Turma B";
    const recovered = h.api.fromLesson(lesson); h.open(recovered);
    await h.consume();
    assert.equal(h.state.applied, 1); assert.equal(h.state.lessons.length, 1);
    assert.equal(h.state.lessons[0].id, lesson.id); assert.equal(h.state.lessons[0].className, "Turma B");
    assert.equal(h.api.list().length, 0);
});

test("copied pending drafts open their own copy, not the original", async () => {
    const h = libraryHarness(); const record = h.create(); h.api.save(record);
    const original = h.state.lessons[0]; const copy = { ...original, id: "lesson-copy", scope: "class", className: "Turma A" };
    h.state.lessons.push(copy); h.open(h.api.fromLesson(copy)); await h.consume();
    assert.equal(h.state.lessons.length, 2);
    assert.equal(h.api.fromLesson(h.state.lessons.find(lesson => lesson.id === "lesson-copy")), null);
    assert.ok(h.api.fromLesson(h.state.lessons.find(lesson => lesson.id === original.id)));
});

test("archive failures retain a downloadable result and cannot leak it into another account", () => {
    const h = libraryHarness(); const record = h.create(); h.state.failWrite = true;
    assert.equal(h.api.save(record), false); assert.equal(h.api.hasUnsaved(), true);
    h.state.failWrite = false; h.teacher("Teacher-B");
    assert.equal(h.api.save(record), true); assert.equal(h.state.lessons.length, 0);
    h.teacher("Teacher-A"); h.api.save(record); assert.equal(h.state.lessons.length, 1);
    h.teacher("Teacher-B"); assert.equal(h.api.fromLesson(h.state.lessons[0]), null);
});

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
