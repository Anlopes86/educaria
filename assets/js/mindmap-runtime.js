const MINDMAP_DRAFT_KEY = "educaria:builder:mindmap";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readMindmapDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(MINDMAP_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA mindmap unavailable:", error);
        return null;
    }
}

function writeMindmapDraft(state) {
    try {
        localStorage.setItem(scopedStorageKey(MINDMAP_DRAFT_KEY), JSON.stringify(state));
    } catch (error) {
        console.warn("EducarIA mindmap save unavailable:", error);
    }
}

function parseMindBranches(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-mind-branch]")].map((branch, index) => ({
        index,
        title: branch.querySelector("[data-mind-title]")?.value?.trim() || `Tópico ${index + 1}`,
        subtitle: branch.querySelector("[data-mind-subtitle]")?.value?.trim() || "Ideia-chave deste tópico",
        detail: branch.querySelector("[data-mind-detail]")?.value?.trim() || "Explique aqui o ponto principal deste tópico.",
        color: branch.querySelector("[data-mind-color]")?.value || "#22c55e"
    }));
}

function escapeMindText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function escapeMindAttr(value) {
    return escapeMindText(value).replaceAll('"', "&quot;");
}

function serializeMindBranches(branches) {
    return branches.map((branch, index) => `
        <section class="platform-question-card activity-content-card mind-branch-card" data-mind-branch>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-mind-label>Ramo ${index + 1}</span>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Título</label>
                    <input data-mind-title type="text" value="${escapeMindAttr(branch.title)}">
                </div>
                <div class="platform-field">
                    <label>Subtítulo</label>
                    <input data-mind-subtitle type="text" value="${escapeMindAttr(branch.subtitle)}">
                </div>
                <div class="platform-field">
                    <label>Cor</label>
                    <input data-mind-color type="color" value="${escapeMindAttr(branch.color || "#22c55e")}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Detalhe</label>
                    <textarea data-mind-detail rows="4">${escapeMindText(branch.detail)}</textarea>
                </div>
            </div>
        </section>
    `).join("");
}

function formatMindInlineHtml(text) {
    const escaped = escapeMindText(text);
    return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function formatMindDetailHtml(text) {
    const lines = String(text || "").split(/\r?\n/);
    const blocks = [];
    let paragraph = [];
    let bullets = [];

    const flushParagraph = () => {
        if (!paragraph.length) return;
        if (paragraph.length > 1) {
            blocks.push(`<ul>${paragraph.map((line) => `<li>${formatMindInlineHtml(line)}</li>`).join("")}</ul>`);
        } else {
            const line = paragraph[0];
            const sentenceParts = line
                .split(/\s*[;•]\s*|(?<=\.)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/)
                .map((item) => item.trim())
                .filter(Boolean);

            if (sentenceParts.length > 1) {
                blocks.push(`<ul>${sentenceParts.map((item) => `<li>${formatMindInlineHtml(item)}</li>`).join("")}</ul>`);
            } else {
                blocks.push(`<p>${formatMindInlineHtml(line)}</p>`);
            }
        }
        paragraph = [];
    };

    const flushBullets = () => {
        if (!bullets.length) return;
        blocks.push(`<ul>${bullets.map((line) => `<li>${formatMindInlineHtml(line)}</li>`).join("")}</ul>`);
        bullets = [];
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            flushParagraph();
            flushBullets();
            return;
        }

        if (/^[-*•]\s+/.test(line)) {
            flushParagraph();
            bullets.push(line.replace(/^[-*•]\s+/, ""));
            return;
        }

        flushBullets();
        paragraph.push(line);
    });

    flushParagraph();
    flushBullets();

    return blocks.join("") || `<p>${formatMindInlineHtml(text)}</p>`;
}

