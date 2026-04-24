function sidebarTeacherName() {
    if (typeof readCurrentTeacher === "function") {
        const teacher = readCurrentTeacher();
        if (teacher?.name) return teacher.name;
    }
    return "Professor";
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
        { href: "slides-builder.html", label: "Slides" },
        { href: "quiz-builder.html", label: "Quiz" },
        { href: "criar-aula.html", label: "Aula completa" }
    ],
    extra: [
        { href: "flashcards-builder.html", label: "Flashcards" },
        { href: "jogo-memoria-builder.html", label: "Jogo da memória" },
        { href: "roleta-builder.html", label: "Roleta" },
        { href: "ligar-pontos-builder.html", label: "Ligar pontos" },
        { href: "mapa-mental-builder.html", label: "Mapa mental" },
        { href: "debate-guiado-builder.html", label: "Debate guiado" },
        { href: "caca-palavras-builder.html", label: "Caça-palavras" },
        { href: "palavras-cruzadas-builder.html", label: "Palavras cruzadas" },
        { href: "forca-builder.html", label: "Forca" }
    ]
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

function ensureSidebarClassesPageLink() {
    document.querySelectorAll('[data-sidebar-toggle="classes"]').forEach((button) => {
        const parent = button.parentElement;
        if (!parent) return;

        const previous = button.previousElementSibling;
        if (!previous || !previous.matches("[data-sidebar-classes-page-link]")) {
            const link = document.createElement("a");
            link.href = "turmas.html";
            link.className = "sidebar-nav-link";
            link.textContent = "Turmas";
            link.setAttribute("data-sidebar-classes-page-link", "");
            parent.insertBefore(link, button);
        }

        button.textContent = "Turmas rápidas";
    });
}

function renderSidebarCurrentClass(current) {
    document.querySelectorAll("[data-sidebar-current-class]").forEach((element) => {
        element.textContent = current || "Nenhuma turma selecionada";
    });
}

function renderSidebarFormats() {
    const currentPath = currentSidebarPath();

    document.querySelectorAll('[data-sidebar-panel="formats"]').forEach((panel) => {
        if (panel.querySelector("[data-sidebar-format-list]")) return;

        panel.innerHTML = `
            <div class="sidebar-subgroup">
                <span class="sidebar-subgroup-label">Formatos principais</span>
                <div class="sidebar-subitems" data-sidebar-format-list="core"></div>
            </div>
            <div class="sidebar-subgroup">
                <span class="sidebar-subgroup-label">Mais formatos</span>
                <div class="sidebar-subitems" data-sidebar-format-list="extra"></div>
            </div>
        `;
    });

    document.querySelectorAll("[data-sidebar-format-list]").forEach((root) => {
        const group = root.dataset.sidebarFormatList === "extra" ? "extra" : "core";
        const items = SIDEBAR_FORMATS[group];

        root.innerHTML = items.map((item) => {
            const active = item.href === currentPath ? " is-active" : "";
            return `
                <a href="${item.href}" class="sidebar-subitem${active}">
                    ${escapeSidebarHtml(item.label)}
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
                <strong>Nenhuma turma criada</strong>
                <span>Crie a primeira turma no formulario abaixo.</span>
            </div>
        `;
        return;
    }

    root.innerHTML = classes.map((className) => `
        <a href="turma.html" class="sidebar-subitem ${className === current ? "is-active" : ""}" data-sidebar-class-link="${className}">
            ${className}
        </a>
    `).join("");
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
            feedback.textContent = "Digite um nome para criar a turma.";
        }
        nameField.focus();
        return;
    }

    if (!subject) {
        if (feedback) {
            feedback.hidden = false;
            feedback.textContent = "Escolha a matéria da turma.";
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
            ? `A turma ${composedName} ja estava criada e foi selecionada.`
            : `Turma ${composedName} criada e selecionada.`;
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
        const normalized = href.split("#")[0];
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

function hydrateSidebarTeacher() {
    document.querySelectorAll("[data-sidebar-teacher]").forEach((element) => {
        element.textContent = sidebarTeacherName();
    });

    document.querySelectorAll("[data-sidebar-institution]").forEach((element) => {
        element.textContent = sidebarTeacherInstitution();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateSidebarTeacher();
    ensureSidebarClassesPageLink();
    renderSidebarFormats();
    renderSidebarClasses();
    setActiveSidebarLinks();
    closeSidebarPanels();
    bindSidebarClassLinks();
    bindSidebarCreateClass();
    bindSidebarToggles();
});

document.addEventListener("educaria-auth-changed", () => {
    hydrateSidebarTeacher();
});

document.addEventListener("educaria-classes-updated", () => {
    renderSidebarClasses();
});
