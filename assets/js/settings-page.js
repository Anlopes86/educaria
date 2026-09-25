const SETTINGS_TEACHER_CACHE_KEY = "educaria:auth:teacher-cache";
const SETTINGS_SESSION_KEY = "educaria:auth:session";
const SETTINGS_CHECKOUT_URL_KEY = "educaria:billing:checkout-url";

function settingsFirebaseReady() {
    const config = window.EDUCARIA_FIREBASE_CONFIG || {};
    const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
    return requiredKeys.every((key) => {
        const value = config[key];
        return typeof value === "string" && value.trim() && !value.startsWith("COLE_AQUI");
    });
}

async function waitForSettingsFirebaseConfig() {
    if (window.educariaFirebaseConfigReady && typeof window.educariaFirebaseConfigReady.then === "function") {
        try {
            await window.educariaFirebaseConfigReady;
        } catch (error) {
            console.warn("EducarIA settings Firebase config unavailable:", error);
        }
    }
}

function settingsServices() {
    if (!settingsFirebaseReady() || typeof firebase === "undefined") return null;

    if (!firebase.apps.length) {
        firebase.initializeApp(window.EDUCARIA_FIREBASE_CONFIG);
    }

    return {
        auth: firebase.auth(),
        db: firebase.firestore(),
        storage: typeof firebase.storage === "function" ? firebase.storage() : null
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

function settingsCheckoutUrl() {
    const configured = String(window.EDUCARIA_BILLING_CHECKOUT_URL || "").trim();
    if (configured) return configured;

    try {
        return String(localStorage.getItem(SETTINGS_CHECKOUT_URL_KEY) || "").trim();
    } catch (error) {
        console.warn("EducarIA billing config unavailable:", error);
        return "";
    }
}

function settingsCheckoutEndpoint() {
    if (typeof window.educariaBillingCheckoutEndpoint === "function") {
        return window.educariaBillingCheckoutEndpoint();
    }
    return "";
}

function settingsBillingStatusEndpoint() {
    if (typeof window.educariaBillingStatusEndpoint === "function") {
        return window.educariaBillingStatusEndpoint();
    }
    return "";
}

async function refreshSettingsBillingStatus() {
    const endpoint = settingsBillingStatusEndpoint();
    if (!endpoint || typeof window.educariaAiAuthHeaders !== "function") return null;

    try {
        const response = await fetch(endpoint, {
            headers: await window.educariaAiAuthHeaders()
        });
        if (!response.ok) return null;

        const payload = await response.json().catch(() => ({}));
        const currentTeacher = settingsCurrentTeacher();
        if (!payload?.plan || !currentTeacher) return payload;

        const nextTeacher = {
            ...currentTeacher,
            plan: payload.plan,
            billingIntent: payload.billing || currentTeacher.billingIntent || null
        };
        settingsWriteTeacherCache(nextTeacher);
        settingsNotifyTeacherChanged();
        return payload;
    } catch (error) {
        console.warn("EducarIA billing status unavailable:", error);
        return null;
    }
}

function hydrateSettingsCheckoutLink() {
    const url = settingsCheckoutUrl();
    document.querySelectorAll("[data-settings-checkout-link]").forEach((link) => {
        if (!url && !settingsCheckoutEndpoint()) {
            link.hidden = true;
            link.removeAttribute("href");
            return;
        }

        link.hidden = false;
        link.href = url || "#";
        if (url) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        } else {
            link.removeAttribute("target");
            link.removeAttribute("rel");
        }
    });
}

function hydrateSettingsCreditUsage(credits) {
    const planUsage = document.querySelector("[data-settings-plan-usage]");
    if (!planUsage) return;

    if (!credits) {
        planUsage.hidden = true;
        return;
    }

    planUsage.hidden = false;
    document.querySelectorAll("[data-settings-ai-remaining]").forEach((element) => {
        element.textContent = String(credits.remaining ?? 0);
    });
    document.querySelectorAll("[data-settings-ai-current-limit]").forEach((element) => {
        element.textContent = String(credits.limit ?? 0);
    });
    document.querySelectorAll("[data-settings-ai-pro-limit]").forEach((element) => {
        element.textContent = String(credits.limits?.pro ?? credits.limit ?? 0);
    });
}

function settingsTranslate(key, fallback) {
    if (typeof window.educariaTranslate !== "function") return fallback;
    return window.educariaTranslate(key) || fallback;
}

function settingsPlanLabel(plan) {
    return String(plan || "").trim().toLowerCase() === "pro"
        ? "Pro"
        : settingsTranslate("settings.plan.free", "Gratuito");
}

function settingsUpgradeStatusLabel(intent) {
    const status = String(intent?.status || "").trim().toLowerCase();
    if (status === "requested") return settingsTranslate("settings.upgrade.requested", "Solicitado");
    if (status === "approved") return settingsTranslate("settings.upgrade.approved", "Aprovado");
    return settingsTranslate("settings.upgrade.none", "Sem solicitação");
}

function settingsRoleLabel(role) {
    const normalized = String(role || "").trim().toLowerCase();
    if (normalized === "institution_admin") return settingsTranslate("settings.role.admin", "Admin institucional");
    if (normalized === "coordinator") return settingsTranslate("settings.role.coordinator", "Coordenador");
    return settingsTranslate("settings.role.teacher", "Professor");
}

function hydrateSettingsPage() {
    const teacher = settingsCurrentTeacher();
    const nameField = document.getElementById("settings-name");
    const emailField = document.getElementById("settings-email");
    const institutionField = document.getElementById("settings-institution");
    const languageField = document.querySelector("[data-settings-language]");

    if (languageField && typeof window.getEducariaLanguage === "function") {
        languageField.value = window.getEducariaLanguage();
    }

    if (teacher) {
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

        document.querySelectorAll("[data-settings-teacher-role]").forEach((element) => {
            element.textContent = settingsRoleLabel(teacher.role);
        });

        document.querySelectorAll("[data-settings-teacher-institution-id]").forEach((element) => {
            element.textContent = teacher.institutionId || "Sem vínculo institucional";
        });
    }

    const summary = typeof readEducariaAnalyticsSummary === "function"
        ? readEducariaAnalyticsSummary()
        : null;
    if (!summary) return;

    const lastEventLabel = summary.lastEventAt
        ? `${summary.lastEventName || "evento"} em ${new Date(summary.lastEventAt).toLocaleString("pt-BR")}`
        : "Sem eventos";

    document.querySelectorAll("[data-settings-pilot-id]").forEach((element) => {
        element.textContent = summary.pilotId || "anonimo";
    });
    document.querySelectorAll("[data-settings-pilot-events]").forEach((element) => {
        element.textContent = `${summary.eventCount || 0}`;
    });
    document.querySelectorAll("[data-settings-pilot-pending]").forEach((element) => {
        element.textContent = `${summary.pendingSync || 0}`;
    });
    document.querySelectorAll("[data-settings-pilot-days]").forEach((element) => {
        element.textContent = `${summary.activeDays || 0}`;
    });
    document.querySelectorAll("[data-settings-pilot-last-event]").forEach((element) => {
        element.textContent = lastEventLabel;
    });

    document.querySelectorAll("[data-settings-plan-name]").forEach((element) => {
        element.textContent = settingsPlanLabel(teacher?.plan);
    });
    document.querySelectorAll("[data-settings-plan-status]").forEach((element) => {
        element.textContent = settingsUpgradeStatusLabel(teacher?.billingIntent);
    });
    hydrateSettingsCheckoutLink();
    hydrateSettingsCreditUsage(window.educariaLatestAiCredits || null);
}

async function handleSettingsProfileSubmit(event) {
    event.preventDefault();

    const services = settingsServices();
    const feedback = document.querySelector("[data-settings-profile-feedback]");
    if (!services) {
        updateSettingsFeedback(feedback, "Serviço de autenticação indisponível no momento. Tente novamente em instantes.", "error");
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
        const institutionId = typeof slugifyInstitutionId === "function"
            ? slugifyInstitutionId(institution)
            : String(institution || "").trim().toLowerCase().replace(/\s+/g, "-");
        const currentTeacher = settingsCurrentTeacher() || {};
        await services.db.collection("teachers").doc(user.uid).set({
            name,
            email,
            institution,
            institutionName: institution,
            institutionId,
            role: currentTeacher.role || "teacher",
            updatedAt: new Date().toISOString()
        }, { merge: true });

        const teacher = {
            uid: user.uid,
            name,
            email,
            institution: institution || "Conta educacional",
            institutionId,
            role: currentTeacher.role || "teacher",
            plan: currentTeacher.plan || "free",
            billingIntent: currentTeacher.billingIntent || null
        };

        settingsWriteTeacherCache(teacher);
        settingsWriteSessionEmail(email);
        settingsNotifyTeacherChanged();
        if (typeof educariaTrack === "function") {
            educariaTrack("profile_updated", { section: "settings" });
        }
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
        updateSettingsFeedback(feedback, "Serviço de autenticação indisponível no momento. Tente novamente em instantes.", "error");
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
        if (typeof educariaTrack === "function") {
            educariaTrack("password_updated", { section: "settings" });
        }
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

async function deleteSettingsCollection(collectionRef, beforeDelete = null) {
    while (true) {
        const snapshot = await collectionRef.limit(400).get();
        if (snapshot.empty) return;

        if (beforeDelete) {
            for (const document of snapshot.docs) {
                await beforeDelete(document);
            }
        }

        const batch = collectionRef.firestore.batch();
        snapshot.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
        if (snapshot.size < 400) return;
    }
}

async function deleteSettingsStorageTree(reference) {
    const contents = await reference.listAll();
    await Promise.all(contents.items.map((item) => item.delete()));
    for (const prefix of contents.prefixes) {
        await deleteSettingsStorageTree(prefix);
    }
}

async function deleteSettingsRemoteData(services, uid) {
    if (services.storage) {
        await deleteSettingsStorageTree(services.storage.ref(`teachers/${uid}`));
    }

    const teacherRef = services.db.collection("teachers").doc(uid);
    await deleteSettingsCollection(teacherRef.collection("classes"), async (classDocument) => {
        await deleteSettingsCollection(classDocument.ref.collection("materials"));
    });
    await deleteSettingsCollection(teacherRef.collection("lessons"));
    await deleteSettingsCollection(teacherRef.collection("platform"));
    await deleteSettingsCollection(teacherRef.collection("productAnalyticsEvents"));
    await teacherRef.delete();
}

async function deleteSettingsBackendState() {
    const endpoint = typeof window.educariaAiEndpoint === "function"
        ? window.educariaAiEndpoint("/api/account")
        : "";
    if (!endpoint) throw new Error("account_endpoint_unavailable");

    const response = await fetch(endpoint, {
        method: "DELETE",
        headers: typeof window.educariaAiAuthHeaders === "function" ? await window.educariaAiAuthHeaders() : {}
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "account_backend_delete_failed");
    }
}

function clearSettingsLocalAccountData() {
    const preservedKeys = new Set(["educaria:firebase:config", "educaria:i18n:language"]);
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith("educaria:") && !preservedKeys.has(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
}

async function handleSettingsDeleteSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = document.querySelector("[data-settings-delete-feedback]");
    const submitButton = form.querySelector('button[type="submit"]');
    const password = String(form.querySelector('input[name="delete_password"]')?.value || "");
    const confirmation = String(form.querySelector('input[name="delete_confirmation"]')?.value || "").trim();
    const services = settingsServices();
    const user = services?.auth?.currentUser;

    if (!services || !user?.email) {
        updateSettingsFeedback(feedback, "Sua sessão expirou. Entre novamente para excluir a conta.", "error");
        return;
    }

    if (!password || confirmation !== "EXCLUIR") {
        updateSettingsFeedback(feedback, "Confirme sua senha e digite EXCLUIR exatamente como indicado.", "error");
        return;
    }

    const confirmed = window.confirm("Esta ação é permanente. Perfil, turmas, materiais, arquivos e acesso serão excluídos. Deseja continuar?");
    if (!confirmed) return;

    submitButton.disabled = true;
    [...form.elements].forEach((element) => {
        element.disabled = true;
    });

    try {
        updateSettingsFeedback(feedback, "Confirmando identidade...", "warning");
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(credential);

        updateSettingsFeedback(feedback, "Excluindo arquivos e materiais... Não feche esta página.", "warning");
        await deleteSettingsRemoteData(services, user.uid);
        await deleteSettingsBackendState();
        await user.reauthenticateWithCredential(credential);
        await user.delete();
        clearSettingsLocalAccountData();
        window.location.replace("../login.html?accountDeleted=1");
    } catch (error) {
        console.warn("EducarIA account deletion unavailable:", error);
        let message = "Não foi possível concluir a exclusão. Nenhuma nova tentativa será feita automaticamente.";
        if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential") {
            message = "A senha informada está incorreta.";
        } else if (error?.code === "auth/too-many-requests") {
            message = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
        }
        updateSettingsFeedback(feedback, message, "error");
        [...form.elements].forEach((element) => {
            element.disabled = false;
        });
        submitButton.disabled = false;
    }
}

function bindSettingsForms() {
    const profileForm = document.querySelector("[data-settings-profile-form]");
    const passwordForm = document.querySelector("[data-settings-password-form]");
    const upgradeForm = document.querySelector("[data-settings-upgrade-form]");
    const deleteForm = document.querySelector("[data-settings-delete-form]");

    profileForm?.addEventListener("submit", handleSettingsProfileSubmit);
    passwordForm?.addEventListener("submit", handleSettingsPasswordSubmit);
    upgradeForm?.addEventListener("submit", handleSettingsUpgradeSubmit);
    deleteForm?.addEventListener("submit", handleSettingsDeleteSubmit);
}

async function openSettingsCheckout(event) {
    const link = event.target.closest("[data-settings-checkout-link]");
    if (!link) return;

    const staticUrl = settingsCheckoutUrl();
    if (staticUrl) return;

    event.preventDefault();
    const feedback = document.querySelector("[data-settings-upgrade-feedback]");
    const endpoint = settingsCheckoutEndpoint();
    if (!endpoint) {
        updateSettingsFeedback(feedback, "Checkout não configurado no momento.", "error");
        return;
    }

    try {
        updateSettingsFeedback(feedback, "Abrindo checkout seguro...", "success");
        const response = await fetch(endpoint, {
            method: "POST",
            headers: typeof window.educariaAiAuthHeaders === "function" ? await window.educariaAiAuthHeaders() : {}
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.checkoutUrl) {
            throw new Error(payload?.error || "Checkout indisponível.");
        }

        if (typeof educariaTrack === "function") {
            educariaTrack("checkout_opened", {
                section: "settings",
                reference: payload.reference || ""
            });
        }
        window.location.href = payload.checkoutUrl;
    } catch (error) {
        updateSettingsFeedback(feedback, error instanceof Error ? error.message : "Checkout indisponível no momento.", "error");
    }
}

async function handleSettingsUpgradeSubmit(event) {
    event.preventDefault();

    const services = settingsServices();
    const feedback = document.querySelector("[data-settings-upgrade-feedback]");
    if (!services) {
        updateSettingsFeedback(feedback, "Serviço de autenticação indisponível no momento. Tente novamente em instantes.", "error");
        return;
    }

    const user = services.auth.currentUser;
    if (!user) {
        updateSettingsFeedback(feedback, "Sua sessão expirou. Entre novamente.", "error");
        return;
    }

    const form = event.currentTarget;
    const note = String(form.querySelector('textarea[name="upgrade_note"]')?.value || "").trim();
    const currentTeacher = settingsCurrentTeacher() || {};
    const billingIntent = {
        status: "requested",
        requestedAt: new Date().toISOString(),
        note
    };

    try {
        updateSettingsFeedback(feedback, "Registrando seu interesse no plano Pro...", "success");

        await services.db.collection("teachers").doc(user.uid).set({
            plan: currentTeacher.plan || "free",
            billingIntent
        }, { merge: true });

        const teacher = {
            uid: user.uid,
            name: currentTeacher.name || user.displayName || "Professor",
            email: currentTeacher.email || user.email || "",
            institution: currentTeacher.institution || "Conta educacional",
            institutionId: currentTeacher.institutionId || "",
            role: currentTeacher.role || "teacher",
            plan: currentTeacher.plan || "free",
            billingIntent
        };

        settingsWriteTeacherCache(teacher);
        settingsNotifyTeacherChanged();
        if (typeof educariaTrack === "function") {
            educariaTrack("upgrade_requested", {
                section: "settings",
                noteLength: note.length,
                hasCheckoutUrl: Boolean(settingsCheckoutUrl())
            });
        }
        hydrateSettingsPage();
        updateSettingsFeedback(feedback, "Pedido de upgrade registrado com sucesso.", "success");
    } catch (error) {
        updateSettingsFeedback(feedback, "Não foi possível registrar o upgrade agora.", "error");
    }
}

function settingsParseStoredValue(value) {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function settingsLocalAccountData() {
    const scope = typeof educariaCurrentUserScope === "function" ? educariaCurrentUserScope() : "guest";
    const teacher = settingsCurrentTeacher();
    const actorId = String(teacher?.uid || teacher?.email || "").trim().toLowerCase();
    const allowedSharedKeys = new Set(["educaria:analytics:events", "educaria:i18n:language"]);
    const values = {};

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith("educaria:")) continue;

        const belongsToScope = key.endsWith(`:${scope}`);
        const isActorMilestone = actorId && key.startsWith(`educaria:milestone:${actorId}:`);
        if (!belongsToScope && !isActorMilestone && !allowedSharedKeys.has(key)) continue;

        values[key] = settingsParseStoredValue(localStorage.getItem(key));
    }

    return { scope, values };
}

function settingsSnapshotDocuments(snapshot) {
    const documents = [];
    snapshot?.forEach((document) => {
        documents.push({ id: document.id, ...document.data() });
    });
    return documents;
}

async function settingsRemoteAccountData(teacher) {
    const services = settingsServices();
    if (!services?.db || !teacher?.uid) return null;

    const teacherRef = services.db.collection("teachers").doc(teacher.uid);
    const [profile, lessons, classes, analytics] = await Promise.all([
        teacherRef.get(),
        teacherRef.collection("lessons").get(),
        teacherRef.collection("platform").doc("classes").get(),
        teacherRef.collection("productAnalyticsEvents").get()
    ]);

    return {
        profile: profile.exists ? profile.data() : null,
        lessons: settingsSnapshotDocuments(lessons),
        classes: classes.exists ? classes.data() : null,
        analytics: settingsSnapshotDocuments(analytics)
    };
}

async function buildSettingsAccountExport() {
    const teacher = settingsCurrentTeacher();
    let remote = null;
    let remoteWarning = "";

    try {
        remote = await settingsRemoteAccountData(teacher);
    } catch (error) {
        remoteWarning = "Os dados locais foram exportados, mas a cópia remota não estava disponível.";
        console.warn("EducarIA remote account export unavailable:", error);
    }

    return {
        schema: "educaria-account-export/v1",
        exportedAt: new Date().toISOString(),
        teacher: teacher ? {
            uid: teacher.uid || "",
            name: teacher.name || "",
            email: teacher.email || "",
            institution: teacher.institution || "",
            institutionId: teacher.institutionId || "",
            role: teacher.role || "teacher",
            plan: teacher.plan || "free"
        } : null,
        local: settingsLocalAccountData(),
        remote,
        warnings: remoteWarning ? [remoteWarning] : []
    };
}

function downloadSettingsJson(payload, fileName) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function bindPilotActions() {
    const feedback = document.querySelector("[data-settings-pilot-feedback]");

    document.querySelector("[data-settings-copy-pilot-id]")?.addEventListener("click", async () => {
        const summary = typeof readEducariaAnalyticsSummary === "function"
            ? readEducariaAnalyticsSummary()
            : null;
        const pilotId = summary?.pilotId || "anonimo";

        try {
            await navigator.clipboard.writeText(pilotId);
            updateSettingsFeedback(feedback, "ID do piloto copiado.", "success");
        } catch (error) {
            updateSettingsFeedback(feedback, "Não foi possível copiar o ID agora.", "error");
        }
    });

    document.querySelector("[data-settings-export-analytics]")?.addEventListener("click", () => {
        if (typeof exportEducariaAnalytics !== "function") {
            updateSettingsFeedback(feedback, "Exportação indisponível nesta sessão.", "error");
            return;
        }

        downloadSettingsJson(JSON.parse(exportEducariaAnalytics()), `educaria-piloto-${Date.now()}.json`);
        updateSettingsFeedback(feedback, "Eventos exportados com sucesso.", "success");
    });

    document.querySelector("[data-settings-export-account]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const accountFeedback = document.querySelector("[data-settings-account-feedback]");
        button.disabled = true;
        updateSettingsFeedback(accountFeedback, "Preparando backup da conta...", "success");

        try {
            const payload = await buildSettingsAccountExport();
            const date = new Date().toISOString().slice(0, 10);
            downloadSettingsJson(payload, `educaria-backup-${date}.json`);
            const suffix = payload.warnings.length ? ` ${payload.warnings[0]}` : "";
            updateSettingsFeedback(accountFeedback, `Backup baixado com sucesso.${suffix}`, payload.warnings.length ? "warning" : "success");
            if (typeof educariaTrack === "function") {
                educariaTrack("account_backup_exported", { section: "settings", remoteIncluded: Boolean(payload.remote) });
            }
        } catch (error) {
            console.warn("EducarIA account export unavailable:", error);
            updateSettingsFeedback(accountFeedback, "Não foi possível preparar o backup agora.", "error");
        } finally {
            button.disabled = false;
        }
    });

    document.querySelector("[data-settings-sync-analytics]")?.addEventListener("click", async () => {
        if (typeof flushEducariaAnalytics !== "function") {
            updateSettingsFeedback(feedback, "Sincronização indisponível nesta sessão.", "error");
            return;
        }

        updateSettingsFeedback(feedback, "Sincronizando eventos...", "success");
        await flushEducariaAnalytics();
        hydrateSettingsPage();
        updateSettingsFeedback(feedback, "Sincronização concluída.", "success");
    });
}

function bindSettingsLanguage() {
    document.querySelector("[data-settings-language]")?.addEventListener("change", async (event) => {
        const language = event.currentTarget.value;
        if (typeof window.setEducariaLanguage !== "function") {
            try {
                localStorage.setItem("educaria:i18n:language", language);
            } catch (error) {
                console.warn("EducarIA language storage unavailable:", error);
            }
            return;
        }
        await window.setEducariaLanguage(language);
        if (typeof educariaTrack === "function") {
            educariaTrack("language_changed", {
                section: "settings",
                language
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await waitForSettingsFirebaseConfig();
    await refreshSettingsBillingStatus();
    hydrateSettingsPage();
    bindSettingsForms();
    bindPilotActions();
    bindSettingsLanguage();
    document.addEventListener("click", openSettingsCheckout);
});

document.addEventListener("educaria-auth-changed", () => {
    hydrateSettingsPage();
});

document.addEventListener("educaria-analytics-tracked", () => {
    hydrateSettingsPage();
});

document.addEventListener("educaria-ai-credits-rendered", (event) => {
    hydrateSettingsCreditUsage(event.detail?.credits || null);
});

document.addEventListener("educaria-language-changed", () => {
    hydrateSettingsPage();
});
