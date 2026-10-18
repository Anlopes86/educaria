import assert from "node:assert/strict";
import { test } from "node:test";
import pointer from "../../assets/js/discovery-pointer-input.js";

function harness(completesAt = -1) {
    const handlers = {}, windowHandlers = {}, calls = [];
    let captured = null, target = null;
    const cell = index => ({ dataset: { cell: String(index) }, closest() { return this; }, getAttribute() { return null; } });
    const cells = [cell(0), cell(1), cell(2)];
    const container = {
        contains: node => cells.includes(node),
        addEventListener: (name, handler) => { handlers[name] = handler; },
        setPointerCapture: id => { captured = id; }, hasPointerCapture: id => captured === id,
        releasePointerCapture: () => { captured = null; handlers.lostpointercapture?.({}); },
        ownerDocument: { elementFromPoint: () => target, defaultView: { addEventListener: (name, handler) => { windowHandlers[name] = handler; } } }
    };
    const binding = pointer.bind(container, (index, drag) => { calls.push({ index, drag }); return index === completesAt; });
    return { calls, binding, captured: () => captured,
        fire(name, index, extra = {}) {
            target = cells[index] || null;
            handlers[name]({ pointerId: 7, button: 0, buttons: 1, isPrimary: true, detail: 1, target, preventDefault() {}, ...extra });
        }, blur: () => windowHandlers.blur()
    };
}

test("a pointer click selects once on release, without its synthetic click", () => {
    const h = harness();
    h.fire("pointerdown", 0); assert.equal(h.captured(), 7); assert.equal(h.calls.length, 0);
    h.fire("pointerup", 0); h.fire("click", 0);
    assert.deepEqual(h.calls, [{ index: 0, drag: false }]); assert.equal(h.captured(), null);
});
test("drag visits neighboring targets once and allows backtracking", () => {
    const h = harness();
    h.fire("pointerdown", 0); h.fire("pointermove", 1); h.fire("pointermove", 1);
    h.fire("pointermove", 0); h.fire("pointerup", 0); h.fire("click", 0);
    assert.deepEqual(h.calls, [{ index: 0, drag: true }, { index: 1, drag: true }, { index: 0, drag: true }]);
});
test("completing a word ends selection until the mouse is released", () => {
    const h = harness(1);
    h.fire("pointerdown", 0); h.fire("pointermove", 1); h.fire("pointermove", 2); h.fire("pointerup", 2);
    assert.deepEqual(h.calls, [{ index: 0, drag: true }, { index: 1, drag: true }]);
});
test("leaving the grid, cancellation, blur and lost buttons do not leave a stuck drag", () => {
    for (const stop of [h => h.fire("pointercancel", -1), h => h.blur(), h => h.fire("pointermove", 1, { buttons: 0 }), h => h.binding.cancel()]) {
        const h = harness(); h.fire("pointerdown", 0); stop(h); h.fire("pointermove", 1); h.fire("pointerup", 1);
        assert.equal(h.captured(), null); assert.equal(h.calls.length, 0);
    }
    const h = harness(); h.fire("pointerdown", 0); h.fire("pointerup", -1); assert.equal(h.calls.length, 0);
});
test("keyboard clicks still work and secondary pointers cannot start or change a gesture", () => {
    const h = harness(); h.fire("click", 0, { detail: 0 });
    h.fire("pointerdown", 1, { button: 2 }); h.fire("pointerdown", 1, { isPrimary: false });
    h.fire("pointerdown", 1); h.fire("pointermove", 2, { pointerId: 8 }); h.fire("pointerup", 1);
    assert.deepEqual(h.calls, [{ index: 0, drag: false }, { index: 1, drag: false }]);
});
