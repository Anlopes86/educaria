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

function normalizeMindLayout(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function mindRadialPosition(index, total) {
    const count = Math.max(1, total);
    let angle = -90 + (index * 360 / count);

    if (count === 2) angle = 180 + (index * 180);
    if (count === 4) angle = -45 + (index * 90);

    const radians = angle * Math.PI / 180;
    const radiusX = count >= 7 ? 36 : count >= 5 ? 37 : 36;
    const radiusY = count >= 7 ? 40 : count >= 5 ? 38 : 35;

    return {
        x: Number((50 + Math.cos(radians) * radiusX).toFixed(2)),
        y: Number((50 + Math.sin(radians) * radiusY).toFixed(2))
    };
}

function mindConnectorPath(position) {
    const endX = position.x * 10;
    const endY = position.y * 6.2;
    const deltaX = endX - 500;
    const deltaY = endY - 310;
    const firstX = 500 + deltaX * 0.28;
    const secondX = 500 + deltaX * 0.72;

    return `M 500 310 C ${firstX.toFixed(1)} 310, ${secondX.toFixed(1)} ${(310 + deltaY).toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`;
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
    const contentRoot = document.querySelector(".mind-stage-content");
    const mapRoot = document.querySelector("[data-mind-stage-map]");
    const detailRoot = document.querySelector(".mind-stage-detail");
    const detailTitleRoot = document.querySelector("[data-mind-stage-detail-title]");
    const detailSubtitleRoot = document.querySelector("[data-mind-stage-detail-subtitle]");
    const detailTextRoot = document.querySelector("[data-mind-stage-detail-text]");
    const detailScrollButton = document.querySelector("[data-mind-stage-detail-scroll]");

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
        const isTopics = normalizeMindLayout(state.controls["mapa-layout"]).includes("topicos");
        if (titleRoot) titleRoot.textContent = state.controls["mapa-centro"];
        if (subtitleRoot) subtitleRoot.textContent = state.controls["mapa-subtitulo"];
        if (countRoot) countRoot.textContent = `${state.branches.length} tópicos · ${isTopics ? "Leitura em tópicos" : "Mapa radial"}`;
    };

    const renderDetail = () => {
        const branch = state.branches[activeIndex];
        if (!branch) return;
        if (detailRoot) detailRoot.style.setProperty("--mind-accent", branch.color || "#22c55e");
        if (detailTitleRoot) detailTitleRoot.textContent = branch.title;
        if (detailSubtitleRoot) detailSubtitleRoot.textContent = branch.subtitle;
        if (detailTextRoot) {
            detailTextRoot.scrollTop = 0;
            if (inlineEdit?.enabled) {
                detailTextRoot.textContent = branch.detail;
            } else {
                detailTextRoot.innerHTML = formatMindDetailHtml(branch.detail);
            }
        }
        inlineEdit?.syncUi();
        window.requestAnimationFrame(syncDetailOverflow);
    };

    const syncDetailOverflow = () => {
        if (!detailTextRoot || !detailScrollButton) return;
        const hasMore = detailTextRoot.scrollHeight - detailTextRoot.scrollTop > detailTextRoot.clientHeight + 3;
        detailScrollButton.hidden = !hasMore;
    };

    const renderMap = () => {
        if (!mapRoot) return;
        const normalizedLayout = normalizeMindLayout(state.controls["mapa-layout"]);
        const isTopics = normalizedLayout.includes("topicos");
        const positions = state.branches.map((branch, index) => ({
            ...mindRadialPosition(index, state.branches.length),
            color: branch.color || "#22c55e"
        }));
        mapRoot.classList.toggle("is-topics", isTopics);
        mapRoot.classList.toggle("is-radial", !isTopics);
        contentRoot?.classList.toggle("is-topics", isTopics);
        contentRoot?.classList.toggle("is-radial", !isTopics);
        mapRoot.dataset.mindLayout = isTopics ? "topics" : "radial";
        mapRoot.innerHTML = `
            <svg class="mind-stage-connectors" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
                ${positions.map((position, index) => `
                    <path class="mind-stage-connector${index === activeIndex ? " is-active" : ""}" d="${mindConnectorPath(position)}" style="--mind-accent:${escapeMindAttr(position.color)};"></path>
                    <circle cx="${position.x * 10}" cy="${position.y * 6.2}" r="7" style="--mind-accent:${escapeMindAttr(position.color)};"></circle>
                `).join("")}
            </svg>
            <article class="mind-stage-central">
                <span>Tema central</span>
                <h2 data-inline-editable="control:mapa-centro">${escapeMindText(state.controls["mapa-centro"])}</h2>
                <p data-inline-editable="control:mapa-subtitulo">${escapeMindText(state.controls["mapa-subtitulo"])}</p>
            </article>
            ${state.branches.map((branch, index) => `
                <button type="button" class="mind-stage-branch mind-stage-branch--${isTopics ? "topics" : "radial"}${index === activeIndex ? " is-active" : ""}" data-mind-stage-branch="${index}" data-mind-order="${String(index + 1).padStart(2, "0")}" aria-pressed="${index === activeIndex ? "true" : "false"}" style="--mind-accent:${escapeMindAttr(branch.color)};--mind-x:${positions[index].x}%;--mind-y:${positions[index].y}%;">
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

    detailTextRoot?.addEventListener("scroll", syncDetailOverflow, { passive: true });
    detailScrollButton?.addEventListener("click", () => {
        detailTextRoot?.scrollBy({ top: Math.max(120, detailTextRoot.clientHeight * 0.72), behavior: "smooth" });
    });
    window.addEventListener("resize", syncDetailOverflow);
}

document.addEventListener("DOMContentLoaded", renderMindmapApplication);
