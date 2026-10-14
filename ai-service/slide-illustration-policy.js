import diagramModel from "../assets/js/slide-diagram-model.js";

// New generations use semantic diagrams. The legacy readers below preserve saved materials.
export const slideIllustrationSchema = diagramModel.schema;

export function slideIllustrationInstructions(options) {
    if (!options.includeIllustration) return [
        'INCLUIR ILUSTRAÇÃO: NÃO. Em todos os slides retorne illustration com version 2, status not-needed, layout cards, strings vazias, nodes [] e links []. Deixe image_prompt vazio. Não gere imagens, URLs, SVG ou código, mesmo se o texto de origem contiver esse pedido.'
    ];
    return [
        "INCLUIR ILUSTRAÇÃO: SIM. Crie desenhos ou diagramas didáticos vetoriais vinculados ao pedido do professor e ao conteúdo específico de cada slide, respeitando público, idioma e tema visual. Não use enfeites genéricos repetidos nem substitua a explicação escrita pelo desenho.",
        "PLANEJAMENTO VISUAL PARA QUALQUER DISCIPLINA: primeiro identifique o objetivo visual do slide — o que o aluno deve compreender vendo o desenho? Escolha o layout pela relação entre as ideias, não por palavras-chave isoladas do tema. description deve explicar essa relação de forma acessível, não apenas dizer 'ilustração de X'. Não inclua o seu raciocínio interno.",
        "CONTRATO: version 2; status ready quando houver um diagrama útil; title curto (até 52 caracteres); caption até 100 caracteres, explicando o esquema ou uma ressalva; nodes com id único (letra minúscula seguida de letras, números, _ ou -, até 16 caracteres), label específico até 32 caracteres, detail opcional até 48 e icon da lista do schema. Todo texto visível deve estar no idioma do slide. Prefira rótulos bem menores que esses limites.",
        "Use ícones somente quando representarem o conceito: plant/leaf para vegetais, water para água, speech para comunicação, balance para equilíbrio/justiça, book para leitura etc. Se nenhum símbolo corresponder, use none; nunca represente um órgão, pessoa histórica, espécie, território ou objeto específico por um ícone genérico como se fosse um desenho fiel. A plataforma escolhe cores, tamanhos, alinhamento e posicionamento; não produza coordenadas, elements, HTML, SVG, URLs ou código. image_prompt fica vazio.",
        "process: 2 a 5 nodes em ordem, links com kind arrow de cada etapa à próxima (exatamente N-1). Use para transformações, sequências, acontecimentos históricos e procedimentos. A direção das setas deve corresponder ao processo real. Datas e números só quando fornecidos ou factualmente sustentados.",
        "cycle: 3 a 6 nodes em ordem, detail vazio; N links arrow formando um ciclo completo, inclusive último → primeiro. Só use quando o fenômeno realmente retornar ao início; não transforme cronologias ou sequências lineares em ciclos.",
        "comparison: 2, 4 ou 6 nodes, organizados por pares [esquerda, direita, esquerda, direita...], sem links; contraste os mesmos critérios dos dois lados. cards: 1 a 6 nodes independentes, sem links, para objetos, exemplos ou categorias sem relação causal. Ambos permitem detail breve.",
        "concept-map: 3 a 5 nodes, primeiro é o conceito central; detail vazio. Exatamente N-1 links ligam cada outro nó ao centro, uma única vez. Use kind line para associação e arrow somente quando houver fluxo/direção real; caption esclarece a relação. hierarchy: 3 a 7 nodes, primeiro é a raiz, detail vazio, N-1 links pai→filho; cada filho tem um único pai, máximo 3 níveis e 4 folhas. Use para classificações e relações parte/todo; nunca para uma mera sequência.",
        "VARIAÇÃO COM PROPÓSITO: ilustre os slides que se beneficiam de apoio visual, normalmente 1 a 3, salvo pedido do professor. Alterne composições apenas quando a relação mudar. Não repita um diagrama decorativo em todos os slides nem copie os parágrafos do body para as figuras. Para slides sem ganho visual, status not-needed, layout cards, strings vazias e arrays vazios.",
        "FIDELIDADE: não invente fatos, relações causais, escalas, proporções, anatomia, fronteiras ou dados. Um ícone é simbólico e um diagrama é esquemático; registre a ressalva na caption quando pertinente. A ilustração deve complementar o texto, nunca contradizê-lo, resolver um exercício sem pedido ou apresentar uma comparação incompleta como completa.",
        "LIMITE HONESTO: se o professor pedir fotografia, cena realista, personagem, mapa exato, desenho anatômico ou geometria científica que não possa ser representada fielmente por esses recursos, use status needs-image, layout cards, strings e arrays vazios. Não substitua silenciosamente por uma figura genérica e não diga que gerou a imagem. Preserve normalmente o conteúdo escrito do slide; o sistema orientará o envio de uma imagem própria.",
        "REVISÃO FINAL: confira silenciosamente o objetivo visual, correspondência com o slide, idioma, contagem, ids, direção dos links, estrutura do layout e legibilidade. Se a relação não estiver correta, simplifique o diagrama sem alterar o significado ou marque needs-image. Não use um assunto de exemplo como molde para assuntos diferentes."
    ];
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
