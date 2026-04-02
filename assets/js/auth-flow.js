const EDUCARIA_PROFILE_KEY = "educaria:auth:profile";
const EDUCARIA_SESSION_KEY = "educaria:auth:session";

function authLoginPath() {
    return window.location.pathname.includes("/plataforma/") ? "../login.html" : "login.html";
}

function authDashboardPath() {
    return window.location.pathname.includes("/plataforma/") ? "index.html" : "plataforma/index.html";
}

function readTeacherProfile() {
    try {
        const raw = localStorage.getItem(EDUCARIA_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA auth profile unavailable:", error);
        return null;
    }
}

function saveTeacherProfile(profile) {
    try {
        localStorage.setItem(EDUCARIA_PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
        console.warn("EducarIA auth profile unavailable:", error);
    }
}

function readSessionEmail() {
    try {
        return localStorage.getItem(EDUCARIA_SESSION_KEY) || "";
    } catch (error) {
        console.warn("EducarIA auth session unavailable:", error);
        return "";
    }
}

function saveSessionEmail(email) {
    try {
        localStorage.setItem(EDUCARIA_SESSION_KEY, email);
    } catch (error) {
        console.warn("EducarIA auth session unavailable:", error);
    }
}

function clearSessionEmail() {
    try {
        localStorage.removeItem(EDUCARIA_SESSION_KEY);
    } catch (error) {
        console.warn("EducarIA auth session unavailable:", error);
    }
}

function readCurrentTeacher() {
    const profile = readTeacherProfile();
    const sessionEmail = readSessionEmail();
    if (!profile || !sessionEmail) return null;
    return profile.email === sessionEmail ? profile : null;
}

function authNextPath() {
    const params = new URLSearchParams(window.location.search);
    return params.get("next") || authDashboardPath();
}

function updateAuthFeedback(message, type = "neutral") {
    const feedback = document.querySelector("[data-auth-feedback]");
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.dataset.state = type;
}

function hydrateAuthSummary() {
    const teacher = readCurrentTeacher();
    if (!teacher) return;

    document.querySelectorAll("[data-auth-name]").forEach((element) => {
        element.textContent = teacher.name;
    });

    document.querySelectorAll("[data-auth-email]").forEach((element) => {
        element.textContent = teacher.email;
    });

    document.querySelectorAll("[data-auth-institution]").forEach((element) => {
        element.textContent = teacher.institution;
    });
}

function enforceAuth() {
    const requiresAuth = document.body?.dataset.requiresAuth === "true";
    if (!requiresAuth) return;

    if (readCurrentTeacher()) return;

    const next = encodeURIComponent(window.location.pathname.replace(/^\//, ""));
    window.location.href = `${authLoginPath()}?next=${next}`;
}

function redirectAuthenticatedFromAuthPages() {
    const isAuthPage = document.body?.dataset.authPage === "true";
    if (!isAuthPage) return;

    if (!readCurrentTeacher()) return;
    window.location.href = authNextPath();
}

function bindLoginForm() {
    const form = document.querySelector("[data-login-form]");
    if (!form) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const email = String(form.querySelector('input[name="email"]')?.value || "").trim().toLowerCase();
        const profile = readTeacherProfile();

        if (!email) {
            updateAuthFeedback("Digite o email para entrar.", "error");
            return;
        }

        if (!profile || profile.email !== email) {
            updateAuthFeedback("Nenhum cadastro encontrado com esse email. Crie sua conta primeiro.", "error");
            return;
        }

        saveSessionEmail(profile.email);
        updateAuthFeedback("Entrada realizada. Redirecionando para a plataforma...", "success");
        window.setTimeout(() => {
            window.location.href = authNextPath();
        }, 500);
    });
}

function bindRegisterForm() {
    const form = document.querySelector("[data-register-form]");
    if (!form) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const name = String(form.querySelector('input[name="name"]')?.value || "").trim();
        const email = String(form.querySelector('input[name="email"]')?.value || "").trim().toLowerCase();
        const institution = String(form.querySelector('input[name="institution"]')?.value || "").trim();

        if (!name || !email || !institution) {
            updateAuthFeedback("Preencha nome, email e instituicao de ensino para continuar.", "error");
            return;
        }

        const profile = {
            name,
            email,
            institution,
            createdAt: new Date().toISOString()
        };

        saveTeacherProfile(profile);
        saveSessionEmail(profile.email);
        updateAuthFeedback("Cadastro concluido. Redirecionando para a plataforma...", "success");
        window.setTimeout(() => {
            window.location.href = authNextPath();
        }, 500);
    });
}

function bindLogout() {
    document.querySelectorAll("[data-logout]").forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            clearSessionEmail();
            window.location.href = authLoginPath();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    redirectAuthenticatedFromAuthPages();
    enforceAuth();
    hydrateAuthSummary();
    bindLoginForm();
    bindRegisterForm();
    bindLogout();
});
