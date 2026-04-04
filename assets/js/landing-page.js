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
        const teacherName = teacher.name || "Professor";
        updateLandingLink("[data-landing-nav-primary]", "plataforma/index.html", "Abrir painel");
        updateLandingLink("[data-landing-nav-secondary]", "plataforma/biblioteca.html", "Biblioteca");
        updateLandingLink("[data-landing-hero-primary]", "plataforma/index.html", "Abrir painel");
        updateLandingLink("[data-landing-hero-secondary]", "plataforma/biblioteca.html", "Ir para biblioteca");
        updateLandingLink("[data-landing-cta-primary]", "plataforma/index.html", "Abrir painel");
        updateLandingLink("[data-landing-cta-secondary]", "plataforma/biblioteca.html", "Ir para biblioteca");

        const status = document.querySelector("[data-landing-status]");
        if (status) {
            status.innerHTML = `<strong>${teacherName}, sua conta já está ativa.</strong> Você pode entrar direto no painel ou abrir sua biblioteca.`;
        }
        return;
    }

    updateLandingLink("[data-landing-nav-primary]", "cadastro.html", "Criar conta");
    updateLandingLink("[data-landing-nav-secondary]", "login.html", "Entrar");
    updateLandingLink("[data-landing-hero-primary]", "cadastro.html", "Começar agora");
    updateLandingLink("[data-landing-hero-secondary]", "login.html", "Já tenho conta");
    updateLandingLink("[data-landing-cta-primary]", "cadastro.html", "Criar conta");
    updateLandingLink("[data-landing-cta-secondary]", "login.html", "Entrar");
}

document.addEventListener("DOMContentLoaded", renderLandingState);
document.addEventListener("educaria-auth-changed", renderLandingState);
