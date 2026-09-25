const EDUCARIA_CACHE_PREFIX = "educaria-static-";
const EDUCARIA_CACHE_NAME = `${EDUCARIA_CACHE_PREFIX}v1`;
const EDUCARIA_SHELL_PATHS = [
    "./",
    "./index.html",
    "./login.html",
    "./assets/css/estilo-premium.css",
    "./assets/js/offline-runtime.js"
];

function isCacheableRequest(request) {
    if (request.method !== "GET") return false;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return false;
    if (url.pathname.includes("/api/")) return false;
    if (url.pathname.includes("/__/auth/")) return false;
    if (url.pathname.endsWith("service-worker.js")) return false;
    if (/firebase-config(?:\.local)?\.js$/i.test(url.pathname)) return false;
    if (request.headers.has("authorization")) return false;
    return true;
}

async function cacheResponse(request, response) {
    if (!response || !response.ok || response.type === "opaque") return response;
    try {
        const cache = await caches.open(EDUCARIA_CACHE_NAME);
        await cache.put(request, response.clone());
    } catch (error) {
        console.warn("EducarIA could not update its offline cache:", error);
    }
    return response;
}

async function networkFirst(request) {
    try {
        return await cacheResponse(request, await fetch(request));
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;

        return new Response(
            "<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>EducarIA offline</title><style>body{font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a}main{max-width:34rem;padding:2rem}h1{font-size:1.5rem}p{line-height:1.6}</style><main><h1>Você está sem conexão</h1><p>Abra novamente um material visitado neste dispositivo ou restabeleça a internet para continuar.</p></main>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    const update = fetch(request)
        .then((response) => cacheResponse(request, response))
        .catch(() => null);
    return cached || update;
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(EDUCARIA_CACHE_NAME)
            .then((cache) => cache.addAll(EDUCARIA_SHELL_PATHS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name.startsWith(EDUCARIA_CACHE_PREFIX) && name !== EDUCARIA_CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (!isCacheableRequest(event.request)) return;

    const acceptsHtml = event.request.mode === "navigate"
        || event.request.headers.get("accept")?.includes("text/html");
    event.respondWith(acceptsHtml ? networkFirst(event.request) : staleWhileRevalidate(event.request));
});
