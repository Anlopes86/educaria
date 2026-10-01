import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const DEFAULT_RESERVATION_TTL_MS = 60 * 60 * 1000;
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

function nonNegativeInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

function positiveInteger(value, fallback = 1) {
    return Math.max(1, nonNegativeInteger(value) || fallback);
}

function cloneReservations(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(Object.entries(value).flatMap(([id, reservation]) => {
        const amount = nonNegativeInteger(reservation?.amount);
        if (!id || amount <= 0) return [];
        return [[id, {
            amount,
            createdAt: String(reservation?.createdAt || new Date().toISOString()),
            expiresAt: String(reservation?.expiresAt || "")
        }]];
    }));
}

function normalizeBucket(value, fallback = {}) {
    if (typeof value === "number" || typeof value === "string") {
        return {
            userId: String(fallback.userId || ""),
            day: String(fallback.day || ""),
            plan: String(fallback.plan || "free"),
            used: nonNegativeInteger(value),
            reservations: {}
        };
    }

    return {
        userId: String(value?.userId || fallback.userId || ""),
        day: String(value?.day || fallback.day || ""),
        plan: String(value?.plan || fallback.plan || "free"),
        used: nonNegativeInteger(value?.used),
        reservations: cloneReservations(value?.reservations)
    };
}

function releaseExpiredReservations(bucket, ttlMs, now = Date.now()) {
    let released = 0;
    const reservations = {};

    Object.entries(bucket.reservations || {}).forEach(([id, reservation]) => {
        const createdAt = Date.parse(reservation.createdAt);
        const explicitExpiry = Date.parse(reservation.expiresAt);
        const expired = Number.isFinite(explicitExpiry)
            ? now >= explicitExpiry
            : !Number.isFinite(createdAt) || now - createdAt >= ttlMs;
        if (expired) {
            released += nonNegativeInteger(reservation.amount);
            return;
        }
        reservations[id] = reservation;
    });

    if (released <= 0) return false;
    bucket.used = Math.max(0, bucket.used - released);
    bucket.reservations = reservations;
    return true;
}

function reserveInBucket(bucket, amount, limit, reservationId, ttlMs, expiresAt = "") {
    releaseExpiredReservations(bucket, ttlMs);
    const remaining = Math.max(0, nonNegativeInteger(limit) - bucket.used);
    if (remaining <= 0) {
        return { reserved: false, cost: 0, used: bucket.used };
    }

    const cost = Math.min(positiveInteger(amount), remaining);
    bucket.used += cost;
    bucket.reservations[reservationId] = {
        amount: cost,
        createdAt: new Date().toISOString(),
        expiresAt: String(expiresAt || "")
    };
    return { reserved: true, cost, used: bucket.used, reservationId };
}

function settleInBucket(bucket, reservationId, amount, limit) {
    const reservation = bucket.reservations?.[reservationId];
    if (!reservation) {
        return { found: false, charged: 0, measuredCost: positiveInteger(amount), used: bucket.used };
    }

    const reservedCost = positiveInteger(reservation.amount);
    const measuredCost = positiveInteger(amount);
    const baseUsed = Math.max(0, bucket.used - reservedCost);
    const charged = Math.min(measuredCost, Math.max(0, nonNegativeInteger(limit) - baseUsed));
    bucket.used = baseUsed + charged;
    delete bucket.reservations[reservationId];
    return { found: true, charged, measuredCost, used: bucket.used };
}

function refundInBucket(bucket, reservationId) {
    const reservation = bucket.reservations?.[reservationId];
    if (!reservation) return { found: false, used: bucket.used };

    bucket.used = Math.max(0, bucket.used - positiveInteger(reservation.amount));
    delete bucket.reservations[reservationId];
    return { found: true, used: bucket.used };
}

class MemoryAiCreditStore {
    constructor({ filePath = "", reservationTtlMs = DEFAULT_RESERVATION_TTL_MS } = {}) {
        this.type = filePath ? "file" : "memory";
        this.filePath = filePath ? path.resolve(filePath) : "";
        this.reservationTtlMs = positiveInteger(reservationTtlMs, DEFAULT_RESERVATION_TTL_MS);
        this.buckets = new Map();
        this.loaded = false;
        this.loadPromise = null;
        this.writeQueue = Promise.resolve();
    }

