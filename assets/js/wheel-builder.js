function parseWheelCount() {
    const field = document.getElementById("roleta-quantidade");
    if (!field) return 8;
    const match = field.value.match(/\d+/);
    return match ? Number(match[0]) : 8;
}

function escapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function wheelSegmentTemplate(index, text = "", color = "#22c55e") {
    return `
        <section class="platform-question-card activity-content-card wheel-segment-card" data-wheel-segment>
            <div class="activity-card-header">
                <div>
                    <span class="platform-section-label" data-wheel-label>Espaço ${index + 1}</span>
                    <h3>Conteúdo do espaço</h3>
                </div>
                <div class="activity-card-actions">
                    <button type="button" class="platform-link-button platform-link-secondary" data-wheel-remove>Remover</button>
                </div>
            </div>
            <div class="platform-form-grid">
                <div class="platform-field platform-field-wide">
                    <label>Texto do espaço</label>
                    <input data-wheel-text type="text" value="${escapeAttr(text)}">
                </div>
                <div class="platform-field">
                    <label>Cor</label>
                    <input data-wheel-color type="color" value="${color}">
                </div>
            </div>
        </section>
    `;
}

function wheelPalette() {
    return ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1", "#84cc16", "#f97316", "#06b6d4", "#a855f7"];
}

function collectWheelSegments() {
    return [...document.querySelectorAll("[data-wheel-segment]")].map((segment, index) => ({
        index,
        text: segment.querySelector("[data-wheel-text]")?.value.trim() || `Espaço ${index + 1}`,
        color: segment.querySelector("[data-wheel-color]")?.value || wheelPalette()[index % wheelPalette().length]
    }));
}

function setWheelCountSelect(count) {
    const quantity = document.getElementById("roleta-quantidade");
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
        highest.textContent = `${count} espaços`;
        highest.value = highest.textContent;
        quantity.value = highest.value;
    }
}

function syncWheelSegmentCount() {
    const stack = document.querySelector("[data-wheel-segments]");
    if (!stack) return;

    const desired = parseWheelCount();
    const current = [...stack.querySelectorAll("[data-wheel-segment]")];
    const palette = wheelPalette();

    if (current.length < desired) {
        for (let i = current.length; i < desired; i += 1) {
            stack.insertAdjacentHTML("beforeend", wheelSegmentTemplate(i, "", palette[i % palette.length]));
        }
    }

    if (current.length > desired) {
        [...stack.querySelectorAll("[data-wheel-segment]")].slice(desired).forEach((node) => node.remove());
    }

    [...stack.querySelectorAll("[data-wheel-label]")].forEach((label, index) => {
        label.textContent = `Espaço ${index + 1}`;
    });
}

function addWheelSegment() {
    const stack = document.querySelector("[data-wheel-segments]");
    if (!stack) return;

    const count = stack.querySelectorAll("[data-wheel-segment]").length;
    const palette = wheelPalette();
    stack.insertAdjacentHTML("beforeend", wheelSegmentTemplate(count, "", palette[count % palette.length]));
    setWheelCountSelect(count + 1);
    renderWheelPreview();
    document.dispatchEvent(new Event("input"));
}

function removeWheelSegment(trigger) {
    const segments = [...document.querySelectorAll("[data-wheel-segment]")];
    if (segments.length <= 2) return;

    const segment = trigger.closest("[data-wheel-segment]");
    if (!segment) return;

    segment.remove();
    setWheelCountSelect(segments.length - 1);
    renderWheelPreview();
    document.dispatchEvent(new Event("input"));
}

function polar(cx, cy, radius, angle) {
    return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
    };
}

function wrapWheelLabel(text, maxCharsPerLine = 10, maxLines = 2) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return ["Item"];

    const lines = [];
    let current = "";

    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length <= maxCharsPerLine) {
            current = candidate;
            return;
        }

        if (current) {
            lines.push(current);
            current = word;
            return;
        }

        lines.push(word.slice(0, maxCharsPerLine));
        current = word.slice(maxCharsPerLine);
    });

    if (current) lines.push(current);

    return lines.slice(0, maxLines).map((line, index, arr) => {
        if (index === arr.length - 1 && lines.length > maxLines) {
            return `${line.slice(0, Math.max(0, maxCharsPerLine - 3))}...`;
        }
        return line;
    });
}

