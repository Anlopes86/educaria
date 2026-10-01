import assert from "node:assert/strict";
import { test } from "node:test";
import { createFirebaseServices, parseAdminCredentials, sessionErrorResponse, verifyActiveSession } from "../firebase-admin-services.js";

test("production rejects emulator configuration rather than accepting emulator tokens", () => {
    assert.throws(createFirebaseServices({ NODE_ENV: "production", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" }), { code: "admin/configuration-error" });
});

test("Admin verification always requests revocation and disabled-account checks", async () => {
    const calls = [];
    const services = {
        auth: { verifyIdToken: async (...args) => { calls.push(args); return { uid: "teacher-a" }; } },
        db: { collection: (name) => { assert.equal(name, "accountDeletionJobs"); return {
            doc: (uid) => { assert.equal(uid, "teacher-a"); return { get: async () => ({ exists: false }) }; }
        }; } }
    };
    assert.equal((await verifyActiveSession("synthetic-token", () => services)).uid, "teacher-a");
    assert.deepEqual(calls, [["synthetic-token", true]]);
});

test("revoked, disabled, deleted or malformed sessions are rejected; outages fail closed with 503", async () => {
    for (const code of ["auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found", "auth/argument-error", "auth/invalid-id-token"]) {
        await assert.rejects(verifyActiveSession("fake", () => ({ auth: { verifyIdToken: async () => { throw { code }; } } })), { code });
        assert.equal(sessionErrorResponse({ code }).status, 401);
    }
    for (const code of ["auth/insufficient-permission", "auth/internal-error", "app/network-error", "admin/configuration-error", 14]) {
        assert.equal(sessionErrorResponse({ code }).status, 503);
    }
});

test("pending account deletion blocks otherwise valid tokens before any AI work", async () => {
    await assert.rejects(verifyActiveSession("fake", () => ({
        auth: { verifyIdToken: async () => ({ uid: "teacher-a" }) },
        db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true }) }) }) }
    })), { code: "auth/account-deleting" });
});

test("credential parsing rejects malformed input and cross-project keys without leaking contents", () => {
    for (const env of [
        { FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: "SECRET_FILENAME_NOT_A_KEY" },
        { FIREBASE_SERVICE_ACCOUNT_JSON: '{"private_key":"SECRET", "project_id":"other"}' }
    ]) {
        assert.throws(() => parseAdminCredentials(env, "educaria-test"), (error) => {
            assert.equal(error.code, "admin/configuration-error");
            assert.equal(error.message.includes("SECRET"), false); return true;
        });
    }
    const value = { type: "service_account", project_id: "educaria-test", client_email: "test@example.invalid", private_key: "synthetic\\nkey" };
    assert.equal(parseAdminCredentials({ FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(JSON.stringify(value)).toString("base64") }, "educaria-test").private_key, "synthetic\nkey");
});

test("gaxios's overridden UUID dependency retains its CommonJS v4 interface", async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const storageRequire = createRequire(require.resolve("@google-cloud/storage"));
    const gaxiosRequire = createRequire(storageRequire.resolve("gaxios"));
    assert.match(gaxiosRequire("uuid").v4(), /^[0-9a-f-]{36}$/);
});
