import { slideAudienceProfile } from "./slide-generation-policy.js";

const key = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const legacy = (action, label) => String(action || "").match(new RegExp(`(?:${label}):\\s*([^\\n]+?)(?=\\.\\s|$)`, "i"))?.[1]?.replace(/\.$/, "").trim() || "";
const arrays = { slides: "slides", quiz: "questions", flashcards: "cards", memory: "pairs", match: "pairs", wheel: "segments", mindmap: "branches", debate: "steps", wordsearch: "words", crossword: "entries", hangman: "words" };
const limits = { slides: [1, 30], quiz: [1, 50], flashcards: [2, 30], memory: [2, 20], match: [2, 20], wheel: [2, 24], mindmap: [2, 10], debate: [2, 8], wordsearch: [2, 20], crossword: [4, 12], hangman: [2, 20] };
function invalid() {
    return Object.assign(new Error("Opções da atividade inválidas. Revise os campos e tente novamente."), { code: "invalid_generation_options" });
}
function text(value, max) {
    if (value == null) return "";
    if (typeof value !== "string" || value.length > max) throw invalid();
    return value.replace(/\u0000/g, "").trim();
}
function boolean(value, fallback) {
    if (value == null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (["true", "sim"].includes(key(value))) return true;
    if (["false", "nao"].includes(key(value))) return false;
    throw invalid();
}

export function normalizeActivityGenerationOptions(materialType, raw, action = "") {
    let source = raw === undefined ? {} : raw;
    if (typeof source === "string") {
        if (source.length > 4000) throw invalid();
        try { source = JSON.parse(source); } catch { throw invalid(); }
    }
    if (!source || typeof source !== "object" || Array.isArray(source)) throw invalid();
    if (!limits[materialType]) throw invalid();
    const requestedCount = source.count ?? String(action).match(/Gerar\s+(\d+)/i)?.[1];
    if (requestedCount != null && !["string", "number"].includes(typeof requestedCount)) throw invalid();
    const count = requestedCount == null || requestedCount === "" ? null : Number(requestedCount);
    if (count !== null && (!Number.isInteger(count) || count < limits[materialType][0] || count > limits[materialType][1])) throw invalid();
    const format = key(text(source.format ?? legacy(action, "Formato desejado"), 140));
    const layout = key(text(source.layout ?? legacy(action, "Leitura desejada"), 40));
    return {
        count,
        audience: text(source.audience ?? legacy(action, "Ano ou público|Público ou ano"), 160),
        className: text(source.className ?? legacy(action, "Turma"), 160),
        subject: text(source.subject ?? legacy(action, "Disciplina"), 120),
        objective: text(source.objective, 280),
        approach: text(source.approach ?? String(action).split(".")[0].slice(0, 120), 120),
        title: text(source.title, 180),
        leftLabel: text(source.leftLabel, 80), rightLabel: text(source.rightLabel, 80),
        format: materialType === "quiz" ? (/mist|mixed/.test(format) ? "mixed" : /true-false|verdadeiro/.test(format) ? "true-false" : /open|aberta/.test(format) ? "open" : /choice|escolha/.test(format) ? "choice" : "mixed")
            : materialType === "debate" ? (/guided-circle|roda/.test(format) ? "guided-circle" : "two-sides") : "",
        layout: materialType === "mindmap" ? (/topic/.test(layout) ? "topics" : "radial") : "",
        examples: boolean(source.examples ?? legacy(action, "Incluir exemplos"), true),
        shuffle: boolean(source.shuffle, !/Manter a coluna B/.test(action)),
        eliminate: boolean(source.eliminate, /Eliminar item sorteado/.test(action)),
        directions: ["basic", "diagonal", "full"].includes(source.directions) ? source.directions : "diagonal"
    };
}

export function activityGenerationInstructions(materialType, options) {
    const audience = slideAudienceProfile(options);
    const guidance = {
        early: "Use linguagem oral simples, observação e situações concretas, sem pressupor leitura autônoma.",
        primary: "Use linguagem simples, explique termos novos e prefira exemplos concretos dos anos iniciais.",
        middle: "Explique termos disciplinares e trabalhe relações entre conceitos, causas e consequências acessíveis aos anos finais.",
        secondary: "Use rigor disciplinar, análise e aplicação adequados ao ensino médio, sem infantilizar.",
        adult: "Respeite o público adulto/EJA, sem infantilização; use situações práticas e não presuma escolarização uniforme.",
        higher: "Use vocabulário técnico contextualizado e análise crítica, sem inventar referências.",
        general: "Adapte-se ao público descrito; se não informado, não invente idade nem pré-requisitos."
    };
    const instructions = [
        "CONFIGURAÇÃO DA ATIVIDADE — as escolhas explícitas abaixo têm prioridade sobre sugestões genéricas:",
        options.count ? `Gere exatamente ${options.count} itens no array ${arrays[materialType]}. Não conte título ou instruções como itens.` : "",
        `Ano/público: ${JSON.stringify(audience.audience || "não informado")}. ${guidance[audience.profile]}`,
        "O ano/público explícito tem prioridade sobre a turma. Nunca confunda o nome da turma com a idade dos alunos.",
        `Disciplina: ${JSON.stringify(options.subject || "não informada")}. Objetivo: ${JSON.stringify(options.objective || "não informado")}.`,
        options.approach ? `Como ajudar: ${JSON.stringify(options.approach)}.` : ""
    ];
    if (materialType === "quiz") instructions.push({
        mixed: "Varie os tipos: multiple_choice, true_false e open. Com pelo menos 3 perguntas, inclua os três tipos.",
        choice: "TODAS as perguntas devem ter type multiple_choice, quatro alternativas plausíveis e apenas uma correta. Não inclua questões abertas ou verdadeiro/falso.",
        open: "TODAS as perguntas devem ter type open, options vazio e correct_answer como resposta-modelo. Peça explicação, aplicação ou justificativa; não ofereça alternativas.",
        "true-false": "TODAS as perguntas devem ter type true_false, uma afirmação verificável e somente as opções Verdadeiro e Falso. Evite dupla negação."
    }[options.format]);
    if (materialType === "flashcards") instructions.push(options.examples
        ? "Preencha example em cada card com um exemplo concreto ou nota útil, diferente da definição do verso."
        : "Não gere exemplos nem anotações: example deve ser string vazia em todos os cards.");
    if (materialType === "mindmap") instructions.push(options.layout === "radial"
        ? "Organização radial: tópicos independentes conectados ao tema central, sem sequência obrigatória."
        : "Organização em tópicos: progressão hierárquica e sequencial, do conceito geral às aplicações.");
    if (materialType === "debate") instructions.push(options.format === "guided-circle"
        ? "Roda guiada: participação coletiva e escuta, sem defender/atacar lados fixos. format deve ser Roda guiada; side_a e side_b representam perspectivas para reflexão, não equipes rivais. Estruture observação, aprofundamento e síntese."
        : "Dois lados: duas posições defensáveis, argumentos e contrapontos; format deve ser Dois lados. Reserve etapas para defesa, resposta e síntese.");
    if (materialType === "match") instructions.push(`shuffle_right deve ser ${options.shuffle}. Crie pares inequívocos e preserve a associação correta mesmo quando a coluna B for embaralhada.`);
    if (materialType === "wheel") instructions.push(`eliminate_used deve ser ${options.eliminate}. Os itens serão ${options.eliminate ? "retirados após o sorteio" : "mantidos para novos sorteios"}.`);
    const action = key(options.approach);
    if (materialType === "quiz" && action.includes("completar")) instructions.push("Preserve perguntas e respostas já fornecidas; complete apenas alternativas ausentes, mantendo o formato escolhido.");
    if (materialType === "quiz" && action.includes("converter")) instructions.push("Transforme o texto expositivo em novas perguntas de compreensão e aplicação, não apenas frases com lacunas.");
    if (materialType === "mindmap" && action.includes("resumir")) instructions.push("Faça uma síntese panorâmica: detalhes breves, apenas os eixos essenciais.");
    if (materialType === "mindmap" && action.includes("conceitos")) instructions.push("Explique os conceitos e relações hierárquicas, incluindo exemplo quando pertinente.");
    if (materialType === "mindmap" && action.includes("revisao")) instructions.push("Use palavras-chave, perguntas de recuperação e lembretes curtos para revisão.");
    if (materialType === "crossword") instructions.push(action.includes("revisao")
        ? "As pistas devem recuperar conceitos estudados por suas definições e aplicações, sem revelar a palavra."
        : action.includes("texto") ? "Extraia as respostas do texto fornecido e derive pistas fiéis aos trechos, sem introduzir assuntos externos."
        : "Escolha termos centrais do tema e pistas introdutórias claras, sem respostas repetidas.");
    if (materialType === "debate" && action.includes("pergunta central")) instructions.push("Priorize uma pergunta central debatível, com cada etapa explorando um aspecto diferente dela.");
    if (materialType === "debate" && action.includes("transformar texto")) instructions.push("Ancore as perguntas nas ideias e evidências do texto-base para mediação progressiva.");
    return instructions.filter(Boolean).join("\n");
}

export function applyActivityGenerationSettings(materialType, material, options) {
    const result = { ...material, generation_options: { ...material.generation_options, ...options } };
    if (options.title) result.title = options.title;
    if (materialType === "mindmap") result.layout = options.layout;
    if (materialType === "debate") result.format = options.format === "guided-circle" ? "Roda guiada" : "Dois lados";
    if (materialType === "wheel") result.eliminate_used = options.eliminate;
    if (materialType === "match") {
        result.shuffle_right = options.shuffle;
        if (options.leftLabel) result.left_label = options.leftLabel;
        if (options.rightLabel) result.right_label = options.rightLabel;
    }
    if (materialType === "flashcards" && !options.examples && Array.isArray(result.cards)) result.cards = result.cards.map((card) => ({ ...card, example: "" }));
    return result;
}
