import { randomUUID } from "node:crypto";
import { aiCreditsForUsage, mergeAiUsageMetadata, normalizeAiUsageMetadata } from "./ai-credit-policy.js";

export const USAGE_COLLECTION = "aiGenerationUsage";
export const USAGE_REPORT_MAX_RECORDS = 5000;
export const USAGE_REPORT_WINDOW_DAYS = 30;
export const MATERIAL_LABELS = Object.freeze({ worksheet: "Folha de atividades", wordtrail: "Trilha de Palavras", connections: "O que há em comum?", slides: "Slides", quiz: "Quiz", flashcards: "Flashcards", memory: "Memória",
    match: "Ligue os pontos", wheel: "Roleta", mindmap: "Mapa mental", debate: "Debate guiado", wordsearch: "Caça-palavras",
    crossword: "Palavras cruzadas", hangman: "Forca", image: "Imagem para slide" });
const arrays = { wordtrail: "words", connections: "rounds", slides: "slides", quiz: "questions", flashcards: "cards", memory: "pairs", match: "pairs", wheel: "segments",
    mindmap: "branches", debate: "steps", wordsearch: "words", crossword: "entries", hangman: "words" };
const dayMs = 86_400_000;
const integer = value => Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value) || 0)));
const hasUsage = value => value && ["promptTokenCount", "candidatesTokenCount", "totalTokenCount"].some(key =>
    Object.hasOwn(value, key) && typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0);
const validUid = uid => typeof uid === "string" && uid.length > 0 && uid.length <= 128 && !/[\/\u0000-\u001f\u007f]/.test(uid);
const round = value => Math.round(value * 1e9) / 1e9;

// Reference tariff, not an invoice: the free tier may have no actual charge.
// Output includes reasoning once; cached input is a subset of input.
export const GROQ_REFERENCE_PRICE = Object.freeze({ version: "groq-gpt-oss-120b-2026-10-13", currency: "USD",
    inputPerMillion: .15, cachedInputPerMillion: .075, outputPerMillion: .60,
    source: "https://console.groq.com/docs/model/openai/gpt-oss-120b" });
export function estimateUsageCost(provider, model, usage) {
    if (provider !== "groq" || model !== "openai/gpt-oss-120b" || !usage) return null;
    const classified = usage.inputTokens + usage.outputTokens + usage.thoughtTokens;
    if (usage.toolTokens || usage.totalTokens !== classified || usage.cachedInputTokens > usage.inputTokens) return null;
    const price = GROQ_REFERENCE_PRICE;
    return round(((usage.inputTokens - usage.cachedInputTokens) * price.inputPerMillion
        + usage.cachedInputTokens * price.cachedInputPerMillion
        + (usage.outputTokens + usage.thoughtTokens) * price.outputPerMillion) / 1_000_000);
}

export function usageErrorCategory(error) {
    if (Number(error?.status) === 429) return "rate_limit";
    if (error?.name === "TimeoutError" || error?.name === "AbortError" || error?.cause?.name === "TimeoutError") return "timeout";
    if (error?.code === "groq_connection_failed" || Number(error?.status) === 503) return "unavailable";
    return "generation_failed"; // Never persist provider messages or arbitrary error codes.
}

export function usageContext(materialType, generationOptions = {}, slideOptions, hasFile = false) {
    // Explicit allowlist: no audience, school, title, prompt, filename or source text.
    return {
        ...(["refine-item", "illustrate-slide"].includes(generationOptions.operation) ? { operation: generationOptions.operation } : {}),
        requestedCount: generationOptions.count == null ? null : integer(generationOptions.count), hasFile: hasFile === true,
        contentMode: ["auto", "preserve", "summarize", "develop"].includes(generationOptions.contentMode) ? generationOptions.contentMode : "auto",
        detail: materialType === "slides" && ["concise", "balanced", "detailed"].includes(slideOptions?.detail) ? slideOptions.detail : null,
        illustration: materialType === "slides" && (slideOptions?.includeIllustration === true || generationOptions.operation === "illustrate-slide")
    };
}

