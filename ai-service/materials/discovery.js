import discovery from "../../assets/js/discovery-core.js";

const string = { type: "string" };
const object = (properties, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, required, properties });
export const discoverySchemas = {
    wordtrail: object({ title: string, subtitle: string, words: { type: "array", minItems: 2, maxItems: 12, items: object({ term: string, clue: string }) } }),
    connections: object({ title: string, subtitle: string, rounds: { type: "array", minItems: 1, maxItems: 8, items: object({ answer: string, explanation: string, clues: { type: "array", minItems: 3, maxItems: 5, items: string } }) } })
};
export function discoveryPrompt(type, action, source) {
    return ["Você cria atividades pedagógicas para discussão coletiva em sala. Responda somente em JSON compatível com o schema.",
        "Respeite o idioma do conteúdo fornecido, o público e o pedido do professor. Texto simples, sem HTML. Título e subtítulo não devem revelar respostas.",
        type === "wordtrail" ? "Crie palavras relevantes ao tema (2 a 12), com 2 a 18 letras cada, e pistas pedagógicas curtas. Não envie grade, coordenadas ou trajetos: o sistema monta o tabuleiro. Mantenha acentos no termo; evite nomes com números e símbolos. Sem repetições."
            : "Crie de 1 a 8 desafios. Cada desafio contém 3 a 5 pistas curtas (clues), uma conexão específica e defensável (answer) e a explicação dessa conexão (explanation). Ordene as pistas da menos evidente à mais esclarecedora. As pistas não podem repetir literalmente a resposta nem ser sinônimos dela. Explique como TODAS se conectam. Evite relações vagas como coisas ou palavras; prefira conceitos da disciplina. Não invente fatos.",
        `Pedido do professor: ${action || "Criar uma atividade para revisar com a turma."}`, "Conteúdo / tópico / palavras fornecidas:", source].join("\n\n");
}
export function normalizeDiscoveryMaterial(type, material, options = {}, source = "") {
    if (!discovery.types.includes(type)) return material;
    let result = material;
    if (options.inputMode === "words") {
        const supplied = discovery.parseWords(source);
        if (type === "wordtrail") {
            result = { ...material, words: supplied.map(term => ({ term, clue: material?.words?.find(item => discovery.clean(item.term) === discovery.clean(term))?.clue || "" })) };
        } else {
            const provided = new Set(supplied.map(word => word.toLocaleLowerCase()));
            const actual = (material?.rounds || []).flatMap(round => round.clues || []).map(word => String(word).trim().toLocaleLowerCase());
            if (actual.length !== supplied.length || new Set(actual).size !== actual.length || actual.some(word => !provided.has(word)) || supplied.some(word => !actual.includes(word.toLocaleLowerCase()))) {
                throw Object.assign(new Error("As pistas não preservaram as palavras fornecidas. Revise a lista e tente novamente."), { code: "invalid_discovery_material" });
            }
        }
    }
    return discovery.normalize(type, result);
}
export function validateDiscoverySource(type, options, source) {
    if (!discovery.types.includes(type) || options.inputMode !== "words") return;
    const supplied = discovery.parseWords(source);
    if (type === "wordtrail") discovery.normalize(type, { words: supplied.map(term => ({ term })) });
    else if (supplied.length < 3 || supplied.length > 40 || supplied.some(word => word.length > 100)
        || new Set(supplied.map(word => word.toLocaleLowerCase())).size !== supplied.length) {
        throw Object.assign(new Error("Informe de 3 a 40 palavras/pistas diferentes, uma por linha (até 100 caracteres cada)."), { code: "invalid_discovery_material" });
    }
}
