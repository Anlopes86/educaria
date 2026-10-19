import core from "../../assets/js/worksheet-core.js";
import input from "../../assets/js/discovery-input.js";

const string = { type: "string" };
const object = properties => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const array = (items, minItems, maxItems) => ({ type: "array", items, minItems, maxItems });
export function worksheetOptions(source) {
    const types = core.selection(source.worksheetTypes ?? core.types);
    const pageMode = source.pageMode || "compact", difficulty = source.difficulty || "medium";
    if (!["compact", "roomy"].includes(pageMode) || !["easy", "medium", "hard"].includes(difficulty)) throw Object.assign(new Error("Revise o tamanho da folha e a dificuldade."), { code: "invalid_generation_options" });
    return { worksheetTypes: types, pageMode, difficulty };
}
export function validateWorksheetSource(options, source) {
    const parsed = input.resolve(source, options.inputMode || "auto");
    if (parsed.mode === "words") {
        // Validate the selected games before reserving credits; categories can be longer than grid words.
        const activities = Object.fromEntries(core.selection(options.worksheetTypes).map(type => [type, type === "connections"
            ? { rounds: parsed.answers.map(answer => ({ answer, clues: ["Pista inicial", "Pista final"] })) }
            : { words: parsed.answers.map(term => ({ term, clue: "Pista" })) }]));
        core.normalize({ title: "Lista", activities });
    }
    return { ...options, inputMode: parsed.mode, answers: parsed.answers, count: null };
}
export function worksheetSchema(options = {}) {
    const properties = {};
    for (const type of core.selection(options.worksheetTypes)) {
        const own = options.inputMode === "words" && options.answers?.length;
        const term = own ? { type: "string", enum: [...options.answers] } : string;
        properties[type] = type === "connections"
            ? object({ instruction: string, rounds: array(object({ answer: term, clues: array(string, 3, 4), explanation: string }), own ? options.answers.length : 1, own ? options.answers.length : options.pageMode === "roomy" ? 2 : 1) })
            : object({ instruction: string, words: array(object({ term, clue: string }), own ? options.answers.length : 4, own ? options.answers.length : options.pageMode === "roomy" ? 6 : 4) });
    }
    return object({ title: string, subtitle: string, activities: object(properties) });
}
export function worksheetPrompt(action, source, options = {}) {
    return ["Crie uma folha pedagógica A4, com atividades independentes, em duas colunas. Entregue somente JSON no schema, sem HTML, SVG, coordenadas ou grades.",
        `Formatos selecionados: ${core.selection(options.worksheetTypes).map(type => core.labels[type]).join(", ")}. Não inclua outros formatos.`,
        options.inputMode === "words" ? `LISTA EXATA: ${JSON.stringify(options.answers)}. Preserve todas e somente estas palavras, sem traduzir ou conjugar. Cada jogo usa a lista inteira. Em connections, crie um desafio por resposta exata. A lista tem prioridade sobre o tamanho da folha.`
            : `Escolha ${options.pageMode === "roomy" ? "4 a 6" : "exatamente 4"} palavras por jogo de palavras, e ${options.pageMode === "roomy" ? "1 a 2 desafios" : "um desafio"} em connections. Siga o idioma solicitado (verbos em inglês continuam em inglês). Quando possível, varie as respostas entre as atividades para uma não entregar o gabarito das outras.`,
        `Dificuldade: ${{ easy: "fácil, pistas diretas e concretas", medium: "média, relacionar conceitos e exemplos", hard: "difícil, inferências com pistas inequívocas, sem fatos obscuros" }[options.difficulty || "medium"]}.`,
        "Palavras: 2 a 17 letras, sem números ou símbolos, sem duplicatas dentro do jogo. Prefira termos curtos, de até 8 letras, para facilitar a leitura na folha. Nas cruzadas, prefira termos que compartilhem letras para permitir cruzamentos. Cada clue deve explicar o termo sem repetir a resposta, até 150 caracteres. Instrução curta (até 200 caracteres) explicando o que fazer no papel.",
        "Trilha: letras vizinhas ortogonais, caminhos podem virar; o aluno também escreve as palavras ao lado. Caça-palavras: palavras horizontais e verticais. Cruzadas: pistas para completar as respostas na grade, sem revelar as respostas no enunciado.",
        "Conexões: 3 ou 4 pistas concretas por desafio, até 100 caracteres cada, todas apontando para a mesma resposta específica; resposta até 100 caracteres. Explanation é o gabarito do professor, até 300 caracteres; nunca inclua a resposta no título ou instruction. Não invente fatos.",
        "Título até 100 caracteres. Subtítulo até 200 caracteres. Não inclua respostas, pontuação automática ou promessas de correção automática no cabeçalho.",
        `Pedido do professor: ${action || "Preparar uma folha de atividades."}`, "Tema, conteúdo ou palavras fornecidas:", source].join("\n\n");
}
export function normalizeWorksheetMaterial(material, options) {
    const result = core.normalize(material, options.worksheetTypes);
    for (const type of result.order) {
        const item = result.activities[type], values = type === "connections" ? item.rounds : item.words;
        if (type === "connections" && item.rounds.some(round => round.clues.length < 3 || round.clues.length > 4)) {
            throw Object.assign(new Error("A IA precisa incluir de 3 a 4 pistas por desafio na folha."), { code: "invalid_worksheet_material" });
        }
        if (options.inputMode !== "words") {
            const min = type === "connections" ? 1 : 4;
            const max = options.pageMode === "roomy" ? (type === "connections" ? 2 : 6) : min;
            if (values.length < min || values.length > max) throw Object.assign(new Error("A IA não respeitou a quantidade prevista para a folha. Tente novamente."), { code: "invalid_worksheet_material" });
        }
    }
    if (options.inputMode === "words") {
        const canonical = value => value.trim().normalize("NFC").toLowerCase();
        for (const type of result.order) {
            const key = type === "connections" ? "rounds" : "words", field = type === "connections" ? "answer" : "term";
            const values = result.activities[type][key];
            const byValue = new Map(values.map(item => [canonical(item[field]), item]));
            if (values.length !== options.answers.length || byValue.size !== values.length || options.answers.some(answer => !byValue.has(canonical(answer)))) throw Object.assign(new Error("A IA alterou palavras da lista. Tente novamente; nenhuma palavra pode ser traduzida, omitida ou substituída."), { code: "invalid_worksheet_material" });
            result.activities[type][key] = options.answers.map(answer => ({ ...byValue.get(canonical(answer)), [field]: answer }));
        }
    }
    return result;
}
