const SETTINGS_TEACHER_CACHE_KEY = "educaria:auth:teacher-cache";
const SETTINGS_SESSION_KEY = "educaria:auth:session";

function settingsFirebaseReady() {
    const config = window.EDUCARIA_FIREBASE_CONFIG || {};
    return Object.values(config).every((value) => {
        return typeof value === "string" && value.trim() && !value.startsWith("COLE_AQUI");
    });
}

function settingsServices() {
    if (!settingsFirebaseReady() || typeof firebase === "undefined") return null;

    if (!firebase.apps.length) {
        firebase.initializeApp(window.EDUCARIA_FIREBASE_CONFIG);
    }

    return {
        auth: firebase.auth(),
        db: firebase.firestore()
    };
}

function settingsCurrentTeacher() {
    if (typeof readCurrentTeacher === "function") {
        return readCurrentTeacher();
    }
    return null;
}

function settingsWriteTeacherCache(teacher) {
    try {
        localStorage.setItem(SETTINGS_TEACHER_CACHE_KEY, JSON.stringify(teacher));
    } catch (error) {
        console.warn("EducarIA settings cache unavailable:", error);
    }
}

function settingsWriteSessionEmail(email) {
    try {
        localStorage.setItem(SETTINGS_SESSION_KEY, String(email || "").trim().toLowerCase());
    } catch (error) {
        console.warn("EducarIA settings session unavailable:", error);
    }
}

function settingsNotifyTeacherChanged() {
    document.dispatchEvent(new CustomEvent("educaria-auth-changed", {
        detail: { teacher: settingsCurrentTeacher() }
    }));
}

function updateSettingsFeedback(target, message, type) {
    if (!target) return;
    target.hidden = false;
    target.textContent = message;
    target.dataset.state = type;
}

function hydrateSettingsPage() {
    const teacher = settingsCurrentTeacher();
    if (!teacher) return;

    const nameField = document.getElementById("settings-name");
    const emailField = document.getElementById("settings-email");
    const institutionField = document.getElementById("settings-institution");

    if (nameField) nameField.value = teacher.name || "";
    if (emailField) emailField.value = teacher.email || "";
    if (institutionField) institutionField.value = teacher.institution || "";

    document.querySelectorAll("[data-settings-teacher-name]").forEach((element) => {
        element.textContent = teacher.name || "Professor";
    });

    document.querySelectorAll("[data-settings-teacher-email]").forEach((element) => {
        element.textContent = teacher.email || "email@exemplo.com";
    });

    document.querySelectorAll("[data-settings-teacher-school]").forEach((element) => {
        element.textContent = teacher.institution || "Conta educacional";
    });
}

async function handleSettingsProfileSubmit(event) {
    event.preventDefault();

    const services = settingsServices();
    const feedback = document.querySelector("[data-settings-profile-feedback]");
    if (!services) {
        updateSettingsFeedback(feedback, "Configure o Firebase antes de editar o perfil.", "error");
        return;
    }

    const user = services.auth.currentUser;
    if (!user) {
        updateSettingsFeedback(feedback, "Sua sessão expirou. Entre novamente.", "error");
        return;
    }

    const form = event.currentTarget;
    const name = String(form.querySelector('input[name="name"]')?.value || "").trim();
    const email = String(form.querySelector('input[name="email"]')?.value || "").trim().toLowerCase();
    const institution = String(form.querySelector('input[name="institution"]')?.value || "").trim();

    if (!name || !email) {
        updateSettingsFeedback(feedback, "Preencha nome e email para salvar o perfil.", "error");
        return;
    }

    try {
        updateSettingsFeedback(feedback, "Salvando perfil...", "success");

        if (email !== String(user.email || "").trim().toLowerCase()) {
            await user.updateEmail(email);
        }

        await user.updateProfile({ displayName: name });
        await services.db.collection("teachers").doc(user.uid).set({
            name,
            email,
            institution,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        const teacher = {
            uid: user.uid,
            name,
            email,
            institution: institution || "Conta educacional"
        };

        settingsWriteTeacherCache(teacher);
        settingsWriteSessionEmail(email);
        settingsNotifyTeacherChanged();
        hydrateSettingsPage();
        updateSettingsFeedback(feedback, "Perfil atualizado com sucesso.", "success");
    } catch (error) {
        let message = "Não foi possível salvar o perfil agora.";
        if (error?.code === "auth/requires-recent-login") {
            message = "Para alterar o email, entre novamente e tente de novo.";
        } else if (error?.code === "auth/email-already-in-use") {
            message = "Esse email já está em uso por outra conta.";
        } else if (error?.code === "auth/invalid-email") {
            message = "Digite um email válido.";
        }
        updateSettingsFeedback(feedback, message, "error");
    }
}

async function handleSettingsPasswordSubmit(event) {
    event.preventDefault();

    const services = settingsServices();
    const feedback = document.querySelector("[data-settings-password-feedback]");
    if (!services) {
        updateSettingsFeedback(feedback, "Configure o Firebase antes de editar a senha.", "error");
        return;
    }

    const user = services.auth.currentUser;
    if (!user || !user.email) {
        updateSettingsFeedback(feedback, "Sua sessão expirou. Entre novamente.", "error");
        return;
    }

    const form = event.currentTarget;
    const currentPassword = String(form.querySelector('input[name="current_password"]')?.value || "").trim();
    const newPassword = String(form.querySelector('input[name="new_password"]')?.value || "").trim();
    const confirmPassword = String(form.querySelector('input[name="confirm_password"]')?.value || "").trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
        updateSettingsFeedback(feedback, "Preencha todos os campos para alterar a senha.", "error");
        return;
    }

    if (newPassword.length < 6) {
        updateSettingsFeedback(feedback, "A nova senha precisa ter pelo menos 6 caracteres.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        updateSettingsFeedback(feedback, "A confirmação da senha não confere.", "error");
        return;
    }

    try {
        updateSettingsFeedback(feedback, "Atualizando senha...", "success");
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPassword);
        form.reset();
        updateSettingsFeedback(feedback, "Senha atualizada com sucesso.", "success");
    } catch (error) {
        let message = "Não foi possível atualizar a senha agora.";
        if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
            message = "A senha atual informada está incorreta.";
        } else if (error?.code === "auth/weak-password") {
            message = "A nova senha precisa ser mais forte.";
        }
        updateSettingsFeedback(feedback, message, "error");
    }
}

function bindSettingsForms() {
    const profileForm = document.querySelector("[data-settings-profile-form]");
    const passwordForm = document.querySelector("[data-settings-password-form]");

    profileForm?.addEventListener("submit", handleSettingsProfileSubmit);
    passwordForm?.addEventListener("submit", handleSettingsPasswordSubmit);
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateSettingsPage();
    bindSettingsForms();
});

document.addEventListener("educaria-auth-changed", () => {
    hydrateSettingsPage();
});
