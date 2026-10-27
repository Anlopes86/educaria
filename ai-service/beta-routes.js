import express from "express";
import { verifyActiveSession, sessionErrorResponse } from "./firebase-admin-services.js";

export function createBetaRouter({ enrollment, getServices, verifySession = verifyActiveSession }) {
    const router = express.Router();
    router.use((_request, response, next) => { response.set("Cache-Control", "private, no-store"); next(); });
    router.get("/status", async (_request, response) => {
        try {
            const { waiting, activatedAt, ...availability } = await enrollment.status();
            response.json({ ok: true, ...availability });
        } catch { response.status(503).json({ code: "beta_unavailable", error: "Não foi possível conferir as vagas. Tente novamente em instantes." }); }
    });
    router.post("/enroll", async (request, response) => {
        const match = /^Bearer ([^\s]+)$/i.exec(request.get("Authorization") || "");
        if (!match) return response.status(401).json({ code: "session_invalid", error: "Entre novamente para continuar." });
        try {
            const user = await verifySession(match[1], getServices);
            const access = await enrollment.claim(user.uid);
            response.json({ ok: true, access });
        } catch (error) {
            const result = sessionErrorResponse(error);
            response.status(result.status).json(result.body);
        }
    });
    return router;
}

export function createRequireBetaAccess(enrollment, { authRequired = true } = {}) {
    return async (request, response, next) => {
        if (!authRequired) return next();
        if (!request.educariaUser?.uid) return response.status(401).json({ code: "session_invalid", error: "Entre novamente para continuar." });
        try {
            request.educariaBeta = await enrollment.claim(request.educariaUser.uid);
            if (request.educariaBeta.status === "waitlisted") return response.status(403).json({
                code: "beta_waitlisted", error: "Seu cadastro está na lista de espera do beta. O acesso à IA será liberado quando houver uma vaga."
            });
            next();
        } catch { response.status(503).json({ code: "beta_unavailable", error: "Não foi possível conferir seu acesso ao beta. Tente novamente em instantes." }); }
    };
}
