import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { generateGroqStructuredMaterial } from "./ai-text-provider.js";
import { schemaFor } from "./materials/schemas.js";
import { promptFor, imagePromptForSlide } from "./materials/prompts.js";
import { normalizeSlidesMaterial } from "./materials/slides.js";
import { parseGeneratedJson } from "./materials/generated-json.js";
import { createMaterialUpload, extractTextFromFile, isUploadValidationError, parseWheelTemplateText } from "./materials/upload.js";
import { normalizeSlideGenerationOptions } from "./slide-generation-policy.js";
import { normalizeActivityGenerationOptions, applyActivityGenerationSettings } from "./activity-generation-policy.js";
import {
    aiCreditsForUsage,
    buildAiCreditUsagePolicy,
    estimateAiCreditReservation,
    mergeAiUsageMetadata,
    normalizeAiUsageMetadata
} from "./ai-credit-policy.js";
import { createAiCreditStore } from "./ai-credit-store.js";
import { createFirebaseServices, verifyActiveSession, sessionErrorResponse } from "./firebase-admin-services.js";
import { createDeletionManager, createFirestoreDeletionStore, createDeletionActions } from "./account-deletion.js";
import { createAdminRouter, parseAdminUids } from "./admin-dashboard.js";
import { createUsageAnalytics, createUsageObservation, usageContext } from "./ai-usage-analytics.js";

function parseNonNegativeNumber(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }

    return parsed;
}

const app = express();
app.disable("x-powered-by");
const port = Number(process.env.PORT || 8787);
const maxUploadMb = Number(process.env.AI_MAX_UPLOAD_MB || 5);
const upload = createMaterialUpload(maxUploadMb);
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const groqApiKey = String(process.env.GROQ_API_KEY || "").trim();
const requestedAiTextProvider = String(process.env.AI_TEXT_PROVIDER || "auto").trim().toLowerCase();
const supportedAiTextProviders = new Set(["auto", "groq", "gemini"]);
const aiTextProviderPreference = supportedAiTextProviders.has(requestedAiTextProvider)
    ? requestedAiTextProvider
    : "auto";
const groqModel = String(process.env.GROQ_MODEL || "openai/gpt-oss-120b").trim();
const requestedGroqReasoningEffort = String(process.env.GROQ_REASONING_EFFORT || "low").trim().toLowerCase();
const groqReasoningEffort = new Set(["low", "medium", "high"]).has(requestedGroqReasoningEffort)
    ? requestedGroqReasoningEffort
    : "low";
const groqMaxCompletionTokens = Math.max(1, Math.floor(
    parseNonNegativeNumber(process.env.GROQ_MAX_COMPLETION_TOKENS, 3_500)
));
const groqMaxPromptTokens = Math.max(1, Math.floor(
    parseNonNegativeNumber(process.env.GROQ_MAX_PROMPT_TOKENS, 4_000)
));
const groqRequestTimeoutMs = Math.max(1_000, Math.floor(
    parseNonNegativeNumber(process.env.GROQ_REQUEST_TIMEOUT_MS, 90_000)
));
const aiAuthRequired = String(process.env.AI_AUTH_REQUIRED ?? "true").trim().toLowerCase() !== "false";
const firebaseProjectId = String(
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    ""
).trim();
const aiRateLimitWindowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60_000);
const aiRateLimitMax = Number(process.env.AI_RATE_LIMIT_MAX || 8);
const aiGlobalRateLimitMax = parseNonNegativeNumber(process.env.AI_GLOBAL_RATE_LIMIT_MAX, 4);
const aiUserRateLimitMax = parseNonNegativeNumber(process.env.AI_USER_RATE_LIMIT_MAX, 2);
const aiGenerationMaxAttempts = Math.max(1, Math.min(2, Math.floor(
    parseNonNegativeNumber(process.env.AI_GENERATION_MAX_ATTEMPTS, 1)
)));
const aiGlobalDailyRequestLimit = parseNonNegativeNumber(process.env.AI_GLOBAL_DAILY_REQUEST_LIMIT, 900);
const aiUserDailyRequestLimitFree = parseNonNegativeNumber(process.env.AI_USER_DAILY_REQUEST_LIMIT_FREE, 900);
const aiUserDailyRequestLimitPro = parseNonNegativeNumber(
    process.env.AI_USER_DAILY_REQUEST_LIMIT_PRO,
    Math.max(aiUserDailyRequestLimitFree, 900)
);
const aiUserDailyRequestLimits = {
    free: aiUserDailyRequestLimitFree,
    pro: aiUserDailyRequestLimitPro
};
const legacyAiDailyCreditLimitDefault = parseNonNegativeNumber(process.env.AI_DAILY_CREDIT_LIMIT, 5);
const legacyAiDailyCreditLimitPro = parseNonNegativeNumber(process.env.AI_DAILY_CREDIT_LIMIT_PRO, Math.max(legacyAiDailyCreditLimitDefault, 20));
const aiDailyCreditLimitDefault = parseNonNegativeNumber(process.env.AI_USAGE_DAILY_CREDIT_LIMIT, 500);
const aiDailyCreditLimitFree = parseNonNegativeNumber(process.env.AI_USAGE_DAILY_CREDIT_LIMIT_FREE, aiDailyCreditLimitDefault);
const aiDailyCreditLimitPro = parseNonNegativeNumber(process.env.AI_USAGE_DAILY_CREDIT_LIMIT_PRO, legacyAiDailyCreditLimitPro * 200);
const aiDailyCreditLimits = {
    free: aiDailyCreditLimitFree,
    pro: aiDailyCreditLimitPro
};
const aiCreditUsagePolicy = buildAiCreditUsagePolicy(process.env);
const aiGlobalDailyTokenLimit = parseNonNegativeNumber(process.env.AI_GLOBAL_DAILY_TOKEN_LIMIT, 180_000);
const aiCreditStoreMode = String(process.env.AI_CREDIT_STORE || "memory").trim().toLowerCase();
const aiCreditStorePath = path.resolve(process.env.AI_CREDIT_STORE_PATH || ".data/ai-credits.json");
const aiCreditRepository = createAiCreditStore({
    type: aiCreditStoreMode,
    filePath: aiCreditStorePath,
    projectId: firebaseProjectId,
    databaseId: String(process.env.AI_CREDIT_FIRESTORE_DATABASE || "(default)").trim(),
    collection: String(process.env.AI_CREDIT_FIRESTORE_COLLECTION || "aiCreditUsage").trim(),
    credentialsJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    credentialsBase64: process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64,
    reservationTtlMs: Number(process.env.AI_CREDIT_RESERVATION_TTL_MS || 60 * 60 * 1000)
});
const aiProUidAllowList = new Set(parseAllowedOrigins(process.env.AI_PRO_UIDS));
const aiUnlimitedUidAllowList = new Set(parseAllowedOrigins(process.env.AI_UNLIMITED_UIDS));
const aiImageGenerationEnabled = String(process.env.AI_IMAGE_GENERATION_ENABLED || "").trim().toLowerCase() === "true";
const billingCheckoutUrl = String(process.env.BILLING_CHECKOUT_URL || "").trim();
const billingWebhookSecret = String(process.env.BILLING_WEBHOOK_SECRET || "").trim();
const billingStorePath = path.resolve(process.env.BILLING_STORE_PATH || ".data/billing-events.json");
const getFirebaseServices = createFirebaseServices();
const aiUsageAnalytics = createUsageAnalytics({
    getServices: getFirebaseServices,
    mode: aiCreditStoreMode === "firestore" ? "firestore" : "memory",
    enabled: String(process.env.AI_USAGE_ANALYTICS_ENABLED || "true") !== "false",
    report: code => console.warn(`EducarIA: ${code}`)
});
const accountDeletionEnabled = String(process.env.ACCOUNT_DELETION_ENABLED || "false") === "true";
if (accountDeletionEnabled && (!aiAuthRequired || !process.env.FIREBASE_STORAGE_BUCKET)) {
    throw new Error("Account deletion requires authentication and FIREBASE_STORAGE_BUCKET.");
}
const accountDeletion = createDeletionManager({
    store: createFirestoreDeletionStore(getFirebaseServices),
    actions: createDeletionActions(getFirebaseServices, async (uid) => {
        if (!await aiUsageAnalytics.removeUser(uid)) return false;
        await loadBillingStore();
        billingRecords.delete(uid);
        aiProUidAllowList.delete(uid);
        aiUnlimitedUidAllowList.delete(uid);
        // Never erase the usage ledger: deletion must not be a way to reset quotas.
        await persistBillingStore();
    }),
    report: (code) => console.warn(`EducarIA: ${code}`)
});
function resumeAccountDeletions() {
    if (!accountDeletionEnabled) return;
    void accountDeletion.run().catch(() => console.warn("EducarIA: account_deletion_worker_unavailable"));
}
const aiRateLimitBuckets = new Map();
const aiProviderRateLimitBuckets = new Map();
const billingRecords = new Map();
let billingStoreLoaded = false;
let billingStoreWriteQueue = Promise.resolve();

