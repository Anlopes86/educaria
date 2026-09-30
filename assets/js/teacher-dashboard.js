function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const DASHBOARD_TOUR_STORAGE_PREFIX = "educaria:dashboard-tour:";
const DASHBOARD_TOUR_SESSION_KEY = "educaria:auth:session";
const DASHBOARD_QUICK_AI_RESULT_KEY = "educaria:quick-ai-result";
const DASHBOARD_CORE_FORMATS = [
    { href: "slides-builder.html?new=1", label: "Slides", materialType: "slides" },
    { href: "quiz-builder.html?new=1", label: "Quiz", materialType: "quiz" },
    { href: "criar-aula.html", label: "Aula completa" }
];
const DASHBOARD_EXTRA_FORMATS = [
    { href: "flashcards-builder.html?new=1", label: "Flashcards", materialType: "flashcards", category: "Revisar", description: "Retomada rápida de conceitos", icon: "⚡", tone: "teal" },
    { href: "jogo-memoria-builder.html?new=1", label: "Jogo da memória", materialType: "memory", category: "Associar", description: "Conecte pares e significados", icon: "▦", tone: "green" },
    { href: "roleta-builder.html?new=1", label: "Roleta", materialType: "wheel", category: "Engajar", description: "Sorteie perguntas e desafios", icon: "✦", tone: "orange" },
    { href: "ligar-pontos-builder.html?new=1", label: "Ligar pontos", materialType: "match", category: "Praticar", description: "Relacione ideias e respostas", icon: "↔", tone: "blue" },
    { href: "mapa-mental-builder.html?new=1", label: "Mapa mental", materialType: "mindmap", category: "Organizar", description: "Visualize conexões do tema", icon: "⌘", tone: "violet" },
    { href: "debate-guiado-builder.html?new=1", label: "Debate guiado", materialType: "debate", category: "Discutir", description: "Estruture falas e argumentos", icon: "◉", tone: "rose" },
    { href: "caca-palavras-builder.html?new=1", label: "Caça-palavras", materialType: "wordsearch", category: "Aquecer", description: "Explore o vocabulário da aula", icon: "⌕", tone: "mint" },
    { href: "palavras-cruzadas-builder.html?new=1", label: "Palavras cruzadas", materialType: "crossword", category: "Fixar", description: "Reforce conceitos com pistas", icon: "#", tone: "sky" },
    { href: "forca-builder.html?new=1", label: "Forca", materialType: "hangman", category: "Descobrir", description: "Revele palavras com a turma", icon: "?", tone: "yellow" }
];
const DASHBOARD_QUICK_CREATE_FORMATS = [...DASHBOARD_CORE_FORMATS, ...DASHBOARD_EXTRA_FORMATS]
    .filter((format) => format.materialType);
const DASHBOARD_QUICK_OPTION_CONFIGS = {
    slides: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.slides", label: "Quantidade de slides", min: 1, max: 20, value: 8, instruction: (value) => `Gerar ${value} slides.` },
        {
            key: "visualMode",
            type: "select",
            label: "Visual dos slides",
            value: "standard",
            options: [
                { value: "standard", label: "Padrão EducarIA", instruction: "Modo visual: padrão EducarIA, consistente e previsível." },
                { value: "ai", label: "Personalizado pela IA", instruction: "Modo visual: personalizado pela IA de acordo com o tema." }
            ]
        }
    ],
    quiz: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.questions", label: "Quantidade de perguntas", min: 1, max: 30, value: 8, instruction: (value) => `Gerar ${value} perguntas.` },
        {
            key: "format",
            type: "select",
            labelKey: "dashboard.quick.quizFormat",
            label: "Formato das perguntas",
            value: "mixed",
            options: [
                { value: "mixed", labelKey: "dashboard.quick.value.mixed", label: "Misto", instruction: "Formato desejado: misto, combinando múltipla escolha, verdadeiro ou falso e perguntas abertas." },
                { value: "choice", labelKey: "dashboard.quick.value.choice", label: "Múltipla escolha", instruction: "Formato desejado: apenas questões de múltipla escolha." },
                { value: "open", labelKey: "dashboard.quick.value.open", label: "Perguntas abertas", instruction: "Formato desejado: apenas perguntas abertas." },
                { value: "true-false", labelKey: "dashboard.quick.value.trueFalse", label: "Verdadeiro ou falso", instruction: "Formato desejado: apenas questões de verdadeiro ou falso." }
            ]
        }
    ],
    flashcards: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.cards", label: "Quantidade de cards", min: 2, max: 24, value: 12, instruction: (value) => `Gerar ${value} cards.` }
    ],
    memory: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.pairs", label: "Quantidade de pares", min: 2, max: 16, value: 6, instruction: (value) => `Gerar ${value} pares.` }
    ],
    wheel: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.items", label: "Quantidade de itens", min: 2, max: 20, value: 8, instruction: (value) => `Gerar ${value} espaços.` }
    ],
    match: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.pairs", label: "Quantidade de pares", min: 2, max: 16, value: 6, instruction: (value) => `Gerar ${value} pares.` }
    ],
    mindmap: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.topics", label: "Quantidade de tópicos", min: 2, max: 10, value: 4, instruction: (value) => `Gerar ${value} tópicos.` },
        {
            key: "layout",
            type: "select",
            labelKey: "dashboard.quick.mapLayout",
            label: "Organização inicial",
            value: "radial",
            options: [
                { value: "radial", labelKey: "dashboard.quick.value.radial", label: "Radial", instruction: "Leitura desejada: Radial." },
                { value: "topics", labelKey: "dashboard.quick.value.topics", label: "Em tópicos", instruction: "Leitura desejada: Tópicos." }
            ]
        }
    ],
    debate: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.steps", label: "Quantidade de etapas", min: 2, max: 8, value: 3, instruction: (value) => `Gerar ${value} etapas.` },
        {
            key: "format",
            type: "select",
            labelKey: "dashboard.quick.debateFormat",
            label: "Formato do debate",
            value: "two-sides",
            options: [
                { value: "two-sides", labelKey: "dashboard.quick.value.twoSides", label: "Dois lados", instruction: "Formato desejado: Dois lados." },
                { value: "guided-circle", labelKey: "dashboard.quick.value.guidedCircle", label: "Roda guiada", instruction: "Formato desejado: Roda guiada." }
            ]
        }
    ],
    wordsearch: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.words", label: "Quantidade de palavras", min: 4, max: 20, value: 8, instruction: (value) => `Gerar ${value} palavras para o caça-palavras.` }
    ],
    crossword: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.entries", label: "Quantidade de entradas", min: 4, max: 12, value: 8, instruction: (value) => `Gerar ${value} entradas.` }
    ],
    hangman: [
        { key: "count", type: "number", labelKey: "dashboard.quick.count.words", label: "Quantidade de palavras", min: 2, max: 16, value: 6, instruction: (value) => `Gerar ${value} palavras com dicas.` }
    ]
};
const DASHBOARD_CORE_FORMAT_PATHS = new Set(DASHBOARD_CORE_FORMATS.map((format) => format.href));
const DASHBOARD_TOUR_FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

