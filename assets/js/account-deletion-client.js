(() => {
    const key = "educaria:account-deletion:pending";
    function read() {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value?.uid && /^[a-f0-9]{64}$/.test(value.receipt || "") ? value : null;
        } catch { return null; }
    }
    function clear(receipt) {
        if (read()?.receipt === receipt) localStorage.removeItem(key);
    }
    function clearLocalData(uid) {
        if (typeof uid !== "string" || !uid) return;
        const actorId = uid.toLowerCase();
        const scope = actorId.replace(/[^a-z0-9_-]+/g, "-");
        const keys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
            const item = localStorage.key(index);
            if (!item?.startsWith("educaria:")) continue;
            if (item.endsWith(`:${scope}`) || item.startsWith(`educaria:milestone:${actorId}:`)
                || item === `educaria:dashboard-tour:${actorId}`) keys.push(item);
        }
        keys.forEach((item) => localStorage.removeItem(item));
        try {
            if (JSON.parse(localStorage.getItem("educaria:auth:teacher-cache") || "null")?.uid === uid) {
                localStorage.removeItem("educaria:auth:teacher-cache");
                localStorage.removeItem("educaria:auth:session");
            }
            const events = JSON.parse(localStorage.getItem("educaria:analytics:events") || "[]");
            if (Array.isArray(events)) localStorage.setItem("educaria:analytics:events", JSON.stringify(events.filter((event) => event.teacherUid !== uid)));
        } catch { console.warn("EducarIA local account cleanup unavailable."); }
    }
    async function start(user, auth) {
        const token = await user.getIdToken(true);
        if (auth.currentUser?.uid !== user.uid) throw new Error("A conta mudou. Entre novamente antes de continuar.");
        const previous = read();
        if (previous && previous.uid !== user.uid) {
            throw new Error("Há outra exclusão em acompanhamento neste navegador. Confira o andamento antes de continuar.");
        }
        const pending = previous || {
            uid: user.uid,
            receipt: Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("")
        };
        // Persist the status-only receipt BEFORE sending; survive a lost response.
        localStorage.setItem(key, JSON.stringify(pending));
        if (read()?.receipt !== pending.receipt) throw new Error("Não foi possível guardar o comprovante neste navegador. Libere espaço e tente novamente.");
        try {
            const response = await fetch(window.educariaAiEndpoint("/api/account"), {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ version: 1, confirmation: "EXCLUIR", receipt: pending.receipt }),
                signal: AbortSignal.timeout(45_000)
            });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 202 && payload.ok && ["pending", "completed"].includes(payload.status)) return pending;
            if ([400, 401, 403, 429].includes(response.status) || payload.code === "deletion_unavailable") {
                if (!previous) clear(pending.receipt);
                throw Object.assign(new Error(payload.error || "Não foi possível solicitar a exclusão. Tente novamente."), { confirmedRejection: true });
            }
            throw new Error("unconfirmed_request");
        } catch (error) {
            if (error.confirmedRejection) throw error;
            throw Object.assign(new Error("A solicitação precisa ser conferida no acompanhamento."), { deletionPending: true });
        }
    }
    async function status(pending) {
        const response = await fetch(window.educariaAiEndpoint("/api/account/deletion-status"), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pending), signal: AbortSignal.timeout(45_000)
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 404) return { status: "not_found" };
        if (!response.ok || !["pending", "retrying", "completed"].includes(payload.status)) throw new Error("status_unavailable");
        return payload;
    }
    window.educariaAccountDeletion = { read, clear, clearLocalData, start, status };
    if (read()) document.querySelectorAll("[data-account-deletion-link]").forEach((link) => { link.hidden = false; });
})();
