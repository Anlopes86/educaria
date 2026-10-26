import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../assets/js/app-security.js", import.meta.url), "utf8");
function setup({ activationFails = false, tokenFails = false } = {}) {
    const calls = [];
    const logs = [];
    let observer;
    const instance = {
        activate(provider, refresh) {
            calls.push({ key: provider.key, refresh });
            if (activationFails) throw new Error("private provider details");
        },
        onTokenChanged(value) { observer = value; },
        async getToken(refresh) {
            calls.push({ refresh });
            if (tokenFails) throw new Error("private provider details");
            return { token: "private-attestation-token" };
        }
    };
    const firebase = { appCheck: () => instance };
    firebase.appCheck.ReCaptchaEnterpriseProvider = class { constructor(key) { this.key = key; } };
    const window = {};
    vm.runInNewContext(source, { window, firebase, document: { addEventListener() {} },
        console: { debug: (...args) => logs.push(args), warn: (...args) => logs.push(args) } });
    return { window, calls, logs, observer: () => observer };
}

test("App Check activates once with automatic refresh and sends the cached attestation", async () => {
    const { window, calls, logs, observer } = setup();
    window.educariaInitializeAppCheck();
    window.educariaInitializeAppCheck();
    assert.equal(calls.length, 1);
    assert.match(calls[0].key, /^6L/);
    assert.equal(calls[0].refresh, true);
    observer().next({ token: "private-attestation-token" });
    const headers = await window.educariaAppCheckHeaders();
    assert.equal(headers["X-Firebase-AppCheck"], "private-attestation-token");
    assert.equal(calls[1].refresh, false);
    assert.ok(!JSON.stringify(logs).includes("private"));
});

test("unavailable attestation never fabricates a token or logs provider details", async () => {
    const { window, logs, observer } = setup({ tokenFails: true });
    window.educariaInitializeAppCheck();
    observer().error(new Error("private provider details"));
    assert.equal(Object.keys(await window.educariaAppCheckHeaders()).length, 0);
    assert.ok(!JSON.stringify(logs).includes("private"));
});

test("activation failure preserves access to manual features without a fake token", async () => {
    const { window, logs } = setup({ activationFails: true });
    assert.doesNotThrow(() => window.educariaInitializeAppCheck());
    assert.equal(Object.keys(await window.educariaAppCheckHeaders()).length, 0);
    assert.ok(!JSON.stringify(logs).includes("private"));
});
