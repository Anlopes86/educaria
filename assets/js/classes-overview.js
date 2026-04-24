const CLASSES_OVERVIEW_FILTERS = [
    { id: "all", labelKey: "classes.filters.all", fallback: "Todas" },
    { id: "active", labelKey: "classes.filters.active", fallback: "Com atividades" },
    { id: "empty", labelKey: "classes.filters.empty", fallback: "Sem atividades" },
    { id: "slides", labelKey: "classes.filters.slides", fallback: "Com slides/aula" },
    { id: "quiz", labelKey: "classes.filters.quiz", fallback: "Com quiz" }
];

let activeClassesOverviewFilter = "all";

function classesTranslate(key, fallback) {
    if (typeof window !== "undefined" && typeof window.educariaTranslate === "function") {
        return window.educariaTranslate(key, fallback);
    }
    return fallback || key;
}

function classesOverviewFilterLabel(filter) {
    if (!filter) return "";
    return classesTranslate(filter.labelKey, filter.fallback);
}

function classesOverviewPlural(count, singularKey, pluralKey, singularFallback, pluralFallback) {
    return classesTranslate(count === 1 ? singularKey : pluralKey, count === 1 ? singularFallback : pluralFallback);
}

function classesOverviewSummary(lessons) {
    if (!Array.isArray(lessons) || !lessons.length) {
        return classesTranslate("classes.empty.noActivitiesYet", "Nenhuma atividade criada ainda.");
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
        return classesTranslate("classes.empty.noActivitiesShort", "Sem atividades ainda");
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
    const filterLabel = classesOverviewFilterLabel(filter).toLowerCase();
    if (filter.id === "all") {
        const noun = classesOverviewPlural(totalCount, "classes.count.class", "classes.count.classes", "turma", "turmas");
        return `${totalCount} ${noun} ${classesTranslate("classes.filters.summaryInPanel", "no painel.")}`;
    }

    if (!filteredCount) {
        return `${classesTranslate("classes.filters.summaryNone", "Sem turmas em")} ${filterLabel}.`;
    }

    const noun = classesOverviewPlural(filteredCount, "classes.count.class", "classes.count.classes", "turma", "turmas");
    return `${filteredCount} ${noun} ${classesTranslate("classes.filters.summaryIn", "em")} ${filterLabel}.`;
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
                <span>${classesOverviewFilterLabel(filter)}</span>
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
                <span class="route-tag">${classesTranslate("dashboard.empty.noClasses", "Sem turmas")}</span>
                <h3>${classesTranslate("dashboard.empty.noClassesTitle", "Nenhuma turma criada ainda")}</h3>
                <p>${classesTranslate("classes.empty.noClassesCopy", "Use o botao Criar turma na lateral para comecar e organizar suas atividades por turma.")}</p>
            </article>
        `;
        return;
    }

    if (!filteredCards.length) {
        const filter = classesOverviewFilterDefinition(activeClassesOverviewFilter);
        root.innerHTML = `
            <article class="lesson-history-card">
                <span class="route-tag">${classesTranslate("classes.filters.tag", "Filtro")}: ${classesOverviewFilterLabel(filter)}</span>
                <h3>${classesTranslate("classes.empty.noFilterTitle", "Nenhuma turma encontrada neste filtro")}</h3>
                <p>${classesTranslate("classes.empty.noFilterCopy", "Troque o filtro para visualizar outras turmas do painel.")}</p>
            </article>
        `;
        return;
    }

    root.innerHTML = filteredCards.map((card) => {
        const countLabel = `${card.materialCount} ${classesOverviewPlural(card.materialCount, "dashboard.count.activity", "dashboard.count.activities", "atividade", "atividades")}`;
        const safe = typeof escapeHtml === "function" ? escapeHtml : (value) => String(value || "");
        const safeClassName = safe(card.className);
        const classToken = encodeURIComponent(card.className);
        const latestLesson = card.latestLesson && typeof card.latestLesson === "object" ? card.latestLesson : null;
        const latestLessonTitle = latestLesson
            ? safe(latestLesson.title || (typeof materialGroupLabel === "function" ? materialGroupLabel(latestLesson.materialType || "slides") : classesTranslate("classes.count.activity", "Atividade")))
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
                    <span>${card.formatsCount} ${classesOverviewPlural(card.formatsCount, "classes.count.format", "classes.count.formats", "formato", "formatos")}</span>
                </div>
                ${latestLesson ? `
                <div class="class-overview-latest">
                    <span class="class-overview-latest-label">${classesTranslate("classes.latest.label", "Atividade recente")}</span>
                    <strong>${latestLessonTitle}</strong>
                    <small>${safe(latestLessonUpdated ? `${classesTranslate("classes.latest.updatedAt", "Atualizada em")} ${latestLessonUpdated}` : classesTranslate("classes.latest.recentUpdate", "Atualizacao recente"))}</small>
                </div>
                ` : ""}
                <div class="lesson-history-actions">
                    <a href="turma.html#atividades-salvas" class="platform-link-button platform-link-primary" data-class-open-materials="${classToken}">${classesTranslate("classes.actions.viewMaterials", "Ver materiais")}</a>
                    <a href="index.html#activity-toolkit" class="platform-link-button platform-link-secondary" data-class-create-material="${classToken}">${classesTranslate("classes.actions.createMaterial", "Criar material")}</a>
                    ${latestLesson ? `<a href="${latestLessonEditorPath}" class="platform-link-button platform-link-secondary" data-class-open-editor="${classToken}" data-lesson-id="${latestLessonId}">${classesTranslate("classes.actions.continueEditing", "Continuar edicao")}</a>` : ""}
                    ${latestLesson ? `<a href="${latestLessonPresentationPath}" class="platform-link-button platform-link-secondary" data-class-open-presentation="${classToken}" data-lesson-id="${latestLessonId}">${classesTranslate("classes.actions.presentNow", "Apresentar agora")}</a>` : ""}
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

document.addEventListener("educaria-language-changed", () => {
    hydrateClassesOverviewPage();
});
