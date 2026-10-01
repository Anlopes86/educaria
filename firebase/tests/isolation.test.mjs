import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc, updateDoc, setLogLevel } from "firebase/firestore";
import { ref, uploadBytes, getMetadata, deleteObject } from "firebase/storage";

// A demo-* project has no real resources. Never use production credentials here.
const projectId = "demo-educaria-security";
setLogLevel("silent"); // Expected permission-denied cases are asserted below.
let env;
const profile = { name: "Professora teste", email: "test@example.invalid", role: "teacher", plan: "free" };
before(async () => {
    if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
        throw new Error("Only run through npm test (emulators:exec). No production fallback.");
    }
    env = await initializeTestEnvironment({
        projectId,
        firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") },
        storage: { rules: await readFile(new URL("../storage.rules", import.meta.url), "utf8") }
    });
    await env.clearFirestore();
    await env.clearStorage();
});
after(async () => { await env?.cleanup(); });

test("owners can edit their own tree, but not another teacher's tree or billing/role", async () => {
    const own = env.authenticatedContext("teacher-a").firestore();
    const other = env.authenticatedContext("teacher-b").firestore();
    const guest = env.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(own, "teachers/teacher-a"), profile));
    await assertSucceeds(updateDoc(doc(own, "teachers/teacher-a"), { name: "Nome atualizado" }));
    await assertFails(updateDoc(doc(own, "teachers/teacher-a"), { plan: "pro" }));
    await assertFails(updateDoc(doc(own, "teachers/teacher-a"), { role: "admin" }));
    for (const path of ["teachers/teacher-a", "teachers/teacher-a/lessons/a", "teachers/teacher-a/classes/c", "teachers/teacher-a/classes/c/materials/m", "teachers/teacher-a/platform/config", "teachers/teacher-a/productAnalyticsEvents/e"]) {
        if (path !== "teachers/teacher-a") await assertSucceeds(setDoc(doc(own, path), { title: "Teste" }));
        await assertSucceeds(getDoc(doc(own, path)));
        for (const context of [other, guest]) {
            await assertFails(getDoc(doc(context, path)));
            await assertFails(setDoc(doc(context, path), profile));
            await assertFails(deleteDoc(doc(context, path)));
        }
    }
    for (const path of ["accountDeletionJobs/teacher-a", "aiCreditUsage/teacher-a", "unknown/a"]) {
        await assertFails(getDoc(doc(own, path)));
        await assertFails(setDoc(doc(own, path), { pending: false }));
        await assertFails(deleteDoc(doc(own, path)));
    }
});

test("deletion lock prevents existing tokens from reading, rewriting or recreating teacher data", async () => {
    const uid = "deleting-teacher";
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(setDoc(doc(db, `teachers/${uid}`), profile));
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `accountDeletionJobs/${uid}`), { pending: true });
    });
    for (const path of [`teachers/${uid}`, `teachers/${uid}/lessons/new`, `teachers/${uid}/classes/c/materials/new`]) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), profile));
        await assertFails(deleteDoc(doc(db, path)));
    }
    await env.withSecurityRulesDisabled(async (ctx) => {
        await deleteDoc(doc(ctx.firestore(), `teachers/${uid}`));
        await updateDoc(doc(ctx.firestore(), `accountDeletionJobs/${uid}`), { pending: false });
    });
    await assertFails(setDoc(doc(db, `teachers/${uid}`), profile));
});

test("legacy profiles without role/plan remain editable without enabling escalation", async () => {
    const db = env.authenticatedContext("legacy-teacher").firestore();
    const path = "teachers/legacy-teacher";
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), path), { name: "Legacy", email: "legacy@example.invalid" });
    });
    await assertSucceeds(updateDoc(doc(db, path), { name: "Updated" }));
    await assertFails(updateDoc(doc(db, path), { role: "admin" }));
    await assertFails(updateDoc(doc(db, path), { plan: "pro" }));
    await assertSucceeds(updateDoc(doc(db, path), { role: "teacher", plan: "free" }));
    await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), path), { plan: "pro" });
    });
    await assertSucceeds(updateDoc(doc(db, path), { name: "Still editable" }));
    await assertFails(setDoc(doc(db, path), { name: "Cannot erase paid plan" }));
});

test("Storage isolates teacher prefixes and honors the Firestore deletion lock", async () => {
    const uid = "storage-teacher";
    const own = env.authenticatedContext(uid).storage();
    const other = env.authenticatedContext("someone-else").storage();
    const path = `teachers/${uid}/test.txt`;
    await assertSucceeds(uploadBytes(ref(own, path), new Uint8Array([65]), { contentType: "text/plain" }));
    await assertSucceeds(getMetadata(ref(own, path)));
    await assertFails(getMetadata(ref(other, path)));
    await assertFails(deleteObject(ref(other, path)));
    await assertFails(uploadBytes(ref(own, `teachers/${uid}/script.js`), new Uint8Array([65]), { contentType: "application/javascript" }));
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), `accountDeletionJobs/${uid}`), { pending: true });
    });
    await assertFails(getMetadata(ref(own, path)));
    await assertFails(uploadBytes(ref(own, path), new Uint8Array([66]), { contentType: "text/plain" }));
    await assertFails(deleteObject(ref(own, path)));
});
