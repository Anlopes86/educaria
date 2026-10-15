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
        maxItems: 4,
        required: ["title"],
        properties: {
            title: { type: "string", maxLength: 80 },
            cards: {
                type: "array",
                maxItems: 3,
                items: {
                    type: "object",
                    required: ["front"],
                    properties: {
                        front: { type: "string", maxLength: 50 },
                        back: { type: "string" }
                    }
                }
            }
        }
    });

    assert.deepEqual(schema.required, ["title", "cards"]);
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.maxItems, 4);
    assert.equal("maxLength" in schema.properties.title, false);
    assert.equal(schema.properties.cards.maxItems, 3);
    assert.equal("maxLength" in schema.properties.cards.items.properties.front, false);
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

test("empty content retains provider usage while absent usage is not fabricated as zero", async () => {
    const generate = payload => generateGroqStructuredMaterial({ apiKey: "test-key", prompt: "test", schemaConfig: { name: "test", schema: {} },
        fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200 }) });
    await assert.rejects(generate({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }), error => error.usageMetadata.totalTokenCount === 15);
    for (const usage of [undefined, {}, { prompt_tokens: "invalid" }]) {
        const result = await generate({ choices: [{ message: { content: "{}" } }], usage });
        assert.deepEqual(result.usageMetadata, {});
    }
});
