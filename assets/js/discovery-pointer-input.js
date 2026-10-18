/* Pointer gestures stay on a stable container while the grid is redrawn. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.EducariaTrailPointer = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";
    function bind(container, select) {
        let gesture = null;
        const cellAt = target => {
            const button = target?.closest?.("[data-cell]");
            return button && container.contains(button) && button.getAttribute("aria-disabled") !== "true" ? Number(button.dataset.cell) : null;
        };
        function cancel() {
            const id = gesture?.id;
            gesture = null;
            if (id != null && container.hasPointerCapture?.(id)) container.releasePointerCapture(id);
        }
        container.addEventListener("pointerdown", event => {
            if (event.button !== 0 || event.isPrimary === false || gesture) return;
            const cell = cellAt(event.target);
            if (cell == null) return;
            gesture = { id: event.pointerId, start: cell, last: cell, dragged: false, done: false };
            container.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        container.addEventListener("pointermove", event => {
            if (!gesture || gesture.id !== event.pointerId || gesture.done) return;
            if (!(event.buttons & 1)) { cancel(); return; }
            const cell = cellAt(container.ownerDocument.elementFromPoint(event.clientX, event.clientY));
            if (cell == null || cell === gesture.last) return;
            event.preventDefault();
            if (!gesture.dragged) {
                gesture.dragged = true;
                if (select(gesture.start, true)) { gesture.done = true; return; }
            }
            gesture.last = cell;
            gesture.done = select(cell, true) === true;
        });
        container.addEventListener("pointerup", event => {
            if (!gesture || gesture.id !== event.pointerId) return;
            const cell = cellAt(container.ownerDocument.elementFromPoint(event.clientX, event.clientY));
            if (!gesture.dragged && cell === gesture.start) select(cell, false);
            cancel();
        });
        container.addEventListener("pointercancel", cancel);
        container.addEventListener("lostpointercapture", cancel);
        // Pointer clicks are already handled on release; keyboard/AT clicks have detail 0.
        container.addEventListener("click", event => {
            const cell = cellAt(event.target);
            if (event.detail === 0 && cell != null) select(cell, false);
        });
        container.ownerDocument.defaultView?.addEventListener("blur", cancel);
        return { cancel };
    }
    return Object.freeze({ bind });
});
