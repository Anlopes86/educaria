// Explicitly invoked release check. All writes/cleanup are restricted to fresh,
// cryptographically random probe UIDs; never accepts an existing user as input.
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, cert, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const root = path.resolve(import.meta.dirname, "../..");
const projectId = "educaria-f46b2";
const baseUrl = "https://educaria-api-anlopes86.onrender.com";
const credentialPath = process.argv[2];
if (!credentialPath || process.argv[3] !== "--create-disposable-probe") throw new Error("Explicit disposable-probe flag required.");
const expectDeletionEnabled = process.argv[4] === "--expect-deletion-enabled";
if (process.argv[4] && !expectDeletionEnabled) throw new Error("Unexpected smoke-test option.");
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Unexpected emulator override.");
let credentials;
try {
    credentials = JSON.parse(await fs.readFile(credentialPath, "utf8"));
    if (credentials.project_id !== projectId || credentials.type !== "service_account") throw new Error();
} catch { throw new Error("Invalid credential or project mismatch."); }
const publicConfig = await fs.readFile(path.join(root, "assets/js/firebase-config.js"), "utf8");
const apiKey = publicConfig.match(/apiKey:\s*"([^"]+)"/)?.[1];
if (!apiKey) throw new Error("Missing public Firebase web configuration.");
const app = initializeApp({ projectId, credential: cert(credentials) }, "educaria-release-smoke");
const auth = getAuth(app);
const db = getFirestore(app);
const uid = `release-probe-${randomUUID()}`;
const otherUid = `release-probe-${randomUUID()}`;
let createdUser = false;
let createdContent = false;
const results = [];
async function expectResponse(name, response, expected) {
    // Never log the response body: Auth responses contain tokens.
    results.push({ check: name, status: response.status, passed: response.status === expected });
    if (response.status !== expected) throw new Error(`${name}: expected ${expected}, received ${response.status}`);
    return response;
}
async function signIn() {
    const token = await auth.createCustomToken(uid);
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, returnSecureToken: true }), signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) throw new Error(`Probe sign-in failed (${response.status}).`);
    const body = await response.json();
    if (!body.idToken) throw new Error("Missing probe ID token.");
    // signInWithCustomToken need not return localId. Validate the signed identity.
    const identity = await auth.verifyIdToken(body.idToken, true);
    if (identity.uid !== uid) throw new Error("Unexpected probe identity.");
    return body.idToken;
}
const api = (route, token, options = {}) => fetch(baseUrl + route, {
    ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(90_000)
});
const firestore = (relativePath, token, options = {}) => fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${relativePath}`,
    { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(30_000) }
);
try {
    await auth.createUser({ uid, displayName: "Verificação descartável da publicação" });
    createdUser = true;
    let token = await signIn();
    const creditsResponse = await expectResponse("authenticated_api", await api("/api/ai/credits", token), 200);
    const credits = await creditsResponse.json();
    if (credits?.credits?.store !== "firestore") throw new Error("Production credits are not using Firestore.");
    // Empty legacy request can never start deletion, regardless of the feature flag.
    const deletionResponse = await expectResponse(expectDeletionEnabled ? "legacy_deletion_rejected" : "account_deletion_disabled",
        await api("/api/account", token, { method: "DELETE" }), expectDeletionEnabled ? 400 : 503);
    if ((await deletionResponse.json()).code !== (expectDeletionEnabled ? "invalid_deletion_request" : "deletion_unavailable")) {
        throw new Error("Deletion flag was not confirmed.");
    }

    // Only own disposable documents. Mark content cleanup before the first write.
    createdContent = true;
    await db.doc(`teachers/${uid}`).create({ name: "Probe", email: "probe@example.invalid" });
    await db.doc(`teachers/${otherUid}`).create({ name: "Other probe", role: "teacher", plan: "free" });
    await expectResponse("own_legacy_profile_read", await firestore(`teachers/${uid}`, token), 200);
    await expectResponse("cross_account_read_denied", await firestore(`teachers/${otherUid}`, token), 403);
    await expectResponse("self_upgrade_denied", await firestore(`teachers/${uid}?updateMask.fieldPaths=plan`, token, {
        method: "PATCH", body: JSON.stringify({ fields: { plan: { stringValue: "pro" } } })
    }), 403);
    await expectResponse("legacy_profile_edit_allowed", await firestore(`teachers/${uid}?updateMask.fieldPaths=name`, token, {
        method: "PATCH", body: JSON.stringify({ fields: { name: { stringValue: "Updated probe" } } })
    }), 200);
    // pending:false blocks access but is never picked up by the deletion worker.
    await db.doc(`accountDeletionJobs/${uid}`).create({ pending: false, releaseProbe: true });
    await expectResponse("deletion_lock_firestore", await firestore(`teachers/${uid}`, token), 403);
    await expectResponse("deletion_lock_api", await api("/api/ai/credits", token), 401);
    await db.doc(`accountDeletionJobs/${uid}`).delete();
    await auth.updateUser(uid, { disabled: true });
    await expectResponse("disabled_session_rejected", await api("/api/ai/credits", token), 401);
    await auth.updateUser(uid, { disabled: false });
    token = await signIn();
    await expectResponse("fresh_session_accepted", await api("/api/ai/credits", token), 200);
    await delay(1500); // Auth timestamps have second precision.
    await auth.revokeRefreshTokens(uid);
    await expectResponse("revoked_session_rejected", await api("/api/ai/credits", token), 401);
    await auth.deleteUser(uid);
    createdUser = false;
    await expectResponse("deleted_account_rejected", await api("/api/ai/credits", token), 401);
} catch (error) {
    // SDK errors may contain request metadata. Only known local assertion text is safe.
    console.error(JSON.stringify({ ok: false, code: String(error?.code || "smoke_failed"),
        message: error?.code || error?.response ? "Provider error; sensitive details suppressed." : error.message }));
    process.exitCode = 1;
} finally {
    let cleanupOk = true;
    try {
        if (createdContent) {
            await db.recursiveDelete(db.doc(`teachers/${uid}`));
            await db.recursiveDelete(db.doc(`teachers/${otherUid}`));
            await db.doc(`accountDeletionJobs/${uid}`).delete();
        }
        if (createdUser) await auth.deleteUser(uid);
    } catch { cleanupOk = false; process.exitCode = 1; }
    console.log(JSON.stringify({ projectId, results, cleanupOk, ...(cleanupOk ? {} : { disposableUid: uid, disposableOtherUid: otherUid }) }, null, 2));
    await db.terminate(); await deleteApp(app);
}
