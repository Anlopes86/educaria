(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.EducariaQuizAnswers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";
    const letters = ["A", "B", "C", "D"];
    const text = value => String(value ?? "").trim();
    const key = value => text(value).replace(/\s+/g, " ").toLocaleLowerCase();

    // Match the answer's text first: an option can itself be the letter "B".
    function answerIndex(options, answer) {
        const matches = options.map((option, index) => key(option) === key(answer) ? index : -1).filter(index => index >= 0);
        if (matches.length === 1) return matches[0];
        if (matches.length > 1) return -1;
        const letter = text(answer).match(/^(?:(?:alternativa|opção|opcao|letra|option|answer)\s*:?\s*)?([A-D])\s*[.)]?$/i)?.[1]?.toUpperCase();
        const index = letters.indexOf(letter);
        return index >= 0 && index < options.length ? index : -1;
    }

    function normalizeQuestion(question) {
        if (question.type === "short_answer") return { ...question };
        if (question.type === "true_false") {
            const answer = key(question.correct_answer);
            let index = ["true", "verdadeiro"].includes(answer) ? 0 : ["false", "falso"].includes(answer) ? 1 : -1;
            if (index < 0) {
                const options = Array.isArray(question.options) && question.options.length === 2 ? question.options : ["Verdadeiro", "Falso"];
                const found = answerIndex(options, question.correct_answer);
                const value = found >= 0 ? key(options[found]) : "";
                index = ["true", "verdadeiro"].includes(value) ? 0 : ["false", "falso"].includes(value) ? 1 : -1;
            }
            if (index < 0) throw new Error("Uma questão de verdadeiro ou falso veio sem gabarito válido.");
            return { ...question, options: ["Verdadeiro", "Falso"], correct_answer: index === 0 ? "Verdadeiro" : "Falso" };
        }
        const options = Array.isArray(question.options) ? question.options.map(text) : [];
        const index = answerIndex(options, question.correct_answer);
        if (options.length !== 4 || options.some(option => !option) || new Set(options.map(key)).size !== 4 || index < 0) {
            throw new Error("Uma questão veio com alternativas ou gabarito incompletos. Peça à IA para refazer essa questão.");
        }
        return { ...question, type: "multiple_choice", options, correct_answer: options[index] };
    }

    function dependsOnPosition(question) {
        const content = [question.prompt, question.explanation, ...question.options].join("\n");
        return /\b(?:alternativas?|opções|opção|letras?|options?|letters?)\s+["'(\[]?[A-D]\b/iu.test(content)
            || /\b[A-D]\s+(?:e|ou|and|or)\s+[A-D]\b/u.test(content)
            || /\b(?:todas?|nenhuma|ambas|all|none|both)\b[^.\n]{0,45}\b(?:acima|abaixo|anteriores|above|below)\b/iu.test(content)
            || /\b(?:primeira|segunda|terceira|quarta|última|first|second|third|fourth|last)\s+(?:alternativa|opção|option|answer)\b/iu.test(content);
    }

    // Change positions, never the answer's meaning. Position-dependent questions
    // stay untouched so "all of the above" and letter references remain valid.
    function balance(questions, { fixedAnswers = [], random = Math.random } = {}) {
        const normalized = questions.map(normalizeQuestion);
        const counts = letters.map(letter => fixedAnswers.filter(value => value === letter).length);
        const skipped = [];
        normalized.forEach((question, index) => {
            if (question.type !== "multiple_choice") return;
            if (dependsOnPosition(question)) {
                skipped.push(index);
                counts[answerIndex(question.options, question.correct_answer)] += 1;
            }
        });
        let changed = 0;
        const result = normalized.map((question, index) => {
            if (question.type !== "multiple_choice" || skipped.includes(index)) return question;
            const before = answerIndex(question.options, question.correct_answer);
            const minimum = Math.min(...counts);
            let candidates = letters.map((_, i) => i).filter(i => counts[i] === minimum);
            // Prefer a different position when it still keeps the distribution balanced.
            if (candidates.length > 1) candidates = candidates.filter(i => i !== before);
            const target = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
            counts[target] += 1;
            if (before === target) return question;
            const options = [...question.options];
            [options[before], options[target]] = [options[target], options[before]];
            changed += 1;
            return { ...question, options };
        });
        return { questions: result, changed, skipped, distribution: Object.fromEntries(letters.map((letter, index) => [letter, counts[index]])) };
    }

    function fromEditor(item) {
        return { type: item.kind, prompt: item.prompt, explanation: item.explanation,
            options: item.kind === "true_false" ? ["Verdadeiro", "Falso"] : letters.map(letter => item[`option${letter}`]),
            // Here correct is explicitly a position, not answer text.
            correct_answer: item.kind === "true_false" ? (item.correct === "B" ? "Falso" : "Verdadeiro") : item[`option${item.correct}`] };
    }
    function balanceItems(items, options) {
        const balanced = balance(items.map(fromEditor), options);
        return { ...balanced, items: balanced.questions.map((question, index) => question.type !== "multiple_choice" ? { ...items[index] }
            : { ...items[index], ...Object.fromEntries(letters.map((letter, i) => [`option${letter}`, question.options[i]])),
                correct: letters[answerIndex(question.options, question.correct_answer)] }) };
    }
    return Object.freeze({ answerIndex, normalizeQuestion, dependsOnPosition, balance, balanceItems });
});
