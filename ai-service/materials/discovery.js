import discovery from "../../assets/js/discovery-core.js";
import discoveryInput from "../../assets/js/discovery-input.js";

const string = { type: "string" };
const object = (properties, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, required, properties });
export const discoverySchemas = {
    wordtrail: object({ title: string, subtitle: string, words: { type: "array", minItems: 2, maxItems: 12, items: object({ term: string, clue: string }) } }),
    connections: object({ title: string, subtitle: string, rounds: { type: "array", minItems: 1, maxItems: 8, items: object({ answer: string, explanation: string, clues: { type: "array", minItems: 2, maxItems: 8, items: string } }) } })
};
export function discoveryPrompt(type, action, source, options = {}) {
    const ownAnswers = type === "connections" && options.inputMode === "words";
    const ownWords = type === "wordtrail" && options.inputMode === "words";
    return ["Você cria atividades pedagógicas para discussão coletiva em sala. Responda somente em JSON compatível com o schema.",
        "Respeite o idioma do conteúdo fornecido, o público e o pedido do professor. Texto simples, sem HTML. Título e subtítulo não devem revelar respostas.",
        type === "wordtrail" ? (ownWords
            ? `Use EXATAMENTE estes termos no array words, na mesma ordem: ${JSON.stringify(options.answers || discoveryInput.parseAnswers(source))}. Cada term deve ser literalmente uma palavra da lista. Não traduza para português ou outro idioma, não conjugue, não substitua e não adicione termos. Crie apenas clue para cada palavra original, conforme a opção de pistas.`
            : "Escolha palavras relevantes ao tema (2 a 12), com 2 a 18 letras cada. O idioma das palavras deve seguir o idioma solicitado no tema, não o idioma em que o pedido foi escrito. Ex.: ‘palavras em inglês no passado’ exige verbos no passado EM INGLÊS, não suas traduções. Respeite o tempo verbal e a categoria pedidos.")
            : ownAnswers
                ? `Crie um desafio separado para CADA resposta desta lista exata, na mesma ordem: ${JSON.stringify(options.answers || discoveryInput.parseAnswers(source))}. Cada answer deve ser literalmente um item dessa lista. NÃO invente categorias que relacionem os itens entre si. Para cada resposta, gere clues que permitam identificar especificamente aquela pessoa, personagem, obra, lugar ou conceito, e explanation explicando a ligação das pistas com ela.`
                : "Crie de 1 a 8 desafios dentro do tema. Cada desafio contém pistas curtas (clues), uma resposta específica e defensável (answer) e a explicação dessa conexão (explanation). A resposta pode ser um conceito, categoria, pessoa, personagem, obra ou lugar. Evite relações vagas como coisas ou palavras.",
        type === "connections" ? "Cada desafio tem de 2 a 8 pistas, conforme a quantidade escolhida. Ordene da menos evidente à mais esclarecedora, respeitando a dificuldade. Todas devem apontar para a MESMA resposta daquele desafio. Não repita literalmente a resposta nem use sinônimos dela. Prefira características concretas, distintas e amplamente estabelecidas; não invente biografia, participações em jogos, estatísticas ou relações para preencher pistas. A explicação deve justificar todas as pistas, sem confundir pessoa real, personagem e obra." : "",
        type === "wordtrail" ? "Pistas pedagógicas curtas, coerentes com cada termo original, sem mostrar a resposta. O idioma das pistas segue o pedido; por padrão, use português do Brasil nas orientações sem traduzir os termos da grade. Não envie grade, coordenadas ou trajetos: o sistema monta o tabuleiro. Preserve acentos nos termos. Sem números, símbolos ou repetições." : "",
        `Pedido do professor: ${action || "Criar uma atividade para revisar com a turma."}`, "Conteúdo / tópico / palavras fornecidas:", source].join("\n\n");
}
export function normalizeDiscoveryMaterial(type, material, options = {}, source = "") {
    if (!discovery.types.includes(type)) return material;
    let result = material;
    if (options.inputMode === "words") {
        const supplied = options.answers || discoveryInput.parseAnswers(source);
        if (type === "wordtrail") {
            const canonical = value => String(value || "").trim().normalize("NFC").toLocaleLowerCase();
            const words = Array.isArray(material?.words) ? material.words : [];
            const byTerm = new Map(words.map(word => [canonical(word.term), word]));
            if (words.length !== supplied.length || byTerm.size !== supplied.length || supplied.some(term => !byTerm.has(canonical(term)))) {
                throw Object.assign(new Error("A IA não preservou todas as palavras da sua lista no idioma original. Tente novamente; os termos não podem ser traduzidos ou substituídos."), { code: "invalid_discovery_material" });
            }
            result = { ...material, words: supplied.map(term => ({ ...byTerm.get(canonical(term)), term })) };
        } else {
            const canonical = value => String(value || "").trim().toLocaleLowerCase();
            const rounds = Array.isArray(material?.rounds) ? material.rounds : [];
            const byAnswer = new Map(rounds.map(round => [canonical(round.answer), round]));
            if (rounds.length !== supplied.length || byAnswer.size !== supplied.length || supplied.some(word => !byAnswer.has(canonical(word)))) {
                throw Object.assign(new Error("A IA não preservou todas as respostas da sua lista. Tente novamente; nenhuma palavra deve ser substituída."), { code: "invalid_discovery_material" });
            }
            result = { ...material, rounds: supplied.map(answer => ({ ...byAnswer.get(canonical(answer)), answer })) };
        }
    }
    if (type === "wordtrail") result = { ...result, showClues: options.includeClues !== false,
        ...(options.includeClues === false && Array.isArray(result?.words) ? { words: result.words.map(word => ({ ...word, clue: "" })) } : {}) };
    const normalized = discovery.normalize(type, result);
    if (type === "connections" && options.clueCount && normalized.rounds.some(round => round.clues.length !== options.clueCount)) {
        throw Object.assign(new Error(`A IA não entregou as ${options.clueCount} pistas por desafio solicitadas. Tente novamente.`), { code: "invalid_discovery_material" });
    }
    return normalized;
}
export function validateDiscoverySource(type, options, source) {
    if (!discovery.types.includes(type)) return options;
    const input = discoveryInput.resolve(source, options.inputMode || "auto");
    options = { ...options, inputMode: input.mode, answers: input.answers, count: input.mode === "words" ? null : options.count };
    if (options.inputMode !== "words") return options;
    const supplied = options.answers;
    if (type === "wordtrail") discovery.normalize(type, { words: supplied.map(term => ({ term })) });
    else if (supplied.length < 1 || supplied.length > 8 || supplied.some(word => word.length > 120)
        || new Set(supplied.map(word => word.toLocaleLowerCase())).size !== supplied.length) {
        throw Object.assign(new Error("Informe de 1 a 8 respostas diferentes, uma por linha ou separadas por vírgula (até 120 caracteres cada)."), { code: "invalid_discovery_material" });
    }
    return options;
}
