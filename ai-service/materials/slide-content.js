import { normalizeSlideGenerationOptions } from "../slide-generation-policy.js";

// Only the provider contract is structured. Persisted slides still use a plain,
// fully editable body string, so old materials and presentation clients keep working.
export function slideContentSchema(rawOptions, generationOptions = {}) {
    const options = normalizeSlideGenerationOptions(rawOptions);
    const field = description => ({ type: "string", description });
    const properties = {};
    if (generationOptions.contentMode === "preserve") {
        properties.text = field("Texto fornecido, integral e no idioma original. Apenas organize; não crie exemplos, perguntas ou fatos novos.");
    } else {
        const openings = {
            balanced: "Explique a ideia central com uma definição concreta e frases completas.",
            explanatory: "Explique a ideia central ligando causa, mecanismo e consequência; não apenas nomeie o conceito.",
            visual: "Mostre a ideia com comparação, antes/depois ou sequência com →. Use relações explícitas e frases curtas, não palavras soltas.",
            inspiring: "Comece com uma pergunta instigante ou uma situação real ligada ao assunto e ao público, não com uma definição genérica nem slogan."
        };
        properties.essential = field(openings[options.tone]);
        if (options.detail === "balanced") properties.support = field(options.tone === "explanatory"
            ? "Acrescente um exemplo resolvido curto, mostrando como aplicar o conceito. Não repita essential."
            : options.tone === "visual" ? "Acrescente uma comparação ou sequência concreta em linhas curtas. Não repita essential."
            : "Acrescente uma explicação breve e um exemplo concreto pertinente, sem repetir essential.");
        if (options.detail === "detailed") {
            properties.explanation = field("Desenvolva o como e o porquê em frases completas: mecanismo, relações e consequências. Não repita essential nem entregue uma lista de palavras-chave.");
            properties.example = field("Exemplo concreto explicado: apresente a situação, aplique o conceito e interprete o resultado. Mencionar um exemplo sem explicá-lo não basta.");
        }
        if (options.tone === "inspiring") properties.challenge = field("Proponha uma pergunta ou pequeno desafio específico para a turma observar, comparar, decidir ou testar. Não repita a abertura e não dê a resposta.");
    }
    return {
        type: "object", additionalProperties: false, required: Object.keys(properties), properties,
        description: "Blocos do texto VISÍVEL, lidos na ordem dos campos. Não duplique conteúdo nem o esconda em teacher_notes. Cada campo contém só o texto, sem seu nome técnico. Capa/fechamento: campos não aplicáveis vazios. Ao apenas organizar um texto pronto, preserve-o e deixe complementos não fornecidos vazios."
    };
}

const bodyFields = ["text", "essential", "support", "explanation", "example", "challenge"];
export function normalizeSlideContent(body) {
    if (typeof body === "string" || body == null) return body;
    if (typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).some(key => !bodyFields.includes(key) || typeof body[key] !== "string")) {
        throw Object.assign(new Error("invalid_slide_content"), { code: "invalid_slide_content" });
    }
    const blocks = bodyFields.filter(key => Object.hasOwn(body, key)).map(key => body[key].trim()).filter(Boolean);
    if (!blocks.length) throw Object.assign(new Error("invalid_slide_content"), { code: "invalid_slide_content" });
    return blocks.join("\n\n");
}
