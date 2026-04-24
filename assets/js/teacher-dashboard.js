function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const DASHBOARD_TOUR_STORAGE_PREFIX = "educaria:dashboard-tour:";
const DASHBOARD_TOUR_SESSION_KEY = "educaria:auth:session";
const DASHBOARD_CORE_FORMATS = [
    { href: "slides-builder.html", label: "Slides (10-15 min)" },
    { href: "quiz-builder.html", label: "Quiz (5-8 min)" },
    { href: "criar-aula.html", label: "Aula completa (15-25 min)" }
];
const DASHBOARD_EXTRA_FORMATS = [
    { href: "flashcards-builder.html", label: "Flashcards" },
    { href: "jogo-memoria-builder.html", label: "Jogo da memória" },
    { href: "roleta-builder.html", label: "Roleta" },
    { href: "ligar-pontos-builder.html", label: "Ligar pontos" },
    { href: "mapa-mental-builder.html", label: "Mapa mental" },
    { href: "debate-guiado-builder.html", label: "Debate guiado" },
    { href: "caca-palavras-builder.html", label: "Caça-palavras" },
    { href: "palavras-cruzadas-builder.html", label: "Palavras cruzadas" },
    { href: "forca-builder.html", label: "Forca" }
];
const DASHBOARD_QUICK_CREATE_FORMATS = [...DASHBOARD_CORE_FORMATS, ...DASHBOARD_EXTRA_FORMATS];
const DASHBOARD_CORE_FORMAT_PATHS = new Set(DASHBOARD_CORE_FORMATS.map((format) => format.href));
const DASHBOARD_TOUR_FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let dashboardTourState = null;

function dashboardTranslate(key, fallback) {
    if (typeof window.educariaTranslate !== "function") return fallback;
    return window.educariaTranslate(key) || fallback;
}

function setDashboardReadyState(isReady) {
    if (!document.body) return;
    document.body.dataset.dashboardReady = isReady ? "true" : "false";
}

function hydrateTeacherDashboard() {
    const classesRoot = document.querySelector("[data-dashboard-classes]");
    const classCount = document.querySelector("[data-dashboard-class-count]");
    const activityCount = document.querySelector("[data-dashboard-activity-count]");
    const libraryCount = document.querySelector("[data-dashboard-library-count]");
    if (!classesRoot && !classCount && !activityCount && !libraryCount) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const lessons = typeof readLessonsLibrary === "function" ? readLessonsLibrary() : [];
    const libraryItems = typeof libraryMaterials === "function" ? libraryMaterials() : [];

    if (classCount) classCount.textContent = `${classes.length}`;
    if (activityCount) activityCount.textContent = `${lessons.length}`;
    if (libraryCount) libraryCount.textContent = `${libraryItems.length}`;

    if (!classesRoot) return;
    if (!classes.length) {
        classesRoot.innerHTML = `
            <article class="quick-class-card quick-class-card--active">
                <span class="route-tag">${dashboardTranslate("dashboard.empty.noClasses", "Sem turmas")}</span>
                <h3>${dashboardTranslate("dashboard.empty.noClassesTitle", "Nenhuma turma criada ainda")}</h3>
                <p>${dashboardTranslate("dashboard.empty.noClassesCopy", "Use o botao Criar turma na lateral para comecar.")}</p>
            </article>
        `;
        return;
    }

    classesRoot.innerHTML = classes.map((className) => {
        const classActivities = typeof classMaterials === "function" ? classMaterials(className) : [];
        return `
            <a href="turma.html" class="quick-class-card" data-dashboard-class-link="${escapeHtml(className)}">
                <span class="route-tag">${classActivities.length} ${classActivities.length === 1 ? dashboardTranslate("dashboard.count.activity", "atividade") : dashboardTranslate("dashboard.count.activities", "atividades")}</span>
                <h3>${escapeHtml(className)}</h3>
                <p>${dashboardTranslate("dashboard.classCard.copy", "Abra a turma para criar novas atividades ou retomar o acervo ja salvo.")}</p>
            </a>
        `;
    }).join("");
}

function dashboardGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return dashboardTranslate("dashboard.greeting.morning", "Bom dia");
    if (hour < 18) return dashboardTranslate("dashboard.greeting.afternoon", "Boa tarde");
    return dashboardTranslate("dashboard.greeting.evening", "Boa noite");
}

function hydrateDashboardGreeting() {
    document.querySelectorAll("[data-dashboard-greeting]").forEach((element) => {
        element.textContent = dashboardGreeting();
    });
}

function quickCreateActionLabel(target) {
    if (target === "slides-builder.html") return dashboardTranslate("dashboard.actions.openSlides", "Abrir slides");
    if (target === "quiz-builder.html") return dashboardTranslate("dashboard.actions.openQuiz", "Abrir quiz");
    if (target === "criar-aula.html") return dashboardTranslate("dashboard.actions.buildLesson", "Montar aula");
    return dashboardTranslate("dashboard.actions.openTool", "Abrir ferramenta");
}

function syncDashboardFormatHierarchy() {
    const quickCopy = document.querySelector("[data-dashboard-quick-copy]");
    if (quickCopy) {
        quickCopy.textContent = dashboardTranslate("dashboard.quick.copy", "Escolha a turma, use um formato principal e entre direto no editor. Sugestao rapida: Slides (10-15 min), Quiz (5-8 min), Aula completa (15-25 min).");
    }

    const toolkitSection = document.getElementById("activity-toolkit");
    if (!toolkitSection) return;

    const sectionLabel = toolkitSection.querySelector(".platform-section-label");
    const sectionTitle = toolkitSection.querySelector("h2");
    const sectionLink = toolkitSection.querySelector(".dashboard-inline-link");
    if (sectionLabel) sectionLabel.textContent = dashboardTranslate("dashboard.toolkit.label", "Fluxo principal");
    if (sectionTitle) sectionTitle.textContent = dashboardTranslate("dashboard.toolkit.title", "Comece por aqui");
    if (sectionLink) {
        sectionLink.textContent = dashboardTranslate("dashboard.toolkit.extraLink", "Ver formatos extras");
        sectionLink.setAttribute("href", "#extra-formats");
    }

    const grid = toolkitSection.querySelector(".dashboard-toolkit-grid");
    if (!grid) return;

    grid.querySelectorAll(".dashboard-tool-card").forEach((card) => {
        const href = card.getAttribute("href") || "";
        if (DASHBOARD_CORE_FORMAT_PATHS.has(href)) return;
        card.remove();
    });

    const quizCard = grid.querySelector('.dashboard-tool-card--quiz .dashboard-tool-content p');
    const slidesCard = grid.querySelector('.dashboard-tool-card--slides .dashboard-tool-content p');
    const lessonCard = grid.querySelector('.dashboard-tool-card--lesson .dashboard-tool-content p');
    if (slidesCard) {
        slidesCard.textContent = dashboardTranslate("dashboard.toolkit.slides.copy", "Quando usar: conduzir explicacao e organizar a sequencia da aula. Tempo estimado: 10 a 15 min.");
    }
    if (quizCard) {
        quizCard.textContent = dashboardTranslate("dashboard.toolkit.quiz.copy", "Quando usar: revisar conteudo no fim da aula e checar entendimento. Tempo estimado: 5 a 8 min.");
    }
    if (lessonCard) {
        lessonCard.textContent = dashboardTranslate("dashboard.toolkit.lesson.copy", "Quando usar: planejar bloco completo com inicio, desenvolvimento e fechamento. Tempo estimado: 15 a 25 min.");
    }

    let secondary = toolkitSection.querySelector(".dashboard-toolkit-secondary");
    if (!secondary) {
        secondary = document.createElement("div");
        secondary.className = "dashboard-toolkit-secondary";
        secondary.id = "extra-formats";
        grid.insertAdjacentElement("afterend", secondary);
    }

    secondary.innerHTML = `
        <div>
            <strong>${dashboardTranslate("dashboard.toolkit.moreFormats", "Mais formatos")}</strong>
            <p>${dashboardTranslate("dashboard.toolkit.moreFormats.copy", "Use formatos extras para momentos especificos da aula: retomada curta, dinamica rapida ou fechamento leve.")}</p>
        </div>
        <div class="dashboard-toolkit-links">
            ${DASHBOARD_EXTRA_FORMATS.map((format) => `
                <a href="${format.href}" class="dashboard-toolkit-link">${format.label}</a>
            `).join("")}
        </div>
    `;
}