function renderMindmapApplication() {
    const draft = readMindmapDraft() || {};
    const controls = { ...(draft.controls || {}) };
    const branches = parseMindBranches(draft.stackHtml || "");
    const safeBranches = (branches.length ? branches : [
        { title: "Conceito central", subtitle: "Núcleo do tema", detail: "Explique a ideia principal que organiza o restante do mapa.", color: "#22c55e" },
        { title: "Exemplos", subtitle: "Casos concretos", detail: "Mostre exemplos concretos para aproximar o tema da turma.", color: "#0ea5e9" },
        { title: "Aplicações", subtitle: "Uso na prática", detail: "Indique onde esse conhecimento aparece na prática.", color: "#f59e0b" },
        { title: "Revisão", subtitle: "Fechamento", detail: "Recupere perguntas-chave para fechar a explicação.", color: "#ec4899" }
    ]).map((branch, index) => ({ ...branch, index }));

    controls["mapa-centro"] = controls["mapa-centro"] || "Tema da aula";
    controls["mapa-subtitulo"] = controls["mapa-subtitulo"] || "Panorama dos conceitos principais";
    controls["mapa-layout"] = controls["mapa-layout"] || "Radial";

    const state = {
        ...draft,
        controls,
        branches: safeBranches,
        stackHtml: serializeMindBranches(safeBranches)
    };

    const titleRoot = document.querySelector("[data-mind-stage-title]");
    const subtitleRoot = document.querySelector("[data-mind-stage-subtitle]");
    const countRoot = document.querySelector("[data-mind-stage-count]");
    const mapRoot = document.querySelector("[data-mind-stage-map]");
    const detailRoot = document.querySelector(".mind-stage-detail");
    const detailTitleRoot = document.querySelector("[data-mind-stage-detail-title]");
    const detailSubtitleRoot = document.querySelector("[data-mind-stage-detail-subtitle]");
    const detailTextRoot = document.querySelector("[data-mind-stage-detail-text]");

    let activeIndex = 0;
    let saveTimer = 0;
    let inlineEdit = null;

    if (titleRoot) titleRoot.dataset.inlineEditable = "control:mapa-centro";
    if (subtitleRoot) subtitleRoot.dataset.inlineEditable = "control:mapa-subtitulo";
    if (detailTitleRoot) detailTitleRoot.dataset.inlineEditable = "branch:title";
    if (detailSubtitleRoot) detailSubtitleRoot.dataset.inlineEditable = "branch:subtitle";
    if (detailTextRoot) {
        detailTextRoot.dataset.inlineEditable = "branch:detail";
        detailTextRoot.dataset.inlineEditableMultiline = "true";
    }

    const persistState = () => {
        state.branches = state.branches.map((branch, index) => ({ ...branch, index }));
        state.stackHtml = serializeMindBranches(state.branches);
        writeMindmapDraft(state);
    };

    const scheduleSave = () => {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(persistState, 140);
    };

    const renderStatic = () => {
        if (titleRoot) titleRoot.textContent = state.controls["mapa-centro"];
        if (subtitleRoot) subtitleRoot.textContent = state.controls["mapa-subtitulo"];
        if (countRoot) countRoot.textContent = `${state.branches.length} tópicos`;
    };

    const renderDetail = () => {
        const branch = state.branches[activeIndex];
        if (!branch) return;
        if (detailRoot) detailRoot.style.setProperty("--mind-accent", branch.color || "#22c55e");
        if (detailTitleRoot) detailTitleRoot.textContent = branch.title;
        if (detailSubtitleRoot) detailSubtitleRoot.textContent = branch.subtitle;
        if (detailTextRoot) {
            if (inlineEdit?.enabled) {
                detailTextRoot.textContent = branch.detail;
            } else {
                detailTextRoot.innerHTML = formatMindDetailHtml(branch.detail);
            }
        }
        inlineEdit?.syncUi();
    };

    const renderMap = () => {
        if (!mapRoot) return;
        const normalizedLayout = String(state.controls["mapa-layout"]).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const isTopics = normalizedLayout.includes("topicos");
        mapRoot.classList.toggle("is-topics", isTopics);
        mapRoot.classList.toggle("is-radial", !isTopics);
        mapRoot.innerHTML = `
            ${state.branches.map((branch, index) => `
                <button type="button" class="mind-stage-branch mind-stage-branch--${isTopics ? "topics" : "radial"}${index === activeIndex ? " is-active" : ""}" data-mind-stage-branch="${index}" style="--mind-accent:${branch.color};">
                    <strong data-inline-editable="branch-index:${index}:title">${escapeMindText(branch.title)}</strong>
                    <em data-inline-editable="branch-index:${index}:subtitle">${escapeMindText(branch.subtitle)}</em>
                </button>
            `).join("")}
        `;
        inlineEdit?.syncUi();
    };

    if (typeof createPresentationInlineEditController === "function") {
        inlineEdit = createPresentationInlineEditController({
            onInput(node) {
                const binding = String(node.dataset.inlineEditable || "");
                const nextValue = readInlineEditableValue(node, node.dataset.inlineEditableMultiline === "true");

                if (binding.startsWith("control:")) {
                    const key = binding.slice("control:".length);
                    if (state.controls[key] === nextValue) return;
                    state.controls[key] = nextValue;
                    scheduleSave();
                    return;
                }

                if (binding === "branch:title" || binding === "branch:subtitle" || binding === "branch:detail") {
                    const field = binding.replace("branch:", "");
                    const branch = state.branches[activeIndex];
                    if (!branch || branch[field] === nextValue) return;
                    branch[field] = nextValue;
                    scheduleSave();
                    return;
                }

                const indexedMatch = binding.match(/^branch-index:(\d+):(title|subtitle)$/);
                if (!indexedMatch) return;

                const branch = state.branches[Number(indexedMatch[1])];
                const field = indexedMatch[2];
                if (!branch || branch[field] === nextValue) return;
                branch[field] = nextValue;
                scheduleSave();
            },
            onCommit() {
                renderStatic();
                renderMap();
                renderDetail();
            }
        });
    }

    renderStatic();
    renderMap();
    renderDetail();
    persistState();

    document.addEventListener("click", (event) => {
        if (inlineEdit?.enabled && event.target.closest("[data-inline-editable]")) {
            event.stopPropagation();
            return;
        }

        const branchButton = event.target.closest("[data-mind-stage-branch]");
        if (!branchButton) return;

        activeIndex = Number(branchButton.dataset.mindStageBranch || 0);
        renderMap();
        renderDetail();
    });
}

document.addEventListener("DOMContentLoaded", renderMindmapApplication);
