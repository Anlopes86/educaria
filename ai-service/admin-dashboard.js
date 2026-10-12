import express from "express";
import { verifyActiveSession, sessionErrorResponse } from "./firebase-admin-services.js";

const cleanText = (value, limit = 320) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const isoDate = value => Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const searchable = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function parseAdminUids(value = "") {
    // Deliberately unrelated to teacher roles, emails or AI_UNLIMITED_UIDS.
    return new Set(String(value).split(",").map(uid => uid.trim()).filter(uid => uid && uid.length <= 128 && !/[\s/*]/.test(uid)));
}

export function createAdminRouter({ getServices, adminUids = new Set(), getPlan, getCredits,
    verifySession = verifyActiveSession, now = Date.now, cacheTtlMs = 30_000 } = {}) {
    const router = express.Router();
    const rateBuckets = new Map();
    let directory = null;
    let directoryPromise = null;

    router.use((request, response, next) => {
        response.set("Cache-Control", "private, no-store");
        response.vary("Authorization");
        const timestamp = now();
        for (const [key, bucket] of rateBuckets) if (bucket.resetAt <= timestamp) rateBuckets.delete(key);
        const key = request.ip || "unknown";
        const bucket = rateBuckets.get(key) || { count: 0, resetAt: timestamp + 60_000 };
        if (bucket.count >= 60 || (!rateBuckets.has(key) && rateBuckets.size >= 2000)) {
            response.set("Retry-After", "60");
            return response.status(429).json({ code: "admin_rate_limit", error: "Muitas consultas. Aguarde um minuto e tente novamente." });
        }
        bucket.count += 1;
        rateBuckets.set(key, bucket);
        next();
    });

    router.use(async (request, response, next) => {
        const match = /^Bearer ([^\s]+)$/i.exec(request.get("Authorization") || "");
        if (!match) return response.status(401).json({ code: "session_invalid", error: "Entre novamente para continuar." });
        try {
            // Always validate, even when AI_AUTH_REQUIRED is disabled in development.
            request.adminSession = await verifySession(match[1], getServices);
            next();
        } catch (error) {
            const result = sessionErrorResponse(error);
            response.status(result.status).json(result.body);
        }
    });

    router.get("/access", (request, response) => {
        response.json({ ok: true, isAdmin: adminUids.has(request.adminSession?.uid) });
    });

    router.use((request, response, next) => {
        if (!adminUids.has(request.adminSession?.uid)) {
            return response.status(403).json({ code: "admin_forbidden", error: "Esta área é exclusiva da administração." });
        }
        next();
    });

    async function readDirectory(forceRefresh = false) {
        if (!forceRefresh && directory && now() - directory.loadedAt < cacheTtlMs) return directory;
        if (directoryPromise) return directoryPromise;
        directoryPromise = (async () => {
            const { auth } = getServices();
            const users = [];
            const seenTokens = new Set();
            let pageToken;
            do {
                const batch = await auth.listUsers(1000, pageToken);
                for (const user of batch.users) {
                    if (!user.uid || user.uid.length > 128 || user.uid.includes("/")) throw new Error("invalid_directory_record");
                    // Only these fields survive the SDK response. No credential,
                    // provider token, phone, password hash or custom claim is exposed.
                    users.push({
                        uid: user.uid, name: cleanText(user.displayName, 120), email: cleanText(user.email),
                        createdAt: isoDate(user.metadata?.creationTime), lastSignInAt: isoDate(user.metadata?.lastSignInTime),
                        disabled: user.disabled === true, emailVerified: user.emailVerified === true,
                        plan: await getPlan(user)
                    });
                }
                pageToken = batch.pageToken;
                // Fail explicitly instead of presenting a truncated total or
                // allowing a broken provider cursor to trigger an infinite scan.
                if (pageToken && (seenTokens.has(pageToken) || users.length >= 20_000)) throw new Error("directory_capacity");
                if (pageToken) seenTokens.add(pageToken);
            } while (pageToken);
            users.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || a.uid.localeCompare(b.uid));
            directory = { users, loadedAt: now() };
            return directory;
        })().finally(() => { directoryPromise = null; });
        return directoryPromise;
    }

    router.get("/users", async (request, response) => {
        const { q = "", status = "all", plan = "all", page = "1", refresh = "false" } = request.query;
        if (Object.keys(request.query).some(key => !["q", "status", "plan", "page", "refresh"].includes(key))
            || typeof q !== "string" || q.length > 120 || !["all", "enabled", "disabled"].includes(status)
            || !["all", "free", "pro"].includes(plan) || typeof page !== "string" || !/^[1-9]\d{0,5}$/.test(page)
            || !["true", "false"].includes(refresh)) {
            return response.status(400).json({ code: "admin_invalid_query", error: "Confira os filtros e tente novamente." });
        }
        try {
            const snapshot = await readDirectory(refresh === "true");
            const needle = searchable(q.trim());
            const matches = snapshot.users.filter(user => (!needle || searchable(`${user.name} ${user.email}`).includes(needle))
                && (status === "all" || user.disabled === (status === "disabled")) && (plan === "all" || user.plan === plan));
            const pageSize = 20;
            const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
            const currentPage = Math.min(Number(page), totalPages);
            const selected = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);
            const { db } = getServices();
            const profiles = selected.length ? await db.getAll(...selected.map(user => db.doc(`teachers/${user.uid}`)),
                { fieldMask: ["institution", "institutionName"] }) : [];
            // Four workers bound credit reads; each row can report an unavailable
            // balance without inventing zero or preventing the directory view.
            const rows = new Array(selected.length);
            let nextIndex = 0;
            await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
                while (nextIndex < selected.length) {
                    const index = nextIndex++;
                    const user = selected[index];
                    let credits = null;
                    try { credits = await getCredits(user); } catch { /* Display unavailable; never return provider errors. */ }
                    const profile = profiles[index]?.data() || {};
                    rows[index] = { ...user, school: cleanText(profile.institutionName || profile.institution, 160), credits };
                }
            }));
            const sevenDaysAgo = now() - 7 * 24 * 60 * 60 * 1000;
            response.json({
                ok: true, users: rows,
                summary: {
                    total: snapshot.users.length,
                    newLast7Days: snapshot.users.filter(user => Date.parse(user.createdAt) >= sevenDaysAgo).length,
                    signedInLast7Days: snapshot.users.filter(user => Date.parse(user.lastSignInAt) >= sevenDaysAgo).length,
                    disabled: snapshot.users.filter(user => user.disabled).length
                },
                pagination: { page: currentPage, pageSize, totalMatches: matches.length, totalPages },
                directoryUpdatedAt: new Date(snapshot.loadedAt).toISOString(), balancesUpdatedAt: new Date(now()).toISOString()
            });
        } catch {
            // Never log user records, search terms, ID tokens or SDK error bodies.
            response.status(503).json({ code: "admin_unavailable", error: "Não foi possível consultar os usuários agora. Tente novamente." });
        }
    });
    router.use((_request, response) => response.status(405).json({ code: "admin_read_only", error: "O painel permite somente consultas." }));
    return router;
}
