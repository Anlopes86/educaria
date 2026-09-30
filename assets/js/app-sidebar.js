function sidebarTeacherName() {
    if (typeof readCurrentTeacher === "function") {
        const teacher = readCurrentTeacher();
        if (teacher?.name) return teacher.name;
    }
    return "Professor";
}

function sidebarTranslate(key, fallback) {
    if (typeof window !== "undefined" && typeof window.educariaTranslate === "function") {
        return window.educariaTranslate(key, fallback);
    }
    return fallback || key;
}

function sidebarTeacherInstitution() {
    if (typeof readCurrentTeacher === "function") {
        const teacher = readCurrentTeacher();
        if (teacher?.institution) return teacher.institution;
    }
    return "Conta educacional";
}

const SIDEBAR_FORMATS = {
    core: [
        { href: "slides-builder.html?new=1", label: "Slides", labelKey: "dashboard.formats.slides" },
        { href: "quiz-builder.html?new=1", label: "Quiz", labelKey: "dashboard.formats.quiz" },
        { href: "criar-aula.html", label: "Aula completa", labelKey: "dashboard.formats.lesson" }
    ],
    extra: [
        { href: "flashcards-builder.html?new=1", label: "Flashcards", labelKey: "sidebar.formats.flashcards" },
        { href: "jogo-memoria-builder.html?new=1", label: "Jogo da memória", labelKey: "sidebar.formats.memory" },
        { href: "roleta-builder.html?new=1", label: "Roleta", labelKey: "sidebar.formats.wheel" },
        { href: "ligar-pontos-builder.html?new=1", label: "Ligar pontos", labelKey: "sidebar.formats.match" },
        { href: "mapa-mental-builder.html?new=1", label: "Mapa mental", labelKey: "sidebar.formats.mindmap" },
        { href: "debate-guiado-builder.html?new=1", label: "Debate guiado", labelKey: "sidebar.formats.debate" },
        { href: "caca-palavras-builder.html?new=1", label: "Caça-palavras", labelKey: "sidebar.formats.wordsearch" },
        { href: "palavras-cruzadas-builder.html?new=1", label: "Palavras cruzadas", labelKey: "sidebar.formats.crossword" },
        { href: "forca-builder.html?new=1", label: "Forca", labelKey: "sidebar.formats.hangman" }
    ]
};

const SIDEBAR_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24"><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/></svg>',
    "create-class": '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10-3v6m3-3h-6"/></svg>',
    "create-activity": '<svg viewBox="0 0 24 24"><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Zm6 10 .9 2.6 2.6.9-2.6.9L18 20l-.9-2.6-2.6-.9 2.6-.9L18 13ZM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Z"/></svg>',
    classes: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m7.5-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9.5 10v-2a4 4 0 0 0-3-3.87m-1-12a4 4 0 0 1 0 7.75"/></svg>',
    "recent-classes": '<svg viewBox="0 0 24 24"><path d="M3 5h18M5 5v14h14V5M8 9h8m-8 4h6"/></svg>',
    library: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V5a2 2 0 0 1 2-2h14v18H6.5A2.5 2.5 0 0 1 4 18.5Z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.16.38.38.72.69 1 .3.27.7.4 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.79.6Z"/></svg>',
    logout: '<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5m5 5H3m12-9h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};

function escapeSidebarHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function currentSidebarPath() {
    const path = window.location.pathname.replace(/\\/g, "/");
    return path.split("/").pop() || "index.html";
}

function currentSidebarClass() {
    if (typeof readSelectedClass === "function") {
        return readSelectedClass();
    }
    return "";
}

function sidebarTeacherInitials(name) {
    const parts = String(name || "Professor").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "P").toUpperCase();
}

