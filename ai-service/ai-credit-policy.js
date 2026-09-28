const DEFAULT_AI_CREDIT_COSTS = Object.freeze({
    wheel: 1,
    hangman: 1,
    wordsearch: 1,
    memory: 2,
    match: 2,
    flashcards: 2,
    crossword: 2,
    quiz: 3,
    mindmap: 3,
    debate: 3,
    slides: 4,
    image: 5
});

function positiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
}

export function buildAiCreditCosts(environment = process.env) {
    return Object.fromEntries(Object.entries(DEFAULT_AI_CREDIT_COSTS).map(([materialType, defaultCost]) => {
        const environmentKey = `AI_CREDIT_COST_${materialType.toUpperCase()}`;
        return [materialType, positiveInteger(environment?.[environmentKey], defaultCost)];
    }));
}

export function aiCreditCostFor(materialType, costs = DEFAULT_AI_CREDIT_COSTS) {
    const normalizedType = String(materialType || "").trim().toLowerCase();
    return positiveInteger(costs?.[normalizedType], 1);
}

export { DEFAULT_AI_CREDIT_COSTS };