function buildWheelSvg(segments, rotation = 0) {
    const size = 420;
    const cx = 210;
    const cy = 210;
    const radius = 170;
    const slice = (Math.PI * 2) / segments.length;
    const maxChars = segments.length >= 10 ? 8 : 10;

    const paths = segments.map((segment, index) => {
        const startAngle = -Math.PI / 2 + index * slice;
        const endAngle = startAngle + slice;
        const start = polar(cx, cy, radius, startAngle);
        const end = polar(cx, cy, radius, endAngle);
        const labelPoint = polar(cx, cy, radius * 0.57, startAngle + slice / 2);
        const largeArc = slice > Math.PI ? 1 : 0;
        const lines = wrapWheelLabel(segment.text, maxChars, 2);
        const fontSize = segments.length >= 10 ? 11 : 12;

        return `
            <path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z" fill="${segment.color}" stroke="#ffffff" stroke-width="3"></path>
            <g transform="translate(${labelPoint.x} ${labelPoint.y})">
                <text text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#0f172a">
                    ${lines.map((line, lineIndex) => {
                        const offset = lines.length === 1 ? 0 : lineIndex === 0 ? -7 : 8;
                        return `<tspan x="0" y="${offset}">${escapeAttr(line)}</tspan>`;
                    }).join("")}
                </text>
            </g>
        `;
    }).join("");

    return `
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Pré-visualização da roleta">
            <g transform="rotate(${rotation} ${cx} ${cy})">
                <circle cx="${cx}" cy="${cy}" r="${radius + 8}" fill="#ffffff"></circle>
                ${paths}
                <circle cx="${cx}" cy="${cy}" r="28" fill="#0f172a"></circle>
                <circle cx="${cx}" cy="${cy}" r="12" fill="#ffffff"></circle>
            </g>
        </svg>
    `;
}

function renderWheelPreview() {
    syncWheelSegmentCount();

    const segments = collectWheelSegments();
    const title = document.getElementById("roleta-titulo")?.value.trim() || "Roleta";
    const elimination = document.getElementById("roleta-eliminacao")?.value || "Não";
    const svgRoot = document.querySelector("[data-wheel-preview-svg]");
    const listRoot = document.querySelector("[data-wheel-preview-list]");
    const titleRoot = document.querySelector("[data-wheel-preview-title]");
    const countRoot = document.querySelector("[data-wheel-preview-count]");

    if (titleRoot) titleRoot.textContent = title;
    if (countRoot) countRoot.textContent = elimination === "Sim" ? `${segments.length} espaços - elimina` : `${segments.length} espaços`;
    if (svgRoot) svgRoot.innerHTML = buildWheelSvg(segments);
    if (listRoot) {
        listRoot.innerHTML = segments.map((segment, index) => `
            <div class="wheel-preview-item">
                <span class="wheel-preview-swatch" style="background:${segment.color};"></span>
                <strong>Espaço ${index + 1}</strong>
                <span>${segment.text}</span>
            </div>
        `).join("");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    syncWheelSegmentCount();
    renderWheelPreview();

    document.addEventListener("input", (event) => {
        if (event.target.closest("[data-wheel-segment]") || event.target.id === "roleta-titulo") {
            renderWheelPreview();
        }
    });

    document.addEventListener("change", (event) => {
        if (event.target.id === "roleta-quantidade" || event.target.id === "roleta-eliminacao") {
            renderWheelPreview();
        }
    });

    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-wheel-add]");
        if (addButton) {
            event.preventDefault();
            addWheelSegment();
            return;
        }

        const removeButton = event.target.closest("[data-wheel-remove]");
        if (removeButton) {
            event.preventDefault();
            removeWheelSegment(removeButton);
        }

        const presentLink = event.target.closest('a[href="roleta-apresentacao.html"]');
        if (presentLink && typeof forceSyncDraftFromPage === "function") {
            forceSyncDraftFromPage("wheel");
        }
    });
});
