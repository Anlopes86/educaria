/* Shared interpretation of the teacher's input; no provider calls or DOM access. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.EducariaDiscoveryInput = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";
    const prefix = /^(?:(?:minhas?|meus?)\s+)?(?:respostas?|palavras?|termos?)\s*:\s*/i;
    function parseAnswers(source) {
        const text = String(source || "").trim().replace(prefix, "");
        const parts = []; let value = "", quoted = false, quote = "", explicitLines = false;
        const add = () => { if (value.trim()) parts.push({ value: value.trim().replace(/^(?:\d+[.)]|[-*•])\s+/, ""), quoted }); value = ""; quoted = false; };
        for (const char of text) {
            if (quote) {
                if (char === quote) quote = "";
                else value += char;
            } else if (char === '"' || char === "“") { quote = char === "“" ? "”" : char; quoted = true; }
            else if (/[\n,;]/.test(char)) { if (char !== ",") explicitLines = true; add(); }
            else value += char;
        }
        add();
        // In a comma-separated enumeration, accept the final "e"/"and" as a separator.
        // Explicit lines, semicolons and quotes preserve names such as "Tom e Jerry".
        const last = parts.at(-1);
        if (!explicitLines && parts.length > 1 && last && !last.quoted) {
            last.value = last.value.replace(/^(?:e|and)\s+/i, "");
            const tail = last.value.split(/\s+(?:e|and)\s+/i);
            if (tail.length === 2) parts.splice(-1, 1, ...tail.map(value => ({ value, quoted: false })));
        }
        // A final sentence stop is not a letter of a bare listed word. Quoted names stay literal.
        const final = parts.at(-1);
        if (parts.length > 1 && final && !final.quoted && /^[A-Za-zÀ-ž]+\.$/.test(final.value)) final.value = final.value.slice(0, -1);
        return parts.map(part => part.value.trim()).filter(Boolean);
    }
    function resolve(source, mode = "auto") {
        if (mode === "topic") return { mode: "topic", answers: [] };
        const text = String(source || "").trim(), answers = parseAnswers(text);
        if (mode === "words") return { mode: "words", answers };
        // Only infer compact lists. Expository text and instructions stay in topic mode.
        const looksLikeList = prefix.test(text) || (answers.length > 1 && answers.every(answer =>
            answer.length <= 120 && answer.split(/\s+/).length <= 9 && !/[.!?:]/.test(answer)
            && !/^(?:crie|criar|gere|gerar|faça|fazer|explique|explore|monte|quero|preciso|sobre|suas?|seus?|como|por que|compare|relacione)\b/i.test(answer)));
        return looksLikeList ? { mode: "words", answers } : { mode: "topic", answers: [] };
    }
    function describe(input, type = "connections") {
        if (type === "wordtrail") {
            if (input.mode !== "words") return "A IA escolherá as palavras a partir do tema, no idioma solicitado. Para usar palavras exatas, escreva uma lista ou escolha “Minhas palavras”.";
            if (!input.answers.length) return "Escreva de 2 a 12 palavras no campo inicial, uma por linha ou separadas por vírgula. Serão mantidas sem tradução.";
            return `${input.answers.length} palavras na trilha: ${input.answers.join(" • ")}. Serão usadas exatamente assim, sem traduzir ou trocar. A IA criará as pistas, se ativadas.`;
        }
        if (input.mode !== "words") return "A IA escolherá as respostas a partir do tema. Para definir as respostas, escreva uma lista ou escolha “Minhas respostas”.";
        if (!input.answers.length) return "Escreva de 1 a 8 respostas no campo inicial. Cada uma será um desafio; a IA criará somente as pistas e a explicação.";
        return `${input.answers.length} ${input.answers.length === 1 ? "desafio — resposta" : "desafios — respostas"}: ${input.answers.join(" • ")}. A IA criará as pistas sem trocar essas respostas. Use uma por linha ou entre aspas para preservar nomes com vírgula ou “e”.`;
    }
    return Object.freeze({ parseAnswers, resolve, describe });
});
