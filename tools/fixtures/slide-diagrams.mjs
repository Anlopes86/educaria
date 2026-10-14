const node = (id, label, icon = "none", detail = "") => ({ id, label, detail, icon });
const link = (from, to, kind = "arrow") => ({ from, to, kind });
const diagram = (layout, title, description, nodes, links, caption = "Representação esquemática") => ({ version: 2, status: "ready", layout, title, description, nodes, links, caption });

export const diagramExamples = [
    diagram("process", "Energia na cadeia alimentar", "A energia do Sol é captada pela planta e transferida entre os seres vivos pela alimentação.", [
        node("sun", "Sol", "sun", "Fonte de energia"), node("plant", "Planta", "plant", "Produtor"), node("insect", "Gafanhoto", "none", "Consumidor primário"), node("frog", "Sapo", "none", "Consumidor secundário")
    ], [link("sun", "plant"), link("plant", "insect"), link("insect", "frog")], "As setas indicam o fluxo de energia, não quem come quem."),
    diagram("comparison", "Artesanato e indústria", "Comparação entre o trabalho artesanal e industrial quanto às ferramentas e ao ritmo de produção.", [
        node("craft", "Produção artesanal", "person", "Ferramentas e trabalho manual"), node("industry", "Produção industrial", "gear", "Máquinas e divisão do trabalho"),
        node("crafttime", "Ritmo do artesão", "clock", "Organização individual"), node("factorytime", "Ritmo da fábrica", "clock", "Organização coletiva da produção")
    ], [], "Comparação simplificada; práticas variam conforme o contexto."),
    diagram("process", "Perguntas no presente simples", "A pergunta em inglês é formada por auxiliar, sujeito, verbo na forma base e complemento.", [
        node("aux", "Auxiliar", "speech", "Do"), node("subject", "Sujeito", "person", "you"), node("verb", "Verbo na forma base", "book", "like"), node("end", "Complemento", "question", "music?")
    ], [link("aux", "subject"), link("subject", "verb"), link("verb", "end")], "Do you like music?"),
    diagram("concept-map", "Participação cidadã", "A comunidade participa por meio do voto, da discussão de propostas, da fiscalização e da ação coletiva.", [
        node("community", "Comunidade", "people"), node("vote", "Votar", "balance"), node("talk", "Debater propostas", "speech"), node("watch", "Fiscalizar", "shield"), node("act", "Organizar ações", "building")
    ], [link("community", "vote", "line"), link("community", "talk", "line"), link("community", "watch", "line"), link("community", "act", "line")], "Formas de participação; não são etapas obrigatórias."),
    diagram("hierarchy", "Classificação dos seres vivos", "Um recorte da classificação dos animais em vertebrados e invertebrados e alguns grupos dentro de cada categoria.", [
        node("animals", "Animais", "none"), node("vertebrates", "Vertebrados", "none"), node("invertebrates", "Invertebrados", "none"),
        node("mammals", "Mamíferos", "none"), node("birds", "Aves", "none"), node("arthropods", "Artrópodes", "none"), node("mollusks", "Moluscos", "none")
    ], [link("animals", "vertebrates", "line"), link("animals", "invertebrates", "line"), link("vertebrates", "mammals", "line"), link("vertebrates", "birds", "line"), link("invertebrates", "arthropods", "line"), link("invertebrates", "mollusks", "line")], "Recorte didático: apenas alguns grupos, não a classificação completa."),
    diagram("cycle", "Ciclo da água: uma síntese", "A água evapora, condensa, precipita e retorna a reservatórios, de onde pode evaporar novamente.", [
        node("evaporation", "Evaporação", "sun"), node("condensation", "Condensação", "cloud"), node("rain", "Precipitação", "water"), node("return", "Retorno aos reservatórios", "globe")
    ], [link("evaporation", "condensation"), link("condensation", "rain"), link("rain", "return"), link("return", "evaporation")], "Esquema simplificado; o ciclo real inclui outros caminhos."),
    diagram("cards", "Fontes renováveis de energia", "Exemplos de fontes renováveis e do recurso natural aproveitado em cada caso.", [
        node("solar", "Solar", "sun", "Radiação do Sol"), node("wind", "Eólica", "none", "Movimento do ar"), node("hydro", "Hidráulica", "water", "Movimento da água")
    ], [], "Exemplos de fontes, sem indicação de proporção ou capacidade.")
];
