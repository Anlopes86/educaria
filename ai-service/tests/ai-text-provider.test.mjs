import assert from "node:assert/strict";
import { test } from "node:test";
import {
    generateGroqStructuredMaterial,
    groqStrictJsonSchema,
    groqUsageMetadata
} from "../ai-text-provider.js";

test("makes every object field required for Groq strict structured outputs", () => {
    const schema = groqStrictJsonSchema({
        type: "object",
        required: ["title"],
        properties: {
            title: { type: "string" },
            cards: {
                type: "array",
                items: {
                    type: "object",
                    required: ["front"],
                    properties: {
                        front: { type: "string" },
                        back: { type: "string" }
                    }
                }
            }
        }
    });

    assert.deepEqual(schema.required, ["title", "cards"]);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.cards.items.required, ["front", "back"]);
    assert.equal(schema.properties.cards.items.additionalProperties, false);
});

test("normalizes Groq token usage for the existing credit policy", () => {
    assert.deepEqual(groqUsageMetadata({
        prompt_tokens: 300,
        completion_tokens: 900,
        total_tokens: 1200,
        completion_tokens_details: { reasoning_tokens: 250 }
    }), {
        promptTokenCount: 300,
        candidatesTokenCount: 650,
        thoughtsTokenCount: 250,
        cachedContentTokenCount: 0,
        totalTokenCount: 1200
    });
});

test("sends a strict JSON schema request to Groq", async () => {
    let requestBody;
    const result = await generateGroqStructuredMaterial({
        apiKey: "test-key",
        prompt: "Crie cartões sobre fotossíntese.",
        schemaConfig: {
            name: "educaria_flashcards",
            description: "Flashcards",
            schema: {
                type: "object",
                properties: { title: { type: "string" } },
                required: ["title"],
                additionalProperties: false
            }
        },
        fetchImpl: async (_url, options) => {
            requestBody = JSON.parse(options.body);
            return new Response(JSON.stringify({
                id: "chat-1",
                choices: [{ message: { content: "{\"title\":\"Fotossíntese\"}" } }],
                usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        }
    });

    assert.equal(requestBody.model, "openai/gpt-oss-120b");
    assert.equal(requestBody.response_format.json_schema.strict, true);
    assert.equal(requestBody.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(result.text, "{\"title\":\"Fotossíntese\"}");
    assert.equal(result.usageMetadata.totalTokenCount, 30);
});

test("preserves Groq rate-limit errors for the API layer", async () => {
    await assert.rejects(
        generateGroqStructuredMaterial({
            apiKey: "test-key",
            prompt: "teste",
            schemaConfig: {
                name: "educaria_test",
                description: "Teste",
                schema: {
                    type: "object",
                    properties: { title: { type: "string" } },
                    required: ["title"],
                    additionalProperties: false
                }
            },
            fetchImpl: async () => new Response(JSON.stringify({
                error: { message: "Rate limit reached", code: "rate_limit_exceeded" }
            }), {
                status: 429,
                headers: { "Content-Type": "application/json", "retry-after": "12" }
            })
        }),
        (error) => error.status === 429
            && error.code === "rate_limit_exceeded"
            && error.retryAfter === "12"
    );
});
