(() => {
    let sessionVersion = 0;
    let accessPromise = null;
    const pending = new Set();

    async function request(path, params = {}, signal) {
        if (!["/access", "/users", "/usage", "/usage/export"].includes(path)) throw new Error("Consulta administrativa inválida.");
        const version = sessionVersion;
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
        pending.add(controller);
        const timeout = setTimeout(abort, 60_000);
        try {
            const headers = await window.educariaAiAuthHeaders?.();
            if (version !== sessionVersion || controller.signal.aborted) throw new DOMException("Consulta cancelada", "AbortError");
            if (!headers?.Authorization) throw Object.assign(new Error("Entre novamente para continuar."), { status: 401 });
            const endpoint = window.educariaAiEndpoint?.(`/api/admin${path}`);
            if (!endpoint) throw new Error("Serviço administrativo indisponível.");
            const url = new URL(endpoint);
            for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
            const response = await fetch(url, { method: "GET", headers, cache: "no-store", credentials: "omit", signal: controller.signal });
            if (version !== sessionVersion) throw new DOMException("Consulta cancelada", "AbortError");
            if (!response.ok) {
                const messages = { 401: "Sua sessão expirou. Entre novamente.", 403: "Esta área é exclusiva da administração.",
                    429: "Muitas consultas. Aguarde um minuto e tente novamente.", 503: "O serviço está indisponível no momento. Tente novamente." };
                throw Object.assign(new Error(messages[response.status] || "Não foi possível consultar os dados. Tente novamente."), { status: response.status });
            }
            const payload = await response.json();
            if (version !== sessionVersion || controller.signal.aborted) throw new DOMException("Consulta cancelada", "AbortError");
            return payload;
        } finally {
            clearTimeout(timeout);
            pending.delete(controller);
            signal?.removeEventListener("abort", abort);
        }
    }

    window.educariaAdminApi = {
        request,
        access() {
            if (!accessPromise) {
                const promise = request("/access").then(payload => payload.ok === true && payload.isAdmin === true);
                accessPromise = promise;
                promise.finally(() => { if (accessPromise === promise) accessPromise = null; }).catch(() => {});
            }
            return accessPromise;
        }
    };
    function invalidateSession() {
        sessionVersion += 1;
        pending.forEach(controller => controller.abort());
        accessPromise = null;
    }
    document.addEventListener("educaria-auth-changed", invalidateSession);
    // A restored page must recheck permission rather than reuse an aborted check.
    window.addEventListener("pagehide", invalidateSession);
})();
