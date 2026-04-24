const EDUCARIA_SESSION_KEY = "educaria:auth:session";
const EDUCARIA_TEACHER_CACHE_KEY = "educaria:auth:teacher-cache";
const EDUCARIA_ANALYTICS_EVENTS_KEY = "educaria:analytics:events";
const EDUCARIA_MILESTONE_KEY_PREFIX = "educaria:milestone:";
const EDUCARIA_ANALYTICS_LIMIT = 400;
const EDUCARIA_ANALYTICS_AUTO_FLUSH_MS = 60_000;

let educariaAnalyticsFlushTimer = 0;
let educariaAnalyticsFlushPromise = null;
let educariaAnalyticsAutoFlushTimer = 0;

function authLoginPath() {
    return window.location.pathname.includes("/plataforma/") ? "../login.html" : "login.html";
}

function authDashboardPath() {
    return window.location.pathname.includes("/plataforma/") ? "index.html" : "plataforma/index.html";
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function normalizeInstitutionName(value) {
    return String(value || "").trim();
}

function slugifyInstitutionId(value) {
    return normalizeInstitutionName(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function normalizeTeacherRole(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "institution_admin") return "institution_admin";
    if (normalized === "coordinator") return "coordinator";
    return "teacher";
}

function firebaseConfig() {
    return window.EDUCARIA_FIREBASE_CONFIG || {};
}

function firebaseConfigReady() {
    const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
    return requiredKeys.every((key) => {
        const value = firebaseConfig()[key];
        return typeof value === "string" && value.trim() && !value.startsWith("COLE_AQUI");
    });
}

async function waitForFirebaseConfig() {
    if (window.educariaFirebaseConfigReady && typeof window.educariaFirebaseConfigReady.then === "function") {
        try {
            await window.educariaFirebaseConfigReady;
        } catch (error) {
            console.warn("EducarIA Firebase config runtime unavailable:", error);
        }
    }
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

function analyticsPageName() {
    const body = document.body;
    if (body?.dataset.page) return body.dataset.page;
    if (body?.dataset.authScreen) return `auth-${body.dataset.authScreen}`;

    const path = window.location.pathname.replace(/\\/g, "/").split("/").pop() || "";
    return path || "unknown";
}

function analyticsNormalizeMetadata(metadata = {}) {
    if (!metadata || typeof metadata !== "object") return {};

    return Object.fromEntries(Object.entries(metadata).filter(([_, value]) => {
        return value !== undefined && value !== null && value !== "";
    }).map(([key, value]) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return [key, value];
        }

        return [key, JSON.stringify(value)];
    }));
}

function readEducariaAnalyticsEvents() {
    try {
        const raw = localStorage.getItem(EDUCARIA_ANALYTICS_EVENTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("EducarIA analytics unavailable:", error);
        return [];
    }
}

function writeEducariaAnalyticsEvents(events) {
    const normalized = (Array.isArray(events) ? events : []).slice(-EDUCARIA_ANALYTICS_LIMIT);
    try {
        localStorage.setItem(EDUCARIA_ANALYTICS_EVENTS_KEY, JSON.stringify(normalized));
    } catch (error) {
        console.warn("EducarIA analytics unavailable:", error);
    }

    return normalized;
}

function analyticsTeacherIdentity() {
    const teacher = readCurrentTeacher();
    return {
        uid: teacher?.uid || "",
        email: teacher?.email || "",
        name: teacher?.name || ""
    };
}

function analyticsCollection() {
    const services = firebaseServices();
    const teacher = readCurrentTeacher();
    if (!services?.db || !teacher?.uid) return null;

    return services.db
        .collection("teachers")
        .doc(teacher.uid)
        .collection("productAnalyticsEvents");
}

function analyticsEventPayload(name, metadata = {}) {
    const teacher = analyticsTeacherIdentity();
    const selectedClass = typeof readSelectedClass === "function" ? readSelectedClass() : "";

    return {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: String(name || "").trim() || "unknown_event",
        at: new Date().toISOString(),
        page: analyticsPageName(),
        path: window.location.pathname,
        teacherUid: teacher.uid,
        teacherEmail: teacher.email,
        teacherName: teacher.name,
        selectedClass,
        metadata: analyticsNormalizeMetadata(metadata),
        syncedAt: ""
    };
}

function readEducariaAnalyticsSummary() {
    const teacher = analyticsTeacherIdentity();
    const events = readEducariaAnalyticsEvents().filter((event) => {
        if (!teacher.uid) return true;
        return event.teacherUid === teacher.uid;
    });

    const activeDays = [...new Set(events.map((event) => String(event.at || "").slice(0, 10)).filter(Boolean))];
    const lastEvent = events[events.length - 1] || null;

    return {
        pilotId: teacher.uid || normalizeEmail(teacher.email || "") || "anonimo",
        eventCount: events.length,
        activeDays: activeDays.length,
        lastEventAt: lastEvent?.at || "",
        lastEventName: lastEvent?.name || "",
        pendingSync: events.filter((event) => teacher.uid && event.teacherUid === teacher.uid && !event.syncedAt).length
    };
}

window.readEducariaAnalyticsSummary = readEducariaAnalyticsSummary;

function exportEducariaAnalytics() {
    const teacher = analyticsTeacherIdentity();
    const events = readEducariaAnalyticsEvents().filter((event) => {
        if (!teacher.uid) return true;
        return event.teacherUid === teacher.uid;
    });

    return JSON.stringify({
        exportedAt: new Date().toISOString(),
        teacher,
        summary: readEducariaAnalyticsSummary(),
        events
    }, null, 2);
}

window.exportEducariaAnalytics = exportEducariaAnalytics;

async function flushEducariaAnalytics() {
    const collection = analyticsCollection();
    const teacher = readCurrentTeacher();
    if (!collection || !teacher?.uid) return [];

    const events = readEducariaAnalyticsEvents();
    const pending = events.filter((event) => event.teacherUid === teacher.uid && !event.syncedAt).slice(0, 25);
    if (!pending.length) return [];

    if (educariaAnalyticsFlushPromise) return educariaAnalyticsFlushPromise;

    educariaAnalyticsFlushPromise = (async () => {
        try {
            await Promise.all(pending.map((event) => {
                const payload = { ...event };
                delete payload.syncedAt;
                return collection.doc(event.id).set(payload, { merge: true });
            }));

            const syncedAt = new Date().toISOString();
            const nextEvents = events.map((event) => {
                const isPending = pending.some((pendingEvent) => pendingEvent.id === event.id);
                return isPending ? { ...event, syncedAt } : event;
            });
            writeEducariaAnalyticsEvents(nextEvents);
            return pending;
        } catch (error) {
            console.warn("EducarIA analytics sync unavailable:", error);
            return [];
        } finally {
            educariaAnalyticsFlushPromise = null;
        }
    })();

    return educariaAnalyticsFlushPromise;
}

window.flushEducariaAnalytics = flushEducariaAnalytics;

function scheduleEducariaAnalyticsFlush() {
    window.clearTimeout(educariaAnalyticsFlushTimer);
    educariaAnalyticsFlushTimer = window.setTimeout(() => {
        educariaAnalyticsFlushTimer = 0;
        flushEducariaAnalytics();
    }, 1200);
}

function scheduleEducariaAnalyticsAutoFlush() {
    window.clearInterval(educariaAnalyticsAutoFlushTimer);
    educariaAnalyticsAutoFlushTimer = window.setInterval(() => {
        if (document.visibilityState === "hidden") return;
        flushEducariaAnalytics();
    }, EDUCARIA_ANALYTICS_AUTO_FLUSH_MS);
}

function educariaTrack(name, metadata = {}) {
    const event = analyticsEventPayload(name, metadata);
    writeEducariaAnalyticsEvents([...readEducariaAnalyticsEvents(), event]);
    document.dispatchEvent(new CustomEvent("educaria-analytics-tracked", {
        detail: event
    }));

    if (event.teacherUid) {
        scheduleEducariaAnalyticsFlush();
    }

    return event;
}

window.educariaTrack = educariaTrack;

function milestoneActorId() {
    const teacher = readCurrentTeacher();
    const uid = String(teacher?.uid || "").trim();
    if (uid) return uid.toLowerCase();

    const email = normalizeEmail(teacher?.email || "");
    if (email) return email;

    try {
        const sessionEmail = normalizeEmail(localStorage.getItem(EDUCARIA_SESSION_KEY) || "");
        if (sessionEmail) return sessionEmail;
    } catch (error) {
        console.warn("EducarIA milestone unavailable:", error);
    }

    return "anonimo";
}

function milestoneStorageKey(name) {
    const normalized = String(name || "").trim().toLowerCase();
    return `${EDUCARIA_MILESTONE_KEY_PREFIX}${milestoneActorId()}:${normalized}`;
}

function hasMilestone(name) {
    if (!name) return false;
    try {
        return localStorage.getItem(milestoneStorageKey(name)) === "done";
    } catch (error) {
        console.warn("EducarIA milestone unavailable:", error);
        return false;
    }
}

function markMilestone(name, metadata = {}) {
    if (!name || hasMilestone(name)) return false;

    try {
        localStorage.setItem(milestoneStorageKey(name), "done");
    } catch (error) {
        console.warn("EducarIA milestone unavailable:", error);
    }

    const event = educariaTrack(name, {
        milestone: true,
        ...metadata
    });

    document.dispatchEvent(new CustomEvent("educaria-milestone", {
        detail: {
            name,
            event
        }
    }));

    return true;
}

function readActivationSnapshot() {
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const lessons = typeof readLessonsLibrary === "function" ? readLessonsLibrary() : [];

    return {
        classesCount: classes.length,
        lessonsCount: lessons.length
    };
}

function evaluateActivationMilestones(source = "unknown", options = {}) {
    const markSteps = Boolean(options.markSteps);
    const markCompletion = options.markCompletion !== false;
    const snapshot = readActivationSnapshot();
    const { classesCount, lessonsCount } = snapshot;

    if (markSteps && classesCount > 0) {
        markMilestone("activation_first_class_created", {
            source,
            classesCount
        });
    }

    if (markSteps && lessonsCount > 0) {
        markMilestone("activation_first_activity_saved", {
            source,
            lessonsCount
        });
    }

    if (markCompletion && classesCount > 0 && lessonsCount > 0) {
        markMilestone("activation_completed", {
            source,
            classesCount,
            lessonsCount
        });
    }

    return snapshot;
}

window.educariaHasMilestone = hasMilestone;
window.educariaMarkMilestone = markMilestone;
window.educariaEvaluateActivationMilestones = evaluateActivationMilestones;

function authNextPath() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "";
    if (next) {
        try {
            // Resolve against the current origin and reject anything that escapes it
            const resolved = new URL(next, window.location.origin);
            if (resolved.origin === window.location.origin) {
                return resolved.pathname + resolved.search + resolved.hash;
            }
        } catch (_) {}
    }
    return authDashboardPath();
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

function hydrateFeedbackLiveRegions() {
    const selectors = [
        "[data-auth-feedback]",
        "[data-sidebar-class-feedback]",
        "[data-create-class-feedback]",
        "[data-settings-profile-feedback]",
        "[data-settings-password-feedback]",
        "[data-settings-upgrade-feedback]",
        "[data-settings-pilot-feedback]"
    ];

    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
            if (!element.getAttribute("role")) {
                element.setAttribute("role", "status");
            }
            if (!element.getAttribute("aria-live")) {
                element.setAttribute("aria-live", "polite");
            }
            if (!element.getAttribute("aria-atomic")) {
                element.setAttribute("aria-atomic", "true");
            }
        });
    });
}