function hydrateQuickCreateForm() {
    const classSelect = document.querySelector("[data-dashboard-quick-class]");
    const formatSelect = document.querySelector("[data-dashboard-quick-format]");
    const openButton = document.querySelector("[data-dashboard-quick-open]");
    if (!classSelect || !formatSelect || !openButton) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const current = typeof readSelectedClass === "function" ? readSelectedClass() : "";

    if (!classes.length) {
        classSelect.innerHTML = `<option value="">${dashboardTranslate("dashboard.quick.createClassFirst", "Crie uma turma primeiro")}</option>`;
        classSelect.disabled = true;
        formatSelect.disabled = true;
        openButton.disabled = true;
        openButton.textContent = dashboardTranslate("dashboard.actions.create", "Criar");
        return;
    }

    classSelect.disabled = false;
    formatSelect.disabled = false;
    openButton.disabled = false;

    formatSelect.innerHTML = DASHBOARD_QUICK_CREATE_FORMATS.map((format) => {
        return `<option value="${format.href}">${format.label}</option>`;
    }).join("");

    classSelect.innerHTML = classes.map((className) => {
        const selected = className === current ? " selected" : "";
        return `<option value="${escapeHtml(className)}"${selected}>${escapeHtml(className)}</option>`;
    }).join("");

    if (!classSelect.value && classes[0]) {
        classSelect.value = classes[0];
    }

    openButton.textContent = quickCreateActionLabel(formatSelect.value);
}

function bindQuickCreateForm() {
    const syncQuickCreateButton = () => {
        const formatSelect = document.querySelector("[data-dashboard-quick-format]");
        const openButton = document.querySelector("[data-dashboard-quick-open]");
        if (!formatSelect || !openButton) return;
        openButton.textContent = quickCreateActionLabel(formatSelect.value);
    };

    document.addEventListener("change", (event) => {
        const formatSelect = event.target.closest("[data-dashboard-quick-format]");
        const classSelect = event.target.closest("[data-dashboard-quick-class]");
        if (formatSelect) {
            syncQuickCreateButton();
            return;
        }

        if (classSelect && typeof saveSelectedClass === "function") {
            saveSelectedClass(classSelect.value || "");
        }
    });

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-dashboard-quick-open]");
        if (!button) return;

        const classSelect = document.querySelector("[data-dashboard-quick-class]");
        const formatSelect = document.querySelector("[data-dashboard-quick-format]");
        const className = classSelect?.value || "";
        const target = formatSelect?.value || "";
        if (!className || !target) return;

        if (typeof saveSelectedClass === "function") {
            saveSelectedClass(className);
        }

        if (typeof educariaTrack === "function") {
            educariaTrack("quick_create_opened", {
                className,
                target,
                label: quickCreateActionLabel(target)
            });
        }
        if (typeof window.educariaMarkMilestone === "function") {
            window.educariaMarkMilestone("activation_builder_opened", {
                source: "dashboard_quick_create",
                className,
                target
            });
        }

        window.location.href = target;
    });
}

function bindTeacherDashboardClassLinks() {
    document.addEventListener("click", (event) => {
        const link = event.target.closest("[data-dashboard-class-link]");
        if (!link || typeof saveSelectedClass !== "function") return;
        saveSelectedClass(link.dataset.dashboardClassLink || "");
        hydrateQuickCreateForm();
    });
}

function bindQuickCreateRefresh() {
    document.addEventListener("click", (event) => {
        const createClassButton = event.target.closest("[data-sidebar-create-class]");
        const sidebarClassLink = event.target.closest("[data-sidebar-class-link]");
        if (!createClassButton && !sidebarClassLink) return;

        window.setTimeout(() => {
            hydrateTeacherDashboard();
            hydrateQuickCreateForm();
        }, 0);
    });
}

