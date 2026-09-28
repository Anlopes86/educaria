const DEFAULT_AI_CREDIT_USAGE_POLICY = Object.freeze({
    tokensPerCredit: 100,
    inputWeight: 1,
    outputWeight: 3,
    thoughtWeight: 3,
    minimumCharge: 1,
    promptOverheadTokens: 600,
    estimatedOutputTokens: 1200,
    imageOutputCredits: 100
});

function positiveNumber(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function nonNegativeInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

export function buildAiCreditUsagePolicy(environment = process.env) {
    return {
        mode: "usage",
        tokensPerCredit: positiveNumber(environment?.AI_CREDIT_TOKENS_PER_CREDIT, DEFAULT_AI_CREDIT_USAGE_POLICY.tokensPerCredit),
        inputWeight: positiveNumber(environment?.AI_CREDIT_INPUT_WEIGHT, DEFAULT_AI_CREDIT_USAGE_POLICY.inputWeight),
        outputWeight: positiveNumber(environment?.AI_CREDIT_OUTPUT_WEIGHT, DEFAULT_AI_CREDIT_USAGE_POLICY.outputWeight),
        thoughtWeight: positiveNumber(environment?.AI_CREDIT_THOUGHT_WEIGHT, DEFAULT_AI_CREDIT_USAGE_POLICY.thoughtWeight),
        minimumCharge: Math.max(1, Math.floor(positiveNumber(environment?.AI_CREDIT_MINIMUM_CHARGE, DEFAULT_AI_CREDIT_USAGE_POLICY.minimumCharge))),
        promptOverheadTokens: Math.floor(positiveNumber(environment?.AI_CREDIT_PROMPT_OVERHEAD_TOKENS, DEFAULT_AI_CREDIT_USAGE_POLICY.promptOverheadTokens)),
        estimatedOutputTokens: Math.floor(positiveNumber(environment?.AI_CREDIT_ESTIMATED_OUTPUT_TOKENS, DEFAULT_AI_CREDIT_USAGE_POLICY.estimatedOutputTokens)),
        imageOutputCredits: Math.floor(positiveNumber(environment?.AI_CREDIT_IMAGE_OUTPUT_CREDITS, DEFAULT_AI_CREDIT_USAGE_POLICY.imageOutputCredits))
    };
}

export function normalizeAiUsageMetadata(metadata = {}) {
    const inputTokens = nonNegativeInteger(metadata.promptTokenCount);
    const outputTokens = nonNegativeInteger(metadata.candidatesTokenCount);
    const thoughtTokens = nonNegativeInteger(metadata.thoughtsTokenCount);
    const toolTokens = nonNegativeInteger(metadata.toolUsePromptTokenCount);
    const cachedInputTokens = nonNegativeInteger(metadata.cachedContentTokenCount);
    const reportedTotalTokens = nonNegativeInteger(metadata.totalTokenCount);
    const measuredTotalTokens = inputTokens + outputTokens + thoughtTokens + toolTokens;

    return {
        inputTokens,
        outputTokens,
        thoughtTokens,
        toolTokens,
        cachedInputTokens,
        totalTokens: Math.max(reportedTotalTokens, measuredTotalTokens)
    };
}

export function mergeAiUsageMetadata(first = {}, second = {}) {
    const left = normalizeAiUsageMetadata(first);
    const right = normalizeAiUsageMetadata(second);
    return {
        promptTokenCount: left.inputTokens + right.inputTokens,
        candidatesTokenCount: left.outputTokens + right.outputTokens,
        thoughtsTokenCount: left.thoughtTokens + right.thoughtTokens,
        toolUsePromptTokenCount: left.toolTokens + right.toolTokens,
        cachedContentTokenCount: left.cachedInputTokens + right.cachedInputTokens,
        totalTokenCount: left.totalTokens + right.totalTokens
    };
}

export function aiCreditsForUsage(metadata, policy = DEFAULT_AI_CREDIT_USAGE_POLICY, options = {}) {
    const usage = normalizeAiUsageMetadata(metadata);
    const classifiedTokens = usage.inputTokens + usage.outputTokens + usage.thoughtTokens + usage.toolTokens;
    const unclassifiedTokens = Math.max(0, usage.totalTokens - classifiedTokens);
    const weightedTokens = Math.ceil(
        (usage.inputTokens + usage.toolTokens + unclassifiedTokens) * policy.inputWeight
        + usage.outputTokens * policy.outputWeight
        + usage.thoughtTokens * policy.thoughtWeight
    );
    const tokenCredits = Math.max(policy.minimumCharge, Math.ceil(weightedTokens / policy.tokensPerCredit));
    const additionalCredits = Math.max(0, Math.floor(Number(options.additionalCredits) || 0));

    return {
        credits: tokenCredits + additionalCredits,
        weightedTokens,
        usage
    };
}

export function estimateAiCreditReservation(sourceText, action, policy = DEFAULT_AI_CREDIT_USAGE_POLICY) {
    const estimatedInputTokens = Math.ceil((String(sourceText || "").length + String(action || "").length) / 4)
        + policy.promptOverheadTokens;
    return aiCreditsForUsage({
        promptTokenCount: estimatedInputTokens,
        candidatesTokenCount: policy.estimatedOutputTokens,
        totalTokenCount: estimatedInputTokens + policy.estimatedOutputTokens
    }, policy).credits;
}

export { DEFAULT_AI_CREDIT_USAGE_POLICY };
