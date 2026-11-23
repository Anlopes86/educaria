(function (root, factory) {
    const api = factory(root);
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.EducariaQuizContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
    "use strict";
    const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    function collect(lessons, ownerUid, readPrompts = () => []) {
        if (!ownerUid || !Array.isArray(lessons)) return [];
        const result = [], seen = new Set(); let size = 0;
        const recent = lessons.filter(lesson => lesson?.materialType === "quiz")
            .sort((a, b) => (Date.parse(b.updatedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.createdAt) || 0)).slice(0, 12);
        for (const lesson of recent) {
            try {
                const draft = JSON.parse(lesson.draft || "{}");
                if (draft.pendingAiResult && draft.pendingAiResult.ownerUid !== ownerUid) continue;
                const questions = draft.pendingAiResult ? (draft.pendingAiResult.material?.questions || []).map(item => item.prompt)
                    : readPrompts(draft.stackHtml || "");
                for (const value of questions) {
                    if (typeof value !== "string") continue;
                    const text = value.replace(/\s+/g, " ").trim();
                    // Keep complete statements; never send answers, class names or
                    // a whole activity just to help the model avoid repetition.
                    if (!text || text.length > 180 || seen.has(normalize(text)) || size + text.length > 2600) continue;
                    result.push(text); seen.add(normalize(text)); size += text.length;
                    if (result.length === 24) return result;
                }
            } catch { /* An old/corrupt draft must not prevent creation. */ }
        }
        return result;
    }
    function currentOwner() { return root.educariaGenerationRecovery?.currentUid() || ""; }
    function forRequest() {
        const ownerUid = currentOwner();
        if (!ownerUid || typeof root.readLessonsLibrary !== "function") return null;
        try {
            const questions = collect(root.readLessonsLibrary(), ownerUid, html => {
                if (!html || html.length > 500000) return [];
                const template = root.document.createElement("template");
                template.innerHTML = html; // Inert template: no scripts, images or handlers execute.
                return [...template.content.querySelectorAll('[data-quiz-question] [data-field="prompt"]')]
                    .map(field => field.value || field.textContent || "");
            });
            return { ownerUid, questions };
        } catch { return null; }
    }
    return Object.freeze({ collect, currentOwner, forRequest });
});
