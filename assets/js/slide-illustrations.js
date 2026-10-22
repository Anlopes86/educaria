(function (root) {
    "use strict";
    const escape = (value) => String(value).toWellFormed().replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

    // Semantic layouts keep spacing and scientific geometry out of the model's hands.
    // Legacy shape drawings remain supported below for already saved materials.
    function guidedDrawing(raw) {
        const counts = { "solar-system": [9, 9], orbit: [4, 4], process: [2, 5], cycle: [3, 6], comparison: [2, 6] };
        if (!Object.hasOwn(counts, raw.layout)) return null;
        const [min, max] = counts[raw.layout];
        if (!Array.isArray(raw.labels) || raw.labels.length < min || raw.labels.length > max || raw.labels.some((label) => typeof label !== "string" || !label.trim() || label.length > 60)) return null;
        if (raw.layout === "comparison" && raw.labels.length % 2) return null;
        if (["solar-system", "orbit"].includes(raw.layout) && raw.labels.some((label) => label.length > 24)) return null;
        const labels = raw.labels.map((label) => label.replace(/[\u0000-\u001f]/g, " ").trim());
        const dark = ["solar-system", "orbit"].includes(raw.layout);
        const ink = dark ? "#edf5ff" : "#173c43";
        const colors = ["#a9d6c7", "#b4cce5", "#e9bc77", "#e9a78e", "#c2b5df", "#b9d9bd"];
        const parts = [`<rect width="600" height="600" rx="30" fill="${dark ? "#102a43" : "#f1f7f6"}"/>`];
        const defs = [];
        function text(value, x, y, width, size = 22, color = ink) {
            const limit = Math.max(5, Math.floor(width / (size * .64)));
            const words = String(value).split(/\s+/).flatMap((word) => word.match(new RegExp(`.{1,${limit}}`, "gu")) || []);
            const lines = [];
            for (const word of words) {
                if (!lines.length || lines.at(-1).length + word.length + 1 > limit) lines.push(word);
                else lines[lines.length - 1] += ` ${word}`;
            }
            parts.push(`<text fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="600" text-anchor="middle">${lines.map((line, i) => `<tspan x="${x}" y="${y + (i - (lines.length - 1) / 2) * size * 1.15}">${escape(line)}</tspan>`).join("")}</text>`);
        }
        function arrow(x, y, endX, endY, color = "#527f8c") {
            const angle = Math.atan2(endY - y, endX - x);
            const point = (offset) => `${endX - 13 * Math.cos(angle + offset)},${endY - 13 * Math.sin(angle + offset)}`;
            parts.push(`<path d="M${x} ${y} L${endX} ${endY}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/><polygon points="${endX},${endY} ${point(.5)} ${point(-.5)}" fill="${color}"/>`);
        }
        function sphere(x, y, radius, color, index, type = "") {
            const id = `guided-sphere-${index}`;
            defs.push(`<radialGradient id="${id}" cx="30%" cy="25%" r="75%"><stop stop-color="#fff6de"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".55"/></radialGradient><clipPath id="clip-${id}"><circle cx="${x}" cy="${y}" r="${radius}"/></clipPath>`);
            parts.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}"/><circle cx="${x}" cy="${y}" r="${radius}" fill="url(#${id})"/>`);
            if (type === "bands") parts.push(`<g clip-path="url(#clip-${id})" opacity=".4"><path d="M${x-radius} ${y-8} Q${x} ${y+4} ${x+radius} ${y-6} M${x-radius} ${y+12} Q${x} ${y+22} ${x+radius} ${y+10}" fill="none" stroke="#814d3d" stroke-width="8"/></g>`);
            if (type === "earth") parts.push(`<path d="M${x-12} ${y-15} l12 -3 8 10 -9 7 5 10 -8 7 -7 -11 3 -10 -8 -3Z" fill="#9cd2a3" clip-path="url(#clip-${id})"/>`);
            if (type === "saturn") parts.push(`<ellipse cx="${x}" cy="${y+5}" rx="${radius+19}" ry="10" transform="rotate(-22 ${x} ${y})" fill="none" stroke="#edcd93" stroke-width="7" opacity=".85"/>`);
        }
        if (dark) {
            for (let i = 0; i < 38; i++) parts.push(`<circle cx="${22 + (i * 137) % 556}" cy="${20 + (i * 79) % 545}" r="${i % 3 ? 1 : 1.8}" fill="#d3e7f6" opacity=".25"/>`);
        }
        if (raw.layout === "solar-system") {
            parts.push('<circle cx="300" cy="95" r="65" fill="#f2b85b" opacity=".08"/><circle cx="300" cy="95" r="55" fill="#f2b85b" opacity=".12"/>');
            sphere(300, 95, 43, "#f6b54d", "sun"); text(labels[0], 300, 170, 240, 24);
            const planetColors = ["#b9b1a8", "#e9be81", "#4f9bcd", "#d58165", "#dbb38a", "#dbc290", "#8bcaca", "#608bda"];
            const sizes = [16, 23, 24, 19, 34, 29, 26, 25];
            labels.slice(1).forEach((label, index) => {
                const x = 84 + (index % 4) * 144, y = index < 4 ? 250 : 430;
                parts.push(`<rect x="${x-65}" y="${y-58}" width="130" height="139" rx="20" fill="#ffffff" opacity=".035"/>`);
                sphere(x, y, sizes[index], planetColors[index], index, index === 2 ? "earth" : index === 4 ? "bands" : index === 5 ? "saturn" : "");
                text(`${index + 1}`, x, y - 40, 100, 16, "#a8c4d7");
                text(label, x, y + 57, 125, 18);
            });
        } else if (raw.layout === "orbit") {
            // Ellipse focus at the star. At the right-hand vertex the tangent is vertical.
            parts.push('<ellipse cx="300" cy="300" rx="220" ry="207" fill="none" stroke="#8daebf" stroke-width="2" stroke-dasharray="6 7"/>');
            sphere(225, 300, 39, "#f6b54d", "sun"); sphere(520, 300, 20, "#4f9bcd", "earth", "earth");
            arrow(490, 300, 290, 300, "#e9a78e"); arrow(520, 267, 520, 158, "#a9d6c7");
            text(labels[0], 225, 368, 140, 23); text(labels[1], 509, 348, 140, 22);
            text(labels[2], 386, 275, 190, 20, "#f1bea9"); text(labels[3], 451, 137, 240, 20, "#b9e4d3");
        } else if (raw.layout === "process") {
            const height = 430 / labels.length;
            labels.forEach((label, i) => {
                const y = 54 + i * height;
                parts.push(`<rect x="52" y="${y+5}" width="496" height="${height-22}" rx="18" fill="#173c43" opacity=".07"/><rect x="52" y="${y}" width="496" height="${height-22}" rx="18" fill="${colors[i]}"/>`);
                text(`${i+1}`, 84, y+(height-22)/2+7, 42, 22); text(label, 324, y+(height-22)/2+7, 405, labels.length > 3 ? 18 : 24);
                if (i < labels.length-1) arrow(300, y+height-17, 300, y+height-5);
            });
        } else if (raw.layout === "comparison") {
            const rows = labels.length / 2, height = 450 / rows;
            labels.forEach((label, i) => {
                const x = i % 2 ? 312 : 28, y = 45 + Math.floor(i / 2) * height;
                parts.push(`<rect x="${x}" y="${y+5}" width="260" height="${height-20}" rx="22" fill="#173c43" opacity=".08"/><rect x="${x}" y="${y}" width="260" height="${height-20}" rx="22" fill="${colors[i % 2]}"/>`);
                text(label, x+130, y+(height-20)/2+7, 225, 22);
            });
        } else {
            const points = labels.map((_, i) => { const angle = -Math.PI/2 + i*2*Math.PI/labels.length; return [300+190*Math.cos(angle), 285+190*Math.sin(angle)]; });
            points.forEach(([x, y], i) => {
                const [nextX, nextY] = points[(i+1)%points.length], dx=nextX-x, dy=nextY-y;
                const start = Math.max(Math.abs(dx)/86, Math.abs(dy)/60);
                arrow(x+dx/start, y+dy/start, nextX-dx/start, nextY-dy/start);
            });
            points.forEach(([x, y], i) => {
                parts.push(`<rect x="${x-79}" y="${y-53}" width="158" height="112" rx="24" fill="#173c43" opacity=".08"/><rect x="${x-79}" y="${y-58}" width="158" height="112" rx="24" fill="${colors[i]}"/>`);
                text(labels[i], x, y+4, 144, labels[i].length > 40 ? 16 : 18);
            });
        }
        const caption = typeof raw.caption === "string" ? raw.caption.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 100) : "";
        text(caption || (dark ? "Representação esquemática • fora de escala" : ""), 300, 563, 520, 16, dark ? "#b4cbd9" : "#527078");
        return `<defs>${defs.join("")}</defs>${parts.join("")}`;
    }

    function render(raw, theme) {
        if (raw?.version === 2) return root.EducariaSlideDiagramRenderer?.render(raw, theme) || null;
        if (!raw || typeof raw.description !== "string" || !raw.description.trim() || !Array.isArray(raw.elements)) return null;
        const guided = guidedDrawing(raw);
        if (["solar-system", "orbit", "process", "cycle", "comparison"].includes(raw.layout) && !guided) return null;
        if (guided) {
            const description = raw.description.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img"><title>${escape(description)}</title>${guided}</svg>`;
            return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, description };
        }
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
        const theme = material?.visual_mode === "ai" ? material.visual_theme : null;
        const illustration = enabled === true || enabled === "true" ? render(slide?.illustration, theme) : null;
        return illustration ? { ...illustration, mode: "Ilustração da IA", diagramData: root.EducariaSlideDiagramEditing?.encode(slide.illustration, illustration.url, theme) || "" } : { url: "", description: "", mode: "Sem imagem" };
    }

    function feedback(material) {
        const enabled = material?.generation_options?.includeIllustration;
        if (enabled !== true && enabled !== "true") return "";
        const slides = Array.isArray(material?.slides) ? material.slides : [];
        const needsImage = [], invalid = [];
        slides.forEach((slide, index) => {
            if (resolveImage(material, slide, index).url) return;
            if (slide?.illustration?.status === "needs-image") needsImage.push(index + 1);
            else if (slide?.illustration?.status === "invalid" || slide?.illustration?.status === "ready") invalid.push(index + 1);
        });
        const messages = [];
        if (needsImage.length) messages.push(`O pedido visual dos slides ${needsImage.join(", ")} exige uma imagem mais detalhada do que os diagramas disponíveis. O conteúdo foi mantido; você pode enviar uma imagem própria no editor.`);
        if (invalid.length) messages.push(`Não foi possível montar uma ilustração legível nos slides ${invalid.join(", ")}. O conteúdo foi mantido, sem inserir um desenho incompleto.`);
        if (messages.length) return messages.join(" ");
        if (slides.some((slide, index) => resolveImage(material, slide, index).url)) return "";
        return "O conteúdo foi criado, mas a IA não retornou uma ilustração válida desta vez. Você pode enviar uma imagem no editor.";
    }

    root.EducariaSlideIllustrations = Object.freeze({ render, resolveImage, feedback });
})(typeof window === "undefined" ? globalThis : window);
