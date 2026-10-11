(function (root) {
    "use strict";
    const escape = (value) => String(value).toWellFormed().replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

    function render(raw) {
        if (!raw || typeof raw.description !== "string" || !raw.description.trim() || !Array.isArray(raw.elements)) return null;
        const arities = { circle: 3, ring: 3, ellipse: 5, box: 5, line: 4, arrow: 4, label: 3 };
        const shapes = [];
        const gradients = [];
        let drawn = 0;
        // Validate again: drafts and recovered payloads are untrusted too.
        for (const element of raw.elements.slice(0, 32)) {
            const g = element?.geometry;
            if (!Object.hasOwn(arities, element?.kind) || !Array.isArray(g) || g.length !== arities[element.kind]) continue;
            if (!g.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 600)) continue;
            if (typeof element.color !== "string" || !/^#[\da-f]{6}$/i.test(element.color) || typeof element.text !== "string") continue;
            const [x, y, a, b, c] = g;
            const color = element.color;
            if (["circle", "ring", "ellipse"].includes(element.kind) && (a <= 0 || a > 280)) continue;
            if (element.kind === "ellipse" && (b <= 0 || b > 280 || c > 360)) continue;
            if (element.kind === "box" && (a <= 0 || b <= 0 || c > 80)) continue;
            switch (element.kind) {
                case "circle": {
                    const id = `sphere-${gradients.length}`;
                    gradients.push(`<radialGradient id="${id}" cx="30%" cy="25%" r="80%"><stop stop-color="#ffffff" stop-opacity=".65"/><stop offset=".4" stop-color="${color}"/><stop offset="1" stop-color="${color}"/></radialGradient>`);
                    shapes.push(`<circle cx="${x}" cy="${y}" r="${a}" fill="${color}"/><circle cx="${x}" cy="${y}" r="${a}" fill="url(#${id})" filter="url(#soft-shadow)"/>`);
                    break;
                }
                case "ring": shapes.push(`<circle cx="${x}" cy="${y}" r="${a}" fill="none" stroke="${color}" stroke-width="2" opacity=".65"/>`); break;
                case "ellipse": shapes.push(`<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" transform="rotate(${c} ${x} ${y})" fill="${color}"/>`); break;
                case "box": shapes.push(`<rect x="${x}" y="${y}" width="${a}" height="${b}" rx="${c}" fill="${color}" filter="url(#soft-shadow)"/>`); break;
                case "line": case "arrow": {
                    shapes.push(`<line x1="${x}" y1="${y}" x2="${a}" y2="${b}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`);
                    if (element.kind === "arrow" && (x !== a || y !== b)) {
                        const angle = Math.atan2(b - y, a - x);
                        const point = (offset) => `${a - 15 * Math.cos(angle + offset)},${b - 15 * Math.sin(angle + offset)}`;
                        shapes.push(`<polygon points="${a},${b} ${point(.45)} ${point(-.45)}" fill="${color}"/>`);
                    }
                    break;
                }
                case "label": {
                    if (a < 16 || a > 40 || !element.text.trim()) continue;
                    const label = element.text.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40);
                    const room = Math.max(1, Math.min(x, 600 - x) * 2 - 16);
                    const fit = label.length * a * .6 > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : "";
                    shapes.push(`<text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${a}" font-weight="600" text-anchor="middle"${fit}>${escape(label)}</text>`);
                    break;
                }
            }
            if (element.kind !== "label") drawn++;
        }
        if (!drawn) return null;
        const description = raw.description.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img"><title>${escape(description)}</title><defs><filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#102f35" flood-opacity=".16"/></filter>${gradients.join("")}</defs>${shapes.join("")}</svg>`;
        return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, description };
    }

    function resolveImage(material, slide, index) {
        const uploaded = index === 0 && typeof material?.cover_image === "string" && /^data:image\/(webp|png|jpeg);base64,/.test(material.cover_image) && material.cover_image.length <= 160 * 1024;
        if (uploaded) return { url: material.cover_image, description: "Imagem enviada pelo professor", mode: "Enviar imagem" };
        const enabled = material?.generation_options?.includeIllustration;
        const illustration = enabled === true || enabled === "true" ? render(slide?.illustration) : null;
        return illustration ? { ...illustration, mode: "Ilustração da IA" } : { url: "", description: "", mode: "Sem imagem" };
    }

    function feedback(material) {
        const enabled = material?.generation_options?.includeIllustration;
        if (enabled !== true && enabled !== "true") return "";
        if (Array.isArray(material?.slides) && material.slides.some((slide) => render(slide.illustration))) return "";
        return "O conteúdo foi criado, mas a IA não retornou uma ilustração válida desta vez. Você pode enviar uma imagem no editor.";
    }

    root.EducariaSlideIllustrations = Object.freeze({ render, resolveImage, feedback });
})(typeof window === "undefined" ? globalThis : window);
