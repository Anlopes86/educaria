import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const client = await readFile(new URL("../../assets/js/beta-access.js", import.meta.url), "utf8");
const authSource = await readFile(new URL("../../assets/js/auth-flow.js", import.meta.url), "utf8");
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
function clientHarness() {
    const user = { uid: "teacher", getIdToken: async () => "id-token" };
    const auth = { currentUser: user };
    const calls = [];
    const context = { AbortSignal, Map, location: { pathname: "/educaria/plataforma/index.html" },
        firebaseServices: () => ({ auth }),
        document: { body: { dataset: {} }, readyState: "loading", addEventListener() {} },
        window: { educariaAppCheckHeaders: async () => ({ "X-Firebase-AppCheck": "app-token" }), educariaAiEndpoint: path => `https://example.invalid${path}` },
        fetch: async (path, options) => { calls.push({ path, options }); return { ok: true, json: async () => ({ ok: true, access: { status: "approved" } }) }; }
    };
    vm.runInNewContext(client, context);
    return { context, user, auth, calls, api: context.window.educariaBetaAccess };
}
test("beta client deduplicates enrollment and sends Auth plus App Check without private query data", async () => {
    const h = clientHarness();
    await Promise.all([h.api.enroll(h.user), h.api.requireAccess(h.user)]);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].path, "https://example.invalid/api/beta/enroll");
    assert.equal(h.calls[0].options.headers.Authorization, "Bearer id-token");
    assert.equal(h.calls[0].options.headers["X-Firebase-AppCheck"], "app-token");
    assert.equal(h.calls[0].options.cache, "no-store");
    assert.equal(h.calls[0].options.method, "POST");
    assert.equal(h.api.waitlistPath(), "../lista-espera.html");
});
test("waiting users cannot enter via requireAccess; failures remain retryable", async () => {
    const h = clientHarness();
    h.context.fetch = async () => ({ ok: true, json: async () => ({ ok: true, access: { status: "waitlisted" } }) });
    await assert.rejects(h.api.requireAccess(h.user), { code: "beta_waitlisted" });
    h.context.fetch = async () => ({ ok: false });
    await assert.rejects(h.api.enroll(h.user), { code: "beta_unavailable" });
    h.context.fetch = async () => ({ ok: true, json: async () => ({ ok: true, access: { status: "approved" } }) });
    assert.equal((await h.api.enroll(h.user)).status, "approved");
});
test("account switching discards an old enrollment response", async () => {
    const h = clientHarness(); let complete;
    h.context.fetch = async () => new Promise(resolve => { complete = resolve; });
    const result = h.api.enroll(h.user); await pause();
    h.auth.currentUser = { uid: "another" };
    complete({ ok: true, json: async () => ({ ok: true, access: { status: "approved" } }) });
    await assert.rejects(result, { code: "auth/session-changed" });
});

function authHarness({ exists = false, denied = false, waitlisted = false } = {}) {
    const listeners = {}, fields = { name: "Professor", email: "teacher@example.invalid", institution: "Escola", password: "test-password", password_confirm: "test-password" };
    const submit = { disabled: false }, feedback = { dataset: {} };
    const calls = { created: 0, read: 0, saved: 0, enrolled: 0, feedback: [] };
    const form = { querySelector: selector => selector === '[type="submit"]' ? submit : { value: fields[/name="(.*?)"/.exec(selector)?.[1]] },
        addEventListener: (name, fn) => { listeners[name] = fn; } };
    const storage = new Map();
    const user = { uid: "teacher", email: fields.email, displayName: fields.name, updateProfile: async () => {} };
    const auth = { currentUser: user, createUserWithEmailAndPassword: async () => { calls.created++; return { user }; } };
    const ref = { get: async () => {
        calls.read++;
        if (denied && calls.read === 1) throw Object.assign(new Error("blocked"), { code: "permission-denied" });
        return { exists, data: () => ({ name: fields.name }) };
    }, set: async () => { calls.saved++; exists = true; } };
    const location = { pathname: "/educaria/cadastro.html", search: "", origin: "https://example.invalid", replace(path) { this.replaced = path; } };
    const window = { location, addEventListener() {} };
    const context = vm.createContext({ window, URL, URLSearchParams, console, document: { currentScript: null,
        body: { dataset: { authPage: "true", authScreen: "register" } }, addEventListener() {}, dispatchEvent() {},
        querySelector: selector => selector === "[data-register-form]" ? form : selector === "[data-auth-feedback]" ? feedback : null },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
    });
    vm.runInContext(authSource, context);
    context.firebaseServices = () => ({ auth, db: { collection: () => ({ doc: () => ref }) } });
    context.educariaTrack = () => {}; context.notifyAuthChanged = () => {};
    window.educariaBetaAccess = { waitlistPath: () => "lista-espera.html", requireAccess: async () => {
        calls.enrolled++; if (waitlisted) throw Object.assign(Error("Lista de espera"), { code: "beta_waitlisted" }); return { status: "approved" };
    } };
    return { context, window, calls, user, auth, submit, feedback, listeners, storage };
}
test("existing accessible profiles remain usable without waking up the API", async () => {
    const h = authHarness({ exists: true });
    assert.equal((await h.context.readTeacherProfileFromFirebase(h.user)).uid, "teacher");
    assert.equal(h.calls.enrolled, 0);
});
test("new and permission-denied profiles must pass admission before loading", async () => {
    const h = authHarness({ denied: true, waitlisted: true });
    await assert.rejects(h.context.readTeacherProfileFromFirebase(h.user), { code: "beta_waitlisted" });
    assert.equal(h.calls.read, 1); assert.equal(h.calls.enrolled, 1);
    assert.equal(h.context.handleBetaWaitlist({ code: "beta_waitlisted" }), true);
    assert.equal(h.window.location.replaced, "lista-espera.html");
});
test("registration cannot double-submit or save teacher content for a waiting account", async () => {
    const h = authHarness({ waitlisted: true }); h.context.bindRegisterForm();
    await Promise.all([h.listeners.submit({ preventDefault() {} }), h.listeners.submit({ preventDefault() {} })]);
    assert.equal(h.calls.created, 1); assert.equal(h.calls.saved, 0);
    assert.equal(h.window.location.replaced, "lista-espera.html");
    assert.equal(h.submit.disabled, false);
});
test("accepted registration saves the profile after admission and enters the dashboard", async () => {
    const h = authHarness(); h.context.bindRegisterForm();
    await h.listeners.submit({ preventDefault() {} });
    assert.equal(h.calls.created, 1); assert.equal(h.calls.enrolled, 1); assert.equal(h.calls.saved, 1);
    assert.equal(h.window.location.href, "plataforma/index.html");
});
