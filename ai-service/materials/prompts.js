import { normalizeSlideGenerationOptions, slidePedagogyInstructions } from "../slide-generation-policy.js";
import { slideIllustrationInstructions } from "../slide-illustration-policy.js";
import { activityGenerationInstructions } from "../activity-generation-policy.js";
import { discoveryPrompt } from "./discovery.js";
import { worksheetPrompt } from "./worksheet.js";
import { refinementPrompt } from "./item-refinement.js";

/**
 * Builds the Portuguese-language provider prompt for a given activity type.
 * Includes pedagogical instructions, format rules, teacher goal, and source text.
 * Falls back to a slides prompt for unrecognised types.
 * @param {string} materialType - Activity type key (e.g. "quiz", "flashcards")
 * @param {string} action - Teacher's stated goal, injected verbatim into the prompt
 * @param {string} sourceText - Raw source material from teacher input or uploaded file
 * @returns {string} Full prompt string ready to send to the text provider
 */
export function promptFor(materialType, action, sourceText, slideOptions, generationOptions) {
    if (generationOptions?.operation === "refine-item") return refinementPrompt(materialType, sourceText);
    const base = basePromptFor(materialType, action, sourceText, slideOptions, generationOptions);
    return generationOptions ? `${base}\n\n${activityGenerationInstructions(materialType, generationOptions)}` : base;
}

