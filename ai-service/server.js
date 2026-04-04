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
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

app.use(cors({ origin: allowedOrigin === "*" ? true : allowedOrigin }));
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
        "Prefira titulos claros, subtitulos uteis e corpo em topicos curtos quando fizer sentido.",
        "Use teacher_notes para orientar a mediacao do professor sem repetir o que ja esta visivel no slide.",
        "Sugira image_prompt apenas quando a imagem realmente ajudar a compreensao do conteudo.",
        "Quando sugerir image_prompt, prefira descricoes visuais educativas, neutras e adequadas ao contexto escolar brasileiro.",
        "Organize a sequencia com comeco, desenvolvimento e fechamento.",
        `Objetivo do professor: ${action || "Estruturar slides a partir do material enviado."}`,
        "Regras adicionais:",
        "- Nao invente dados especificos que nao estejam sustentados pelo texto-base.",
        "- Se o conteudo estiver extenso, priorize as ideias centrais.",
        "- Se o texto estiver raso, mantenha a estrutura simples e honesta.",
        "- Evite excesso de slides; prefira concisao com progressao clara.",
        "Material de origem:",
        sourceText
    ].join("\n\n");
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

        const material = JSON.parse(result.text || "{}");
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

app.listen(port, () => {
    console.log(`EducarIA AI service listening on http://localhost:${port}`);
});