function ensureSidebarProfile() {
    document.querySelectorAll(".app-sidebar-profile").forEach((profile) => {
        profile.classList.add("dashboard-sidebar-profile");

        let copy = profile.querySelector(".app-sidebar-profile-copy");
        if (!copy) {
            const existingCopy = [...profile.children].find((child) => (
                !child.classList.contains("dashboard-avatar")
                && child.matches("div")
                && child.querySelector("strong, span")
            ));
            if (existingCopy) {
                copy = existingCopy;
                copy.classList.add("app-sidebar-profile-copy");
            } else {
                copy = document.createElement("div");
                copy.className = "app-sidebar-profile-copy";
                [...profile.children]
                    .filter((child) => !child.classList.contains("dashboard-avatar"))
                    .forEach((child) => copy.append(child));
                profile.append(copy);
            }
        }

        if (!profile.querySelector(".dashboard-avatar")) {
            const avatar = document.createElement("div");
            avatar.className = "dashboard-avatar dashboard-avatar--sidebar";
            avatar.dataset.sidebarAvatar = "";
            avatar.setAttribute("aria-hidden", "true");
            profile.prepend(avatar);
        } else {
            profile.querySelector(".dashboard-avatar")?.setAttribute("data-sidebar-avatar", "");
        }

        if (!profile.querySelector(".app-sidebar-profile-home")) {
            const home = document.createElement("span");
            home.className = "app-sidebar-profile-home";
            home.setAttribute("aria-hidden", "true");
            home.innerHTML = `<span class="sidebar-nav-icon">${SIDEBAR_ICONS.dashboard}</span>`;
            profile.append(home);
        }
    });
}

function sidebarNavKey(element) {
    const toggle = element.dataset.sidebarToggle;
    if (toggle === "formats") return "create-activity";
    if (toggle === "create-class") return "create-class";
    if (toggle === "classes") return "recent-classes";

    const href = (element.getAttribute("href") || "").split(/[?#]/)[0];
    if (href === "index.html") return "dashboard";
    if (href === "turmas.html") return "classes";
    if (href === "biblioteca.html") return "library";
    if (href === "configuracoes.html") return "settings";
    return "";
}

function reorderSidebarNavigation() {
    document.querySelectorAll(".app-sidebar-nav").forEach((nav) => {
        const itemFor = (selector) => {
            const item = nav.querySelector(`:scope > ${selector}`);
            if (!item) return [];
            const panel = item.matches("[data-sidebar-toggle]")
                ? nav.querySelector(`:scope > [data-sidebar-panel="${item.dataset.sidebarToggle}"]`)
                : null;
            return panel ? [item, panel] : [item];
        };
        const ordered = [
            ...itemFor('a[href="index.html"]'),
            ...itemFor('[data-sidebar-toggle="create-class"]'),
            ...itemFor('[data-sidebar-toggle="formats"]'),
            ...itemFor('[data-sidebar-classes-page-link]'),
            ...itemFor('[data-sidebar-toggle="classes"]'),
            ...itemFor('a[href="biblioteca.html"]'),
            ...itemFor('a[href="configuracoes.html"]')
        ];
        ordered.forEach((item) => nav.append(item));
    });
}

function decorateSidebarNavigation() {
    document.querySelectorAll(".sidebar-nav-link").forEach((item) => {
        const key = sidebarNavKey(item);
        if (!key || !SIDEBAR_ICONS[key]) return;
        const label = item.querySelector(".sidebar-nav-label")?.textContent || item.textContent.trim();
        item.dataset.sidebarNavKey = key;
        item.classList.toggle("sidebar-nav-link--primary", key === "create-activity");
        item.innerHTML = `
            <span class="sidebar-nav-icon" aria-hidden="true">${SIDEBAR_ICONS[key]}</span>
            <span class="sidebar-nav-label">${escapeSidebarHtml(label)}</span>
        `;
    });

    document.querySelectorAll(".app-sidebar-footer [data-logout]").forEach((button) => {
        const label = button.querySelector(".sidebar-nav-label")?.textContent || button.textContent.trim();
        button.classList.add("sidebar-logout-button");
        button.innerHTML = `
            <span class="sidebar-nav-icon" aria-hidden="true">${SIDEBAR_ICONS.logout}</span>
            <span class="sidebar-nav-label">${escapeSidebarHtml(label)}</span>
        `;
    });
}

function enhanceSidebarPanels() {
    document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
        const key = button.dataset.sidebarToggle;
        const panel = document.querySelector(`[data-sidebar-panel="${key}"]`);
        if (!panel) return;
        panel.id = panel.id || `sidebar-panel-${key}`;
        panel.setAttribute("role", "region");
        button.setAttribute("aria-controls", panel.id);
    });
}

