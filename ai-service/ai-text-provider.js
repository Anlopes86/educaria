const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

function positiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function groqResponseContent(message) {
    if (typeof message?.content === "string") return message.content;
    if (!Array.isArray(message?.content)) return "";
    return message.content
        .map((part) => typeof part === "string" ? part : part?.text || "")
        .join("");
}

export function groqStrictJsonSchema(schema) {
    if (Array.isArray(schema)) {
        return schema.map((item) => groqStrictJsonSchema(item));
    }
    if (!schema || typeof schema !== "object") {
        return schema;
    }

    const normalized = Object.fromEntries(
        Object.entries(schema).map(([key, value]) => [key, groqStrictJsonSchema(value)])
    );
    if (normalized.type === "object" && normalized.properties && typeof normalized.properties === "object") {
        normalized.required = Object.keys(normalized.properties);
        normalized.additionalProperties = false;
    }
    return normalized;
}

export function groqUsageMetadata(usage = {}) {
    const promptTokens = positiveInteger(usage.prompt_tokens, 0);
    const completionTokens = positiveInteger(usage.completion_tokens, 0);
    const reasoningTokens = positiveInteger(
        usage.completion_tokens_details?.reasoning_tokens
        ?? usage.output_tokens_details?.reasoning_tokens,
        0
    );
    const visibleOutputTokens = Math.max(0, completionTokens - reasoningTokens);
    const totalTokens = positiveInteger(usage.total_tokens, promptTokens + completionTokens);
    return {
        promptTokenCount: promptTokens,
        candidatesTokenCount: visibleOutputTokens,
        thoughtsTokenCount: reasoningTokens,
        cachedContentTokenCount: positiveInteger(
            usage.prompt_tokens_details?.cached_tokens
            ?? usage.input_tokens_details?.cached_tokens,
            0
        ),
        totalTokenCount: totalTokens
    };
}

export async function generateGroqStructuredMaterial({
    apiKey,
    model = "openai/gpt-oss-120b",
    prompt,
    schemaConfig,
    reasoningEffort = "low",
    maxCompletionTokens = 3_500,
    timeoutMs = 90_000,
    fetchImpl = fetch
}) {
    if (!apiKey) {
        const error = new Error("GROQ_API_KEY não configurada no backend.");
        error.code = "groq_api_key_missing";
        error.status = 503;
        throw error;
    }

    const body = {
        model,
        messages: [
            {
                role: "system",
                content: [
                    "Você é um assistente pedagógico da EducarIA.",
                    "Responda em português do Brasil e siga rigorosamente o schema JSON fornecido.",
                    "Preencha todos os campos. Quando um campo não se aplicar, use string vazia ou array vazio.",
                    "Não inclua markdown nem texto fora do JSON estruturado."
                ].join(" ")
            },
            { role: "user", content: String(prompt || "") }
        ],
        response_format: {
            type: "json_schema",
            json_schema: {
                name: schemaConfig.name,
                description: schemaConfig.description,
                strict: true,
                schema: groqStrictJsonSchema(schemaConfig.schema)
            }
        },
        reasoning_effort: reasoningEffort,
        max_completion_tokens: positiveInteger(maxCompletionTokens, 3_500),
        temperature: 0.2
    };

    let response;
    try {
        response = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(positiveInteger(timeoutMs, 90_000))
        });
    } catch (cause) {
        const error = new Error(`Falha de conexão com o Groq: ${cause instanceof Error ? cause.message : cause}`);
        error.code = "groq_connection_failed";
        error.status = 503;
        error.cause = cause;
        throw error;
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(
            payload?.error?.message
            || payload?.message
            || `O Groq retornou o status ${response.status}.`
        );
        error.code = payload?.error?.code || payload?.code || "groq_request_failed";
        error.status = response.status;
        error.retryAfter = response.headers.get("retry-after") || "";
        throw error;
    }

    const text = groqResponseContent(payload?.choices?.[0]?.message);
    if (!text) {
        const error = new Error("O Groq não retornou conteúdo estruturado.");
        error.code = "groq_empty_response";
        error.status = 502;
        throw error;
    }

    return {
        text,
        usageMetadata: groqUsageMetadata(payload?.usage || {}),
        providerRequestId: payload?.x_groq?.id || payload?.id || ""
    };
}

