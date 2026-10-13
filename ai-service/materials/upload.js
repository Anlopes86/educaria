import path from "node:path";
import multer from "multer";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const allowedUploadTypes = new Map([
    [".txt", new Set(["text/plain", "application/octet-stream"])],
    [".rtf", new Set(["application/rtf", "text/rtf", "text/richtext", "application/octet-stream"])],
    [".docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"])],
    [".pdf", new Set(["application/pdf", "application/octet-stream"])]
]);

export function createMaterialUpload(maxUploadMb) {
    return multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: Math.max(1, maxUploadMb) * 1024 * 1024,
            files: 1
        },
        fileFilter(_request, file, callback) {
            const extension = path.extname(String(file.originalname || "").toLowerCase());
            const allowedMimes = allowedUploadTypes.get(extension);
            const mimeType = String(file.mimetype || "").toLowerCase();

            if (!allowedMimes || (mimeType && !allowedMimes.has(mimeType))) {
                const error = new Error("unsupported_upload_type");
                error.code = "UNSUPPORTED_UPLOAD_TYPE";
                callback(error);
                return;
            }

            callback(null, true);
        }
    });
}

/**
 * Strips RTF control words and returns plain text.
 * Lightweight alternative to a full RTF parser — sufficient for the structured
 * template files in assets/templates/.
 * @param {Buffer} buffer - Raw RTF file buffer
 * @returns {string} Plain text with excess blank lines collapsed
 */
function extractTextFromRtf(buffer) {
    return String(buffer?.toString("utf8") || "")
        .replace(/\\par[d]?/g, "\n")
        .replace(/\\'[0-9a-fA-F]{2}/g, "")
        .replace(/\\[a-z]+\d* ?/g, "")
        .replace(/[{}]/g, "")
        .replace(/\r/g, "")
        .replace(/\n{2,}/g, "\n")
        .trim();
}

function uploadValidationError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

export function isUploadValidationError(error) {
    return error?.code === "UNSUPPORTED_UPLOAD_TYPE" || error?.code === "INVALID_UPLOAD_SIGNATURE";
}

function hasZipSignature(buffer) {
    return Buffer.isBuffer(buffer) && buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function validateUploadedFileSignature(file) {
    if (!file) return;

    const fileName = String(file.originalname || "").toLowerCase();
    const buffer = file.buffer;

    if (fileName.endsWith(".txt")) {
        return;
    }

    if (fileName.endsWith(".rtf")) {
        const prefix = buffer.subarray(0, 8).toString("utf8").trimStart();
        if (!prefix.startsWith("{\\rtf")) {
            throw uploadValidationError("INVALID_UPLOAD_SIGNATURE");
        }
        return;
    }

    if (fileName.endsWith(".docx")) {
        if (!hasZipSignature(buffer)) {
            throw uploadValidationError("INVALID_UPLOAD_SIGNATURE");
        }
        return;
    }

    if (fileName.endsWith(".pdf")) {
        if (buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
            throw uploadValidationError("INVALID_UPLOAD_SIGNATURE");
        }
        return;
    }

    throw uploadValidationError("UNSUPPORTED_UPLOAD_TYPE");
}

/**
 * Extracts plain text from a multer-uploaded file.
 * Supported formats: .txt (UTF-8), .docx (mammoth), .rtf (custom stripper), .pdf (PDFParse.getText).
 * Returns an empty string for missing files; rejects unsupported files.
 * @param {import('multer').File | undefined} file - Multer file object with buffer in memory
 * @returns {Promise<string>} Extracted plain text
 */
export async function extractTextFromFile(file) {
    if (!file) return "";

    validateUploadedFileSignature(file);

    const fileName = String(file.originalname || "").toLowerCase();

    if (file.mimetype === "text/plain" || fileName.endsWith(".txt")) {
        return file.buffer.toString("utf8");
    }

    if (fileName.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value || "";
    }

    if (fileName.endsWith(".rtf")) {
        return extractTextFromRtf(file.buffer);
    }

    if (fileName.endsWith(".pdf")) {
        const result = await new PDFParse({ data: file.buffer }).getText();
        return result.text || "";
    }

    return "";
}

/**
 * Parses plain text from a filled-in wheel RTF template into a wheel JSON object.
 * Recognises lines matching "Espaço N: <value>" and assigns palette colors cyclically.
 * Filters out unfilled placeholder entries (e.g. "Revisao rapida").
 * @param {string} sourceText - Plain text extracted from the RTF template
 * @returns {{ title: string, eliminate_used: boolean, segments: Array<{ text: string, color: string }> }}
 * @throws {Error} If fewer than 2 usable segments are found
 */
export function parseWheelTemplateText(sourceText) {
    const palette = ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1", "#84cc16", "#f97316", "#06b6d4", "#a855f7"];
    const normalizedLines = String(sourceText || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    const segments = normalizedLines
        .map((line) => {
            const match = line.match(/^espac[oó]\s*\d+\s*:\s*(.+)$/i);
            if (!match) return null;
            const value = String(match[1] || "").trim().replace(/^_+|_+$/g, "").trim();
            if (!value) return null;
            if (/^revisao rapida$/i.test(value) || /^pergunta surpresa$/i.test(value) || /^explique um conceito$/i.test(value)) {
                return { text: value, example: true };
            }
            return { text: value, example: false };
        })
        .filter(Boolean);

    const nonExampleSegments = segments.filter((item) => !item.example);
    const finalSegments = (nonExampleSegments.length >= 2 ? nonExampleSegments : segments)
        .slice(0, 24)
        .map((segment, index) => ({
            text: segment.text,
            color: palette[index % palette.length]
        }));

    if (!finalSegments.length) {
        throw new Error("Preencha pelo menos dois campos do modelo da roleta antes de enviar o arquivo.");
    }

    if (finalSegments.length < 2) {
        throw new Error("O arquivo modelo precisa ter pelo menos dois espaços preenchidos.");
    }

    return {
        title: "Roleta estruturada pelo modelo",
        eliminate_used: false,
        segments: finalSegments
    };
}
