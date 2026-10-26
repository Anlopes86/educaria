import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../service-worker.js", import.meta.url), "utf8");
function setup({ offline = false } = {}) {
    const handlers = new Map();
    const updates = [];
    const cached = new Response("old offline content");
    vm.runInNewContext(source, {
        self: { location: { origin: "https://example.com" }, addEventListener: (name, fn) => handlers.set(name, fn) },
        URL, Response, console,
        caches: { match: async () => cached.clone(), open: async () => ({ put: async (request, response) => updates.push(await response.text()) }) },
        fetch: async (request, options) => {
            if (offline) throw new TypeError("offline");
            return new Response(options?.cache === "no-cache" ? "current published content" : "old HTTP cache content");
        }
    });
    return { handlers, updates };
}

test("online security scripts and HTML revalidate both cache layers before serving", async () => {
    for (const file of ["assets/js/app-security.js?v=release", "assets/js/auth-flow.js", "assets/js/ai-endpoint-config.js", "login.html"]) {
        const { handlers, updates } = setup();
        let response;
        handlers.get("fetch")({ request: { url: `https://example.com/${file}`, method: "GET", mode: file.endsWith("html") ? "navigate" : "cors", headers: new Headers() }, respondWith: value => { response = value; } });
        assert.equal(await (await response).text(), "current published content");
        assert.deepEqual(updates, ["current published content"]);
    }
});

test("offline presentation still opens the last cached document", async () => {
    const { handlers } = setup({ offline: true });
    let response;
    handlers.get("fetch")({ request: { url: "https://example.com/plataforma/apresentacao.html", method: "GET", mode: "navigate", headers: new Headers() }, respondWith: value => { response = value; } });
    assert.equal(await (await response).text(), "old offline content");
});
