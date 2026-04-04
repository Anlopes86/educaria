import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import OpenAI from "openai";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 8787);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
            "Você organiza conteúdos para uma plataforma educacional brasileira.",
            "Responda em JSON estruturado compatível com o schema fornecido.",
            "Se o texto já trouxer perguntas, normalize e complete o que faltar.",
            "Se o texto for conteúdo expositivo, gere um quiz fiel ao material.",
            "Prefira linguagem clara, objetiva e apropriada para sala de aula.",
            `Objetivo do professor: ${action || "Estruturar quiz a partir do material enviado."}`,
            "Material de origem:",
            sourceText
        ].join("\n\n");
    }

    return [
        "Você organiza conteúdos para uma plataforma educacional brasileira.",
        "Responda em JSON estruturado compatível com o schema fornecido.",
        "Quebre o conteúdo em uma sequência lógica de slides curtos e projetáveis.",
        "Evite parágrafos longos na parte visível do slide.",
        "Sugira image_prompt apenas quando realmente ajudar a aula.",
        `Objetivo do professor: ${action || "Estruturar slides a partir do material enviado."}`,
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
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
    });
});

app.post("/api/ai/generate", upload.single("file"), async (request, response) => {
    try {
        const materialType = String(request.body.materialType || "").trim();
        const action = String(request.body.action || "").trim();
        const schemaConfig = schemaFor(materialType);

        if (!schemaConfig) {
            return response.status(400).json({ error: "Tipo de material não suportado." });
        }

        if (!openai) {
            return response.status(503).json({ error: "OPENAI_API_KEY não configurada no backend." });
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

        const result = await openai.responses.create({
            model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
            input: [
                {
                    role: "user",
                    content: promptFor(materialType, action, sourceText)
                }
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: schemaConfig.name,
                    description: schemaConfig.description,
                    schema: schemaConfig.schema,
                    strict: true
                }
            }
        });

        const material = JSON.parse(result.output_text || "{}");
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
