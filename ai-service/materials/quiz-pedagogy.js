// Content policy is independent of answer shuffling and generation diversity.
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const domains = [
    ["geografia", /\bgeograf(?:ia|y)\b/], ["história", /\b(?:historia|history)\b/],
    ["cultura", /\b(?:cultura|culture|artes|entretenimento)\b/],
    ["esportes", /\b(?:esportes?|sports?)\b/], ["ciências", /\b(?:ciencias?|sciences?)\b/],
    ["tecnologia", /\b(?:tecnologia|technology)\b/]
];

export function quizCoveragePlan(sourceText, count) {
    const text = normalize(sourceText);
    // Numeric quotas are only inferred for a short, affirmative general-knowledge
    // topic. Complex requests, exclusions and supplied material stay with the model.
    if (text.length > 500 || !/conhecimentos?\s+gerais|general\s+knowledge|trivia/.test(text)
        || /\b(?:nao|sem|exceto|menos|apenas|somente|priorize|mais|without|except|only)\b|\d|%/.test(text)) return [];
    const selected = domains.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
    const remainder = domains.reduce((rest, [, pattern]) => rest.replace(new RegExp(pattern.source, "g"), ""), text)
        .replace(/conhecimentos?\s+gerais|general\s+knowledge|trivia/g, "")
        .replace(/\b(?:e|and)\b|[\s.,;:\-]/g, "");
    if (remainder) return []; // An unrecognised area must never be silently dropped.
    if (selected.length < 2 || !Number.isInteger(count) || count < selected.length) return [];
    return selected.map((area, index) => ({ area, count: Math.floor(count / selected.length) + (index < count % selected.length ? 1 : 0) }));
}

export function quizPedagogyInstructions(sourceText, options = {}) {
    const plan = options.quizVariation ? quizCoveragePlan(sourceText, options.count) : [];
    const languages = { "pt-BR": "português do Brasil", en: "inglês", es: "espanhol" };
    return [
        "CONTRATO DO QUIZ: o pedido principal e o conteúdo fornecido definem O QUE perguntar. Disciplina, turma e objetivo contextualizam esse pedido; nunca substituem os temas explícitos. Se o pedido é conhecimentos gerais, uma disciplina de idioma NÃO autoriza trocar geografia, história, cultura, esportes ou ciências por gramática, tradução ou vocabulário.",
        options.language && options.language !== "auto"
            ? `IDIOMA SELECIONADO: escreva enunciados, alternativas e explicações em ${languages[options.language] || "português do Brasil"}. Preserve nomes próprios e citações. Não mude os assuntos para ensinar esse idioma.`
            : "IDIOMA AUTOMÁTICO: respeite primeiro o idioma explicitamente pedido no texto; ao organizar perguntas prontas, preserve o idioma original. Para perguntas novas sem indicação, se a disciplina for Inglês ou Espanhol, use esse idioma mantendo os temas pedidos. Nos demais casos, use português do Brasil.",
        "Ao organizar perguntas prontas, preserve seu conteúdo e dificuldade; as regras a seguir valem para perguntas novas. Não troque perguntas fornecidas para cumprir quotas de variedade.",
        ({
            easy: "DIFICULDADE FÁCIL: conceitos fundamentais, situações familiares e uma etapa de raciocínio. Mesmo assim, use alternativas plausíveis, sem entregar a resposta no enunciado.",
            medium: "DIFICULDADE MÉDIA (padrão): a maioria das perguntas deve exigir compreender, comparar, interpretar um contexto curto ou aplicar conhecimento. No máximo um terço pode ser mera lembrança de fatos. Evite uma sequência de capitais, datas famosas, nomes óbvios e definições elementares. Distratores devem representar erros de compreensão plausíveis.",
            hard: "DIFICULDADE DIFÍCIL: priorize inferência, comparação de evidências, causas e consequências e aplicação em situações novas. Exija raciocínio em mais de uma etapa quando adequado ao público; fatos obscuros, pegadinhas e frases complicadas não são dificuldade pedagógica."
        })[options.difficulty || "medium"],
        "Calibre a exigência ao ano/público. Dificuldade cognitiva e dificuldade do idioma são distintas: não torne o conteúdo trivial por estar em inglês nem use vocabulário inacessível para dificultar. Um pedido explícito de nível no texto prevalece sobre o padrão.",
        plan.length ? `PLANO DE COBERTURA: ${plan.map(item => `${item.area}: ${item.count} pergunta(s)`).join("; ")}. Cada pergunta conta para uma única área principal. Intercale as áreas na ordem final; confira a distribuição antes de responder.` : "Antes de escrever, distribua as perguntas entre TODOS os assuntos solicitados. Se não houver pesos explícitos, mantenha as quantidades por área com diferença máxima de uma. Se houver menos perguntas que áreas, respeite a quantidade, sem fingir que cobriu todas. Não invente áreas externas ao pedido.",
        "Cultura precisa de conteúdo próprio: literatura, música, artes visuais, cinema, manifestações populares, patrimônio e práticas culturais de diferentes povos. Não conte guerras, governos ou localização de países como cultura apenas para cumprir a distribuição. Varie também modalidades esportivas e campos científicos quando solicitados.",
        "REVISÃO INTERNA ANTES DO JSON: confira fidelidade ao pedido, cobertura, nível, ausência de perguntas repetidas e resposta correta verificável. Em múltipla escolha, uma única alternativa deve ser defensável, com opções de extensão e construção semelhantes; nada de distratores absurdos ou pistas gramaticais. Em verdadeiro/falso, evite absolutos óbvios e proposições compostas ambíguas. Nas abertas, forneça critério de correção e resposta-modelo. Explique por que a resposta está correta, não apenas repita-a. Substitua internamente itens fracos antes de retornar. Não exponha esse planejamento no material."
    ].filter(Boolean).join("\n");
}
