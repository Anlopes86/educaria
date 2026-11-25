// Shared intent rules supplement each tool's schema; they do not add fields,
// generate layouts, or run a second provider request.
export function pedagogicalIntentInstructions(type) {
    return [
        "PRIORIDADES: mantenha o schema JSON e as regras de segurança. Pedidos específicos do professor sobre conteúdo, idioma e organização prevalecem sobre sugestões genéricas. O pedido define o assunto; disciplina e turma são contexto, nunca substitutos do tema. Rótulos genéricos de ajuda não anulam o pedido escrito.",
        type === "quiz" ? "No quiz, siga a política específica de idioma e dificuldade acima."
            : "IDIOMA: siga o pedido para conteúdo e pistas, inclusive quando forem bilíngues. Ao organizar material pronto, preserve o idioma original, grafia, flexões e nomes. Disciplina de língua só sugere o idioma de conteúdo novo sem língua definida; não autoriza traduzir listas nem trocar o tema por gramática. Sem indicação, use português do Brasil.",
        type === "slides"
            ? "OBJETIVO: introduza com exemplos; revise relações; pratique com aplicações; avalie sem entregar soluções. Cubra os subtemas pedidos, respeitando pesos e exclusões."
            : "OBJETIVO: introdução explica pré-requisitos e exemplos; revisão recupera ideias e relações; prática pede aplicação em situações variadas; avaliação evita pistas que entreguem a resposta. Adapte à ferramenta e ao público, sem mudar o assunto nem inventar série escolar. Distribua conteúdo novo entre os subtemas pedidos, respeitando pesos e exclusões.",
        type === "slides" ? "" : "REVISÃO INTERNA: confira cobertura, idioma, quantidade, relações corretas e campos completos. Evite itens redundantes e respostas expostas nas pistas ou títulos de jogos. Não invente fatos, citações ou fontes nem alegue pesquisa externa. Não inclua esse planejamento na resposta."
    ].filter(Boolean).join("\n"); // Slides already have a factual/visual review contract.
}

const toolGuidelines = {
    flashcards: "Respeite o mapeamento frente/verso solicitado; completar anotações não autoriza mudar o par. Ao criar, cada card trabalha uma ideia recuperável e seu verso responde à frente. Preserve blocos e numeração enviados; não crie gabaritos quando o professor pediu apenas organizar.",
    memory: "Cada par deve ter uma associação inequívoca; evite duas respostas intercambiáveis em pares diferentes. Use pares idênticos, tradução, termo/definição ou outra relação somente conforme o pedido. Não converta toda lista em tradução por padrão. Quantidade significa PARES, não cartões individuais.",
    match: "Cada elemento da coluna A deve ter uma única correspondência defensável na B. Preserve os pares e a direção solicitados, sem inverter pergunta/resposta ou idioma. A plataforma embaralha a coluna B; devolva os pares corretos, sem misturar as respostas no JSON. Não entregue o gabarito por números ou marcas iguais nos textos.",
    wheel: "Se o professor fornecer nomes, palavras ou itens para sorteio, mantenha-os como segmentos; não os transforme em perguntas. Só crie perguntas/desafios se solicitado ou adequado a um tópico sem lista. Preserve repetições intencionais para probabilidades e a ordem pedida; não acrescente segmentos de exemplo.",
    hangman: "Palavras fornecidas são respostas exatas, não sugestões para tradução ou sinônimos. Preserve acentos, tempo verbal e categoria solicitados. Uma pista identifica a resposta sem repeti-la, revelar suas letras ou expor a solução no subtítulo. Não troque uma expressão por outra apenas para encurtar.",
    wordsearch: "Use todas e somente as palavras de uma lista explícita, preservando idioma, acentos e flexões. Em tópico geral, selecione termos relevantes e variados sem sair da categoria pedida. Não gere grade ou coordenadas: o sistema monta o jogo. Pistas devem permitir reconhecer o termo sem repeti-lo.",
    crossword: "Preserve respostas de uma lista explícita no idioma e na forma pedidos; não substitua por termos com encaixe mais fácil. Ao criar por tema, favoreça letras em comum e pistas inequívocas. Não gere grade, numeração ou coordenadas: o sistema monta a cruzadinha. answer é a solução; clue é a pergunta/frase, nunca invertidos no JSON.",
    mindmap: "Cada ramo cobre um eixo distinto do tema, com relações explicadas no detail, sem repetir títulos como explicação. Preserve tópicos que o professor enumerou e distribua os subtemas sem inventar categorias genéricas. Aprofundamento deve trazer causas, exemplos ou aplicações; radial/tópicos altera organização, não rigor ou cobertura.",
    debate: "Perguntas devem permitir argumentos fundamentados, sem exigir que alunos defendam afirmações factualmente falsas. Distingua evidências de opiniões; não invente dados para equilibrar posições. Faça etapas avançarem da compreensão à análise e síntese; guidance indica ações de mediação, critérios e perguntas de apoio. Preserve formato e tempo total quando informados.",
    wordtrail: "Não confunda pistas com respostas: as palavras solicitadas entram em term; clue ajuda a encontrá-las. Não conjugue nem traduza palavras prontas. Em geração por tema, cada termo atende à categoria e ao tempo verbal pedidos, com pistas diferentes. A plataforma constrói os caminhos.",
    connections: "Não crie uma conexão entre as respostas fornecidas: cada resposta origina seu próprio desafio. Todas as pistas precisam se sustentar para aquela resposta específica, sem misturar biografias ou personagens. Dificuldade vem da progressão dos indícios, nunca de afirmações inventadas para fechar a contagem.",
    worksheet: "A orientação de cada exercício vale só para ele. Tema, público e idioma gerais continuam valendo nas demais atividades. Não invente espaços de resposta, imagens ou interações que o formato impresso não oferece. Respostas e pistas devem concordar com o gabarito; não encurte listas para caber em uma única A4."
};

