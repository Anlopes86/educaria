import test from "node:test";
import assert from "node:assert/strict";
import { createAppProtection, requireVerifiedEmail } from "../app-protection.js";

function response() { return { status(value) { this.code = value; return this; }, json(value) { this.body = value; } }; }
test("AI requires the verified claim, not an email or a role", () => {
    for (const user of [undefined, { email: "test@example.com" }, { email_verified: "true", admin: true }]) {
        const res = response(); let passed = false;
        requireVerifiedEmail({ educariaUser: user }, res, () => { passed = true; });
        assert.equal(passed, false); assert.equal(res.code, 403);
    }
    let passed = false;
    requireVerifiedEmail({ educariaUser: { email_verified: true } }, response(), () => { passed = true; });
    assert.equal(passed, true);
});
test("App Check enforces both signature verification and app identity", async () => {
    for (const scenario of ["missing", "wrong_app", "invalid", "unavailable", "valid"]) {
        const reasons = []; let passed = false;
        const guard = createAppProtection({ mode: "enforce", appId: "web-app", report: reason => reasons.push(reason),
            getServices: () => ({ appCheck: { async verifyToken() {
                if (["invalid", "unavailable"].includes(scenario)) throw Object.assign(new Error(), { code: scenario === "invalid" ? "app-check/invalid-argument" : "network" });
                return { appId: scenario === "wrong_app" ? "other-app" : "web-app" };
            } } }) });
        const res = response();
        await guard({ get: () => scenario === "missing" ? undefined : "token" }, res, () => { passed = true; });
        assert.equal(passed, scenario === "valid");
        if (!passed) { assert.equal(res.code, scenario === "unavailable" ? 503 : 403); assert.deepEqual(reasons, [scenario]); }
    }
});
test("monitor observes failures without blocking rollout; enforcement needs an app", async () => {
    assert.throws(() => createAppProtection({ mode: "enforce" }), /FIREBASE_WEB_APP_ID/);
    let passed = false;
    await createAppProtection({ mode: "monitor" })({ get: () => null }, response(), () => { passed = true; });
    assert.equal(passed, true);
});
