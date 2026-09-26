(function initEducariaPresentationMode() {
    const runtimeScriptUrl = document.currentScript?.src || "";
    const IDLE_DELAY_MS = 2600;
    const NEXT_SELECTORS = [
        "[data-presentation-next]",
        "[data-flashcard-next]",
        "[data-quiz-application-next]",
        "[data-debate-stage-next]",
        "[data-hangman-next]",
        "[data-wheel-spin]"
    ];
    const PREV_SELECTORS = [
        "[data-presentation-prev]",
        "[data-flashcard-prev]",
        "[data-quiz-application-prev]",
        "[data-debate-stage-prev]",
        "[data-hangman-prev]"
    ];

    let idleTimer = 0;

    function isEditableTarget(target) {
        return target?.closest?.("input, textarea, select, [contenteditable='true'], [data-inline-editable]");
    }

    function visibleButton(selectors) {
        return selectors
            .flatMap((selector) => [...document.querySelectorAll(selector)])
            .find((button) => !button.disabled && button.offsetParent !== null);
    }

    function showPresentationChrome() {
        document.body.classList.remove("presentation-controls-idle");
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
            if (document.body.classList.contains("presentation-topbar-pinned")) return;
            if (document.activeElement?.closest?.(".presentation-topbar, .presentation-controls, .quiz-application-actions")) return;
            document.body.classList.add("presentation-controls-idle");
        }, IDLE_DELAY_MS);
    }

    async function toggleFullscreen(button) {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch (error) {
            console.warn("EducarIA presentation fullscreen unavailable:", error);
        }
        button?.setAttribute("aria-pressed", document.fullscreenElement ? "true" : "false");
        showPresentationChrome();
    }

    function toggleTopbar(button) {
        const isPinned = document.body.classList.toggle("presentation-topbar-pinned");
        document.body.classList.toggle("presentation-topbar-collapsed", !isPinned);
        button?.setAttribute("aria-pressed", isPinned ? "false" : "true");
        showPresentationChrome();
    }

    function addTopbarRestoreAction() {
        if (document.querySelector("[data-presentation-topbar-restore]")) return;

        const restore = document.createElement("button");
        restore.type = "button";
        restore.className = "presentation-topbar-restore";
        restore.dataset.presentationTopbarRestore = "";
        restore.setAttribute("aria-label", "Mostrar novamente a barra superior");
        restore.innerHTML = '<span aria-hidden="true">⌄</span> Mostrar topo';
        restore.addEventListener("click", () => {
            const topbarButton = document.querySelector("[data-presentation-topbar]");
            if (document.body.classList.contains("presentation-topbar-collapsed")) {
                toggleTopbar(topbarButton);
            }
        });
        document.body.appendChild(restore);
    }

    function addPresentationChromeActions() {
        const actions = document.querySelector(
            ".presentation-topbar .platform-top-actions, .presentation-topbar .presentation-topbar-group"
        );
        if (!actions || actions.querySelector("[data-presentation-fullscreen]")) return;

        const fullscreen = document.createElement("button");
        fullscreen.type = "button";
        fullscreen.className = "platform-link-button platform-link-secondary presentation-chrome-button";
        fullscreen.dataset.presentationFullscreen = "";
        fullscreen.setAttribute("aria-pressed", "false");
        fullscreen.setAttribute("aria-label", "Alternar tela cheia");
        fullscreen.textContent = "Tela cheia";

        const topbar = document.createElement("button");
        topbar.type = "button";
        topbar.className = "platform-link-button platform-link-secondary presentation-chrome-button";
        topbar.dataset.presentationTopbar = "";
        topbar.setAttribute("aria-pressed", "false");
        topbar.setAttribute("aria-label", "Ocultar ou mostrar barra superior");
        topbar.textContent = "Topo";

        const print = document.createElement("button");
        print.type = "button";
        print.className = "platform-link-button platform-link-secondary presentation-chrome-button";
        print.dataset.presentationPrint = "";
        print.setAttribute("aria-label", "Imprimir a tela atual ou salvar como PDF");
        print.textContent = "Imprimir / PDF";

        fullscreen.addEventListener("click", () => toggleFullscreen(fullscreen));
        topbar.addEventListener("click", () => toggleTopbar(topbar));
        print.addEventListener("click", () => {
            document.body.classList.remove("presentation-controls-idle");
            window.print();
        });

        actions.prepend(topbar);
        actions.prepend(print);
        actions.prepend(fullscreen);
    }

    function loadOfflineRuntime() {
        if (!runtimeScriptUrl || document.querySelector("script[data-educaria-offline-runtime]")) return;
        const script = document.createElement("script");
        script.src = new URL("offline-runtime.js", runtimeScriptUrl).href;
        script.defer = true;
        script.dataset.educariaOfflineRuntime = "";
        document.head.appendChild(script);
    }

    loadOfflineRuntime();

    document.addEventListener("DOMContentLoaded", () => {
        if (!document.querySelector(".presentation-shell")) return;

        document.body.classList.add("presentation-runtime-page", "presentation-topbar-pinned");
        addPresentationChromeActions();
        addTopbarRestoreAction();
        showPresentationChrome();

        ["mousemove", "pointerdown", "focusin", "touchstart", "keydown"].forEach((eventName) => {
            document.addEventListener(eventName, showPresentationChrome, { passive: true });
        });

        document.addEventListener("fullscreenchange", () => {
            document.querySelector("[data-presentation-fullscreen]")?.setAttribute(
                "aria-pressed",
                document.fullscreenElement ? "true" : "false"
            );
        });

        document.addEventListener("keydown", (event) => {
            if (isEditableTarget(event.target)) return;

            const key = event.key;
            if (key === "f" || key === "F") {
                event.preventDefault();
                toggleFullscreen(document.querySelector("[data-presentation-fullscreen]"));
                return;
            }

            if (key === "t" || key === "T") {
                event.preventDefault();
                toggleTopbar(document.querySelector("[data-presentation-topbar]"));
                return;
            }

            if (key === "ArrowLeft") {
                const previous = visibleButton(PREV_SELECTORS);
                if (previous) {
                    event.preventDefault();
                    previous.click();
                }
                return;
            }

            if (key === "ArrowRight" || key === " " || key === "Enter") {
                const next = visibleButton(NEXT_SELECTORS);
                if (next) {
                    event.preventDefault();
                    next.click();
                }
            }
        });
    });
})();
