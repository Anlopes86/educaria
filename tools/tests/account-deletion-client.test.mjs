import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
const source = await fs.readFile(new URL("../../assets/js/account-deletion-client.js", import.meta.url), "utf8");
function fixture() {
    const values = new Map();
    const calls = [];
    const user = { uid: "teacher-a", getIdToken: async (force) => { assert.equal(force, true); return "synthetic-token"; } };
    const auth = { currentUser: user };
    const localStorage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
    };
    let respond = async () => ({ status: 202, json: async () => ({ ok: true, status: "pending" }) });
    const context = vm.createContext({
        window: { educariaAiEndpoint: (path) => `https://api.example.invalid${path}` },
        document: { querySelectorAll: () => [] }, localStorage, crypto: webcrypto,
        AbortSignal: { timeout: () => undefined },
        fetch: async (url, options) => {
            assert.ok(values.get("educaria:account-deletion:pending"), "receipt must exist before request");
            calls.push({ url, options }); return respond();
        }
    });
    vm.runInContext(source, context);
    return { client: context.window.educariaAccountDeletion, user, auth, calls, values, localStorage, response: (fn) => { respond = fn; } };
}
test("client records receipt before sending and never sends password or target UID", async () => {
    const f = fixture();
    const pending = await f.client.start(f.user, f.auth);
    assert.match(pending.receipt, /^[a-f0-9]{64}$/);
    const { options } = f.calls[0];
    assert.equal(options.headers.Authorization, "Bearer synthetic-token");
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ["confirmation", "receipt", "version"]);
    assert.equal(body.confirmation, "EXCLUIR");
});
test("network loss preserves the original receipt and retry reuses it", async () => {
    const f = fixture();
    f.response(async () => { throw new Error("lost response"); });
    await assert.rejects(f.client.start(f.user, f.auth), { deletionPending: true });
    const receipt = f.client.read().receipt;
    await assert.rejects(f.client.start(f.user, f.auth), { deletionPending: true });
    assert.equal(f.client.read().receipt, receipt);
});
test("disabled feature removes only a new receipt; unknown server errors retain it", async () => {
    const f = fixture();
    f.response(async () => ({ status: 503, json: async () => ({ code: "deletion_unavailable", error: "Not enabled" }) }));
    await assert.rejects(f.client.start(f.user, f.auth), { confirmedRejection: true });
    assert.equal(f.client.read(), null);
    f.response(async () => ({ status: 503, json: async () => ({ code: "deletion_uncertain" }) }));
    await assert.rejects(f.client.start(f.user, f.auth), { deletionPending: true });
    assert.ok(f.client.read());
});
test("account switching and local storage failure prevent any server request", async () => {
    const f = fixture();
    f.auth.currentUser = { uid: "teacher-b" };
    await assert.rejects(f.client.start(f.user, f.auth));
    assert.equal(f.calls.length, 0);
    f.auth.currentUser = f.user;
    f.localStorage.setItem = () => { throw new Error("quota"); };
    await assert.rejects(f.client.start(f.user, f.auth));
    assert.equal(f.calls.length, 0);
});
test("another account cannot overwrite the existing status receipt", async () => {
    const f = fixture();
    await f.client.start(f.user, f.auth);
    const other = { ...f.user, uid: "teacher-b" };
    f.auth.currentUser = other;
    await assert.rejects(f.client.start(other, f.auth));
    assert.equal(f.client.read().uid, "teacher-a");
    assert.equal(f.calls.length, 1);
});
