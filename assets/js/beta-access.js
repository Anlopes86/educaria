(() => {
    const pending = new Map();
    const isWaitlist = () => document.body?.dataset.authScreen === "waitlist";
    const waitlistPath = () => location.pathname.includes("/plataforma/") ? "../lista-espera.html" : "lista-espera.html";
    async function request(path, user) {
        const headers = { ...await window.educariaAppCheckHeaders?.() };
        if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
        const response = await fetch(window.educariaAiEndpoint(`/api/beta/${path}`), {
            method: user ? "POST" : "GET", headers, credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(60_000)
        });
        if (!response.ok) throw Object.assign(new Error("Não foi possível conferir o acesso ao beta. Tente novamente em instantes."), { code: "beta_unavailable" });
        const payload = await response.json();
        if (!payload.ok || (user && !["open", "approved", "waitlisted"].includes(payload.access?.status))) throw new Error("Resposta de acesso inválida.");
        if (user && firebaseServices()?.auth.currentUser?.uid !== user.uid) throw Object.assign(new Error("A conta mudou. Entre novamente."), { code: "auth/session-changed" });
        return payload;
    }
    function enroll(user) {
        if (!user?.uid) return Promise.reject(new Error("Entre novamente para continuar."));
        if (!pending.has(user.uid)) {
            const promise = request("enroll", user).then(result => result.access);
            pending.set(user.uid, promise);
            promise.finally(() => { if (pending.get(user.uid) === promise) pending.delete(user.uid); }).catch(() => {});
        }
        return pending.get(user.uid);
    }
    async function requireAccess(user) {
        const access = await enroll(user);
        if (access.status === "waitlisted") throw Object.assign(new Error("Seu cadastro está na lista de espera do beta."), { code: "beta_waitlisted" });
        return access;
    }
    async function updateRegistration() {
        const form = document.querySelector("[data-register-form]");
        const note = document.querySelector("[data-beta-registration]");
        if (!form || !note) return;
        try {
            const availability = await request("status");
            if (!availability.enabled) return;
            note.hidden = false;
            const full = availability.remaining === 0;
            note.textContent = full
                ? "Em breve, novas vagas serão liberadas. Cadastre-se na lista de espera e acompanhe a liberação do seu acesso ao fazer login."
                : `Estamos recebendo novos professores no beta. Restam ${availability.remaining} ${availability.remaining === 1 ? "vaga" : "vagas"} nesta etapa. O acesso é confirmado ao concluir o cadastro.`;
            const submit = form.querySelector('[type="submit"]');
            submit.removeAttribute("data-i18n");
            submit.textContent = full ? "Entrar na lista de espera" : "Criar conta no beta";
        } catch {
            note.hidden = false;
            note.textContent = "As vagas serão conferidas ao concluir seu cadastro. Se estiverem preenchidas, você entrará na lista de espera.";
        }
    }
    async function checkWaitlist() {
        if (!isWaitlist()) return;
        const status = document.querySelector("[data-beta-waitlist-status]");
        const retry = document.querySelector("[data-beta-retry]");
        const services = firebaseServices();
        const user = services?.auth.currentUser;
        if (!user) return;
        retry.disabled = true;
        status.textContent = "Conferindo seu cadastro…";
        try {
            const access = await enroll(user);
            if (access.status !== "waitlisted") { location.replace("login.html"); return; }
            status.textContent = "Seu cadastro já está na lista de espera. Você pode acompanhar a liberação do seu acesso por aqui.";
        } catch (error) { status.textContent = error.message; }
        finally { retry.disabled = false; }
    }
    window.educariaBetaAccess = { enroll, requireAccess, waitlistPath, checkWaitlist };
    async function init() {
        await window.educariaFirebaseConfigReady;
        const services = firebaseServices();
        if (!services) return;
        void updateRegistration();
        if (!isWaitlist()) return;
        document.querySelector("[data-beta-retry]")?.addEventListener("click", checkWaitlist);
        services.auth.onAuthStateChanged(user => {
            if (user) void checkWaitlist();
            else location.replace("login.html");
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else void init();
})();
