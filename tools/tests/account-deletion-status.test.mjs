import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
const source = await fs.readFile(new URL("../../assets/js/account-deletion-status.js", import.meta.url), "utf8");
async function run(status, options = {}) {
    const elements = Object.fromEntries(["status", "help", "refresh", "login"].map((name) => [`[data-deletion-${name}]`, {
        textContent: "", hidden: false, disabled: false, addEventListener() {}
    }]));
    let cleanup = 0;
    let cleared = 0;
    let scheduled = 0;
    const client = {
        read: () => options.noReceipt ? null : ({ uid: "teacher-a", receipt: "fake-receipt" }),
        status: async () => { if (options.unavailable) throw new Error("offline"); return { status }; },
        clearLocalData: () => { cleanup++; },
        clear: () => { cleared++; if (options.clearFailure) throw new Error("storage"); }
    };
    vm.runInNewContext(source, {
        window: { educariaAccountDeletion: client, addEventListener() {} },
        document: { querySelector: (selector) => elements[selector] },
        clearTimeout() {}, setTimeout: () => { scheduled++; }
    });
    await new Promise((resolve) => setImmediate(resolve));
    return { elements, cleanup, cleared, scheduled };
}
test("status page never claims completion for a pending job or unavailable server", async () => {
    for (const status of ["pending", "retrying", "not_found"]) {
        const f = await run(status);
        assert.doesNotMatch(f.elements["[data-deletion-status]"].textContent, /Exclusão concluída/);
        assert.equal(f.cleared, 0);
        assert.equal(f.cleanup, status === "not_found" ? 0 : 1);
        assert.equal(f.scheduled, 1);
    }
    const offline = await run(null, { unavailable: true });
    assert.equal(offline.cleanup, 0);
    assert.equal(offline.cleared, 0);
    assert.match(offline.elements["[data-deletion-status]"].textContent, /Não foi possível consultar/);
});
test("confirmed completion stops polling even if clearing the local receipt fails", async () => {
    for (const clearFailure of [false, true]) {
        const f = await run("completed", { clearFailure });
        assert.match(f.elements["[data-deletion-status]"].textContent, /Exclusão concluída/);
        assert.equal(f.elements["[data-deletion-refresh]"].hidden, true);
        assert.equal(f.elements["[data-deletion-login]"].href, "login.html?accountDeleted=1");
        assert.equal(f.scheduled, 0);
        assert.equal(f.cleanup, 1);
    }
});
test("missing local receipt does not initiate deletion or poll indefinitely", async () => {
    const f = await run(null, { noReceipt: true });
    assert.match(f.elements["[data-deletion-status]"].textContent, /Não há comprovante/);
    assert.equal(f.cleanup, 0);
    assert.equal(f.scheduled, 0);
});