export function createUsageObservation({ uid, plan, unlimited, materialType, provider, model, context, policy, now = Date.now }) {
    const startedAt = now();
    const attempts = [];
    let merged = {};
    let finished = false;
    return {
        async call(operation) {
            const start = now();
            let result, failure;
            try { result = await operation(); return result; }
            catch (error) { failure = error; throw error; }
            finally {
                const metadata = failure?.usageMetadata || result?.usageMetadata;
                const usage = hasUsage(metadata) ? normalizeAiUsageMetadata(metadata) : null;
                if (usage) merged = mergeAiUsageMetadata(merged, metadata);
                attempts.push({ number: attempts.length + 1, durationMs: integer(now() - start),
                    status: failure ? "failed" : "returned", usage,
                    estimatedCostUsd: estimateUsageCost(provider, model, usage),
                    errorCategory: failure ? usageErrorCategory(failure) : null });
            }
        },
        finish({ success, material, creditsCharged = null, error } = {}) {
            if (finished || !attempts.length) return null;
            finished = true;
            const known = attempts.filter(attempt => attempt.usage !== null).length;
            const priced = attempts.filter(attempt => attempt.estimatedCostUsd !== null).length;
            const charge = known ? aiCreditsForUsage(merged, policy, {
                additionalCredits: materialType === "image" ? policy?.imageOutputCredits : 0
            }) : null;
            return {
                version: 1, id: randomUUID(), uid: validUid(uid) ? uid : null, plan: plan === "pro" ? "pro" : "free", unlimited: unlimited === true,
                materialType: Object.hasOwn(MATERIAL_LABELS, materialType) ? materialType : "unknown",
                provider: ["groq", "gemini"].includes(provider) ? provider : "unknown", model: String(model || "").slice(0, 120),
                createdAt: new Date(now()).toISOString(), expiresAt: new Date(now() + 90 * dayMs),
                status: success === true ? "success" : "failed", durationMs: integer(now() - startedAt),
                context: usageContext(materialType, { count: context?.requestedCount, contentMode: context?.contentMode, operation: context?.operation },
                    { detail: context?.detail, includeIllustration: context?.illustration }, context?.hasFile),
                generatedCount: success && context?.operation === "illustrate-slide" ? 1 : success && context?.operation === "refine-item" ? integer(material?.refinementCount) : success && materialType === "image" ? 1 : success && materialType === "worksheet" && material?.activities ? Object.keys(material.activities).length : Array.isArray(material?.[arrays[materialType]]) ? material[arrays[materialType]].length : null,
                creditsCharged: creditsCharged === null ? null : integer(creditsCharged),
                measuredCredits: known === attempts.length ? charge?.credits ?? null : null,
                usage: charge?.usage ?? null,
                usageCoverage: known === attempts.length ? "complete" : known ? "partial" : "unknown",
                estimatedCostUsd: priced ? round(attempts.reduce((sum, attempt) => sum + (attempt.estimatedCostUsd ?? 0), 0)) : null,
                costCoverage: priced === attempts.length ? "complete" : priced ? "partial" : "unknown",
                priceVersion: priced ? GROQ_REFERENCE_PRICE.version : null,
                errorCategory: success ? null : usageErrorCategory(error), attempts
            };
        }
    };
}

