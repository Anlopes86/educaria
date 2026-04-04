const EDUCARIA_SESSION_KEY = "educaria:auth:session";
const EDUCARIA_TEACHER_CACHE_KEY = "educaria:auth:teacher-cache";

function authLoginPath() {
    return window.location.pathname.includes("/plataforma/") ? "../login.html" : "login.html";
}

function authDashboardPath() {
    return window.location.pathname.includes("/plataforma/") ? "index.html" : "plataforma/index.html";
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function firebaseConfig() {
    return window.EDUCARIA_FIREBASE_CONFIG || {};
}

function firebaseConfigReady() {
    return Object.values(firebaseConfig()).every((value) => {
        return typeof value === "string" && value.trim() && !value.startsWith("COLE_AQUI");
    });
}

function firebaseServices() {
    if (!firebaseConfigReady() || typeof firebase === "undefined") return null;

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig());
    }

    const auth = firebase.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    return {
        auth,
        db: firebase.firestore()
    };
}

function saveSessionEmail(email) {
    try {
        localStorage.setItem(EDUCARIA_SESSION_KEY, normalizeEmail(email));
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

function readCachedTeacher() {
    try {
        const raw = localStorage.getItem(EDUCARIA_TEACHER_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA teacher cache unavailable:", error);
        return null;
    }
}

function writeCachedTeacher(teacher) {
    try {
        if (!teacher) {
            localStorage.removeItem(EDUCARIA_TEACHER_CACHE_KEY);
            return;
        }
        localStorage.setItem(EDUCARIA_TEACHER_CACHE_KEY, JSON.stringify(teacher));
    } catch (error) {
        console.warn("EducarIA teacher cache unavailable:", error);
    }
}

function readCurrentTeacher() {
    return readCachedTeacher();
}

window.readCurrentTeacher = readCurrentTeacher;

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

function clearAuthFeedback() {
    const feedback = document.querySelector("[data-auth-feedback]");
    if (!feedback) return;
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.dataset.state = "";
}

function notifyAuthChanged() {
    document.dispatchEvent(new CustomEvent("educaria-auth-changed", {
        detail: { teacher: readCurrentTeacher() }
    }));
}

function showFirebaseConfigMessageIfNeeded() {
    if (firebaseConfigReady()) return false;

    if (document.body?.dataset.authPage === "true") {
        updateAuthFeedback("Configure o Firebase em assets/js/firebase-config.js para ativar login e cadastro reais.", "error");
    }
    return true;
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

function mapFirebaseError(error) {
    const code = error?.code || "";
    if (code === "auth/email-already-in-use") return "Ja existe uma conta com esse email.";
    if (code === "auth/invalid-email") return "Digite um email valido.";
    if (code === "auth/weak-password") return "A senha precisa ser mais forte.";
    if (code === "auth/user-not-found") return "Nenhuma conta encontrada com esse email.";
    if (code === "auth/wrong-password") return "Senha incorreta.";
    if (code === "auth/invalid-credential") return "Email ou senha incorretos.";
    return "Nao foi possivel concluir a autenticacao agora.";
}

function readTeacherProfileFromFirebase(user) {
    const services = firebaseServices();
    if (!services || !user) return Promise.resolve(null);

    return services.db.collection("teachers").doc(user.uid).get().then((snapshot) => {
        const profile = snapshot.exists ? snapshot.data() : {};
        return {
            uid: user.uid,
            name: profile.name || user.displayName || "Professor",
            email: user.email || profile.email || "",
            institution: profile.institution || "Conta educacional"
        };
    });
}

function bindLoginForm() {
    const form = document.querySelector("[data-login-form]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearAuthFeedback();

        const services = firebaseServices();
        const email = normalizeEmail(form.querySelector('input[name="email"]')?.value);
        const password = String(form.querySelector('input[name="password"]')?.value || "").trim();

        if (!services) {
            updateAuthFeedback("Configure o Firebase antes de usar o login.", "error");
            return;
        }

        if (!email) {
            updateAuthFeedback("Digite o email para entrar.", "error");
            return;
        }

        if (!password) {
            updateAuthFeedback("Digite sua senha para continuar.", "error");
            return;
        }

        try {
            updateAuthFeedback("Entrando na sua conta...", "success");
            const credential = await services.auth.signInWithEmailAndPassword(email, password);
            const teacher = await readTeacherProfileFromFirebase(credential.user);
            writeCachedTeacher(teacher);
            saveSessionEmail(credential.user.email || email);
            notifyAuthChanged();
            window.location.href = authNextPath();
        } catch (error) {
            updateAuthFeedback(mapFirebaseError(error), "error");
        }
    });
}

function bindRegisterForm() {
    const form = document.querySelector("[data-register-form]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearAuthFeedback();

        const services = firebaseServices();
        const name = String(form.querySelector('input[name="name"]')?.value || "").trim();
        const email = normalizeEmail(form.querySelector('input[name="email"]')?.value);
        const institution = String(form.querySelector('input[name="institution"]')?.value || "").trim();
        const password = String(form.querySelector('input[name="password"]')?.value || "").trim();
        const passwordConfirm = String(form.querySelector('input[name="password_confirm"]')?.value || "").trim();

        if (!services) {
            updateAuthFeedback("Configure o Firebase antes de usar o cadastro.", "error");
            return;
        }

        if (!name || !email || !institution || !password || !passwordConfirm) {
            updateAuthFeedback("Preencha todos os campos para criar sua conta.", "error");
            return;
        }

        if (password.length < 6) {
            updateAuthFeedback("A senha precisa ter pelo menos 6 caracteres.", "error");
            return;
        }

        if (password !== passwordConfirm) {
            updateAuthFeedback("As senhas nao coincidem. Confira e tente novamente.", "error");
            return;
        }

        try {
            updateAuthFeedback("Criando sua conta...", "success");
            const credential = await services.auth.createUserWithEmailAndPassword(email, password);
            await credential.user.updateProfile({ displayName: name });
            await services.db.collection("teachers").doc(credential.user.uid).set({
                name,
                email,
                institution,
                createdAt: new Date().toISOString()
            }, { merge: true });

            const teacher = await readTeacherProfileFromFirebase(credential.user);
            writeCachedTeacher(teacher);
            saveSessionEmail(credential.user.email || email);
            notifyAuthChanged();
            window.location.href = authNextPath();
        } catch (error) {
            updateAuthFeedback(mapFirebaseError(error), "error");
        }
    });
}

function bindLogout() {
    document.querySelectorAll("[data-logout]").forEach((button) => {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            writeCachedTeacher(null);
            clearSessionEmail();
            notifyAuthChanged();

            const services = firebaseServices();
            if (services) {
                try {
                    await services.auth.signOut();
                } catch (error) {
                    console.warn("EducarIA logout unavailable:", error);
                }
            }

            window.location.href = authLoginPath();
        });
    });
}

function syncAuthStateWithFirebase() {
    const services = firebaseServices();
    if (!services) {
        enforceAuth();
        return;
    }

    services.auth.onAuthStateChanged(async (user) => {
        if (!user) {
            writeCachedTeacher(null);
            clearSessionEmail();
            notifyAuthChanged();
            enforceAuth();
            return;
        }

        const teacher = await readTeacherProfileFromFirebase(user);
        writeCachedTeacher(teacher);
        saveSessionEmail(user.email || teacher?.email || "");
        notifyAuthChanged();
        redirectAuthenticatedFromAuthPages();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    showFirebaseConfigMessageIfNeeded();
    redirectAuthenticatedFromAuthPages();
    enforceAuth();
    bindLoginForm();
    bindRegisterForm();
    bindLogout();
    syncAuthStateWithFirebase();
});
