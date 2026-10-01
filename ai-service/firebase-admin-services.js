import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export function parseAdminCredentials(env, projectId) {
    const raw = String(env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
    const encoded = String(env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 || "").trim();
    if (!raw && !encoded) return null;
    try {
        const value = JSON.parse(raw || Buffer.from(encoded, "base64").toString("utf8"));
        if (value.type !== "service_account" || value.project_id !== projectId
            || typeof value.client_email !== "string" || typeof value.private_key !== "string") {
            throw new Error();
        }
        return { ...value, private_key: value.private_key.replace(/\\n/g, "\n") };
    } catch {
        // Never include credential contents (or JSON.parse's input excerpt) in logs.
        throw Object.assign(new Error("Invalid Firebase Admin credentials or project mismatch."), { code: "admin/configuration-error" });
    }
}

export function createFirebaseServices(env = process.env) {
    let services;
    return () => {
        if (services) return services;
        if (env.NODE_ENV === "production" && (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_STORAGE_EMULATOR_HOST)) {
            throw Object.assign(new Error("Firebase emulators cannot be used in production."), { code: "admin/configuration-error" });
        }
        const projectId = String(env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || "").trim();
        if (!projectId) throw Object.assign(new Error("Firebase project is required."), { code: "admin/configuration-error" });
        const credentials = parseAdminCredentials(env, projectId);
        const bucketName = String(env.FIREBASE_STORAGE_BUCKET || "").trim();
        // Keep health/startup independent of loading the SDK's large dependency tree.
        const { applicationDefault, cert, initializeApp } = require("firebase-admin/app");
        const { getAuth } = require("firebase-admin/auth");
        const { getFirestore } = require("firebase-admin/firestore");
        const { getStorage } = require("firebase-admin/storage");
        const app = initializeApp({
            projectId,
            credential: credentials ? cert(credentials) : applicationDefault(),
            ...(bucketName ? { storageBucket: bucketName } : {})
        }, "educaria-api");
        // Teacher data and the deletion lock are always in the default database.
        // AI_CREDIT_FIRESTORE_DATABASE only controls the independent usage ledger.
        services = {
            auth: getAuth(app), db: getFirestore(app),
            bucket: () => {
                if (!bucketName) throw Object.assign(new Error("FIREBASE_STORAGE_BUCKET is required."), { code: "admin/configuration-error" });
                return getStorage(app).bucket(bucketName);
            }
        };
        return services;
    };
}

const rejectedSessions = new Set([
    "auth/argument-error", "auth/invalid-id-token", "auth/id-token-expired",
    "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found", "auth/account-deleting"
]);

export function sessionErrorResponse(error) {
    return rejectedSessions.has(error?.code)
        ? { status: 401, body: { code: "session_invalid", error: "Sessão inválida ou expirada. Entre novamente." } }
        : { status: 503, body: { code: "auth_unavailable", error: "Não foi possível validar sua sessão. Tente novamente em instantes." } };
}

export async function verifyActiveSession(idToken, getServices) {
    const { auth, db } = getServices();
    const user = await auth.verifyIdToken(idToken, true);
    if (!user.uid || user.uid.includes("/") || user.uid === "." || user.uid === "..") {
        throw Object.assign(new Error("Invalid UID."), { code: "auth/invalid-id-token" });
    }
    const deletion = await db.collection("accountDeletionJobs").doc(user.uid).get();
    if (deletion.exists) throw Object.assign(new Error("Account deletion requested."), { code: "auth/account-deleting" });
    return user;
}
