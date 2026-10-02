// Read-only production preflight. Never prints credential, access-token or user data.
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { GoogleAuth } from "google-auth-library";
import { initializeApp, cert, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const projectId = "educaria-f46b2";
const bucketName = "educaria-f46b2.firebasestorage.app";
const credentialPath = process.argv[2];
if (!credentialPath) throw new Error("Pass the service-account file path; never its contents.");
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    throw new Error("Preflight requires the real project, not emulator overrides.");
}
let credentials;
try {
    credentials = JSON.parse(await fs.readFile(credentialPath, "utf8"));
    if (credentials.type !== "service_account" || credentials.project_id !== projectId) throw new Error();
} catch { throw new Error("Credential missing, invalid or for a different project."); }
const app = initializeApp({ projectId, credential: cert(credentials), storageBucket: bucketName }, "educaria-preflight");
const db = getFirestore(app);
const api = await new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
const probeUid = `security-preflight-${randomUUID()}`;
const report = { projectId, bucketName, mutation: false };
async function check(name, operation) {
    try { report[name] = await operation(); }
    catch (error) {
        report[name] = { ok: false, code: String(error?.code || error?.response?.status || "unavailable").slice(0, 80) };
    }
}
try {
    await Promise.all([
        check("authLookup", async () => {
            try { await getAuth(app).getUser(probeUid); }
            catch (error) { if (error.code !== "auth/user-not-found") throw error; }
            return { ok: true };
        }),
        check("firestoreLookup", async () => { await db.doc(`accountDeletionJobs/${probeUid}`).get(); return { ok: true }; }),
        check("pendingDeletions", async () => {
            const snapshot = await db.collection("accountDeletionJobs").where("pending", "==", true).count().get();
            return { ok: true, count: snapshot.data().count };
        }),
        check("teacherSchema", async () => {
            const snapshot = await db.collection("teachers").select("role", "plan").limit(1000).get();
            return { ok: true, checked: snapshot.size, limitReached: snapshot.size === 1000,
                missingRole: snapshot.docs.filter((doc) => !doc.data().role).length,
                missingPlan: snapshot.docs.filter((doc) => !doc.data().plan).length };
        }),
        check("storageBucket", async () => {
            const [metadata] = await getStorage(app).bucket().getMetadata();
            return { ok: true, name: metadata.name, projectNumber: metadata.projectNumber, softDelete: Boolean(metadata.softDeletePolicy) };
        }),
        check("rulesReleases", async () => {
            const response = await api.request({ url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, timeout: 30_000 });
            return { ok: true, releases: (response.data.releases || []).map(({ name, rulesetName }) => ({ name, rulesetName })) };
        }),
        check("permissions", async () => {
            const permissions = [
                "firebaseauth.users.get", "firebaseauth.users.create", "firebaseauth.users.update", "firebaseauth.users.delete",
                "datastore.entities.get", "datastore.entities.list", "datastore.entities.create", "datastore.entities.update", "datastore.entities.delete",
                "firebaserules.rulesets.get", "firebaserules.rulesets.create", "firebaserules.releases.get", "firebaserules.releases.update",
                "resourcemanager.projects.getIamPolicy", "resourcemanager.projects.setIamPolicy"
            ];
            const response = await api.request({
                url: `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:testIamPermissions`,
                method: "POST", data: { permissions }, timeout: 30_000
            });
            return { ok: true, granted: response.data.permissions || [], missing: permissions.filter((item) => !(response.data.permissions || []).includes(item)) };
        }),
        check("storagePermissions", async () => {
            const response = await api.request({
                url: `https://storage.googleapis.com/storage/v1/b/${bucketName}/iam/testPermissions`,
                params: new URLSearchParams([["permissions", "storage.objects.list"], ["permissions", "storage.objects.get"], ["permissions", "storage.objects.delete"]]), timeout: 30_000
            });
            return { ok: true, granted: response.data.permissions || [] };
        })
    ]);
    console.log(JSON.stringify(report, null, 2));
} finally { await db.terminate(); await deleteApp(app); }
