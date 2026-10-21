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

// Six-word regression: stays together on paper even though projection needs two trail boards.
export const worksheetSixWordFixture = {
    title: "Verbos irregulares no passado", subtitle: "Leia as pistas e resolva os quatro desafios.",
    activities: {
        wordtrail: { words: ["went", "ate", "saw", "took", "came", "gave"].map((term, i) => ({ term, clue: `Passado de ${["go", "eat", "see", "take", "come", "give"][i]}.` })) },
        connections: { rounds: [{ answer: "bought", clues: ["É a forma passada de um verbo ligado a compras.", "Completa: Yesterday, I ___ a new book.", "Sua forma no presente é buy."], explanation: "Bought é a forma passada de buy." }] },
        wordsearch: { words: ["drove", "wrote", "sang", "ran", "felt", "slept"].map(term => ({ term, clue: "Um verbo irregular no passado." })) },
        crossword: { words: [
            { term: "came", clue: "My cousin ___ to my house yesterday. (come)" }, { term: "gave", clue: "She ___ me a gift last week. (give)" },
            { term: "went", clue: "We ___ to the park yesterday. (go)" }, { term: "took", clue: "He ___ the bus this morning. (take)" },
            { term: "ate", clue: "I ___ an apple yesterday. (eat)" }, { term: "saw", clue: "They ___ a bird in the garden. (see)" }
        ] }
    }
};

// Synthetic stress fixture: verify every term survives splitting and pagination.
const pastVerbs = "went ate saw took came gave drove wrote sang ran felt slept bought brought thought taught caught found lost made did had kept left met paid read said sent spoke".split(" ");
export const worksheetLargeFixture = {
    title: "Verbos irregulares · folha extensa", subtitle: "Resolva as atividades e confira todas as partes.",
    activities: {
        ...Object.fromEntries(["wordtrail", "wordsearch", "crossword"].map(type => [type, { words: pastVerbs.map(term => ({ term, clue: "Um verbo irregular no passado. Pista de teste de distribuição." })) }])),
        connections: { rounds: Array.from({ length: 8 }, (_, i) => ({ answer: `Resposta ${i + 1}`, clues: Array.from({ length: 8 }, (_, j) => `Pista ${j + 1} de teste para conferir a distribuição do desafio na folha impressa.`), explanation: "Explicação de teste." })) }
    }
};
