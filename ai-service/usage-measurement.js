export function hasMeasuredTokenUsage(value) {
    if (value?.totalTokenCount === 0 && ["promptTokenCount", "candidatesTokenCount", "thoughtsTokenCount", "toolUsePromptTokenCount"]
        .every(key => value[key] == null || value[key] === 0)) return true;
    // Input and output must both be reported. Missing counters are not zero.
    return !!value && ["promptTokenCount", "candidatesTokenCount"].every(key =>
        typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0);
}
export function usageUnavailableReason(value) {
    return ["provider_schema_recovery", "provider_not_reported", "provider_incomplete_usage"].includes(value) ? value : null;
}