let dashboardTourState = null;
let dashboardQuickAiResult = null;
const dashboardQuickOptionState = new Map();

function dashboardTranslate(key, fallback) {
    if (typeof window.educariaTranslate !== "function") return fallback;
    return window.educariaTranslate(key) || fallback;
}

function setDashboardReadyState(isReady) {
    if (!document.body) return;
    document.body.dataset.dashboardReady = isReady ? "true" : "false";
}

function dashboardClassInitials(className) {
    const words = String(className || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!words.length) return "T";
    return words.slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase();
}

function dashboardRecentMaterialVisual(type) {
    const visuals = {
        lesson: { slug: "lesson", mark: "AU", label: "Aula completa" },
        slides: { slug: "slides", mark: "SL", label: "Slides" },
        quiz: { slug: "quiz", mark: "QZ", label: "Quiz" },
        flashcards: { slug: "flashcards", mark: "FC", label: "Flashcards" },
        memory: { slug: "memory", mark: "JM", label: "Jogo da memória" },
        wheel: { slug: "wheel", mark: "RO", label: "Roleta" },
        match: { slug: "match", mark: "LP", label: "Ligar pontos" },
        mindmap: { slug: "mindmap", mark: "MM", label: "Mapa mental" },
        debate: { slug: "debate", mark: "DB", label: "Debate guiado" },
        wordsearch: { slug: "wordsearch", mark: "CP", label: "Caça-palavras" },
        crossword: { slug: "crossword", mark: "PC", label: "Palavras cruzadas" },
        hangman: { slug: "hangman", mark: "FO", label: "Força" }
    };

    return visuals[String(type || "slides")] || visuals.slides;
}

