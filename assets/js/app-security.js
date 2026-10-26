(() => {
    // Public site identifier, not an API credential. Domain validation is configured in Google Cloud.
    const siteKey = "6LcgAgIuAAAAACjrkxbsrrPY1Ng2jrZkprQyp1-8";
    let appCheck;
    let dialog;
    let sending = false;
    let lastSent = { uid: "", at: 0 };
    const currentUser = () => typeof firebase !== "undefined" && firebase.apps.length ? firebase.auth().currentUser : null;

    window.educariaInitializeAppCheck = function () {
        if (appCheck || !siteKey || typeof firebase === "undefined" || typeof firebase.appCheck !== "function") return;
        try {
            const instance = firebase.appCheck();
            instance.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey), true);
            appCheck = instance;
            // Diagnose the rollout without exposing tokens, account identifiers or provider errors.
            instance.onTokenChanged({
                next: () => console.debug("EducarIA App Check: acesso validado."),
                error: () => console.warn("EducarIA App Check: não foi possível validar o acesso.")
            });
        } catch {
            console.warn("EducarIA App Check: proteção indisponível neste navegador.");
        }
    };
    window.educariaAppCheckHeaders = async function () {
        if (!appCheck) return {};
        try {
            const result = await appCheck.getToken(false);
            return { "X-Firebase-AppCheck": result.token };
        } catch {
            // During staged rollout the server decides whether attestation is mandatory.
            return {};
        }
    };

    function style() {
        if (document.querySelector("[data-account-security-style]")) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = new URL("../css/components/account-security.css", document.querySelector('script[src*="app-security.js"]').src).href;
        link.dataset.accountSecurityStyle = "";
        document.head.append(link);
    }
    function feedback(message) {
        if (dialog) dialog.querySelector("[data-verification-feedback]").textContent = message;
    }
    window.educariaSendVerificationEmail = async function (user = currentUser()) {
        if (!user || user.emailVerified || sending) return;
        let sentAt = lastSent.uid === user.uid ? lastSent.at : 0;
        try { sentAt = Math.max(sentAt, Number(sessionStorage.getItem(`educaria:verification:${user.uid}`)) || 0); } catch { /* Storage is optional. */ }
        if (Date.now() - sentAt < 60_000) { feedback("Aguarde um minuto antes de pedir outro e-mail."); return; }
        sending = true;
        try {
            await user.sendEmailVerification();
            lastSent = { uid: user.uid, at: Date.now() };
            try { sessionStorage.setItem(`educaria:verification:${user.uid}`, String(lastSent.at)); } catch { /* Storage is optional. */ }
            if (currentUser()?.uid === user.uid) feedback("E-mail enviado. Confira também a pasta de spam. Depois de abrir o link, clique em Já confirmei.");
        } catch (error) {
            if (currentUser()?.uid === user.uid) feedback(error?.code === "auth/too-many-requests"
                ? "Já foram feitos vários pedidos. Aguarde alguns minutos e tente novamente."
                : "Não foi possível enviar agora. Tente novamente em instantes.");
        } finally { sending = false; }
    };
    async function refreshVerification() {
        const user = currentUser();
        if (!user) return;
        feedback("Conferindo sua confirmação…");
        try {
            await user.reload();
            if (currentUser()?.uid !== user.uid) return;
            await user.getIdToken(true);
            if (!user.emailVerified) { feedback("Seu e-mail ainda não foi confirmado. Abra o link que enviamos e tente novamente."); return; }
            dialog?.close();
            document.querySelector("[data-email-verification-banner]")?.remove();
            document.dispatchEvent(new CustomEvent("educaria-email-verified"));
        } catch { feedback("Não foi possível conferir agora. Tente novamente em instantes."); }
    }
    window.educariaShowEmailVerification = function () {
        const user = currentUser();
        if (!user || user.emailVerified) return;
        style();
        if (!dialog) {
            dialog = document.createElement("dialog");
            dialog.className = "account-verification-dialog";
            dialog.setAttribute("aria-labelledby", "account-verification-title");
            dialog.innerHTML = '<button type="button" class="verification-close" aria-label="Fechar">×</button><h2 id="account-verification-title">Confirme seu e-mail</h2><p>Para usar a IA, abra o link de confirmação enviado para:</p><strong data-verification-email></strong><p>Seus materiais continuam disponíveis.</p><div class="verification-actions"><button type="button" data-verification-send>Enviar confirmação</button><button type="button" data-verification-refresh>Já confirmei</button></div><p data-verification-feedback role="status" aria-live="polite"></p>';
            dialog.querySelector(".verification-close").addEventListener("click", () => dialog.close());
            dialog.querySelector("[data-verification-send]").addEventListener("click", () => window.educariaSendVerificationEmail());
            dialog.querySelector("[data-verification-refresh]").addEventListener("click", refreshVerification);
            document.body.append(dialog);
        }
        dialog.querySelector("[data-verification-email]").textContent = user.email || "sua conta";
        feedback("");
        if (!dialog.open) dialog.showModal();
    };
    window.educariaRequireVerifiedEmail = async function (user) {
        if (user?.emailVerified) return;
        // Refresh once so confirmation in another tab is recognized automatically.
        if (user) {
            try { await user.reload(); } catch { /* Server verification remains authoritative. */ }
            if (currentUser()?.uid !== user.uid) throw new Error("A conta mudou. Entre novamente.");
            if (user.emailVerified) { await user.getIdToken(true); return; }
        }
        window.educariaShowEmailVerification();
        throw Object.assign(new Error("Confirme seu e-mail para usar a IA. Seus materiais continuam disponíveis."), { code: "email_verification_required", status: 403 });
    };
    function updateBanner() {
        const user = currentUser();
        document.querySelector("[data-email-verification-banner]")?.remove();
        if (!user || user.emailVerified) { dialog?.close(); return; }
        if (dialog?.open) dialog.close();
        if (document.body.dataset.requiresAuth !== "true" || !document.querySelector("main")) return;
        // Presentation screens stay focused on the lesson; the editor/dashboard has the action.
        if (/apresentacao|aplicacao/.test(location.pathname)) return;
        style();
        const banner = document.createElement("aside");
        banner.dataset.emailVerificationBanner = "";
        banner.className = "account-verification-banner";
        banner.innerHTML = '<span>Confirme seu e-mail para liberar a IA.</span><button type="button">Confirmar e-mail</button>';
        banner.querySelector("button").addEventListener("click", window.educariaShowEmailVerification);
        document.querySelector("main").prepend(banner);
    }
    document.addEventListener("educaria-auth-changed", updateBanner);
})();
