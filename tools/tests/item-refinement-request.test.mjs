import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
const request = source.slice(source.indexOf("async function requestStructuredMaterial("), source.indexOf("async function requestTemplateStructuredMaterial("));
const refinement = { field: "detail", instruction: "Explique para o 6º ano.", item: { detail: "Antes" }, context: { neighbors: [] } };

function setup({ headers = async () => ({ Authorization: "Bearer test-only" }), response, illustration = false } = {}) {
    let owner = "teacher-a";
    const calls = [], events = [];
    const context = vm.createContext({
        FormData, CustomEvent, Error,
        window: { educariaGenerationRecovery: { currentUid: () => owner }, educariaAiAuthHeaders: headers },
        document: { dispatchEvent: event => events.push(event) }, resolveAiEndpoint: () => "https://example.invalid/api/ai/generate",
        fetch: async (url, options) => { calls.push({ url, options }); return response ? response() : { ok: true, json: async () => ({ operation: "refine-item", credits: { remaining: 499 }, material: { item: { detail: "Depois" } } }) }; }
    });
    vm.runInContext(request, context);
    return { calls, events, setOwner(value) { owner = value; },
        send: () => illustration
            ? context.requestStructuredMaterial("slides", "", null, "Ilustrar um slide", undefined, undefined, undefined, { title: "Energia", body: "O Sol fornece energia." })
            : context.requestStructuredMaterial("mindmap", "", null, "Ajustar um item", undefined, undefined, refinement) };
}

test("illustration requests send only the selected slide through the authenticated transport", async () => {
    const h = setup({ illustration: true }); await h.send();
    const body = h.calls[0].options.body;
    assert.equal(body.get("materialType"), "slides"); assert.equal(body.has("refinement"), false);
    assert.deepEqual(JSON.parse(body.get("slideIllustration")), { title: "Energia", body: "O Sol fornece energia." });
    assert.equal(h.calls[0].options.headers.Authorization, "Bearer test-only");
});

test("illustration responses cannot cross accounts or update another account's credits", async () => {
    let resolve;
    const h = setup({ illustration: true, response: () => new Promise(done => { resolve = done; }) });
    const pending = h.send(); await new Promise(done => setImmediate(done));
    h.setOwner("teacher-b"); resolve({ ok: true, json: async () => ({ operation: "illustrate-slide", material: {}, credits: { remaining: 499 } }) });
    await assert.rejects(pending, /conta mudou/); assert.equal(h.events.length, 0);
});

test("targeted requests use the authenticated generation endpoint and preserve the bounded request", async () => {
    const h = setup(); const result = await h.send();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].options.headers.Authorization, "Bearer test-only");
    assert.equal(h.calls[0].options.body.get("materialType"), "mindmap");
    assert.deepEqual(JSON.parse(h.calls[0].options.body.get("refinement")), refinement);
    assert.equal(result.material.item.detail, "Depois");
    assert.equal(h.events[0].type, "educaria-ai-credits-updated");
});

test("switching accounts during authentication prevents the request entirely", async () => {
    let resolve;
    const h = setup({ headers: () => new Promise(done => { resolve = done; }) });
    const pending = h.send(); h.setOwner("teacher-b"); resolve({});
    await assert.rejects(pending, /conta mudou/);
    assert.equal(h.calls.length, 0); assert.equal(h.events.length, 0);
});

test("late results cannot update another account's credit balance", async () => {
    let resolve;
    const h = setup({ response: () => new Promise(done => { resolve = done; }) });
    const pending = h.send(); await new Promise(done => setImmediate(done));
    h.setOwner("teacher-b"); resolve({ ok: true, json: async () => ({ material: { item: { detail: "Private" } }, credits: { remaining: 499 } }) });
    await assert.rejects(pending, /conta mudou/);
    assert.equal(h.calls.length, 1); assert.equal(h.events.length, 0);
});
