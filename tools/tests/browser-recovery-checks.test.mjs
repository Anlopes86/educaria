import assert from "node:assert/strict";
import { test } from "node:test";
import { until, triggerNavigation } from "../browser-recovery-checks.mjs";

const fast = { attempts: 3, intervalMs: 0 };

test("recovery navigation waits through a replaced browser document and verifies the destination", async () => {
    let calls = 0;
    const cdp = { async send(method, params) {
        assert.equal(method, "Runtime.evaluate");
        assert.equal(params.expression, "destinationReady");
        if (++calls === 1) throw new Error("Inspected target navigated or closed");
        if (calls === 2) throw new Error("Execution context was destroyed.");
        return { result: { value: true } };
    } };
    await until(cdp, "destinationReady", fast);
    assert.equal(calls, 3);
});

test("a closed browser or missing destination never counts as a successful recovery", async () => {
    for (const pending of [false, new Error("Inspected target navigated or closed")]) {
        let calls = 0;
        const cdp = { async send() {
            calls++;
            if (pending instanceof Error) throw pending;
            return { result: { value: pending } };
        } };
        await assert.rejects(until(cdp, "destinationReady", fast), /timed out: destinationReady/);
        assert.equal(calls, 3);
    }
});

test("the recovery wait still rejects genuine page and connection errors", async () => {
    let calls = 0;
    await assert.rejects(until({ async send() {
        calls++;
        return { exceptionDetails: { text: "ReferenceError: broken recovery" } };
    } }, "destinationReady", fast), /ReferenceError: broken recovery/);
    assert.equal(calls, 1);
    await assert.rejects(until({ async send() { throw new Error("Connection closed unexpectedly"); } }, "ready", fast), /Connection closed/);
});

test("a navigation action is not repeated when its original document is discarded", async () => {
    let clicks = 0;
    await triggerNavigation({ async send() {
        clicks++;
        throw new Error("Inspected target navigated or closed");
    } }, "openEditor()");
    assert.equal(clicks, 1);
});

test("navigation actions do not swallow application errors", async () => {
    await assert.rejects(triggerNavigation({ async send() {
        return { exceptionDetails: { text: "TypeError: missing editor button" } };
    } }, "openEditor()"), /TypeError: missing editor button/);
});