function hydrateTeacherDashboard() {
    const recentClassesRoot = document.querySelector("[data-dashboard-recent-classes]");
    const classCount = document.querySelector("[data-dashboard-class-count]");
    const activityCount = document.querySelector("[data-dashboard-activity-count]");
    const libraryCount = document.querySelector("[data-dashboard-library-count]");
    if (!recentClassesRoot && !classCount && !activityCount && !libraryCount) return;

    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const lessons = typeof readLessonsLibrary === "function" ? readLessonsLibrary() : [];
    const libraryItems = typeof libraryMaterials === "function" ? libraryMaterials() : [];
    const classMeta = classes.map((className) => {
        const classLessons = typeof classMaterials === "function" ? classMaterials(className) : [];
        const latestLesson = classLessons[0] || null;
        return {
            className,
            classLessons,
            latestLesson,
            updatedAt: latestLesson?.updatedAt ? new Date(latestLesson.updatedAt).getTime() : 0
        };
    }).sort((left, right) => {
        const diff = (right.updatedAt || 0) - (left.updatedAt || 0);
        if (diff !== 0) return diff;
        return left.className.localeCompare(right.className);
    });
    const recentClasses = classMeta.slice(0, 3);

    if (classCount) classCount.textContent = `${classes.length}`;
    if (activityCount) activityCount.textContent = `${lessons.length}`;
    if (libraryCount) libraryCount.textContent = `${libraryItems.length}`;

    if (recentClassesRoot) {
        const recentClassesSection = recentClassesRoot.closest("[data-dashboard-recent-section]");
        if (!recentClasses.length) {
            recentClassesRoot.replaceChildren();
            if (recentClassesSection) recentClassesSection.hidden = true;
        } else {
            if (recentClassesSection) recentClassesSection.hidden = false;
            recentClassesRoot.innerHTML = recentClasses.map(({ className, classLessons, latestLesson, updatedAt }, index) => {
                const latestTitle = latestLesson
                    ? escapeHtml(latestLesson.title || (typeof materialGroupLabel === "function" ? materialGroupLabel(latestLesson.materialType || "slides") : dashboardTranslate("dashboard.recent.activity", "Atividade")))
                    : "";
                const latestPath = latestLesson && typeof editorPathForLesson === "function"
                    ? editorPathForLesson(latestLesson)
                    : "turma.html#atividades-salvas";
                const latestPresentationPath = latestLesson && typeof presentationPathForLesson === "function"
                    ? presentationPathForLesson(latestLesson)
                    : "apresentacao.html";
                const recentClassName = escapeHtml(className);
                const classInitials = escapeHtml(dashboardClassInitials(className));
                const activityLabel = `${classLessons.length} ${classLessons.length === 1 ? dashboardTranslate("dashboard.count.activity", "atividade") : dashboardTranslate("dashboard.count.activities", "atividades")}`;
                const lastUpdated = updatedAt
                    ? dashboardTranslate("classes.latest.updatedAt", "Atualizada em") + ` ${escapeHtml(formatLessonDate(updatedAt))}`
                    : dashboardTranslate("dashboard.recent.noUpdate", "Sem atualização");
                const latestVisual = dashboardRecentMaterialVisual(latestLesson?.materialType);
                const latestType = latestLesson
                    ? escapeHtml(typeof materialGroupLabel === "function"
                        ? materialGroupLabel(latestLesson.materialType || "slides")
                        : latestVisual.label)
                    : "";
                const latestStatus = latestLesson
                    ? escapeHtml(typeof lessonStatusLabel === "function"
                        ? lessonStatusLabel(latestLesson.status)
                        : (latestLesson.status === "ready" ? "Pronto para projetar" : "Rascunho"))
                    : "";
                const latestStatusClass = latestLesson?.status === "ready" ? "ready" : "draft";
                const latestLessonId = latestLesson ? escapeHtml(latestLesson.id || "") : "";
                const primaryPath = latestLesson ? escapeHtml(latestPath) : "#activity-toolkit";
                const primaryLabel = latestLesson
                    ? dashboardTranslate("dashboard.recent.resume", "Continuar")
                    : dashboardTranslate("dashboard.recent.create", "Criar atividade");

                return `
                    <article class="dashboard-recent-card dashboard-recent-card--tone-${(index % 3) + 1}">
                        <div class="dashboard-recent-card__top">
                            <span class="dashboard-recent-avatar" aria-hidden="true">${classInitials}</span>
                            <div>
                                <small>${dashboardTranslate("dashboard.recent.classLabel", "Turma")}</small>
                                <h3>${recentClassName}</h3>
                            </div>
                            <span class="dashboard-recent-count">${activityLabel}</span>
                        </div>
                        ${latestLesson ? `
                        <div class="dashboard-recent-activity">
                            <div class="dashboard-recent-visual dashboard-recent-visual--${latestVisual.slug}" aria-hidden="true">
                                <strong>${latestVisual.mark}</strong>
                                <span></span>
                                <span></span>
                            </div>
                            <div class="dashboard-recent-activity-copy">
                                <div class="dashboard-recent-activity-kicker">
                                    <span>${dashboardTranslate("dashboard.recent.latestLabel", "Última atividade")}</span>
                                    <em class="dashboard-recent-status dashboard-recent-status--${latestStatusClass}">${latestStatus}</em>
                                </div>
                                <strong>${latestTitle}</strong>
                                <div class="dashboard-recent-activity-meta">
                                    <small>${latestType}</small>
                                    <time>${escapeHtml(lastUpdated)}</time>
                                </div>
                            </div>
                        </div>
                        ` : `
                        <div class="dashboard-recent-activity dashboard-recent-activity--empty">
                            <span>${dashboardTranslate("dashboard.recent.emptyTitle", "Pronta para começar")}</span>
                            <strong>${dashboardTranslate("dashboard.recent.emptyCopy", "Esta turma ainda não tem atividades.")}</strong>
                            <small>${escapeHtml(lastUpdated)}</small>
                        </div>
                        `}
                        <div class="dashboard-recent-actions">
                            <a href="${primaryPath}" class="platform-link-button platform-link-primary" data-dashboard-class-link="${recentClassName}"${latestLesson ? ` data-edit-lesson="${latestLessonId}"` : ""}>${primaryLabel}<span aria-hidden="true">→</span></a>
                            ${latestLesson ? `<a href="${escapeHtml(latestPresentationPath)}" class="platform-link-button platform-link-secondary dashboard-recent-present" data-dashboard-class-link="${recentClassName}" data-present-lesson="${latestLessonId}">Apresentar</a>` : ""}
                            <a href="turma.html" class="dashboard-recent-class-link" data-dashboard-class-link="${recentClassName}">${dashboardTranslate("dashboard.recent.openClass", "Abrir turma")}</a>
                        </div>
                    </article>
                `;
            }).join("");
        }
        recentClassesRoot.setAttribute("aria-busy", "false");
    }

}

function dashboardGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return dashboardTranslate("dashboard.greeting.morning", "Bom dia");
    if (hour < 18) return dashboardTranslate("dashboard.greeting.afternoon", "Boa tarde");
    return dashboardTranslate("dashboard.greeting.evening", "Boa noite");
}

function hydrateDashboardGreeting() {
    document.querySelectorAll("[data-dashboard-greeting]").forEach((element) => {
        element.textContent = dashboardGreeting();
    });
}

