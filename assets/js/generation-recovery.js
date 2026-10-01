/* Pending AI results stay on this device until a library record is saved.
 * No provider request is made when a result is recovered. */
(() => {
    const prefix = "educaria:ai-result:";
    const volatile = new Map();
    const routes = Object.freeze({
        slides: "slides-builder.html", quiz: "quiz-builder.html", flashcards: "flashcards-builder.html",
        memory: "jogo-memoria-builder.html", wheel: "roleta-builder.html", match: "ligar-pontos-builder.html",
        mindmap: "mapa-mental-builder.html", debate: "debate-guiado-builder.html",
        wordsearch: "caca-palavras-builder.html", crossword: "palavras-cruzadas-builder.html", hangman: "forca-builder.html"
    });
    function currentUid() {
        try { return String(JSON.parse(localStorage.getItem("educaria:auth:teacher-cache") || "null")?.uid || ""); }
        catch { return ""; }
    }
    function valid(record, uid) {
        return Boolean(uid && record?.ownerUid === uid && /^[a-zA-Z0-9_-]{1,100}$/.test(record.id || "")
            && Object.hasOwn(routes, record.materialType) && record.material && typeof record.material === "object"
            && !Array.isArray(record.material) && Number.isFinite(record.createdAt));
    }
    function key(record) {
        // Keep the account suffix compatible with local account cleanup. The exact
        // UID is also encoded in the key and checked in the payload (UIDs are case-sensitive).
        const scope = record.ownerUid.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
        return `${prefix}${encodeURIComponent(record.ownerUid)}:${record.id}:${scope}`;
    }
    function create({ ownerUid, topic, materialType, className, label, payload }) {
        const record = {
            id: crypto.randomUUID(), ownerUid, createdAt: Date.now(), topic, materialType, className, label,
            material: payload?.material, cost: Number(payload?.charge?.cost || 0)
        };
        if (!valid(record, ownerUid)) throw new Error("Não foi possível identificar o resultado da atividade.");
        return record;
    }
    function save(record) {
        if (!valid(record, record?.ownerUid)) return false;
        volatile.set(key(record), record);
        try {
            localStorage.setItem(key(record), JSON.stringify(record));
            volatile.delete(key(record));
            return true;
        } catch { return false; }
    }
    function list() {
        const uid = currentUid();
        const results = new Map();
        try {
            for (let i = 0; i < localStorage.length; i += 1) {
                const storageKey = localStorage.key(i);
                if (!storageKey?.startsWith(prefix)) continue;
                try {
                    const record = JSON.parse(localStorage.getItem(storageKey));
                    if (valid(record, uid) && key(record) === storageKey) results.set(record.id, record);
                } catch { /* A corrupt entry must not hide other pending results. */ }
            }
        } catch { /* Volatile results can still be downloaded while this page is open. */ }
        for (const record of volatile.values()) if (valid(record, uid)) results.set(record.id, record);
        return [...results.values()].sort((a, b) => a.createdAt - b.createdAt);
    }
    function get(id) { return list().find((record) => record.id === id) || null; }
    function isDurable(record) {
        try { return valid(record, currentUid()) && localStorage.getItem(key(record)) === JSON.stringify(record); }
        catch { return false; }
    }
    function complete(id, savedLesson) {
        const record = get(id);
        if (!record || savedLesson?.id !== lessonId(record) || savedLesson.materialType !== record.materialType || !savedLesson.draft) return false;
        try {
            localStorage.removeItem(key(record));
            volatile.delete(key(record));
            return true;
        } catch { return false; } // Replaying a saved ID never overwrites the saved lesson.
    }
    function lessonId(record) { return `lesson-ai-${record.id}`; }
    function editorUrl(record, destination = "edit") {
        if (!valid(record, currentUid())) throw new Error("Entre na conta que criou esta atividade para retomá-la.");
        return `${routes[record.materialType]}?new=1&quickApply=1&quickResult=${encodeURIComponent(record.id)}&quickDestination=${destination === "present" ? "present" : "edit"}`;
    }
    window.educariaGenerationRecovery = { currentUid, create, save, list, get, isDurable, complete, lessonId, editorUrl,
        hasUnsaved: () => volatile.size > 0 };
    window.educariaQuickImportPending = new URLSearchParams(window.location.search).get("quickApply") === "1";
})();