export function createUsageAnalytics({ getServices, mode = "firestore", enabled = true, now = Date.now,
    report = () => {}, timeoutMs = 2500, maxRecords = USAGE_REPORT_MAX_RECORDS } = {}) {
    const memory = new Map();
    const health = { failedWrites: 0, pendingWrites: 0 };
    let cache = null;
    let reading = null;
    let memoryEvicted = false;
    const collection = () => getServices().db.collection(USAGE_COLLECTION);
    const status = () => ({ enabled, store: enabled ? mode : "disabled", ...health });
    return {
        status,
        async record(event) {
            if (!enabled || !event) return;
            // A stable operation ID makes SDK retries overwrite the same event.
            if (!/^[a-f0-9-]{36}$/.test(event.id)) return;
            health.pendingWrites += 1;
            let timer;
            let warned = false;
            const warn = () => { if (!warned) { warned = true; health.failedWrites += 1; report("ai_usage_write_unconfirmed"); } };
            const saving = (async () => {
                if (mode === "memory") {
                    memory.set(event.id, structuredClone(event));
                    if (memory.size > maxRecords) { memory.delete(memory.keys().next().value); memoryEvicted = true; }
                } else {
                    const db = getServices().db;
                    await db.runTransaction(async tx => {
                        // Serialize with the deletion lock so late generations cannot
                        // recreate personal analytics after an account is removed.
                        if (event.uid && (await tx.get(db.collection("accountDeletionJobs").doc(event.uid))).exists) return;
                        tx.set(collection().doc(event.id), event);
                    });
                }
                cache = null;
            })().catch(warn).finally(() => { health.pendingWrites -= 1; clearTimeout(timer); });
            await Promise.race([saving, new Promise(resolve => {
                timer = setTimeout(() => { warn(); resolve(); }, timeoutMs);
            })]);
        },
        async removeUser(uid) {
            if (!validUid(uid)) throw new Error("invalid_usage_uid");
            cache = null;
            if (mode === "memory") { for (const [id, row] of memory) if (row.uid === uid) memory.delete(id); return true; }
            // Bounded deletion batches participate in the existing retry worker.
            const snapshot = await collection().where("uid", "==", uid).limit(200).get();
            if (!snapshot.docs.length) return true;
            const batch = getServices().db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            return false;
        },
        async read({ refresh = false } = {}) {
            if (!refresh && cache && now() - cache.loadedAt < 30_000) return { ...cache.value, collection: status() };
            if (!reading) reading = (async () => {
                const loadedAt = now();
                const start = new Date(loadedAt - USAGE_REPORT_WINDOW_DAYS * dayMs).toISOString();
                const end = new Date(loadedAt).toISOString();
                let events, truncated;
                if (mode === "memory") {
                    events = [...memory.values()].filter(row => row.createdAt >= start && row.createdAt <= end).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                    truncated = memoryEvicted;
                } else {
                    // Single-field range/order: no composite index required.
                    const snapshot = await collection().where("createdAt", ">=", start).where("createdAt", "<=", end)
                        .orderBy("createdAt", "desc").limit(maxRecords + 1).get();
                    events = snapshot.docs.map(doc => doc.data());
                    truncated = events.length > maxRecords;
                }
                const value = { events: events.slice(0, maxRecords), truncated, updatedAt: end };
                cache = { value, loadedAt };
                return value;
            })().finally(() => { reading = null; });
            return { ...await reading, collection: status() };
        }
    };
}

export function parseUsageQuery(query) {
    const { days = "7", materialType = "all", status = "all", cohort = "all", uid = "", page = "1", refresh = "false" } = query;
    if (Object.keys(query).some(key => !["days", "materialType", "status", "cohort", "uid", "page", "refresh"].includes(key))
        || !["1", "7", "30"].includes(days) || (materialType !== "all" && !Object.hasOwn(MATERIAL_LABELS, materialType)) || typeof materialType !== "string"
        || !["all", "success", "failed"].includes(status) || !["all", "limited", "unlimited"].includes(cohort)
        || (uid !== "" && !validUid(uid)) || typeof page !== "string" || !/^[1-9]\d{0,5}$/.test(page) || !["true", "false"].includes(refresh)) {
        throw new Error("invalid_usage_query");
    }
    return { days: Number(days), materialType, status, cohort, uid, page: Number(page), refresh: refresh === "true" };
}

