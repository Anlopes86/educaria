const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function invalidOptions() {
    const error = new Error("Opções dos slides inválidas ou muito longas. Revise os campos e tente novamente.");
    error.code = "invalid_slide_options";
    return error;
}

function optionText(value, limit) {
    if (value == null) return "";
    if (typeof value !== "string" || value.length > limit) throw invalidOptions();
    return value.replace(/\u0000/g, "").trim();
}

// Old clients and the dashboard still send labels in the action field.
function legacyValue(action, label) {
    return String(action || "").match(new RegExp(`(?:${label}):\\s*([^\\n]+?)(?=\\.\\s|$)`, "i"))?.[1]?.replace(/\.$/, "").trim() || "";
}

export function normalizeSlideGenerationOptions(raw, action = "") {
    let options = raw === undefined ? {} : raw;
    if (typeof options === "string") {
        if (options.length > 3000) throw invalidOptions();
        try { options = JSON.parse(options); } catch { throw invalidOptions(); }
    }
    if (!options || typeof options !== "object" || Array.isArray(options)) throw invalidOptions();
    const detail = normalize(optionText(options.detail ?? legacyValue(action, "Nível de detalhamento"), 60));
    const tone = normalize(optionText(options.tone ?? legacyValue(action, "Tom desejado"), 60));
    return {
        detail: ["concise", "mais enxuto"].includes(detail) ? "concise" : ["detailed", "mais detalhado"].includes(detail) ? "detailed" : "balanced",
        tone: ["visual", "mais visual e direto"].includes(tone) ? "visual" : ["explanatory", "mais explicativo"].includes(tone) ? "explanatory" : ["inspiring", "mais inspirador"].includes(tone) ? "inspiring" : "balanced",
        audience: optionText(options.audience ?? legacyValue(action, "Público ou ano|Ano ou público"), 160),
        className: optionText(options.className ?? legacyValue(action, "Turma"), 160),
        subject: optionText(options.subject ?? legacyValue(action, "Disciplina"), 120),
        objective: optionText(options.objective ?? legacyValue(action, "Objetivo da aula"), 280)
    };
}

export function slideAudienceProfile(options) {
    // A name such as "Turma Azul" or "Sala 12" does not establish age/grade.
    const classHasGrade = /\b[1-9]\s*[ºª°o]?\s*(?:ano|serie)\b|ensino (?:medio|fundamental|superior)|\beja\b|educacao infantil/.test(normalize(options.className));
    const audience = options.audience || (classHasGrade ? options.className : "");
    const key = normalize(audience);
    let profile = "general";
    if (/\beja\b|adultos|terceira idade/.test(key)) profile = "adult";
    else if (/superior|universitari|graduacao/.test(key)) profile = "higher";
    else if (/ensino medio|vestibular|\benem\b/.test(key)) profile = "secondary";
    else if (/infantil|pre.escola/.test(key)) profile = "early";
    else {
        const grade = Number(key.match(/\b([1-9])\s*[ºª°o]?\s*(?:ano|serie)\b/)?.[1]);
        if (grade >= 1 && grade <= 5) profile = "primary";
        else if (grade >= 6 && grade <= 9) profile = "middle";
    }
    return { audience, profile, inferredFromClass: !options.audience && Boolean(audience) };
}

