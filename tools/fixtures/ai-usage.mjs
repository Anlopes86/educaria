// Synthetic, offline-only telemetry for export tests and local UI previews.
// These records are not measurements from real teachers or real AI calls.
export const usageTestTime = Date.parse("2026-10-13T18:00:00Z");
export function usageTestSnapshot(count = 45) {
    const events = Array.from({ length: count }, (_, index) => {
        const tokens = { inputTokens: 100 + index, outputTokens: 200, thoughtTokens: 30, toolTokens: 0,
            cachedInputTokens: 20, totalTokens: 330 + index };
        const unlimited = index % 3 === 0;
        const failed = index % 7 === 0;
        return {
            id: `private-event-${index}`, uid: `private-user-${index % 3}`, plan: "free", unlimited,
            materialType: index % 2 ? "quiz" : "slides", provider: "groq", model: "openai/gpt-oss-120b",
            createdAt: new Date(usageTestTime - index * 60_000).toISOString(),
            status: failed ? "failed" : "success", durationMs: 2200 + index * 100,
            context: { requestedCount: 8, hasFile: index % 2 === 0, contentMode: "develop", detail: index % 2 ? null : "detailed", illustration: index % 2 === 0 },
            generatedCount: failed ? null : 8, creditsCharged: unlimited || failed ? 0 : 8, measuredCredits: 8,
            usage: tokens, usageCoverage: "complete", estimatedCostUsd: .00015, costCoverage: "complete",
            priceVersion: "groq-gpt-oss-120b-2026-10-13", errorCategory: failed ? "generation_failed" : null,
            attempts: [{ number: 1, durationMs: 2100 + index * 100, status: "returned", usage: { ...tokens }, estimatedCostUsd: .00015, errorCategory: null }]
        };
    });
    return { events, updatedAt: new Date(usageTestTime).toISOString(), truncated: false,
        collection: { enabled: true, store: "firestore", failedWrites: 0, pendingWrites: 0 } };
}
