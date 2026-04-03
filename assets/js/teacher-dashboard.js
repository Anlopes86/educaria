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
                <p>Use o botão Criar turma na lateral para começar.</p>
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
                <p>Abra a turma para criar novas atividades ou retomar o acervo já salvo.</p>
            </a>
        `;
    }).join("");
}

function bindTeacherDashboardClassLinks() {
    document.addEventListener("click", (event) => {
        const link = event.target.closest("[data-dashboard-class-link]");
        if (!link || typeof saveSelectedClass !== "function") return;
        saveSelectedClass(link.dataset.dashboardClassLink || "");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateTeacherDashboard();
    bindTeacherDashboardClassLinks();
});
