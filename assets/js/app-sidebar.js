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

function renderSidebarCurrentClass(current) {
    document.querySelectorAll("[data-sidebar-current-class]").forEach((element) => {
        element.textContent = current || "Nenhuma turma selecionada";
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
            feedback.textContent = "Escolha a materia da turma.";
        }
        subjectField?.focus();
        return;
    }

    const composedName = `${className} - ${subject}`;
    const classes = getAvailableClasses();
    const exists = classes.some((item) => item === composedName);

    if (!exists) {
        saveClassList([...classes, composedName]);
    }

    saveSelectedClass(composedName);
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
        link.classList.toggle("is-active", normalized === currentPath);
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
