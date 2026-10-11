function landingTeacher() {
    if (typeof readCurrentTeacher === "function") {
        return readCurrentTeacher();
    }
    return null;
}

function updateLandingLink(selector, href, label) {
    document.querySelectorAll(selector).forEach((element) => {
        element.setAttribute("href", href);
        element.textContent = label;
    });
}

function renderLandingState() {
    const teacher = landingTeacher();
    const authenticated = Boolean(teacher?.uid || teacher?.email);

    if (authenticated) {
        updateLandingLink("[data-landing-hero-primary]", "plataforma/index.html", "Criar nova atividade");
        updateLandingLink("[data-landing-cta-primary]", "plataforma/index.html", "Abrir painel");
        updateLandingLink("[data-landing-cta-secondary]", "plataforma/biblioteca.html", "Ir para biblioteca");
        updateLandingLink("[data-landing-example-cta]", "plataforma/index.html", "Criar com meu conteúdo →");
        updateLandingLink("[data-landing-lesson-cta]", "plataforma/criar-aula.html", "Montar minha sequência →");
        return;
    }

    updateLandingLink("[data-landing-hero-primary]", "cadastro.html", "Criar minha primeira atividade");
    updateLandingLink("[data-landing-cta-primary]", "cadastro.html", "Criar conta");
    updateLandingLink("[data-landing-cta-secondary]", "login.html", "Entrar");
    updateLandingLink("[data-landing-example-cta]", "cadastro.html", "Criar com meu conteúdo →");
    updateLandingLink("[data-landing-lesson-cta]", "cadastro.html", "Montar minha sequência →");
}

document.addEventListener("DOMContentLoaded", renderLandingState);
document.addEventListener("educaria-auth-changed", renderLandingState);

function initializeLandingLogin() {
    const toggle = document.querySelector("[data-landing-login-toggle]");
    const panel = document.querySelector("#landing-login-panel");
    const email = document.querySelector("#landing-login-email");
    if (!toggle || !panel) return;

    toggle.addEventListener("click", () => {
        const isOpening = panel.hidden;
        panel.hidden = !isOpening;
        toggle.setAttribute("aria-expanded", String(isOpening));
        if (isOpening) email?.focus();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || panel.hidden) return;
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
    });
}

document.addEventListener("DOMContentLoaded", initializeLandingLogin);

