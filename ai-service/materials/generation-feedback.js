// Feedback travels alongside the activity, never inside editable lesson content.
// It uses the same provider response and its tokens are included in normal usage.
export function withGenerationFeedback(config) {
    return { ...config, schema: { ...config.schema,
        properties: { ...config.schema.properties, assistant_message: { type: "string", maxLength: 600,
            description: generationFeedbackInstruction } } } };
}

export const generationFeedbackInstruction = "Retorno ao professor, em português, até 600 caracteres: descreva somente o que consta no JSON e eventuais limitações. Ajustes são SUGESTÕES pendentes de aprovação. Não afirme salvamento, aplicação, publicação ou precisão garantida. Sem HTML, markdown, gabaritos ou respostas de jogos.";

export function extractGenerationFeedback(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { material: raw, message: "" };
    const { assistant_message, ...material } = raw;
    const message = typeof assistant_message === "string"
        ? assistant_message.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 600) : "";
    return { material, message };
}

export function generationFeedback(type, material, { message = "", refinement, illustrationRequest } = {}) {
    let summary = "";
    if (refinement) {
        const numbers = refinement.items.map(entry => Number(entry.id.slice(5))).join(", ");
        summary = `Sugestões para ${type === "quiz" ? "as questões" : "os itens"} ${numbers}. Os demais itens não foram alterados.`;
    } else if (illustrationRequest) summary = "Ilustração preparada para o slide selecionado.";
    else {
        const definitions = { slides: ["slides", "slide", "slides"], quiz: ["questions", "questão", "questões"],
            flashcards: ["cards", "flashcard", "flashcards"], memory: ["pairs", "par", "pares"], match: ["pairs", "par", "pares"],
            wheel: ["segments", "espaço", "espaços"], mindmap: ["branches", "tópico", "tópicos"], debate: ["steps", "etapa", "etapas"],
            hangman: ["entries", "palavra", "palavras"], wordsearch: ["words", "palavra", "palavras"],
            crossword: ["entries", "palavra", "palavras"], wordtrail: ["words", "palavra", "palavras"],
            connections: ["rounds", "desafio", "desafios"], worksheet: ["activities", "atividade", "atividades"] };
        const [key, singular, plural] = definitions[type] || [];
        const count = Array.isArray(material?.[key]) ? material[key].length
            : type === "worksheet" && material?.activities && typeof material.activities === "object" ? Object.keys(material.activities).length : 0;
        summary = count ? `Material pronto com ${count} ${count === 1 ? singular : plural}.` : "Material preparado para revisão.";
        if (type === "quiz" && material.answer_distribution) {
            summary += " Gabarito vinculado às alternativas após a distribuição das respostas.";
            if (material.answer_distribution_skipped) summary += " Questões que citam a posição das alternativas mantiveram a ordem original.";
        }
    }
    return { message, summary };
}
