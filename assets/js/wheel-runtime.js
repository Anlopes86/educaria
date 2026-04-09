const WHEEL_DRAFT_KEY = "educaria:builder:wheel";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readWheelDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(WHEEL_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA wheel unavailable:", error);
        return null;
    }
}

function parseWheelSegments(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");

    return [...doc.querySelectorAll("[data-wheel-segment]")].map((segment, index) => ({
        index,
        text: segment.querySelector("[data-wheel-text]")?.value?.trim() || `Espaco ${index + 1}`,
        color: segment.querySelector("[data-wheel-color]")?.value || "#22c55e"
    }));
}

function escapeWheelText(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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

    return lines.slice(0, maxLines).map((line, index, allLines) => {
        if (index === allLines.length - 1 && lines.length > maxLines) {
            return `${line.slice(0, Math.max(0, maxCharsPerLine - 3))}...`;
        }
        return line;
    });
}

function buildWheelDiscSvg(segments) {
    const size = 560;
    const cx = 280;
    const cy = 280;
    const radius = 228;
    const slice = (Math.PI * 2) / segments.length;

    const polar = (angle) => ({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
    });

    const paths = segments.map((segment, index) => {
        const startAngle = -Math.PI / 2 + index * slice;
        const endAngle = startAngle + slice;
        const start = polar(startAngle);
        const end = polar(endAngle);
        const largeArc = slice > Math.PI ? 1 : 0;

        return `
            <path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z" fill="${segment.color}" stroke="#ffffff" stroke-width="4"></path>
        `;
    }).join("");

    return `
        <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Roleta da atividade">
            <circle cx="${cx}" cy="${cy}" r="${radius + 10}" fill="#ffffff"></circle>
            ${paths}
            <circle cx="${cx}" cy="${cy}" r="58" fill="#0f172a"></circle>
            <circle cx="${cx}" cy="${cy}" r="20" fill="#ffffff"></circle>
        </svg>
    `;
}

function buildWheelLabels(segments) {
    const slice = (Math.PI * 2) / segments.length;
    const labelRadius = segments.length >= 10 ? 35 : segments.length >= 7 ? 33 : 31;
    const maxChars = segments.length >= 10 ? 8 : segments.length >= 7 ? 10 : 13;
    const fontClass = segments.length >= 10 ? "is-compact" : segments.length >= 7 ? "is-regular" : "is-wide";

    return segments.map((segment, index) => {
        const midAngle = -Math.PI / 2 + index * slice + slice / 2;
        const x = 50 + Math.cos(midAngle) * labelRadius;
        const y = 50 + Math.sin(midAngle) * labelRadius;
        const lines = wrapWheelLabel(segment.text, maxChars, 4);

        return `
            <div class="wheel-stage-label ${fontClass}" style="left:${x}%;top:${y}%;">
                ${lines.map((line) => `<span>${escapeWheelText(line)}</span>`).join("")}
            </div>
        `;
    }).join("");
}

function renderWheelApplication() {
    const draft = readWheelDraft();
    const controls = draft?.controls || {};
    const segments = parseWheelSegments(draft?.stackHtml || "");
    const safeSegments = segments.length ? segments : [
        { text: "Revisar conceito", color: "#22c55e" },
        { text: "Responder pergunta", color: "#0ea5e9" },
        { text: "Fazer desafio", color: "#f59e0b" },
        { text: "Compartilhar exemplo", color: "#ec4899" }
    ];

    const resultRoot = document.querySelector("[data-wheel-stage-result]");
    const svgRoot = document.querySelector("[data-wheel-stage-svg]");
    const spinButtons = document.querySelectorAll("[data-wheel-spin]");
    const shouldEliminateWinner = (controls["roleta-eliminacao"] || "Nao") === "Sim";

    let isSpinning = false;
    let currentRotation = 0;
    let activeSegments = [...safeSegments];
    let pendingRemovalIndex = -1;

    const normalizedRotation = () => ((currentRotation % 360) + 360) % 360;

    const applyRotation = (rotation, transition) => {
        const disc = svgRoot?.querySelector("[data-wheel-stage-disc]");
        const labels = svgRoot?.querySelector("[data-wheel-stage-labels]");
        const labelItems = svgRoot ? [...svgRoot.querySelectorAll(".wheel-stage-label")] : [];

        if (disc) {
            disc.style.transition = transition;
            disc.style.transform = `rotate(${rotation}deg)`;
        }

        if (labels) {
            labels.style.transition = transition;
            labels.style.transform = `rotate(${rotation}deg)`;
        }

        labelItems.forEach((item) => {
            item.style.transition = transition;
            item.style.transform = `translate(-50%, -50%) rotate(${-rotation}deg)`;
        });
    };

    const renderDisc = () => {
        if (!svgRoot || !activeSegments.length) return;
        svgRoot.innerHTML = `
            <div class="wheel-stage-disc" data-wheel-stage-disc>${buildWheelDiscSvg(activeSegments)}</div>
            <div class="wheel-stage-labels" data-wheel-stage-labels>${buildWheelLabels(activeSegments)}</div>
        `;
        applyRotation(normalizedRotation(), "none");
    };

    const updateButtonsAvailability = (disabled) => {
        spinButtons.forEach((button) => {
            button.disabled = disabled;
        });
    };

    renderDisc();

    const spin = () => {
        if (isSpinning || !activeSegments.length) return;

        if (shouldEliminateWinner && pendingRemovalIndex >= 0) {
            activeSegments.splice(pendingRemovalIndex, 1);
            pendingRemovalIndex = -1;

            if (!activeSegments.length) {
                if (resultRoot) {
                    resultRoot.textContent = "Todos os espacos foram sorteados";
                }
                updateButtonsAvailability(true);
                return;
            }

            renderDisc();
        }

        isSpinning = true;
        updateButtonsAvailability(true);

        const winnerIndex = Math.floor(Math.random() * activeSegments.length);
        const winner = activeSegments[winnerIndex];
        const segmentAngle = 360 / activeSegments.length;
        const targetCenter = winnerIndex * segmentAngle + segmentAngle / 2;
        const targetRotation = 360 - targetCenter;
        const extraTurns = 7 * 360;
        const normalizedCurrent = normalizedRotation();
        const delta = (targetRotation - normalizedCurrent + 360) % 360;
        currentRotation += extraTurns + delta;

        applyRotation(normalizedCurrent, "none");
        void svgRoot.offsetWidth;
        applyRotation(currentRotation, "transform 4.8s cubic-bezier(0.08, 0.82, 0.18, 1)");

        if (resultRoot) {
            resultRoot.textContent = "Girando...";
        }

        window.setTimeout(() => {
            if (resultRoot) {
                resultRoot.textContent = winner.text;
            }

            if (shouldEliminateWinner) {
                pendingRemovalIndex = winnerIndex;
            }

            isSpinning = false;

            updateButtonsAvailability(false);
        }, 4800);
    };

    spinButtons.forEach((button) => {
        button.addEventListener("click", spin);
    });

    document.addEventListener("keydown", (event) => {
        if (event.code !== "Space") return;
        event.preventDefault();
        spin();
    });
}

document.addEventListener("DOMContentLoaded", renderWheelApplication);
