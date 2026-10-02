import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { randomUUID } from "node:crypto";

const source = await fs.readFile(new URL("../../assets/js/lesson-library.js", import.meta.url), "utf8");
const settingsSource = await fs.readFile(new URL("../../assets/js/settings-page.js", import.meta.url), "utf8");
const deletionClientSource = await fs.readFile(new URL("../../assets/js/account-deletion-client.js", import.meta.url), "utf8");
const draftSource = await fs.readFile(new URL("../../assets/js/local-persistence.js", import.meta.url), "utf8");
const sample = (title = "Original", extra = {}) => ({
    id: "lesson-test", title, materialType: "quiz", scope: "library", draft: "{}",
    createdAt: "2026-09-30T10:00:00.000Z", updatedAt: "2026-09-30T10:00:00.000Z", ...extra
});

function storage() {
    const values = new Map();
    return {
        values, get length() { return values.size; },
        key: (index) => [...values.keys()][index] ?? null,
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key)
    };
}

function database() {
    const docs = new Map();
    const writes = [];
    let chain = Promise.resolve();
    const db = {
        docs, writes, failTransactions: false, beforeCommit: null,
        snapshot() {
            const entries = [...docs].map(([id, data]) => ({ id, data: () => structuredClone(data) }));
            return { forEach: (callback) => entries.forEach(callback) };
        },
        runTransaction(callback) {
            const operation = chain.then(async () => {
                if (db.failTransactions) throw new Error("Network unavailable");
                const pending = [];
                const transaction = {
                    get: async (ref) => ({ exists: docs.has(ref.id), data: () => structuredClone(docs.get(ref.id)) }),
                    set: (ref, value) => pending.push([ref.id, structuredClone(value)])
                };
                const result = await callback(transaction);
                if (db.beforeCommit) await db.beforeCommit();
                for (const [id, value] of pending) {
                    docs.set(id, value);
                    writes.push(id);
                }
                return result;
            });
            chain = operation.catch(() => {});
            return operation;
        }
    };
    return db;
}

function harness(db = database()) {
    const localStorage = storage();
    const events = [];
    let uid = "teacher-a";
    let activeId = "lesson-test";
    const collection = { firestore: db, get: async () => db.snapshot(), doc: (id) => ({ id }) };
    const context = vm.createContext({
        localStorage, crypto: { randomUUID }, console: { warn() {} }, navigator: { onLine: true },
        document: { dispatchEvent: (event) => events.push(event) },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
        materialGroupLabel: () => "Quiz", normalizeSearchText: (text) => String(text).toLowerCase(),
        readCurrentTeacher: () => ({ uid }),
        getAvailableClasses: () => ["8º Ano A", "8º Ano B", "9º Ano A"],
        readActiveLessonId: () => activeId, writeActiveLessonId: (value) => { activeId = value; },
        educariaScopedKey: (key) => `${key}:${uid}`,
        firebaseServices: () => ({ db: { collection: () => ({ doc: () => ({ collection: () => collection }) }) } })
    });
    vm.runInContext(source.slice(0, source.indexOf("function ensureLibraryToast")), context);
    const run = (code) => vm.runInContext(code, context);
    return {
        db, context, localStorage, collection, events, run,
        switchUser: (value) => { uid = value; },
        put(record, options = { skipSync: true }) {
            context.input = [record]; context.options = options;
            return run("writeLessonsLibrary(input, options)[0]");
        },
        local: () => JSON.parse(JSON.stringify(run("readLessonsLibrary()"))),
        syncOne() { return run("syncLessonRecordWithFirebase(readLessonsLibrary()[0])"); },
        sync: () => run("syncLessonsWithFirebase()")
    };
}

test("local quota failure propagates instead of returning a successful save", () => {
    const h = harness();
    h.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    assert.throws(() => h.put(sample()), /QuotaExceeded/);
    assert.equal(h.local().length, 0);
    assert.equal(h.events.at(-1).type, "educaria-storage-error");
});

test("an edit while the collection read is pending is preserved locally and remotely", async () => {
    const h = harness();
    h.put(sample());
    let release;
    h.collection.get = () => new Promise((resolve) => { release = resolve; });
    const pending = h.sync();
    h.put(sample("Nova edição", { updatedAt: "2026-09-30T11:00:00.000Z" }));
    release(h.db.snapshot());
    assert.equal((await pending).synced, true);
    assert.equal(h.local()[0].title, "Nova edição");
    assert.equal(h.db.docs.get("lesson-test").title, "Nova edição");
});

