// Synthetic fixtures: never teacher content or a real provider response.
export const worksheetFixture = {
    title: "Past simple · let's practise!", subtitle: "Leia as instruções e resolva os desafios.",
    activities: {
        wordtrail: { words: [
            { term: "took", clue: "Passado de take." }, { term: "came", clue: "Passado de come." },
            { term: "began", clue: "Passado de begin." }, { term: "went", clue: "Passado de go." }
        ] },
        connections: { rounds: [{ answer: "Irregular verbs", clues: ["Their past forms do not always end in -ed.", "They include go, see and buy.", "Their past forms include went, saw and bought."], explanation: "São verbos irregulares: suas formas no passado não seguem a regra de acrescentar -ed." }] },
        wordsearch: { words: [
            { term: "played", clue: "Passado de play." }, { term: "walked", clue: "Passado de walk." },
            { term: "helped", clue: "Passado de help." }, { term: "cooked", clue: "Passado de cook." }
        ] },
        crossword: { words: [
            { term: "wrote", clue: "Yesterday, I ___ a letter. (write)" }, { term: "read", clue: "Last night, she ___ a book. (read)" },
            { term: "ate", clue: "We ___ pizza last Friday. (eat)" }, { term: "met", clue: "I ___ my friend yesterday. (meet)" }
        ] }
    }
};