function ensureSidebarClassesPageLink() {
    document.querySelectorAll('[data-sidebar-toggle="classes"]').forEach((button) => {
        const parent = button.parentElement;
        if (!parent) return;

        const previous = button.previousElementSibling;
        if (!previous || !previous.matches("[data-sidebar-classes-page-link]")) {
            const link = document.createElement("a");
            link.href = "turmas.html";
            link.className = "sidebar-nav-link";
            link.textContent = sidebarTranslate("dashboard.nav.myClasses", "Turmas");
            link.setAttribute("data-sidebar-classes-page-link", "");
            parent.insertBefore(link, button);
        }

        button.textContent = sidebarTranslate("sidebar.nav.recentClasses", "Turmas recentes");
    });
}

function renderSidebarCurrentClass(current) {
    document.querySelectorAll("[data-sidebar-current-class]").forEach((element) => {
        element.textContent = current || sidebarTranslate("classDetail.empty.noSelectedClass", "Nenhuma turma selecionada");
    });
}

function renderSidebarFormats() {
    const currentPath = currentSidebarPath();

    document.querySelectorAll('[data-sidebar-panel="formats"]').forEach((panel) => {
        if (panel.querySelector("[data-sidebar-format-list]")) return;

        panel.innerHTML = `
            <div class="sidebar-subgroup">
                <span class="sidebar-subgroup-label">${sidebarTranslate("sidebar.formats.core", "Formatos principais")}</span>
                <div class="sidebar-subitems" data-sidebar-format-list="core"></div>
            </div>
            <div class="sidebar-subgroup">
                <span class="sidebar-subgroup-label">${sidebarTranslate("dashboard.toolkit.moreFormats", "Mais formatos")}</span>
                <div class="sidebar-subitems" data-sidebar-format-list="extra"></div>
            </div>
        `;
    });

    document.querySelectorAll("[data-sidebar-format-list]").forEach((root) => {
        const group = root.dataset.sidebarFormatList === "extra" ? "extra" : "core";
        const items = SIDEBAR_FORMATS[group];

        root.innerHTML = items.map((item) => {
            const active = item.href.split("?")[0] === currentPath ? " is-active" : "";
            return `
                <a href="${item.href}" class="sidebar-subitem${active}">
                    ${escapeSidebarHtml(sidebarTranslate(item.labelKey, item.label))}
                </a>
            `;
        }).join("");
    });
}

function renderSidebarClasses() {
    const root = document.querySelector("[data-sidebar-class-list]");
    if (!root || typeof getAvailableClasses !== "function") return;

    const current = currentSidebarClass();
    const classes = getAvailableClasses();
    renderSidebarCurrentClass(current);

    if (!classes.length) {
        root.innerHTML = `
            <div class="sidebar-empty-state">
                <strong>${sidebarTranslate("sidebar.empty.noClasses", "Nenhuma turma criada")}</strong>
                <span>${sidebarTranslate("sidebar.empty.createFirstClass", "Crie sua primeira turma em Nova turma.")}</span>
            </div>
        `;
        return;
    }

    const visibleClasses = classes.slice(0, 5);
    root.innerHTML = visibleClasses.map((className) => `
        <a href="turma.html" class="sidebar-subitem ${className === current ? "is-active" : ""}" data-sidebar-class-link="${escapeSidebarHtml(className)}">
            ${escapeSidebarHtml(className)}
        </a>
    `).join("") + (classes.length > visibleClasses.length ? `
        <a href="turmas.html" class="sidebar-subitem sidebar-subitem--all">
            ${escapeSidebarHtml(sidebarTranslate("sidebar.classes.viewAll", "Ver todas as turmas"))}
        </a>
    ` : "");
}

