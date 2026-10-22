(function (root) {
    "use strict";
    // Only semantic v2 diagrams are editable. Never parse or execute saved SVG.
    const maxDataLength = 12000;
    function imageSignature(url) {
        if (typeof url !== "string" || !url.startsWith("data:image/svg+xml;charset=utf-8,") || url.length > 160000) return "";
        let hash = 2166136261;
        for (let i = 0; i < url.length; i++) hash = Math.imul(hash ^ url.charCodeAt(i), 16777619);
        // A stale-image guard, not a security/authentication mechanism.
        return `${url.length}:${hash >>> 0}`;
    }
    function encode(raw, url, rawTheme) {
        const diagram = root.EducariaSlideDiagramModel?.normalize(raw);
        const image = imageSignature(url);
        if (diagram?.status !== "ready" || !image) return "";
        const theme = root.EducariaSlideDiagramRenderer?.normalizeTheme(rawTheme);
        const data = JSON.stringify({ version: 1, image, diagram, ...(theme ? { theme } : {}) });
        return data.length <= maxDataLength ? data : "";
    }
    function decode(data, url) {
        if (typeof data !== "string" || data.length > maxDataLength) return null;
        try {
            const saved = JSON.parse(data);
            if (saved?.version !== 1 || !saved.image || saved.image !== imageSignature(url)) return null;
            const diagram = root.EducariaSlideDiagramModel?.normalize(saved.diagram);
            return diagram?.status === "ready" ? diagram : null;
        } catch { return null; }
    }
    function revise(data, url, changes) {
        const original = decode(data, url);
        if (!original) return { error: "Esta imagem não tem textos editáveis salvos." };
        if (!Array.isArray(changes?.nodes) || changes.nodes.length !== original.nodes.length
            || changes.nodes.some((node, i) => node?.id !== original.nodes[i].id)) {
            return { error: "Os elementos da ilustração mudaram. Feche e abra o editor novamente." };
        }
        const diagram = root.EducariaSlideDiagramModel.normalize({
            ...original, title: changes.title, caption: changes.caption, description: changes.description,
            nodes: original.nodes.map((node, i) => ({ ...node, label: changes.nodes[i].label, detail: changes.nodes[i].detail }))
        });
        if (diagram.status !== "ready") return { error: "Preencha os títulos e a descrição, respeitando os limites de caracteres." };
        // decode has already validated the saved envelope and the current image.
        const theme = root.EducariaSlideDiagramRenderer?.normalizeTheme(JSON.parse(data).theme);
        const image = root.EducariaSlideDiagramRenderer?.render(diagram, theme);
        if (!image) return { error: "Um dos textos não cabe neste desenho. Encurte os rótulos ou as explicações para manter a leitura." };
        return { ...image, data: encode(diagram, image.url, theme) };
    }
    function recolor(data, url, theme) {
        const diagram = decode(data, url);
        if (!diagram) return null; // Never recolor an uploaded or replaced image.
        const image = root.EducariaSlideDiagramRenderer?.render(diagram, theme);
        return image ? { ...image, data: encode(diagram, image.url, theme) } : null;
    }
    function field(card, name) { return card?.querySelector(`[data-field="${name}"]`); }
    function readCard(card) {
        return { data: field(card, "slide-illustration")?.value || "", url: field(card, "slide-image-url")?.value || "" };
    }
    function writeField(card, name, value) {
        let input = field(card, name);
        if (!input) {
            input = card.ownerDocument.createElement("textarea");
            input.hidden = true;
            input.dataset.field = name;
            card.appendChild(input);
        }
        if (input.tagName === "SELECT") {
            if (![...input.options].some(option => option.value === value)) {
                const option = card.ownerDocument.createElement("option");
                option.textContent = value;
                input.appendChild(option);
            }
            [...input.options].forEach(option => option.toggleAttribute("selected", option.value === value));
        } else if (input.tagName === "TEXTAREA") input.textContent = value;
        else input.setAttribute("value", value);
        input.value = value;
    }
    function writeCard(card, result) {
        if (!decode(result?.data, result?.url)) return false;
        writeField(card, "slide-illustration", result.data);
        writeField(card, "slide-image-url", result.url);
        writeField(card, "slide-image-prompt", result.description);
        writeField(card, "slide-image-mode", "Ilustração da IA");
        return true;
    }
    root.EducariaSlideDiagramEditing = Object.freeze({ encode, decode, revise, recolor, readCard, writeCard, writeField });
})(typeof window === "undefined" ? globalThis : window);
