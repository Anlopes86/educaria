import assert from "node:assert/strict";
import test from "node:test";
import {
    DEFAULT_AI_CREDIT_COSTS,
    aiCreditCostFor,
    buildAiCreditCosts
} from "../ai-credit-policy.js";

test("uses increasingly higher costs for more complex materials", () => {
    assert.equal(aiCreditCostFor("wheel"), 1);
    assert.equal(aiCreditCostFor("quiz"), 3);
    assert.equal(aiCreditCostFor("slides"), 4);
    assert.ok(aiCreditCostFor("wheel") < aiCreditCostFor("slides"));
});

test("supports per-format environment overrides", () => {
    const costs = buildAiCreditCosts({
        AI_CREDIT_COST_WHEEL: "2",
        AI_CREDIT_COST_SLIDES: "7"
    });

    assert.equal(costs.wheel, 2);
    assert.equal(costs.slides, 7);
    assert.equal(costs.quiz, DEFAULT_AI_CREDIT_COSTS.quiz);
});

test("rejects invalid overrides and unknown types safely cost one credit", () => {
    const costs = buildAiCreditCosts({ AI_CREDIT_COST_QUIZ: "0" });
    assert.equal(costs.quiz, DEFAULT_AI_CREDIT_COSTS.quiz);
    assert.equal(aiCreditCostFor("unknown", costs), 1);
});
