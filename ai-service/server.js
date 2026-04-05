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