// Fixed, local examples only: no AI requests, account writes or saved teacher materials.
function initializeLandingShowcase() {
    const root = document.querySelector("[data-landing-showcase]");
    if (!root || root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";
    const all = (selector) => Array.from(root.querySelectorAll(selector));
    const one = (selector) => root.querySelector(selector);
    const tabs = all("[data-demo-tab]");
    const panels = all('[role="tabpanel"]');
    const selectTab = (tab, focus = false) => {
        tabs.forEach((item) => {
            const selected = item === tab;
            item.setAttribute("aria-selected", String(selected));
            item.tabIndex = selected ? 0 : -1;
        });
        panels.forEach((panel) => { panel.hidden = panel.id !== tab.getAttribute("aria-controls"); });
        if (focus) tab.focus();
    };
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => selectTab(tab));
        tab.addEventListener("keydown", (event) => {
            let target;
            if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
            if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
            if (event.key === "Home") target = 0;
            if (event.key === "End") target = tabs.length - 1;
            if (target === undefined) return;
            event.preventDefault();
            selectTab(tabs[target], true);
        });
    });

    let slideIndex = 0;
    const slides = all("[data-sample-slide]");
    all("[data-slide-step]").forEach((button) => button.addEventListener("click", () => {
        slideIndex = (slideIndex + Number(button.dataset.slideStep) + slides.length) % slides.length;
        slides.forEach((slide, index) => { slide.hidden = index !== slideIndex; });
        one("[data-slide-counter]").textContent = `Slide ${slideIndex + 1} de ${slides.length}`;
    }));

    const answers = all("[data-quiz-answer]");
    answers.forEach((button) => button.addEventListener("click", () => {
        answers.forEach((answer) => {
            answer.classList.remove("is-incorrect", "is-correct");
            answer.setAttribute("aria-pressed", String(answer === button));
        });
        const correct = button.dataset.quizAnswer === "mars";
        button.classList.add(correct ? "is-correct" : "is-incorrect");
        one("[data-quiz-feedback]").textContent = correct
            ? "✓ Isso! Marte tem óxido de ferro no solo, que dá a ele uma cor avermelhada."
            : "Ainda não! Dica: o nome desse planeta começa com M. Tente novamente.";
    }));
    one("[data-quiz-reset]").addEventListener("click", () => {
        answers.forEach((answer) => {
            answer.classList.remove("is-incorrect", "is-correct");
            answer.setAttribute("aria-pressed", "false");
        });
        one("[data-quiz-feedback]").textContent = "Qual seria o palpite da sua turma?";
    });

    let flipped = false;
    const flashcard = one("[data-demo-flip]");
    flashcard.addEventListener("click", () => {
        flipped = !flipped;
        flashcard.classList.toggle("is-flipped", flipped);
        flashcard.setAttribute("aria-label", flipped ? "Virar flashcard para ver a pergunta" : "Virar flashcard para ver a resposta");
        one("[data-flashcard-side]").textContent = flipped ? "VERSO · 01" : "FRENTE · 01";
        one("[data-flashcard-text]").textContent = flipped ? "É uma estrela! O Sol produz a luz e o calor que chegam à Terra." : "O Sol é um planeta ou uma estrela?";
        one("[data-flashcard-action]").textContent = flipped ? "Ver pergunta ↻" : "Ver resposta ↻";
        one("[data-flashcard-status]").textContent = flipped ? "Resposta: o Sol é uma estrela." : "Pergunta: o Sol é um planeta ou uma estrela?";
    });

    const cards = all("[data-memory-pair]");
    let openCards = [];
    let matches = 0;
    const hideCard = (card) => {
        card.classList.remove("is-open", "is-matched");
        card.textContent = "✦";
        card.setAttribute("aria-label", `Revelar cartão ${cards.indexOf(card) + 1}`);
        card.setAttribute("aria-disabled", "false");
    };
    cards.forEach((card) => card.addEventListener("click", () => {
        if (card.classList.contains("is-matched")) return;
        // An unmatched pair stays visible until the next selection, with no reading time limit.
        if (openCards.length === 2) {
            openCards.forEach(hideCard);
            openCards = [];
        }
        if (openCards.includes(card)) return;
        card.classList.add("is-open");
        card.textContent = card.dataset.memoryText;
        card.setAttribute("aria-label", `Cartão ${cards.indexOf(card) + 1}: ${card.dataset.memoryText}`);
        openCards.push(card);
        if (openCards.length === 1) {
            one("[data-memory-feedback]").textContent = `${card.dataset.memoryText}. Agora encontre o par.`;
        } else if (openCards[0].dataset.memoryPair === card.dataset.memoryPair) {
            matches += 1;
            openCards.forEach((matched) => {
                matched.classList.add("is-matched");
                matched.textContent = `✓ ${matched.dataset.memoryText}`;
                matched.setAttribute("aria-disabled", "true");
                matched.setAttribute("aria-label", `Par encontrado: ${matched.dataset.memoryText}`);
            });
            openCards = [];
            one("[data-memory-feedback]").textContent = matches === 3 ? "✓ Todos os pares encontrados! Que tal jogar com o conteúdo da sua aula?" : `✓ Boa conexão! ${matches} de 3 pares encontrados.`;
        } else {
            one("[data-memory-feedback]").textContent = "Essas ideias não formam um par. Escolha um cartão para tentar de novo.";
        }
    }));
    one("[data-memory-reset]").addEventListener("click", () => {
        cards.forEach(hideCard);
        openCards = [];
        matches = 0;
        one("[data-memory-feedback]").textContent = "Encontre os 3 pares de ideias.";
    });

    const mapContent = {
        sun: ["O Sol", "A estrela no centro do Sistema Solar. Sua luz e seu calor são essenciais para a vida na Terra."],
        planets: ["Os planetas", "Oito planetas giram ao redor do Sol. A Terra é o terceiro, entre Vênus e Marte."],
        moons: ["Os satélites", "Satélites naturais orbitam planetas. A Lua é o satélite natural da Terra."]
    };
    const nodes = all("[data-map-node]");
    nodes.forEach((node) => node.addEventListener("click", () => {
        nodes.forEach((item) => item.setAttribute("aria-pressed", String(item === node)));
        const [title, text] = mapContent[node.dataset.mapNode];
        one("[data-map-title]").textContent = title;
        one("[data-map-text]").textContent = text;
    }));

    let rotation = 0;
    const spin = one("[data-wheel-spin]");
    spin.addEventListener("click", () => {
        if (spin.disabled) return;
        const index = Math.floor(Math.random() * 4);
        const target = (360 - index * 90) % 360;
        rotation += 720 + (target - rotation % 360 + 360) % 360;
        spin.disabled = true;
        one("[data-wheel-feedback]").textContent = "Sorteando o próximo tema…";
        one("[data-demo-wheel]").style.transform = `rotate(${rotation}deg)`;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.setTimeout(() => {
            one("[data-wheel-feedback]").textContent = `Tema sorteado: ${["Sol", "Terra", "Lua", "Marte"][index]}. O que a turma sabe sobre ele?`;
            spin.disabled = false;
        }, reducedMotion ? 0 : 1150);
    });
}

document.addEventListener("DOMContentLoaded", initializeLandingShowcase);