function notifyAuthChanged() {
    document.dispatchEvent(new CustomEvent("educaria-auth-changed", {
        detail: { teacher: readCurrentTeacher() }
    }));
}

function showFirebaseConfigMessageIfNeeded() {
    if (firebaseConfigReady()) return false;

    if (document.body?.dataset.authPage === "true") {
        updateAuthFeedback("A autenticacao esta temporariamente indisponivel. Tente novamente em instantes.", "error");
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
    return "Não foi possível concluir a autenticação agora.";
}

function readTeacherProfileFromFirebase(user) {
    const services = firebaseServices();
    if (!services || !user) return Promise.resolve(null);

    return services.db.collection("teachers").doc(user.uid).get().then((snapshot) => {
        const profile = snapshot.exists ? snapshot.data() : {};
        const institutionName = normalizeInstitutionName(profile.institutionName || profile.institution || "");
        return {
            uid: user.uid,
            name: profile.name || user.displayName || "Professor",
            email: user.email || profile.email || "",
            institution: institutionName || "Conta educacional",
            institutionId: String(profile.institutionId || slugifyInstitutionId(institutionName) || "").trim(),
            role: normalizeTeacherRole(profile.role),
            plan: profile.plan || "free",
            billingIntent: profile.billingIntent || null
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
            updateAuthFeedback("Nao foi possivel conectar ao servico de autenticacao. Tente novamente em instantes.", "error");
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
            educariaTrack("login_success", { screen: "login" });
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
            updateAuthFeedback("Nao foi possivel conectar ao servico de autenticacao. Tente novamente em instantes.", "error");
            return;
        }

        if (!name || !email || !password || !passwordConfirm) {
            updateAuthFeedback("Preencha nome, email e senha para criar sua conta.", "error");
            return;
        }

        if (password.length < 6) {
            updateAuthFeedback("A senha precisa ter pelo menos 6 caracteres.", "error");
            return;
        }

        if (password !== passwordConfirm) {
            updateAuthFeedback("As senhas não coincidem. Confira e tente novamente.", "error");
            return;
        }

        try {
            updateAuthFeedback("Criando sua conta...", "success");
            const credential = await services.auth.createUserWithEmailAndPassword(email, password);
            await credential.user.updateProfile({ displayName: name });
            const normalizedInstitution = normalizeInstitutionName(institution);
            await services.db.collection("teachers").doc(credential.user.uid).set({
                name,
                email,
                institution: normalizedInstitution,
                institutionName: normalizedInstitution,
                institutionId: slugifyInstitutionId(normalizedInstitution),
                role: "teacher",
                plan: "free",
                createdAt: new Date().toISOString()
            }, { merge: true });

            const teacher = await readTeacherProfileFromFirebase(credential.user);
            writeCachedTeacher(teacher);
            saveSessionEmail(credential.user.email || email);
            educariaTrack("signup_success", { screen: "register" });
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
            educariaTrack("logout_clicked", { screen: analyticsPageName() });
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

document.addEventListener("DOMContentLoaded", async () => {
    hydrateFeedbackLiveRegions();
    await waitForFirebaseConfig();
    educariaTrack("page_view", { screen: analyticsPageName() });
    scheduleEducariaAnalyticsAutoFlush();
    showFirebaseConfigMessageIfNeeded();
    redirectAuthenticatedFromAuthPages();
    enforceAuth();
    bindLoginForm();
    bindRegisterForm();
    bindLogout();
    syncAuthStateWithFirebase();
});

document.addEventListener("educaria-auth-changed", () => {
    flushEducariaAnalytics();
});

window.addEventListener("pagehide", () => {
    flushEducariaAnalytics();
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        flushEducariaAnalytics();
    }
});