function createSidebarClass() {
    const nameField = document.getElementById("sidebar-nome-turma");
    const subjectField = document.getElementById("sidebar-materia");
    const feedback = document.querySelector("[data-sidebar-class-feedback]");
    if (!nameField || typeof getAvailableClasses !== "function" || typeof saveClassList !== "function" || typeof saveSelectedClass !== "function") {
        return;
    }

    const className = String(nameField.value || "").trim();
    const subject = String(subjectField?.value || "").trim();

    if (!className) {
        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = sidebarTranslate("sidebar.feedback.enterClassName", "Digite um nome para criar a turma.");
        }
        nameField.focus();
        return;
    }

    if (!subject) {
        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = sidebarTranslate("sidebar.feedback.chooseSubject", "Escolha a matéria da turma.");
        }
        subjectField?.focus();
        return;
    }

    const composedName = `${className} - ${subject}`;
    const classes = getAvailableClasses();
    const exists = classes.some((item) => item === composedName);
    const wasFirstClass = !exists && classes.length === 0;

    if (!exists) {
        saveClassList([...classes, composedName]);
    }

    saveSelectedClass(composedName);
    if (typeof saveClassProfile === "function") {
        saveClassProfile(composedName, { subject });
    }
    if (typeof educariaTrack === "function") {
        educariaTrack("class_created", {
            source: "sidebar",
            className: composedName,
            subject
        });
    }

    if (wasFirstClass && typeof window.educariaMarkMilestone === "function") {
        window.educariaMarkMilestone("activation_first_class_created", {
            source: "sidebar",
            className: composedName,
            subject
        });
    }
    if (typeof window.educariaEvaluateActivationMilestones === "function") {
        window.educariaEvaluateActivationMilestones("sidebar_class_create", {
            markCompletion: true
        });
    }

    renderSidebarClasses();

    if (feedback) {
        feedback.hidden = false;
        feedback.textContent = exists
            ? `${sidebarTranslate("sidebar.feedback.alreadyExistsPrefix", "A turma")} ${composedName} ${sidebarTranslate("sidebar.feedback.alreadyExistsSuffix", "já estava criada e foi selecionada.")}`
            : `${sidebarTranslate("sidebar.feedback.createdPrefix", "Turma")} ${composedName} ${sidebarTranslate("sidebar.feedback.createdSuffix", "criada e selecionada.")}`;
    }

    nameField.value = "";
    if (subjectField) {
        subjectField.value = "";
    }
}

function openSidebarPanel(key) {
    document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
        const isCurrent = button.dataset.sidebarToggle === key;
        button.setAttribute("aria-expanded", isCurrent ? "true" : "false");
        button.classList.toggle("is-active", isCurrent);
    });

    document.querySelectorAll("[data-sidebar-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.sidebarPanel !== key;
    });
}

function closeSidebarPanels() {
    document.querySelectorAll("[data-sidebar-panel]").forEach((panel) => {
        panel.hidden = true;
    });

    document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
        button.setAttribute("aria-expanded", "false");
        button.classList.remove("is-active");
    });
}

function setActiveSidebarLinks() {
    const currentPath = currentSidebarPath();

    document.querySelectorAll(".sidebar-nav-link[href], .sidebar-subitem[href]").forEach((link) => {
        const href = link.getAttribute("href") || "";
        const normalized = href.split(/[?#]/)[0];
        const isActive = normalized === currentPath;
        link.classList.toggle("is-active", isActive);
        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

function bindSidebarClassLinks() {
    document.addEventListener("click", (event) => {
        const link = event.target.closest("[data-sidebar-class-link]");
        if (!link || typeof saveSelectedClass !== "function") return;

        saveSelectedClass(link.dataset.sidebarClassLink || "");
    });
}

function bindSidebarCreateClass() {
    const button = document.querySelector("[data-sidebar-create-class]");
    const nameField = document.getElementById("sidebar-nome-turma");
    const subjectField = document.getElementById("sidebar-materia");
    if (!button || !nameField) return;

    const submit = (event) => {
        event?.preventDefault();
        createSidebarClass();
    };

    button.addEventListener("click", submit);

    nameField.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        submit(event);
    });

    subjectField?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        submit(event);
    });
}

function bindSidebarToggles() {
    document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
        button.addEventListener("click", () => {
            const key = button.dataset.sidebarToggle;
            const panel = document.querySelector(`[data-sidebar-panel="${key}"]`);
            if (!panel) return;

            const expanded = button.getAttribute("aria-expanded") === "true";
            if (expanded) {
                closeSidebarPanels();
                return;
            }

            openSidebarPanel(key);
        });
    });
}

