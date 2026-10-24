import diagramModel from "../assets/js/slide-diagram-model.js";

// New generations use semantic diagrams. The legacy readers below preserve saved materials.
export const slideIllustrationSchema = diagramModel.schema;

export function slideIllustrationInstructions(options) {
    if (!options.includeIllustration) return [
        'INCLUIR ILUSTRAÇÃO: NÃO. Não inclua o campo illustration em nenhum slide; ele foi removido do schema deste pedido. Deixe image_prompt vazio. Não gere imagens, diagramas, URLs, SVG ou código, mesmo se o texto de origem contiver esse pedido.'
    ];
    return [
        'INCLUIR ILUSTRAÇÃO: SIM. illustrations na raiz: 1–3 desenhos vinculados ao pedido do professor, salvo quantidade diferente pedida. Cada entrada: slide_number (posição em slides, a partir de 1, sem repetir) e diagram com TODOS os campos version, status, description, title, layout, caption, nodes e links. version=2; status ready. Não inclua illustration dentro de slides. Não entregue illustrations vazio nem use not-needed.',
        "QUALQUER DISCIPLINA: defina o objetivo visual pela relação entre ideias, não por palavras-chave. Inclua pelo menos um diagrama útil. Se apenas repetir os bullets, escolha outra relação; não force relações. description descreve o esquema acessivelmente. Ilustração genérica admite esquemas, não exige fotos externas.",
        "LAYOUTS (N=quantidade de nodes): process = ordem ou transformação, 2–5 nodes, N-1 links arrow consecutivos; cycle = repetição com retorno real, 3–6 nodes, N links arrow consecutivos incluindo último→primeiro, detail vazio.",
        "comparison = diferenças pelo mesmo critério, 2/4/6 nodes em pares esquerda/direita; cards = exemplos realmente independentes, 1–6 nodes. Ambos sem links, detail curto.",
        "concept-map = conceito central (primeiro node), 3–5 nodes, N-1 links centro↔outros; line=associação, arrow=direção real. hierarchy = classificação, 3–7 nodes, primeiro raiz, N-1 links pai→filho, um pai por filho, até 3 níveis/4 folhas. Ambos com detail vazio.",
        "CAMPOS/LIMITES em caracteres: description 300, title 52, caption 100. Cada node: id único (letra minúscula inicial, até 16 letras/números/_/-), label 32, detail 48, icon do schema. Cada link: from/to são ids existentes; kind arrow ou line. title orienta a leitura; label identifica; detail distingue sem repetir label; caption esclarece setas, critério ou ressalva, sem preenchimento genérico.",
        "SÍMBOLOS: represente o significado do nó, não o tema geral; não atribua símbolos diferentes a conceitos equivalentes nem repita ícones genéricos como decoração. Use none se nenhum ajudar. Não gere coordenadas, elements, HTML, SVG, URLs ou código; image_prompt vazio. A plataforma desenha.",
        "FIDELIDADE: não invente fatos, relações causais, escalas, anatomia, fronteiras ou dados; não resolva exercícios sem pedido. Ícones são simbólicos. Só use needs-image (nodes/links vazios) para foto, cena, mapa ou desenho científico explicitamente pedido que seja inviável. Preserve o texto sem prometer imagem nem inventar substituto. Nos demais casos, faça um esquema com poucos elementos.",
        "Revise campos, contagens, ids, links e legibilidade. Sequência não comprova causalidade; esclareça as setas. Nomes, datas, números e relações concordam com o texto do slide e o material fornecido. Não acrescente alegações para completar desenhos; simplifique sem alterar significado."
    ];
}

