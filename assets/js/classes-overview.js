function classesOverviewSummary(lessons) {
    if (!Array.isArray(lessons) || !lessons.length) {
        return "Nenhuma atividade criada ainda.";
    }

    const counts = lessons.reduce((result, lesson) => {
        const key = lesson.materialType || "slides";
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});

    return Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([type, count]) => `${typeof materialGroupLabel === "function" ? materialGroupLabel(type) : type} (${count})`)
        .join(" • ");
}

function classesOverviewLatestLabel(lessons) {
    if (!Array.isArray(lessons) || !lessons.length) {
        return "Sem atividades ainda";
    }

    const latest = lessons[0]?.updatedAt || "";
    return typeof formatLessonDate === "function" ? formatLessonDate(latest) : latest;
}

function hydrateClassesOverviewPage() {
    const root = document.querySelector("[data-classes-overview-grid]");
    const classCount = document.querySelector("[data-classes-overview-count]");
    const activityCount = document.querySelector("[data-classes-overview-activities]");
    if (!root && !classCount && !activityCount) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const lessons = classes.flatMap((className) => (
        typeof classMaterials === "function" ? classMaterials(className) : []
    ));

    if (classCount) classCount.textContent = `${classes.length}`;
    if (activityCount) activityCount.textContent = `${lessons.filter((lesson) => (lesson.materialType || "slides") !== "lesson").length}`;

    if (!root) return;
    if (!classes.length) {
        root.innerHTML = `
            <article class="lesson-history-card">
                <span class="route-tag">Sem turmas</span>
                <h3>Nenhuma turma criada ainda</h3>
                <p>Use o botão Criar turma na lateral para começar e organizar suas atividades por turma.</p>
            </article>
        `;
        return;
    }

    root.innerHTML = classes.map((className) => {
        const classLessons = typeof classMaterials === "function" ? classMaterials(className) : [];
        const materialCount = classLessons.length;
        const formatsCount = new Set(classLessons.map((lesson) => lesson.materialType || "slides")).size;

        return `
            <article class="lesson-history-card class-overview-card">
                <span class="route-tag">${materialCount} ${materialCount === 1 ? "atividade" : "atividades"}</span>
                <h3>${className}</h3>
                <p>${classesOverviewSummary(classLessons)}</p>
                <div class="lesson-history-meta">
                    <span>${classesOverviewLatestLabel(classLessons)}</span>
                    <span>${formatsCount} ${formatsCount === 1 ? "formato" : "formatos"}</span>
                </div>
                <div class="lesson-history-actions">
                    <a href="turma.html#atividades-salvas" class="platform-link-button platform-link-primary" data-class-open-materials="${className}">Ver materiais</a>
                    <a href="index.html#activity-toolkit" class="platform-link-button platform-link-secondary" data-class-create-material="${className}">Criar material</a>
                </div>
            </article>
        `;
    }).join("");
}

function bindClassesOverviewActions() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-class-open-materials], [data-class-create-material]");
        if (!trigger || typeof saveSelectedClass !== "function") return;

        const className = trigger.dataset.classOpenMaterials || trigger.dataset.classCreateMaterial || "";
        if (!className) return;
        saveSelectedClass(className);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateClassesOverviewPage();
    bindClassesOverviewActions();
});
