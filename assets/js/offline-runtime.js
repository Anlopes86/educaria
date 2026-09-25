(function initEducariaOfflineRuntime() {
    if (window.__educariaOfflineRuntimeLoaded) return;
    window.__educariaOfflineRuntimeLoaded = true;

    const runtimeScriptUrl = document.currentScript?.src || "";
    let hideTimer = 0;

    function statusElement() {
        let status = document.querySelector("[data-educaria-connectivity-status]");
        if (status) return status;

        status = document.createElement("div");
        status.className = "educaria-connectivity-status";
        status.dataset.educariaConnectivityStatus = "";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        status.setAttribute("aria-atomic", "true");
        document.body.appendChild(status);
        return status;
    }

    function showStatus(isOnline, initial = false) {
        const status = statusElement();
        window.clearTimeout(hideTimer);
        status.classList.toggle("is-online", isOnline);
        status.textContent = isOnline
            ? "Conexão restabelecida."
            : "Sem conexão. Materiais já abertos continuam disponíveis.";
        status.classList.add("is-visible");

        if (isOnline && !initial) {
            hideTimer = window.setTimeout(() => status.classList.remove("is-visible"), 3200);
        } else if (isOnline) {
            status.classList.remove("is-visible");
        }
    }

    async function registerServiceWorker() {
        if (!("serviceWorker" in navigator) || !runtimeScriptUrl) return;
        if (!/^https?:$/.test(window.location.protocol)) return;

        try {
            const serviceWorkerUrl = new URL("../../service-worker.js", runtimeScriptUrl);
            await navigator.serviceWorker.register(serviceWorkerUrl.href, {
                scope: new URL("../../", runtimeScriptUrl).pathname
            });
            document.documentElement.dataset.educariaOffline = "registered";
        } catch (error) {
            document.documentElement.dataset.educariaOffline = "unavailable";
            console.warn("EducarIA offline support unavailable:", error);
        }
    }

    function start() {
        showStatus(navigator.onLine, true);
        window.addEventListener("offline", () => showStatus(false));
        window.addEventListener("online", () => showStatus(true));
        registerServiceWorker();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