    async load() {
        if (this.loaded) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            if (!this.filePath) return;
            try {
                const content = await fs.readFile(this.filePath, "utf8");
                const parsed = JSON.parse(content);
                const buckets = parsed?.buckets && typeof parsed.buckets === "object" ? parsed.buckets : parsed;
                Object.entries(buckets || {}).forEach(([key, value]) => {
                    const bucket = normalizeBucket(value);
                    if (bucket.used > 0) this.buckets.set(key, bucket);
                });
            } catch (error) {
                if (error?.code !== "ENOENT") throw error;
            }
        })();

        try {
            await this.loadPromise;
            this.loaded = true;
        } finally {
            this.loadPromise = null;
        }
    }

    async persist() {
        if (!this.filePath) return;
        const payload = JSON.stringify({
            version: 2,
            updatedAt: new Date().toISOString(),
            buckets: Object.fromEntries(this.buckets)
        }, null, 2);

        this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
            await fs.mkdir(path.dirname(this.filePath), { recursive: true });
            const temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
            await fs.writeFile(temporaryPath, payload, "utf8");
            await fs.rename(temporaryPath, this.filePath);
        });
        return this.writeQueue;
    }

    async get({ key, userId, day, plan }) {
        await this.load();
        const bucket = normalizeBucket(this.buckets.get(key), { userId, day, plan });
        if (releaseExpiredReservations(bucket, this.reservationTtlMs)) {
            if (bucket.used > 0) this.buckets.set(key, bucket);
            else this.buckets.delete(key);
            await this.persist();
        }
        return { used: bucket.used };
    }

    async reserve({ key, userId, day, plan, limit, amount, reservationId = crypto.randomUUID(), expiresAt = "" }) {
        await this.load();
        const bucket = normalizeBucket(this.buckets.get(key), { userId, day, plan });
        bucket.userId = String(userId || bucket.userId);
        bucket.day = String(day || bucket.day);
        bucket.plan = String(plan || bucket.plan);
        const result = reserveInBucket(bucket, amount, limit, reservationId, this.reservationTtlMs, expiresAt);
        if (bucket.used > 0) this.buckets.set(key, bucket);
        else this.buckets.delete(key);
        await this.persist();
        return result;
    }

    async settle({ key, reservationId, amount, limit }) {
        await this.load();
        const bucket = normalizeBucket(this.buckets.get(key));
        const result = settleInBucket(bucket, reservationId, amount, limit);
        if (bucket.used > 0) this.buckets.set(key, bucket);
        else this.buckets.delete(key);
        await this.persist();
        return result;
    }

    async refund({ key, reservationId }) {
        await this.load();
        const bucket = normalizeBucket(this.buckets.get(key));
        const result = refundInBucket(bucket, reservationId);
        if (bucket.used > 0) this.buckets.set(key, bucket);
        else this.buckets.delete(key);
        await this.persist();
        return result;
    }

    async deleteUser(userId) {
        await this.load();
        const prefix = `${userId}:`;
        for (const [key, bucket] of this.buckets) {
            if (bucket.userId === userId || key.startsWith(prefix)) this.buckets.delete(key);
        }
        await this.persist();
    }

    async prune(currentDay) {
        await this.load();
        let changed = false;
        for (const [key, bucket] of this.buckets) {
            if ((bucket.day && bucket.day !== currentDay) || (!bucket.day && !key.endsWith(`:${currentDay}`))) {
                this.buckets.delete(key);
                changed = true;
            }
        }
        if (changed) await this.persist();
    }
}

function parseCredentials(rawJson, rawBase64) {
    const source = String(rawJson || "").trim()
        || (rawBase64 ? Buffer.from(String(rawBase64), "base64").toString("utf8") : "");
    if (!source) return undefined;

    let parsed;
    try { parsed = JSON.parse(source); }
    catch { throw new Error("Invalid Firebase credentials: provide the service account JSON content, not its filename."); }
    if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
}

function firestoreString(value) {
    return { stringValue: String(value || "") };
}

function bucketToFirestoreFields(bucket) {
    return {
        version: { integerValue: "1" },
        userId: firestoreString(bucket.userId),
        day: firestoreString(bucket.day),
        plan: firestoreString(bucket.plan),
        used: { integerValue: String(nonNegativeInteger(bucket.used)) },
        reservationsJson: firestoreString(JSON.stringify(bucket.reservations || {})),
        updatedAt: { timestampValue: new Date().toISOString() },
        expiresAt: { timestampValue: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString() }
    };
}

function firestoreFieldsToBucket(fields = {}) {
    let reservations = {};
    try {
        reservations = JSON.parse(fields.reservationsJson?.stringValue || "{}");
    } catch {
        reservations = {};
    }

    return normalizeBucket({
        userId: fields.userId?.stringValue,
        day: fields.day?.stringValue,
        plan: fields.plan?.stringValue,
        used: fields.used?.integerValue,
        reservations
    });
}

function isFirestoreConflict(error) {
    const status = Number(error?.response?.status || error?.status || error?.code);
    return status === 409 || status === 412;
}

class FirestoreAiCreditStore {
    constructor({
        projectId,
        databaseId = "(default)",
        collection = "aiCreditUsage",
        credentials,
        reservationTtlMs = DEFAULT_RESERVATION_TTL_MS
    }) {
        if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required for the Firestore credit store.");
        if (!/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(collection)) {
            throw new Error("AI_CREDIT_FIRESTORE_COLLECTION contains invalid characters.");
        }

        this.type = "firestore";
        this.projectId = projectId;
        this.databaseId = databaseId;
        this.collection = collection;
        this.reservationTtlMs = positiveInteger(reservationTtlMs, DEFAULT_RESERVATION_TTL_MS);
        this.databaseRoot = `projects/${projectId}/databases/${databaseId}`;
        this.apiRoot = `https://firestore.googleapis.com/v1/${this.databaseRoot}`;
        this.auth = new GoogleAuth({
            projectId,
            credentials,
            scopes: [FIRESTORE_SCOPE]
        });
        this.clientPromise = null;
    }