export function toolPedagogyInstructions(type) {
    return Object.hasOwn(toolGuidelines, type) ? toolGuidelines[type] : "";
}

export function refinementPedagogyInstructions(type) {
    const specific = {
        memory: "Ao alterar só front ou back, mantenha a associação com o lado não editável; uma nova pergunta deve continuar respondida pelo verso existente.",
        match: "Ao alterar só left ou right, preserve a correspondência com o lado não editável. Não embaralhe a associação dentro do par.",
        flashcards: "Mantenha o papel solicitado de frente, verso e anotações. Se apenas um campo for editável, adapte-o aos outros; não mude implicitamente sua resposta.",
        wheel: "Mantenha a natureza do segmento (nome, termo, pergunta ou desafio), salvo pedido de conversão; não transforme um nome em pergunta por padrão.",
        mindmap: "Complete o tópico a partir de seu título e relação com o tema. Aprofunde com explicação e exemplo, sem repetir os ramos vizinhos ou renomear o tópico sem pedido.",
        debate: "Respeite context.format, as perspectivas e a etapa do roteiro. Em roda guiada, não invente equipes rivais. guidance deve ajudar a mediar e aprofundar, não apenas repetir question."
    };
    return [
        "O ajuste deve continuar coerente com os campos não editáveis. Se o pedido exigir mudar um campo bloqueado, não simule essa mudança nem altere a resposta implícita. Tema e itens vizinhos são contexto; o pedido específico pode mudar o foco dos itens selecionados sem copiar os vizinhos.",
        specific[type] || "",
        ["wordtrail", "wordsearch", "crossword", "hangman", "connections"].includes(type)
            ? "Se apenas a pista for editável, mantenha a resposta existente como alvo. Se apenas a resposta for editável, ela precisa continuar atendendo à pista existente; não prometa ter alterado campos bloqueados." : "",
        "Confira o resultado combinado com os campos preservados antes de responder, inclusive idioma, fatos, pistas e gabarito."
    ].filter(Boolean).join("\n");
}