export function summarizeUsageEvents(events) {
    const complete = events.filter(row => row.usageCoverage === "complete" && row.usage);
    const priced = events.filter(row => row.estimatedCostUsd !== null);
    const values = complete.map(row => row.usage.totalTokens).sort((a, b) => a - b);
    return {
        generations: events.length, successful: events.filter(row => row.status === "success").length,
        failed: events.filter(row => row.status === "failed").length,
        attempts: events.reduce((sum, row) => sum + row.attempts.length, 0),
        knownTokens: events.reduce((sum, row) => sum + (row.usage?.totalTokens || 0), 0),
        completeMeasurements: complete.length, incompleteMeasurements: events.length - complete.length,
        averageTokens: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
        p95Tokens: values.length ? values[Math.ceil(values.length * .95) - 1] : null,
        averageDurationMs: events.length ? Math.round(events.reduce((sum, row) => sum + row.durationMs, 0) / events.length) : null,
        creditsCharged: events.reduce((sum, row) => sum + (row.creditsCharged || 0), 0),
        unknownCharges: events.filter(row => row.creditsCharged === null).length,
        estimatedCostUsd: priced.length ? round(priced.reduce((sum, row) => sum + row.estimatedCostUsd, 0)) : null,
        unpricedGenerations: events.filter(row => row.costCoverage !== "complete").length
    };
}

export function selectUsageEvents(snapshot, filters, now = Date.now()) {
    const start = new Date(now - filters.days * dayMs).toISOString();
    const eligible = snapshot.events.filter(row => row.createdAt >= start && row.createdAt <= new Date(now).toISOString());
    const matches = eligible.filter(row => (filters.materialType === "all" || row.materialType === filters.materialType)
        && (filters.status === "all" || row.status === filters.status) && (!filters.uid || row.uid === filters.uid)
        && (filters.cohort === "all" || row.unlimited === (filters.cohort === "unlimited")));
    return { eligible, matches, period: { from: start, to: new Date(now).toISOString(), days: filters.days } };
}

export function buildUsageReport(snapshot, filters, users = [], now = Date.now()) {
    const directory = new Map(users.map(user => [user.uid, { uid: user.uid, name: user.name, email: user.email }]));
    const person = uid => directory.get(uid) || { uid: uid || "", name: uid ? "Conta não disponível" : "Teste local sem conta", email: "" };
    const { eligible, matches, period } = selectUsageEvents(snapshot, filters, now);
    const group = key => {
        const groups = new Map();
        for (const row of matches) { const id = row[key]; if (!groups.has(id)) groups.set(id, []); groups.get(id).push(row); }
        return [...groups].map(([id, rows]) => ({ id, ...summarizeUsageEvents(rows) })).sort((a, b) => b.knownTokens - a.knownTokens);
    };
    const pageSize = 20;
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(filters.page, totalPages);
    const eventRow = row => ({ id: row.id, createdAt: row.createdAt, user: person(row.uid), unlimited: row.unlimited,
        materialType: row.materialType, provider: row.provider, model: row.model, status: row.status,
        context: row.context, generatedCount: row.generatedCount, usage: row.usage, usageCoverage: row.usageCoverage,
        creditsCharged: row.creditsCharged, measuredCredits: row.measuredCredits, estimatedCostUsd: row.estimatedCostUsd,
        costCoverage: row.costCoverage, priceVersion: row.priceVersion, durationMs: row.durationMs,
        attempts: row.attempts, errorCategory: row.errorCategory });
    return {
        ok: true, summary: summarizeUsageEvents(matches), byMaterial: group("materialType"),
        byUser: group("uid").slice(0, 20).map(row => ({ ...row, user: person(row.id) })),
        userOptions: [...new Set(eligible.map(row => row.uid).filter(Boolean))].map(person),
        expensive: matches.filter(row => row.estimatedCostUsd !== null).sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd).slice(0, 5).map(eventRow),
        events: matches.slice((page - 1) * pageSize, page * pageSize).map(eventRow),
        pagination: { page, pageSize, totalPages, totalMatches: matches.length },
        period,
        truncated: snapshot.truncated, updatedAt: snapshot.updatedAt, collection: snapshot.collection,
        pricing: GROQ_REFERENCE_PRICE
    };
}
