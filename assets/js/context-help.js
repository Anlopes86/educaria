(function () {
    "use strict";
    // Explicit opt-in only: validation, file limits and status messages stay visible.
    // Without Popover API support the original help text remains in the page.
    if (!("showPopover" in HTMLElement.prototype)) return;
    const attached = new WeakSet();
    let active, sequence = 0;

    function close(entry = active) {
        if (!entry) return;
        clearTimeout(entry.timer); entry.pinned = false;
        if (entry.tip.matches(":popover-open")) entry.tip.hidePopover();
        entry.button.setAttribute("aria-expanded", "false");
        if (active === entry) active = null;
    }
    function position(entry) {
        const anchor = entry.button.getBoundingClientRect(), tip = entry.tip;
        if (!entry.button.isConnected || anchor.bottom < 0 || anchor.top > innerHeight) { close(entry); return; }
        const width = tip.getBoundingClientRect().width;
        const height = tip.getBoundingClientRect().height;
        tip.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, anchor.left))}px`;
        tip.style.top = `${Math.max(12, Math.min(innerHeight - height - 12, anchor.bottom + height + 20 <= innerHeight ? anchor.bottom + 8 : anchor.top - height - 8))}px`;
    }
    function show(entry) {
        if (active && active !== entry) close(active);
        clearTimeout(entry.timer);
        if (!entry.tip.matches(":popover-open")) entry.tip.showPopover();
        active = entry; entry.button.setAttribute("aria-expanded", "true"); position(entry);
    }
    function leave(entry) {
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => {
            if (!entry.pinned && document.activeElement !== entry.button && !entry.tip.matches(":hover") && !entry.button.matches(":hover")) close(entry);
        }, 160);
    }
    function attach(tip) {
        if (attached.has(tip) || tip.closest('[role="status"], [role="alert"], [aria-live]') || !tip.textContent.trim()) return;
        attached.add(tip);
        if (!tip.id) { do { sequence++; } while (document.getElementById(`context-help-${sequence}`)); tip.id = `context-help-${sequence}`; }
        const button = document.createElement("button");
        button.type = "button"; button.className = "context-help-trigger";
        button.dataset.contextHelpTrigger = tip.id;
        button.setAttribute("aria-label", `Ajuda: ${tip.dataset.contextHelp}`);
        button.setAttribute("aria-controls", tip.id); button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-describedby", tip.id);
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.5h.01"/></svg>';
        // A field label and its help button are siblings; never nest a button in a label.
        const field = tip.closest(".platform-field"), label = field?.querySelector(":scope > label");
        if (label && !label.querySelector("input, select, textarea")) {
            const row = document.createElement("div"); row.className = "context-help-label";
            label.before(row); row.append(label, button);
        } else {
            const row = document.createElement("span"); row.className = "context-help-inline";
            const caption = document.createElement("span"); caption.textContent = tip.dataset.contextHelp;
            row.append(caption, button); tip.before(row);
        }
        tip.classList.add("context-help-popover"); tip.setAttribute("popover", "auto"); tip.setAttribute("role", "tooltip");
        const entry = { tip, button, pinned: false };
        button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); if (entry.pinned) close(entry); else { show(entry); entry.pinned = true; } });
        button.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") show(entry); });
        button.addEventListener("pointerleave", () => leave(entry));
        button.addEventListener("focus", () => show(entry));
        button.addEventListener("blur", () => leave(entry));
        tip.addEventListener("pointerenter", () => clearTimeout(entry.timer));
        tip.addEventListener("pointerleave", () => leave(entry));
        tip.addEventListener("toggle", () => {
            const open = tip.matches(":popover-open"); button.setAttribute("aria-expanded", String(open));
            if (!open) { entry.pinned = false; if (active === entry) active = null; }
        });
    }
    function enhance(root) {
        if (!(root instanceof Element || root instanceof Document)) return;
        if (root.matches?.("[data-context-help]")) attach(root);
        root.querySelectorAll("[data-context-help]").forEach(attach);
    }
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && active) { event.preventDefault(); event.stopPropagation(); close(); }
    }, true);
    document.addEventListener("scroll", () => { if (active) position(active); }, true);
    window.addEventListener("resize", () => { if (active) position(active); });
    document.addEventListener("DOMContentLoaded", () => {
        enhance(document);
        new MutationObserver(records => {
            if (active && (!active.tip.isConnected || !active.button.isConnected)) close();
            for (const record of records) record.addedNodes.forEach(enhance);
            if (active) position(active);
        }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
    });
})();
