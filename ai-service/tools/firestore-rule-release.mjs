// Controlled release for this project's default Firestore only. No Storage/IAM changes.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { GoogleAuth } from "google-auth-library";

const root = path.resolve(import.meta.dirname, "../..");
const projectId = "educaria-f46b2";
const releaseName = `projects/${projectId}/releases/cloud.firestore`;
const [credentialPath, mode = "inspect"] = process.argv.slice(2);
if (!credentialPath || !["inspect", "deploy"].includes(mode)) throw new Error("Pass credential path and inspect or deploy.");
let credentials;
try {
    credentials = JSON.parse(await fs.readFile(credentialPath, "utf8"));
    if (credentials.type !== "service_account" || credentials.project_id !== projectId) throw new Error();
} catch { throw new Error("Invalid credential or project mismatch."); }
const client = await new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
const base = "https://firebaserules.googleapis.com/v1/";
const request = async (name, extra = {}) => (await client.request({ url: base + name, timeout: 30_000, ...extra })).data;
const canonical = (value) => value.replace(/\r\n/g, "\n").trim();
const hash = (value) => createHash("sha256").update(canonical(value)).digest("hex");
try {
    const release = await request(releaseName);
    const previous = await request(release.rulesetName);
    const files = previous.source?.files || [];
    if (files.length !== 1) throw new Error("Review required: expected exactly one Firestore rules source.");
    const local = await fs.readFile(path.join(root, "firebase/firestore.rules"), "utf8");
    const baseline = execFileSync("git", ["show", "8993cef:firebase/firestore.rules"], { cwd: root, encoding: "utf8" });
    const matchesBaseline = hash(files[0].content) === hash(baseline);
    // Reviewed live on 2026-10-01: owner-only recursive teacher tree, no role/plan
    // restrictions. Immutable ruleset ID pins that reviewed source, not any drift.
    const matchesReviewedLegacy = release.rulesetName === `projects/${projectId}/rulesets/eff135a5-57f7-46b3-91ab-7020ddcd1128`;
    const alreadyCurrent = hash(files[0].content) === hash(local);
    const backupDir = path.join(root, ".data", "security-release-backups");
    await fs.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `${release.rulesetName.split("/").at(-1)}.json`);
    await fs.writeFile(backupPath, JSON.stringify({ release, source: previous.source }, null, 2));
    console.log(JSON.stringify({ projectId, mode, previousRuleset: release.rulesetName, matchesBaseline, matchesReviewedLegacy, alreadyCurrent, backupPath }));
    if (mode === "inspect") {
        if (!matchesBaseline && !alreadyCurrent) console.log(files[0].content);
    } else if (!alreadyCurrent) {
        if (!matchesBaseline && !matchesReviewedLegacy) throw new Error("Live rules diverge from the reviewed baseline. No release changed.");
        const candidate = await request(`projects/${projectId}/rulesets`, {
            method: "POST", data: { source: { files: [{ name: "firestore.rules", content: local }] } }
        });
        // Compilation creates an immutable candidate; the active release is unchanged until PATCH.
        const stillCurrent = await request(releaseName);
        if (stillCurrent.rulesetName !== release.rulesetName) throw new Error("Live rules changed during preparation. Release not overwritten.");
        await request(releaseName, { method: "PATCH", data: { release: { name: releaseName, rulesetName: candidate.name } } });
        const verified = await request(releaseName);
        const active = await request(verified.rulesetName);
        if (verified.rulesetName !== candidate.name || hash(active.source.files[0].content) !== hash(local)) throw new Error("Release verification failed.");
        console.log(JSON.stringify({ published: true, verified: true, ruleset: candidate.name }));
    }
} catch (error) {
    console.error(JSON.stringify({ ok: false, code: String(error?.code || error?.response?.status || "release_error"),
        message: error?.response ? "Firebase request failed; credential and request details suppressed." : error.message }));
    process.exitCode = 1;
}