function syncDashboardFormatHierarchy() {
    const quickCopy = document.querySelector("[data-dashboard-quick-copy]");
    if (quickCopy) {
        quickCopy.textContent = dashboardTranslate("dashboard.quick.copy", "Digite o que deseja ensinar e escolha a ferramenta. A IA prepara o primeiro rascunho.");
    }

    const toolkitSection = document.getElementById("activity-toolkit");
    if (!toolkitSection) return;

    const sectionLabel = toolkitSection.querySelector(".dashboard-section-title .platform-section-label");
    const sectionTitle = toolkitSection.querySelector(".dashboard-section-title h2");
    const sectionLink = toolkitSection.querySelector(".dashboard-section-head .dashboard-inline-link");
    if (sectionLabel) sectionLabel.textContent = dashboardTranslate("dashboard.toolkit.label", "Crie para o seu momento de aula");
    if (sectionTitle) sectionTitle.textContent = dashboardTranslate("dashboard.toolkit.title", "O que você quer fazer com a turma?");
    if (sectionLink) {
        sectionLink.textContent = dashboardTranslate("dashboard.toolkit.extraLink", "Explorar todas as atividades ↓");
        sectionLink.setAttribute("href", "#extra-formats");
    }

    const grid = toolkitSection.querySelector(".dashboard-toolkit-grid");
    if (!grid) return;

    grid.querySelectorAll(".dashboard-tool-card").forEach((card) => {
        const href = card.getAttribute("href") || "";
        if (DASHBOARD_CORE_FORMAT_PATHS.has(href)) return;
        card.remove();
    });

    const quizCard = grid.querySelector('.dashboard-tool-card--quiz .dashboard-tool-content p');
    const slidesCard = grid.querySelector('.dashboard-tool-card--slides .dashboard-tool-content p');
    const lessonCard = grid.querySelector('.dashboard-tool-card--lesson .dashboard-tool-content p');
    if (slidesCard) {
        slidesCard.textContent = dashboardTranslate("dashboard.toolkit.slides.copy", "Transforme um tema em uma sequência visual clara, pronta para projetar e conduzir a explicação.");
    }
    if (quizCard) {
        quizCard.textContent = dashboardTranslate("dashboard.toolkit.quiz.copy", "Crie perguntas envolventes para revisar o conteúdo e descobrir o que a turma já compreendeu.");
    }
    if (lessonCard) {
        lessonCard.textContent = dashboardTranslate("dashboard.toolkit.lesson.copy", "Organize objetivo, explicação, prática e fechamento em um roteiro completo para a aula.");
    }

    let secondary = toolkitSection.querySelector(".dashboard-toolkit-secondary");
    if (!secondary) {
        secondary = document.createElement("div");
        secondary.className = "dashboard-toolkit-secondary";
        secondary.id = "extra-formats";
        grid.insertAdjacentElement("afterend", secondary);
    }

    secondary.innerHTML = `
        <div class="dashboard-toolkit-secondary-head">
            <div>
                <span class="platform-section-label">${dashboardTranslate("dashboard.toolkit.moreFormats.label", "Mais possibilidades")}</span>
                <strong>${dashboardTranslate("dashboard.toolkit.moreFormats", "Dê outro ritmo à sua aula")}</strong>
                <p>${dashboardTranslate("dashboard.toolkit.moreFormats.copy", "Atividades rápidas para aquecer, praticar, organizar ideias ou fechar a aula com participação.")}</p>
            </div>
            <span class="dashboard-toolkit-count">${dashboardTranslate("dashboard.toolkit.moreFormats.count", "9 formatos prontos para criar")}</span>
        </div>
        <div class="dashboard-toolkit-links">
            ${DASHBOARD_EXTRA_FORMATS.map((format) => `
                <a href="${escapeHtml(format.href)}" class="dashboard-toolkit-link dashboard-toolkit-link--${escapeHtml(format.tone)}">
                    <span class="dashboard-toolkit-icon" aria-hidden="true">${escapeHtml(format.icon)}</span>
                    <span>
                        <small>${escapeHtml(format.category)}</small>
                        <strong>${escapeHtml(format.label)}</strong>
                        <em>${escapeHtml(format.description)}</em>
                    </span>
                    <b aria-hidden="true">→</b>
                </a>
            `).join("")}
        </div>
    `;
}

function hydrateQuickCreateForm() {
    const formatSelect = document.querySelector("[data-dashboard-quick-format]");
    const openButton = document.querySelector("[data-dashboard-quick-open]");
    if (!formatSelect || !openButton) return;
    if (formatSelect.closest("[data-dashboard-quick-form]")?.dataset.generating === "true") return;
    const previousValue = formatSelect.value;

    formatSelect.disabled = false;
    openButton.disabled = false;

    formatSelect.innerHTML = DASHBOARD_QUICK_CREATE_FORMATS.map((format) => {
        return `<option value="${format.href}" data-material-type="${format.materialType}">${format.label}</option>`;
    }).join("");
    if ([...formatSelect.options].some((option) => option.value === previousValue)) {
        formatSelect.value = previousValue;
    }
    renderDashboardQuickOptions(formatSelect.selectedOptions?.[0]?.dataset.materialType || "");
}

function readDashboardQuickOptionValues(root) {
    if (!root) return {};
    return [...root.querySelectorAll("[data-dashboard-quick-option]")].reduce((values, field) => {
        values[field.dataset.dashboardQuickOption] = field.value;
        return values;
    }, {});
}

function rememberDashboardQuickOptions() {
    const root = document.querySelector("[data-dashboard-quick-options]");
    const materialType = root?.dataset.materialType || "";
    if (!root || !materialType) return;
    dashboardQuickOptionState.set(materialType, readDashboardQuickOptionValues(root));
}

