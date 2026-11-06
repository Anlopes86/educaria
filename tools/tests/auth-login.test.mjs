import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../assets/js/auth-flow.js", import.meta.url), "utf8");
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function harness({ screen = "login", delayedConfig = false } = {}) {
    const events = {}, formEvents = {}, storage = new Map(), timers = new Map();
    const calls = { signIn: 0, persistence: 0, reads: 0, enrolled: 0, navigation: [], notifications: 0 };
    const feedback = { hidden: true, textContent: "", dataset: {}, getAttribute() {}, setAttribute() {} };
    const submit = { disabled: false };
    const fields = { email: { value: "teacher@example.invalid" }, password: { value: "example-password" } };
    const form = { dataset: {}, attributes: {},
        querySelector(selector) { return selector === '[type="submit"]' ? submit : fields[/name="(.*?)"/.exec(selector)?.[1]]; },
        addEventListener(name, fn) { formEvents[name] = fn; },
        setAttribute(key, value) { this.attributes[key] = value; },
        removeAttribute(key) { delete this.attributes[key]; }
    };
    const user = { uid: "teacher", email: fields.email.value, displayName: "Professor" };
    let observer;
    const persistence = deferred(); persistence.resolve();
    const config = deferred(); if (!delayedConfig) config.resolve();
    const ref = { async get() { calls.reads++; return { exists: true, data: () => ({ name: "Professor" }) }; } };
    const auth = { currentUser: null,
        setPersistence() { calls.persistence++; return persistence.promise; },
        onAuthStateChanged(fn) { observer = fn; },
        async signInWithEmailAndPassword() {
            calls.signIn++;
            this.currentUser = user;
            if (observer) void observer(user);
            return { user };
        }
    };
    const firebase = { apps: [{}], auth: () => auth, firestore: () => ({ collection: () => ({ doc: () => ref }) }) };
    firebase.auth.Auth = { Persistence: { LOCAL: "local" } };
    const location = { pathname: screen === "dashboard" ? "/educaria/plataforma/index.html" : "/educaria/login.html",
        origin: "https://example.invalid", search: "", replace(path) { calls.navigation.push(path); },
        set href(path) { calls.navigation.push(path); }
    };
    const document = {
        currentScript: null, body: { dataset: screen === "dashboard" ? { requiresAuth: "true" } : { authPage: "true", authScreen: screen } },
        querySelector(selector) { return selector === "[data-login-form]" ? form : selector === "[data-auth-feedback]" ? feedback : null; },
        querySelectorAll() { return []; },
        addEventListener(name, fn) { (events[name] ||= []).push(fn); }, dispatchEvent() { calls.notifications++; }
    };
    let timerId = 0;
    const window = { location, educariaFirebaseConfigReady: config.promise,
        EDUCARIA_FIREBASE_CONFIG: Object.fromEntries(["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"].map(key => [key, "public-test-config"])),
        addEventListener() {}, setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
        clearTimeout(id) { timers.delete(id); }, clearInterval() {}, setInterval() { return 1; }
    };
    const context = vm.createContext({ window, document, firebase, console: { warn() {}, error() {} },
        URL, URLSearchParams, CustomEvent: class { constructor(type, details) { this.type = type; this.detail = details; } },
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
    });
    vm.runInContext(source, context);
    context.educariaTrack = () => {};
    context.scheduleEducariaAnalyticsAutoFlush = () => {};
    window.educariaBetaAccess = { waitlistPath: () => "lista-espera.html", async requireAccess() { calls.enrolled++; return { status: "approved" }; } };
    return { context, window, document, form, submit, feedback, calls, auth, user, ref, persistence, config, storage, timers,
        submitForm: () => formEvents.submit({ preventDefault() {} }),
        boot: () => events.DOMContentLoaded[0](),
        emitAuth: value => { auth.currentUser = value; return observer(value); },
        expire() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); }
    };
}

