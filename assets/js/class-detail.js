function classDetailTranslate(key, fallback) {
    if (typeof window.educariaTranslate === "function") return window.educariaTranslate(key) || fallback;
    return fallback;
}

function classDetailCurrentName() {
    return typeof readSelectedClass === "function" ? readSelectedClass() : "";
}

function hydrateClassDetailHeader() {
    const className = classDetailCurrentName();
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const picker = document.querySelector("[data-class-detail-picker]");
    const editButton = document.querySelector("[data-class-profile-edit]");
    const profile = typeof getClassProfile === "function" ? getClassProfile(className) : null;

    if (picker) {
        picker.innerHTML = classes.length
            ? classes.map((item) => `<option value="${escapeHtml(item)}"${item === className ? " selected" : ""}>${escapeHtml(item)}</option>`).join("")
            : `<option value="">${escapeHtml(classDetailTranslate("classDetail.empty.noSelectedClass", "Nenhuma turma selecionada"))}</option>`;
        picker.disabled = !classes.length;
    }
    if (editButton) editButton.disabled = !className;

    document.querySelectorAll("[data-class-profile-school]").forEach((node) => {
        node.textContent = profile?.school || classDetailTranslate("classDetail.profile.schoolEmpty", "Escola não informada");
    });
    document.querySelectorAll("[data-class-profile-subject]").forEach((node) => {
        node.textContent = profile?.subject || classDetailTranslate("classDetail.profile.subjectEmpty", "Disciplina não informada");
    });
    document.querySelectorAll("[data-class-profile-students]").forEach((node) => {
        node.textContent = profile?.studentCount
            ? `${profile.studentCount} ${classDetailTranslate("classDetail.profile.students", "alunos")}`
            : classDetailTranslate("classDetail.profile.studentsEmpty", "Número de alunos não informado");
    });
    document.querySelectorAll("[data-class-profile-notes]").forEach((node) => {
        node.textContent = profile?.notes || classDetailTranslate("classDetail.profile.notesEmpty", "Adicione informações úteis sobre esta turma.");
    });
}

function openClassProfileModal() {
    const modal = document.querySelector("[data-class-profile-modal]");
    const className = classDetailCurrentName();
    if (!modal || !className) return;

    const profile = typeof getClassProfile === "function" ? getClassProfile(className) : null;
    const nameField = modal.querySelector("[data-class-profile-name]");
    const schoolField = modal.querySelector("[data-class-profile-school-input]");
    const subjectField = modal.querySelector("[data-class-profile-subject-input]");
    const studentsField = modal.querySelector("[data-class-profile-students-input]");
    const notesField = modal.querySelector("[data-class-profile-notes-input]");
    const feedback = modal.querySelector("[data-class-profile-feedback]");

    if (nameField) nameField.value = className;
    if (schoolField) schoolField.value = profile?.school || "";
    if (subjectField) subjectField.value = profile?.subject || "";
    if (studentsField) studentsField.value = profile?.studentCount || "";
    if (notesField) notesField.value = profile?.notes || "";
    if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
    }

    modal.hidden = false;
    document.body.classList.add("class-profile-modal-open");
    window.requestAnimationFrame(() => nameField?.focus());
}

function closeClassProfileModal() {
    const modal = document.querySelector("[data-class-profile-modal]");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("class-profile-modal-open");
    document.querySelector("[data-class-profile-edit]")?.focus();
}

function saveClassProfileForm(form) {
    const currentName = classDetailCurrentName();
    const feedback = form.querySelector("[data-class-profile-feedback]");
    const nextName = form.querySelector("[data-class-profile-name]")?.value.trim() || "";
    const details = {
        school: form.querySelector("[data-class-profile-school-input]")?.value || "",
        subject: form.querySelector("[data-class-profile-subject-input]")?.value || "",
        studentCount: form.querySelector("[data-class-profile-students-input]")?.value || 0,
        notes: form.querySelector("[data-class-profile-notes-input]")?.value || ""
    };

    if (typeof renameClass !== "function") return;
    const result = renameClass(currentName, nextName, details);
    if (!result?.ok) {
        if (feedback) {
            feedback.textContent = result?.error || classDetailTranslate("classDetail.profile.saveError", "Não foi possível salvar os dados da turma.");
            feedback.hidden = false;
        }
        return;
    }

    closeClassProfileModal();
    hydrateClassDetailHeader();
    if (typeof hydrateClassPage === "function") hydrateClassPage();
    if (typeof renderSidebarClasses === "function") renderSidebarClasses();
}

function bindClassDetailHeader() {
    document.addEventListener("change", (event) => {
        const picker = event.target.closest?.("[data-class-detail-picker]");
        if (!picker || !picker.value || typeof saveSelectedClass !== "function") return;
        saveSelectedClass(picker.value);
        hydrateClassDetailHeader();
        if (typeof hydrateClassPage === "function") hydrateClassPage();
        if (typeof renderSidebarClasses === "function") renderSidebarClasses();
        document.querySelector("#atividades-salvas")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.addEventListener("click", (event) => {
        if (event.target.closest("[data-class-profile-edit]")) {
            openClassProfileModal();
            return;
        }
        if (event.target.closest("[data-class-profile-close]")) {
            closeClassProfileModal();
            return;
        }
        if (event.target.matches("[data-class-profile-modal]")) closeClassProfileModal();
    });

    document.querySelector("[data-class-profile-form]")?.addEventListener("submit", (event) => {
        event.preventDefault();
        saveClassProfileForm(event.currentTarget);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !document.querySelector("[data-class-profile-modal]")?.hidden) {
            closeClassProfileModal();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateClassDetailHeader();
    bindClassDetailHeader();
});

document.addEventListener("educaria-classes-updated", hydrateClassDetailHeader);
document.addEventListener("educaria-language-changed", hydrateClassDetailHeader);
