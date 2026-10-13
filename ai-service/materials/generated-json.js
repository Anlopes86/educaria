function extractJsonCandidate(text) {
    const raw = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!raw) return "";

    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return raw.slice(firstBrace, lastBrace + 1).trim();
    }

    return raw;
}

function normalizeLooseJson(text) {
    return String(text || "")
        .replace(/\u00A0/g, " ")
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, "$1")
        .trim();
}

/**
 * Parses JSON from a the text provider model response, handling common output artifacts.
 * First tries to extract a fenced code block or brace-bounded substring, then
 * normalises smart quotes and trailing commas before a second parse attempt.
 * @param {string} text - Raw text response from the text provider
 * @returns {object} Parsed JSON object
 * @throws {Error} If the text cannot be parsed after normalisation
 */
export function parseGeneratedJson(text) {
    const candidate = extractJsonCandidate(text);
    if (!candidate) {
        throw new Error("empty_model_response");
    }

    try {
        return JSON.parse(candidate);
    } catch (firstError) {
        const normalized = normalizeLooseJson(candidate);
        if (normalized && normalized !== candidate) {
            try {
                return JSON.parse(normalized);
            } catch (_secondError) {
                // Fall through to the original parsing error below.
            }
        }

        throw new Error(`invalid_json_response: ${firstError instanceof Error ? firstError.message : "parse_failed"}`);
    }
}
