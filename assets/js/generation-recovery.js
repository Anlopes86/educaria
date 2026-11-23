/* Generated payloads are drafts in the personal library before an editor is opened.
 * Conversion to editor HTML is lazy and never makes another provider request. */
(() => {
    const prefix = "educaria:ai-result:";
    const volatile = new Map();
    const routes = Object.freeze({
        slides: "slides-builder.html", quiz: "quiz-builder.html", flashcards: "flashcards-builder.html",
        memory: "jogo-memoria-builder.html", wheel: "roleta-builder.html", match: "ligar-pontos-builder.html",
        mindmap: "mapa-mental-builder.html", debate: "debate-guiado-builder.html",
        wordsearch: "caca-palavras-builder.html", crossword: "palavras-cruzadas-builder.html", hangman: "forca-builder.html",
        worksheet: "folha-atividades-builder.html", wordtrail: "trilha-palavras-builder.html", connections: "em-comum-builder.html"
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
            material: payload?.material, cost: Number(payload?.charge?.cost || 0),
            feedback: payload?.feedback && typeof payload.feedback === "object" ? {
                message: typeof payload.feedback.message === "string" ? payload.feedback.message.slice(0, 600) : "",
                summary: typeof payload.feedback.summary === "string" ? payload.feedback.summary.slice(0, 450) : ""
            } : null
        };
        if (!valid(record, ownerUid)) throw new Error("Não foi possível identificar o resultado da atividade.");
        return record;
    }
    function save(record) {
        if (!valid(record, record?.ownerUid)) return false;
        volatile.set(key(record), record);
        try {
            if (record.ownerUid === currentUid() && typeof writeLessonsLibrary === "function") {
                const lessons = readLessonsLibrary();
                if (!lessons.some((lesson) => lesson.id === lessonId(record))) {
                    // The teacher chose this destination before generation. The
                    // class list may still be syncing when the result returns.
                    const className = String(record.className || "").trim();
                    const now = new Date(record.createdAt).toISOString();
                    writeLessonsLibrary([{
                        id: lessonId(record), materialType: record.materialType, type: record.label,
                        title: record.material.title || record.topic || "Atividade criada com IA",
                        summary: "Criada com IA. Abra para revisar e apresentar, sem gastar novos créditos.",
                        scope: className ? "class" : "library", className, status: "draft", autoFiled: !className,
                        createdAt: now, updatedAt: now, sourceMode: "topic",
                        draft: JSON.stringify({ pendingAiResult: record })
                    }, ...lessons], { source: "generated-draft" });
                }
                localStorage.removeItem(key(record));
                volatile.delete(key(record));
                return true;
            }
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
                    if (valid(record, uid) && key(record) === storageKey) results.set(lessonId(record), record);
                } catch { /* A corrupt entry must not hide other pending results. */ }
            }
        } catch { /* Volatile results can still be downloaded while this page is open. */ }
        for (const record of volatile.values()) if (valid(record, uid)) results.set(lessonId(record), record);
        if (typeof readLessonsLibrary === "function") {
            for (const lesson of readLessonsLibrary()) {
                const record = fromLesson(lesson);
                if (record) results.set(record.libraryId, record);
                else if (lesson.draft) results.delete(lesson.id); // A converted draft supersedes its legacy recovery copy.
            }
        }
        return [...results.values()].sort((a, b) => a.createdAt - b.createdAt);
    }
    function listPending() {
        // pendingAiResult means the editor has not converted the payload yet. It
        // does not mean the teacher still has to decide where to keep it.
        return list().filter(record => !record.resultAcknowledgedAt).sort((a, b) => b.createdAt - a.createdAt);
    }
    function acknowledge(record) {
        if (!valid(record, currentUid()) || !isDurable(record)) return false;
        const acknowledgedAt = Date.now();
        try {
            const lessons = typeof readLessonsLibrary === "function" ? readLessonsLibrary() : [];
            const lesson = lessons.find(item => item.id === lessonId(record));
            if (lesson) {
                const draft = JSON.parse(lesson.draft);
                if (draft.pendingAiResult) {
                    if (draft.pendingAiResult.id !== record.id || draft.pendingAiResult.ownerUid !== currentUid()) return false;
                    draft.pendingAiResult.resultAcknowledgedAt = acknowledgedAt;
                    writeLessonsLibrary(lessons.map(item => item.id === lesson.id ? {
                        ...item, draft: JSON.stringify(draft), updatedAt: new Date(acknowledgedAt).toISOString()
                    } : item), { source: "generated-result-acknowledged" });
                }
                // Converted editor content is already handled; never overwrite it.
            } else {
                localStorage.setItem(key(record), JSON.stringify({ ...record, resultAcknowledgedAt: acknowledgedAt }));
            }
            record.resultAcknowledgedAt = acknowledgedAt;
            volatile.delete(key(record));
            return true;
        } catch { return false; }
    }
    function fromLesson(lesson) {
        try {
            const record = JSON.parse(lesson?.draft || "{}").pendingAiResult;
            if (!valid(record, currentUid()) || record.materialType !== lesson.materialType) return null;
            return { ...record, libraryId: lesson.id, className: lesson.scope === "class" ? lesson.className : "" };
        } catch { return null; }
    }
    function get(id, libraryId) {
        const targetId = libraryId || `lesson-ai-${id}`;
        const pending = list().find((record) => record.id === id && lessonId(record) === targetId);
        if (pending) return pending;
        // A saved editor may be reopened from its original recovery link. Only
        // locate an existing record in this account; never recreate its content.
        const uid = currentUid();
        if (!uid || !/^[a-zA-Z0-9_-]{1,100}$/.test(id || "") || typeof readLessonsLibrary !== "function") return null;
        const saved = readLessonsLibrary().find((lesson) => lesson.id === targetId);
        try {
            if (!saved?.draft || JSON.parse(saved.draft).pendingAiResult || !Object.hasOwn(routes, saved.materialType)) return null;
            return { id, libraryId: saved.id, ownerUid: uid, materialType: saved.materialType, material: {},
                topic: saved.title || "", className: saved.scope === "class" ? saved.className : "", createdAt: Date.now() };
        } catch { return null; }
    }
    function isDurable(record) {
        try { return valid(record, currentUid()) && ((typeof readLessonsLibrary === "function"
            && readLessonsLibrary().some((lesson) => lesson.id === lessonId(record) && lesson.draft))
            || localStorage.getItem(key(record)) === JSON.stringify(record)); }
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
    function lessonId(record) { return record.libraryId || `lesson-ai-${record.id}`; }
    function editorUrl(record, destination = "edit") {
        if (!valid(record, currentUid())) throw new Error("Entre na conta que criou esta atividade para retomá-la.");
        return `${routes[record.materialType]}?new=1&quickApply=1&quickResult=${encodeURIComponent(record.id)}${record.libraryId ? `&quickLesson=${encodeURIComponent(record.libraryId)}` : ""}&quickDestination=${destination === "present" ? "present" : "edit"}`;
    }
    function preparedLesson(record) {
        if (!valid(record, currentUid()) || typeof readLessonsLibrary !== "function") return null;
        const lesson = readLessonsLibrary().find((item) => item.id === lessonId(record) && item.materialType === record.materialType);
        try {
            const draft = JSON.parse(lesson?.draft || "null");
            return draft && typeof draft === "object" && !Array.isArray(draft) && !draft.pendingAiResult ? lesson : null;
        } catch { return null; }
    }
    function backgroundPreparation() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("quickPrepare") || "";
        try {
            return params.get("quickApply") === "1" && /^[a-zA-Z0-9_-]{1,100}$/.test(token)
                && window.parent !== window && window.parent.location.origin === window.location.origin ? token : "";
        } catch { return ""; }
    }
    function reportPreparation(record, error = "") {
        const token = backgroundPreparation();
        if (!token) return false;
        window.parent.postMessage({ type: "educaria:quick-presentation-prepared", token,
            id: record.id, lessonId: lessonId(record), ownerUid: record.ownerUid, ok: !error }, window.location.origin);
        return true;
    }
    async function prepareForPresentation(record, { signal } = {}) {
        if (!valid(record, currentUid())) throw new Error("Entre na conta que criou esta atividade para apresentá-la.");
        if (signal?.aborted) throw new DOMException("Preparação cancelada.", "AbortError");
        const existing = preparedLesson(record);
        if (existing) return existing;
        // Reuse the actual builders' converters, including illustrations and game
        // layouts, without navigating away from the dashboard or calling the AI.
        return new Promise((resolve, reject) => {
            const token = crypto.randomUUID();
            const frame = document.createElement("iframe");
            frame.title = "Preparação da atividade";
            frame.setAttribute("aria-hidden", "true");
            frame.setAttribute("inert", "");
            frame.tabIndex = -1;
            frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1280px;height:800px;visibility:hidden;pointer-events:none;border:0";
            let timer;
            let finished = false;
            const finish = (error, lesson) => {
                if (finished) return;
                finished = true;
                window.clearTimeout(timer);
                window.removeEventListener("message", onMessage);
                document.removeEventListener("educaria-auth-changed", onAccountChange);
                signal?.removeEventListener("abort", onAbort);
                frame.remove();
                if (error) reject(error);
                else resolve(lesson);
            };
            const onAbort = () => finish(new DOMException("Preparação cancelada.", "AbortError"));
            const onAccountChange = () => {
                if (record.ownerUid !== currentUid()) finish(new Error("A conta foi alterada. Entre novamente para apresentar a atividade."));
            };
            const onMessage = (event) => {
                const data = event.data;
                if (event.origin !== window.location.origin || event.source !== frame.contentWindow
                    || data?.type !== "educaria:quick-presentation-prepared" || data.token !== token
                    || data.id !== record.id || data.lessonId !== lessonId(record) || data.ownerUid !== record.ownerUid) return;
                if (record.ownerUid !== currentUid()) { onAccountChange(); return; }
                const lesson = data.ok === true ? preparedLesson(record) : null;
                if (!lesson) { finish(new Error("Não foi possível preparar a apresentação. Tente novamente ou abra o editor.")); return; }
                finish(null, lesson);
            };
            window.addEventListener("message", onMessage);
            document.addEventListener("educaria-auth-changed", onAccountChange);
            signal?.addEventListener("abort", onAbort, { once: true });
            timer = window.setTimeout(() => finish(new Error("A apresentação demorou para abrir. Tente novamente ou abra o editor.")), 45000);
            frame.src = `${editorUrl(record)}&quickPrepare=${encodeURIComponent(token)}`;
            document.body.appendChild(frame);
        });
    }
    window.educariaGenerationRecovery = { currentUid, create, save, list, listPending, acknowledge, get, fromLesson, isDurable, complete, lessonId, editorUrl,
        prepareForPresentation, backgroundPreparation, reportPreparation,
        hasUnsaved: () => volatile.size > 0 };
    document.addEventListener("DOMContentLoaded", () => {
        // Rescue legacy dashboard results into the library without spending IA credits.
        for (const record of list()) if (!record.libraryId) save(record);
    });
    window.educariaQuickImportPending = new URLSearchParams(window.location.search).get("quickApply") === "1";
})();
