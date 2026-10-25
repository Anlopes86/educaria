(function (root) {
    "use strict";
    const data = name => `[data-${name}]`, field = name => `[data-field="${name}"]`;
    const mapped = (prefix, keys) => Object.fromEntries(keys.map(key => [key, data(`${prefix}-${key}`)]));
    const configs = {
        slides: { stack: data("slides-stack"), card: data("slide-card"), fields: Object.fromEntries(["title", "subtitle", "body"].map(key => [key, field(`slide-${key}`)])), context: { title: "slides-fonte-texto", audience: "slides-publico" } },
        quiz: { stack: data("quiz-stack"), card: data("quiz-question"), fields: Object.fromEntries(["prompt", "correct", "explanation", "criteria", "model"].map(key => [key, field(key)])), context: { title: "quiz-tema", audience: "quiz-ano" } },
        flashcards: { stack: data("flashcards-stack"), card: data("flashcard"), fields: Object.fromEntries(["front", "back", "example"].map(key => [key, field(key)])), context: { title: "cards-tema", audience: "cards-ano" } },
        memory: { stack: data("memory-pairs"), card: data("memory-pair"), fields: mapped("memory", ["front", "back"]), context: { title: "memoria-titulo", audience: "memoria-ano" } },
        match: { stack: data("match-pairs"), card: data("match-pair"), fields: mapped("match", ["left", "right"]), context: { title: "ligar-titulo", audience: "ligar-ano" } },
        wheel: { stack: data("wheel-segments"), card: data("wheel-segment"), fields: mapped("wheel", ["text"]), context: { title: "roleta-titulo", audience: "roleta-ano" } },
        mindmap: { stack: data("mind-branches"), card: data("mind-branch"), fields: mapped("mind", ["title", "subtitle", "detail"]), context: { title: "mapa-centro", description: "mapa-subtitulo", format: "mapa-layout" } },
        debate: { stack: data("debate-steps"), card: data("debate-step"), fields: mapped("debate", ["title", "time", "question", "guidance"]), context: { title: "debate-titulo", description: "debate-pergunta", format: "debate-formato", sideA: "debate-lado-a", sideB: "debate-lado-b" } },
        hangman: { stack: data("hangman-entries"), card: data("hangman-entry"), fields: mapped("hangman", ["answer", "clue", "category"]), context: { title: "forca-titulo", audience: "forca-ano" } },
        wordsearch: { stack: data("wordsearch-words"), card: data("wordsearch-word"), fields: mapped("wordsearch", ["term", "clue"]), context: { title: "caca-titulo", description: "caca-subtitulo" } },
        crossword: { stack: data("crossword-entries"), card: data("crossword-entry"), fields: mapped("crossword", ["answer", "clue"]), context: { title: "cruzada-titulo", description: "cruzada-subtitulo" } },
        wordtrail: { stack: data("discovery-items"), card: data("discovery-item"), fields: mapped("discovery", ["term", "clue"]), context: { title: "discovery-title", description: "discovery-subtitle", audience: "discovery-audience" } },
        connections: { stack: data("discovery-items"), card: data("discovery-item"), fields: mapped("discovery", ["answer", "clues", "explanation"]), context: { title: "discovery-title", description: "discovery-subtitle", audience: "discovery-audience" } }
    };
    function kind(card) {
        const value = (card.querySelector(field("type"))?.value || "").toLowerCase();
        return /aberta|curta|short_answer/.test(value) ? "short_answer" : /verdadeiro|true_false/.test(value) ? "true_false" : "multiple_choice";
    }
    function control(card, config, key) {
        if (/^option[A-D]$/.test(key)) return card.querySelectorAll("[data-option]")[key.charCodeAt(6) - 65];
        return card.querySelector(config.fields[key]);
    }
    function readCard(type, card, config = configs[type]) {
        const input = type === "quiz" ? { kind: kind(card) } : {};
        for (const key of Object.keys(root.EducariaItemRefinement.fields(type, input))) {
            const value = control(card, config, key)?.value || "";
            input[key] = key === "correct" ? (value.match(/[ABCD]$/)?.[0] || (value.toLowerCase() === "falso" ? "B" : "A")) : value;
        }
        return input;
    }
    function writeCard(type, card, patch, config = configs[type]) {
        const entries = Object.entries(patch).filter(([key]) => key !== "kind").map(([key, value]) => {
            const node = control(card, config, key);
            if (!node) throw new Error("O editor mudou. Feche o ajuste e abra novamente.");
            if (key === "correct") value = `Alternativa ${value}`;
            return { node, value };
        });
        entries.forEach(({ node, value }) => { node.value = value; });
    }
    function contextFromControls(config, values) {
        return Object.fromEntries(Object.entries(config.context).map(([key, id]) => [key, String(values ? values[id] || "" : document.getElementById(id)?.value || "").slice(0, key === "description" ? 1500 : key === "title" ? 300 : 200)]));
    }
    function group(type, host, config) {
        return { type, host, cards: () => [...host.querySelectorAll(config.card)],
            read: card => readCard(type, card, config), context: () => contextFromControls(config),
            commit(changes) {
                // Validate every target before changing any of them.
                changes.forEach(({ card, patch }) => Object.keys(patch).filter(key => key !== "kind").forEach(key => {
                    if (!control(card, config, key)) throw new Error("Um campo não está mais disponível.");
                }));
                changes.forEach(({ card, patch }) => writeCard(type, card, patch, config));
                changes.forEach(({ card }) => {
                    const target = control(card, config, Object.keys(root.EducariaItemRefinement.fields(type, readCard(type, card, config)))[0]);
                    target.dispatchEvent(new Event("input", { bubbles: true }));
                    target.dispatchEvent(new Event("change", { bubbles: true }));
                });
            } };
    }
    function groups() {
        const type = document.body.dataset.materialType;
        if (configs[type]) {
            const host = document.querySelector(configs[type].stack);
            return host ? [group(type, host, configs[type])] : [];
        }
        if (type === "worksheet") return [...document.querySelectorAll("[data-worksheet-activity]")].map(host => {
            const type = host.dataset.worksheetActivity, config = configs[type];
            if (!config) return null;
            const fields = type === "connections" ? mapped("ws", ["answer", "clues", "explanation"])
                : type === "crossword" ? { answer: data("ws-term"), clue: data("ws-clue") } : mapped("ws", ["term", "clue"]);
            const adapted = group(type, host, { ...config, card: type === "connections" ? data("ws-round") : data("ws-word"), fields,
                context: { title: "worksheet-title", audience: "worksheet-audience" } });
            const context = adapted.context;
            adapted.context = () => ({ ...context(), surface: "print", description: host.querySelector("[data-ws-instruction]")?.value || "" });
            return adapted;
        }).filter(Boolean);
        if (type === "lesson" && typeof root.educariaLessonRefinementGroups === "function") return root.educariaLessonRefinementGroups();
        return [];
    }
    root.EducariaItemRefinementAdapters = Object.freeze({ groups, configs, readCard, writeCard, contextFromControls });
})(window);
