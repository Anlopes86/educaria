import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const adminRequire = createRequire(require.resolve("firebase-admin/firestore"));
const firestoreRequire = createRequire(adminRequire.resolve("@google-cloud/firestore"));
const firestoreApiRequire = createRequire(firestoreRequire.resolve("@google-cloud/firestore-api"));
// Resolve from Firestore's API client: the separate top-level gax may use another major.
const gaxRequire = createRequire(firestoreApiRequire.resolve("google-gax"));

function assertInside(parent, target) {
    assert.ok(path.isAbsolute(parent) && path.isAbsolute(target));
    const relative = path.relative(parent, target);
    assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
        "The deletion target must stay inside its temporary fixture directory");
}

test("Firebase's Firestore and nested gax construct and handle local references without network access", async (t) => {
    const { Firestore, Timestamp } = adminRequire("@google-cloud/firestore");
    const { GrpcClient, PathTemplate } = firestoreApiRequire("google-gax");
    const firestore = new Firestore({ projectId: "demo-educaria-dependency-compat" });
    t.after(() => firestore.terminate());

    // No initialize(), reads, writes or credential lookups: all operations below are local.
    const document = firestore.collection("compatibility").doc("local-only");
    assert.equal(document.path, "compatibility/local-only");
    assert.equal(document.parent.id, "compatibility");
    assert.equal(Timestamp.fromMillis(1234).toMillis(), 1234);

    const grpc = new GrpcClient({ projectId: "demo-educaria-dependency-compat" });
    assert.equal(typeof grpc.grpc.loadPackageDefinition, "function");
    const template = new PathTemplate("projects/{project}/databases/{database}");
    const resource = template.render({ project: "demo-educaria-dependency-compat", database: "(default)" });
    assert.equal(resource, "projects/demo-educaria-dependency-compat/databases/(default)");
    assert.equal(template.match(resource).database, "(default)");
});

test("the rimraf resolved by nested gax preserves async and sync directory removal", async (t) => {
    const { rimraf, rimrafSync } = gaxRequire("rimraf");
    const temporaryParent = path.resolve(os.tmpdir());
    const fixtureRoot = await mkdtemp(path.join(temporaryParent, "educaria-rimraf-compat-"));
    const verifyFixtureRoot = () => {
        assertInside(temporaryParent, fixtureRoot);
        assert.ok(path.basename(fixtureRoot).startsWith("educaria-rimraf-compat-"));
    };
    verifyFixtureRoot();
    t.after(async () => {
        verifyFixtureRoot();
        await rm(fixtureRoot, { recursive: true, force: true });
    });

    const sentinel = path.join(fixtureRoot, "keep.txt");
    await writeFile(sentinel, "preserved");
    for (const mode of ["async", "sync"]) {
        const target = path.join(fixtureRoot, `${mode} [literal]`);
        assertInside(fixtureRoot, target);
        await mkdir(path.join(target, "nested"), { recursive: true });
        await writeFile(path.join(target, "nested", "fixture.txt"), "temporary");
        assertInside(fixtureRoot, target);
        const result = mode === "async" ? await rimraf(target) : rimrafSync(target);
        assert.equal(result, true);
        await assert.rejects(stat(target), { code: "ENOENT" });
        assert.equal(await readFile(sentinel, "utf8"), "preserved");
    }
});