function basePromptFor(materialType, action, sourceText, slideOptions, generationOptions) {
    if (materialType === "worksheet") return worksheetPrompt(action, sourceText, generationOptions);
    if (["wordtrail", "connections"].includes(materialType)) return discoveryPrompt(materialType, action, sourceText, generationOptions);
    if (materialType === "quiz") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "O material deve ficar pronto para revisão rápida do professor, sem texto fora do JSON.",
            "Escreva em português do Brasil, com linguagem escolar clara, objetiva e natural.",
            "Se o texto já trouxer perguntas, normalize a estrutura e complete apenas o que estiver faltando.",
            "Se o texto for expositivo, gere um quiz fiel ao conteúdo enviado, sem inventar fatos desnecessários.",
            "Prefira perguntas que verifiquem compreensão, relação entre ideias e identificação de conceitos centrais.",
            "Evite enunciados vagos, alternativas ambíguas e distrações absurdas.",
            "Em múltipla escolha, use 4 alternativas plausíveis e apenas uma correta.",
            "Em verdadeiro ou falso, escreva afirmacoes objetivas e verificaveis.",
            "Em pergunta aberta, produza critério curto e resposta-modelo enxuta.",
            "A explicação deve ajudar o professor a corrigir ou retomar o conteúdo.",
            `Objetivo do professor: ${action || "Estruturar quiz a partir do material enviado."}`,
            "Regras adicionais:",
            "- Priorize clareza e aderencia ao texto-base.",
            "- Não use tom publicitário nem linguagem excessivamente rebuscada.",
            "- Se o conteúdo estiver incompleto, faça a melhor estrutura possível sem sair do tema.",
            "- Respeite explicitamente a quantidade e o formato pedidos pelo professor quando isso for informado.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "flashcards") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte flashcards claros, curtos e úteis para memorização e revisão em sala.",
            "Use português do Brasil para conteúdo novo sem idioma solicitado; ao organizar material pronto, preserve o idioma original.",
            "Frente e verso seguem a organização pedida pelo professor. Termo/definição e pergunta/resposta são sugestões apenas quando ele não especificar outra estrutura.",
            "Use example apenas quando realmente ajudar a fixação.",
            "Evite textos longos, redundância e exemplos genéricos.",
            "Prefira textos legíveis, mas não encurte nem omita explicações, alternativas ou pontuações fornecidas para obedecer a um tamanho genérico. A apresentação ajusta o texto e permite rolagem.",
            "Não use frases truncadas, reticências nem cortes artificiais.",
            "Se o professor enviar conteúdo teórico, transforme em pares de estudo fiéis ao texto-base.",
            `Objetivo do professor: ${action || "Estruturar flashcards a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de cards pedida quando ela for informada.",
            "- Prefira variedade de conceitos centrais, não repetições.",
            "- Não invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "memory") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte um jogo da memória claro, rápido de jogar e fiel ao texto-base.",
            "Crie pares curtos, legíveis e bons para memorização em sala.",
            "Cada front deve ser breve: termo, pergunta curta, data, palavra-chave ou conceito.",
            "Cada back deve trazer a resposta correspondente, definição curta ou associação correta.",
            "Evite frases longas, pares redundantes ou conteúdos vagos.",
            "Prefira conceitos centrais, datas importantes, relações diretas e vocabulário útil.",
            "Se o texto-base trouxer listas já associadas, preserve essa lógica.",
            `Objetivo do professor: ${action || "Estruturar jogo da memória a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de pares pedida quando ela for informada.",
            "- Cada lado do par deve caber bem em um card curto.",
            "- Não invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "hangman") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte um jogo da força claro, pedagógico e fiel ao texto-base.",
            "Escolha respostas relevantes para revisão de vocabulário, ortografia ou conceitos-chave.",
            "Cada answer deve ser uma palavra ou expressão curta, sem artigo desnecessário.",
            "Cada clue deve orientar sem revelar diretamente a resposta.",
            "Use category para agrupar palavras quando houver uma categoria útil; caso contrário, use string vazia.",
            "Evite respostas ambíguas, repetidas, excessivamente longas ou dependentes de grafia não apresentada.",
            `Objetivo do professor: ${action || "Estruturar jogo da força a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de palavras pedida quando ela for informada.",
            "- Escreva em português do Brasil e adapte a dificuldade ao ano ou público informado.",
            "- Não invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "match") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte uma atividade de ligar pontos clara, curta e fácil de aplicar em sala.",
            "Organize pares entre coluna A e coluna B com associações objetivas e corretas.",
            "Cada item deve ser curto e legível em poucas palavras.",
            "Evite frases longas, ambiguidades ou pares muito parecidos entre si.",
            "Prefira conceito-definição, evento-data, autor-obra, país-capital ou relações equivalentes ao texto-base.",
            "Defina left_label e right_label de forma clara para o professor.",
            `Objetivo do professor: ${action || "Estruturar ligar pontos a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de pares pedida quando ela for informada.",
            "- Use shuffle_right true quando fizer sentido para a atividade.",
            "- Não invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "wheel") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte uma roleta editavel com itens curtos, claros e bons para sorteio em sala.",
            "Cada segmento deve ter um texto enxuto, fácil de ler dentro da roleta.",
            "Prefira perguntas curtas, desafios rápidos, temas de revisão ou comandos objetivos.",
            "Evite segmentos longos, frases com várias ideias ou instruções vagas.",
            "Se o texto-base for teórico, transforme em itens de revisão ou provocações curtas.",
            `Objetivo do professor: ${action || "Estruturar roleta a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de espaços pedida quando ela for informada.",
            "- Cada segmento deve caber bem em uma fatia da roleta.",
            "- Não invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "wordsearch") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte um caça-palavras didático, claro e fácil de usar em sala.",
            "Selecione palavras-chave realmente importantes do tema enviado.",
            "Cada term deve ser curto o bastante para caber bem na grade.",
            "Prefira palavras entre 3 e 12 caracteres, sem frases longas.",
            "Use clue apenas quando ajudar a revisão; ela deve ser curta e objetiva.",
            "Evite termos redundantes, genéricos demais ou longos demais.",
            "Se o texto-base for teórico, transforme em um banco de palavras de revisão fiel ao tema.",
            `Objetivo do professor: ${action || "Estruturar caça-palavras a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de palavras pedida quando ela for informada.",
            "- Não invente fatos fora do tema.",
            "- Prefira palavras variadas, não repetições do mesmo conceito.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "mindmap") {
        const normalizedAction = String(action || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        const approachInstructions = normalizedAction.includes("conceitos em topicos")
            ? [
                "Modo selecionado pelo professor: organizar conceitos em tópicos.",
                "Priorize estrutura conceitual e hierárquica.",
                "Cada branch deve representar um conceito central do tema.",
                "O subtitle deve nomear a ideia-chave do conceito.",
                "O detail deve explicar o conceito e trazer 2 a 4 bullets curtos quando isso ajudar."
            ]
            : normalizedAction.includes("resumir um tema")
                ? [
                    "Modo selecionado pelo professor: resumir um tema em mapa mental.",
                    "Priorize síntese e panorama geral.",
                    "Use menos detalhes e mais clareza global do assunto.",
                    "Cada branch deve resumir um eixo importante do tema.",
                    "O detail deve ser enxuto, sem excesso de aprofundamento."
                ]
                : normalizedAction.includes("revisao visual")
                    ? [
                        "Modo selecionado pelo professor: estruturar revisão visual.",
                        "Priorize memorização, revisão rápida e linguagem projetável.",
                        "Cada branch deve funcionar bem como ponto de revisão.",
                        "No detail, prefira bullets curtos, diretos e faceis de reler.",
                        "Destaque palavras-chave, etapas, causas, exemplos ou classificacoes."
                    ]
                    : [];

        const layoutInstructions = normalizedAction.includes("leitura desejada: radial")
            ? [
                "Leitura desejada: radial.",
                "Crie branches mais independentes entre si, com subtitulos curtos e forte contraste de ideias."
            ]
            : normalizedAction.includes("leitura desejada: topicos")
                ? [
                    "Leitura desejada: tópicos.",
                    "Crie progressão mais linear, com detalhes que funcionem bem como lista e revisão sequencial."
                ]
                : [];

        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte um mapa mental didático, claro e fácil de revisar em tela.",
            "Crie um tema central, um subtítulo curto e tópicos bem distribuídos.",
            "Cada branch deve ter título, subtítulo e um detail com uma explicação breve e organizada.",
            "No detail, você pode usar um pequeno parágrafo e bullets curtos separados por \\n quando isso ajudar.",
            "Evite tópicos redundantes, vagos ou amplos demais.",
            "Prefira conceitos centrais, relações entre ideias e organização hierárquica simples.",
            ...approachInstructions,
            ...layoutInstructions,
            `Objetivo do professor: ${action || "Estruturar mapa mental a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de tópicos pedida quando for informada.",
            "- O subtítulo de cada branch deve resumir a ideia-chave.",
            "- O detail deve ser curto o bastante para caber bem no builder.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "debate") {
        const normalizedAction = String(action || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();

        const formatInstructions = normalizedAction.includes("formato desejado: roda guiada")
            ? [
                "Formato desejado: roda guiada.",
                "Evite organizar o debate como confronto fixo entre dois lados.",
                "Priorize escuta, participação coletiva, aprofundamento e mediação do professor."
            ]
            : [
                "Formato desejado: dois lados.",
                "Estruture o debate com contraste claro entre duas perspectivas."
            ];

        const assistanceInstructions = normalizedAction.includes("criar pergunta central e etapas")
            ? [
                "Modo de ajuda selecionado: criar pergunta central e etapas.",
                "Priorize uma pergunta principal forte, debatível e um roteiro muito claro de progressão."
            ]
            : normalizedAction.includes("transformar texto em discussao guiada")
                ? [
                    "Modo de ajuda selecionado: transformar texto em discussão guiada.",
                    "Priorize condução do professor, retomada do texto-base e aprofundamento progressivo."
                ]
                : [
                    "Modo de ajuda selecionado: organizar roteiro de debate.",
                    "Busque equilíbrio entre estrutura, pergunta central e mediação."
                ];
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte um debate guiado pronto para mediação de professor.",
            "Crie um título, uma pergunta central forte, dois lados claros e um roteiro por etapas.",
            "As etapas devem ter título, tempo sugerido, pergunta da etapa e guidance curto.",
            "O guidance deve ajudar o professor a conduzir a discussão, não repetir a pergunta.",
            "Evite polarizações artificiais ou formulações agressivas.",
            "Prefira perguntas debatíveis, adequadas ao ambiente escolar e ligadas ao conteúdo-base.",
            ...formatInstructions,
            ...assistanceInstructions,
            `Objetivo do professor: ${action || "Estruturar debate guiado a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite o número de etapas e o formato pedidos pelo professor quando forem informados.",
            "- Os lados devem ser formulados de modo claro e compreensível.",
            "- Cada etapa deve ter progressão lógica: aquecimento, confronto de ideias, fechamento.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "crossword") {
        return [
            "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compatível com o schema fornecido.",
            "Monte uma atividade de palavras cruzadas pronta para uso em sala.",
            "Cada answer deve ser uma palavra ou termo curto, sem espaços.",
            "Cada clue deve ser uma pista direta, clara e fiel ao texto-base.",
            "Evite respostas longas, frases completas ou termos ambíguos.",
            "Prefira conceitos centrais, vocabulário-chave e exemplos do conteúdo.",
            `Objetivo do professor: ${action || "Estruturar palavras cruzadas a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de entradas pedida quando ela for informada.",
            "- Não invente fatos fora do tema.",
            "- Varie o tamanho das respostas para equilibrar a cruzadinha.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    const wantsPersonalizedVisual = normalizeSlideGenerationOptions(slideOptions, action).visualMode === "ai";
    const slideVisualInstructions = wantsPersonalizedVisual
        ? [
            "Visual personalizado: Crie visual_theme coerente com assunto e público, cores #RRGGBB e rationale breve. background e alternate_background quase brancos; evite cinza médio e fundos turvos. Texto escuro, contraste mínimo 7:1. contrast_background escuro e contrast_text claro só para capa/encerramento. Até duas cores de destaque, sem tingir todo o slide nem usar estereótipos. Mantenha a mesma identidade. composition: editorial para explicações ou imagem ao lado; focus para pergunta/abertura curta; panels para 2–4 ideias comparáveis separadas por parágrafos. Varie conforme o conteúdo, sem cortar texto para caber."
        ]
        : [
            "Visual padrão EducarIA: preencha visual_theme em #RRGGBB. Capa/fechamento: fundo #153c41, texto #f8f9ec. Conteúdo: fundo #f8f9ec ou #e8f3ed, texto #173c43. Destaques suaves menta, dourado, lilás ou coral; ilustrações legíveis nesses fundos."
        ];

    return [
        "Você é um assistente pedagógico brasileiro. Responda apenas em JSON compatível com o schema. Monte uma sequência didática de slides projetáveis e editáveis. Português do Brasil para conteúdo novo sem idioma solicitado; preserve o idioma do material pronto.",
        "BODY: títulos claros, frases completas, sem repetir o título nem cortar frases. Parágrafos explicativos curtos são permitidos; use explicação, exemplo resolvido, comparação, etapas ou lista conforme a ideia. Separe blocos com \\n e inicie itens de lista com '- '. Bullets não são obrigatórios. Evite clichês, tom corporativo e blocos extensos. teacher_notes orienta a mediação, não substitui explicações visíveis.",
        ...(generationOptions ? ["Neste pedido body é um OBJETO: preencha os blocos definidos no schema conforme suas descrições, sem duplicação. Eles formarão o texto visível na ordem dos campos. As faixas de palavras valem para a SOMA dos blocos, não para cada campo."] : []),
        "COMPOSIÇÃO: type content explica, question convida à participação; cover (body de 1–2 linhas) e closing (síntese/pergunta de revisão) só se fizerem sentido. Varie visual_variant: hero na abertura, light/alternate no desenvolvimento, question nas perguntas e contrast no fechamento. Não dependa da cor para transmitir conteúdo.",
        ...slidePedagogyInstructions(normalizeSlideGenerationOptions(slideOptions, action)),
        ...slideIllustrationInstructions(normalizeSlideGenerationOptions(slideOptions, action)),
        ...slideVisualInstructions,
        `Objetivo do professor: ${action || "Estruturar slides a partir do material enviado."}`,
        "RIGOR FACTUAL: não complete lacunas com datas, números, citações ou nomes específicos sem segurança. Omita detalhes incertos ou indique aproximação/controvérsia; não invente fontes nem afirme pesquisa externa. Ao reorganizar, preserve dados e idioma; não substitua silenciosamente informações por suposições. Revise consistência entre título, subtítulo, body e ilustração (datas, unidades, nomes e relações); isso não é uma checagem independente de fontes.",
        "Material de origem:",
        sourceText
    ].join("\n\n");
}

/**
 * Builds the image generation prompt for a single slide.
 * Instructs Gemini to produce a clean, school-appropriate horizontal illustration.
 * @param {{ title?: string, subtitle?: string, body?: string, prompt?: string }} slide
 * @returns {string} Full prompt string for the image generation model
 */
export function imagePromptForSlide({ title, subtitle, body, prompt }) {
    return [
        "Você cria ilustrações educativas para slides de professores no Brasil.",
        "Gere uma única imagem horizontal, clara, ilustrativa e apropriada para contexto escolar.",
        "Evite texto dentro da imagem, marcas, interfaces, colagens confusas ou excesso de elementos.",
        "A imagem deve ajudar a explicar o conteúdo do slide rapidamente.",
        "Prefira composição limpa, foco evidente e visual didático.",
        prompt ? `Pedido direto do professor/IA: ${prompt}` : "",
        title ? `Título do slide: ${title}` : "",
        subtitle ? `Subtítulo do slide: ${subtitle}` : "",
        body ? `Conteúdo do slide: ${body}` : "",
        "Entregue apenas a imagem."
    ].filter(Boolean).join("\n\n");
}
