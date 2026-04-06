import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { GoogleGenAI } from "@google/genai";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 8787);
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

function parseAllowedOrigins(value) {
    return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

const configuredOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGIN);
const defaultOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "null"
];

const allowedOrigins = configuredOrigins.length ? configuredOrigins : defaultOrigins;

app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || (origin === "null" && allowedOrigins.includes("null"))) {
            callback(null, true);
            return;
        }

        callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
}));
app.use(express.json({ limit: "5mb" }));

const quizSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "instructions", "questions"],
    properties: {
        title: { type: "string" },
        instructions: { type: "string" },
        questions: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["type", "prompt", "explanation"],
                properties: {
                    type: {
                        type: "string",
                        enum: ["multiple_choice", "true_false", "short_answer"]
                    },
                    prompt: { type: "string" },
                    options: {
                        type: "array",
                        items: { type: "string" }
                    },
                    correct_answer: { type: "string" },
                    explanation: { type: "string" },
                    criteria: { type: "string" },
                    model_answer: { type: "string" }
                }
            }
        }
    }
};

const slidesSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "slides"],
    properties: {
        title: { type: "string" },
        slides: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["type", "title", "body"],
                properties: {
                    type: {
                        type: "string",
                        enum: ["cover", "content", "question", "instructions", "closing"]
                    },
                    title: { type: "string" },
                    subtitle: { type: "string" },
                    body: { type: "string" },
                    teacher_notes: { type: "string" },
                    image_prompt: { type: "string" },
                    layout: {
                        type: "string",
                        enum: ["stack", "split", "feature"]
                    }
                }
            }
        }
    }
};

const flashcardsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "cards"],
    properties: {
        title: { type: "string" },
        cards: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["front", "back"],
                properties: {
                    front: { type: "string" },
                    back: { type: "string" },
                    example: { type: "string" }
                }
            }
        }
    }
};

const memorySchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "pairs"],
    properties: {
        title: { type: "string" },
        pairs: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["front", "back"],
                properties: {
                    front: { type: "string" },
                    back: { type: "string" },
                    color: { type: "string" }
                }
            }
        }
    }
};

const matchSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "left_label", "right_label", "shuffle_right", "pairs"],
    properties: {
        title: { type: "string" },
        left_label: { type: "string" },
        right_label: { type: "string" },
        shuffle_right: { type: "boolean" },
        pairs: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["left", "right"],
                properties: {
                    left: { type: "string" },
                    right: { type: "string" },
                    color: { type: "string" }
                }
            }
        }
    }
};

const wheelSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "eliminate_used", "segments"],
    properties: {
        title: { type: "string" },
        eliminate_used: { type: "boolean" },
        segments: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["text"],
                properties: {
                    text: { type: "string" },
                    color: { type: "string" }
                }
            }
        }
    }
};

const mindmapSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "subtitle", "branches"],
    properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        branches: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "subtitle", "detail"],
                properties: {
                    title: { type: "string" },
                    subtitle: { type: "string" },
                    detail: { type: "string" },
                    color: { type: "string" }
                }
            }
        }
    }
};

const debateSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "question", "format", "side_a", "side_b", "steps"],
    properties: {
        title: { type: "string" },
        question: { type: "string" },
        format: { type: "string" },
        side_a: { type: "string" },
        side_b: { type: "string" },
        steps: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "time", "question", "guidance"],
                properties: {
                    title: { type: "string" },
                    time: { type: "string" },
                    question: { type: "string" },
                    guidance: { type: "string" }
                }
            }
        }
    }
};

function schemaFor(materialType) {
    if (materialType === "quiz") {
        return {
            name: "educaria_quiz",
            description: "Quiz estruturado para o builder da EducarIA",
            schema: quizSchema
        };
    }

    if (materialType === "slides") {
        return {
            name: "educaria_slides",
            description: "Slides estruturados para o builder da EducarIA",
            schema: slidesSchema
        };
    }

    if (materialType === "flashcards") {
        return {
            name: "educaria_flashcards",
            description: "Flashcards estruturados para o builder da EducarIA",
            schema: flashcardsSchema
        };
    }

    if (materialType === "memory") {
        return {
            name: "educaria_memory",
            description: "Jogo da memoria estruturado para o builder da EducarIA",
            schema: memorySchema
        };
    }

    if (materialType === "match") {
        return {
            name: "educaria_match",
            description: "Ligar pontos estruturado para o builder da EducarIA",
            schema: matchSchema
        };
    }

    if (materialType === "wheel") {
        return {
            name: "educaria_wheel",
            description: "Roleta estruturada para o builder da EducarIA",
            schema: wheelSchema
        };
    }

    if (materialType === "mindmap") {
        return {
            name: "educaria_mindmap",
            description: "Mapa mental estruturado para o builder da EducarIA",
            schema: mindmapSchema
        };
    }

    if (materialType === "debate") {
        return {
            name: "educaria_debate",
            description: "Debate guiado estruturado para o builder da EducarIA",
            schema: debateSchema
        };
    }

    return null;
}