test("first submit is captured while configuration loads and waits for persistence", async () => {
    const h = harness({ delayedConfig: true });
    const persistence = deferred(); h.auth.setPersistence = () => { h.calls.persistence++; return persistence.promise; };
    const boot = h.boot();
    const login = h.submitForm();
    assert.equal(h.submit.disabled, true);
    assert.equal(h.form.attributes["aria-busy"], "true");
    assert.equal(h.calls.signIn, 0);
    h.config.resolve(); await boot; await tick();
    assert.equal(h.calls.signIn, 0);
    persistence.resolve(); await login;
    assert.equal(h.calls.signIn, 1);
    assert.equal(h.calls.reads, 1);
    assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
    h.context.firebaseServices(); h.context.firebaseServices(); await tick();
    assert.equal(h.calls.persistence, 1);
    assert.equal(h.submit.disabled, false);
});

test("submit and auth observer do not compete; double-click does not log in twice", async () => {
    const h = harness(); await h.boot();
    const profile = deferred(); h.ref.get = () => { h.calls.reads++; return profile.promise; };
    const login = h.submitForm(); await tick();
    await h.submitForm();
    assert.equal(h.calls.signIn, 1); assert.equal(h.calls.reads, 1);
    assert.match(h.feedback.textContent, /Conferindo seu acesso/);
    profile.resolve({ exists: true, data: () => ({ name: "Professor" }) }); await login;
    assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
});

test("temporary profile failure is retried in the same login without reload or admission call", async () => {
    const h = harness(); await h.boot();
    h.ref.get = async () => {
        if (++h.calls.reads === 1) throw Object.assign(Error("temporary"), { code: "unavailable" });
        return { exists: true, data: () => ({ name: "Professor" }) };
    };
    await h.submitForm();
    assert.equal(h.calls.reads, 2); assert.equal(h.calls.enrolled, 0);
    assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
});

test("a stalled profile read retries and a late first result cannot overwrite the session", async () => {
    const h = harness(); await h.boot();
    const old = deferred();
    h.ref.get = async () => ++h.calls.reads === 1 ? old.promise : { exists: true, data: () => ({ name: "Current profile" }) };
    const login = h.submitForm(); await tick();
    h.expire(); await login;
    old.resolve({ exists: true, data: () => ({ name: "Late profile" }) }); await tick();
    assert.equal(h.calls.reads, 2);
    assert.equal(JSON.parse(h.storage.get("educaria:auth:teacher-cache")).name, "Current profile");
    assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
});

test("repeated connection stalls end with actionable feedback and the same form can retry", async () => {
    const h = harness(); await h.boot();
    h.ref.get = () => { h.calls.reads++; return new Promise(() => {}); };
    const login = h.submitForm(); await tick(); h.expire(); await tick(); h.expire(); await login;
    assert.equal(h.submit.disabled, false);
    assert.equal(h.calls.navigation.length, 0);
    assert.equal(h.feedback.dataset.state, "error");
    assert.match(h.feedback.textContent, /não é necessário atualizar/);
    h.ref.get = async () => ({ exists: true, data: () => ({ name: "Professor" }) });
    await h.submitForm(); assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
});

test("wrong credentials are not retried automatically and do not leave the form busy", async () => {
    const h = harness(); await h.boot();
    h.auth.signInWithEmailAndPassword = async () => { h.calls.signIn++; throw Object.assign(Error("credentials"), { code: "auth/invalid-credential" }); };
    await h.submitForm();
    assert.equal(h.calls.signIn, 1); assert.equal(h.calls.reads, 0);
    assert.equal(h.submit.disabled, false); assert.equal(h.form.attributes["aria-busy"], undefined);
    assert.match(h.feedback.textContent, /Email ou senha incorretos/);
});

test("dashboard waits for restored Firebase identity instead of trusting a missing local cache", async () => {
    const h = harness({ screen: "dashboard" }); await h.boot();
    assert.deepEqual(h.calls.navigation, []);
    await h.emitAuth(h.user);
    assert.equal(JSON.parse(h.storage.get("educaria:auth:teacher-cache")).uid, h.user.uid);
    assert.deepEqual(h.calls.navigation, []);
    await h.emitAuth(null);
    assert.match(h.calls.navigation[0], /^\.\.\/login.html\?next=/);
    assert.equal(h.storage.has("educaria:auth:teacher-cache"), false);
});

