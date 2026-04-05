(() => {
    const LOCAL_ENDPOINT = "http://localhost:8787/api/ai/generate";
    const REMOTE_ENDPOINT = "https://educaria-ai-service.onrender.com/api/ai/generate";

    const hostname = window.location.hostname || "";
    const isLocal =
        window.location.protocol === "file:" ||
        hostname === "localhost" ||
        hostname === "127.0.0.1";

    window.EDUCARIA_AI_ENDPOINT = isLocal ? LOCAL_ENDPOINT : REMOTE_ENDPOINT;
})();