test("failed deletes retain their pending marker and succeed after reconnect", async () => {
    const h = harness();
    h.db.docs.set("lesson-test", sample());
    h.put(sample());
    h.run('queueDeletedLessonId("lesson-test"); writeLessonsLibrary([], {skipSync:true})');
    h.db.failTransactions = true;
    assert.equal((await h.sync()).synced, false);
    assert.equal(h.run("readDeletedLessonIds().length"), 1);
    assert.equal(h.local().length, 0);
    h.db.failTransactions = false;
    assert.equal((await h.sync()).synced, true);
    assert.equal(h.run("readDeletedLessonIds().length"), 0);
    assert.ok(h.db.docs.get("lesson-test").deletedAt);
    await h.sync();
    assert.equal(h.local().length, 0);
});

test("confirming one deletion does not discard another deletion queued during the request", async () => {
    const h = harness();
    h.run('queueDeletedLessonId("first")');
    h.db.beforeCommit = async () => {
        h.db.beforeCommit = null;
        h.run('queueDeletedLessonId("second")');
    };
    assert.equal((await h.sync()).synced, false);
    assert.equal(h.run('JSON.stringify(readDeletedLessonIds())'), '["second"]');
    assert.equal((await h.sync()).synced, true);
    assert.ok(h.db.docs.get("first").deletedAt);
    assert.ok(h.db.docs.get("second").deletedAt);
});

test("an unavailable cloud read leaves the local library intact and returns failure", async () => {
    const h = harness();
    h.put(sample("Ainda no dispositivo"));
    h.collection.get = async () => { throw new Error("Cloud unavailable"); };
    const result = await h.sync();
    assert.equal(result.synced, false);
    assert.ok(result.error);
    assert.equal(h.local()[0].title, "Ainda no dispositivo");
});

test("a stale offline device cannot resurrect a deleted material ID", async () => {
    const h = harness();
    h.put(sample("Cópia antiga", { syncRevision: "r1" }), { skipSync: true, source: "firebase" });
    h.db.docs.set("lesson-test", { id: "lesson-test", deletedAt: "2026-09-30T11:00:00.000Z" });
    await h.sync();
    assert.equal(h.local().length, 0);
    assert.ok(h.db.docs.get("lesson-test").deletedAt);
});

test("unsynced edits to a remotely deleted material are recovered under a new ID", async () => {
    const h = harness();
    h.put(sample("Minha edição", { syncRevision: "r1" }));
    h.db.docs.set("lesson-test", { deletedAt: "2026-09-30T11:00:00.000Z" });
    await h.sync();
    assert.equal(h.local().length, 1);
    assert.notEqual(h.local()[0].id, "lesson-test");
    assert.match(h.local()[0].title, /edição recuperada/);
    assert.ok(h.db.docs.get("lesson-test").deletedAt);
});

test("unchanged synchronized records do not generate writes on page load", async () => {
    const h = harness();
    const normalized = h.put(sample("Original", { syncRevision: "r1" }), { skipSync: true, source: "firebase" });
    h.db.docs.set(normalized.id, normalized);
    assert.equal((await h.sync()).synced, true);
    assert.equal(h.db.writes.length, 0);
});

test("concurrent devices preserve the conflicting remote version atomically", async () => {
    const db = database();
    const a = harness(db);
    const b = harness(db);
    const initial = a.put(sample("Inicial", { syncRevision: "r1" }), { skipSync: true, source: "firebase" });
    b.put(initial, { skipSync: true, source: "firebase" });
    db.docs.set(initial.id, initial);
    a.put({ ...initial, title: "Edição A" });
    b.put({ ...initial, title: "Edição B" });
    await a.syncOne();
    const result = await b.syncOne();
    assert.equal(result.conflict, true);
    const titles = [...db.docs.values()].map((doc) => doc.title);
    assert.ok(titles.includes("Edição B"));
    assert.ok(titles.includes("Edição A (versão preservada)"));
    assert.equal(b.local().length, 2);
});