    async client() {
        if (!this.clientPromise) this.clientPromise = this.auth.getClient();
        return this.clientPromise;
    }

    documentId(key) {
        return crypto.createHash("sha256").update(key).digest("hex");
    }

    documentName(key) {
        return `${this.databaseRoot}/documents/${this.collection}/${this.documentId(key)}`;
    }

    documentUrl(key) {
        return `https://firestore.googleapis.com/v1/${this.documentName(key)}`;
    }

    async read(key, fallback = {}) {
        const client = await this.client();
        try {
            const response = await client.request({ url: this.documentUrl(key), method: "GET" });
            return {
                exists: true,
                updateTime: response.data.updateTime,
                bucket: normalizeBucket(firestoreFieldsToBucket(response.data.fields), fallback)
            };
        } catch (error) {
            if (Number(error?.response?.status || error?.status) === 404) {
                return { exists: false, updateTime: "", bucket: normalizeBucket(null, fallback) };
            }
            throw error;
        }
    }

    async commit(key, bucket, version) {
        const client = await this.client();
        const write = {
            update: {
                name: this.documentName(key),
                fields: bucketToFirestoreFields(bucket)
            },
            currentDocument: version.exists
                ? { updateTime: version.updateTime }
                : { exists: false }
        };
        await client.request({
            url: `${this.apiRoot}/documents:commit`,
            method: "POST",
            data: { writes: [write] }
        });
    }

    async mutate(key, fallback, mutation) {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const version = await this.read(key, fallback);
            const bucket = normalizeBucket(version.bucket, fallback);
            const outcome = mutation(bucket);
            if (outcome?.write === false) return outcome.result;

            try {
                await this.commit(key, bucket, version);
                return outcome.result;
            } catch (error) {
                if (!isFirestoreConflict(error) || attempt === 7) throw error;
            }
        }
        throw new Error("Could not update the AI credit balance atomically.");
    }

    async get({ key, userId, day, plan }) {
        return this.mutate(key, { userId, day, plan }, (bucket) => {
            const changed = releaseExpiredReservations(bucket, this.reservationTtlMs);
            return { write: changed, result: { used: bucket.used } };
        });
    }

    async reserve({ key, userId, day, plan, limit, amount, reservationId = crypto.randomUUID(), expiresAt = "" }) {
        return this.mutate(key, { userId, day, plan }, (bucket) => {
            bucket.userId = String(userId || bucket.userId);
            bucket.day = String(day || bucket.day);
            bucket.plan = String(plan || bucket.plan);
            const result = reserveInBucket(bucket, amount, limit, reservationId, this.reservationTtlMs, expiresAt);
            return { write: true, result };
        });
    }

    async settle({ key, reservationId, amount, limit }) {
        return this.mutate(key, {}, (bucket) => {
            const result = settleInBucket(bucket, reservationId, amount, limit);
            return { write: result.found, result };
        });
    }

    async refund({ key, reservationId }) {
        return this.mutate(key, {}, (bucket) => {
            const result = refundInBucket(bucket, reservationId);
            return { write: result.found, result };
        });
    }

    async deleteUser(userId) {
        const client = await this.client();
        const response = await client.request({
            url: `${this.apiRoot}/documents:runQuery`,
            method: "POST",
            data: {
                structuredQuery: {
                    from: [{ collectionId: this.collection }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: "userId" },
                            op: "EQUAL",
                            value: firestoreString(userId)
                        }
                    }
                }
            }
        });

        const names = (Array.isArray(response.data) ? response.data : [])
            .map((item) => item?.document?.name)
            .filter(Boolean);
        for (let index = 0; index < names.length; index += 500) {
            await client.request({
                url: `${this.apiRoot}/documents:commit`,
                method: "POST",
                data: { writes: names.slice(index, index + 500).map((name) => ({ delete: name })) }
            });
        }
    }

    async prune() {
        // Firestore documents include expiresAt so a database TTL policy can remove them.
    }
}

export function createAiCreditStore({
    type = "memory",
    filePath = ".data/ai-credits.json",
    projectId = "",
    databaseId = "(default)",
    collection = "aiCreditUsage",
    credentialsJson = "",
    credentialsBase64 = "",
    reservationTtlMs = DEFAULT_RESERVATION_TTL_MS
} = {}) {
    const normalizedType = String(type || "memory").trim().toLowerCase();
    if (!new Set(["memory", "file", "firestore"]).has(normalizedType)) {
        throw new Error(`Unsupported AI_CREDIT_STORE: ${normalizedType}`);
    }

    if (normalizedType === "firestore") {
        return new FirestoreAiCreditStore({
            projectId,
            databaseId,
            collection,
            credentials: parseCredentials(credentialsJson, credentialsBase64),
            reservationTtlMs
        });
    }

    return new MemoryAiCreditStore({
        filePath: normalizedType === "file" ? filePath : "",
        reservationTtlMs
    });
}