function refreshTeacherDashboard() {
    syncDashboardFormatHierarchy();
    hydrateTeacherDashboard();
    hydrateDashboardGreeting();
    hydrateQuickCreateForm();
    if (typeof window.educariaEvaluateActivationMilestones === "function") {
        window.educariaEvaluateActivationMilestones("dashboard_refresh", {
            markCompletion: false
        });
    }
    setDashboardReadyState(true);
}

async function syncAndRefreshTeacherDashboard() {
    refreshTeacherDashboard();

    if (typeof syncClassesWithFirebase !== "function") return;

    try {
        await syncClassesWithFirebase();
    } catch (error) {
        console.warn("EducarIA dashboard class sync unavailable:", error);
    }

    refreshTeacherDashboard();
}

function dashboardTourStorageKeys() {
    const teacher = typeof readCurrentTeacher === "function" ? readCurrentTeacher() : null;
    const identifiers = [
        teacher?.uid,
        teacher?.email,
        readDashboardTourSessionIdentifier()
    ].filter(Boolean);

    if (!identifiers.length) {
        identifiers.push("default");
    }

    return [...new Set(identifiers.map((identifier) => {
        return `${DASHBOARD_TOUR_STORAGE_PREFIX}${String(identifier || "default").trim().toLowerCase()}`;
    }))];
}

function readDashboardTourSessionIdentifier() {
    try {
        return localStorage.getItem(DASHBOARD_TOUR_SESSION_KEY) || "";
    } catch (error) {
        console.warn("EducarIA dashboard tour unavailable:", error);
        return "";
    }
}

function hasSeenDashboardTour() {
    try {
        return dashboardTourStorageKeys().some((key) => localStorage.getItem(key) === "done");
    } catch (error) {
        console.warn("EducarIA dashboard tour unavailable:", error);
        return false;
    }
}

function markDashboardTourSeen() {
    try {
        dashboardTourStorageKeys().forEach((key) => {
            localStorage.setItem(key, "done");
        });
    } catch (error) {
        console.warn("EducarIA dashboard tour unavailable:", error);
    }
}

function currentDashboardSidebarPanel() {
    const current = document.querySelector('[data-sidebar-toggle][aria-expanded="true"]');
    return current?.dataset.sidebarToggle || "";
}

function setDashboardTourSidebarPanel(key) {
    document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
        const isCurrent = Boolean(key) && button.dataset.sidebarToggle === key;
        button.setAttribute("aria-expanded", isCurrent ? "true" : "false");
        button.classList.toggle("is-active", isCurrent);
    });

    document.querySelectorAll("[data-sidebar-panel]").forEach((panel) => {
        panel.hidden = key ? panel.dataset.sidebarPanel !== key : true;
    });
}

function dashboardTourSteps() {
    return [
        {
            selector: '[data-dashboard-tour-anchor="create-class-form"]',
            panel: "create-class",
            title: "Comece pela turma",
            description: "Crie sua primeira turma com nome e mat\u00e9ria. Isso organiza os materiais e libera o fluxo de cria\u00e7\u00e3o r\u00e1pida."
        },
        {
            selector: '[data-dashboard-tour-anchor="quick-create"]',
            title: "Entre direto no editor",
            description: "Depois de escolher uma turma, use a cria\u00e7\u00e3o r\u00e1pida para entrar direto em um dos formatos principais."
        },
        {
            selector: '[data-dashboard-tour-anchor="toolkit"]',
            title: "Comece pelos principais",
            description: "Aqui ficam os tres formatos principais da plataforma. Os extras continuam disponiveis logo abaixo quando voce precisar variar a dinamica."
        },
        {
            selector: '[data-dashboard-tour-anchor="library"]',
            title: "Guarde seu próprio acervo",
            description: "A biblioteca concentra os materiais que você salvou nos builders, para revisar, editar e reutilizar depois."
        }
    ];
}