export function slidePedagogyInstructions(options) {
    const details = {
        concise: "MAIS ENXUTO: em slides de conteúdo, use 1 a 2 tópicos de até 8 palavras cada. Selecione só ideias essenciais. Prefira uma palavra-chave com uma definição breve, sem explicações secundárias.",
        balanced: "EQUILIBRADO: em slides de conteúdo, use 3 tópicos de aproximadamente 8 a 12 palavras cada. Combine conceito, explicação breve e um exemplo concreto quando pertinente.",
        detailed: "MAIS DETALHADO: em slides de conteúdo, use 4 a 5 tópicos de aproximadamente 12 a 18 palavras cada, até 80 palavras no body. Inclua explicação do conceito, relação de causa/consequência ou etapas, e exemplo aplicado. Aprofunde o raciocínio sem repetir ideias nem inventar fatos. O detalhe precisa aparecer no body, não apenas em teacher_notes."
    };
    const tones = {
        balanced: "CLARO E EQUILIBRADO: linguagem objetiva, acolhedora e didática. Títulos descritivos, termos definidos e exemplos cotidianos.",
        visual: "MAIS VISUAL E DIRETO: títulos curtos e concretos; use comparações, sequências com setas (→), pares antes/depois ou perguntas curtas quando fizerem sentido. Prefira estruturas esquemáticas a frases discursivas. Não dependa de imagens geradas.",
        explanatory: "MAIS EXPLICATIVO: explicite o que é, como funciona e por que acontece. Conecte causa e consequência com linguagem clara e exemplos resolvidos ou etapas. Não entregue apenas palavras-chave soltas.",
        inspiring: "MAIS INSPIRADOR: abra espaço para curiosidade com uma pergunta ligada ao tema, situações reais próximas do público e pequenos desafios para a turma. Convide a observar, imaginar ou propor uma solução. Mantenha rigor; evite slogans, promessas e frases motivacionais genéricas."
    };
    const audiences = {
        early: "Educação infantil: linguagem oral simples, situações concretas, brincadeiras e observação; não presuma leitura autônoma ou conhecimentos abstratos.",
        primary: "Anos iniciais: explique termos novos em linguagem simples; use exemplos concretos do cotidiano e progressão curta. Evite abstrações e pré-requisitos de séries posteriores.",
        middle: "Anos finais: introduza vocabulário específico com explicação, relações entre conceitos e situações de aplicação. Use comparações, causas e consequências acessíveis.",
        secondary: "Ensino médio: use conceitos disciplinares com rigor, análise, relações causais e aplicação. Evite infantilizar; explique pré-requisitos essenciais sem simplificar excessivamente.",
        adult: "EJA/público adulto: trate a turma com respeito, sem infantilização. Relacione o conteúdo a trabalho, comunidade e situações práticas quando pertinentes. Não presuma escolarização prévia uniforme.",
        higher: "Ensino superior: use vocabulário técnico contextualizado, mecanismos, pressupostos e análise crítica; não invente referências ou dados.",
        general: "Adapte a linguagem e os exemplos ao público descrito. Se não houver indicação clara de ano ou público, use linguagem escolar acessível, sem presumir idade ou conhecimentos prévios específicos."
    };
    const audience = slideAudienceProfile(options);
    return [
        "CONFIGURAÇÃO PEDAGÓGICA DA GERAÇÃO (aplique ao conteúdo visível):",
        details[options.detail], tones[options.tone],
        "Detalhamento controla a quantidade e a profundidade; tom controla a forma de explicar. Combine ambos. O público controla vocabulário, exemplos e pré-requisitos. Uma opção não cancela as outras.",
        `Público de referência (${audience.inferredFromClass ? "inferido do ano no nome da turma" : "campo Ano ou público"}): ${JSON.stringify(audience.audience || "não informado")}.`,
        audiences[audience.profile],
        "O campo Ano ou público tem prioridade sobre o nome da turma. Não deduza idade a partir de um nome sem ano explícito. Não confunda maior detalhamento com conteúdo de séries mais avançadas.",
        `Disciplina: ${JSON.stringify(options.subject || "não informada")}. Objetivo da aula: ${JSON.stringify(options.objective || "não informado")}.`,
        "Capa: 1 a 2 linhas curtas. Fechamento: 1 a 3 linhas para síntese ou pergunta. Não aumente a quantidade de slides para compensar o detalhamento; respeite a quantidade pedida.",
        "Antes de responder, confira se o body reflete o detalhamento e o tom escolhidos, se os exemplos servem ao público e se as frases estão completas."
    ];
}

export function normalizeGeneratedSlideBody(body, slideType) {
    const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n")
        .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
    if (!lines.length) return slideType === "cover" ? "Visão geral da aula" : "- Conteúdo principal";
    // Preserve meaning: display fitting belongs to the presentation, not word slicing.
    return lines.map((line) => slideType === "cover" ? line : `- ${line}`).join("\n");
}
