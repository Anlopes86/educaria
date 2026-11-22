import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";

const source = await fs.readFile(new URL("../../assets/js/generation-recovery.js", import.meta.url), "utf8");
const origin = "https://educaria.example";

function events() {
    const listeners = new Map();
    return {
        addEventListener(type, callback) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(callback);
        },
        removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
        emit(type, event = {}) { for (const callback of [...(listeners.get(type) || [])]) callback(event); },
        listenerCount(type) { return listeners.get(type)?.size || 0; }
    };
}

function harness() {
    const values = new Map();
    const state = { lessons: [], frames: [], timers: new Map() };
    const storage = {
        get length() { return values.size; }, key: index => [...values.keys()][index],
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
    const teacher = uid => storage.setItem("educaria:auth:teacher-cache", JSON.stringify({ uid }));
    teacher("Teacher-A");
    let timerId = 0;
    const window = {
        ...events(), location: { origin, search: "", href: `${origin}/plataforma/index.html` },
        setTimeout(callback, delay) { const id = ++timerId; state.timers.set(id, { callback, delay }); return id; },
        clearTimeout(id) { state.timers.delete(id); }
    };
    window.parent = window;
    const document = {
        ...events(),
        createElement(tagName) {
            assert.equal(tagName, "iframe");
            return {
                attributes: {}, style: {}, contentWindow: {}, removed: false,
                setAttribute(name, value) { this.attributes[name] = String(value); },
                remove() { this.removed = true; }
            };
        },
        body: { appendChild(frame) { state.frames.push(frame); } }
    };
    vm.runInNewContext(source, {
        window, document, localStorage: storage, crypto: { randomUUID }, URLSearchParams, DOMException,
        readLessonsLibrary: () => state.lessons,
        writeLessonsLibrary: lessons => { state.lessons = lessons; }
    });
    const api = window.educariaGenerationRecovery;
    function create(extra = {}) {
        const record = api.create({ ownerUid: api.currentUid(), materialType: "quiz", topic: "Ciências",
            className: "7º ano B", label: "Quiz",
            payload: { material: { title: "Energia", questions: [{ prompt: "O que é energia?" }] } }, ...extra });
        assert.equal(api.save(record), true);
        return record;
    }
    function ready(record, patch = {}) {
        const lesson = { ...state.lessons.find(item => item.id === api.lessonId(record)),
            id: api.lessonId(record), materialType: record.materialType,
            draft: JSON.stringify({ controls: { "quiz-tema": "Energia" }, stackHtml: "<section>Questão revisada</section>" }), ...patch };
        state.lessons = [lesson, ...state.lessons.filter(item => item.id !== lesson.id)];
        return lesson;
    }
    function message(record, overrides = {}, envelope = {}) {
        const frame = state.frames.at(-1);
        const token = new URL(frame.src, origin).searchParams.get("quickPrepare");
        window.emit("message", { origin, source: frame.contentWindow,
            data: { type: "educaria:quick-presentation-prepared", token, id: record.id,
                lessonId: api.lessonId(record), ownerUid: record.ownerUid, ok: true, ...overrides }, ...envelope });
    }
    function cleanup() {
        assert.equal(state.frames.at(-1)?.removed, true);
        assert.equal(state.timers.size, 0);
        assert.equal(window.listenerCount("message"), 0);
        assert.equal(document.listenerCount("educaria-auth-changed"), 0);
    }
    return { api, state, window, document, teacher, create, ready, message, cleanup };
}

test("presentation preparation keeps the dashboard open until its exact saved draft is ready", async () => {
    const h = harness(), record = h.create();
    const pending = h.api.prepareForPresentation(record);
    const frame = h.state.frames[0];
    assert.equal(h.window.location.href, `${origin}/plataforma/index.html`);
    assert.equal(frame.attributes["aria-hidden"], "true");
    assert.ok(Object.hasOwn(frame.attributes, "inert"));
    assert.equal(frame.tabIndex, -1);
    const url = new URL(frame.src, origin);
    assert.equal(url.pathname, "/quiz-builder.html");
    assert.equal(url.searchParams.get("quickResult"), record.id);
    assert.equal(url.searchParams.get("quickApply"), "1");
    assert.match(url.searchParams.get("quickPrepare"), /^[a-zA-Z0-9_-]{1,100}$/);
    const saved = h.ready(record, { title: "Título revisto", status: "ready" });
    h.message(record);
    assert.equal(await pending, saved);
    assert.equal(saved.className, "7º ano B");
    assert.equal(h.window.location.href, `${origin}/plataforma/index.html`, "the caller owns navigation");
    h.cleanup();
});

test("unrelated and forged completion messages cannot open or cancel a presentation", async () => {
    const h = harness(), record = h.create();
    let settled = false;
    const pending = h.api.prepareForPresentation(record).finally(() => { settled = true; });
    const saved = h.ready(record);
    h.message(record, {}, { origin: "https://another.example" });
    h.message(record, {}, { source: {} });
    for (const patch of [
        { type: "another-message" }, { token: "wrong-token" }, { id: "another-result" },
        { lessonId: "another-copy" }, { ownerUid: "Teacher-B" }
    ]) h.message(record, patch);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(h.state.frames[0].removed, false);
    h.message(record);
    assert.equal(await pending, saved);
    h.cleanup();
});

test("a success message cannot replace the requirement for a persisted converted draft", async t => {
    for (const [name, draft] of [
        ["still pending", null], ["malformed", "{"], ["array", "[]"], ["empty", "null"], ["primitive", '"text"']
    ]) await t.test(name, async () => {
        const h = harness(), record = h.create();
        const pending = h.api.prepareForPresentation(record);
        const rejected = assert.rejects(pending, /preparar a apresentação/);
        if (draft !== null) h.state.lessons[0].draft = draft;
        h.message(record);
        await rejected;
        assert.equal(h.state.lessons.length, 1, "preparation never deletes recovery material");
        h.cleanup();
    });
});

test("conversion failure keeps recovery available and a retry can reuse the same material", async () => {
    const h = harness(), record = h.create();
    const rejected = assert.rejects(h.api.prepareForPresentation(record), /preparar a apresentação/);
    h.message(record, { ok: false });
    await rejected;
    assert.equal(h.api.get(record.id).id, record.id);
    h.cleanup();
    const retry = h.api.prepareForPresentation(record);
    const saved = h.ready(record);
    h.message(record);
    assert.equal(await retry, saved);
    assert.equal(h.state.lessons.length, 1);
    h.cleanup();
});

test("a stalled preparation times out without discarding the generated activity", async () => {
    const h = harness(), record = h.create();
    const rejected = assert.rejects(h.api.prepareForPresentation(record), /demorou/);
    assert.equal(h.state.timers.size, 1);
    const timer = [...h.state.timers.values()][0];
    assert.equal(timer.delay, 45000);
    timer.callback();
    await rejected;
    assert.equal(h.api.get(record.id).id, record.id);
    h.cleanup();
});

test("cancelling preparation removes its frame but preserves a result for later use", async () => {
    const h = harness(), record = h.create(), controller = new AbortController();
    const rejected = assert.rejects(h.api.prepareForPresentation(record, { signal: controller.signal }), { name: "AbortError" });
    controller.abort();
    await rejected;
    assert.equal(h.api.get(record.id).id, record.id);
    h.cleanup();
    const before = h.state.frames.length;
    await assert.rejects(h.api.prepareForPresentation(record, { signal: controller.signal }), { name: "AbortError" });
    assert.equal(h.state.frames.length, before, "an already cancelled request must not create a frame");
});

test("changing accounts cancels preparation and never acknowledges another teacher's material", async t => {
    for (const notifyAuth of [true, false]) await t.test(notifyAuth ? "auth event" : "completion after silent account change", async () => {
        const h = harness(), record = h.create();
        const rejected = assert.rejects(h.api.prepareForPresentation(record), /conta foi alterada/);
        h.teacher("Teacher-B");
        if (notifyAuth) h.document.emit("educaria-auth-changed");
        else h.message(record);
        await rejected;
        h.cleanup();
        assert.equal(h.api.get(record.id), null);
        h.teacher("Teacher-A");
        assert.equal(h.api.get(record.id).id, record.id);
    });
});

test("a stale account cannot start preparation even when the lesson already exists", async () => {
    const h = harness(), record = h.create();
    h.ready(record);
    h.teacher("Teacher-B");
    await assert.rejects(h.api.prepareForPresentation(record), /Entre na conta/);
    assert.equal(h.state.frames.length, 0);
    assert.equal(h.state.timers.size, 0);
});

test("replaying a prepared result returns the teacher's latest edits without another converter", async () => {
    const h = harness(), record = h.create();
    const saved = h.ready(record, { title: "Edição posterior", draft: '{"controls":{},"stackHtml":"Texto editado"}' });
    assert.equal(await h.api.prepareForPresentation(record), saved);
    assert.equal(h.state.frames.length, 0);
    assert.equal(h.state.timers.size, 0);
    assert.equal(h.state.lessons.length, 1);
});

test("a copied pending activity prepares its own library identity, preserving the original", async () => {
    const h = harness(), original = h.create();
    const originalLesson = h.state.lessons[0];
    h.state.lessons.push({ ...originalLesson, id: "lesson-copy", className: "Turma C" });
    const copy = h.api.get(original.id, "lesson-copy");
    const pending = h.api.prepareForPresentation(copy);
    assert.equal(new URL(h.state.frames[0].src, origin).searchParams.get("quickLesson"), "lesson-copy");
    const saved = h.ready(copy);
    h.message(copy);
    assert.equal(await pending, saved);
    assert.equal(saved.className, "Turma C");
    assert.equal(h.state.lessons.find(item => item.id === originalLesson.id), originalLesson);
    assert.ok(h.api.fromLesson(originalLesson), "the original remains recoverable and unconverted");
    h.cleanup();
});

test("background completion reports only its exact result identity to the same-origin parent", () => {
    const h = harness(), record = h.create();
    const posts = [];
    h.window.parent = { location: { origin }, postMessage: (data, target) => posts.push({ data, target }) };
    h.window.location.search = "?quickApply=1&quickPrepare=transfer-123";
    assert.equal(h.api.backgroundPreparation(), "transfer-123");
    assert.equal(h.api.reportPreparation(record), true);
    assert.deepEqual(JSON.parse(JSON.stringify(posts[0])), { target: origin, data: {
        type: "educaria:quick-presentation-prepared", token: "transfer-123", id: record.id,
        lessonId: h.api.lessonId(record), ownerUid: record.ownerUid, ok: true
    } });
    assert.equal(h.api.reportPreparation(record, "Private error detail"), true);
    assert.equal(posts[1].data.ok, false);
    assert.equal(JSON.stringify(posts[1]).includes("Private error detail"), false);
});

test("regular editors, invalid tokens and cross-origin parents cannot use the hidden completion protocol", () => {
    const h = harness(), record = h.create();
    const posts = [];
    const sameOriginParent = { location: { origin }, postMessage: (...args) => posts.push(args) };
    const scenarios = [
        [h.window, "?quickApply=1&quickPrepare=transfer-123"],
        [sameOriginParent, "?quickPrepare=transfer-123"],
        [sameOriginParent, "?quickApply=1&quickPrepare="],
        [sameOriginParent, "?quickApply=1&quickPrepare=invalid%2Ftoken"],
        [sameOriginParent, `?quickApply=1&quickPrepare=${"a".repeat(101)}`],
        [{ ...sameOriginParent, location: { origin: "https://another.example" } }, "?quickApply=1&quickPrepare=transfer-123"],
        [{ get location() { throw new Error("Cross-origin access denied"); } }, "?quickApply=1&quickPrepare=transfer-123"]
    ];
    for (const [parent, search] of scenarios) {
        h.window.parent = parent;
        h.window.location.search = search;
        assert.equal(h.api.backgroundPreparation(), "");
        assert.equal(h.api.reportPreparation(record), false);
    }
    assert.equal(posts.length, 0);
});