function dashboardProgressSnapshot() {
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const lessons = typeof readLessonsLibrary === "function" ? readLessonsLibrary() : [];
    return {
        classesCount: classes.length,
        lessonsCount: lessons.length
    };
}

function shouldAutoStartDashboardTour() {
    if (hasSeenDashboardTour()) return false;
    const snapshot = dashboardProgressSnapshot();
    return snapshot.classesCount === 0 || snapshot.lessonsCount === 0;
}

function trackDashboardTourEvent(name, metadata = {}) {
    if (typeof educariaTrack !== "function") return;
    educariaTrack(name, metadata);
}

function buildDashboardTour() {
    if (dashboardTourState) return dashboardTourState;

    const root = document.createElement("div");
    root.className = "dashboard-tour";
    root.hidden = true;
    root.innerHTML = `
        <button type="button" class="dashboard-tour-backdrop" data-dashboard-tour-close aria-label="Fechar guia"></button>
        <div class="dashboard-tour-highlight" aria-hidden="true"></div>
        <section class="dashboard-tour-card" role="dialog" aria-modal="true" aria-label="Guia de uso do painel">
            <span class="dashboard-tour-step"></span>
            <h3></h3>
            <p></p>
            <div class="dashboard-tour-progress" aria-hidden="true"></div>
            <div class="dashboard-tour-actions">
                <button type="button" class="dashboard-tour-button" data-dashboard-tour-close>Pular</button>
                <div class="dashboard-tour-actions-group">
                    <button type="button" class="dashboard-tour-button" data-dashboard-tour-prev>Voltar</button>
                    <button type="button" class="dashboard-tour-button dashboard-tour-button--primary" data-dashboard-tour-next>Pr&oacute;ximo</button>
                </div>
            </div>
        </section>
    `;

    document.body.appendChild(root);

    dashboardTourState = {
        root,
        card: root.querySelector(".dashboard-tour-card"),
        highlight: root.querySelector(".dashboard-tour-highlight"),
        step: root.querySelector(".dashboard-tour-step"),
        title: root.querySelector("h3"),
        description: root.querySelector("p"),
        progress: root.querySelector(".dashboard-tour-progress"),
        previous: root.querySelector("[data-dashboard-tour-prev]"),
        next: root.querySelector("[data-dashboard-tour-next]"),
        closeButtons: root.querySelectorAll("[data-dashboard-tour-close]"),
        steps: dashboardTourSteps(),
        index: 0,
        previousPanel: "",
        entrypoint: "manual",
        startedAt: 0,
        lastFocusedElement: null,
        rafId: 0,
        repositionHandler: null,
        keyHandler: null
    };

    dashboardTourState.closeButtons.forEach((button) => {
        button.addEventListener("click", () => closeDashboardTour(true, "skipped"));
    });

    dashboardTourState.previous.addEventListener("click", () => {
        if (!dashboardTourState || dashboardTourState.index === 0) return;
        dashboardTourState.index -= 1;
        renderDashboardTourStep(true);
    });

    dashboardTourState.next.addEventListener("click", () => {
        if (!dashboardTourState) return;
        const isLastStep = dashboardTourState.index >= dashboardTourState.steps.length - 1;
        if (isLastStep) {
            closeDashboardTour(true, "completed");
            return;
        }

        dashboardTourState.index += 1;
        renderDashboardTourStep(true);
    });

    return dashboardTourState;
}

