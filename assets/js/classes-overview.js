const CLASSES_OVERVIEW_FILTERS = [
    { id: "all", label: "Todas" },
    { id: "active", label: "Com atividades" },
    { id: "empty", label: "Sem atividades" },
    { id: "slides", label: "Com slides/aula" },
    { id: "quiz", label: "Com quiz" }
];

let activeClassesOverviewFilter = "all";

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

function classHasMaterialType(lessons, acceptedTypes) {
    const types = Array.isArray(acceptedTypes) ? acceptedTypes : [acceptedTypes];
    if (!Array.isArray(lessons) || !lessons.length) return false;
    return lessons.some((lesson) => types.includes(lesson.materialType || "slides"));
}

function classesOverviewCards(classes) {
    return classes.map((className) => {
        const classLessons = typeof classMaterials === "function" ? classMaterials(className) : [];
        const materialCount = classLessons.length;
        const formatsCount = new Set(classLessons.map((lesson) => lesson.materialType || "slides")).size;
        const latestLesson = classLessons[0] || null;

        return {
            className,
            classLessons,
            materialCount,
            formatsCount,
            summary: classesOverviewSummary(classLessons),
            latestLabel: classesOverviewLatestLabel(classLessons),
            latestLesson
        };
    });
}

function classesOverviewFilterDefinition(filterId) {
    return CLASSES_OVERVIEW_FILTERS.find((filter) => filter.id === filterId) || CLASSES_OVERVIEW_FILTERS[0];
}

function classesOverviewFilterMatches(card, filterId) {
    if (!card) return false;
    if (filterId === "active") return card.materialCount > 0;
    if (filterId === "empty") return card.materialCount === 0;
    if (filterId === "slides") return classHasMaterialType(card.classLessons, ["slides", "lesson"]);
    if (filterId === "quiz") return classHasMaterialType(card.classLessons, "quiz");
    return true;
}

function classesOverviewFilterCount(cards, filterId) {
    return (Array.isArray(cards) ? cards : []).filter((card) => classesOverviewFilterMatches(card, filterId)).length;
}

function classesOverviewFilterApply(cards, filterId) {
    return (Array.isArray(cards) ? cards : []).filter((card) => classesOverviewFilterMatches(card, filterId));
}

function classesOverviewFilterSummaryLabel(filterId, filteredCount, totalCount) {
    const filter = classesOverviewFilterDefinition(filterId);
    if (filter.id === "all") {
        return `${totalCount} ${totalCount === 1 ? "turma" : "turmas"} no painel.`;
    }

    if (!filteredCount) {
        return `Sem turmas em ${filter.label.toLowerCase()}.`;
    }

    return `${filteredCount} ${filteredCount === 1 ? "turma" : "turmas"} em ${filter.label.toLowerCase()}.`;
}

function renderClassesOverviewFilters(root, cards) {
    if (!root) return;
    if (!Array.isArray(cards) || !cards.length) {
        root.innerHTML = "";
        return;
    }

    root.innerHTML = CLASSES_OVERVIEW_FILTERS.map((filter) => {
        const count = classesOverviewFilterCount(cards, filter.id);
        const isActive = filter.id === activeClassesOverviewFilter;

        return `
            <button
                type="button"
                class="class-material-filter${isActive ? " is-active" : ""}"
                data-classes-overview-filter="${filter.id}"
                aria-pressed="${isActive ? "true" : "false"}"
                ${count === 0 && !isActive ? "disabled" : ""}
            >
                <span>${filter.label}</span>
                <small>${count}</small>
            </button>
        `;
    }).join("");
}

