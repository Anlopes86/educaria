function parseFlashcardsCount() {
    const field = document.getElementById("cards-quantidade");
    if (!field) return 8;
    const match = field.value.match(/\d+/);
    return match ? Number(match[0]) : 8;
}

function normalizeTopic(topic) {
    return String(topic || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function paletteForTopic(topic) {
    const text = normalizeTopic(topic);
    if (text.includes("hist")) return { front: "#fef3c7", back: "#fde68a", text: "#422006" };
    if (text.includes("mat") || text.includes("frac")) return { front: "#ede9fe", back: "#ddd6fe", text: "#312e81" };
    if (text.includes("bio") || text.includes("ciencia") || text.includes("solar")) return { front: "#dcfce7", back: "#bbf7d0", text: "#14532d" };
    if (text.includes("geo")) return { front: "#ecfccb", back: "#d9f99d", text: "#365314" };
    if (text.includes("port") || text.includes("texto") || text.includes("gram")) return { front: "#fee2e2", back: "#fecaca", text: "#7f1d1d" };
    return { front: "#ffffff", back: "#dbeafe", text: "#0f172a" };
}

function generatePairs(topic, count) {
    const text = normalizeTopic(topic);

    const packs = {
        technology: [
            ["keyboard", "teclado", "The keyboard is on the desk."],
            ["screen", "tela", "The screen is very bright today."],
            ["headphones", "fones de ouvido", "She uses headphones during the activity."],
            ["mouse", "mouse", "Move the mouse to open the file."],
            ["tablet", "tablet", "The tablet is charged and ready."],
            ["password", "senha", "Do not share your password."],
            ["website", "site", "The class website has the homework."],
            ["download", "baixar", "Students download the worksheet first."],
            ["upload", "enviar arquivo", "Please upload your project today."],
            ["folder", "pasta", "Save the image in the folder."],
            ["printer", "impressora", "The printer is next to the teacher."],
            ["camera", "camera", "The camera records the presentation."]
        ],
        solar: [
            ["Mercurio", "Planeta rochoso", "Mercurio e o planeta mais proximo do Sol."],
            ["Venus", "Atmosfera muito densa", "Venus tem temperaturas extremamente altas."],
            ["Terra", "Planeta com agua liquida", "A Terra abriga diferentes formas de vida."],
            ["Marte", "Planeta vermelho", "Marte tem solo rico em ferro."],
            ["Jupiter", "Maior planeta do sistema solar", "Jupiter possui uma grande mancha vermelha."],
            ["Saturno", "Planeta com aneis", "Saturno e conhecido por seus aneis visiveis."],
            ["Urano", "Gigante gelado", "Urano gira com o eixo muito inclinado."],
            ["Netuno", "Ventos intensos", "Netuno fica muito distante do Sol."],
            ["Asteroides", "Corpos rochosos", "Muitos asteroides ficam entre Marte e Jupiter."],
            ["Cometas", "Corpos com gelo e poeira", "Cometas formam caudas ao se aproximarem do Sol."]
        ],
        fractions: [
            ["1/2", "metade", "Dois pedacos iguais formam uma metade."],
            ["1/3", "um terco", "Divida o inteiro em tres partes iguais."],
            ["1/4", "um quarto", "Um quarto corresponde a uma de quatro partes."],
            ["Numerador", "parte de cima da fracao", "O numerador mostra quantas partes foram consideradas."],
            ["Denominador", "parte de baixo da fracao", "O denominador mostra em quantas partes o inteiro foi dividido."],
            ["Fracoes equivalentes", "mesmo valor com escrita diferente", "1/2 e 2/4 sao equivalentes."],
            ["Fracao propria", "menor que 1", "3/5 e um exemplo de fracao propria."],
            ["Fracao impropria", "maior ou igual a 1", "5/4 e uma fracao impropria."],
            ["Simplificar", "reduzir a fracao", "4/8 pode ser simplificada para 1/2."],
            ["Comparar fracoes", "ver qual e maior ou menor", "Use o mesmo denominador para comparar."]
        ]
    };

    let base = packs.technology;
    if (text.includes("solar") || text.includes("planeta") || text.includes("astr")) base = packs.solar;
    if (text.includes("frac")) base = packs.fractions;

    return base.slice(0, count).map(([front, back, example]) => ({ front, back, example }));
}

function applyGeneratedFlashcards() {
    const stack = document.querySelector("[data-flashcards-stack]");
    if (!stack) return;

    const topicField = document.getElementById("cards-tema");
    const count = parseFlashcardsCount();
    const topic = topicField ? topicField.value.trim() : "Flashcards";
    const cards = generatePairs(topic, count);
    const palette = paletteForTopic(topic);
    const template = stack.querySelector("[data-flashcard]");
    if (!template) return;

    stack.innerHTML = "";

    cards.forEach((item, index) => {
        const card = template.cloneNode(true);
        const label = card.querySelector("[data-card-label]");
        if (label) label.textContent = `Card ${index + 1}`;

        const front = card.querySelector('[data-field="front"]');
        const back = card.querySelector('[data-field="back"]');
        const example = card.querySelector('[data-field="example"]');
        const frontColor = card.querySelector('[data-field="front-color"]');
        const backColor = card.querySelector('[data-field="back-color"]');
        const textColor = card.querySelector('[data-field="text-color"]');

        if (front) front.value = item.front;
        if (back) back.value = item.back;
        if (example) example.value = item.example;
        if (frontColor) frontColor.value = palette.front;
        if (backColor) backColor.value = palette.back;
        if (textColor) textColor.value = palette.text;

        stack.appendChild(card);
    });

    document.dispatchEvent(new Event("input"));
    document.dispatchEvent(new Event("change"));
}

document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-generate-flashcards]");
        if (!button) return;

        event.preventDefault();
        applyGeneratedFlashcards();
    });
});
