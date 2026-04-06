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

function parseMindBranches(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-mind-branch]")].map((branch, index) => ({
        index,
        title: branch.querySelector("[data-mind-title]")?.value?.trim() || `Topico ${index + 1}`,
        subtitle: branch.querySelector("[data-mind-subtitle]")?.value?.trim() || "Ideia-chave deste topico",
        detail: branch.querySelector("[data-mind-detail]")?.value?.trim() || "Explique aqui o ponto principal deste topico.",
        color: branch.querySelector("[data-mind-color]")?.value || "#22c55e"
    }));
}

function escapeMindText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
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
    const draft = readMindmapDraft();
    const controls = draft?.controls || {};
    const branches = parseMindBranches(draft?.stackHtml || "");
    const safeBranches = branches.length ? branches : [
        { title: "Conceito central", subtitle: "Nucleo do tema", detail: "Explique a ideia principal que organiza o restante do mapa.", color: "#22c55e" },
        { title: "Exemplos", subtitle: "Casos concretos", detail: "Mostre exemplos concretos para aproximar o tema da turma.", color: "#0ea5e9" },
        { title: "Aplicacoes", subtitle: "Uso na pratica", detail: "Indique onde esse conhecimento aparece na pratica.", color: "#f59e0b" },
        { title: "Revisao", subtitle: "Fechamento", detail: "Recupere perguntas-chave para fechar a explicacao.", color: "#ec4899" }
    ];

    const center = controls["mapa-centro"] || "Tema da aula";
    const subtitle = controls["mapa-subtitulo"] || "Panorama dos conceitos principais";
    const layout = controls["mapa-layout"] || "Radial";
    const titleRoot = document.querySelector("[data-mind-stage-title]");
    const subtitleRoot = document.querySelector("[data-mind-stage-subtitle]");
    const countRoot = document.querySelector("[data-mind-stage-count]");
    const mapRoot = document.querySelector("[data-mind-stage-map]");
    const detailRoot = document.querySelector(".mind-stage-detail");
    const detailTitleRoot = document.querySelector("[data-mind-stage-detail-title]");
    const detailSubtitleRoot = document.querySelector("[data-mind-stage-detail-subtitle]");
    const detailTextRoot = document.querySelector("[data-mind-stage-detail-text]");

    let activeIndex = 0;

    if (titleRoot) titleRoot.textContent = center;
    if (subtitleRoot) subtitleRoot.textContent = subtitle;
    if (countRoot) countRoot.textContent = `${safeBranches.length} topicos`;

    const renderDetail = () => {
        const branch = safeBranches[activeIndex];
        if (!branch) return;
        if (detailRoot) detailRoot.style.setProperty("--mind-accent", branch.color || "#22c55e");
        if (detailTitleRoot) detailTitleRoot.textContent = branch.title;
        if (detailSubtitleRoot) detailSubtitleRoot.textContent = branch.subtitle;
        if (detailTextRoot) detailTextRoot.innerHTML = formatMindDetailHtml(branch.detail);
    };

    const renderMap = () => {
        if (!mapRoot) return;
        const normalizedLayout = String(layout).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const isTopics = normalizedLayout.includes("topicos");
        mapRoot.classList.toggle("is-topics", isTopics);
        mapRoot.classList.toggle("is-radial", !isTopics);
        mapRoot.innerHTML = `
            ${safeBranches.map((branch, index) => `
                <button type="button" class="mind-stage-branch mind-stage-branch--${isTopics ? "topics" : "radial"}${index === activeIndex ? " is-active" : ""}" data-mind-stage-branch="${index}" style="--mind-accent:${branch.color};">
                    <strong>${escapeMindText(branch.title)}</strong>
                    <em>${escapeMindText(branch.subtitle)}</em>
                </button>
            `).join("")}
        `;
    };

    renderMap();
    renderDetail();

    document.addEventListener("click", (event) => {
        const branchButton = event.target.closest("[data-mind-stage-branch]");
        if (!branchButton) return;

        activeIndex = Number(branchButton.dataset.mindStageBranch || 0);
        renderMap();
        renderDetail();
    });
}

document.addEventListener("DOMContentLoaded", renderMindmapApplication);