function hydrateClassesOverviewPage() {
    const root = document.querySelector("[data-classes-overview-grid]");
    const classCount = document.querySelector("[data-classes-overview-count]");
    const activityCount = document.querySelector("[data-classes-overview-activities]");
    const filterRoot = document.querySelector("[data-classes-overview-filters]");
    const filterSummary = document.querySelector("[data-classes-overview-filter-summary]");
    if (!root && !classCount && !activityCount && !filterRoot && !filterSummary) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const cards = classesOverviewCards(classes);
    const lessons = cards.flatMap((card) => card.classLessons);

    if (classCount) classCount.textContent = `${classes.length}`;
    if (activityCount) activityCount.textContent = `${lessons.filter((lesson) => (lesson.materialType || "slides") !== "lesson").length}`;

    const filterExists = CLASSES_OVERVIEW_FILTERS.some((filter) => filter.id === activeClassesOverviewFilter);
    if (!filterExists) {
        activeClassesOverviewFilter = "all";
    }

    let filteredCards = classesOverviewFilterApply(cards, activeClassesOverviewFilter);
    if (cards.length && !filteredCards.length && activeClassesOverviewFilter !== "all") {
        activeClassesOverviewFilter = "all";
        filteredCards = [...cards];
    }
    renderClassesOverviewFilters(filterRoot, cards);

    if (filterSummary) {
        if (!cards.length) {
            filterSummary.hidden = true;
            filterSummary.textContent = "";
        } else {
            filterSummary.hidden = false;
            filterSummary.textContent = classesOverviewFilterSummaryLabel(activeClassesOverviewFilter, filteredCards.length, cards.length);
        }
    }

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

    if (!filteredCards.length) {
        const filter = classesOverviewFilterDefinition(activeClassesOverviewFilter);
        root.innerHTML = `
            <article class="lesson-history-card">
                <span class="route-tag">Filtro: ${filter.label}</span>
                <h3>Nenhuma turma encontrada neste filtro</h3>
                <p>Troque o filtro para visualizar outras turmas do painel.</p>
            </article>
        `;
        return;
    }

    root.innerHTML = filteredCards.map((card) => {
        const countLabel = `${card.materialCount} ${card.materialCount === 1 ? "atividade" : "atividades"}`;
        const safe = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value || "");
        const safeClassName = safe(card.className);
        const classToken = encodeURIComponent(card.className);
        const latestLesson = card.latestLesson && typeof card.latestLesson === "object" ? card.latestLesson : null;
        const latestLessonTitle = latestLesson
            ? safe(latestLesson.title || (typeof materialGroupLabel === "function" ? materialGroupLabel(latestLesson.materialType || "slides") : "Atividade"))
            : "";
        const latestLessonId = latestLesson ? safe(latestLesson.id || "") : "";
        const latestLessonUpdated = latestLesson?.updatedAt
            ? (typeof formatLessonDate === "function" ? formatLessonDate(latestLesson.updatedAt) : latestLesson.updatedAt)
            : "";
        const latestLessonEditorPath = latestLesson && typeof editorPathForLesson === "function"
            ? safe(editorPathForLesson(latestLesson))
            : "turma.html#atividades-salvas";
        const latestLessonPresentationPath = latestLesson && typeof presentationPathForLesson === "function"
            ? safe(presentationPathForLesson(latestLesson))
            : "turma.html#atividades-salvas";

        return `
            <article class="lesson-history-card class-overview-card">
                <span class="route-tag">${countLabel}</span>
                <h3>${safeClassName}</h3>
                <p>${safe(card.summary)}</p>
                <div class="lesson-history-meta">
                    <span>${safe(card.latestLabel)}</span>
                    <span>${card.formatsCount} ${card.formatsCount === 1 ? "formato" : "formatos"}</span>
                </div>
                ${latestLesson ? `
                <div class="class-overview-latest">
                    <span class="class-overview-latest-label">Atividade recente</span>
                    <strong>${latestLessonTitle}</strong>
                    <small>${safe(latestLessonUpdated ? `Atualizada em ${latestLessonUpdated}` : "Atualização recente")}</small>
                </div>
                ` : ""}
                <div class="lesson-history-actions">
                    <a href="turma.html#atividades-salvas" class="platform-link-button platform-link-primary" data-class-open-materials="${classToken}">Ver materiais</a>
                    <a href="index.html#activity-toolkit" class="platform-link-button platform-link-secondary" data-class-create-material="${classToken}">Criar material</a>
                    ${latestLesson ? `<a href="${latestLessonEditorPath}" class="platform-link-button platform-link-secondary" data-class-open-editor="${classToken}" data-lesson-id="${latestLessonId}">Continuar edição</a>` : ""}
                    ${latestLesson ? `<a href="${latestLessonPresentationPath}" class="platform-link-button platform-link-secondary" data-class-open-presentation="${classToken}" data-lesson-id="${latestLessonId}">Apresentar agora</a>` : ""}
                </div>
            </article>
        `;
    }).join("");
}

function bindClassesOverviewActions() {
    const decodeClassToken = (value) => {
        try {
            return decodeURIComponent(String(value || ""));
        } catch (_) {
            return String(value || "");
        }
    };

    document.addEventListener("click", (event) => {
        const filterTrigger = event.target.closest("[data-classes-overview-filter]");
        if (filterTrigger) {
            event.preventDefault();
            const nextFilter = filterTrigger.dataset.classesOverviewFilter || "all";
            if (nextFilter !== activeClassesOverviewFilter) {
                activeClassesOverviewFilter = nextFilter;
                if (typeof educariaTrack === "function") {
                    educariaTrack("classes_overview_filter_changed", {
                        filter: nextFilter
                    });
                }
            }
            hydrateClassesOverviewPage();
            return;
        }

        const trigger = event.target.closest("[data-class-open-materials], [data-class-create-material], [data-class-open-editor], [data-class-open-presentation]");
        if (!trigger || typeof saveSelectedClass !== "function") return;

        const classToken = trigger.dataset.classOpenMaterials
            || trigger.dataset.classCreateMaterial
            || trigger.dataset.classOpenEditor
            || trigger.dataset.classOpenPresentation
            || "";
        const className = decodeClassToken(classToken);
        if (!className) return;
        saveSelectedClass(className);

        const lessonId = String(trigger.dataset.lessonId || "").trim();
        if (trigger.dataset.classOpenEditor !== undefined && lessonId) {
            if (typeof markLessonOpened === "function") {
                markLessonOpened(lessonId);
            }
            if (typeof activateLessonById === "function") {
                activateLessonById(lessonId);
            }
            if (typeof educariaTrack === "function") {
                educariaTrack("classes_overview_continue_latest", {
                    className,
                    lessonId
                });
            }
            return;
        }

        if (trigger.dataset.classOpenPresentation !== undefined && lessonId) {
            if (typeof markLessonPresented === "function") {
                markLessonPresented(lessonId);
            }
            if (typeof activateLessonById === "function") {
                activateLessonById(lessonId);
            }
            if (typeof educariaTrack === "function") {
                educariaTrack("classes_overview_present_latest", {
                    className,
                    lessonId
                });
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    hydrateClassesOverviewPage();
    bindClassesOverviewActions();
});

document.addEventListener("educaria-classes-updated", () => {
    hydrateClassesOverviewPage();
});

document.addEventListener("educaria-lessons-updated", () => {
    hydrateClassesOverviewPage();
});
