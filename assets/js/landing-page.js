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
        updateLandingLink("[data-landing-print-cta]", "plataforma/folha-atividades-builder.html?new=1", "Criar folha de atividades →");
        return;
    }

    updateLandingLink("[data-landing-hero-primary]", "cadastro.html", "Criar minha primeira atividade");
    updateLandingLink("[data-landing-cta-primary]", "cadastro.html", "Criar conta");
    updateLandingLink("[data-landing-cta-secondary]", "login.html", "Entrar");
    updateLandingLink("[data-landing-example-cta]", "cadastro.html", "Criar com meu conteúdo →");
    updateLandingLink("[data-landing-lesson-cta]", "cadastro.html", "Montar minha sequência →");
    updateLandingLink("[data-landing-print-cta]", "cadastro.html", "Criar folha de atividades →");
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

// Static captures of activities created in the platform: no AI calls or account writes.
function initializeLandingShowcase() {
    const root = document.querySelector("[data-landing-showcase]");
    if (!root || root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";
    const tabs = Array.from(root.querySelectorAll("[data-demo-tab]"));
    const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
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
}

function initializeLandingExampleViewer() {
    const dialog = document.querySelector("#landing-example-dialog");
    if (!dialog || typeof dialog.showModal !== "function" || dialog.dataset.initialized === "true") return;
    dialog.dataset.initialized = "true";
    const image = dialog.querySelector("[data-example-image]");
    const title = dialog.querySelector("#landing-example-title");
    const description = dialog.querySelector("#landing-example-description");
    const close = dialog.querySelector("[data-example-close]");
    let opener = null;
    document.querySelectorAll("[data-example-open]").forEach((link) => {
        link.addEventListener("click", (event) => {
            // Preserve opening in another tab, and the image link when dialog is unavailable.
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
            event.preventDefault();
            opener = link;
            const preview = link.querySelector("img");
            image.src = link.getAttribute("href");
            image.alt = preview?.alt || link.dataset.exampleTitle;
            title.textContent = link.dataset.exampleTitle;
            description.textContent = link.dataset.exampleDescription;
            dialog.showModal();
            close.focus();
        });
    });
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    // Native dialog handles Escape, traps focus and makes the rest of the page inert.
    dialog.addEventListener("close", () => {
        image.removeAttribute("src");
        if (opener?.isConnected) opener.focus({ preventScroll: true });
        opener = null;
    });
}

document.addEventListener("DOMContentLoaded", initializeLandingShowcase);
document.addEventListener("DOMContentLoaded", initializeLandingExampleViewer);
