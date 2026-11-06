import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../../assets/js/ai-credits.js", import.meta.url), "utf8");

class Element {
    constructor(tagName = "span") {
        this.tagName = tagName.toUpperCase();
        this.attributes = new Map();
        this.dataset = {};
        this.children = [];
        this.events = new Map();
        this.classList = { add() {} };
        this.isConnected = true;
        this.textContent = "";
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    append(...nodes) { this.children.push(...nodes); }
    addEventListener(name, callback) { this.events.set(name, callback); }
    dispatchEvent(event) { this.events.get(event.type)?.(event); }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent({ type: "close" }); }
    set innerHTML(value) {
        this.markup = value;
        // Only the help dialog uses HTML; expose its visible status slots.
        for (const name of value.matchAll(/\s(data-ai-credits-help-[a-z]+)(?:\s|>)/g)) {
            const element = new Element("p");
            element.setAttribute(name[1], "");
            this.append(element);
        }
    }
    querySelector(selector) {
        const attribute = selector.match(/^\[([^\]]+)\]$/)?.[1];
        const dataset = attribute?.replace(/^data-/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return this.children.find(child => child.attributes.has(attribute) || Object.hasOwn(child.dataset, dataset)) ?? null;
    }
}

function harness(fetch = async () => ({ ok: true, json: async () => ({ credits: null }) })) {
    const pill = new Element();
    const body = new Element("body");
    const events = new Map();
    const alerts = [];
    const emitted = [];
    const context = vm.createContext({
        console: { warn() {} }, fetch,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        document: {
            body,
            createElement: tag => new Element(tag),
            querySelectorAll: selector => selector === "[data-ai-credits]" ? [pill] : [],
            addEventListener: (type, listener) => events.set(type, listener),
            dispatchEvent: event => { emitted.push(event); events.get(event.type)?.(event); }
        },
        window: {
            alert: message => alerts.push(message),
            educariaAiCreditsEndpoint: () => "/credits",
            educariaAiAuthHeaders: async () => ({})
        }
    });
    vm.runInContext(source, context, { filename: "ai-credits.js" });
    const slot = name => pill.querySelector(`[data-ai-credits-${name}]`);
    return {
        context, pill, body, alerts, emitted, slot,
        render: credits => context.window.renderEducariaAiCredits(credits),
        ensure: options => context.window.ensureEducariaAiCreditsAvailable({ refresh: false, ...options }),
        event: (type, detail) => context.document.dispatchEvent({ type, detail })
    };
}

const balance = { remaining: 420, limit: 500, used: 80, resetAt: "2026-10-29T00:00:00.000Z" };

test("a positive personal balance is not described as guaranteed AI availability", () => {
    const h = harness();
    h.render(balance);
    assert.equal(h.slot("label").textContent, "Seu saldo: 420 de 500 créditos");
    assert.equal(h.slot("notice").hidden, true);
    assert.doesNotMatch(h.slot("label").textContent, /disponív|garant/i);
    assert.equal(h.pill.getAttribute("aria-live"), "polite");
    assert.equal(h.emitted.at(-1).detail.credits, balance);
});

test("known shared token exhaustion remains explicit despite a positive personal balance", async () => {
    const h = harness();
    h.render({ ...balance, platformTokens: { enabled: true, remaining: 0 } });
    assert.match(h.slot("notice").textContent, /IA temporariamente indisponível: cota compartilhada atingida/);
    assert.equal(h.pill.dataset.state, "empty");
    assert.equal(await h.ensure(), false);
    assert.match(h.alerts[0], /cota compartilhada/);
    assert.doesNotMatch(h.alerts[0], /próximo reset|Pro|renova/i);
});

test("an unlimited test account remains subject to shared quota", async () => {
    const h = harness();
    h.render({ ...balance, remaining: null, unlimited: true, requests: { enabled: true, remaining: 8, platform: { remaining: 0 } } });
    assert.equal(h.slot("label").textContent, "Conta de testes: sem limite individual");
    assert.match(h.slot("notice").textContent, /cota compartilhada/);
    assert.equal(await h.ensure({ alert: false }), false);
    h.render({ ...balance, remaining: null, unlimited: true });
    assert.equal(await h.ensure(), true);
});

test("unknown and malformed values are never presented as a zero balance", async () => {
    for (const remaining of [null, undefined, "", "   ", NaN, Infinity, -1, false, [], {}]) {
        const h = harness();
        h.render({ remaining, requests: { enabled: true }, platformTokens: { enabled: true, remaining } });
        assert.equal(h.slot("label").textContent, "Seu saldo de IA: consulta indisponível");
        assert.equal(h.slot("notice").hidden, true);
        assert.equal(h.pill.dataset.state, "unavailable");
        assert.equal(await h.ensure(), true, "unknown client data must defer to the API");
        assert.deepEqual(h.alerts, []);
    }
});

test("incomplete quota metadata does not block a known positive balance", async () => {
    const h = harness();
    h.render({ ...balance, requests: { enabled: true, remaining: 5, platform: {} }, platformTokens: { enabled: true } });
    assert.equal(await h.ensure(), true);
    assert.equal(h.slot("notice").hidden, true);
});

test("personal daily generation and balance exhaustion use their correct messages", async () => {
    const h = harness();
    h.render({ ...balance, requests: { enabled: true, remaining: 0, platform: { remaining: 100 } } });
    assert.match(h.slot("notice").textContent, /Seu limite diário de gerações/);
    assert.equal(await h.ensure(), false);
    assert.match(h.alerts.pop(), /seu limite diário/i);
    h.render({ ...balance, remaining: 0, plan: "free", limits: { pro: 4000 } });
    assert.equal(await h.ensure(), false);
    assert.match(h.alerts.at(-1), /Renovação prevista do saldo/);
    assert.doesNotMatch(h.alerts.at(-1), /plano Pro|acesso volta/i);
});

