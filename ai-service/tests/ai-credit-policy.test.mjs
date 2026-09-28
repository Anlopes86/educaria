import assert from "node:assert/strict";
import test from "node:test";
import {
    aiCreditsForUsage,
    buildAiCreditUsagePolicy,
    estimateAiCreditReservation,
    mergeAiUsageMetadata,
    normalizeAiUsageMetadata
} from "../ai-credit-policy.js";

test("charges from measured input, output and reasoning usage", () => {
    const policy = buildAiCreditUsagePolicy({
        AI_CREDIT_TOKENS_PER_CREDIT: "100",
        AI_CREDIT_INPUT_WEIGHT: "1",
        AI_CREDIT_OUTPUT_WEIGHT: "3",
        AI_CREDIT_THOUGHT_WEIGHT: "3"
    });
    const result = aiCreditsForUsage({
        promptTokenCount: 500,
        candidatesTokenCount: 200,
        thoughtsTokenCount: 100,
        totalTokenCount: 800
    }, policy);

    assert.equal(result.weightedTokens, 1400);
    assert.equal(result.credits, 14);
});

test("normalizes and accumulates provider usage across retries", () => {
    const merged = mergeAiUsageMetadata(
        { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
        { promptTokenCount: 120, candidatesTokenCount: 60, thoughtsTokenCount: 20, totalTokenCount: 200 }
    );
    assert.deepEqual(normalizeAiUsageMetadata(merged), {
        inputTokens: 220,
        outputTokens: 110,
        thoughtTokens: 20,
        toolTokens: 0,
        cachedInputTokens: 0,
        totalTokens: 350
    });
});

test("estimates a reservation from content size without using activity type", () => {
    const policy = buildAiCreditUsagePolicy({});
    const shortEstimate = estimateAiCreditReservation("tema curto", "", policy);
    const longEstimate = estimateAiCreditReservation("conteúdo ".repeat(3000), "", policy);
    assert.ok(shortEstimate > 0);
    assert.ok(longEstimate > shortEstimate);
});
