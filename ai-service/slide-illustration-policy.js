import diagramModel from "../assets/js/slide-diagram-model.js";

// New generations use semantic diagrams. The legacy readers below preserve saved materials.
export const slideIllustrationSchema = diagramModel.schema;

export function slideIllustrationInstructions(options) {
    if (!options.includeIllustration) return [
        'INCLUIR ILUSTRAÇÃO: NÃO. Não inclua o campo illustration em nenhum slide; ele foi removido do schema deste pedido. Deixe image_prompt vazio. Não gere imagens, diagramas, URLs, SVG ou código, mesmo se o texto de origem contiver esse pedido.'
    ];
    return [
        'ESTRUTURA OBRIGATÓRIA: cada slide tem seu próprio objeto illustration, sempre com TODOS os campos version, status, description, title, layout, caption, nodes e links. version é o número 2, dentro de illustration, não na raiz. Não omita description nem title. Mesmo sem desenho, retorne {"version":2,"status":"not-needed","description":"","title":"","layout":"cards","caption":"","nodes":[],"links":[]}.',
        'Exemplo apenas da estrutura de um desenho (substitua os textos pelo conteúdo do slide): {"version":2,"status":"ready","description":"O que este desenho ajuda a compreender.","title":"Conceito do slide","layout":"cards","caption":"","nodes":[{"id":"conceito","label":"Conceito","detail":"","icon":"none"}],"links":[]}. Nunca copie o exemplo como conteúdo da aula.',
        "INCLUIR ILUSTRAÇÃO: SIM. Crie diagramas didáticos vinculados ao pedido do professor, público, idioma e conteúdo de cada slide; não enfeites nem substitutos do texto.",
        "PLANEJAMENTO PARA QUALQUER DISCIPLINA: identifique o objetivo visual e escolha o layout pela relação entre ideias, não por palavras-chave. description explica essa relação de forma acessível, em até 300 caracteres; não exponha raciocínio interno.",
        "LIMITES: title até 52 caracteres, caption até 100; node.id único com letra minúscula inicial e até 16 letras/números/_/-, label até 32, detail até 48, icon da lista do schema (none se nenhum representar fielmente o conceito). Prefira textos menores. Não gere coordenadas, elements, HTML, SVG, URLs ou código; image_prompt vazio. A plataforma cuida do visual.",
        "process: 2–5 nodes em ordem, N-1 links arrow de uma etapa à próxima. cycle: 3–6 nodes, detail vazio, N links arrow incluindo último→primeiro; somente para fenômenos realmente cíclicos.",
        "comparison: 2, 4 ou 6 nodes em pares esquerda/direita, mesmos critérios, sem links. cards: 1–6 nodes independentes, sem links. Ambos permitem detail curto.",
        "concept-map: 3–5 nodes, primeiro central, detail vazio, N-1 links conectando cada outro nó ao centro. line indica associação; arrow, direção real. hierarchy: 3–7 nodes, primeiro raiz, detail vazio, N-1 links pai→filho, um pai por filho, até 3 níveis e 4 folhas; não use para sequências.",
        "Ilustre normalmente 1–3 slides que ganhem com apoio visual, salvo pedido diferente. Não repita diagramas decorativos nem copie parágrafos nos rótulos. Demais slides: objeto completo not-needed.",
        "FIDELIDADE: não invente fatos, relações causais, escalas, anatomia, fronteiras ou dados; não resolva exercícios sem pedido. Ícones são simbólicos; indique ressalvas na caption. Se fotografia, cena, mapa exato ou desenho científico não puder ser representado fielmente, use o objeto vazio com status needs-image; preserve o texto, não invente substituto nem prometa imagem gerada.",
        "Revise campos obrigatórios, contagens, ids, direção dos links e legibilidade. Simplifique sem alterar o significado; não aplique um exemplo temático a outros assuntos."
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
