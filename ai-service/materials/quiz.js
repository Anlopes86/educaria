import answers from "../../assets/js/quiz-answers.js";

export function normalizeQuizMaterial(material) {
    try {
        if (!Array.isArray(material?.questions) || !material.questions.length) throw new Error("O quiz veio sem questões.");
        const result = answers.balance(material.questions);
        return { ...material, questions: result.questions, answer_distribution: result.distribution,
            answer_distribution_skipped: result.skipped.length };
    } catch (cause) {
        throw Object.assign(new Error(cause.message), { code: "invalid_quiz_material" });
    }
}