function renderDashboardTourProgress() {
    if (!dashboardTourState?.progress) return;

    dashboardTourState.progress.innerHTML = dashboardTourState.steps.map((_, index) => {
        const active = index === dashboardTourState.index ? " is-active" : "";
        return `<span class="${active.trim()}"></span>`;
    }).join("");
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function positionDashboardTourCard(targetRect) {
    const state = dashboardTourState;
    if (!state?.card) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16;
    const gap = 18;
    const cardRect = state.card.getBoundingClientRect();

    let left = targetRect.right + gap;
    let top = targetRect.top;

    if (left + cardRect.width > viewportWidth - padding) {
        left = targetRect.left - cardRect.width - gap;
    }

    if (left < padding) {
        left = clamp(targetRect.left, padding, viewportWidth - cardRect.width - padding);
        top = targetRect.bottom + gap;
    }

    if (top + cardRect.height > viewportHeight - padding) {
        top = targetRect.top - cardRect.height - gap;
    }

    top = clamp(top, padding, viewportHeight - cardRect.height - padding);
    left = clamp(left, padding, viewportWidth - cardRect.width - padding);

    state.card.style.left = `${Math.round(left)}px`;
    state.card.style.top = `${Math.round(top)}px`;
}

function updateDashboardTourGeometry() {
    if (!dashboardTourState || dashboardTourState.root.hidden) return;

    const step = dashboardTourState.steps[dashboardTourState.index];
    if (!step) return;

    const target = document.querySelector(step.selector);
    if (!target) {
        closeDashboardTour(true, "target_missing");
        return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 10;
    const left = clamp(rect.left - padding, 8, window.innerWidth - 24);
    const top = clamp(rect.top - padding, 8, window.innerHeight - 24);
    const width = clamp(rect.width + padding * 2, 44, window.innerWidth - left - 8);
    const height = clamp(rect.height + padding * 2, 44, window.innerHeight - top - 8);

    dashboardTourState.highlight.style.left = `${Math.round(left)}px`;
    dashboardTourState.highlight.style.top = `${Math.round(top)}px`;
    dashboardTourState.highlight.style.width = `${Math.round(width)}px`;
    dashboardTourState.highlight.style.height = `${Math.round(height)}px`;

    positionDashboardTourCard(rect);
}

function scheduleDashboardTourGeometry() {
    if (!dashboardTourState || dashboardTourState.root.hidden) return;
    if (dashboardTourState.rafId) {
        window.cancelAnimationFrame(dashboardTourState.rafId);
    }

    dashboardTourState.rafId = window.requestAnimationFrame(() => {
        dashboardTourState.rafId = 0;
        updateDashboardTourGeometry();
    });
}

function renderDashboardTourStep(shouldScroll) {
    const state = dashboardTourState;
    if (!state) return;

    const step = state.steps[state.index];
    if (!step) return;

    setDashboardTourSidebarPanel(step.panel || "");

    const target = document.querySelector(step.selector);
    if (!target) {
        closeDashboardTour(true, "target_missing");
        return;
    }

    state.step.textContent = `Passo ${state.index + 1} de ${state.steps.length}`;
    state.title.textContent = step.title;
    state.description.textContent = step.description;
    state.previous.disabled = state.index === 0;
    state.next.textContent = state.index === state.steps.length - 1 ? "Concluir" : "Pr\u00f3ximo";
    renderDashboardTourProgress();

    const scrollBehavior = shouldScroll ? "smooth" : "auto";
    target.scrollIntoView({
        behavior: scrollBehavior,
        block: "center",
        inline: "nearest"
    });

    window.setTimeout(() => {
        updateDashboardTourGeometry();
    }, shouldScroll ? 240 : 0);
}

function detachDashboardTourListeners() {
    if (!dashboardTourState?.repositionHandler || !dashboardTourState?.keyHandler) return;

    window.removeEventListener("resize", dashboardTourState.repositionHandler);
    window.removeEventListener("scroll", dashboardTourState.repositionHandler, true);
    document.removeEventListener("keydown", dashboardTourState.keyHandler);
    dashboardTourState.repositionHandler = null;
    dashboardTourState.keyHandler = null;
}

function attachDashboardTourListeners() {
    if (!dashboardTourState || dashboardTourState.repositionHandler || dashboardTourState.keyHandler) return;

    dashboardTourState.repositionHandler = () => {
        scheduleDashboardTourGeometry();
    };

    dashboardTourState.keyHandler = (event) => {
        if (!dashboardTourState || dashboardTourState.root.hidden) return;

        if (event.key === "Escape") {
            closeDashboardTour(true, "dismissed");
        } else if (event.key === "Tab") {
            const focusable = [...dashboardTourState.card.querySelectorAll(DASHBOARD_TOUR_FOCUSABLE_SELECTOR)]
                .filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        } else if (event.key === "ArrowLeft" && dashboardTourState.index > 0) {
            dashboardTourState.index -= 1;
            renderDashboardTourStep(false);
        } else if (event.key === "ArrowRight") {
            const isLastStep = dashboardTourState.index >= dashboardTourState.steps.length - 1;
            if (isLastStep) {
                closeDashboardTour(true, "completed");
                return;
            }

            dashboardTourState.index += 1;
            renderDashboardTourStep(false);
        }
    };

    window.addEventListener("resize", dashboardTourState.repositionHandler);
    window.addEventListener("scroll", dashboardTourState.repositionHandler, true);
    document.addEventListener("keydown", dashboardTourState.keyHandler);
}

function closeDashboardTour(markSeen, reason = "dismissed") {
    if (!dashboardTourState) return;

    const completed = reason === "completed";
    const stepsSeen = Math.max(1, dashboardTourState.index + 1);
    const durationMs = dashboardTourState.startedAt ? Math.max(0, Date.now() - dashboardTourState.startedAt) : 0;

    if (markSeen) {
        markDashboardTourSeen();
    }
    if (completed && typeof window.educariaMarkMilestone === "function") {
        window.educariaMarkMilestone("onboarding_tour_completed", {
            entrypoint: dashboardTourState.entrypoint || "unknown",
            stepsSeen,
            durationMs
        });
    }
    trackDashboardTourEvent("dashboard_tour_closed", {
        reason,
        completed,
        entrypoint: dashboardTourState.entrypoint || "unknown",
        stepsSeen,
        durationMs
    });

    dashboardTourState.root.hidden = true;
    dashboardTourState.highlight.removeAttribute("style");
    dashboardTourState.card.style.removeProperty("left");
    dashboardTourState.card.style.removeProperty("top");
    setDashboardTourSidebarPanel(dashboardTourState.previousPanel || "");
    detachDashboardTourListeners();
    dashboardTourState.lastFocusedElement?.focus?.();
}

function startDashboardTour(force, entrypoint = "manual") {
    if (!force && hasSeenDashboardTour()) return;

    const snapshot = dashboardProgressSnapshot();
    const state = buildDashboardTour();
    state.index = 0;
    state.previousPanel = currentDashboardSidebarPanel();
    state.entrypoint = entrypoint;
    state.startedAt = Date.now();
    state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.root.hidden = false;
    if (!force) {
        markDashboardTourSeen();
    }
    if (typeof window.educariaMarkMilestone === "function") {
        window.educariaMarkMilestone("onboarding_tour_started", {
            entrypoint,
            classesCount: snapshot.classesCount,
            lessonsCount: snapshot.lessonsCount
        });
    }
    trackDashboardTourEvent("dashboard_tour_started", {
        entrypoint,
        force,
        classesCount: snapshot.classesCount,
        lessonsCount: snapshot.lessonsCount
    });
    attachDashboardTourListeners();
    renderDashboardTourStep(true);
    window.setTimeout(() => {
        state.next?.focus?.();
    }, 40);
}

function bindDashboardTourTrigger() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-dashboard-tour-start]");
        if (!trigger) return;

        event.preventDefault();
        startDashboardTour(true, "manual");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    refreshTeacherDashboard();
    bindTeacherDashboardClassLinks();
    bindQuickCreateForm();
    bindQuickCreateRefresh();
    bindDashboardTourTrigger();
    syncAndRefreshTeacherDashboard();

    window.setTimeout(() => {
        if (!shouldAutoStartDashboardTour()) return;
        startDashboardTour(false, "auto");
    }, 480);
});

document.addEventListener("educaria-auth-changed", () => {
    syncAndRefreshTeacherDashboard();
});

document.addEventListener("educaria-classes-updated", () => {
    refreshTeacherDashboard();
});

document.addEventListener("educaria-language-changed", () => {
    refreshTeacherDashboard();
});

window.addEventListener("pageshow", () => {
    syncAndRefreshTeacherDashboard();
});

