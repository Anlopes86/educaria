import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(new URL("../../assets/js/ai-endpoint-config.js", import.meta.url), "utf8");
function setup() {
    const calls = [];
    const user = { uid: "teacher", getIdToken: async () => { calls.push("auth"); return "id-token"; } };
    const auth = { currentUser: user };
    const window = { location: { hostname: "anlopes86.github.io", protocol: "https:" },
        educariaRequireVerifiedEmail: async () => { calls.push("email"); },
        educariaAppCheckHeaders: async () => { calls.push("app"); return { "X-Firebase-AppCheck": "app-token" }; } };
    vm.runInNewContext(source, { window, firebaseServices: () => ({ auth }) });
    return { window, auth, calls };
}
test("generation preflights verified email and sends both independent tokens", async () => {
    const { window, calls } = setup();
    const headers = await window.educariaAiAuthHeaders({ generation: true });
    assert.deepEqual(calls, ["email", "app", "auth"]);
    assert.equal(headers.Authorization, "Bearer id-token"); assert.equal(headers["X-Firebase-AppCheck"], "app-token");
});
test("credit reads stay available before email verification; account switching aborts", async () => {
    const { window, auth, calls } = setup();
    await window.educariaAiAuthHeaders(); assert.ok(!calls.includes("email"));
    window.educariaAppCheckHeaders = async () => { auth.currentUser = { uid: "other" }; return {}; };
    await assert.rejects(window.educariaAiAuthHeaders(), /conta mudou/);
});
test("unverified account never obtains generation request headers", async () => {
    const { window, calls } = setup();
    window.educariaRequireVerifiedEmail = async () => { throw new Error("Confirme seu e-mail"); };
    await assert.rejects(window.educariaAiAuthHeaders({ generation: true }), /Confirme/);
    assert.deepEqual(calls, []);
});
