// Explicit production acceptance test. Never accepts an existing UID as input.
// All mutations are confined to fresh random fixtures; no AI requests are made.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, cert, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "educaria-f46b2";
const baseUrl = "https://educaria-api-anlopes86.onrender.com";
const root = path.resolve(import.meta.dirname, "../..");
const credentialPath = process.argv[2];
if (!credentialPath || process.argv[3] !== "--create-and-delete-disposable-probe") {
    throw new Error("Explicit disposable-deletion flag required.");
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Unexpected emulator override.");
}
let credentials;
try {
    credentials = JSON.parse(await fs.readFile(credentialPath, "utf8"));
    if (credentials.project_id !== projectId || credentials.type !== "service_account") throw new Error();
} catch { throw new Error("Invalid credential or project mismatch."); }
const publicConfig = await fs.readFile(path.join(root, "assets/js/firebase-config.js"), "utf8");
const apiKey = publicConfig.match(/apiKey:\s*"([^"]+)"/)?.[1];
if (!apiKey) throw new Error("Missing public Firebase web configuration.");
const app = initializeApp({ projectId, credential: cert(credentials) }, "educaria-deletion-smoke");
const auth = getAuth(app);
const db = getFirestore(app);
const uid = `deletion-probe-${randomUUID()}`;
const otherUid = `deletion-probe-${randomUUID()}`;
const receipt = randomBytes(32).toString("hex");
const profile = db.doc(`teachers/${uid}`);
const otherProfile = db.doc(`teachers/${otherUid}`);
const jobRef = db.doc(`accountDeletionJobs/${uid}`);
const ledger = db.doc(`aiCreditUsage/${uid}`);
const descendants = [profile.collection("classes").doc("probe"),
    profile.collection("classes").doc("probe").collection("materials").doc("nested"),
    profile.collection("classes").doc("absent-parent").collection("materials").doc("orphan")];
const results = [];
const owned = { user: false, profile: false, other: false, ledger: false, descendants: [] };
let requestAttempted = false;
let completed = false;
function assert(check, passed) {
    results.push({ check, passed: Boolean(passed) });
    if (!passed) throw Object.assign(new Error(check), { probeCheck: check });
}
async function expect(check, response, status) {
    assert(check, response.status === status);
    return response;
}
const api = (route, token, options = {}) => fetch(baseUrl + route, {
    ...options, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json", ...options.headers }, signal: AbortSignal.timeout(90_000)
});
const status = (proof = receipt) => api("/api/account/deletion-status", null, {
    method: "POST", body: JSON.stringify({ uid, receipt: proof })
});
try {
    const existing = await db.collection("accountDeletionJobs").where("pending", "==", true).limit(1).get();
    assert("no_existing_pending_jobs", existing.empty);
    await auth.createUser({ uid, displayName: "Teste descartável de exclusão" });
    owned.user = true;
    const customToken = await auth.createCustomToken(uid);
    const signedIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }), signal: AbortSignal.timeout(30_000)
    });
    assert("probe_sign_in", signedIn.ok);
    const token = (await signedIn.json()).idToken;
    assert("verified_probe_identity", token && (await auth.verifyIdToken(token, true)).uid === uid);
    await profile.create({ name: "Disposable deletion probe", role: "teacher", plan: "free" });
    owned.profile = true;
    for (const ref of descendants) { await ref.create({ releaseProbe: true }); owned.descendants.push(ref); }
    await otherProfile.create({ name: "Disposable isolation sentinel", role: "teacher", plan: "free" });
    owned.other = true;
    await ledger.create({ userId: uid, used: 7, releaseProbe: true });
    owned.ledger = true;

    await expect("authenticated_api", await api("/api/ai/credits", token), 200);
    await expect("legacy_delete_rejected", await api("/api/account", token, { method: "DELETE", body: "{}" }), 400);
    assert("legacy_delete_keeps_content", (await profile.get()).exists);
    requestAttempted = true;
    const response = await expect("deletion_accepted", await api("/api/account", token, {
        method: "DELETE", body: JSON.stringify({ version: 1, confirmation: "EXCLUIR", receipt, uid: otherUid })
    }), 202);
    assert("accepted_is_pending", (await response.json()).status === "pending");
    assert("request_scoped_to_token_owner", (await jobRef.get()).exists && !(await db.doc(`accountDeletionJobs/${otherUid}`).get()).exists);
    await expect("wrong_receipt_rejected", await status(randomBytes(32).toString("hex")), 404);
    await expect("locked_account_rejected", await api("/api/ai/credits", token), 401);
    const deniedWrite = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/teachers/${uid}?updateMask.fieldPaths=name`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { name: { stringValue: "Must be denied" } } }), signal: AbortSignal.timeout(30_000)
    });
    await expect("locked_firestore_write_rejected", deniedWrite, 403);
    const initialStatus = await expect("receipt_status_available_without_session", await status(), 200);
    assert("receipt_status_pending", ["pending", "retrying"].includes((await initialStatus.json()).status));

    // Read only this fixture's job while the actual Render worker runs each stage.
    const deadline = Date.now() + 240_000;
    let lastStage = -1;
    while (Date.now() < deadline) {
        const job = (await jobRef.get()).data();
        if (job?.stage !== lastStage) {
            console.log(JSON.stringify({ progress: "deletion_stage", stage: job?.stage, attempts: job?.attempts }));
            lastStage = job?.stage;
        }
        if (job?.pending === false && job.stage === 5) { completed = true; break; }
        await delay(20_000);
    }
    assert("worker_completed_all_stages", completed);
    const finalStatus = await expect("completed_receipt_status", await status(), 200);
    assert("completion_confirmed_by_api", (await finalStatus.json()).status === "completed");
    const content = await db.getAll(profile, ...descendants);
    assert("profile_and_nested_content_removed", content.every((doc) => !doc.exists));
    let userRemoved = false;
    try { await auth.getUser(uid); } catch (error) { if (error?.code === "auth/user-not-found") userRemoved = true; else throw error; }
    assert("auth_identity_removed", userRemoved);
    owned.user = false;
    assert("other_profile_unchanged", (await otherProfile.get()).data()?.name === "Disposable isolation sentinel");
    assert("usage_record_preserved", (await ledger.get()).data()?.used === 7);
    assert("completed_job_has_retention", Boolean((await jobRef.get()).data()?.expiresAt?.toDate));
    await expect("deleted_session_rejected", await api("/api/ai/credits", token), 401);
} catch (error) {
    // Never expose provider request metadata, tokens or receipts.
    console.error(JSON.stringify({ ok: false, check: error?.probeCheck || "provider_or_network_error" }));
    process.exitCode = 1;
} finally {
    let cleanupOk = true;
    let probeRetained = false;
    try {
        // Do not remove a pending lock or race a possibly accepted request after a timeout.
        const job = requestAttempted ? (await jobRef.get()).data() : null;
        probeRetained = requestAttempted && !completed;
        if (!probeRetained) {
            if (owned.profile) await db.recursiveDelete(profile);
            if (owned.user) await auth.deleteUser(uid);
            if (completed && job?.pending === false) await jobRef.delete();
        }
        if (owned.other) await otherProfile.delete();
        if (owned.ledger && !probeRetained) await ledger.delete();
    } catch { cleanupOk = false; process.exitCode = 1; }
    console.log(JSON.stringify({ projectId, results, cleanupOk, probeRetained,
        ...(probeRetained || !cleanupOk ? { disposableUid: uid, disposableOtherUid: otherUid } : {}) }, null, 2));
    await db.terminate(); await deleteApp(app);
}
