import { slideIllustrationSchema } from "../slide-illustration-policy.js";
import { discoverySchemas } from "./discovery.js";
import { worksheetSchema } from "./worksheet.js";
import { slideContentSchema } from "./slide-content.js";

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
    required: ["title", "visual_theme", "slides"],
    properties: {
        title: { type: "string" },
        visual_theme: {
            type: "object",
            additionalProperties: false,
            required: [
                "name",
                "rationale",
                "font",
                "accent",
                "secondary_accent",
                "background",
                "alternate_background",
                "text",
                "contrast_background",
                "contrast_text"
            ],
            properties: {
                name: { type: "string" },
                rationale: { type: "string" },
                font: {
                    type: "string",
                    enum: ["Destaque moderno", "Leitura limpa", "Serifada clássica"]
                },
                accent: { type: "string" },
                secondary_accent: { type: "string" },
                background: { type: "string" },
                alternate_background: { type: "string" },
                text: { type: "string" },
                contrast_background: { type: "string" },
                contrast_text: { type: "string" }
            }
        },
        slides: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["type", "title", "body", "visual_variant"],
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
                    illustration: slideIllustrationSchema,
                    visual_variant: {
                        type: "string",
                        enum: ["hero", "light", "alternate", "question", "contrast"]
                    },
                    layout: {
                        type: "string",
                        enum: ["stack", "split"]
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

const hangmanSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "subtitle", "entries"],
    properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        entries: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["answer", "clue", "category"],
                properties: {
                    answer: { type: "string" },
                    clue: { type: "string" },
                    category: { type: "string" }
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

const wordsearchSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "subtitle", "words"],
    properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        words: {
            type: "array",
            minItems: 2,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["term"],
                properties: {
                    term: { type: "string" },
                    clue: { type: "string" }
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
        format: { type: "string", enum: ["Dois lados", "Roda guiada"] },
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

const crosswordSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "subtitle", "entries"],
    properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        entries: {
            type: "array",
            minItems: 4,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["answer", "clue"],
                properties: {
                    answer: { type: "string" },
                    clue: { type: "string" }
                }
            }
        }
    }
};

// Explicit registry: unsupported keys must never fall through to another activity.
const materialSchemas = new Map([
    ["worksheet", { name: "educaria_worksheet", description: "Folha de atividades A4 para impressão", schema: worksheetSchema() }],
    ["wordtrail", { name: "educaria_wordtrail", description: "Trilha de Palavras para sala de aula", schema: discoverySchemas.wordtrail }],
    ["connections", { name: "educaria_connections", description: "O que há em comum? — pistas e conexões", schema: discoverySchemas.connections }],
    ["quiz", { name: "educaria_quiz", description: "Quiz estruturado para o builder da EducarIA", schema: quizSchema }],
    ["slides", { name: "educaria_slides", description: "Slides estruturados para o builder da EducarIA", schema: slidesSchema }],
    ["flashcards", { name: "educaria_flashcards", description: "Flashcards estruturados para o builder da EducarIA", schema: flashcardsSchema }],
    ["memory", { name: "educaria_memory", description: "Jogo da memória estruturado para o editor da EducarIA", schema: memorySchema }],
    ["hangman", { name: "educaria_hangman", description: "Jogo da força estruturado para o editor da EducarIA", schema: hangmanSchema }],
    ["match", { name: "educaria_match", description: "Ligar pontos estruturado para o builder da EducarIA", schema: matchSchema }],
    ["wheel", { name: "educaria_wheel", description: "Roleta estruturada para o builder da EducarIA", schema: wheelSchema }],
    ["wordsearch", { name: "educaria_wordsearch", description: "Caça-palavras estruturado para o editor da EducarIA", schema: wordsearchSchema }],
    ["mindmap", { name: "educaria_mindmap", description: "Mapa mental estruturado para o builder da EducarIA", schema: mindmapSchema }],
    ["debate", { name: "educaria_debate", description: "Debate guiado estruturado para o builder da EducarIA", schema: debateSchema }],
    ["crossword", { name: "educaria_crossword", description: "Palavras cruzadas estruturadas para o builder da EducarIA", schema: crosswordSchema }]
]);

/** Canonical activity keys accepted by the generation API (not browser routing). */
export const MATERIAL_TYPES = Object.freeze([...materialSchemas.keys()]);

/** Return a fresh provider config while preserving the existing schema contract. */
export function schemaFor(materialType, slideOptions, generationOptions) {
    const config = materialSchemas.get(materialType);
    if (!config) return null;
    if (materialType === "worksheet") return { ...config, schema: worksheetSchema(slideOptions) };
    if (materialType === "wordtrail" && slideOptions?.inputMode === "words" && slideOptions.answers?.length) {
        const schema = structuredClone(config.schema);
        schema.properties.words.minItems = slideOptions.answers.length;
        schema.properties.words.maxItems = slideOptions.answers.length;
        schema.properties.words.items.properties.term.enum = [...slideOptions.answers];
        return { ...config, schema };
    }
    if (materialType === "connections" && Number.isInteger(slideOptions?.clueCount)) {
        const schema = structuredClone(config.schema);
        schema.properties.rounds.items.properties.clues.minItems = slideOptions.clueCount;
        schema.properties.rounds.items.properties.clues.maxItems = slideOptions.clueCount;
        if (slideOptions.inputMode === "words" && slideOptions.answers?.length) {
            schema.properties.rounds.minItems = slideOptions.answers.length;
            schema.properties.rounds.maxItems = slideOptions.answers.length;
            schema.properties.rounds.items.properties.answer.enum = [...slideOptions.answers];
        }
        return { ...config, schema };
    }
    if (materialType === "slides" && (slideOptions?.includeIllustration === false || slideOptions?.visualMode === "ai" || generationOptions)) {
        const schema = structuredClone(config.schema);
        const slide = schema.properties.slides.items;
        if (slideOptions?.includeIllustration === false) {
            delete slide.properties.illustration;
            slide.required = slide.required.filter(key => key !== "illustration");
        }
        if (generationOptions) slide.properties.body = slideContentSchema(slideOptions, generationOptions);
        if (slideOptions?.visualMode === "ai") {
            slide.properties.composition = { type: "string", enum: ["editorial", "focus", "panels"] };
            slide.required.push("composition");
        }
        return { ...config, schema };
    }
    return { ...config };
}
