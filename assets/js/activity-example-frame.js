/* Runs ONLY in the opaque-origin, sandboxed example frame. Never loads auth or AI. */
(function () {
    "use strict";
    const configNode = document.getElementById("educaria-example-config");
    if (!configNode || window.parent === window) return;
    const config = JSON.parse(configNode.textContent);
    const values = new Map([[`educaria:builder:${config.type}`, JSON.stringify(config.draft || {})]]);
    const memoryStore = { getItem: key => values.get(String(key)) ?? null, setItem: (key, value) => values.set(String(key), String(value)), removeItem: key => values.delete(String(key)), clear: () => values.clear(), key: index => [...values.keys()][index] ?? null, get length() { return values.size; } };
    // The production runtimes can keep their storage interface. This frame has no
    // same-origin permission, and both stores point exclusively to this throwaway map.
    Object.defineProperty(window, "localStorage", { value: memoryStore });
    Object.defineProperty(window, "sessionStorage", { value: memoryStore });
    const send = data => parent.postMessage({ channel: "educaria-example", instance: config.instance, ...data }, config.parentOrigin === "null" ? "*" : config.parentOrigin);
    const click = selector => document.querySelector(selector)?.click();
    function action(step) {
        document.querySelectorAll(".example-action-highlight").forEach(node => node.classList.remove("example-action-highlight"));
        if (step.click) {
            const button = document.querySelector(step.click);
            if (button && !button.disabled) { button.classList.add("example-action-highlight"); button.click(); }
        }
        if (step.action === "match") {
            const left = document.querySelector("[data-match-left-item]");
            if (left) click(`[data-match-right-item="${CSS.escape(left.dataset.matchLeftItem)}"]`);
        }
        if (step.action === "mindmap") {
            const buttons = document.querySelectorAll("[data-mind-stage-branch], [data-mind-branch-index]");
            buttons[1]?.click();
        }
    }
    let printAnswers = false, zoomed = false;
    function printPreview() {
        const core = window.EducariaWorksheet, view = window.EducariaWorksheetView;
        const data = core.normalize(config.worksheet);
        const settings = { columns: "two", trailClues: true, wordBank: true };
        const result = view.units(data, { discovery: window.EducariaDiscovery, wordsearch: window.EducarIAWordsearch, crossword: window.EducarIACrossword }, printAnswers, settings);
        const host = document.querySelector("[data-example-paper]");
        host.innerHTML = `<section class="worksheet-sheet">${view.pageHeader(data, settings, printAnswers)}<div class="worksheet-body">${result.units.map((unit, index) => index % 2 === 0 ? `<div class="worksheet-print-row">${unit}${result.units[index + 1] || ""}</div>` : "").join("")}</div><footer>${printAnswers ? "Gabarito do professor" : "Folha do aluno"} · Exemplo</footer></section>`;
        fitPaper();
    }
    function fitPaper() {
        const host = document.querySelector("[data-example-paper]"), paper = host?.firstElementChild;
        if (!paper) return;
        const scale = zoomed ? 1 : Math.min(1, (innerWidth - 28) / paper.offsetWidth, (innerHeight - 20) / paper.offsetHeight);
        paper.style.transform = `scale(${scale})`;
        host.style.width = `${paper.offsetWidth * scale}px`; host.style.height = `${paper.offsetHeight * scale}px`;
    }
    window.addEventListener("message", event => {
        if (event.source !== parent || event.origin !== config.parentOrigin || event.data?.instance !== config.instance) return;
        if (event.data.command === "step" && Number.isInteger(event.data.index)) action(config.steps[event.data.index] || {});
        if (event.data.command === "answers" && config.type === "worksheet") { printAnswers = event.data.value === true; printPreview(); }
        if (event.data.command === "zoom" && config.type === "worksheet") { zoomed = event.data.value === true; fitPaper(); }
    });
    document.addEventListener("click", event => {
        if (event.target.closest("a")) event.preventDefault();
        event.target.closest("[data-example-close-dialog]")?.closest("dialog")?.close();
    }, true);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !document.querySelector("dialog[open]")) { event.preventDefault(); send({ event: "close" }); }
        else if (event.isTrusted) send({ event: "interact" });
    });
    document.addEventListener("pointerdown", event => { if (event.isTrusted) send({ event: "interact" }); }, true);
    document.addEventListener("DOMContentLoaded", () => {
        document.body.classList.add("presentation-runtime-page", "presentation-topbar-collapsed");
        const fit = () => {
            const shell = document.querySelector(".presentation-shell");
            if (shell) shell.style.setProperty("--presentation-stage-height", `${Math.max(200, innerHeight - 20)}px`);
            document.dispatchEvent(new CustomEvent("educaria-presentation-layout-change")); fitPaper();
        };
        if (config.type === "worksheet") printPreview();
        fit(); window.addEventListener("resize", fit);
        requestAnimationFrame(() => send({ event: "ready" }));
    });
    window.addEventListener("error", event => {
        if (event instanceof ErrorEvent || event.target?.tagName === "SCRIPT") send({ event: "error" });
    }, true);
})();