function activeAiTextProvider() {
    if (aiTextProviderPreference === "groq") {
        return groqApiKey ? "groq" : null;
    }
    if (aiTextProviderPreference === "gemini") {
        return gemini ? "gemini" : null;
    }
    if (groqApiKey) {
        return "groq";
    }
    return gemini ? "gemini" : null;
}

function activeAiTextModel(provider = activeAiTextProvider()) {
    if (provider === "groq") return groqModel;
    if (provider === "gemini") return process.env.GEMINI_MODEL || "gemini-2.5-flash";
    return "";
}

function aiTextProviderConfigurationError() {
    if (aiTextProviderPreference === "groq") {
        return "GROQ_API_KEY não configurada no backend.";
    }
    if (aiTextProviderPreference === "gemini") {
        return "GEMINI_API_KEY não configurada no backend.";
    }
    return "Nenhum provedor de IA está configurado no backend.";
}

if (String(process.env.TRUST_PROXY || "").trim().toLowerCase() === "true") {
    app.set("trust proxy", 1);
}

if (process.env.NODE_ENV === "production" && aiCreditStoreType() !== "firestore") {
    console.warn("EducarIA: AI credits are not using Firestore; balances will not be reliable across production instances or restarts.");
}

/**
 * Parses a comma-separated list of allowed CORS origins from an env string.
 * @param {string} value - Raw env value (e.g. "https://app.com,http://localhost:5500")
 * @returns {string[]} Array of trimmed, non-empty origin strings
 */
function parseAllowedOrigins(value) {
    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

const configuredOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGIN);
const defaultOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "null"
];

const allowedOrigins = configuredOrigins.length ? configuredOrigins : defaultOrigins;

if (process.env.NODE_ENV === "production") {
    if (!aiAuthRequired) {
        throw new Error("AI_AUTH_REQUIRED cannot be disabled in production.");
    }
    if (!firebaseProjectId) {
        throw new Error("FIREBASE_PROJECT_ID is required in production.");
    }
    if (!configuredOrigins.length || allowedOrigins.includes("*") || allowedOrigins.includes("null")) {
        throw new Error("Set an explicit ALLOWED_ORIGIN for production.");
    }
    if (billingCheckoutUrl && !billingWebhookSecret) {
        throw new Error("BILLING_WEBHOOK_SECRET is required when billing checkout is enabled.");
    }
}

app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || (origin === "null" && allowedOrigins.includes("null"))) {
            callback(null, true);
            return;
        }

        callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
}));
app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.setHeader("Cache-Control", "no-store");
    next();
});
app.use(express.json({ limit: process.env.AI_JSON_LIMIT || "2mb" }));

function tokenFromAuthorizationHeader(request) {
    const header = request.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

/**
 * Express middleware: per-IP sliding-window rate limiter for AI endpoints.
 * Tracks request counts in {@link aiRateLimitBuckets}. Sets X-RateLimit-* headers.
 * Bypassed entirely when AI_RATE_LIMIT_MAX is 0 or unset.
 * @type {import('express').RequestHandler}
 */
function aiRateLimit(request, response, next) {
    if (!aiRateLimitMax || aiRateLimitMax < 1) {
        next();
        return;
    }

    const now = Date.now();
    const identifier = request.ip || request.socket?.remoteAddress || "unknown";
    const bucketKey = `${identifier}:${request.path}`;
    const current = aiRateLimitBuckets.get(bucketKey);
    const bucket = current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + aiRateLimitWindowMs };

    bucket.count += 1;
    aiRateLimitBuckets.set(bucketKey, bucket);

    response.setHeader("X-RateLimit-Limit", String(aiRateLimitMax));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, aiRateLimitMax - bucket.count)));
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > aiRateLimitMax) {
        return response.status(429).json({ error: "Muitas solicitações de IA. Tente novamente em alguns instantes." });
    }

    next();
}

/**
 * Protects the provider's shared requests-per-minute quota. The global bucket
 * limits the whole service and the user bucket prevents one teacher from
 * occupying every available slot in the same minute.
 * @type {import('express').RequestHandler}
 */
function aiGenerationRateLimit(request, response, next) {
    const now = Date.now();
    const windowStart = now - aiRateLimitWindowMs;
    const entries = [
        { key: "provider:global", limit: aiGlobalRateLimitMax, scope: "platform" },
        { key: `provider:user:${aiCreditUserKey(request)}`, limit: aiUserRateLimitMax, scope: "user" }
    ].filter((entry) => entry.limit > 0);

    if (!entries.length) {
        next();
        return;
    }

    const buckets = entries.map((entry) => {
        const timestamps = (aiProviderRateLimitBuckets.get(entry.key) || [])
            .filter((timestamp) => timestamp > windowStart);
        return {
            ...entry,
            timestamps,
            resetAt: timestamps.length
                ? timestamps[0] + aiRateLimitWindowMs
                : now + aiRateLimitWindowMs
        };
    });
    const blocked = buckets.find((entry) => entry.timestamps.length >= entry.limit);

    if (blocked) {
        response.setHeader("Retry-After", String(Math.max(1, Math.ceil((blocked.resetAt - now) / 1000))));
        return response.status(429).json({
            error: blocked.scope === "platform"
                ? "A IA está com muitas solicitações neste minuto. Aguarde um instante e tente novamente."
                : "Você fez várias solicitações em sequência. Aguarde um instante e tente novamente.",
            code: blocked.scope === "platform" ? "platform_minute_limit" : "user_minute_limit"
        });
    }

    buckets.forEach((entry) => {
        entry.timestamps.push(now);
        aiProviderRateLimitBuckets.set(entry.key, entry.timestamps);
    });

    const globalBucket = buckets.find((entry) => entry.scope === "platform");
    if (globalBucket) {
        response.setHeader("X-AI-Global-RateLimit-Limit", String(globalBucket.limit));
        response.setHeader("X-AI-Global-RateLimit-Remaining", String(Math.max(0, globalBucket.limit - globalBucket.timestamps.length)));
        response.setHeader("X-AI-Global-RateLimit-Reset", String(Math.ceil(globalBucket.resetAt / 1000)));
    }

    next();
}

function dailyCreditDateKey(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: String(process.env.AI_PROVIDER_DAILY_TIME_ZONE || "UTC").trim() || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date);
}

function nextDailyCreditResetAt(date = new Date()) {
    const currentDay = dailyCreditDateKey(date);
    let lower = date.getTime();
    let upper = lower + (30 * 60 * 60 * 1000);

    while (upper - lower > 1) {
        const midpoint = Math.floor((lower + upper) / 2);
        if (dailyCreditDateKey(new Date(midpoint)) === currentDay) {
            lower = midpoint;
        } else {
            upper = midpoint;
        }
    }

    return new Date(Math.ceil(upper / 1_000) * 1_000).toISOString();
}

function aiCreditUserKey(request) {
    return request.educariaUser?.uid || request.educariaUser?.sub || request.ip || "anonymous";
}

function isAiUnlimitedUser(request) {
    const uid = String(request.educariaUser?.uid || request.educariaUser?.sub || "").trim();
    return Boolean(uid && aiUnlimitedUidAllowList.has(uid));
}

function normalizeTeacherPlan(value) {
    return String(value || "").trim().toLowerCase() === "pro" ? "pro" : "free";
}

function aiPlanForRequest(request) {
    const user = request.educariaUser || {};
    const uid = String(user.uid || user.sub || "").trim();
    const claimedPlan = normalizeTeacherPlan(
        user.plan ||
        user.educaria_plan ||
        user.subscription_plan ||
        user["https://educaria.app/plan"]
    );

    if (claimedPlan === "pro") {
        return "pro";
    }

    if (uid && aiProUidAllowList.has(uid)) {
        return "pro";
    }

    if (uid && billingRecords.get(uid)?.plan === "pro") {
        return "pro";
    }

    return "free";
}