test("an old restore result cannot redirect or erase feedback during an explicit login", async () => {
    const h = harness(); await h.boot();
    const old = deferred(); h.ref.get = () => old.promise;
    const restore = h.emitAuth(h.user); await tick();
    h.ref.get = async () => ({ exists: true, data: () => ({ name: "New session" }) });
    await h.submitForm();
    old.reject(Object.assign(Error("denied"), { code: "beta_waitlisted" })); await restore;
    assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
    assert.equal(JSON.parse(h.storage.get("educaria:auth:teacher-cache")).name, "New session");
});

test("permission denied still requires admission and a waitlisted user cannot enter", async () => {
    const h = harness(); await h.boot();
    h.ref.get = async () => { h.calls.reads++; throw Object.assign(Error("denied"), { code: "permission-denied" }); };
    h.window.educariaBetaAccess.requireAccess = async () => { h.calls.enrolled++; throw Object.assign(Error("Lista de espera"), { code: "beta_waitlisted" }); };
    await h.submitForm();
    assert.equal(h.calls.reads, 1); assert.equal(h.calls.enrolled, 1);
    assert.deepEqual(h.calls.navigation, ["lista-espera.html"]);
    assert.equal(h.storage.has("educaria:auth:teacher-cache"), false);
});

test("signing out while a profile loads cannot restore the previous account", async () => {
    const h = harness(); await h.boot();
    h.storage.set("educaria:auth:teacher-cache", JSON.stringify({ uid: "previous-account" }));
    h.storage.set("educaria:auth:session", "previous@example.invalid");
    const profile = deferred(); h.ref.get = () => profile.promise;
    const login = h.submitForm(); await tick();
    await h.emitAuth(null);
    profile.resolve({ exists: true, data: () => ({ name: "Previous account" }) }); await login;
    assert.deepEqual(h.calls.navigation, []);
    assert.equal(h.storage.has("educaria:auth:teacher-cache"), false);
    assert.equal(h.storage.has("educaria:auth:session"), false);
    assert.equal(h.submit.disabled, false);
});

test("expired-session notification clears old account cache even when an in-flight login fails", async () => {
    const h = harness(); await h.boot();
    h.storage.set("educaria:auth:teacher-cache", JSON.stringify({ uid: "expired-user" }));
    h.storage.set("educaria:auth:session", "expired@example.invalid");
    const signIn = deferred(); h.auth.signInWithEmailAndPassword = () => signIn.promise;
    const login = h.submitForm(); await tick();
    await h.emitAuth(null);
    signIn.reject(Object.assign(Error("wrong"), { code: "auth/invalid-credential" })); await login;
    assert.equal(h.storage.has("educaria:auth:teacher-cache"), false);
    assert.equal(h.storage.has("educaria:auth:session"), false);
    assert.match(h.feedback.textContent, /Email ou senha incorretos/);
    assert.deepEqual(h.calls.navigation, []);
});

test("initial signed-out notification does not cancel a successful first submit", async () => {
    const h = harness(); await h.boot();
    const signIn = deferred(); h.auth.signInWithEmailAndPassword = () => signIn.promise;
    const login = h.submitForm(); await tick();
    await h.emitAuth(null);
    h.auth.currentUser = h.user; signIn.resolve({ user: h.user }); await login;
    assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
    assert.equal(JSON.parse(h.storage.get("educaria:auth:teacher-cache")).uid, h.user.uid);
});

test("unavailable persistent storage does not repeatedly reset authentication", async () => {
    const h = harness();
    h.auth.setPersistence = async () => { h.calls.persistence++; throw Error("storage blocked"); };
    await h.boot(); await h.submitForm();
    h.context.firebaseServices(); await tick();
    assert.equal(h.calls.persistence, 1);
    assert.deepEqual(h.calls.navigation, ["plataforma/index.html"]);
});