function bindSidebarPanelOpeners() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-open-sidebar-panel]");
        if (!trigger) return;

        const key = String(trigger.dataset.openSidebarPanel || "").trim();
        const panel = document.querySelector(`[data-sidebar-panel="${key}"]`);
        if (!key || !panel) return;

        event.preventDefault();
        openSidebarPanel(key);
        setMobileSidebarOpen(true);
        window.requestAnimationFrame(() => panel.querySelector("input, select, button, a")?.focus());
    });
}

function hydrateSidebarTeacher() {
    const teacherName = sidebarTeacherName();
    document.querySelectorAll("[data-sidebar-teacher]").forEach((element) => {
        element.textContent = teacherName;
    });

    document.querySelectorAll("[data-sidebar-avatar]").forEach((element) => {
        element.textContent = sidebarTeacherInitials(teacherName);
    });

    document.querySelectorAll("[data-sidebar-institution]").forEach((element) => {
        element.textContent = sidebarTeacherInstitution();
    });
}

function setMobileSidebarOpen(open) {
    const shouldOpen = Boolean(open) && window.matchMedia("(max-width: 860px)").matches;
    document.body.classList.toggle("app-sidebar-open", shouldOpen);
    document.querySelector("[data-sidebar-mobile-toggle]")?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function ensureMobileSidebarControls() {
    const sidebar = document.querySelector(".app-sidebar");
    if (!sidebar || document.querySelector("[data-sidebar-mobile-toggle]")) return;

    sidebar.id = sidebar.id || "educaria-app-sidebar";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "app-sidebar-mobile-toggle";
    toggle.dataset.sidebarMobileToggle = "";
    toggle.setAttribute("aria-controls", sidebar.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", sidebarTranslate("sidebar.mobile.open", "Abrir menu principal"));
    toggle.innerHTML = `
        <span class="sidebar-nav-icon" aria-hidden="true">${SIDEBAR_ICONS.menu}</span>
        <span>${escapeSidebarHtml(sidebarTranslate("sidebar.mobile.menu", "Menu"))}</span>
    `;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "app-sidebar-mobile-close";
    close.dataset.sidebarMobileClose = "";
    close.setAttribute("aria-label", sidebarTranslate("sidebar.mobile.close", "Fechar menu principal"));
    close.innerHTML = `<span class="sidebar-nav-icon" aria-hidden="true">${SIDEBAR_ICONS.close}</span>`;
    sidebar.append(close);

    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "app-sidebar-backdrop";
    backdrop.dataset.sidebarBackdrop = "";
    backdrop.setAttribute("aria-label", sidebarTranslate("sidebar.mobile.close", "Fechar menu principal"));

    document.body.append(toggle, backdrop);
    toggle.addEventListener("click", () => setMobileSidebarOpen(!document.body.classList.contains("app-sidebar-open")));
    close.addEventListener("click", () => setMobileSidebarOpen(false));
    backdrop.addEventListener("click", () => setMobileSidebarOpen(false));

    sidebar.addEventListener("click", (event) => {
        if (event.target.closest("a[href]")) setMobileSidebarOpen(false);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setMobileSidebarOpen(false);
    });

    window.addEventListener("resize", () => {
        if (!window.matchMedia("(max-width: 860px)").matches) setMobileSidebarOpen(false);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    ensureMobileSidebarControls();
    ensureSidebarProfile();
    hydrateSidebarTeacher();
    ensureSidebarClassesPageLink();
    reorderSidebarNavigation();
    renderSidebarFormats();
    renderSidebarClasses();
    decorateSidebarNavigation();
    enhanceSidebarPanels();
    setActiveSidebarLinks();
    closeSidebarPanels();
    bindSidebarClassLinks();
    bindSidebarCreateClass();
    bindSidebarToggles();
    bindSidebarPanelOpeners();
});

document.addEventListener("educaria-auth-changed", () => {
    hydrateSidebarTeacher();
});

document.addEventListener("educaria-classes-updated", () => {
    renderSidebarClasses();
});

document.addEventListener("educaria-language-changed", () => {
    ensureSidebarClassesPageLink();
    reorderSidebarNavigation();
    renderSidebarFormats();
    renderSidebarClasses();
    decorateSidebarNavigation();
    enhanceSidebarPanels();
    setActiveSidebarLinks();
});