function aiDailyCreditLimitForPlan(plan) {
    const normalizedPlan = normalizeTeacherPlan(plan);
    if (normalizedPlan === "pro") {
        return aiDailyCreditLimits.pro;
    }

    return aiDailyCreditLimits.free;
}

function aiDailyRequestLimitForPlan(plan) {
    return normalizeTeacherPlan(plan) === "pro"
        ? aiUserDailyRequestLimits.pro
        : aiUserDailyRequestLimits.free;
}

function aiCreditBucketKey(request, day) {
    return `${aiCreditUserKey(request)}:${aiPlanForRequest(request)}:${day}`;
}

function aiCreditStoreType() {
    return aiCreditRepository.type;
}

function normalizeBillingRecord(record) {
    if (!record || typeof record !== "object") return null;

    const uid = String(record.uid || record.teacherUid || record.userId || "").trim();
    if (!uid) return null;

    const plan = normalizeTeacherPlan(record.plan || "pro");
    const status = String(record.status || "paid").trim().toLowerCase();
    return {
        uid,
        plan,
        status,
        provider: String(record.provider || "manual").trim() || "manual",
        reference: String(record.reference || record.externalReference || "").trim(),
        email: String(record.email || "").trim(),
        updatedAt: isoTimestampOrEmpty(record.updatedAt) || new Date().toISOString()
    };
}

async function loadBillingStore() {
    if (billingStoreLoaded) {
        return;
    }

    try {
        const content = await fs.readFile(billingStorePath, "utf8");
        const parsed = JSON.parse(content);
        const records = Array.isArray(parsed?.records) ? parsed.records : [];
        records.forEach((record) => {
            const normalized = normalizeBillingRecord(record);
            if (normalized?.plan === "pro" && normalized.status === "paid") {
                billingRecords.set(normalized.uid, normalized);
                aiProUidAllowList.add(normalized.uid);
            }
        });
    } catch (error) {
        if (error?.code !== "ENOENT") {
            throw new Error("billing_store_unavailable");
        }
    }
    billingStoreLoaded = true;
}

async function persistBillingStore() {
    const payload = JSON.stringify({
        updatedAt: new Date().toISOString(),
        records: [...billingRecords.values()]
    }, null, 2);

    const write = billingStoreWriteQueue.catch(() => {}).then(async () => {
        await fs.mkdir(path.dirname(billingStorePath), { recursive: true });
        const tempPath = `${billingStorePath}.${process.pid}.tmp`;
        await fs.writeFile(tempPath, payload, "utf8");
        await fs.rename(tempPath, billingStorePath);
    });
    // Recover the queue for future writes, but propagate this write's failure.
    // Account deletion must never report completion after a failed cleanup.
    billingStoreWriteQueue = write.catch(() => {});
    return write;
}

async function markBillingPlan(record) {
    await loadBillingStore();
    const normalized = normalizeBillingRecord(record);
    if (!normalized) {
        throw new Error("billing_uid_missing");
    }
    if ((await getFirebaseServices().db.collection("accountDeletionJobs").doc(normalized.uid).get()).exists) {
        throw new Error("billing_account_deleting");
    }

    billingRecords.set(normalized.uid, normalized);
    if (normalized.plan === "pro" && normalized.status === "paid") {
        aiProUidAllowList.add(normalized.uid);
    }

    await persistBillingStore();
    return normalized;
}

function billingReferenceForUser(user) {
    const uid = String(user?.uid || user?.sub || "").trim();
    if (!uid) return "";

    const signature = crypto
        .createHmac("sha256", billingWebhookSecret || firebaseProjectId || "educaria-billing-dev")
        .update(uid)
        .digest("hex")
        .slice(0, 16);

    return `educaria:${uid}:${signature}`;
}

