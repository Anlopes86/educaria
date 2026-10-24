import { normalizeGeneratedSlideIllustration } from "../slide-illustration-policy.js";

// Recovery is deliberately limited to complete slide JSON. Never use eval, try to
// close truncated JSON, create missing lesson text, or relax other activity schemas.
function matchesSchema(value, schema, depth = 0) {
    if (!schema || depth > 20) return false;
    if (schema.enum && !schema.enum.includes(value)) return false;
    if (schema.type === "string") return typeof value === "string" && (!schema.maxLength || value.length <= schema.maxLength);
    if (schema.type === "integer") return Number.isSafeInteger(value);
    if (schema.type === "number") return typeof value === "number" && Number.isFinite(value);
    if (schema.type === "boolean") return typeof value === "boolean";
    if (schema.type === "array") return Array.isArray(value)
        && value.length >= (schema.minItems || 0) && value.length <= (schema.maxItems ?? 100)
        && value.every(item => matchesSchema(item, schema.items, depth + 1));
    if (schema.type !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return false;
    const properties = schema.properties || {};
    // Match the provider's strict transport (all declared properties required),
    // not just the looser public schema used by legacy saved materials.
    return Object.keys(properties).every(key => Object.hasOwn(value, key))
        && Object.keys(value).every(key => Object.hasOwn(properties, key) && matchesSchema(value[key], properties[key], depth + 1));
}

export function recoverRejectedSlideResponse(text, schemaConfig) {
    if (schemaConfig?.name !== "educaria_slides" || typeof text !== "string" || text.length > 512_000) return null;
    let material;
    try { material = JSON.parse(text); } catch { return null; }
    if (!material || !Array.isArray(material.slides) || !material.slides.length || material.slides.length > 30) return null;
    if (typeof material.title !== "string" || !material.title.trim()) return null;
    if (material.slides.some(slide => !slide || typeof slide.title !== "string" || !slide.title.trim()
        || !(typeof slide.body === "string" ? slide.body.trim()
            : slide.body && typeof slide.body === "object" && !Array.isArray(slide.body)
                && Object.values(slide.body).some(value => typeof value === "string" && value.trim())))) return null;

    // Validate the actual contract, with exactly one exception: illustrations are
    // validated separately by the shared diagram model. This is not a JSON-mode fallback.
    const schema = structuredClone(schemaConfig.schema);
    const itemSchema = schema?.properties?.slides?.items;
    if (!itemSchema?.properties) return null;
    delete itemSchema.properties.illustration;
    itemSchema.required = (itemSchema.required || []).filter(key => key !== "illustration");
    const hasDrawingPlan = Object.hasOwn(schema.properties, "illustrations");
    if (hasDrawingPlan) {
        delete schema.properties.illustrations;
        schema.required = schema.required.filter(key => key !== "illustrations");
    }
    const content = { ...material, slides: material.slides.map(({ illustration, ...slide }) => slide) };
    if (hasDrawingPlan) delete content.illustrations;
    if (!matchesSchema(content, schema)) return null;

    // Preserve incomplete drawing plans for the normalizer/visible feedback, not
    // as a successful illustration. Recovering never incurs a second AI request.
    return { ...material, slides: material.slides.map(slide => ({ ...slide,
        illustration: normalizeGeneratedSlideIllustration(slide.illustration, slide.title)
    })) };
}
