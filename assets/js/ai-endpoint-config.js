(() => {
    const LOCAL_ENDPOINT = "http://localhost:8787/api/ai/generate";
    const REMOTE_ENDPOINT = "https://educaria-ai-service.onrender.com/api/ai/generate";

    const hostname = window.location.hostname || "";
    const isLocal =
        window.location.protocol === "file:" ||
        hostname === "localhost" ||
        hostname === "127.0.0.1";

    window.EDUCARIA_AI_ENDPOINT = isLocal ? LOCAL_ENDPOINT : REMOTE_ENDPOINT;

    function resolveAiEndpoint(path = "/api/ai/generate") {
        return window.EDUCARIA_AI_ENDPOINT.replace(/\/api\/ai\/generate$/, path);
    }

    async function waitForFirebaseUser(auth) {
        if (auth.currentUser) return auth.currentUser;

        return new Promise((resolve) => {
            let unsubscribe = () => {};
            const timeoutId = window.setTimeout(() => {
                unsubscribe();
                resolve(null);
            }, 5000);

            unsubscribe = auth.onAuthStateChanged((user) => {
                window.clearTimeout(timeoutId);
                unsubscribe();
                resolve(user || null);
            });
        });
    }

    window.educariaAiAuthHeaders = async function educariaAiAuthHeaders() {
        if (typeof firebaseServices !== "function") return {};

        const services = firebaseServices();
        const user = services?.auth ? await waitForFirebaseUser(services.auth) : null;
        if (!user) return {};

        return {
            Authorization: `Bearer ${await user.getIdToken()}`
        };
    };

    window.educariaAiCreditsEndpoint = function educariaAiCreditsEndpoint() {
        return resolveAiEndpoint("/api/ai/credits");
    };

    window.educariaBillingCheckoutEndpoint = function educariaBillingCheckoutEndpoint() {
        return resolveAiEndpoint("/api/billing/checkout");
    };

    window.educariaBillingStatusEndpoint = function educariaBillingStatusEndpoint() {
        return resolveAiEndpoint("/api/billing/status");
    };

    window.educariaAiEndpoint = function educariaAiEndpoint(path = "/api/ai/generate") {
        return resolveAiEndpoint(path);
    };
})();