test("edits made during a transaction are not marked synchronized", async () => {
    const h = harness();
    h.put(sample("Primeira edição"));
    h.db.beforeCommit = async () => {
        h.db.beforeCommit = null;
        h.put(sample("Mais recente"));
    };
    assert.equal((await h.syncOne()).synced, false);
    assert.equal(h.local()[0].title, "Mais recente");
    assert.equal(h.local()[0]._pendingSync, true);
    assert.equal((await h.syncOne()).synced, true);
    assert.equal(h.db.docs.get("lesson-test").title, "Mais recente");
    assert.equal(h.db.docs.size, 1);
});

test("a failed transaction does not claim cloud success or clear the local edit", async () => {
    const h = harness();
    h.put(sample());
    h.db.failTransactions = true;
    const result = await h.syncOne();
    assert.equal(result.synced, false);
    assert.ok(result.error);
    assert.equal(h.local()[0]._pendingSync, true);
});

test("late data from one account cannot enter another account's local library", async () => {
    const h = harness();
    h.db.docs.set("lesson-test", sample());
    let release;
    h.collection.get = () => new Promise((resolve) => { release = resolve; });
    const pending = h.sync();
    h.switchUser("teacher-b");
    release(h.db.snapshot());
    assert.equal((await pending).synced, false);
    assert.equal(h.local().length, 0);
});

test("an old collection snapshot cannot overwrite an autosave that already committed", async () => {
    const h = harness();
    h.put(sample());
    await h.syncOne();
    const oldSnapshot = h.db.snapshot();
    let release;
    h.collection.get = () => new Promise((resolve) => { release = resolve; });
    const pending = h.sync();
    h.put({ ...h.local()[0], title: "Última edição" });
    await h.syncOne();
    release(oldSnapshot);
    await pending;
    assert.equal(h.local()[0].title, "Última edição");
});

test("account cleanup removes only the deleted teacher's local data", () => {
    const localStorage = storage();
    for (const uid of ["teacher-a", "teacher-b"]) {
        localStorage.setItem(`educaria:lessons:${uid}`, uid);
        localStorage.setItem(`educaria:milestone:${uid}:created`, "true");
    }
    localStorage.setItem("educaria:auth:teacher-cache", JSON.stringify({ uid: "teacher-a" }));
    localStorage.setItem("educaria:auth:session", "test-a@example.com");
    localStorage.setItem("educaria:analytics:events", JSON.stringify([{ teacherUid: "teacher-a" }, { teacherUid: "teacher-b" }]));
    const context = vm.createContext({ localStorage, window: {}, document: { querySelectorAll: () => [] } });
    vm.runInContext(deletionClientSource, context);
    const start = settingsSource.indexOf("function clearSettingsLocalAccountData(");
    const end = settingsSource.indexOf("async function handleSettingsDeleteSubmit", start);
    vm.runInContext(settingsSource.slice(start, end), context);
    vm.runInContext('clearSettingsLocalAccountData("teacher-a")', context);
    assert.equal(localStorage.getItem("educaria:lessons:teacher-a"), null);
    assert.equal(localStorage.getItem("educaria:lessons:teacher-b"), "teacher-b");
    assert.equal(localStorage.getItem("educaria:milestone:teacher-b:created"), "true");
    assert.equal(localStorage.getItem("educaria:auth:session"), null);
    assert.deepEqual(JSON.parse(localStorage.getItem("educaria:analytics:events")), [{ teacherUid: "teacher-b" }]);
});

test("draft autosave reports quota failures and exposes a recovery event", () => {
    const events = [];
    const context = vm.createContext({
        document: { querySelector: () => ({ innerHTML: "<p>Minha edição</p>" }), dispatchEvent: (event) => events.push(event) },
        localStorage: { setItem() { throw new Error("QuotaExceededError"); } },
        console: { warn() {} }, persistMaterializedFields() {}, captureControls: () => ({}),
        CustomEvent: class { constructor(type) { this.type = type; } }
    });
    vm.runInContext(draftSource.slice(draftSource.indexOf("function saveBuilderState("), draftSource.indexOf("function restoreBuilderState(")), context);
    const result = vm.runInContext('saveBuilderState({ key: "draft", stackSelector: "[data-slides-stack]" })', context);
    assert.equal(result.saved, false);
    assert.equal(events.at(-1).type, "educaria-storage-error");
});