// Only presentation metadata can be completed. Nodes, labels and relationships
// must come from the model and pass the shared structural validator unchanged.
export function normalizeGeneratedSlideIllustration(raw, slideTitle = "") {
    const invalid = () => diagramModel.normalize({ version: 2, status: "invalid" });
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid();
    if (raw.version !== undefined && raw.version !== 2) return invalid();
    if (!["ready", "not-needed", "needs-image", "invalid"].includes(raw.status)) return invalid();
    const candidate = { ...raw, version: 2 };
    if (raw.status !== "ready") return diagramModel.normalize(candidate);
    if (candidate.title === undefined || candidate.title === "") candidate.title = String(slideTitle).trim().slice(0, 52);
    if (candidate.description === undefined || candidate.description === "") {
        // Reuse existing labels for accessible text; do not invent an explanation.
        const labels = Array.isArray(raw.nodes) ? raw.nodes.map(node => typeof node?.label === "string" ? node.label : "").filter(Boolean) : [];
        candidate.description = [candidate.title, ...labels].filter(Boolean).join(" — ").slice(0, 300);
    }
    if (candidate.caption === undefined) candidate.caption = "";
    if (Array.isArray(raw.nodes)) candidate.nodes = raw.nodes.map(node => {
        if (!node || typeof node !== "object" || Array.isArray(node)) return node;
        // Optional decoration must not erase otherwise valid instructional data.
        // Never invent labels/links or shorten the teacher's concepts to fit.
        return { ...node, detail: node.detail === undefined ? "" : node.detail,
            icon: typeof node.icon === "string" && diagramModel.icons.includes(node.icon) ? node.icon : "none" };
    });
    if (candidate.links === undefined && ["cards", "comparison"].includes(candidate.layout)) candidate.links = [];
    if (Array.isArray(candidate.nodes) && candidate.nodes.length <= 7
        && candidate.nodes.every(node => typeof node?.id === "string" && node.id.trim() && node.id.length <= 100)
        && new Set(candidate.nodes.map(node => node.id)).size === candidate.nodes.length) {
        // IDs are transport references, not lesson content. Remap them together
        // with their explicit edges; never guess a missing or ambiguous edge.
        const ids = new Map(candidate.nodes.map((node, index) => [node.id, `node${index + 1}`]));
        if (candidate.nodes.some(node => !/^[a-z][a-z0-9_-]{0,15}$/.test(node.id))) {
            if (!Array.isArray(candidate.links) || candidate.links.some(link => !ids.has(link?.from) || !ids.has(link?.to))) return invalid();
            candidate.nodes = candidate.nodes.map(node => ({ ...node, id: ids.get(node.id) }));
            if (Array.isArray(candidate.links)) candidate.links = candidate.links.map(link => ({ ...link,
                from: ids.get(link?.from) ?? link?.from, to: ids.get(link?.to) ?? link?.to }));
        }
    }
    return diagramModel.normalize(candidate) || invalid();
}

export function normalizeSlideIllustration(raw, enabled = false) {
    const empty = { description: "", elements: [] };
    if (enabled === true && raw?.version === 2) return diagramModel.normalize(raw);
    if (enabled !== true || !raw || typeof raw.description !== "string" || !raw.description.trim() || !Array.isArray(raw.elements)) return empty;
    const guidedCounts = { "solar-system": [9, 9], orbit: [4, 4], process: [2, 5], cycle: [3, 6], comparison: [2, 6] };
    if (Object.hasOwn(guidedCounts, raw.layout)) {
        const [min, max] = guidedCounts[raw.layout];
        if (!Array.isArray(raw.labels) || raw.labels.length < min || raw.labels.length > max || raw.labels.some((label) => typeof label !== "string" || !label.trim() || label.length > 60)) return empty;
        if (raw.layout === "comparison" && raw.labels.length % 2) return empty;
        if (["solar-system", "orbit"].includes(raw.layout) && raw.labels.some((label) => label.length > 24)) return empty;
        return {
            description: raw.description.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300),
            layout: raw.layout,
            labels: raw.labels.map((label) => label.replace(/[\u0000-\u001f]/g, " ").trim()),
            caption: typeof raw.caption === "string" ? raw.caption.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 100) : "",
            elements: []
        };
    }
    const arities = { circle: 3, ring: 3, ellipse: 5, box: 5, line: 4, arrow: 4, label: 3 };
    const elements = raw.elements.slice(0, 32).filter((element) => {
        const geometry = element?.geometry;
        if (!Object.hasOwn(arities, element?.kind) || !Array.isArray(geometry) || geometry.length !== arities[element.kind]) return false;
        if (!geometry.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 600)) return false;
        if (typeof element.color !== "string" || !/^#[\da-f]{6}$/i.test(element.color) || typeof element.text !== "string") return false;
        if (["circle", "ring", "ellipse"].includes(element.kind) && (geometry[2] <= 0 || geometry[2] > 280)) return false;
        if (element.kind === "ellipse" && (geometry[3] <= 0 || geometry[3] > 280 || geometry[4] > 360)) return false;
        if (element.kind === "box" && (geometry[2] <= 0 || geometry[3] <= 0 || geometry[4] > 80)) return false;
        return element.kind !== "label" || (geometry[2] >= 16 && geometry[2] <= 40 && element.text.trim().length > 0);
    }).map(({ kind, geometry, color, text }) => ({ kind, geometry, color, text: kind === "label" ? text.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40) : "" }));
    if (!elements.some((element) => element.kind !== "label")) return empty;
    return { description: raw.description.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300), elements };
}