test("disabled quota counters do not block and batch actions check required requests", async () => {
    const h = harness();
    h.render({ ...balance, requests: { enabled: false, remaining: 0, platform: { remaining: 0 } }, platformTokens: { enabled: false, remaining: 0 } });
    assert.equal(await h.ensure(), true);
    h.render({ ...balance, requests: { enabled: true, remaining: 2, platform: { remaining: 100 } } });
    assert.equal(await h.ensure({ requiredRequests: 3 }), false);
    assert.match(h.alerts.pop(), /precisa de 3 gerações.*tem 2/);
    h.render({ ...balance, requests: { enabled: true, remaining: 10, platform: { remaining: 2 } } });
    assert.equal(await h.ensure({ requiredRequests: 3 }), false);
    assert.match(h.alerts.pop(), /plataforma não tem cota diária suficiente/);
});

test("help uses a native button and modal, avoids opening the parent disclosure and restores focus", () => {
    const h = harness();
    h.render(balance);
    const trigger = h.pill.children.find(element => element.tagName === "BUTTON");
    assert.equal(trigger.type, "button");
    assert.equal(trigger.getAttribute("aria-haspopup"), "dialog");
    assert.match(trigger.getAttribute("aria-label"), /saldo e disponibilidade/);
    let prevented = false;
    let stopped = false;
    trigger.dispatchEvent({ type: "click", preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
    const dialog = h.body.children[0];
    assert.equal(prevented && stopped, true);
    assert.equal(dialog.tagName, "DIALOG");
    assert.equal(dialog.open, true);
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    assert.match(dialog.markup, /Ter créditos não garante/);
    assert.match(dialog.markup, /editar, apresentar e imprimir/);
    assert.match(dialog.markup, /<form method="dialog">/);
    h.render({ ...balance, platformTokens: { enabled: true, remaining: 0 } });
    assert.match(dialog.querySelector("[data-ai-credits-help-status]").textContent, /cota compartilhada/);
    dialog.close();
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
    assert.equal(trigger.focused, true);
    h.render(balance);
    assert.equal(h.pill.children.length, 3, "updates must not duplicate the help control");
});

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

test("help preserves known personal generation counts without adding them to the main balance label", () => {
    const h = harness();
    h.render({ ...balance, requests: { enabled: true, remaining: 2, limit: 5, platform: { remaining: 1234 } } });
    const trigger = h.pill.children.find(element => element.tagName === "BUTTON");
    trigger.dispatchEvent({ type: "click", preventDefault() {}, stopPropagation() {} });
    const dialog = h.body.children[0];
    const count = dialog.querySelector("[data-ai-credits-help-requests]");
    assert.equal(count.textContent, "Seu limite diário: 2 de 5 gerações restantes.");
    assert.equal(count.hidden, false);
    assert.doesNotMatch(h.slot("label").textContent, /geraç|1234/);
    h.render({ ...balance, requests: { enabled: true, remaining: 0, limit: 1 } });
    assert.equal(count.textContent, "Seu limite diário: 0 de 1 geração restante.");
    for (const requests of [
        { enabled: false, remaining: 2, limit: 5 },
        { enabled: true, display: false, remaining: 2, limit: 5 },
        { enabled: true, remaining: 2 },
        { enabled: true, remaining: null, limit: 5 },
        { enabled: true, remaining: 6, limit: 5 },
        { enabled: true, remaining: 1.5, limit: 5 },
        { enabled: true, remaining: 0, limit: 0 }
    ]) {
        h.render({ ...balance, requests });
        assert.equal(count.hidden, true);
        assert.equal(count.textContent, "");
    }
});

test("a delayed balance fetch cannot overwrite a newer generation result", async () => {
    const response = deferred();
    const h = harness(() => response.promise);
    const pending = h.context.window.refreshEducariaAiCredits();
    await Promise.resolve();
    const latest = { ...balance, remaining: 317 };
    h.event("educaria-ai-credits-updated", { credits: latest });
    response.resolve({ ok: true, json: async () => ({ credits: balance }) });
    assert.equal(await pending, latest);
    assert.equal(h.context.window.educariaLatestAiCredits, latest);
    assert.match(h.slot("label").textContent, /317/);
});

test("an account change clears old balance immediately and ignores the previous account response", async () => {
    const first = deferred();
    const second = deferred();
    let calls = 0;
    const h = harness(() => (++calls === 1 ? first.promise : second.promise));
    h.render(balance);
    const previous = h.context.window.refreshEducariaAiCredits();
    await Promise.resolve();
    h.event("educaria-auth-changed");
    assert.equal(h.context.window.educariaLatestAiCredits, null);
    assert.match(h.slot("label").textContent, /consulta indisponível/);
    await Promise.resolve();
    first.resolve({ ok: true, json: async () => ({ credits: balance }) });
    assert.equal(await previous, null);
    second.resolve({ ok: true, json: async () => ({ credits: { ...balance, remaining: 250 } }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.match(h.slot("label").textContent, /250/);
});

test("network failures show unknown balance and leave authoritative validation to generation", async () => {
    const h = harness(async () => { throw new Error("offline"); });
    assert.equal(await h.context.window.refreshEducariaAiCredits(), null);
    assert.equal(h.pill.dataset.state, "unavailable");
    assert.equal(await h.ensure(), true);
    assert.deepEqual(h.alerts, []);
});
