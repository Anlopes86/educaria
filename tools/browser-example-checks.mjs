import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { until } from "./browser-recovery-checks.mjs";

async function evaluate(cdp, expression, context) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, ...(context?.contextId ? { contextId: context.contextId } : {}) }, context?.sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
}
async function frameContext(cdp) {
    const { frameTree } = await cdp.send("Page.getFrameTree");
    const child = frameTree.childFrames?.find(item => item.frame.url === "about:srcdoc");
    if (child) return { contextId: (await cdp.send("Page.createIsolatedWorld", { frameId: child.frame.id, worldName: "example-audit" })).executionContextId };
    // Chrome may put the opaque sandbox in its own process.
    const { targetInfos } = await cdp.send("Target.getTargets");
    const target = targetInfos.find(item => item.type === "iframe" && item.url === "about:srcdoc");
    assert.ok(target, "Example iframe must exist");
    return await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
}
export async function checkActivityExamples(cdp, screenshotDir) {
    await until(cdp, "Boolean(window.EducariaExamples && document.querySelector('[data-activity-example=worksheet]'))");
    // The general harness just inspected the mobile drawer; close it before
    // starting a separate modal journey (otherwise the main page is inert).
    await evaluate(cdp, "document.body.classList.contains('app-sidebar-open') && document.querySelector('[data-sidebar-mobile-close]')?.click()");
    await until(cdp, "!document.body.classList.contains('app-sidebar-open')");
    const keys = await evaluate(cdp, "Object.keys(EducariaExampleCatalog.tools)");
    await evaluate(cdp, `(() => {
        document.querySelector('[data-dashboard-quick-topic]').value = 'Meu pedido não pode desaparecer';
        window.__exampleBefore = JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(key => /builder|lessons|classList|recovery/.test(key)).sort().map(key => [key, localStorage.getItem(key)])));
    })()`);
    const results = [];
    for (const key of keys) {
        await evaluate(cdp, `document.querySelector('[data-activity-example="${key}"]').click()`);
        await until(cdp, "document.querySelector('[data-example-loading]')?.hidden", { attempts: 120 });
        await evaluate(cdp, "document.querySelector('[data-example-play]').textContent.includes('Pausar') && document.querySelector('[data-example-play]').click()");
        const before = await evaluate(cdp, `(() => ({ sandbox: document.querySelector('.activity-example-dialog iframe').getAttribute('sandbox'),
            open: document.querySelector('.activity-example-dialog').open, blocked: document.querySelector('.activity-example-dialog iframe').contentDocument === null,
            width: document.querySelector('.activity-example-dialog').getBoundingClientRect().width, viewport: innerWidth }))()`);
        assert.equal(before.sandbox, "allow-scripts"); assert.ok(before.open && before.blocked); assert.ok(before.width <= before.viewport);
        let context = await frameContext(cdp);
        const state = await evaluate(cdp, `({ text: document.body.innerText.length, overflow: document.documentElement.scrollWidth > innerWidth + 1,
            dangerous: [...document.scripts].some(s => /auth-flow|firebase|storage-scope|local-persistence|ai-material|offline-runtime/.test(s.src)),
            main: document.body.innerText.slice(0, 160),
            geometry: [...document.querySelectorAll('body, main, main > section, main > article')].map(el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return [el.tagName, el.className, r.x,r.y,r.width,r.height,s.opacity,s.visibility,s.display]; }) })`, context);
        assert.ok(state.text > 10, `${key}: empty player ${JSON.stringify(state)}`); assert.equal(state.dangerous, false);
        assert.ok(!/ainda est[áa] vazi|MATERIAL NÃO FINALIZADO/i.test(state.main), `${key}: blank fixture`);
        if (key !== "worksheet") assert.ok(state.geometry.some(item => item[0] === "SECTION" && item[5] > 250), `${key}: collapsed presentation stage`);
        if (key === "worksheet") {
            const student = await evaluate(cdp, "document.body.innerHTML", context);
            await evaluate(cdp, "document.querySelector('[data-example-answers]').click()");
            await new Promise(resolve => setTimeout(resolve, 100));
            const answer = await evaluate(cdp, "document.body.innerHTML", context);
            assert.notEqual(student, answer); assert.ok(answer.includes("GABARITO DO PROFESSOR"));
            const fit = await evaluate(cdp, `(() => { const p = document.querySelector('.worksheet-sheet'); return { h:p.clientHeight, scroll:p.scrollHeight, count:p.querySelectorAll('.worksheet-exercise').length }; })()`, context);
            assert.equal(fit.count, 4); assert.ok(fit.scroll <= fit.h + 2, `A4 overflow: ${JSON.stringify(fit)}`);
            await evaluate(cdp, "document.querySelector('[data-example-student]').click(); document.querySelector('[data-example-zoom]').click()");
            assert.equal(await evaluate(cdp, "document.querySelector('[data-example-stage]').classList.contains('is-zoomed')"), true);
            await evaluate(cdp, "document.querySelector('[data-example-zoom]').click()");
        } else {
            const steps = await evaluate(cdp, `EducariaExampleCatalog.tools[${JSON.stringify(key)}].steps`);
            for (let step = 1; step < steps.length; step++) {
                if (steps[step].click) assert.ok(await evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(steps[step].click)}))`, context), `${key}: missing demo action`);
                await evaluate(cdp, "document.querySelector('[data-example-next]').click()");
                if (key === "lesson") { await until(cdp, "document.querySelector('[data-example-loading]')?.hidden"); context = await frameContext(cdp); }
                await new Promise(resolve => setTimeout(resolve, 120));
                assert.ok((await evaluate(cdp, "document.querySelector('[data-example-progress]').textContent")).startsWith(String(step + 1)));
            }
            if (key === "memory") assert.equal(await evaluate(cdp, "document.querySelectorAll('[data-memory-tile].is-found').length", context), 2);
            if (key === "match") assert.equal(await evaluate(cdp, "document.querySelectorAll('[data-match-left-item].is-matched').length", context), 1);
            if (key === "connections") {
                assert.equal(await evaluate(cdp, "document.querySelector('[data-discovery-reveal]').getAttribute('aria-pressed')", context), "true");
                await evaluate(cdp, "document.querySelector('[data-discovery-explanation]').click()", context);
                assert.equal(await evaluate(cdp, "document.querySelector('[data-discovery-explanation-dialog]').open", context), true);
                await evaluate(cdp, "document.querySelector('[data-example-close-dialog]').click()", context);
                assert.equal(await evaluate(cdp, "document.querySelector('[data-discovery-explanation-dialog]').open", context), false);
            }
        }
        if (screenshotDir) {
            await new Promise(resolve => setTimeout(resolve, 600));
            await fs.mkdir(screenshotDir, { recursive: true });
            const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
            await fs.writeFile(path.join(screenshotDir, `example-${key}.png`), Buffer.from(data, "base64"));
        }
        // Native Escape closes even when focus is in the embedded player.
        await evaluate(cdp, "document.querySelector('[data-example-close]').focus()");
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await until(cdp, "!document.querySelector('.activity-example-dialog').open");
        await until(cdp, "document.querySelector('.activity-example-dialog iframe') === null");
        assert.equal(await evaluate(cdp, "document.querySelector('.activity-example-dialog iframe') === null"), true);
        results.push({ key, ...state });
        console.log(`  example-${key}=ok`);
    }
    await evaluate(cdp, "document.querySelector('[data-activity-example=memory]').click()");
    await until(cdp, "document.querySelector('[data-example-loading]')?.hidden");
    await evaluate(cdp, "document.querySelector('[data-example-create]').click()");
    await until(cdp, "document.querySelector('.activity-example-dialog iframe') === null");
    assert.equal(await evaluate(cdp, "document.activeElement === document.querySelector('[data-dashboard-quick-topic]')"), true);
    assert.equal(await evaluate(cdp, "document.querySelector('[data-dashboard-quick-format]').selectedOptions[0].dataset.materialType"), "memory");
    assert.equal(await evaluate(cdp, "document.querySelector('[data-dashboard-quick-topic]').value"), "Meu pedido não pode desaparecer");
    assert.equal(await evaluate(cdp, "JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(key => /builder|lessons|classList|recovery/.test(key)).sort().map(key => [key, localStorage.getItem(key)]))) === window.__exampleBefore"), true, "Examples must not modify saved material or drafts");
    // A quick close while fetch is still pending must not recreate a live iframe.
    await evaluate(cdp, "document.querySelector('[data-activity-example=quiz]').click(); document.querySelector('[data-example-close]').click()");
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(await evaluate(cdp, "document.querySelector('.activity-example-dialog iframe') === null"), true);
    // Network failure is visible, and does not turn into a blank or stuck dialog.
    await evaluate(cdp, `(() => { window.__exampleFetch = window.fetch; window.fetch = (url, options) => String(url).includes('quiz-aplicacao.html') ? Promise.reject(new TypeError('offline fixture')) : window.__exampleFetch(url, options); document.querySelector('[data-activity-example=quiz]').click(); })()`);
    await until(cdp, "document.querySelector('[data-example-loading]').textContent.includes('Não foi possível')");
    await evaluate(cdp, "document.querySelector('[data-example-close]').click(); window.fetch = window.__exampleFetch");
    await until(cdp, "document.querySelector('.activity-example-dialog iframe') === null");
    // Reduced-motion users can inspect the initial state without timed changes.
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await evaluate(cdp, "document.querySelector('[data-activity-example=slides]').click()");
    await until(cdp, "document.querySelector('[data-example-loading]')?.hidden");
    assert.ok((await evaluate(cdp, "document.querySelector('[data-example-play]').textContent")).includes("Reproduzir"));
    await evaluate(cdp, "document.querySelector('[data-example-close]').click()");
    await until(cdp, "document.querySelector('.activity-example-dialog iframe') === null");
    return results;
}