function renderDashboardQuickOptions(materialType) {
    const root = document.querySelector("[data-dashboard-quick-options]");
    if (!root) return;

    if (root.dataset.materialType === materialType) {
        dashboardQuickOptionState.set(materialType, readDashboardQuickOptionValues(root));
    }

    const fields = DASHBOARD_QUICK_OPTION_CONFIGS[materialType] || [];
    root.dataset.materialType = materialType;
    if (!fields.length) {
        root.innerHTML = "";
        root.hidden = true;
        return;
    }

    const rememberedValues = dashboardQuickOptionState.get(materialType) || {};
    const fieldsHtml = fields.map((field) => {
        const label = dashboardTranslate(field.labelKey, field.label);
        const rememberedValue = rememberedValues[field.key];

        if (field.type === "select") {
            const selectedValue = field.options.some((option) => option.value === rememberedValue)
                ? rememberedValue
                : field.value;
            const options = field.options.map((option) => {
                const selected = option.value === selectedValue ? " selected" : "";
                return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(dashboardTranslate(option.labelKey, option.label))}</option>`;
            }).join("");
            return `
                <label class="dashboard-quick-option-field">
                    <span>${escapeHtml(label)}</span>
                    <select data-dashboard-quick-option="${escapeHtml(field.key)}">${options}</select>
                </label>
            `;
        }

        const parsedValue = Number.parseInt(rememberedValue, 10);
        const value = Number.isFinite(parsedValue)
            ? Math.min(field.max, Math.max(field.min, parsedValue))
            : field.value;
        return `
            <label class="dashboard-quick-option-field">
                <span>${escapeHtml(label)}</span>
                <input type="number" min="${field.min}" max="${field.max}" step="1" value="${value}" inputmode="numeric" data-dashboard-quick-option="${escapeHtml(field.key)}">
            </label>
        `;
    }).join("");

    root.hidden = false;
    root.innerHTML = `
        <div class="dashboard-quick-options-heading">
            <b aria-hidden="true">3</b>
            <span>
                <strong>${escapeHtml(dashboardTranslate("dashboard.quick.options", "Opções básicas"))}</strong>
                <small>${escapeHtml(dashboardTranslate("dashboard.quick.optionsNote", "Só o essencial para estruturar o rascunho"))}</small>
            </span>
        </div>
        <div class="dashboard-quick-options-grid dashboard-quick-options-grid--${fields.length}">
            ${fieldsHtml}
        </div>
    `;
}

function collectDashboardQuickOptions(form, materialType) {
    const fields = DASHBOARD_QUICK_OPTION_CONFIGS[materialType] || [];
    const values = {};
    const instructions = [];

    fields.forEach((field) => {
        const input = form.querySelector(`[data-dashboard-quick-option="${field.key}"]`);
        if (!input) return;

        if (field.type === "select") {
            const option = field.options.find((item) => item.value === input.value) || field.options[0];
            values[field.key] = option.value;
            instructions.push(option.instruction);
            return;
        }

        const parsedValue = Number.parseInt(input.value, 10);
        const value = Number.isFinite(parsedValue)
            ? Math.min(field.max, Math.max(field.min, parsedValue))
            : field.value;
        input.value = String(value);
        values[field.key] = value;
        instructions.push(field.instruction(value));
    });

    dashboardQuickOptionState.set(materialType, values);
    return {
        values,
        instructions,
        requestedCount: Number(values.count || 0),
        variant: String(values.format || values.layout || values.visualMode || "")
    };
}

function dashboardQuickResultModalTemplate() {
    return `
        <div class="platform-modal-backdrop dashboard-ai-result-modal" data-dashboard-ai-result-modal hidden>
            <section class="platform-modal-card ai-ready-modal-card dashboard-ai-result-card" role="dialog" aria-modal="true" aria-labelledby="dashboard-ai-result-title" aria-describedby="dashboard-ai-result-description">
                <div class="ai-ready-modal-head">
                    <span class="ai-ready-modal-icon" aria-hidden="true">✓</span>
                    <div>
                        <span class="platform-section-label">${escapeHtml(dashboardTranslate("dashboard.quick.result.tag", "Rascunho criado com IA"))}</span>
                        <h2 id="dashboard-ai-result-title">${escapeHtml(dashboardTranslate("dashboard.quick.result.title", "Sua atividade está pronta."))}</h2>
                        <p id="dashboard-ai-result-description">${escapeHtml(dashboardTranslate("dashboard.quick.result.copy", "Escolha se deseja revisar o conteúdo no editor ou abrir a apresentação agora."))}</p>
                    </div>
                </div>
                <div class="dashboard-ai-result-summary">
                    <span><small>${escapeHtml(dashboardTranslate("dashboard.quick.tool", "Ferramenta"))}</small><strong data-dashboard-ai-result-tool></strong></span>
                    <span><small>${escapeHtml(dashboardTranslate("dashboard.quick.topic", "Tópico para criação"))}</small><strong data-dashboard-ai-result-topic></strong></span>
                </div>
                <p class="ai-credits-pill dashboard-ai-result-usage" data-dashboard-ai-result-usage hidden></p>
                <div class="ai-ready-actions dashboard-ai-result-actions">
                    <button type="button" class="platform-link-button platform-link-primary" data-dashboard-ai-result-edit>
                        ${escapeHtml(dashboardTranslate("dashboard.quick.result.edit", "Revisar e editar"))}
                    </button>
                    <button type="button" class="platform-link-button platform-link-secondary" data-dashboard-ai-result-present>
                        ${escapeHtml(dashboardTranslate("dashboard.quick.result.present", "Apresentar agora"))}
                    </button>
                </div>
            </section>
        </div>
    `;
}

function ensureDashboardQuickResultModal() {
    let modal = document.querySelector("[data-dashboard-ai-result-modal]");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend", dashboardQuickResultModalTemplate());
    return document.querySelector("[data-dashboard-ai-result-modal]");
}

function openDashboardQuickResultModal(result) {
    const modal = ensureDashboardQuickResultModal();
    if (!modal) return;
    dashboardQuickAiResult = result;

    const tool = modal.querySelector("[data-dashboard-ai-result-tool]");
    const topic = modal.querySelector("[data-dashboard-ai-result-topic]");
    const usage = modal.querySelector("[data-dashboard-ai-result-usage]");
    if (tool) tool.textContent = result.label || "Atividade";
    if (topic) topic.textContent = result.topic;

    const charged = Number(result.payload?.charge?.cost || 0);
    const remaining = Number(result.payload?.credits?.remaining ?? -1);
    if (usage) {
        usage.hidden = charged <= 0;
        if (charged > 0) {
            usage.textContent = `${dashboardTranslate("dashboard.quick.result.usage", "Uso desta geração")}: ${charged} ${charged === 1 ? "crédito" : "créditos"}${remaining >= 0 ? ` • ${dashboardTranslate("dashboard.quick.result.balance", "saldo")}: ${remaining}` : ""}`;
        }
    }

    modal.hidden = false;
    document.body.classList.add("dashboard-ai-result-open");
    window.requestAnimationFrame(() => modal.querySelector("[data-dashboard-ai-result-edit]")?.focus());
}

function setDashboardQuickGenerating(form, isGenerating) {
    const topicField = form.querySelector("[data-dashboard-quick-topic]");
    const formatSelect = form.querySelector("[data-dashboard-quick-format]");
    const button = form.querySelector("[data-dashboard-quick-open]");
    const progress = form.querySelector("[data-dashboard-quick-progress]");
    form.setAttribute("aria-busy", isGenerating ? "true" : "false");
    form.dataset.generating = isGenerating ? "true" : "false";
    if (topicField) topicField.disabled = isGenerating;
    if (formatSelect) formatSelect.disabled = isGenerating;
    form.querySelectorAll("[data-dashboard-quick-option]").forEach((field) => {
        field.disabled = isGenerating;
    });
    if (button) {
        if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
        button.disabled = isGenerating;
        button.innerHTML = isGenerating
            ? `<span class="dashboard-quick-spinner dashboard-quick-spinner--button" aria-hidden="true"></span><span>${escapeHtml(dashboardTranslate("dashboard.quick.generating", "Criando sua atividade..."))}</span>`
            : button.dataset.idleHtml;
    }
    if (progress) progress.hidden = !isGenerating;
}

async function requestDashboardQuickMaterial(materialType, topic, label, generationOptions) {
    if (typeof window.educariaAiEndpoint !== "function") {
        throw new Error(dashboardTranslate("dashboard.quick.generationError", "Não foi possível conectar ao serviço de IA. Tente novamente."));
    }

    const formData = new FormData();
    formData.append("materialType", materialType);
    formData.append("sourceText", topic);
    formData.append("text", topic);
    const optionInstructions = generationOptions?.instructions?.join(" ") || "";
    formData.append("action", `Crie um rascunho pedagógico de ${label || "atividade"}, claro e pronto para o professor revisar e apresentar. ${optionInstructions}`.trim());

    const response = await fetch(window.educariaAiEndpoint(), {
        method: "POST",
        headers: typeof window.educariaAiAuthHeaders === "function" ? await window.educariaAiAuthHeaders() : {},
        body: formData
    });
    const payload = await response.json().catch(() => ({}));

    if (payload?.credits) {
        document.dispatchEvent(new CustomEvent("educaria-ai-credits-updated", {
            detail: { credits: payload.credits }
        }));
    }
    if (!response.ok) {
        const error = new Error(payload?.error || dashboardTranslate("dashboard.quick.generationError", "Não foi possível criar a atividade agora. Tente novamente."));
        error.status = response.status;
        throw error;
    }
    if (!payload?.material) {
        throw new Error(dashboardTranslate("dashboard.quick.generationError", "Não foi possível criar a atividade agora. Tente novamente."));
    }
    if (materialType === "slides") {
        payload.material.visual_mode = generationOptions?.values?.visualMode === "ai" ? "ai" : "standard";
    }
    return payload;
}

function dashboardQuickGenerationError(error) {
    if (!navigator.onLine) {
        return dashboardTranslate("dashboard.quick.offlineError", "Você está sem conexão. Reconecte-se e tente novamente.");
    }
    if (Number(error?.status || 0) === 401) {
        return dashboardTranslate("dashboard.quick.sessionError", "Sua sessão expirou. Entre novamente para usar a IA.");
    }
    if ([400, 403, 429].includes(Number(error?.status || 0)) && error?.message) {
        return error.message;
    }
    return dashboardTranslate("dashboard.quick.generationError", "Não foi possível criar a atividade agora. Tente novamente.");
}

function continueDashboardQuickResult(destination) {
    const result = dashboardQuickAiResult;
    if (!result) return;

    try {
        sessionStorage.setItem(DASHBOARD_QUICK_AI_RESULT_KEY, JSON.stringify({
            topic: result.topic,
            target: result.target,
            materialType: result.materialType,
            className: result.className,
            material: result.payload.material,
            createdAt: Date.now()
        }));
    } catch (error) {
        window.alert(dashboardTranslate("dashboard.quick.storageError", "Não foi possível abrir a atividade agora. Atualize a página e tente novamente."));
        return;
    }

    if (typeof educariaTrack === "function") {
        educariaTrack("quick_ai_result_opened", {
            materialType: result.materialType,
            destination,
            className: result.className
        });
    }
    if (typeof window.educariaMarkMilestone === "function") {
        window.educariaMarkMilestone("activation_builder_opened", {
            source: "dashboard_quick_create",
            className: result.className,
            target: result.target,
            materialType: result.materialType,
            destination
        });
    }

    const separator = result.target.includes("?") ? "&" : "?";
    window.location.href = `${result.target}${separator}quickApply=1&quickDestination=${destination}`;
}

function bindDashboardQuickResultModal() {
    document.addEventListener("click", (event) => {
        if (event.target.closest("[data-dashboard-ai-result-edit]")) {
            continueDashboardQuickResult("edit");
            return;
        }
        if (event.target.closest("[data-dashboard-ai-result-present]")) {
            continueDashboardQuickResult("present");
            return;
        }
    });
}

function bindQuickCreateForm() {
    const form = document.querySelector("[data-dashboard-quick-form]");
    if (!form) return;
    const topicField = form.querySelector("[data-dashboard-quick-topic]");
    const formatSelect = form.querySelector("[data-dashboard-quick-format]");

    topicField?.addEventListener("input", () => {
        topicField.setCustomValidity("");
        const feedback = form.querySelector("[data-dashboard-quick-feedback]");
        if (feedback) feedback.hidden = true;
    });

    formatSelect?.addEventListener("change", () => {
        rememberDashboardQuickOptions();
        renderDashboardQuickOptions(formatSelect.selectedOptions?.[0]?.dataset.materialType || "");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const feedback = form.querySelector("[data-dashboard-quick-feedback]");
        const topic = topicField?.value.trim() || "";
        const target = formatSelect?.value || "";
        const materialType = formatSelect?.selectedOptions?.[0]?.dataset.materialType || "";
        const className = typeof readSelectedClass === "function" ? readSelectedClass() : "";

        if (feedback) feedback.hidden = true;
        topicField?.setCustomValidity("");
        if (topic.length < 3) {
            topicField?.setCustomValidity(dashboardTranslate("dashboard.quick.topicRequired", "Digite um tópico para a IA criar a atividade."));
            topicField?.reportValidity();
            topicField?.focus();
            return;
        }
        if (!target || !materialType) return;
        const generationOptions = collectDashboardQuickOptions(form, materialType);

        if (typeof educariaTrack === "function") {
            educariaTrack("quick_ai_generation_started", {
                className,
                scope: className ? "class" : "library",
                target,
                materialType,
                sourceChars: topic.length,
                requestedCount: generationOptions.requestedCount,
                generationVariant: generationOptions.variant
            });
        }

        setDashboardQuickGenerating(form, true);
        try {
            if (typeof window.ensureEducariaAiCreditsAvailable === "function") {
                const hasCredits = await window.ensureEducariaAiCreditsAvailable({ materialType });
                if (!hasCredits) return;
            }

            const label = formatSelect?.selectedOptions?.[0]?.textContent?.trim() || "Atividade";
            const payload = await requestDashboardQuickMaterial(materialType, topic, label, generationOptions);
            if (typeof educariaTrack === "function") {
                educariaTrack("quick_ai_generation_succeeded", {
                    className,
                    materialType,
                    sourceChars: topic.length,
                    requestedCount: generationOptions.requestedCount,
                    generationVariant: generationOptions.variant,
                    creditsCharged: Number(payload?.charge?.cost || 0)
                });
            }
            openDashboardQuickResultModal({ topic, target, materialType, className, label, payload, generationOptions });
        } catch (error) {
            if (feedback) {
                feedback.textContent = dashboardQuickGenerationError(error);
                feedback.hidden = false;
            }
            if (typeof educariaTrack === "function") {
                educariaTrack("quick_ai_generation_failed", {
                    className,
                    materialType,
                    sourceChars: topic.length,
                    requestedCount: generationOptions.requestedCount,
                    generationVariant: generationOptions.variant,
                    status: Number(error?.status || 0)
                });
            }
        } finally {
            setDashboardQuickGenerating(form, false);
        }
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

function refreshTeacherDashboard() {
    syncDashboardFormatHierarchy();
    hydrateTeacherDashboard();
    hydrateDashboardGreeting();
    hydrateQuickCreateForm();
    if (typeof window.educariaEvaluateActivationMilestones === "function") {
        window.educariaEvaluateActivationMilestones("dashboard_refresh", {
            markCompletion: false
        });
    }
    setDashboardReadyState(true);
}

async function syncAndRefreshTeacherDashboard() {
    refreshTeacherDashboard();

    if (typeof syncClassesWithFirebase !== "function") return;

    try {
        await syncClassesWithFirebase();
    } catch (error) {
        console.warn("EducarIA dashboard class sync unavailable:", error);
    }

    refreshTeacherDashboard();
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
            title: "Comece criando sua primeira turma",
            description: "Dê um nome à turma e escolha a matéria. Assim, as atividades que você criar já ficam organizadas para cada grupo."
        },
        {
            selector: '[data-dashboard-tour-anchor="quick-create"]',
            title: "Crie a primeira atividade",
            description: "Digite o tema, escolha a ferramenta e aguarde no painel. Quando o rascunho ficar pronto, escolha entre editar ou apresentar."
        },
        {
            selector: '[data-dashboard-tour-anchor="toolkit"]',
            title: "Escolha o formato da atividade",
            description: "Aqui ficam os formatos principais. Os extras continuam disponíveis logo abaixo para variar a dinâmica da aula."
        },
        {
            selector: '[data-dashboard-tour-anchor="library"]',
            title: "Guarde seu próprio acervo",
            description: "A biblioteca concentra os materiais que você salvou nos builders, para revisar, editar e reutilizar depois."
        }
    ];
}

function dashboardProgressSnapshot() {
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    const lessons = typeof readLessonsLibrary === "function" ? readLessonsLibrary() : [];
    return {
        classesCount: classes.length,
        lessonsCount: lessons.length
    };
}

function shouldAutoStartDashboardTour() {
    if (hasSeenDashboardTour()) return false;
    const snapshot = dashboardProgressSnapshot();
    return snapshot.classesCount === 0 || snapshot.lessonsCount === 0;
}

function trackDashboardTourEvent(name, metadata = {}) {
    if (typeof educariaTrack !== "function") return;
    educariaTrack(name, metadata);
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
        entrypoint: "manual",
        startedAt: 0,
        lastFocusedElement: null,
        rafId: 0,
        repositionHandler: null,
        keyHandler: null
    };

    dashboardTourState.closeButtons.forEach((button) => {
        button.addEventListener("click", () => closeDashboardTour(true, "skipped"));
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
            closeDashboardTour(true, "completed");
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
        closeDashboardTour(true, "target_missing");
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
        closeDashboardTour(true, "target_missing");
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
            closeDashboardTour(true, "dismissed");
        } else if (event.key === "Tab") {
            const focusable = [...dashboardTourState.card.querySelectorAll(DASHBOARD_TOUR_FOCUSABLE_SELECTOR)]
                .filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        } else if (event.key === "ArrowLeft" && dashboardTourState.index > 0) {
            dashboardTourState.index -= 1;
            renderDashboardTourStep(false);
        } else if (event.key === "ArrowRight") {
            const isLastStep = dashboardTourState.index >= dashboardTourState.steps.length - 1;
            if (isLastStep) {
                closeDashboardTour(true, "completed");
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

function closeDashboardTour(markSeen, reason = "dismissed") {
    if (!dashboardTourState) return;

    const completed = reason === "completed";
    const stepsSeen = Math.max(1, dashboardTourState.index + 1);
    const durationMs = dashboardTourState.startedAt ? Math.max(0, Date.now() - dashboardTourState.startedAt) : 0;

    if (markSeen) {
        markDashboardTourSeen();
    }
    if (completed && typeof window.educariaMarkMilestone === "function") {
        window.educariaMarkMilestone("onboarding_tour_completed", {
            entrypoint: dashboardTourState.entrypoint || "unknown",
            stepsSeen,
            durationMs
        });
    }
    trackDashboardTourEvent("dashboard_tour_closed", {
        reason,
        completed,
        entrypoint: dashboardTourState.entrypoint || "unknown",
        stepsSeen,
        durationMs
    });

    dashboardTourState.root.hidden = true;
    dashboardTourState.highlight.removeAttribute("style");
    dashboardTourState.card.style.removeProperty("left");
    dashboardTourState.card.style.removeProperty("top");
    setDashboardTourSidebarPanel(dashboardTourState.previousPanel || "");
    detachDashboardTourListeners();
    dashboardTourState.lastFocusedElement?.focus?.();
}

function startDashboardTour(force, entrypoint = "manual") {
    if (!force && hasSeenDashboardTour()) return;

    const snapshot = dashboardProgressSnapshot();
    const state = buildDashboardTour();
    state.index = 0;
    state.previousPanel = currentDashboardSidebarPanel();
    state.entrypoint = entrypoint;
    state.startedAt = Date.now();
    state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.root.hidden = false;
    if (!force) {
        markDashboardTourSeen();
    }
    if (typeof window.educariaMarkMilestone === "function") {
        window.educariaMarkMilestone("onboarding_tour_started", {
            entrypoint,
            classesCount: snapshot.classesCount,
            lessonsCount: snapshot.lessonsCount
        });
    }
    trackDashboardTourEvent("dashboard_tour_started", {
        entrypoint,
        force,
        classesCount: snapshot.classesCount,
        lessonsCount: snapshot.lessonsCount
    });
    attachDashboardTourListeners();
    renderDashboardTourStep(true);
    window.setTimeout(() => {
        state.next?.focus?.();
    }, 40);
}

function bindDashboardTourTrigger() {
    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-dashboard-tour-start]");
        if (!trigger) return;

        event.preventDefault();
        startDashboardTour(true, "manual");
    });
}

document.addEventListener("DOMContentLoaded", () => {
    refreshTeacherDashboard();
    bindTeacherDashboardClassLinks();
    bindQuickCreateForm();
    bindDashboardQuickResultModal();
    bindQuickCreateRefresh();
    bindDashboardTourTrigger();
    syncAndRefreshTeacherDashboard();

    window.setTimeout(() => {
        if (!shouldAutoStartDashboardTour()) return;
        startDashboardTour(false, "auto");
    }, 480);
});

document.addEventListener("educaria-auth-changed", () => {
    syncAndRefreshTeacherDashboard();
});

document.addEventListener("educaria-classes-updated", () => {
    refreshTeacherDashboard();
});

document.addEventListener("educaria-language-changed", () => {
    refreshTeacherDashboard();
});

window.addEventListener("pageshow", () => {
    syncAndRefreshTeacherDashboard();
});