function validBillingReference(uid, reference) {
    const normalizedUid = String(uid || "").trim();
    const provided = String(reference || "").trim();
    if (!normalizedUid || !provided || !billingWebhookSecret) return false;

    const expected = billingReferenceForUser({ uid: normalizedUid });
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    return expectedBuffer.length === providedBuffer.length
        && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function billingCheckoutUrlForUser(user) {
    if (!billingCheckoutUrl) return "";

    const uid = String(user?.uid || user?.sub || "").trim();
    const email = String(user?.email || "").trim();
    const reference = billingReferenceForUser(user);
    const url = new URL(billingCheckoutUrl);
    url.searchParams.set("teacher_uid", uid);
    url.searchParams.set("external_reference", reference);
    if (email) {
        url.searchParams.set("email", email);
    }
    return url.toString();
}

function verifyBillingWebhook(request) {
    if (!billingWebhookSecret) return false;

    const provided = String(
        request.get("x-educaria-webhook-secret") ||
        request.get("x-webhook-secret") ||
        ""
    ).trim();

    if (!provided) return false;

    const expected = Buffer.from(billingWebhookSecret);
    const actual = Buffer.from(provided);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function billingRecordFromWebhook(payload) {
    const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
    const status = String(data?.status || data?.payment_status || data?.type || "").trim().toLowerCase();
    const paidStatuses = new Set(["paid", "approved", "completed", "checkout.session.completed", "payment_intent.succeeded"]);
    if (!paidStatuses.has(status)) {
        return null;
    }

    const reference = String(data?.external_reference || data?.externalReference || data?.client_reference_id || "").trim();
    const referenceParts = reference.split(":");
    const uidFromReference = referenceParts[0] === "educaria" ? referenceParts[1] : "";

    return normalizeBillingRecord({
        uid: data?.uid || data?.teacherUid || data?.teacher_uid || uidFromReference,
        plan: "pro",
        status: "paid",
        provider: data?.provider || payload?.provider || "webhook",
        reference,
        email: data?.email || data?.customer_email || "",
        updatedAt: new Date().toISOString()
    });
}

/**
 * Returns the daily credit status for the user making the request.
 * User is identified by Firebase UID when auth is enabled, otherwise by IP.
 * Credits reset at midnight in AI_PROVIDER_DAILY_TIME_ZONE (UTC by default).
 * @param {import('express').Request} request
 * @returns {Promise<{ day: string, plan: "free" | "pro", limits: { free: number, pro: number }, policy: object, limit: number, used: number, remaining: number, resetAt: string, store: "memory" | "file" | "firestore" }>}
 */
function aiRequestQuotaKeys(request, day) {
    const userId = aiCreditUserKey(request);
    return {
        userId,
        userKey: `${userId}:ai-requests:${day}`,
        globalKey: `__educaria_platform__:ai-requests:${day}`
    };
}

function aiDailyRequestQuotaSnapshot(day, plan, userUsed = 0, platformUsed = 0) {
    const userLimit = aiDailyRequestLimitForPlan(plan);
    const normalizedUserUsed = Math.max(0, Math.floor(Number(userUsed) || 0));
    const normalizedPlatformUsed = Math.max(0, Math.floor(Number(platformUsed) || 0));
    return {
        enabled: aiGlobalDailyRequestLimit > 0 && userLimit > 0,
        display: false,
        limit: userLimit,
        used: normalizedUserUsed,
        remaining: Math.max(0, userLimit - normalizedUserUsed),
        limits: aiUserDailyRequestLimits,
        platform: {
            limit: aiGlobalDailyRequestLimit,
            used: normalizedPlatformUsed,
            remaining: Math.max(0, aiGlobalDailyRequestLimit - normalizedPlatformUsed)
        },
        resetAt: nextDailyCreditResetAt()
    };
}

function aiProviderTokenQuotaKey(day) {
    return `__educaria_platform__:ai-provider-tokens:${day}`;
}

function aiProviderTokenQuotaSnapshot(day, used = 0) {
    const normalizedUsed = Math.max(0, Math.floor(Number(used) || 0));
    const enabled = activeAiTextProvider() === "groq" && aiGlobalDailyTokenLimit > 0;
    return {
        enabled,
        limit: aiGlobalDailyTokenLimit,
        used: normalizedUsed,
        remaining: enabled ? Math.max(0, aiGlobalDailyTokenLimit - normalizedUsed) : null,
        resetAt: nextDailyCreditResetAt()
    };
}

async function aiProviderTokenQuotaFor() {
    const day = dailyCreditDateKey();
    if (activeAiTextProvider() !== "groq" || aiGlobalDailyTokenLimit <= 0) {
        return aiProviderTokenQuotaSnapshot(day, 0);
    }

    const bucket = await aiCreditRepository.get({
        key: aiProviderTokenQuotaKey(day),
        userId: "__educaria_platform__",
        day,
        plan: "provider-tokens-platform"
    });
    return aiProviderTokenQuotaSnapshot(day, bucket.used);
}

async function aiDailyRequestQuotaFor(request) {
    await loadBillingStore();
    const day = dailyCreditDateKey();
    const plan = aiPlanForRequest(request);
    const { userId, userKey, globalKey } = aiRequestQuotaKeys(request, day);
    const [userBucket, platformBucket] = await Promise.all([
        aiCreditRepository.get({ key: userKey, userId, day, plan: `requests-${plan}` }),
        aiCreditRepository.get({
            key: globalKey,
            userId: "__educaria_platform__",
            day,
            plan: "requests-platform"
        })
    ]);
    return aiDailyRequestQuotaSnapshot(day, plan, userBucket.used, platformBucket.used);
}

async function aiCreditsWithRequestQuota(request, credits) {
    const [requests, platformTokens] = await Promise.all([
        aiDailyRequestQuotaFor(request),
        aiProviderTokenQuotaFor()
    ]);
    return {
        ...credits,
        requests,
        platformTokens
    };
}

async function reserveExactAiStoreAmount(entry) {
    const expectedAmount = Math.max(1, Math.floor(Number(entry.amount) || 1));
    const result = await aiCreditRepository.reserve({ ...entry, amount: expectedAmount });

    if (result.reserved && result.cost === expectedAmount) {
        return result;
    }

    if (result.reserved && result.reservationId) {
        const refunded = await aiCreditRepository.refund({
            key: entry.key,
            reservationId: result.reservationId
        });
        return { reserved: false, cost: 0, used: refunded.used };
    }

    return result;
}

async function reserveAiProviderTokens(requestedTokens) {
    const day = dailyCreditDateKey();
    const amount = Math.max(1, Math.floor(Number(requestedTokens) || 1));

    if (activeAiTextProvider() !== "groq" || aiGlobalDailyTokenLimit <= 0) {
        return {
            reserved: true,
            disabled: true,
            reservation: null,
            quota: aiProviderTokenQuotaSnapshot(day, 0)
        };
    }

    const key = aiProviderTokenQuotaKey(day);
    const reserved = await reserveExactAiStoreAmount({
        key,
        userId: "__educaria_platform__",
        day,
        plan: "provider-tokens-platform",
        limit: aiGlobalDailyTokenLimit,
        amount,
        expiresAt: nextDailyCreditResetAt()
    });

    return {
        reserved: reserved.reserved,
        disabled: false,
        reservation: reserved.reserved ? {
            key,
            id: reserved.reservationId,
            day,
            amount,
            limit: aiGlobalDailyTokenLimit
        } : null,
        quota: aiProviderTokenQuotaSnapshot(day, reserved.used)
    };
}

async function refundAiProviderTokens(reservation) {
    if (!reservation?.key || !reservation?.id) {
        return aiProviderTokenQuotaFor();
    }
    const refunded = await aiCreditRepository.refund({
        key: reservation.key,
        reservationId: reservation.id
    });
    return aiProviderTokenQuotaSnapshot(reservation.day, refunded.used);
}

async function settleAiProviderTokens(reservation, actualTokens) {
    if (!reservation?.key || !reservation?.id) {
        return aiProviderTokenQuotaFor();
    }
    const measuredTokens = Math.max(1, Math.floor(Number(actualTokens) || 1));
    const settled = await aiCreditRepository.settle({
        key: reservation.key,
        reservationId: reservation.id,
        amount: measuredTokens,
        limit: reservation.limit
    });
    return aiProviderTokenQuotaSnapshot(reservation.day, settled.used);
}

async function reserveAiDailyRequests(request, requestedCalls = 1) {
    await loadBillingStore();
    const day = dailyCreditDateKey();
    const plan = aiPlanForRequest(request);
    const userLimit = aiDailyRequestLimitForPlan(plan);
    const amount = Math.max(1, Math.floor(Number(requestedCalls) || 1));
    const expiresAt = nextDailyCreditResetAt();
    const { userId, userKey, globalKey } = aiRequestQuotaKeys(request, day);

    if (aiGlobalDailyRequestLimit <= 0 || userLimit <= 0) {
        return {
            reserved: true,
            disabled: true,
            reservation: null,
            quota: await aiDailyRequestQuotaFor(request)
        };
    }

    const platform = await reserveExactAiStoreAmount({
        key: globalKey,
        userId: "__educaria_platform__",
        day,
        plan: "requests-platform",
        limit: aiGlobalDailyRequestLimit,
        amount,
        expiresAt
    });
    if (!platform.reserved) {
        return {
            reserved: false,
            scope: "platform",
            reservation: null,
            quota: await aiDailyRequestQuotaFor(request)
        };
    }

    const user = await reserveExactAiStoreAmount({
        key: userKey,
        userId,
        day,
        plan: `requests-${plan}`,
        limit: userLimit,
        amount,
        expiresAt
    });
    if (!user.reserved) {
        await aiCreditRepository.refund({
            key: globalKey,
            reservationId: platform.reservationId
        });
        return {
            reserved: false,
            scope: "user",
            reservation: null,
            quota: await aiDailyRequestQuotaFor(request)
        };
    }

    return {
        reserved: true,
        disabled: false,
        quota: aiDailyRequestQuotaSnapshot(day, plan, user.used, platform.used),
        reservation: {
            day,
            plan,
            amount,
            platform: {
                key: globalKey,
                id: platform.reservationId,
                limit: aiGlobalDailyRequestLimit
            },
            user: {
                key: userKey,
                id: user.reservationId,
                limit: userLimit
            }
        }
    };
}

async function refundAiDailyRequests(reservation, request) {
    if (!reservation?.platform?.id || !reservation?.user?.id) {
        return aiDailyRequestQuotaFor(request);
    }

    await Promise.all([
        aiCreditRepository.refund({ key: reservation.platform.key, reservationId: reservation.platform.id }),
        aiCreditRepository.refund({ key: reservation.user.key, reservationId: reservation.user.id })
    ]);
    return aiDailyRequestQuotaFor(request);
}

async function settleAiDailyRequests(reservation, actualCalls, request) {
    if (!reservation?.platform?.id || !reservation?.user?.id) {
        return aiDailyRequestQuotaFor(request);
    }

    const calls = Math.max(0, Math.min(
        reservation.amount,
        Math.floor(Number(actualCalls) || 0)
    ));
    if (calls <= 0) {
        return refundAiDailyRequests(reservation, request);
    }

    await Promise.all([
        aiCreditRepository.settle({
            key: reservation.platform.key,
            reservationId: reservation.platform.id,
            amount: calls,
            limit: reservation.platform.limit
        }),
        aiCreditRepository.settle({
            key: reservation.user.key,
            reservationId: reservation.user.id,
            amount: calls,
            limit: reservation.user.limit
        })
    ]);
    return aiDailyRequestQuotaFor(request);
}

function aiDailyRequestLimitError(scope) {
    if (scope === "platform") {
        return {
            error: "A capacidade diária de IA da plataforma foi atingida. Tente novamente após o próximo reset.",
            code: "platform_daily_limit"
        };
    }

    return {
        error: "Você atingiu o limite diário de gerações com IA. O acesso volta no próximo reset.",
        code: "user_daily_limit"
    };
}

async function aiDailyCreditsFor(request) {
    await loadBillingStore();
    const day = dailyCreditDateKey();
    const plan = aiPlanForRequest(request);
    const key = aiCreditBucketKey(request, day);
    const userId = aiCreditUserKey(request);
    const { used } = await aiCreditRepository.get({ key, userId, day, plan });
    return aiCreditsWithRequestQuota(request, aiDailyCreditsSnapshot(day, plan, used, isAiUnlimitedUser(request)));
}

function aiDailyCreditsSnapshot(day, plan, used = 0, unlimited = false) {
    const limit = aiDailyCreditLimitForPlan(plan);
    const normalizedUsed = Math.max(0, Math.floor(Number(used) || 0));
    return {
        day,
        plan,
        unlimited: Boolean(unlimited),
        limits: aiDailyCreditLimits,
        policy: {
            mode: aiCreditUsagePolicy.mode,
            tokensPerCredit: aiCreditUsagePolicy.tokensPerCredit,
            inputWeight: aiCreditUsagePolicy.inputWeight,
            outputWeight: aiCreditUsagePolicy.outputWeight,
            thoughtWeight: aiCreditUsagePolicy.thoughtWeight,
            minimumCharge: aiCreditUsagePolicy.minimumCharge
        },
        limit,
        used: normalizedUsed,
        remaining: unlimited ? null : Math.max(0, limit - normalizedUsed),
        resetAt: nextDailyCreditResetAt(),
        store: aiCreditStoreType()
    };
}

/**
 * Reserves the required daily credits before the provider call so concurrent
 * requests cannot all pass the available-credit check. Refunds the reservation
 * if generation fails.
 * @param {import('express').Request} request
 * @param {number} requestedCost
 * @returns {Promise<{ reserved: boolean, cost: number, credits: object, reservation: object | null }>}
 */
async function reserveAiDailyCredit(request, requestedCost = 1) {
    await loadBillingStore();
    const day = dailyCreditDateKey();
    const plan = aiPlanForRequest(request);
    const userId = aiCreditUserKey(request);
    const key = aiCreditBucketKey(request, day);
    const limit = aiDailyCreditLimitForPlan(plan);
    const estimatedCost = Math.max(1, Math.floor(Number(requestedCost) || 1));

    if (isAiUnlimitedUser(request)) {
        return {
            reserved: true,
            disabled: true,
            cost: 0,
            estimatedCost,
            credits: await aiCreditsWithRequestQuota(
                request,
                aiDailyCreditsSnapshot(day, plan, 0, true)
            ),
            reservation: {
                unlimited: true,
                day,
                plan
            }
        };
    }

    const reservation = await aiCreditRepository.reserve({
        key,
        userId,
        day,
        plan,
        limit,
        amount: estimatedCost
    });
    const credits = await aiCreditsWithRequestQuota(
        request,
        aiDailyCreditsSnapshot(day, plan, reservation.used)
    );

    if (!reservation.reserved) {
        return {
            reserved: false,
            cost: 0,
            estimatedCost,
            credits,
            reservation: null
        };
    }

    return {
        reserved: true,
        cost: reservation.cost,
        estimatedCost,
        credits,
        reservation: {
            day,
            plan,
            key,
            id: reservation.reservationId,
            cost: reservation.cost
        }
    };
}

async function refundAiDailyCredit(reservation) {
    if (reservation?.unlimited) {
        return aiDailyCreditsSnapshot(reservation.day, reservation.plan, 0, true);
    }
    if (!reservation?.key || !reservation?.id) {
        return null;
    }

    const refunded = await aiCreditRepository.refund({
        key: reservation.key,
        reservationId: reservation.id
    });
    return aiDailyCreditsSnapshot(reservation.day, reservation.plan, refunded.used);
}

async function settleAiDailyCredit(reservation, requestedCost, request) {
    if (reservation?.unlimited) {
        const measuredCost = Math.max(1, Math.floor(Number(requestedCost) || 1));
        return {
            charged: 0,
            measuredCost,
            credits: request
                ? await aiCreditsWithRequestQuota(
                    request,
                    aiDailyCreditsSnapshot(reservation.day, reservation.plan, 0, true)
                )
                : aiDailyCreditsSnapshot(reservation.day, reservation.plan, 0, true)
        };
    }
    if (!reservation?.key || !reservation?.id) return null;

    const measuredCost = Math.max(1, Math.floor(Number(requestedCost) || 1));
    const limit = aiDailyCreditLimitForPlan(reservation.plan);
    const settlement = await aiCreditRepository.settle({
        key: reservation.key,
        reservationId: reservation.id,
        amount: measuredCost,
        limit
    });
    return {
        charged: settlement.charged,
        measuredCost: settlement.measuredCost,
        credits: request
            ? await aiCreditsWithRequestQuota(
                request,
                aiDailyCreditsSnapshot(reservation.day, reservation.plan, settlement.used)
            )
            : aiDailyCreditsSnapshot(reservation.day, reservation.plan, settlement.used)
    };
}

/**
 * Express middleware: enforces Firebase authentication on AI routes.
 * Passes through immediately when AI_AUTH_REQUIRED is not "true".
 * On success, attaches the decoded JWT payload to `request.educariaUser`.
 * @type {import('express').RequestHandler}
 */
async function requireAiAuth(request, response, next) {
    if (!aiAuthRequired) {
        next();
        return;
    }

    const idToken = tokenFromAuthorizationHeader(request);
    if (!idToken) {
        return response.status(401).json({ error: "Login necessário para usar a IA." });
    }

    try {
        request.educariaUser = await verifyActiveSession(idToken, getFirebaseServices);
        next();
    } catch (error) {
        const result = sessionErrorResponse(error);
        if (result.status === 503) console.warn("EducarIA: session_verification_unavailable");
        return response.status(result.status).json(result.body);
    }
}

setInterval(() => {
    const now = Date.now();
    aiRateLimitBuckets.forEach((bucket, key) => {
        if (bucket.resetAt <= now) {
            aiRateLimitBuckets.delete(key);
        }
    });

    const providerWindowStart = now - aiRateLimitWindowMs;
    aiProviderRateLimitBuckets.forEach((timestamps, key) => {
        const activeTimestamps = timestamps.filter((timestamp) => timestamp > providerWindowStart);
        if (activeTimestamps.length) {
            aiProviderRateLimitBuckets.set(key, activeTimestamps);
        } else {
            aiProviderRateLimitBuckets.delete(key);
        }
    });

    aiCreditRepository.prune(dailyCreditDateKey()).catch((error) => {
        console.warn("EducarIA AI credit store could not be pruned:", error instanceof Error ? error.message : error);
    });
}, Math.max(60_000, aiRateLimitWindowMs)).unref?.();

function aiErrorMessage(error) {
    if (!error) return "unknown_error";

    const message = error instanceof Error ? error.message : String(error);
    const status = typeof error === "object" && error && "status" in error ? error.status : null;
    return status ? `${message} (status ${status})` : message;
}

function fallbackJsonPrompt(schemaConfig) {
    return [
        "Responda somente com JSON válido.",
        `Formato esperado: ${schemaConfig.description}.`,
        "Não use markdown, crases ou texto antes/depois do JSON."
    ].join(" ");
}

function estimateProviderTokenReservation(materialType, action, sourceText, slideOptions, generationOptions) {
    const prompt = promptFor(materialType, action, sourceText, slideOptions, generationOptions);
    const estimatedInputTokens = Math.ceil(prompt.length / 3);
    const estimatedOutputTokens = activeAiTextProvider() === "groq"
        ? groqMaxCompletionTokens
        : aiCreditUsagePolicy.estimatedOutputTokens;
    return Math.max(1, estimatedInputTokens + estimatedOutputTokens);
}

/**
 * Calls the configured text provider to generate a structured activity.
 * Groq uses strict JSON Schema. Gemini keeps the existing schema-first strategy
 * and optional plain-JSON retry for a reversible migration.
 * @param {string} materialType - Activity type key
 * @param {string} action - Teacher's goal string
 * @param {string} sourceText - Source material text
 * @param {{ name: string, description: string, schema: object }} schemaConfig - Schema from {@link schemaFor}
 * @returns {Promise<{ material: object, usageMetadata: object, providerRequests: number, provider: string, model: string }>} Parsed material and accumulated provider usage
 * @throws {Error} If the provider call fails
 */
async function generateStructuredMaterialWithRetry(materialType, action, sourceText, schemaConfig, slideOptions, generationOptions, observation) {
    const provider = activeAiTextProvider();
    const model = activeAiTextModel(provider);
    const basePrompt = promptFor(materialType, action, sourceText, slideOptions, generationOptions);

    if (provider === "groq") {
        // Portuguese educational text often tokenizes more densely than the
        // common four-characters-per-token estimate. Three keeps a useful
        // safety margin below the free plan's token-per-minute ceiling.
        const estimatedPromptTokens = Math.ceil(basePrompt.length / 3);
        if (estimatedPromptTokens > groqMaxPromptTokens) {
            const error = new Error("groq_prompt_too_long");
            error.code = "groq_prompt_too_long";
            error.status = 413;
            error.providerRequests = 0;
            throw error;
        }

        let result = null;
        try {
            result = await observation.call(() => generateGroqStructuredMaterial({
                apiKey: groqApiKey,
                model,
                prompt: basePrompt,
                schemaConfig,
                reasoningEffort: groqReasoningEffort,
                maxCompletionTokens: groqMaxCompletionTokens,
                timeoutMs: groqRequestTimeoutMs
            }));
            return {
                material: parseGeneratedJson(result.text),
                usageMetadata: result.usageMetadata,
                unmeteredRecovery: result.unmeteredRecovery === true,
                providerRequests: 1,
                provider,
                model
            };
        } catch (cause) {
            const error = cause instanceof Error ? cause : new Error(String(cause || "groq_generation_failed"));
            error.providerRequests = Math.max(1, Math.floor(Number(error.providerRequests) || 1));
            error.usageMetadata = mergeAiUsageMetadata(error.usageMetadata || {}, result?.usageMetadata || {});
            throw error;
        }
    }

    const attempts = [
        {
            label: "schema",
            contents: basePrompt,
            config: {
                responseMimeType: "application/json",
                responseJsonSchema: {
                    ...schemaConfig.schema,
                    description: schemaConfig.description
                }
            }
        },
        {
            label: "json",
            contents: `${basePrompt}\n\n${fallbackJsonPrompt(schemaConfig)}`,
            config: {
                responseMimeType: "application/json"
            }
        }
    ];

    const configuredAttempts = attempts.slice(0, aiGenerationMaxAttempts);
    let lastError = null;
    let accumulatedUsage = {};
    let providerRequests = 0;

    for (const attempt of configuredAttempts) {
        let result = null;
        try {
            providerRequests += 1;
            result = await observation.call(() => gemini.models.generateContent({
                model,
                contents: attempt.contents,
                config: attempt.config
            }));

            const material = parseGeneratedJson(result?.text || "");
            accumulatedUsage = mergeAiUsageMetadata(accumulatedUsage, result?.usageMetadata || {});
            return {
                material,
                usageMetadata: accumulatedUsage,
                providerRequests,
                provider: "gemini",
                model
            };
        } catch (error) {
            if (result?.usageMetadata) {
                accumulatedUsage = mergeAiUsageMetadata(accumulatedUsage, result.usageMetadata);
            }
            lastError = new Error(`${attempt.label}_attempt_failed: ${aiErrorMessage(error)}`);
            lastError.providerRequests = providerRequests;
            lastError.usageMetadata = accumulatedUsage;
        }
    }

    throw lastError || new Error("ai_generation_failed");
}

app.use("/api/admin", createAdminRouter({
    getServices: getFirebaseServices,
    usageAnalytics: aiUsageAnalytics,
    adminUids: parseAdminUids(process.env.ADMIN_UIDS),
    getPlan: async (user) => {
        await loadBillingStore();
        return aiPlanForRequest({ educariaUser: { ...user.customClaims, uid: user.uid } });
    },
    getCredits: async (user) => {
        const day = dailyCreditDateKey();
        const plan = user.plan;
        const unlimited = aiUnlimitedUidAllowList.has(user.uid);
        const limit = aiDailyCreditLimitForPlan(plan);
        const balance = unlimited ? null : await aiCreditRepository.peek({
            key: `${user.uid}:${plan}:${day}`, userId: user.uid, day, plan
        });
        return {
            day, limit: unlimited ? null : limit, unlimited,
            used: balance ? Math.max(0, balance.used - balance.reserved) : null,
            reserved: balance?.reserved ?? null,
            remaining: balance ? Math.max(0, limit - balance.used) : null,
            resetAt: nextDailyCreditResetAt(), store: aiCreditStoreType()
        };
    }
}));

app.get("/api/health", (_request, response) => {
    if (process.env.NODE_ENV === "production") {
        response.json({ ok: true, service: "educaria-ai" });
        return;
    }

    response.json({
        ok: true,
        textProvider: {
            preference: aiTextProviderPreference,
            active: activeAiTextProvider(),
            model: activeAiTextModel(),
            groqConfigured: Boolean(groqApiKey),
            geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
        },
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        authRequired: aiAuthRequired,
        firebaseProjectConfigured: Boolean(firebaseProjectId),
        rateLimit: {
            windowMs: aiRateLimitWindowMs,
            max: aiRateLimitMax,
            providerGlobalMax: aiGlobalRateLimitMax,
            providerUserMax: aiUserRateLimitMax
        },
        dailyCreditLimits: aiDailyCreditLimits,
        globalDailyTokenLimit: aiGlobalDailyTokenLimit,
        dailyRequestLimits: {
            platform: aiGlobalDailyRequestLimit,
            users: aiUserDailyRequestLimits
        },
        generationMaxAttempts: aiGenerationMaxAttempts,
        dailyCreditStore: aiCreditStoreType(),
        proUidAllowListSize: aiProUidAllowList.size,
        unlimitedUidAllowListSize: aiUnlimitedUidAllowList.size,
        billingCheckoutConfigured: Boolean(billingCheckoutUrl),
        billingWebhookConfigured: Boolean(billingWebhookSecret),
        maxUploadMb,
        imageGenerationEnabled: aiImageGenerationEnabled
    });
});

app.post("/api/billing/checkout", aiRateLimit, requireAiAuth, async (request, response) => {
    try {
        if (!billingWebhookSecret) {
            return response.status(503).json({
                error: "Webhook de cobrança não configurado no backend.",
                code: "billing_webhook_secret_not_configured"
            });
        }

        const user = request.educariaUser || {};
        const uid = String(user.uid || user.sub || "").trim();

        if (!uid) {
            return response.status(401).json({ error: "Login necessário para iniciar o checkout." });
        }

        await loadBillingStore();
        const record = billingRecords.get(uid) || null;
        if (record?.plan === "pro" && record.status === "paid") {
            return response.json({
                ok: true,
                alreadyPro: true,
                plan: "pro"
            });
        }

        const checkoutUrl = billingCheckoutUrlForUser(user);
        if (!checkoutUrl) {
            return response.status(503).json({
                error: "Checkout não configurado no backend.",
                code: "billing_checkout_not_configured"
            });
        }

        return response.json({
            ok: true,
            checkoutUrl,
            reference: billingReferenceForUser(user)
        });
    } catch (error) {
        console.error("EducarIA billing checkout error:", error);
        return response.status(500).json({
            error: "Não foi possível iniciar o checkout."
        });
    }
});

app.get("/api/billing/status", aiRateLimit, requireAiAuth, async (request, response) => {
    const uid = String(request.educariaUser?.uid || request.educariaUser?.sub || "").trim();
    await loadBillingStore();
    const record = uid ? billingRecords.get(uid) : null;

    response.json({
        ok: true,
        plan: record?.plan === "pro" && record.status === "paid" ? "pro" : aiPlanForRequest(request),
        billing: record || null
    });
});

app.post("/api/billing/webhook", async (request, response) => {
    if (!verifyBillingWebhook(request)) {
        return response.status(401).json({ error: "Webhook não autorizado." });
    }

    const record = billingRecordFromWebhook(request.body || {});
    if (!record) {
        return response.json({ ok: true, ignored: true });
    }

    if (!validBillingReference(record.uid, record.reference)) {
        return response.status(400).json({ error: "Referência de cobrança inválida." });
    }

    const saved = await markBillingPlan(record);
    return response.json({
        ok: true,
        plan: saved.plan,
        uid: saved.uid
    });
});

app.get("/api/ai/credits", aiRateLimit, requireAiAuth, async (request, response) => {
    response.json({
        ok: true,
        credits: await aiDailyCreditsFor(request)
    });
});

app.delete("/api/account", aiRateLimit, requireAiAuth, async (request, response) => {
    if (!accountDeletionEnabled) {
        return response.status(503).json({ code: "deletion_unavailable", error: "A exclusão está temporariamente indisponível. Nenhum dado foi removido por esta solicitação." });
    }
    try {
        const result = await accountDeletion.start(request.educariaUser, request.body);
        response.status(202).json(result);
        resumeAccountDeletions();
    } catch (error) {
        const known = [400, 401, 409].includes(error?.status);
        response.status(known ? error.status : 503).json({
            code: known ? error.code : "deletion_uncertain",
            error: known ? error.message : "Não foi possível confirmar a solicitação. Consulte o acompanhamento antes de tentar novamente."
        });
    }
});

// A receipt allows status reads only. It cannot create, resume or retarget a job.
app.post("/api/account/deletion-status", aiRateLimit, async (request, response) => {
    try {
        const result = await accountDeletion.status(request.body?.uid, request.body?.receipt);
        response.json(result);
    } catch (error) {
        response.status(error?.status === 404 ? 404 : 503).json({
            error: error?.status === 404 ? "Solicitação não encontrada neste navegador." : "Acompanhamento temporariamente indisponível. Tente novamente."
        });
    }
});

app.post("/api/ai/generate", aiRateLimit, requireAiAuth, aiGenerationRateLimit, upload.single("file"), async (request, response) => {
    let creditReservation = null;
    let requestReservation = null;
    let providerTokenReservation = null;
    let providerRequests = 0;
    let observation, usageMaterial, usageError;
    let usageSuccess = false;
    let usageCharged = null;
    try {
        const materialType = String(request.body.materialType || "").trim();
        const action = String(request.body.action || "").trim();
        let schemaConfig = schemaFor(materialType);

        if (!schemaConfig) {
            return response.status(400).json({ error: "Tipo de material não suportado." });
        }

        if (action.length > 500) {
            return response.status(400).json({ error: "Objetivo do professor muito longo (max 500 caracteres)." });
        }

        const slideOptions = materialType === "slides"
            ? normalizeSlideGenerationOptions(request.body.slideOptions, action) : undefined;
        if (slideOptions) schemaConfig = schemaFor(materialType, slideOptions);
        const generationOptions = normalizeActivityGenerationOptions(materialType, request.body.generationOptions, action);
        if (slideOptions) Object.assign(generationOptions, {
            audience: slideOptions.audience, className: slideOptions.className,
            subject: slideOptions.subject, objective: slideOptions.objective
        });

        const fileText = await extractTextFromFile(request.file);
        const sourceText = [request.body.sourceText, fileText]
            .filter(Boolean)
            .join("\n\n")
            .replace(/\u0000/g, "")
            .trim();

        if (!sourceText) {
            return response.status(400).json({ error: "Envie um texto-base ou arquivo suportado." });
        }

        if (sourceText.length > 50_000) {
            return response.status(400).json({ error: "Texto-base muito longo (max 50 000 caracteres)." });
        }

        if (!activeAiTextProvider()) {
            return response.status(503).json({ error: aiTextProviderConfigurationError() });
        }

        const reservationContext = `${action}\n${JSON.stringify(generationOptions)}\n${JSON.stringify(slideOptions || {})}`;
        const estimatedReservation = estimateAiCreditReservation(sourceText, reservationContext, aiCreditUsagePolicy);
        creditReservation = await reserveAiDailyCredit(request, estimatedReservation);
        if (!creditReservation.reserved) {
            const credits = creditReservation.credits;
            const upgradeHint = credits.plan === "free" && credits.limits.pro > credits.limit
                ? " Faça upgrade para o plano Pro para liberar mais créditos por dia."
                : "";
            return response.status(429).json({
                error: `Seus créditos de IA acabaram por hoje.${upgradeHint}`,
                credits
            });
        }

        const providerTokenEstimate = estimateProviderTokenReservation(materialType, action, sourceText, slideOptions, generationOptions);
        const providerTokenResult = await reserveAiProviderTokens(providerTokenEstimate);
        if (!providerTokenResult.reserved) {
            await refundAiDailyCredit(creditReservation.reservation);
            creditReservation = null;
            const credits = await aiDailyCreditsFor(request);
            credits.platformTokens = providerTokenResult.quota;
            return response.status(429).json({
                error: "A capacidade diária de IA da plataforma foi atingida. Tente novamente após o próximo reset.",
                code: "platform_daily_token_limit",
                credits
            });
        }
        providerTokenReservation = providerTokenResult.reservation;

        const dailyRequestReservation = await reserveAiDailyRequests(request, aiGenerationMaxAttempts);
        if (!dailyRequestReservation.reserved) {
            await Promise.all([
                refundAiDailyCredit(creditReservation.reservation),
                refundAiProviderTokens(providerTokenReservation)
            ]);
            creditReservation = null;
            providerTokenReservation = null;
            const credits = await aiDailyCreditsFor(request);
            return response.status(429).json({
                ...aiDailyRequestLimitError(dailyRequestReservation.scope),
                credits
            });
        }
        requestReservation = dailyRequestReservation.reservation;

        observation = createUsageObservation({
            uid: request.educariaUser?.uid, plan: aiPlanForRequest(request), unlimited: isAiUnlimitedUser(request),
            materialType, provider: activeAiTextProvider(), model: activeAiTextModel(),
            context: usageContext(materialType, generationOptions, slideOptions, Boolean(request.file)), policy: aiCreditUsagePolicy
        });
        let generated;
        try {
            generated = await generateStructuredMaterialWithRetry(materialType, action, sourceText, schemaConfig, slideOptions, generationOptions, observation);
            providerRequests = generated.providerRequests;
        } catch (error) {
            providerRequests = Math.max(0, Math.floor(Number(error?.providerRequests) || 0));
            throw error;
        }
        const measuredCharge = aiCreditsForUsage(generated.usageMetadata, aiCreditUsagePolicy);
        const normalizedMaterial = materialType === "slides"
            ? { ...normalizeSlidesMaterial(generated.material, slideOptions), generation_options: slideOptions }
            : generated.material;
        const material = applyActivityGenerationSettings(materialType, normalizedMaterial, generationOptions);
        usageMaterial = material;

        const providerTokenQuota = await settleAiProviderTokens(
            providerTokenReservation,
            // A recovered error may omit usage: retain the conservative platform
            // reservation, but never present estimated tokens as measured usage.
            generated.unmeteredRecovery ? providerTokenEstimate : measuredCharge.usage.totalTokens
        );
        providerTokenReservation = null;
        const requestQuota = await settleAiDailyRequests(requestReservation, providerRequests, request);
        requestReservation = null;
        let settlement;
        if (generated.unmeteredRecovery) {
            await refundAiDailyCredit(creditReservation.reservation);
            creditReservation = null;
            usageCharged = 0;
            settlement = { charged: 0, measuredCost: null, credits: await aiDailyCreditsFor(request) };
        } else {
            settlement = await settleAiDailyCredit(creditReservation.reservation, measuredCharge.credits, request);
        }
        usageCharged = settlement.charged;
        creditReservation = null;
        settlement.credits.requests = requestQuota;
        settlement.credits.platformTokens = providerTokenQuota;
        usageSuccess = true;
        return response.json({
            ok: true,
            materialType,
            material,
            credits: settlement.credits,
            charge: {
                materialType,
                provider: generated.provider,
                model: generated.model,
                basis: generated.unmeteredRecovery ? "unavailable" : "usage",
                cost: settlement.charged,
                measuredCost: settlement.measuredCost,
                weightedTokens: generated.unmeteredRecovery ? null : measuredCharge.weightedTokens,
                usage: generated.unmeteredRecovery ? null : measuredCharge.usage
            }
        });
    } catch (error) {
        usageError = error;
        if (creditReservation?.reserved) {
            await refundAiDailyCredit(creditReservation.reservation).then(() => { usageCharged = 0; }).catch((refundError) => {
                console.warn("EducarIA AI credit refund failed:", refundError instanceof Error ? refundError.message : refundError);
            });
        }
        if (providerTokenReservation) {
            const failedUsage = normalizeAiUsageMetadata(error?.usageMetadata || {});
            const tokenQuotaAction = failedUsage.totalTokens > 0
                ? settleAiProviderTokens(providerTokenReservation, failedUsage.totalTokens)
                : refundAiProviderTokens(providerTokenReservation);
            await tokenQuotaAction.catch((quotaError) => {
                console.warn("EducarIA provider token quota update failed:", quotaError instanceof Error ? quotaError.message : quotaError);
            });
        }
        if (requestReservation) {
            const quotaAction = providerRequests > 0
                ? settleAiDailyRequests(requestReservation, providerRequests, request)
                : refundAiDailyRequests(requestReservation, request);
            await quotaAction.catch((quotaError) => {
                console.warn("EducarIA AI request quota update failed:", quotaError instanceof Error ? quotaError.message : quotaError);
            });
        }

        if (isUploadValidationError(error)) {
            return response.status(400).json({ error: "Arquivo não suportado. Envie TXT, RTF, DOCX ou PDF válidos." });
        }

        if (["invalid_slide_options", "invalid_generation_options"].includes(error?.code)) {
            return response.status(400).json({ error: error.message, code: error.code });
        }

        if (error?.code === "groq_prompt_too_long") {
            return response.status(413).json({
                error: "O conteúdo é longo demais para a geração gratuita. Reduza o texto ou envie apenas os trechos mais importantes.",
                code: "content_too_long"
            });
        }

        if (["json_validate_failed", "groq_empty_response", "groq_response_incomplete"].includes(error?.code)
            || /^(empty_model_response|invalid_json_response)/.test(error?.message || "")) {
            return response.status(502).json({
                error: error?.code === "groq_response_incomplete"
                    ? "A IA não conseguiu concluir todos os slides ou itens. Tente uma quantidade menor ou um pedido mais curto. Seu material anterior foi preservado."
                    : "A IA retornou um material incompleto que não pôde ser recuperado com segurança. Tente novamente; seu material anterior foi preservado.",
                code: "ai_response_incomplete"
            });
        }

        if (Number(error?.status) === 429) {
            if (error?.retryAfter) {
                response.setHeader("Retry-After", String(error.retryAfter));
            }
            return response.status(429).json({
                error: "A IA atingiu um limite temporário do provedor. Aguarde um pouco e tente novamente; seus créditos não foram consumidos.",
                code: "provider_rate_limit"
            });
        }

        if (Number(error?.status) === 503 || error?.code === "groq_connection_failed") {
            return response.status(503).json({
                error: "Não foi possível conectar ao serviço de IA. Tente novamente em instantes.",
                code: "provider_unavailable"
            });
        }

        console.error("EducarIA AI service error:", error);
        return response.status(500).json({
            error: "Falha ao gerar material com IA.",
            ...(process.env.NODE_ENV === "development" && { detail: error instanceof Error ? error.message : "unknown_error" })
        });
    } finally {
        await aiUsageAnalytics.record(observation?.finish({ success: usageSuccess, material: usageMaterial, creditsCharged: usageCharged, error: usageError }));
    }
});

app.post("/api/model-template/generate", aiRateLimit, requireAiAuth, upload.single("file"), async (request, response) => {
    try {
        const materialType = String(request.body.materialType || "").trim();

        if (materialType !== "wheel") {
            return response.status(400).json({ error: "Tipo de material ainda não suportado para arquivo modelo." });
        }

        const sourceText = await extractTextFromFile(request.file);
        if (!sourceText) {
            return response.status(400).json({ error: "Envie um arquivo preenchido com o modelo da roleta." });
        }

        const material = parseWheelTemplateText(sourceText);
        return response.json({
            ok: true,
            materialType,
            material
        });
    } catch (error) {
        if (isUploadValidationError(error)) {
            return response.status(400).json({ error: "Arquivo não suportado. Envie um RTF válido do modelo." });
        }

        console.error("EducarIA template parser error:", error);
        return response.status(500).json({
            error: error instanceof Error ? error.message : "Falha ao ler o arquivo modelo."
        });
    }
});

app.post("/api/ai/generate-image", aiRateLimit, requireAiAuth, aiGenerationRateLimit, async (request, response) => {
    let creditReservation = null;
    let requestReservation = null;
    let providerRequests = 0;
    let observation, usageError;
    let usageSuccess = false;
    let usageCharged = null;
    try {
        const title = String(request.body.title || "").trim();
        const subtitle = String(request.body.subtitle || "").trim();
        const body = String(request.body.body || "").trim();
        const prompt = String(request.body.prompt || "").trim();

        if (!title && !subtitle && !body && !prompt) {
            return response.status(400).json({ error: "Envie contexto suficiente para gerar a imagem." });
        }

        if ((title + subtitle + body + prompt).length > 2_000) {
            return response.status(400).json({ error: "Contexto da imagem muito longo (máximo de 2.000 caracteres no total)." });
        }

        if (!aiImageGenerationEnabled) {
            return response.status(403).json({ error: "Geração de imagem por IA desativada no Free Tier." });
        }

        if (!gemini) {
            return response.status(503).json({ error: "GEMINI_API_KEY não configurada no backend." });
        }

        const imageContext = [title, subtitle, body, prompt].filter(Boolean).join(" ");
        const estimatedReservation = estimateAiCreditReservation(imageContext, "Gerar imagem", aiCreditUsagePolicy)
            + aiCreditUsagePolicy.imageOutputCredits;
        creditReservation = await reserveAiDailyCredit(request, estimatedReservation);
        if (!creditReservation.reserved) {
            return response.status(429).json({
                error: "Seus créditos de IA acabaram por hoje.",
                credits: creditReservation.credits
            });
        }

        const dailyRequestReservation = await reserveAiDailyRequests(request, 1);
        if (!dailyRequestReservation.reserved) {
            await refundAiDailyCredit(creditReservation.reservation);
            creditReservation = null;
            const credits = await aiDailyCreditsFor(request);
            return response.status(429).json({
                ...aiDailyRequestLimitError(dailyRequestReservation.scope),
                credits
            });
        }
        requestReservation = dailyRequestReservation.reservation;

        observation = createUsageObservation({
            uid: request.educariaUser?.uid, plan: aiPlanForRequest(request), unlimited: isAiUnlimitedUser(request),
            materialType: "image", provider: "gemini", model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
            context: usageContext("image"), policy: aiCreditUsagePolicy
        });
        providerRequests = 1;
        const result = await observation.call(() => gemini.models.generateContent({
            model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
            contents: imagePromptForSlide({ title, subtitle, body, prompt })
        }));

        const parts = result?.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((part) => part.inlineData?.data);

        if (!imagePart?.inlineData?.data) {
            await refundAiDailyCredit(creditReservation.reservation);
            usageCharged = 0;
            creditReservation = null;
            const requestQuota = await settleAiDailyRequests(requestReservation, providerRequests, request);
            requestReservation = null;
            const credits = await aiDailyCreditsFor(request);
            credits.requests = requestQuota;
            return response.status(502).json({
                error: "O Gemini não retornou imagem para este slide.",
                credits
            });
        }

        const measuredCharge = aiCreditsForUsage(result?.usageMetadata || {}, aiCreditUsagePolicy, {
            additionalCredits: aiCreditUsagePolicy.imageOutputCredits
        });
        const requestQuota = await settleAiDailyRequests(requestReservation, providerRequests, request);
        requestReservation = null;
        const settlement = await settleAiDailyCredit(creditReservation.reservation, measuredCharge.credits, request);
        usageCharged = settlement.charged;
        creditReservation = null;
        settlement.credits.requests = requestQuota;
        usageSuccess = true;

        return response.json({
            ok: true,
            mimeType: imagePart.inlineData.mimeType || "image/png",
            imageBase64: imagePart.inlineData.data,
            credits: settlement.credits,
            charge: {
                materialType: "image",
                basis: "usage",
                cost: settlement.charged,
                measuredCost: settlement.measuredCost,
                weightedTokens: measuredCharge.weightedTokens,
                usage: measuredCharge.usage
            }
        });
    } catch (error) {
        usageError = error;
        if (creditReservation?.reserved) {
            await refundAiDailyCredit(creditReservation.reservation).then(() => { usageCharged = 0; }).catch((refundError) => {
                console.warn("EducarIA image credit refund failed:", refundError instanceof Error ? refundError.message : refundError);
            });
        }
        if (requestReservation) {
            const quotaAction = providerRequests > 0
                ? settleAiDailyRequests(requestReservation, providerRequests, request)
                : refundAiDailyRequests(requestReservation, request);
            await quotaAction.catch((quotaError) => {
                console.warn("EducarIA image request quota update failed:", quotaError instanceof Error ? quotaError.message : quotaError);
            });
        }
        console.error("EducarIA image generation error:", error);
        return response.status(500).json({
            error: "Falha ao gerar imagem com IA.",
            ...(process.env.NODE_ENV === "development" && { detail: error instanceof Error ? error.message : "unknown_error" })
        });
    } finally {
        await aiUsageAnalytics.record(observation?.finish({ success: usageSuccess, creditsCharged: usageCharged, error: usageError }));
    }
});

app.use((error, _request, response, next) => {
    if (!error) {
        next();
        return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return response.status(413).json({ error: `Arquivo grande demais. Envie arquivos de até ${maxUploadMb} MB.` });
    }

    if (isUploadValidationError(error)) {
        return response.status(400).json({ error: "Arquivo não suportado. Envie TXT, RTF, DOCX ou PDF válidos." });
    }

    return next(error);
});

app.listen(port, () => {
    console.log(`EducarIA AI service listening on http://localhost:${port}`);
    resumeAccountDeletions();
});
if (accountDeletionEnabled) setInterval(resumeAccountDeletions, 15_000).unref();
