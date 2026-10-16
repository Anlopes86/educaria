import { normalizeSlideGenerationOptions, slidePedagogyInstructions } from "../slide-generation-policy.js";
import { slideIllustrationInstructions } from "../slide-illustration-policy.js";
import { activityGenerationInstructions } from "../activity-generation-policy.js";

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
    const base = basePromptFor(materialType, action, sourceText, slideOptions);
    return generationOptions ? `${base}\n\n${activityGenerationInstructions(materialType, generationOptions)}` : base;
}

function basePromptFor(materialType, action, sourceText, slideOptions) {
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

    const wantsPersonalizedVisual = /visual\s+(personalizado|tematico|temático)|personalizar\s+o\s+visual|modo\s+visual:\s*personalizado/i.test(action);
    const slideVisualInstructions = wantsPersonalizedVisual
        ? [
            "Modo visual escolhido: personalizado pela IA de acordo com o tema.",
            "Crie visual_theme com uma paleta coerente com o assunto, a disciplina e o público da aula.",
            "Use somente cores hexadecimais completas no formato #RRGGBB.",
            "Para leitura na TV, background e alternate_background devem ser quase brancos, com um toque suave da paleta; evite cinza médio, fundos turvos e aparência desbotada. Use texto escuro com contraste de pelo menos 7:1. Reserve contrast_background escuro e contrast_text claro para capa e encerramento.",
            "Escolha no máximo duas cores de destaque expressivas, coerentes e visíveis nos fundos claros e escuros; concentre nelas a identidade do tema, não em tingir o slide inteiro. Evite arco-íris e estereótipos visuais.",
            "Explique a escolha em rationale com uma frase curta e útil para o professor.",
            "Varie visual_variant com intenção: hero na abertura, light e alternate no desenvolvimento, question nas perguntas e contrast no fechamento.",
            "A variação deve parecer parte do mesmo tema; não crie uma identidade diferente em cada slide."
        ]
        : [
            "Modo visual escolhido: padrão EducarIA.",
            "Preencha visual_theme com uma paleta moderna, sóbria e de alto contraste, pois o editor aplicará o padrão visual da plataforma.",
            "No padrão, capa e fechamento têm fundo verde-escuro #153c41 e texto creme #f8f9ec; conteúdo usa fundos claros #f8f9ec ou #e8f3ed e texto #173c43. Planeje as cores e os rótulos das ilustrações para esses fundos, com destaques suaves em menta, dourado, lilás ou coral.",
            "Use visual_variant de acordo com a função de cada slide, sem depender dele para transmitir o conteúdo."
        ];

    return [
        "Você é um assistente pedagógico de uma plataforma educacional brasileira.",
        "Responda apenas em JSON compatível com o schema fornecido.",
        "Monte slides prontos para uma aula real e para edição rápida. Use português do Brasil para conteúdo novo sem idioma solicitado; preserve o idioma original de material pronto.",
        "Quebre o conteúdo em uma sequência lógica e didática, com a profundidade escolhida pelo professor.",
        "O texto visível no slide deve ser curto, projetável e fácil de ler pela turma.",
        "Evite parágrafos longos, frases de efeito, clichês e tom genérico de apresentação corporativa.",
        "Use títulos claros e uma composição adequada à ideia: explicação, exemplo resolvido, comparação, etapas ou lista. Bullets não são obrigatórios.",
        "Regra forte de formatação do body:",
        "- A quantidade de linhas e a extensão de cada uma seguem a configuração pedagógica abaixo.",
        "- Quebre linhas com \\n.",
        "- Quando listar ideias, comece cada linha com '- '.",
        "- Cada linha deve expressar uma ideia completa; nunca corte uma frase para encurtá-la.",
        "- Parágrafos explicativos curtos são permitidos e desejáveis quando ajudam a aprofundar; separe blocos por quebras de linha.",
        "- Não repita o título no body.",
        "Regra forte de composição:",
        "- Slide de capa: 1 a 2 linhas no body.",
        "- Slides de conteúdo: desenvolva a ideia de acordo com a intenção e o detalhamento; não substitua explicações por títulos ou palavras-chave.",
        "- Slide final: fechamento, síntese ou pergunta de revisão.",
        "Use teacher_notes para orientar a mediação do professor sem repetir o que já está visível no slide.",
        "Use teacher_notes para orientações de mediação. Não esconda ali as explicações solicitadas para os alunos.",
        ...slidePedagogyInstructions(normalizeSlideGenerationOptions(slideOptions, action)),
        ...slideIllustrationInstructions(normalizeSlideGenerationOptions(slideOptions, action)),
        "Escolha o tipo pela função: content para explicação, question para participação, cover e closing somente se o pedido comportar abertura e encerramento próprios.",
        "Varie a composição entre título forte, síntese em tópicos e pergunta de discussão; não transforme todos os slides na mesma lista.",
        ...slideVisualInstructions,
        "Organize a sequência com começo, desenvolvimento e fechamento.",
        `Objetivo do professor: ${action || "Estruturar slides a partir do material enviado."}`,
        "Regras adicionais:",
        "- Não invente dados específicos que não estejam sustentados pelo texto-base.",
        "- RIGOR FACTUAL: não complete lacunas com datas, números, citações ou nomes específicos sem segurança. Para conteúdo novo, omita detalhes acessórios incertos ou indique explicitamente aproximação/controvérsia quando pertinente. Não transforme uma hipótese em certeza nem invente fontes ou afirme que houve pesquisa/verificação externa. Ao reorganizar texto fornecido, preserve os dados e o idioma; não substitua silenciosamente informações por suposições.",
        "- Antes de entregar, revise a consistência entre título, subtítulo, body e ilustração: datas, unidades, nomes, sequência e relações devem concordar. Essa revisão interna não é uma checagem independente de fontes.",
        "- Se o conteúdo estiver extenso, priorize as ideias centrais.",
        "- Se a origem for apenas um tópico, desenvolva-o com conhecimento pedagógico confiável, respeitando o público e o detalhamento. Se for um texto-base, preserve suas informações e não invente dados específicos.",
        "- Evite excesso de slides; prefira concisão com progressão clara.",
        "- Respeite explicitamente quantidade de slides, nível de detalhamento e preferência de imagens quando o professor informar.",
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
