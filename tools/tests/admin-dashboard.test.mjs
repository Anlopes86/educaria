import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
const read = path => fs.readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const accessSource = await read("assets/js/admin-access.js");

function accessHarness() {
    const listeners = {};
    const calls = [];
    const scope = { AbortController, DOMException, URL, setTimeout, clearTimeout,
        document: { addEventListener: (event, callback) => { listeners[event] = callback; } },
        window: { addEventListener: (event, callback) => { listeners[event] = callback; }, educariaAiAuthHeaders: async () => ({ Authorization: "Bearer fake" }), educariaAiEndpoint: path => `https://example.test${path}` },
        fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ ok: true, isAdmin: true }) }; }
    };
    vm.runInNewContext(accessSource, scope);
    return { scope, calls, listeners, api: scope.window.educariaAdminApi };
}
test("admin client sends authenticated no-store reads and deduplicates permission checks", async () => {
    const h = accessHarness();
    assert.deepEqual(await Promise.all([h.api.access(), h.api.access()]), [true, true]);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].options.headers.Authorization, "Bearer fake");
    assert.equal(h.calls[0].options.method, "GET"); assert.equal(h.calls[0].options.cache, "no-store");
    assert.equal(h.calls[0].options.credentials, "omit");
});
test("missing login never sends a request to the admin server", async () => {
    const h = accessHarness(); h.scope.window.educariaAiAuthHeaders = async () => ({});
    await assert.rejects(h.api.access(), error => error.status === 401);
    assert.equal(h.calls.length, 0);
});
test("changing accounts discards in-flight results even if fetch ignores abort", async () => {
    const h = accessHarness(); let complete;
    h.scope.fetch = async () => new Promise(resolve => { complete = resolve; });
    const result = h.api.request("/users");
    await new Promise(resolve => setTimeout(resolve, 0));
    h.listeners["educaria-auth-changed"]();
    complete({ ok: true, json: async () => ({ users: [{ name: "Private" }] }) });
    await assert.rejects(result, error => error.name === "AbortError");
});
test("invalid endpoints are rejected and SDK error bodies are not shown", async () => {
    const h = accessHarness();
    await assert.rejects(h.api.request("/delete"));
    h.scope.fetch = async () => ({ ok: false, status: 403, json: () => { throw Error("should not consume private error body"); } });
    await assert.rejects(h.api.request("/users"), error => error.status === 403);
});

test("leaving the page discards pending permission and allows a fresh check on return", async () => {
    const h = accessHarness(); let complete;
    h.scope.fetch = async () => new Promise(resolve => { complete = resolve; });
    const prior = h.api.access();
    await new Promise(resolve => setTimeout(resolve, 0));
    h.listeners.pagehide();
    h.scope.fetch = async () => ({ ok: true, json: async () => ({ ok: true, isAdmin: false }) });
    assert.equal(await h.api.access(), false);
    complete({ ok: true, json: async () => ({ ok: true, isAdmin: true }) });
    await assert.rejects(prior, error => error.name === "AbortError");
});
test("admin table renders user values as text and clears them on session or page changes", async () => {
    const client = await read("assets/js/admin-dashboard.js");
    assert.doesNotMatch(client, /innerHTML|insertAdjacentHTML|localStorage|sessionStorage/);
    assert.match(client, /node\.textContent = String\(value\)/);
    assert.match(client, /pagehide[\s\S]*?clearPrivateData\(\)/);
    assert.match(client, /educaria-auth-changed/);
    assert.match(client, /current !== generation/);
});
test("admin navigation is added only after server permission, on every sidebar page", async () => {
    const sidebar = await read("assets/js/app-sidebar.js");
    assert.match(sidebar, /await window\.educariaAdminApi\.access\(\)/);
    assert.match(sidebar, /if \(!allowed \|\| version !== sidebarAdminRequest\) return/);
    for (const page of ["index", "biblioteca", "turmas", "turma", "configuracoes", "administracao"]) {
        const html = await read(`plataforma/${page}.html`);
        assert.match(html, /admin-access\.js\?v=20261012-1/);
        assert.match(html, /ai-endpoint-config\.js/);
        assert.match(html, /app-sidebar\.js\?v=20261012-2/);
    }
});
test("admin screen is read-only, initially private and has labelled search, pagination and retry", async () => {
    const html = await read("plataforma/administracao.html");
    assert.match(html, /data-admin-content hidden/);
    assert.match(html, /noindex, nofollow/);
    for (const hook of ["data-admin-filters", "data-admin-prev", "data-admin-next", "data-admin-retry", "data-admin-clear"]) assert.ok(html.includes(hook));
    assert.doesNotMatch(html, /data-admin-(?:delete|block|upgrade)/);
    const sw = await read("service-worker.js");
    assert.match(sw, /url\.pathname\.includes\("\/api\/"\)\) return false/);
});
