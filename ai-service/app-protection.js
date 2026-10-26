// App Check complements user authentication; it never grants access to data.
export function createAppProtection({ getServices, mode = "monitor", appId = "", report = () => {} }) {
    if (!["off", "monitor", "enforce"].includes(mode)) throw new Error("Invalid APP_CHECK_MODE.");
    if (mode === "enforce" && !appId) throw new Error("FIREBASE_WEB_APP_ID is required to enforce App Check.");
    return async function appProtection(request, response, next) {
        if (mode === "off") return next();
        const token = request.get("X-Firebase-AppCheck");
        let reason = "missing";
        if (token && token.length <= 8192) {
            try {
                const decoded = await getServices().appCheck.verifyToken(token);
                if (!appId || decoded.appId === appId) return next();
                reason = "wrong_app";
            } catch (error) {
                reason = ["app-check/invalid-argument", "app-check/invalid-token"].includes(error?.code)
                    ? "invalid" : "unavailable";
            }
        }
        report(reason); // Only bounded categories, never tokens or user data.
        if (mode === "monitor") return next();
        return response.status(reason === "unavailable" ? 503 : 403).json({
            code: "app_check_required",
            error: "Não foi possível validar este acesso. Atualize a página e tente novamente."
        });
    };
}

export function requireVerifiedEmail(request, response, next) {
    if (request.educariaUser?.email_verified === true) return next();
    return response.status(403).json({
        code: "email_verification_required",
        error: "Confirme seu e-mail antes de usar a IA. Use a opção de confirmação da sua conta."
    });
}