function promptFor(materialType, action, sourceText) {
    if (materialType === "quiz") {
        return [
            "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compativel com o schema fornecido.",
            "O material deve ficar pronto para revisao rapida do professor, sem texto fora do JSON.",
            "Escreva em portugues do Brasil, com linguagem escolar clara, objetiva e natural.",
            "Se o texto ja trouxer perguntas, normalize a estrutura e complete apenas o que estiver faltando.",
            "Se o texto for expositivo, gere um quiz fiel ao conteudo enviado, sem inventar fatos desnecessarios.",
            "Prefira perguntas que verifiquem compreensao, relacao entre ideias e identificacao de conceitos centrais.",
            "Evite enunciados vagos, alternativas ambiguas e distracoes absurdas.",
            "Em multipla escolha, use 4 alternativas plausiveis e apenas uma correta.",
            "Em verdadeiro ou falso, escreva afirmacoes objetivas e verificaveis.",
            "Em pergunta aberta, produza criterio curto e resposta-modelo enxuta.",
            "A explicacao deve ajudar o professor a corrigir ou retomar o conteudo.",
            `Objetivo do professor: ${action || "Estruturar quiz a partir do material enviado."}`,
            "Regras adicionais:",
            "- Priorize clareza e aderencia ao texto-base.",
            "- Nao use tom publicitario nem linguagem excessivamente rebuscada.",
            "- Se o conteudo estiver incompleto, faca a melhor estrutura possivel sem sair do tema.",
            "- Respeite explicitamente a quantidade e o formato pedidos pelo professor quando isso for informado.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "flashcards") {
        return [
            "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compativel com o schema fornecido.",
            "Monte flashcards claros, curtos e uteis para memorizacao e revisao em sala.",
            "Escreva em portugues do Brasil, com linguagem escolar natural.",
            "Cada frente deve ser curta: termo, conceito, pergunta curta ou palavra-chave.",
            "Cada verso deve trazer resposta, definicao, traducao ou explicacao curta.",
            "Use example apenas quando realmente ajudar a fixacao.",
            "Evite textos longos, redundancia e exemplos genericos.",
            "Respeite rigorosamente os limites do card para caber bem na apresentacao.",
            "Limite da frente: ate 56 caracteres ou 8 palavras, o que vier primeiro.",
            "Limite do verso: ate 120 caracteres ou 18 palavras, o que vier primeiro.",
            "Limite do example: ate 140 caracteres ou 20 palavras, o que vier primeiro.",
            "Nao use frases truncadas, reticencias nem cortes artificiais.",
            "Se o professor enviar conteudo teorico, transforme em pares de estudo fieis ao texto-base.",
            `Objetivo do professor: ${action || "Estruturar flashcards a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de cards pedida quando ela for informada.",
            "- Prefira variedade de conceitos centrais, nao repeticoes.",
            "- Nao invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "memory") {
        return [
            "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compativel com o schema fornecido.",
            "Monte um jogo da memoria claro, rapido de jogar e fiel ao texto-base.",
            "Crie pares curtos, legiveis e bons para memorizacao em sala.",
            "Cada front deve ser breve: termo, pergunta curta, data, palavra-chave ou conceito.",
            "Cada back deve trazer a resposta correspondente, definicao curta ou associacao correta.",
            "Evite frases longas, pares redundantes ou conteudos vagos.",
            "Prefira conceitos centrais, datas importantes, relacoes diretas e vocabulario util.",
            "Se o texto-base trouxer listas ja associadas, preserve essa logica.",
            `Objetivo do professor: ${action || "Estruturar jogo da memoria a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de pares pedida quando ela for informada.",
            "- Cada lado do par deve caber bem em um card curto.",
            "- Nao invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "match") {
        return [
            "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compativel com o schema fornecido.",
            "Monte uma atividade de ligar pontos clara, curta e facil de aplicar em sala.",
            "Organize pares entre coluna A e coluna B com associacoes objetivas e corretas.",
            "Cada item deve ser curto e legivel em poucas palavras.",
            "Evite frases longas, ambiguidades ou pares muito parecidos entre si.",
            "Prefira conceito-definicao, evento-data, autor-obra, pais-capital ou relacoes equivalentes ao texto-base.",
            "Defina left_label e right_label de forma clara para o professor.",
            `Objetivo do professor: ${action || "Estruturar ligar pontos a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de pares pedida quando ela for informada.",
            "- Use shuffle_right true quando fizer sentido para a atividade.",
            "- Nao invente fatos fora do tema.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    if (materialType === "wheel") {
        return [
            "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compativel com o schema fornecido.",
            "Monte uma roleta editavel com itens curtos, claros e bons para sorteio em sala.",
            "Cada segmento deve ter um texto enxuto, facil de ler dentro da roleta.",
            "Prefira perguntas curtas, desafios rapidos, temas de revisao ou comandos objetivos.",
            "Evite segmentos longos, frases com varias ideias ou instrucoes vagas.",
            "Se o texto-base for teorico, transforme em itens de revisao ou provocacoes curtas.",
            `Objetivo do professor: ${action || "Estruturar roleta a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de espacos pedida quando ela for informada.",
            "- Cada segmento deve caber bem em uma fatia da roleta.",
            "- Nao invente fatos fora do tema.",
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
                "Modo selecionado pelo professor: organizar conceitos em topicos.",
                "Priorize estrutura conceitual e hierarquica.",
                "Cada branch deve representar um conceito central do tema.",
                "O subtitle deve nomear a ideia-chave do conceito.",
                "O detail deve explicar o conceito e trazer 2 a 4 bullets curtos quando isso ajudar."
            ]
            : normalizedAction.includes("resumir um tema")
                ? [
                    "Modo selecionado pelo professor: resumir um tema em mapa mental.",
                    "Priorize sintese e panorama geral.",
                    "Use menos detalhes e mais clareza global do assunto.",
                    "Cada branch deve resumir um eixo importante do tema.",
                    "O detail deve ser enxuto, sem excesso de aprofundamento."
                ]
                : normalizedAction.includes("revisao visual")
                    ? [
                        "Modo selecionado pelo professor: estruturar revisao visual.",
                        "Priorize memorizacao, revisao rapida e linguagem projetavel.",
                        "Cada branch deve funcionar bem como ponto de revisao.",
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
                    "Leitura desejada: topicos.",
                    "Crie progressao mais linear, com detalhes que funcionem bem como lista e revisao sequencial."
                ]
                : [];

        return [
            "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compativel com o schema fornecido.",
            "Monte um mapa mental didatico, claro e facil de revisar em tela.",
            "Crie um tema central, um subtitulo curto e topicos bem distribuidos.",
            "Cada branch deve ter titulo, subtitulo e um detail com uma explicacao breve e organizada.",
            "No detail, voce pode usar um pequeno paragrafo e bullets curtos separados por \\n quando isso ajudar.",
            "Evite topicos redundantes, vagos ou amplos demais.",
            "Prefira conceitos centrais, relacoes entre ideias e organizacao hierarquica simples.",
            ...approachInstructions,
            ...layoutInstructions,
            `Objetivo do professor: ${action || "Estruturar mapa mental a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite a quantidade de topicos pedida quando for informada.",
            "- O subtitulo de cada branch deve resumir a ideia-chave.",
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
                "Priorize escuta, participacao coletiva, aprofundamento e mediacao do professor."
            ]
            : normalizedAction.includes("formato desejado: grupos com mediacao")
                ? [
                    "Formato desejado: grupos com mediacao.",
                    "Estruture o debate para trabalho entre grupos, com comparacao de argumentos e mediacao docente."
                ]
                : [
                    "Formato desejado: dois lados.",
                    "Estruture o debate com contraste claro entre duas perspectivas."
                ];

        const assistanceInstructions = normalizedAction.includes("criar pergunta central e etapas")
            ? [
                "Modo de ajuda selecionado: criar pergunta central e etapas.",
                "Priorize uma pergunta principal forte, debatível e um roteiro muito claro de progressao."
            ]
            : normalizedAction.includes("transformar texto em discussao guiada")
                ? [
                    "Modo de ajuda selecionado: transformar texto em discussao guiada.",
                    "Priorize conducao do professor, retomada do texto-base e aprofundamento progressivo."
                ]
                : [
                    "Modo de ajuda selecionado: organizar roteiro de debate.",
                    "Busque equilibrio entre estrutura, pergunta central e mediacao."
                ];
        return [
            "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
            "Responda apenas em JSON compativel com o schema fornecido.",
            "Monte um debate guiado pronto para mediacao de professor.",
            "Crie um titulo, uma pergunta central forte, dois lados claros e um roteiro por etapas.",
            "As etapas devem ter titulo, tempo sugerido, pergunta da etapa e guidance curto.",
            "O guidance deve ajudar o professor a conduzir a discussao, nao repetir a pergunta.",
            "Evite polarizacoes artificiais ou formulacoes agressivas.",
            "Prefira perguntas debatíveis, adequadas ao ambiente escolar e ligadas ao conteudo-base.",
            ...formatInstructions,
            ...assistanceInstructions,
            `Objetivo do professor: ${action || "Estruturar debate guiado a partir do material enviado."}`,
            "Regras adicionais:",
            "- Respeite o numero de etapas e o formato pedidos pelo professor quando forem informados.",
            "- Os lados devem ser formulados de modo claro e compreensivel.",
            "- Cada etapa deve ter progressao logica: aquecimento, confronto de ideias, fechamento.",
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    return [
        "Voce e um assistente pedagogico de uma plataforma educacional brasileira.",
        "Responda apenas em JSON compativel com o schema fornecido.",
        "Monte slides em portugues do Brasil, prontos para uma aula real e para edicao rapida pelo professor.",
        "Quebre o conteudo em uma sequencia logica, didatica e enxuta.",
        "O texto visivel no slide deve ser curto, projetavel e facil de ler pela turma.",
        "Evite paragrafos longos, frases de efeito, cliches e tom generico de apresentacao corporativa.",
        "Prefira titulos claros, subtitulos uteis e corpo em topicos curtos.",
        "Regra forte de formatacao do body:",
        "- Escreva o body em 2 a 5 linhas curtas.",
        "- Quebre linhas com \\n.",
        "- Quando listar ideias, comece cada linha com '- '.",
        "- Cada linha deve ter uma unica ideia, de preferencia com ate 10 palavras.",
        "- Nao escreva paragrafos corridos no body.",
        "- Nao repita o titulo no body.",
        "Regra forte de composicao:",
        "- Slide de capa: 1 a 2 linhas no body.",
        "- Slides de conteudo: priorize bullets curtos.",
        "- Slide final: fechamento, sintese ou pergunta de revisao.",
        "Use teacher_notes para orientar a mediacao do professor sem repetir o que ja esta visivel no slide.",
        "Mantenha teacher_notes em 1 ou 2 frases curtas.",
        "Sugira image_prompt apenas quando a imagem realmente ajudar a compreensao do conteudo.",
        "Quando sugerir image_prompt, prefira descricoes visuais educativas, neutras e adequadas ao contexto escolar brasileiro.",
        "Organize a sequencia com comeco, desenvolvimento e fechamento.",
        `Objetivo do professor: ${action || "Estruturar slides a partir do material enviado."}`,
        "Regras adicionais:",
        "- Nao invente dados especificos que nao estejam sustentados pelo texto-base.",
        "- Se o conteudo estiver extenso, priorize as ideias centrais.",
        "- Se o texto estiver raso, mantenha a estrutura simples e honesta.",
        "- Evite excesso de slides; prefira concisao com progressao clara.",
        "- Respeite explicitamente quantidade de slides, nivel de detalhamento e preferencia de imagens quando o professor informar.",
        "Material de origem:",
        sourceText
    ].join("\n\n");
}

function splitIntoShortUnits(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .split(/\n|(?<=[.!?;:])\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .flatMap((item) => item.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean));
}

function trimWords(text, maxWords = 12) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
        return words.join(" ");
    }

    return `${words.slice(0, maxWords).join(" ")}...`;
}

function normalizeSlideBody(body, slideType) {
    const raw = String(body || "").trim();
    if (!raw) {
        return slideType === "cover" ? "Visao geral da aula" : "Conteudo principal";
    }

    const lines = raw
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const normalizedLines = (lines.length > 1 ? lines : splitIntoShortUnits(raw))
        .map((line) => line.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, slideType === "cover" ? 2 : 5)
        .map((line, index) => {
            const compact = trimWords(line, slideType === "cover" ? 9 : 11);
            if (slideType === "cover") {
                return compact;
            }

            return `- ${compact}`;
        });

    return normalizedLines.join("\n");
}

function normalizeSlidesMaterial(material) {
    if (!material || !Array.isArray(material.slides)) {
        return material;
    }

    return {
        ...material,
        slides: material.slides.map((slide, index, slides) => {
            const slideType = slide?.type || (index === 0 ? "cover" : index === slides.length - 1 ? "closing" : "content");
            const layout = slide?.image_prompt ? "split" : "stack";

            return {
                ...slide,
                type: slideType,
                body: normalizeSlideBody(slide?.body, slideType),
                teacher_notes: trimWords(slide?.teacher_notes || "", 22),
                layout
            };
        })
    };
}

function imagePromptForSlide({ title, subtitle, body, prompt }) {
    return [
        "Voce cria ilustracoes educativas para slides de professores no Brasil.",
        "Gere uma unica imagem horizontal, clara, ilustrativa e apropriada para contexto escolar.",
        "Evite texto dentro da imagem, marcas, interfaces, colagens confusas ou excesso de elementos.",
        "A imagem deve ajudar a explicar o conteudo do slide rapidamente.",
        "Prefira composicao limpa, foco evidente e visual didatico.",
        prompt ? `Pedido direto do professor/IA: ${prompt}` : "",
        title ? `Titulo do slide: ${title}` : "",
        subtitle ? `Subtitulo do slide: ${subtitle}` : "",
        body ? `Conteudo do slide: ${body}` : "",
        "Entregue apenas a imagem."
    ].filter(Boolean).join("\n\n");
}

async function extractTextFromFile(file) {
    if (!file) return "";

    const fileName = String(file.originalname || "").toLowerCase();

    if (file.mimetype === "text/plain" || fileName.endsWith(".txt")) {
        return file.buffer.toString("utf8");
    }

    if (fileName.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value || "";
    }

    if (fileName.endsWith(".pdf")) {
        const result = await pdfParse(file.buffer);
        return result.text || "";
    }

    return "";
}

app.get("/api/health", (_request, response) => {
    response.json({
        ok: true,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
});

app.post("/api/ai/generate", upload.single("file"), async (request, response) => {
    try {
        const materialType = String(request.body.materialType || "").trim();
        const action = String(request.body.action || "").trim();
        const schemaConfig = schemaFor(materialType);

        if (!schemaConfig) {
            return response.status(400).json({ error: "Tipo de material nao suportado." });
        }

        if (!gemini) {
            return response.status(503).json({ error: "GEMINI_API_KEY nao configurada no backend." });
        }

        const fileText = await extractTextFromFile(request.file);
        const sourceText = [request.body.sourceText, fileText]
            .filter(Boolean)
            .join("\n\n")
            .replace(/\u0000/g, "")
            .trim();

        if (!sourceText) {
            return response.status(400).json({ error: "Envie um texto-base ou arquivo suportado." });
        }

        const result = await gemini.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: promptFor(materialType, action, sourceText),
            config: {
                responseMimeType: "application/json",
                responseJsonSchema: {
                    ...schemaConfig.schema,
                    description: schemaConfig.description
                }
            }
        });

        const rawMaterial = JSON.parse(result.text || "{}");
        const material = materialType === "slides"
            ? normalizeSlidesMaterial(rawMaterial)
            : rawMaterial;
        return response.json({
            ok: true,
            materialType,
            material
        });
    } catch (error) {
        console.error("EducarIA AI service error:", error);
        return response.status(500).json({
            error: "Falha ao gerar material com IA.",
            detail: error instanceof Error ? error.message : "unknown_error"
        });
    }
});

app.post("/api/ai/generate-image", async (request, response) => {
    try {
        if (!gemini) {
            return response.status(503).json({ error: "GEMINI_API_KEY nao configurada no backend." });
        }

        const title = String(request.body.title || "").trim();
        const subtitle = String(request.body.subtitle || "").trim();
        const body = String(request.body.body || "").trim();
        const prompt = String(request.body.prompt || "").trim();

        if (!title && !subtitle && !body && !prompt) {
            return response.status(400).json({ error: "Envie contexto suficiente para gerar a imagem." });
        }

        const result = await gemini.models.generateContent({
            model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
            contents: imagePromptForSlide({ title, subtitle, body, prompt })
        });

        const parts = result?.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((part) => part.inlineData?.data);

        if (!imagePart?.inlineData?.data) {
            return response.status(502).json({
                error: "O Gemini nao retornou imagem para este slide."
            });
        }

        return response.json({
            ok: true,
            mimeType: imagePart.inlineData.mimeType || "image/png",
            imageBase64: imagePart.inlineData.data
        });
    } catch (error) {
        console.error("EducarIA image generation error:", error);
        return response.status(500).json({
            error: "Falha ao gerar imagem com IA.",
            detail: error instanceof Error ? error.message : "unknown_error"
        });
    }
});

app.listen(port, () => {
    console.log(`EducarIA AI service listening on http://localhost:${port}`);
});
