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
        updateLandingLink("[data-landing-nav-primary]", "plataforma/index.html", "Abrir painel");
        updateLandingLink("[data-landing-nav-secondary]", "plataforma/biblioteca.html", "Biblioteca");
        updateLandingLink("[data-landing-cta-primary]", "plataforma/index.html", "Abrir painel");
        updateLandingLink("[data-landing-cta-secondary]", "plataforma/biblioteca.html", "Ir para biblioteca");
        return;
    }

    updateLandingLink("[data-landing-nav-primary]", "cadastro.html", "Criar conta");
    updateLandingLink("[data-landing-nav-secondary]", "login.html", "Entrar");
    updateLandingLink("[data-landing-cta-primary]", "cadastro.html", "Criar conta");
    updateLandingLink("[data-landing-cta-secondary]", "login.html", "Entrar");
}

document.addEventListener("DOMContentLoaded", renderLandingState);
document.addEventListener("educaria-auth-changed", renderLandingState);
