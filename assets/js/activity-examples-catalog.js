/* Public, synthetic examples only. Add a tool here to expose its existing presentation. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.EducariaExampleCatalog = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";
    const step = (text, click = "", delay = 3800) => ({ text, click, delay });
    const tools = {
        slides: { label: "Slides", builder: "slides-builder.html?new=1", page: "apresentacao.html", stack: "data-slides-stack", steps: [step("Apresente o tema com textos organizados e um visual pronto para a sala."), step("Avance pelos slides no seu ritmo.", "[data-presentation-next]"), step("Revise e personalize o conteúdo antes de apresentar.", "[data-presentation-next]")] },
        quiz: { label: "Quiz", builder: "quiz-builder.html?new=1", page: "quiz-aplicacao.html", stack: "data-quiz-stack", steps: [step("Mostre a pergunta e deixe a turma pensar antes de responder."), step("Selecione uma alternativa com os alunos.", "[data-runtime-option]"), step("Revele a resposta e converse sobre a explicação.", "[data-quiz-application-reveal]")] },
        flashcards: { label: "Flashcards", builder: "flashcards-builder.html?new=1", page: "flashcards-apresentacao.html", stack: "data-flashcards-stack", steps: [step("Na frente, uma palavra, pergunta ou conceito."), step("Vire o cartão para conferir a resposta e as anotações.", "[data-flashcard-flip]"), step("Passe ao próximo cartão para continuar a revisão.", "[data-flashcard-next]")] },
        memory: { label: "Jogo da memória", builder: "jogo-memoria-builder.html?new=1", page: "jogo-memoria-apresentacao.html", stack: "data-memory-pairs", steps: [step("A turma usa os números para indicar quais cartas quer virar."), step("Revele uma carta.", '[data-memory-tile="0-front"]'), step("Encontre o par correspondente. Ele permanece aberto.", '[data-memory-tile="0-back"]')] },
        wheel: { label: "Roleta", builder: "roleta-builder.html?new=1", page: "roleta-apresentacao.html", stack: "data-wheel-segments", steps: [step("Cada número representa uma pergunta, palavra ou desafio."), step("Gire a roleta para sortear o próximo desafio da turma.", "[data-wheel-spin]", 7500), step("Leia o resultado. Você pode repetir o sorteio durante a aula.")] },
        match: { label: "Ligar pontos", builder: "ligar-pontos-builder.html?new=1", page: "ligar-pontos-apresentacao.html", stack: "data-match-pairs", steps: [step("Relacione os conceitos da esquerda às respostas da direita."), step("Selecione um item para começar a ligação.", "[data-match-left-item]"), { ...step("Ao encontrar a correspondência, o par fica marcado."), action: "match" }] },
        mindmap: { label: "Mapa mental", builder: "mapa-mental-builder.html?new=1", page: "mapa-mental-apresentacao.html", stack: "data-mind-branches", steps: [step("Veja o tema central e as conexões entre os tópicos."), { ...step("Selecione um ramo para explorar sua explicação."), action: "mindmap" }, step("Organize a conversa com a turma a partir dessas conexões.")] },
        debate: { label: "Debate guiado", builder: "debate-guiado-builder.html?new=1", page: "debate-guiado-apresentacao.html", stack: "data-debate-steps", steps: [step("Apresente a pergunta central e as posições do debate."), step("Cada etapa orienta os argumentos e a participação da turma.", "[data-debate-stage-next]"), step("Avance até a síntese para fechar a discussão.", "[data-debate-stage-next]")] },
        wordsearch: { label: "Caça-palavras", builder: "caca-palavras-builder.html?new=1", page: "caca-palavras-apresentacao.html", stack: "data-wordsearch-words", steps: [step("Encontre na grade as palavras do conteúdo estudado."), step("Você pode ocultar a lista para aumentar o desafio.", "[data-wordsearch-toggle-bank]"), step("Revele as palavras para corrigir com a turma.", "[data-wordsearch-toggle-solution]")] },
        crossword: { label: "Palavras cruzadas", builder: "palavras-cruzadas-builder.html?new=1", page: "palavras-cruzadas-apresentacao.html", stack: "data-crossword-entries", steps: [step("Leia as pistas e complete as palavras na grade."), step("Confira as respostas com a turma quando terminar.", "[data-crossword-toggle-solution]")] },
        hangman: { label: "Forca", builder: "forca-builder.html?new=1", page: "forca-apresentacao.html", stack: "data-hangman-entries", steps: [step("Use a pista para descobrir a palavra escondida."), step("A turma sugere letras e acompanha as tentativas.", '[data-hangman-letter="A"]'), step("Revele a palavra e revise seu significado.", "[data-hangman-reveal]")] },
        wordtrail: { label: "Trilha de Palavras", builder: "trilha-palavras-builder.html?new=1", page: "trilha-palavras-apresentacao.html", stack: "data-discovery-items", steps: [step("Conecte letras vizinhas para formar palavras; o caminho pode fazer curvas."), step("Uma pista ajuda a começar a busca.", "[data-discovery-hint]"), step("Confira os caminhos e as palavras encontradas.", "[data-discovery-reveal]")] },
        connections: { label: "O que há em comum?", builder: "em-comum-builder.html?new=1", page: "em-comum-apresentacao.html", stack: "data-discovery-items", steps: [step("Comece com uma pista e peça hipóteses à turma."), step("Revele mais uma pista para ajudar a descobrir a resposta.", "[data-discovery-clue]"), step("Mostre a resposta e explique a relação entre as pistas.", "[data-discovery-reveal]")] },
        lesson: { label: "Aula completa", builder: "criar-aula.html", sequence: ["slides", "quiz", "mindmap"], steps: [step("Comece a aula com uma explicação em slides."), step("Continue com um quiz para verificar o entendimento."), step("Feche com um mapa mental. Você escolhe as atividades e a ordem.")] },
        worksheet: { label: "Atividades para imprimir", builder: "folha-atividades-builder.html?new=1", steps: [step("Escolha os formatos, informe o tema e revise a folha A4 antes de imprimir."), step("O gabarito fica separado da folha entregue aos alunos.")] }
    };
    const scripts = new Set(["activity-visuals.js", "presentation-runtime.js", "quiz-runtime.js", "flashcards-runtime.js", "memory-runtime.js", "wheel-runtime.js", "match-runtime.js", "mindmap-runtime.js", "debate-runtime.js", "wordsearch-core.js", "wordsearch-runtime.js", "crossword-core.js", "crossword-runtime.js", "hangman-core.js", "hangman-runtime.js", "discovery-core.js", "discovery-view.js", "discovery-pointer-input.js", "discovery-runtime.js"]);
    const words = ["went", "came", "took", "gave"].map((term, i) => ({ term, clue: `Passado de ${["go", "come", "take", "give"][i]}.` }));
    const worksheet = { title: "English · let's practise!", subtitle: "Leia as pistas e resolva os desafios.", order: ["wordtrail", "wordsearch", "crossword", "connections"], activities: {
        wordtrail: { words }, wordsearch: { words },
        crossword: { words: ["read", "ate", "met"].map((term, i) => ({ term, clue: ["Ler: a escrita não muda no passado.", "Passado de eat.", "Passado de meet."][i] })) },
        connections: { rounds: [{ answer: "School", clues: ["É um lugar de aprendizagem.", "Tem salas e professores.", "É a palavra em inglês para escola."], explanation: "School significa escola em inglês." }] }
    } };
    const escape = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    function discoveryDraft(type) {
        const field = (name, value) => `<textarea data-discovery-${name}>${escape(value)}</textarea>`;
        return { controls: { "discovery-title": type === "wordtrail" ? "Verbos em inglês no passado" : "Descubra o lugar", "discovery-show-clues": "true" }, stackHtml: type === "wordtrail"
            ? words.map(word => `<section data-discovery-item>${field("term", word.term)}${field("clue", word.clue)}</section>`).join("")
            : worksheet.activities.connections.rounds.map(round => `<section data-discovery-item>${field("answer", round.answer)}${field("clues", round.clues.join("\n"))}${field("explanation", round.explanation)}</section>`).join("") };
    }
    // Deliberate demo content, independent from the blank starting editors.
    // Fields use the same contract as the production runtimes; no generation calls.
    function draft(type) {
        if (["wordtrail", "connections"].includes(type)) return discoveryDraft(type);
        const field = (attribute, value) => `<textarea ${attribute}>${escape(value)}</textarea>`;
        const card = (attribute, fields, prefix = "") => `<section ${attribute}>${Object.entries(fields).map(([key, value]) => field(prefix ? `data-${prefix}-${key}` : `data-field="${key}"`, value)).join("")}</section>`;
        const palette = ["#a9d6c6", "#b3cceb", "#eec27c", "#c3b0dd", "#efb5ab", "#cad69e"];
        const pairs = [["go", "went"], ["come", "came"], ["take", "took"], ["give", "gave"], ["eat", "ate"], ["see", "saw"]];
        if (type === "slides") return { controls: { "slides-tema": "Uma viagem pelo Sistema Solar" }, stackHtml: [
            { "slide-title": "Uma viagem pelo Sistema Solar", "slide-subtitle": "O que existe além da Terra?", "slide-body": "Uma estrela, oito planetas e muitas descobertas.\nVamos explorar juntos os nossos vizinhos no espaço.\nIlustração conceitual, sem escala.", "slide-image-url": "../assets/img/landing-solar.svg", "slide-color": "#e9e0f3", "slide-accent-color": "#765a95" },
            { "slide-title": "O Sol é uma estrela", "slide-subtitle": "Nossa principal fonte de luz e calor", "slide-body": "A luz solar leva cerca de 8 minutos para chegar à Terra.\nA energia do Sol ajuda as plantas a produzir seu alimento.\nOs planetas orbitam o Sol por causa da gravidade.", "slide-color": "#fff0cf", "slide-accent-color": "#ac751e" },
            { "slide-title": "Um planeta para cuidar", "slide-subtitle": "A Terra é a nossa casa no espaço", "slide-body": "Água líquida, atmosfera e energia solar ajudam a sustentar a vida.\nQue ações podemos realizar para cuidar do nosso planeta?", "slide-color": "#dceee4", "slide-accent-color": "#357465" }
        ].map(item => card("data-slide-card", { ...item, "slide-text-color": "#233d3a" })).join("") };
        if (type === "quiz") return { controls: { "quiz-tema": "Descobrindo o Sistema Solar" }, stackHtml: [
            ["Qual é a estrela do nosso Sistema Solar?", ["Sol", "Lua", "Terra", "Marte"], "O Sol é uma estrela: ele produz sua própria luz e calor."],
            ["Em qual planeta vivemos?", ["Terra", "Vênus", "Saturno", "Júpiter"], "A Terra é o terceiro planeta a partir do Sol."]
        ].map(([prompt, options, explanation]) => `<section data-quiz-question>${field('data-field="prompt"', prompt)}${field('data-field="type"', "Múltipla escolha")}${field('data-field="correct"', "Alternativa A")}${field('data-field="explanation"', explanation)}${options.map((value, i) => field(`data-option data-option-key="Alternativa ${"ABCD"[i]}"`, value)).join("")}</section>`).join("") };
        if (type === "flashcards") return { controls: { "cards-tema": "Verbos no passado", "cards-exemplo": "Sim" }, stackHtml: pairs.slice(0, 3).map(([front, back], i) => card("data-flashcard", { front, back, example: ["Yesterday, I went to school.", "She came home early.", "We took the bus yesterday."][i], "front-color": palette[i], "back-color": "#fff5dc" })).join("") };
        if (type === "memory") return { controls: { "memoria-titulo": "Encontre os pares: presente e passado" }, stackHtml: pairs.map(([front, back], i) => card("data-memory-pair", { front, back, color: palette[i] }, "memory")).join("") };
        if (type === "wheel") return { controls: { "roleta-titulo": "Uma rodada de descobertas" }, stackHtml: ["Diga o nome de um planeta", "O que o Sol fornece à Terra?", "Por que devemos cuidar da água?", "Cite um movimento da Terra", "O que podemos observar no céu?", "Faça uma pergunta para a turma"].map((text, i) => card("data-wheel-segment", { text, color: palette[i] }, "wheel")).join("") };
        if (type === "match") return { controls: { "ligar-titulo": "Ligue cada verbo ao seu passado", "ligar-coluna-a": "Presente", "ligar-coluna-b": "Passado", "ligar-cores": "same" }, stackHtml: pairs.slice(0, 4).map(([left, right]) => card("data-match-pair", { left, right }, "match")).join("") };
        if (type === "mindmap") return { controls: { "mapa-centro": "Sistema Solar", "mapa-subtitulo": "Explore as conexões", "mapa-layout": "Radial" }, stackHtml: [
            ["Sol", "Nossa estrela", "O Sol é a principal fonte de luz e calor do Sistema Solar."],
            ["Planetas", "Oito vizinhos no espaço", "Os quatro planetas mais próximos do Sol são rochosos. Os quatro mais distantes são gigantes gasosos ou de gelo."],
            ["Lua", "Satélite natural da Terra", "A Lua orbita a Terra e reflete a luz do Sol."],
            ["Movimentos", "Rotação e translação", "A Terra gira em torno do próprio eixo e percorre uma órbita ao redor do Sol."]
        ].map(([title, subtitle, detail], i) => card("data-mind-branch", { title, subtitle, detail, color: palette[i] }, "mind")).join("") };
        if (type === "debate") return { controls: { "debate-titulo": "Tecnologia na escola", "debate-formato": "Dois lados", "debate-pergunta": "Devemos usar celulares nas atividades em sala?", "debate-lado-a": "Defender o uso orientado", "debate-lado-b": "Apontar riscos e limites" }, stackHtml: [
            ["Prepare sua posição", "Que exemplo ajuda a defender seu ponto de vista?", "Conversem com o grupo e escolham um argumento. Ouçam os colegas com respeito."],
            ["Troca de argumentos", "Como responder ao argumento do outro grupo?", "Cada grupo tem sua vez. Usem exemplos e proponham soluções para os problemas apresentados."],
            ["Construam uma conclusão", "Em que pontos a turma conseguiu concordar?", "Registrem uma regra de uso que considere benefícios e cuidados."]
        ].map(([title, question, guidance]) => card("data-debate-step", { title, question, guidance, time: "3 min" }, "debate")).join("") };
        if (type === "wordsearch") return { controls: { "caca-titulo": "Verbos em inglês no passado", "caca-subtitulo": "Encontre os verbos e relembre seus significados.", "caca-grade": "8", "caca-direcoes": "basic" }, stackHtml: words.map(word => card("data-wordsearch-word", word, "wordsearch")).join("") };
        if (type === "crossword") return { controls: { "cruzada-titulo": "Complete os verbos no passado" }, stackHtml: worksheet.activities.crossword.words.map(word => card("data-crossword-entry", { answer: word.term, clue: word.clue }, "crossword")).join("") };
        if (type === "hangman") return { controls: { "forca-titulo": "Explorando o espaço" }, stackHtml: card("data-hangman-entry", { answer: "PLANETA", clue: "A Terra é um deles. Orbita uma estrela.", category: "Astronomia" }, "hangman") };
        throw new Error(`Example draft not registered: ${type}`);
    }
    return Object.freeze({ tools, scripts, worksheet, discoveryDraft, draft, escape });
});
