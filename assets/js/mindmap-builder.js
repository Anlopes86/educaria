function parseMindBranchCount() {
    const field = document.getElementById("mapa-ramos");
    if (!field) return 4;
    const match = field.value.match(/\d+/);
    return match ? Number(match[0]) : 4;
}

function escapeMindAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

const mindPalette = ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1"];

function mindBranchTemplate(index, title = "", subtitle = "", detail = "", color = "#22c55e") {
    return `
        <section class="platform-question-card activity-content-card mind-branch-card" data-mind-branch>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-mind-label>Topico ${index + 1}</span>
                    <h3>Conteudo do topico</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-mind-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field">
                    <label>Titulo do topico</label>
                    <input data-mind-title type="text" value="${escapeMindAttr(title)}">
                </div>
                <div class="platform-field">
                    <label>Subtitulo do topico</label>
                    <input data-mind-subtitle type="text" value="${escapeMindAttr(subtitle)}">
                </div>
                <div class="platform-field">
                    <label>Cor</label>
                    <input data-mind-color type="color" value="${color}">
                </div>
                <div class="platform-field platform-field-wide">
                    <label>Explicacao do topico</label>
                    <textarea data-mind-detail rows="4" placeholder="Paragrafo inicial&#10;&#10;- Topico 1&#10;- Topico 2">${escapeMindAttr(detail)}</textarea>
                </div>
            </div>
        </section>
    `;
}

function collectMindBranches() {
    return [...document.querySelectorAll("[data-mind-branch]")].map((branch, index) => ({
        index,
        title: branch.querySelector("[data-mind-title]")?.value.trim() || `Topico ${index + 1}`,
        subtitle: branch.querySelector("[data-mind-subtitle]")?.value.trim() || "Ideia-chave deste topico",
        detail: branch.querySelector("[data-mind-detail]")?.value.trim() || "Explique aqui o ponto principal deste topico.",
        color: branch.querySelector("[data-mind-color]")?.value || mindPalette[index % mindPalette.length]
    }));
}

function setMindCountSelect(count) {
    const quantity = document.getElementById("mapa-ramos");
    if (!quantity) return;

    const options = [...quantity.options];
    const exact = options.find((option) => {
        const match = option.text.match(/\d+/);
        return match && Number(match[0]) === count;
    });

    if (exact) {
        quantity.value = exact.value;
        return;
    }

    const highest = options[options.length - 1];
    if (highest) {
        highest.textContent = `${count} topicos`;
        highest.value = highest.textContent;
        quantity.value = highest.value;
    }
}

function syncMindBranchCount() {
    const stack = document.querySelector("[data-mind-branches]");
    if (!stack) return;

    const desired = parseMindBranchCount();
    const current = [...stack.querySelectorAll("[data-mind-branch]")];

    if (current.length < desired) {
        for (let i = current.length; i < desired; i += 1) {
            stack.insertAdjacentHTML("beforeend", mindBranchTemplate(i, "", "", "", mindPalette[i % mindPalette.length]));
        }
    }

    if (current.length > desired) {
        [...stack.querySelectorAll("[data-mind-branch]")].slice(desired).forEach((node) => node.remove());
    }

    [...stack.querySelectorAll("[data-mind-label]")].forEach((label, index) => {
        label.textContent = `Topico ${index + 1}`;
    });
}

function addMindBranch() {
    const stack = document.querySelector("[data-mind-branches]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-mind-branch]").length;
    stack.insertAdjacentHTML("beforeend", mindBranchTemplate(count, "", "", "", mindPalette[count % mindPalette.length]));
    setMindCountSelect(count + 1);
    renderMindPreview();
    document.dispatchEvent(new Event("input"));
}

function removeMindBranch(trigger) {
    const branches = [...document.querySelectorAll("[data-mind-branch]")];
    if (branches.length <= 2) return;

    const branch = trigger.closest("[data-mind-branch]");
    if (!branch) return;

    branch.remove();
    setMindCountSelect(branches.length - 1);
    renderMindPreview();
    document.dispatchEvent(new Event("input"));
}

function renderMindPreview() {
    syncMindBranchCount();

    const center = document.getElementById("mapa-centro")?.value.trim() || "Tema da aula";
    const subtitle = document.getElementById("mapa-subtitulo")?.value.trim() || "Panorama dos conceitos principais";
    const layout = document.getElementById("mapa-layout")?.value || "Radial";
    const branches = collectMindBranches();
    const titleRoot = document.querySelector("[data-mind-preview-title]");
    const subtitleRoot = document.querySelector("[data-mind-preview-subtitle]");
    const countRoot = document.querySelector("[data-mind-preview-count]");
    const mapRoot = document.querySelector("[data-mind-preview-map]");
    const listRoot = document.querySelector("[data-mind-preview-list]");

    if (titleRoot) titleRoot.textContent = center;
    if (subtitleRoot) subtitleRoot.textContent = subtitle;
    if (countRoot) countRoot.textContent = `${branches.length} topicos`;

    if (mapRoot) {
        mapRoot.classList.toggle("is-topics", layout === "Topicos");
        mapRoot.innerHTML = `
            <article class="mind-preview-center">
                <strong>${escapeMindAttr(center)}</strong>
                <span>${escapeMindAttr(subtitle)}</span>
            </article>
            ${branches.map((branch) => `
                <article class="mind-preview-branch" style="--mind-accent:${branch.color};">
                    <strong>${escapeMindAttr(branch.title)}</strong>
                    <em>${escapeMindAttr(branch.subtitle)}</em>
                    <span>${escapeMindAttr(branch.detail)}</span>
                </article>
            `).join("")}
        `;
    }

    if (listRoot) {
        listRoot.innerHTML = branches.map((branch, index) => `
            <article class="mind-preview-list-item" style="--mind-accent:${branch.color};">
                <span>${index + 1}</span>
                <div>
                    <strong>${escapeMindAttr(branch.title)}</strong>
                    <small>${escapeMindAttr(branch.subtitle)}</small>
                    <p>${escapeMindAttr(branch.detail)}</p>
                </div>
            </article>
        `).join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    syncMindBranchCount();
    renderMindPreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-mind-branch]") || ["mapa-centro", "mapa-subtitulo"].includes(event.target.id)) {
            renderMindPreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (["mapa-ramos", "mapa-layout"].includes(event.target.id)) {
            renderMindPreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-mind-add]");
        if (addButton) {
            event.preventDefault();
            addMindBranch();
            return;
        }

        const removeButton = event.target.closest("[data-mind-remove]");
        if (removeButton) {
            event.preventDefault();
            removeMindBranch(removeButton);
            return;
        }

        const presentLink = event.target.closest('a[href="mapa-mental-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("mindmap");
        }
    });
});