test("saving in multiple classes creates independent IDs without changing the library original", () => {
    const h = harness();
    h.put(sample());
    h.run('saveLessonToDestinations(readLessonsLibrary()[0], [{scope:"class",className:"8º Ano A"},{scope:"class",className:"8º Ano B"}], {updateSource:false})');
    assert.equal(h.local().length, 3);
    assert.equal(new Set(h.local().map((record) => record.id)).size, 3);
    assert.equal(h.local().find((record) => record.id === "lesson-test").scope, "library");
    assert.deepEqual(h.local().filter((record) => record.scope === "class").map((record) => record.className).sort(), ["8º Ano A", "8º Ano B"]);
});

test("explicit save updates only the source destination and creates new copies for the others", () => {
    const h = harness();
    h.put(sample("Original", {scope:"class",className:"8º Ano A",syncRevision:"r1"}));
    h.run('saveLessonToDestinations({...readLessonsLibrary()[0],title:"Revisado"}, [{scope:"class",className:"8º Ano A"},{scope:"class",className:"8º Ano B"},{scope:"library"}], {markReady:true})');
    assert.equal(h.local().length, 3);
    assert.equal(h.local().find((record) => record.id === "lesson-test").className, "8º Ano A");
    assert.ok(h.local().every((record) => record.title === "Revisado" && record.status === "ready"));
    assert.ok(h.local().filter((record) => record.id !== "lesson-test").every((record) => record.syncRevision === ""));
});

test("duplicate destinations are deduplicated and invalid selections leave storage unchanged", () => {
    const h = harness();
    h.put(sample());
    assert.throws(() => h.run('saveLessonToDestinations(readLessonsLibrary()[0], [{scope:"class",className:"Turma removida"}])'));
    assert.throws(() => h.run('saveLessonToDestinations(readLessonsLibrary()[0], [])'));
    assert.equal(h.local().length, 1);
    h.run('saveLessonToDestinations(readLessonsLibrary()[0], [{scope:"class",className:"8º Ano A"},{scope:"class",className:"8º Ano A"}])');
    assert.equal(h.local().length, 2);
});

test("teachers without classes can still save to their personal library", () => {
    const h = harness();
    h.context.getAvailableClasses = () => [];
    h.context.input = sample();
    h.run('saveLessonToDestinations(input,[{scope:"library"}])');
    assert.equal(h.local().length, 1);
    assert.equal(h.local()[0].scope, "library");
});

test("building an existing class material does not move it to the last selected class", () => {
    const h = harness();
    h.put(sample("Original", {scope:"class",className:"8º Ano A"}));
    Object.assign(h.context, {
        currentClassName:()=>"8º Ano B", forceSyncDraftFromPage(){},
        summarizeCurrentDraft:()=>({rawDraft:"{}",summary:{title:"Atualizado",summary:"",type:"Quiz"},materialType:"quiz"})
    });
    h.context.document.getElementById=()=>null;
    const start=source.indexOf("function buildLessonRecord(");
    const end=source.indexOf("function persistLessonRecord(",start);
    vm.runInContext(source.slice(start,end),h.context);
    assert.equal(h.run('buildLessonRecord("quiz","class").className'),"8º Ano A");
    assert.equal(h.run('buildLessonRecord("quiz","class").id'),"lesson-test");
});

test("multi-destination local quota failure is atomic", () => {
    const h = harness();
    h.put(sample());
    h.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
    assert.throws(() => h.run('saveLessonToDestinations(readLessonsLibrary()[0],[{scope:"class",className:"8º Ano A"},{scope:"class",className:"8º Ano B"}])'), /QuotaExceeded/);
    assert.equal(h.local().length, 1);
});

test("retrying pending multi-class sync uses the same records and does not duplicate copies", async () => {
    const h = harness();
    h.put(sample());
    h.run('saveLessonToDestinations(readLessonsLibrary()[0],[{scope:"class",className:"8º Ano A"},{scope:"class",className:"8º Ano B"}])');
    const ids = h.local().map((record) => record.id).sort();
    h.db.failTransactions = true;
    assert.equal((await h.sync()).synced, false);
    h.db.failTransactions = false;
    assert.equal((await h.sync()).synced, true);
    assert.deepEqual(h.local().map((record) => record.id).sort(), ids);
    assert.equal(h.db.docs.size, 3);
});
