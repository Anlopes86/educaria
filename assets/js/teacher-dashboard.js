const DASHBOARD_TOUR_STORAGE_PREFIX = "educaria:dashboard-tour:";
const DASHBOARD_TOUR_SESSION_KEY = "educaria:auth:session";

let dashboardTourState = null;

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
                <span class="route-tag">Sem turmas</span>
                <h3>Nenhuma turma criada ainda</h3>
                <p>Use o bot\u00e3o Criar turma na lateral para come\u00e7ar.</p>
            </article>
        `;
        return;
    }

    classesRoot.innerHTML = classes.map((className) => {
        const classActivities = typeof classMaterials === "function" ? classMaterials(className) : [];
        return `
            <a href="turma.html" class="quick-class-card" data-dashboard-class-link="${className}">
                <span class="route-tag">${classActivities.length} ${classActivities.length === 1 ? "atividade" : "atividades"}</span>
                <h3>${className}</h3>
                <p>Abra a turma para criar novas atividades ou retomar o acervo j\u00e1 salvo.</p>
            </a>
        `;
    }).join("");
}

function dashboardGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

function hydrateDashboardGreeting() {
    document.querySelectorAll("[data-dashboard-greeting]").forEach((element) => {
        element.textContent = dashboardGreeting();
    });
}

function hydrateQuickCreateForm() {
    const classSelect = document.querySelector("[data-dashboard-quick-class]");
    const formatSelect = document.querySelector("[data-dashboard-quick-format]");
    const openButton = document.querySelector("[data-dashboard-quick-open]");
    if (!classSelect || !formatSelect || !openButton) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const current = typeof readSelectedClass === "function" ? readSelectedClass() : "";

    if (!classes.length) {
        classSelect.innerHTML = `<option value="">Crie uma turma primeiro</option>`;
        classSelect.disabled = true;
        formatSelect.disabled = true;
        openButton.disabled = true;
        return;
    }

    classSelect.disabled = false;
    formatSelect.disabled = false;
    openButton.disabled = false;

    classSelect.innerHTML = classes.map((className) => {
        const selected = className === current ? " selected" : "";
        return `<option value="${className}"${selected}>${className}</option>`;
    }).join("");

    if (!classSelect.value && classes[0]) {
        classSelect.value = classes[0];
    }
}

function bindQuickCreateForm() {
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
            description: "Depois de escolher uma turma, use a cria\u00e7\u00e3o r\u00e1pida para selecionar o formato da atividade e criar direto na ferramenta certa."
        },
        {
            selector: '[data-dashboard-tour-anchor="toolkit"]',
            title: "Explore os formatos",
            description: "Aqui ficam todos os tipos de atividade. Clique em qualquer card para come\u00e7ar do zero no formato que fizer mais sentido para a aula."
        },
        {
            selector: '[data-dashboard-tour-anchor="library"]',
            title: "Guarde seu proprio acervo",
            description: "A biblioteca concentra os materiais que voce salvou nos builders, para revisar, editar e reutilizar depois."
        }
    ];
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
        rafId: 0,
        repositionHandler: null,
        keyHandler: null
    };

    dashboardTourState.closeButtons.forEach((button) => {
        button.addEventListener("click", () => closeDashboardTour(true));
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
            closeDashboardTour(true);
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
        closeDashboardTour(true);
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
        closeDashboardTour(true);
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
            closeDashboardTour(true);
        } else if (event.key === "ArrowLeft" && dashboardTourState.index > 0) {
            dashboardTourState.index -= 1;
            renderDashboardTourStep(false);
        } else if (event.key === "ArrowRight") {
            const isLastStep = dashboardTourState.index >= dashboardTourState.steps.length - 1;
            if (isLastStep) {
                closeDashboardTour(true);
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

function closeDashboardTour(markSeen) {
    if (!dashboardTourState) return;

    if (markSeen) {
        markDashboardTourSeen();
    }

    dashboardTourState.root.hidden = true;
    dashboardTourState.highlight.removeAttribute("style");
    dashboardTourState.card.style.removeProperty("left");
    dashboardTourState.card.style.removeProperty("top");
    setDashboardTourSidebarPanel(dashboardTourState.previousPanel || "");
    detachDashboardTourListeners();
}

function startDashboardTour(force) {
    if (!force && hasSeenDashboardTour()) return;

    const state = buildDashboardTour();
    state.index = 0;
    state.previousPanel = currentDashboardSidebarPanel();
    state.root.hidden = false;
    if (!force) {
        markDashboardTourSeen();
    }
    attachDashboardTourListeners();
    renderDashboardTourStep(true);
}

function bindDashboardTourTrigger() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-dashboard-tour-start]");
        if (!trigger) return;

        event.preventDefault();
        startDashboardTour(true);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateTeacherDashboard();
    hydrateDashboardGreeting();
    hydrateQuickCreateForm();
    bindTeacherDashboardClassLinks();
    bindQuickCreateForm();
    bindQuickCreateRefresh();
    bindDashboardTourTrigger();

    window.setTimeout(() => {
        startDashboardTour(false);
    }, 480);
});

window.addEventListener("pageshow", () => {
    hydrateTeacherDashboard();
    hydrateDashboardGreeting();
    hydrateQuickCreateForm();
});
