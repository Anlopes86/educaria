const LESSONS_LIBRARY_KEY = "educaria:lessons";
const ACTIVE_LESSON_KEY = "educaria:activeLessonId";
const CLASS_CONTEXT_KEY = "educaria:selectedClass";

function draftKeyForType(type) {
    if (type === "quiz") return "educaria:builder:quiz";
    if (type === "flashcards") return "educaria:builder:flashcards";
    if (type === "wheel") return "educaria:builder:wheel";
    if (type === "memory") return "educaria:builder:memory";
    if (type === "match") return "educaria:builder:match";
    if (type === "mindmap") return "educaria:builder:mindmap";
    if (type === "debate") return "educaria:builder:debate";
    return "educaria:builder:slides";
}

function stackSelectorForType(type) {
    if (type === "quiz") return "[data-quiz-stack]";
    if (type === "flashcards") return "[data-flashcards-stack]";
    if (type === "wheel") return "[data-wheel-segments]";
    if (type === "memory") return "[data-memory-pairs]";
    if (type === "match") return "[data-match-pairs]";
    if (type === "mindmap") return "[data-mind-branches]";
    if (type === "debate") return "[data-debate-steps]";
    return "[data-slides-stack]";
}

function readLessonsLibrary() {
    try {
        const raw = localStorage.getItem(LESSONS_LIBRARY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn("EducarIA lessons unavailable:", error);
        return [];
    }
}

function writeLessonsLibrary(lessons) {
    try {
        localStorage.setItem(LESSONS_LIBRARY_KEY, JSON.stringify(lessons));
    } catch (error) {
        console.warn("EducarIA lessons unavailable:", error);
    }
}

function removeLessonById(id) {
    const lessons = readLessonsLibrary().filter((lesson) => lesson.id !== id);
    writeLessonsLibrary(lessons);

    if (readActiveLessonId() === id) {
        writeActiveLessonId("");
    }
}

function readActiveLessonId() {
    try {
        return localStorage.getItem(ACTIVE_LESSON_KEY) || "";
    } catch (error) {
        console.warn("EducarIA active lesson unavailable:", error);
        return "";
    }
}

function writeActiveLessonId(id) {
    try {
        localStorage.setItem(ACTIVE_LESSON_KEY, id);
    } catch (error) {
        console.warn("EducarIA active lesson unavailable:", error);
    }
}

function currentClassName() {
    if (typeof readSelectedClass === "function") {
        return readSelectedClass();
    }

    try {
        return localStorage.getItem(CLASS_CONTEXT_KEY) || "";
    } catch (error) {
        console.warn("EducarIA class context unavailable:", error);
        return "";
    }
}

function updateCurrentClass(value) {
    if (typeof saveSelectedClass === "function") {
        saveSelectedClass(value);
        return;
    }

    try {
        localStorage.setItem(CLASS_CONTEXT_KEY, value);
    } catch (error) {
        console.warn("EducarIA class context unavailable:", error);
    }
}

function readCurrentDraftByType(type) {
    try {
        return localStorage.getItem(draftKeyForType(type)) || "";
    } catch (error) {
        console.warn("EducarIA draft unavailable:", error);
        return "";
    }
}

function writeCurrentDraftByType(type, rawDraft) {
    if (!rawDraft) return;

    try {
        localStorage.setItem(draftKeyForType(type), rawDraft);
    } catch (error) {
        console.warn("EducarIA draft unavailable:", error);
    }
}

function forceSyncDraftFromPage(type) {
    const stack = document.querySelector(stackSelectorForType(type));
    if (!stack) return;

    const materialize = typeof persistMaterializedFields === "function" ? persistMaterializedFields : null;
    if (materialize) {
        materialize(stack);
        materialize(document);
    }

    const controls = {};
    document.querySelectorAll("input[id], textarea[id], select[id]").forEach((field) => {
        if (field.type === "file") return;
        controls[field.id] = field.value;
    });

    try {
        localStorage.setItem(draftKeyForType(type), JSON.stringify({
            controls,
            stackHtml: stack.innerHTML
        }));
    } catch (error) {
        console.warn("EducarIA draft unavailable:", error);
    }
}

function parseDraftHtml(rawDraft) {
    try {
        const parsed = JSON.parse(rawDraft);
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${parsed.stackHtml || ""}</div>`, "text/html");
        return { parsed, doc };
    } catch (error) {
        return { parsed: {}, doc: document.implementation.createHTMLDocument("") };
    }
}

function summarizeSlidesDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Aula sem titulo", summary: "Material salvo sem resumo definido.", type: "Aula com slides", materialType: "slides" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const firstSlide = doc.querySelector("[data-slide-card]");
    const title = firstSlide?.querySelector('[data-field="slide-title"]')?.value?.trim() || "Aula sem titulo";
    const summary = firstSlide?.querySelector('[data-field="slide-body"]')?.value?.trim() || "Material salvo sem resumo definido.";
    return { title, summary, type: "Aula com slides", materialType: "slides" };
}

function summarizeFlashcardsDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Flashcards sem titulo", summary: "Material salvo sem resumo definido.", type: "Flashcards", materialType: "flashcards" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["cards-tema"] || "Flashcards";
    const firstCard = doc.querySelector("[data-flashcard]");
    const front = firstCard?.querySelector('[data-field="front"]')?.value?.trim() || "Sem card inicial";
    const back = firstCard?.querySelector('[data-field="back"]')?.value?.trim() || "Sem verso";
    return { title, summary: `${front} - ${back}`, type: "Flashcards", materialType: "flashcards" };
}

function summarizeQuizDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Quiz sem titulo", summary: "Material salvo sem resumo definido.", type: "Quiz", materialType: "quiz" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const firstQuestion = doc.querySelector("[data-quiz-question]");
    const prompt = firstQuestion?.querySelector('[data-field="prompt"]')?.value?.trim() || "Quiz";
    const title = parsed.controls?.["quiz-tema"] || "Quiz";
    return { title, summary: prompt, type: "Quiz", materialType: "quiz" };
}

function summarizeWheelDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Roleta sem titulo", summary: "Material salvo sem resumo definido.", type: "Roleta", materialType: "wheel" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["roleta-titulo"] || "Roleta";
    const firstItem = doc.querySelector("[data-wheel-text]")?.value?.trim() || "Sem espaco inicial";
    const count = doc.querySelectorAll("[data-wheel-segment]").length || 0;
    return { title, summary: `${count} espacos - ${firstItem}`, type: "Roleta", materialType: "wheel" };
}

function summarizeMemoryDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Jogo da memoria sem titulo", summary: "Material salvo sem resumo definido.", type: "Jogo da memoria", materialType: "memory" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["memoria-titulo"] || "Jogo da memoria";
    const firstFront = doc.querySelector("[data-memory-front]")?.value?.trim() || "Sem frente inicial";
    const firstBack = doc.querySelector("[data-memory-back]")?.value?.trim() || "Sem verso inicial";
    return { title, summary: `${firstFront} - ${firstBack}`, type: "Jogo da memoria", materialType: "memory" };
}

function summarizeMatchDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Ligar pontos sem titulo", summary: "Material salvo sem resumo definido.", type: "Ligar pontos", materialType: "match" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["ligar-titulo"] || "Ligar pontos";
    const firstLeft = doc.querySelector("[data-match-left]")?.value?.trim() || "Sem item inicial";
    const firstRight = doc.querySelector("[data-match-right]")?.value?.trim() || "Sem resposta inicial";
    return { title, summary: `${firstLeft} - ${firstRight}`, type: "Ligar pontos", materialType: "match" };
}

function summarizeMindmapDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Mapa mental sem titulo", summary: "Material salvo sem resumo definido.", type: "Mapa mental", materialType: "mindmap" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["mapa-centro"] || "Mapa mental";
    const firstBranch = doc.querySelector("[data-mind-title]")?.value?.trim() || "Sem topico inicial";
    const count = doc.querySelectorAll("[data-mind-branch]").length || 0;
    return { title, summary: `${count} topicos - ${firstBranch}`, type: "Mapa mental", materialType: "mindmap" };
}

function summarizeDebateDraft(rawDraft) {
    if (!rawDraft) {
        return { title: "Debate guiado sem titulo", summary: "Material salvo sem resumo definido.", type: "Debate guiado", materialType: "debate" };
    }

    const { parsed, doc } = parseDraftHtml(rawDraft);
    const title = parsed.controls?.["debate-titulo"] || "Debate guiado";
    const question = parsed.controls?.["debate-pergunta"] || "Sem pergunta central";
    const count = doc.querySelectorAll("[data-debate-step]").length || 0;
    return { title, summary: `${count} etapas - ${question}`, type: "Debate guiado", materialType: "debate" };
}

function summarizeCurrentDraft(preferredType = "") {
    const currentType = preferredType || (typeof readCurrentMaterialType === "function" ? readCurrentMaterialType() : "slides");
    const currentDraft = readCurrentDraftByType(currentType);

    if (currentDraft) {
        if (currentType === "flashcards") return { rawDraft: currentDraft, summary: summarizeFlashcardsDraft(currentDraft), materialType: "flashcards" };
        if (currentType === "quiz") return { rawDraft: currentDraft, summary: summarizeQuizDraft(currentDraft), materialType: "quiz" };
        if (currentType === "wheel") return { rawDraft: currentDraft, summary: summarizeWheelDraft(currentDraft), materialType: "wheel" };
        if (currentType === "memory") return { rawDraft: currentDraft, summary: summarizeMemoryDraft(currentDraft), materialType: "memory" };
        if (currentType === "match") return { rawDraft: currentDraft, summary: summarizeMatchDraft(currentDraft), materialType: "match" };
        if (currentType === "mindmap") return { rawDraft: currentDraft, summary: summarizeMindmapDraft(currentDraft), materialType: "mindmap" };
        if (currentType === "debate") return { rawDraft: currentDraft, summary: summarizeDebateDraft(currentDraft), materialType: "debate" };
        return { rawDraft: currentDraft, summary: summarizeSlidesDraft(currentDraft), materialType: "slides" };
    }

    const fallbackOrder = ["slides", "flashcards", "quiz", "wheel", "memory", "match", "mindmap", "debate"];
    for (const type of fallbackOrder) {
        const draft = readCurrentDraftByType(type);
        if (!draft) continue;
        return summarizeCurrentDraft(type);
    }

    return { rawDraft: "", summary: summarizeSlidesDraft(""), materialType: "slides" };
}

function formatLessonDate(isoString) {
    if (!isoString) return "Agora";

    try {
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(isoString));
    } catch (error) {
        return "Agora";
    }
}

function saveCurrentLessonToClass(preferredType = "") {
    const turma = currentClassName() || "Turma";
    if (preferredType && typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(preferredType);
    }

    if (preferredType) {
        forceSyncDraftFromPage(preferredType);
    }

    const { rawDraft, summary, materialType } = summarizeCurrentDraft(preferredType);
    const lessons = readLessonsLibrary();
    const activeId = readActiveLessonId();
    const existing = lessons.find((lesson) => lesson.id === activeId);
    const lessonId = existing && (existing.materialType || "slides") === materialType ? existing.id : `lesson-${Date.now()}`;

    const record = {
        id: lessonId,
        className: turma,
        title: summary.title,
        summary: summary.summary,
        type: summary.type,
        materialType,
        updatedAt: new Date().toISOString(),
        draft: rawDraft
    };

    const nextLessons = lessons.filter((lesson) => lesson.id !== lessonId);
    nextLessons.unshift(record);
    writeLessonsLibrary(nextLessons);
    writeActiveLessonId(lessonId);
    updateCurrentClass(turma);

    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(materialType);
    }

    return record;
}

function activateLessonById(id) {
    const lesson = readLessonsLibrary().find((item) => item.id === id);
    if (!lesson) return null;

    writeActiveLessonId(lesson.id);
    updateCurrentClass(lesson.className);
    writeCurrentDraftByType(lesson.materialType || "slides", lesson.draft);
    if (typeof setCurrentMaterialType === "function") {
        setCurrentMaterialType(lesson.materialType || "slides");
    }
    return lesson;
}

function readActiveLesson() {
    const activeId = readActiveLessonId();
    if (!activeId) return null;
    return readLessonsLibrary().find((item) => item.id === activeId) || null;
}

function editorPathForLesson(lesson) {
    if (lesson.materialType === "quiz") return "quiz-builder.html";
    if (lesson.materialType === "flashcards") return "flashcards-builder.html";
    if (lesson.materialType === "wheel") return "roleta-builder.html";
    if (lesson.materialType === "memory") return "jogo-memoria-builder.html";
    if (lesson.materialType === "match") return "ligar-pontos-builder.html";
    if (lesson.materialType === "mindmap") return "mapa-mental-builder.html";
    if (lesson.materialType === "debate") return "debate-guiado-builder.html";
    return "slides-builder.html";
}

function presentationPathForLesson(lesson) {
    if (typeof presentationPathForMaterial === "function") {
        return presentationPathForMaterial(lesson.materialType || "slides");
    }
    return "apresentacao.html";
}

function materialGroupLabel(type) {
    if (type === "quiz") return "Quiz";
    if (type === "flashcards") return "Flashcards";
    if (type === "wheel") return "Roleta";
    if (type === "memory") return "Jogo da memoria";
    if (type === "match") return "Ligar pontos";
    if (type === "mindmap") return "Mapa mental";
    if (type === "debate") return "Debate guiado";
    return "Slides";
}

function materialGroupDescription(type) {
    if (type === "quiz") return "Perguntas para revisar, aplicar e projetar em sala.";
    if (type === "flashcards") return "Cards para retomada rapida e revisao visual.";
    if (type === "wheel") return "Sorteios, comandos e desafios prontos para a turma.";
    if (type === "memory") return "Pares para jogar, revisar e memorizar em sala.";
    if (type === "match") return "Associacoes em duas colunas para ligar e revisar em sala.";
    if (type === "mindmap") return "Topicos conectados para organizar, explicar e revisar conteudos.";
    if (type === "debate") return "Roteiros de mediacao para discutir, argumentar e fechar o tema em sala.";
    return "Sequencias para conduzir a aula projetada.";
}

function bindSaveLessonAction() {
    const buttons = document.querySelectorAll("[data-save-lesson]");
    if (!buttons.length) return;

    buttons.forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const material = button.dataset.saveMaterial || "";
            if (material && typeof setCurrentMaterialType === "function") {
                setCurrentMaterialType(material);
            }
            saveCurrentLessonToClass(material);
            window.location.href = button.dataset.saveTarget || "turma.html";
        });
    });
}

function deleteLessonAndRefresh(id) {
    if (!id) return;
    removeLessonById(id);
    window.location.reload();
}

function hydrateCompletionSummary() {
    const lesson = readActiveLesson();
    if (!lesson) return;

    const summary = document.querySelector("[data-lesson-summary]");
    if (summary) {
        summary.innerHTML = `<strong>Turma:</strong> ${lesson.className}<br><strong>Conteudo:</strong> ${lesson.title}<br><strong>Tipo:</strong> ${lesson.type}.`;
    }
}

function hydrateClassPage() {
    const listRoot = document.querySelector("[data-saved-lessons]");
    const selectRoot = document.querySelector("[data-saved-lessons-select]");
    const actionsRoot = document.querySelector("[data-saved-lessons-actions]");
    if (!listRoot && !selectRoot) return;

    const turma = currentClassName() || "Turma";
    document.querySelectorAll("[data-class-title]").forEach((node) => {
        node.textContent = turma;
    });

    const lessons = readLessonsLibrary().filter((lesson) => lesson.className === turma);
    if (!lessons.length) {
        if (listRoot) {
            listRoot.innerHTML = `
                <article class="lesson-history-card">
                    <span class="route-tag">Sem atividades salvas</span>
                    <h3>Nenhuma atividade pronta ainda</h3>
                    <p>Salve uma atividade finalizada para ela aparecer aqui e poder ser reaberta depois.</p>
                </article>
            `;
        }

        if (selectRoot) {
            selectRoot.innerHTML = `<option>Nenhuma atividade salva nesta turma</option>`;
            selectRoot.disabled = true;
        }

        if (actionsRoot) {
            actionsRoot.innerHTML = "";
        }
        return;
    }

    if (listRoot) {
        const groupedLessons = lessons.reduce((groups, lesson) => {
            const key = lesson.materialType || "slides";
            if (!groups[key]) groups[key] = [];
            groups[key].push(lesson);
            return groups;
        }, {});

        const groupOrder = ["quiz", "slides", "flashcards", "wheel", "memory", "match", "mindmap", "debate"];
        listRoot.innerHTML = groupOrder
            .filter((key) => groupedLessons[key]?.length)
            .map((key) => `
                <section class="lesson-group-section">
                    <div class="lesson-group-header">
                        <div>
                            <span class="platform-section-label">${materialGroupLabel(key)}</span>
                            <h3>${materialGroupLabel(key)}</h3>
                        </div>
                        <p>${materialGroupDescription(key)}</p>
                    </div>
                    <div class="lesson-history-grid class-lesson-grid">
                        ${groupedLessons[key].map((lesson) => `
                            <article class="lesson-history-card lesson-history-card--grouped">
                                <span class="route-tag">${materialGroupLabel(key)}</span>
                                <h3>${lesson.title}</h3>
                                <p>${lesson.summary}</p>
                                <div class="lesson-history-meta">
                                    <span>Atualizado em ${formatLessonDate(lesson.updatedAt)}</span>
                                    <span>${lesson.type}</span>
                                </div>
                                <div class="lesson-history-actions">
                                    <a href="aula-publicada.html" class="platform-link-button platform-link-primary" data-open-lesson="${lesson.id}">Abrir resumo</a>
                                    <a href="${editorPathForLesson(lesson)}" class="platform-link-button platform-link-secondary" data-edit-lesson="${lesson.id}">Editar</a>
                                    <a href="${presentationPathForLesson(lesson)}" class="platform-link-button platform-link-secondary" data-present-lesson="${lesson.id}">Apresentar</a>
                                    <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${lesson.id}">Excluir</button>
                                </div>
                            </article>
                        `).join("")}
                    </div>
                </section>
            `).join("");
    }

    if (selectRoot) {
        selectRoot.disabled = false;
        selectRoot.innerHTML = lessons.map((lesson, index) => `
            <option value="${lesson.id}" ${index === 0 ? "selected" : ""}>${lesson.title} - ${lesson.type} - ${formatLessonDate(lesson.updatedAt)}</option>
        `).join("");
    }

    if (actionsRoot) {
        const activeLesson = lessons[0];
        actionsRoot.innerHTML = `
            <a href="aula-publicada.html" class="platform-link-button platform-link-primary" data-open-lesson="${activeLesson.id}" data-lesson-action="open">Abrir resumo</a>
            <a href="${editorPathForLesson(activeLesson)}" class="platform-link-button platform-link-secondary" data-edit-lesson="${activeLesson.id}" data-lesson-action="edit">Editar material</a>
            <a href="${presentationPathForLesson(activeLesson)}" class="platform-link-button platform-link-secondary" data-present-lesson="${activeLesson.id}" data-lesson-action="present">Abrir apresentacao</a>
            <button type="button" class="platform-link-button platform-link-secondary" data-delete-lesson="${activeLesson.id}" data-lesson-action="delete">Excluir atividade</button>
        `;
    }
}

function bindLessonActivationLinks() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-open-lesson], [data-edit-lesson], [data-present-lesson]");
        if (!trigger) return;

        const lessonId = trigger.dataset.openLesson || trigger.dataset.editLesson || trigger.dataset.presentLesson;
        if (!lessonId) return;
        activateLessonById(lessonId);
    });

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-delete-lesson]");
        if (!trigger) return;

        event.preventDefault();
        deleteLessonAndRefresh(trigger.dataset.deleteLesson || "");
    });

    const selectRoot = document.querySelector("[data-saved-lessons-select]");
    const actionsRoot = document.querySelector("[data-saved-lessons-actions]");
    if (selectRoot && actionsRoot) {
        selectRoot.addEventListener("change", () => {
            const lessonId = selectRoot.value;
            const lesson = readLessonsLibrary().find((item) => item.id === lessonId);
            if (!lesson) return;

            const open = actionsRoot.querySelector('[data-lesson-action="open"]');
            const edit = actionsRoot.querySelector('[data-lesson-action="edit"]');
            const present = actionsRoot.querySelector('[data-lesson-action="present"]');
            const remove = actionsRoot.querySelector('[data-lesson-action="delete"]');

            if (open) open.dataset.openLesson = lessonId;
            if (edit) {
                edit.dataset.editLesson = lessonId;
                edit.setAttribute("href", editorPathForLesson(lesson));
            }
            if (present) {
                present.dataset.presentLesson = lessonId;
                present.setAttribute("href", presentationPathForLesson(lesson));
            }
            if (remove) remove.dataset.deleteLesson = lessonId;
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    bindSaveLessonAction();
    hydrateCompletionSummary();
    hydrateClassPage();
    bindLessonActivationLinks();
});
