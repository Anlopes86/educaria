import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUsageExport } from "../ai-usage-export.js";
import { buildUsageReport, parseUsageQuery } from "../ai-usage-analytics.js";
import { usageTestSnapshot, usageTestTime } from "../../tools/fixtures/ai-usage.mjs";
const run = (snapshot, query = {}) => buildUsageExport(snapshot, parseUsageQuery(query), usageTestTime);

test("export includes every matching page in one consistent report", () => {
    const snapshot = usageTestSnapshot(65), filters = parseUsageQuery({ page: "2" });
    const screen = buildUsageReport(snapshot, filters, [], usageTestTime);
    const result = run(snapshot, { page: "2" });
    assert.equal(screen.events.length, 20); assert.equal(result.events.length, 65);
    assert.deepEqual(result.summary, screen.summary); assert.deepEqual(result.byMaterial, screen.byMaterial);
    assert.equal(result.completeness.allMatchingPagesIncluded, true);
    assert.equal(result.completeness.exportedRecords, 65); assert.equal(result.version, 1);
    assert.equal(new Set(result.events.map(event => event.number)).size, 65);
    assert.equal(result.byAccount.length, 3);
    assert.equal(result.byCohort.reduce((sum, row) => sum + row.generations, 0), 65);
});
test("export shares all filters with the screen without leaking the selected UID", () => {
    const snapshot = usageTestSnapshot(45);
    snapshot.events.push({ ...snapshot.events[0], createdAt: "2026-09-01T00:00:00Z" });
    snapshot.events.push({ ...snapshot.events[0], createdAt: "2026-11-01T00:00:00Z" });
    for (const query of [{ days:"1" }, { days:"30", materialType:"quiz", status:"success", cohort:"limited" },
        { uid:"private-user-0", cohort:"unlimited" }, { status:"failed" }, { materialType:"memory" }]) {
        const result = run(snapshot, query), screen = buildUsageReport(snapshot, parseUsageQuery(query), [], usageTestTime);
        assert.deepEqual(result.summary, screen.summary);
        assert.equal(result.events.length, screen.pagination.totalMatches);
        assert.doesNotMatch(JSON.stringify(result), /private-user/);
    }
    assert.equal(run(snapshot, { uid:"private-user-0" }).filters.account, "single");
});
test("privacy projection strips direct identifiers and future private fields at every level", () => {
    const snapshot = usageTestSnapshot(3), before = structuredClone(snapshot);
    const privateFields = { name:"DO_NOT_EXPORT", email:"DO_NOT_EXPORT", school:"DO_NOT_EXPORT", uid:"DO_NOT_EXPORT", id:"DO_NOT_EXPORT", prompt:"DO_NOT_EXPORT", filename:"DO_NOT_EXPORT", sourceText:"DO_NOT_EXPORT", user:{name:"DO_NOT_EXPORT"}, accessToken:"DO_NOT_EXPORT" };
    const row = snapshot.events[0];
    Object.assign(row, privateFields);
    Object.assign(row.context, privateFields); Object.assign(row.usage, privateFields);
    Object.assign(row.attempts[0], privateFields); Object.assign(row.attempts[0].usage, privateFields);
    Object.assign(snapshot.collection, privateFields);
    const result = run(snapshot, { uid:"DO_NOT_EXPORT" });
    assert.equal(result.events.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_EXPORT|private-user-|private-event-/);
    assert.equal(result.events[0].account, "Professor 001");
    const unmodified = usageTestSnapshot(3); run(unmodified); assert.deepEqual(unmodified, before);
});
test("exports distinguish targeted edits without exposing their instructions", () => {
    const snapshot = usageTestSnapshot(2);
    snapshot.events[0].context.operation = "refine-item";
    snapshot.events[0].context.instruction = "PRIVATE_REQUEST";
    snapshot.events[1].context.operation = "PRIVATE_OPERATION";
    const result = run(snapshot);
    assert.equal(result.events[0].context.operation, "refine-item");
    assert.equal(result.events[1].context.operation, undefined);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_REQUEST|PRIVATE_OPERATION/);
});

test("unlinked events remain unlinked and account labels are consistent only within the export", () => {
    const snapshot = usageTestSnapshot(6); snapshot.events[0].uid = null;
    const result = run(snapshot);
    assert.equal(result.events[0].account, null);
    assert.equal(result.events[1].account, result.events[4].account);
    assert.equal(result.privacy.accountLabelsScope, "this-export");
    assert.equal(result.byAccount.find(row => row.id === null).generations, 1);
});
test("unknown measurements remain null and generate explicit completeness warnings", () => {
    const snapshot = usageTestSnapshot(2);
    Object.assign(snapshot.events[0], { usage:null, usageCoverage:"unknown", creditsCharged:null, measuredCredits:null,
        estimatedCostUsd:null, costCoverage:"unknown", attempts:[{status:"failed", usage:null, estimatedCostUsd:null, durationMs:50, errorCategory:"timeout"}] });
    snapshot.collection.failedWrites = 2; snapshot.collection.pendingWrites = 1;
    const result = run(snapshot);
    assert.equal(result.events[0].usage, null); assert.equal(result.events[0].creditsCharged, null);
    assert.equal(result.summary.averageTokens, 331); assert.equal(result.summary.knownTokens, 331);
    for (const code of ["incomplete_measurements", "incomplete_costs", "unknown_charges", "unconfirmed_writes", "pending_writes"]) {
        assert.ok(result.warnings.some(warning => warning.code === code), code);
    }
});
test("source cap applies before filters and truncated history is never called complete", () => {
    const snapshot = usageTestSnapshot(5001);
    const result = run(snapshot, { days:"30" });
    assert.equal(result.events.length, 5000); assert.equal(result.completeness.truncated, true);
    assert.ok(result.warnings.some(warning => warning.code === "history_truncated"));
    const limited = usageTestSnapshot(1); limited.truncated = true;
    assert.equal(run(limited).completeness.truncated, true);
});
test("empty, disabled and temporary sources keep honest export metadata", () => {
    const snapshot = usageTestSnapshot(0); snapshot.collection.enabled = false;
    const result = run(snapshot);
    assert.equal(result.summary.generations, 0); assert.equal(result.summary.averageTokens, null);
    assert.equal(result.summary.estimatedCostUsd, null);
    assert.ok(result.warnings.some(warning => warning.code === "collection_disabled"));
    assert.ok(result.warnings.some(warning => warning.code === "no_matches"));
    snapshot.collection.enabled = true; snapshot.collection.store = "memory";
    assert.ok(run(snapshot).warnings.some(warning => warning.code === "temporary_storage"));
});
