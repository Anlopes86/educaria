import core from "../../assets/js/worksheet-core.js";
import input from "../../assets/js/discovery-input.js";

const string = { type: "string" };
const object = properties => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const array = (items, minItems, maxItems) => ({ type: "array", items, minItems, maxItems });
const invalidOptions = () => Object.assign(new Error("Revise as opções de cada atividade da folha."), { code: "invalid_generation_options" });
function countOption(value, min, max) {
    if (value == null || value === "") return null;
    if (!["number", "string"].includes(typeof value) || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) throw invalidOptions();
    return Number(value);
}
function activityConfig(options, type) {
    const config = options.activityOptions?.[type] || {};
    const answers = Object.hasOwn(config, "answers") ? config.answers : options.inputMode === "words" ? options.answers : null;
    const min = answers?.length || config.count || (type === "connections" ? 1 : 4);
    const max = answers?.length || config.count || (options.pageMode === "roomy" ? type === "connections" ? 2 : 6 : min);
    return { ...config, answers, min, max, clueMin: config.clueCount || 3, clueMax: config.clueCount || 4 };
}
export function worksheetOptions(source) {
    const types = core.selection(source.worksheetTypes ?? core.types);
    const pageMode = source.pageMode || "compact", difficulty = source.difficulty || "medium", purpose = source.purpose || "assessment";
    if (!["compact", "roomy"].includes(pageMode) || !["easy", "medium", "hard"].includes(difficulty) || !["practice", "assessment"].includes(purpose)) throw Object.assign(new Error("Revise o tamanho, a finalidade e a dificuldade da folha."), { code: "invalid_generation_options" });
    const raw = source.activityOptions ?? {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).some(type => !types.includes(type))) throw invalidOptions();
    const activityOptions = {};
    for (const type of types) {
        const config = raw[type] ?? {};
        if (!config || typeof config !== "object" || Array.isArray(config)) throw invalidOptions();
        if (config.instructions != null && (typeof config.instructions !== "string" || config.instructions.length > 600)) throw invalidOptions();
        activityOptions[type] = { instructions: (config.instructions || "").trim(), count: countOption(config.count, type === "connections" ? 1 : 2, type === "connections" ? core.limits.rounds : core.limits.words),
            ...(type === "connections" ? { clueCount: countOption(config.clueCount, 2, core.limits.clues) } : {}) };
    }
    const trailClues = source.trailClues ?? true, wordsearchHelp = source.wordsearchHelp || "words";
    if (typeof trailClues !== "boolean" || !["words", "clues", "none"].includes(wordsearchHelp)) throw invalidOptions();
    return { worksheetTypes: types, pageMode, difficulty, purpose, activityOptions, trailClues, wordsearchHelp };
}
export function validateWorksheetSource(options, source) {
    const parsed = input.resolve(source, options.inputMode || "auto");
    const activityOptions = {};
    for (const type of core.selection(options.worksheetTypes)) {
        const config = options.activityOptions?.[type] || {};
        const local = config.instructions ? input.resolve(config.instructions, "auto") : null;
        const answers = local ? local.mode === "words" ? local.answers : null : parsed.mode === "words" ? parsed.answers : null;
        activityOptions[type] = { ...config, answers };
        // Validate each exact list before reserving credits. A local list overrides the global list only for its game.
        if (answers) core.normalize({ title: "Lista", activities: { [type]: type === "connections"
            ? { rounds: answers.map(answer => ({ answer, clues: ["Pista inicial", "Pista final"] })) }
            : { words: answers.map(term => ({ term, clue: "Pista" })) } } });
    }
    const audienceProvided = Boolean(options.audience?.trim() || /\b(?:\d{1,2}\s*[º°ªoa]?\s*(?:ano|série)|ensino\s+(?:médio|fundamental)|EJA|adultos|crianças)\b/i.test(source));
    return { ...options, activityOptions, audienceProvided, inputMode: parsed.mode, answers: parsed.answers, count: null };
}
export function worksheetSchema(options = {}) {
    const properties = {};
    for (const type of core.selection(options.worksheetTypes)) {
        const config = activityConfig(options, type);
        const term = config.answers?.length ? { type: "string", enum: [...config.answers] } : string;
        properties[type] = type === "connections"
            ? object({ instruction: string, rounds: array(object({ answer: term, clues: array(string, config.clueMin, config.clueMax), explanation: string }), config.min, config.max) })
            : object({ instruction: string, words: array(object({ term, clue: string }), config.min, config.max) });
    }
    return object({ title: string, subtitle: string, activities: object(properties) });
}
export function worksheetPrompt(action, source, options = {}) {
    return ["Crie atividades pedagógicas para impressão A4. A plataforma ajusta uma ou duas colunas e distribui em quantas páginas forem necessárias. Entregue somente JSON no schema, sem HTML, SVG, coordenadas ou grades.",
        `Formatos selecionados: ${core.selection(options.worksheetTypes).map(type => core.labels[type]).join(", ")}. Não inclua outros formatos.`,
        "Cada formato tem sua própria configuração abaixo. O pedido específico vale somente para aquela atividade e tem prioridade sobre o tema geral; não aplique a orientação de um jogo aos outros. Quantidades escolhidas e listas exatas têm prioridade sobre a tentativa de caber em uma página. Preserve o idioma solicitado.",
        ...core.selection(options.worksheetTypes).map(type => {
            const config = activityConfig(options, type);
            return `${core.labels[type]} (${type}): ${config.min === config.max ? `exatamente ${config.min}` : `${config.min} a ${config.max}`} ${type === "connections" ? "desafios" : "palavras"}.${type === "connections" ? ` ${config.clueMin === config.clueMax ? config.clueMin : `${config.clueMin} a ${config.clueMax}`} pistas por desafio.` : ""}\n${config.answers?.length ? `LISTA EXATA DESTE JOGO: ${JSON.stringify(config.answers)}. Preserve todas e somente estas respostas, sem traduzir ou conjugar.` : "Escolha respostas de acordo com o tema e a orientação deste jogo."}\n${config.instructions ? `Orientação específica do professor: ${JSON.stringify(config.instructions)}` : "Use o tema geral."}`;
        }),
        `Ajudas impressas: trilha ${options.trailClues === false ? "sem pistas visíveis" : "com pistas"}; caça-palavras ${options.wordsearchHelp === "none" ? "sem banco de palavras nem pistas (as palavras devem ser reconhecíveis pelo tema)" : options.wordsearchHelp === "clues" ? "somente pistas, sem as respostas" : "com banco de palavras"}. Ainda preencha as pistas no JSON para permitir ao professor alternar a ajuda sem gerar novamente.`,
        `Dificuldade: ${{ easy: "fácil, pistas diretas e concretas", medium: "média, relacionar conceitos e exemplos", hard: "difícil, inferências com pistas inequívocas, sem fatos obscuros" }[options.difficulty || "medium"]}.`,
        options.purpose === "practice" ? "Finalidade: prática e revisão. Varie as habilidades trabalhadas; repita respostas entre jogos apenas quando ajudar uma retomada intencional."
            : "Finalidade: avaliação independente. Em modo de tema, use respostas diferentes nas atividades: as palavras visíveis na trilha e no banco do caça-palavras não podem entregar as respostas das cruzadas nem de connections. A LISTA EXATA do professor, se houver, continua tendo prioridade; nunca troque nem remova seus termos.",
        "Palavras: 2 a 17 letras, sem números ou símbolos, sem duplicatas dentro do jogo. Prefira termos curtos, de até 8 letras. Nas cruzadas, escolha um conjunto conectado por letras em comum, não palavras isoladas. Cada clue deve explicar o termo sem repetir a resposta, preferencialmente até 90 caracteres (máximo 150).",
        "Prática pedagógica: em línguas, misture pistas de forma e uso em frases curtas com lacuna e contexto inequívoco; não use apenas 'passado de'. Em outros temas, combine definições, situações e aplicações. Não misture categorias que o pedido exclui (por exemplo, regulares num pedido de irregulares). Respeite sempre as palavras e o idioma solicitados.",
        `Use estas instruções de funcionamento, sem acrescentar ações ou espaços que não existem: ${JSON.stringify(core.instructions)}. Não use 'ortogonais'. O caça-palavras pede somente localizar e circular, não escrever ao lado.`,
        "Conexões: use a quantidade de pistas configurada, concretas e progressivas, até 100 caracteres cada, todas apontando para a mesma resposta específica; resposta até 100 caracteres. Escolha uma resposta dentro do tema, não o próprio tema geral já anunciado no título. Não escreva a resposta nas pistas ou em outro jogo. Explanation é o gabarito do professor, até 300 caracteres. Não invente fatos.",
        "Título curto, preferencialmente até 60 caracteres (máximo 100). Subtítulo opcional, de uma frase curta (máximo 200). Não inclua respostas, pontuação automática ou promessas de correção automática no cabeçalho. Não invente ano escolar, série, escola ou turma: só mencione se o professor informou no pedido ou no campo de público. Se não informou, use título neutro sem ano escolar.",
        `Pedido do professor: ${action || "Preparar uma folha de atividades."}`, "Tema, conteúdo ou palavras fornecidas:", source].join("\n\n");
}
// Larger sheets need more output, but never bypass the configured response ceiling or daily quota.
export function worksheetCompletionTokens(options = {}, baseline = 3500, ceiling = 12000) {
    const estimated = 700 + core.selection(options.worksheetTypes).reduce((total, type) => {
        const config = activityConfig(options, type);
        return total + config.max * (type === "connections" ? 100 + config.clueMax * 45 : 75);
    }, 0);
    return Math.max(1, Math.min(ceiling, Math.max(baseline, Math.ceil(estimated))));
}
export function normalizeWorksheetMaterial(material, options) {
    const result = core.normalize(material, options.worksheetTypes);
    // Operational instructions belong to the printed UI; teachers can still edit them afterwards.
    for (const type of result.order) result.activities[type].instruction = core.instructions[type];
    if (options.audienceProvided === false) {
        result.title = result.title.replace(/\s*[-–—·,:()]?\s*\b\d{1,2}\s*[º°ªoa]?\s*(?:ano|série)\b\)?/gi, "").trim() || "Folha de atividades";
        result.subtitle = result.subtitle.replace(/\s*\b(?:para\s+(?:o|a)\s+)?\d{1,2}\s*[º°ªoa]?\s*(?:ano|série)\b/gi, "").trim();
    }
    for (const round of result.activities.connections?.rounds || []) {
        if (core.containsAnswer(result.title, round.answer)) result.title = "Atividades de aprendizagem";
        if (core.containsAnswer(result.subtitle, round.answer)) result.subtitle = "";
    }
    for (const type of result.order) {
        const item = result.activities[type], values = type === "connections" ? item.rounds : item.words, config = activityConfig(options, type);
        if (type === "connections" && item.rounds.some(round => round.clues.length < config.clueMin || round.clues.length > config.clueMax)) {
            throw Object.assign(new Error(`A IA precisa incluir de ${config.clueMin} a ${config.clueMax} pistas por desafio na folha.`), { code: "invalid_worksheet_material" });
        }
        if (values.length < config.min || values.length > config.max) {
            throw Object.assign(new Error(`A IA não respeitou a quantidade prevista para ${core.labels[type]}. Tente novamente.`), { code: "invalid_worksheet_material" });
        }
        if (config.answers?.length) {
            const canonical = value => value.trim().normalize("NFC").toLowerCase();
            const key = type === "connections" ? "rounds" : "words", field = type === "connections" ? "answer" : "term";
            const byValue = new Map(values.map(item => [canonical(item[field]), item]));
            if (values.length !== config.answers.length || byValue.size !== values.length || config.answers.some(answer => !byValue.has(canonical(answer)))) throw Object.assign(new Error("A IA alterou palavras da lista. Tente novamente; nenhuma palavra pode ser traduzida, omitida ou substituída."), { code: "invalid_worksheet_material" });
            result.activities[type][key] = config.answers.map(answer => ({ ...byValue.get(canonical(answer)), [field]: answer }));
        }
    }
    return result;
}
