const SLIDES_DRAFT_KEY = "educaria:builder:slides";

function scopedStorageKey(baseKey) {
    return typeof educariaScopedKey === "function" ? educariaScopedKey(baseKey) : baseKey;
}

function readSlidesDraft() {
    try {
        const raw = localStorage.getItem(scopedStorageKey(SLIDES_DRAFT_KEY));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("EducarIA presentation unavailable:", error);
        return null;
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function parseSlideCards(stackHtml) {
    if (!stackHtml) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${stackHtml}</div>`, "text/html");
    const cards = [...doc.querySelectorAll("[data-slide-card]")];

    return cards.map((card, index) => {
        const fieldValue = (name) => card.querySelector(`[data-field="${name}"]`)?.value?.trim() || "";
        const fieldLabel = (name) => {
            const field = card.querySelector(`[data-field="${name}"]`);
            if (!field || field.tagName !== "SELECT") {
                return fieldValue(name);
            }

            const selectedOption = field.querySelector("option[selected]") || field.options[field.selectedIndex];
            return selectedOption?.text?.trim() || "";
        };

        const normalizeLayout = (value, hasImage) => {
            if (hasImage) return "split";

            const text = String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            if (text.includes("lado")) return "split";
            return "stack";
        };

        const imageUrl = fieldValue("slide-image-url");
        const imagePrompt = fieldValue("slide-image-prompt");
        const hasImage = Boolean(imageUrl || imagePrompt);

        return {
            index,
            title: fieldValue("slide-title") || `Slide ${index + 1}`,
            subtitle: fieldValue("slide-subtitle"),
            body: fieldValue("slide-body") || "Sem conteudo definido.",
            layoutMode: normalizeLayout(fieldLabel("slide-layout"), hasImage),
            imageMode: fieldLabel("slide-image-mode") || "Sem imagem",
            imageUrl,
            imagePrompt,
            fontChoice: fieldLabel("slide-font") || "Destaque moderno",
            accentColor: fieldValue("slide-accent-color") || "#0ea5e9",
            slideColor: fieldValue("slide-color") || "#d7f5f6",
            textColor: fieldValue("slide-text-color") || "#0f172a"
        };
    });
}

function buildFallbackSlides() {
    return [{
        index: 0,
        title: "Has technology changed education?",
        subtitle: "Observe a transformacao da sala de aula",
        body: "Observe as imagens e pense no que mudou na sala de aula ao longo dos anos.",
        layoutMode: "stack",
        imageMode: "Sem imagem",
        imageUrl: "",
        imagePrompt: "",
        fontChoice: "Destaque moderno",
        accentColor: "#0ea5e9",
        slideColor: "#d7f5f6",
        textColor: "#0f172a"
    }];
}

function renderSlideBody(body) {
    const lines = String(body || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        return "<p>Sem conteudo definido.</p>";
    }

    const hasBullets = lines.some((line) => /^[-*•]\s+/.test(line));
    if (hasBullets) {
        return `
            <ul>
                ${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*•]\s+/, ""))}</li>`).join("")}
            </ul>
        `;
    }

    return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function renderMediaPlaceholder(slide) {
    return `
        <div class="presentation-media-placeholder">
            <span class="platform-section-label">Imagem sugerida</span>
            <strong>${escapeHtml(slide.title)}</strong>
            <p>${escapeHtml(slide.imagePrompt || "Ilustracao educativa para apoiar o slide.")}</p>
        </div>
    `;
}

function renderStructuredSlideBody(body) {
    const lines = String(body || "")
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        return "<p>Sem conteudo definido.</p>";
    }

    const bulletPattern = /^[-*•â€¢]\s+/;
    const hasBullets = lines.some((line) => bulletPattern.test(line));
    if (hasBullets) {
        return `
            <ul>
                ${lines.map((line) => renderStructuredBulletLine(line, bulletPattern)).join("")}
            </ul>
        `;
    }

    if (lines.length === 1) {
        const numberedParts = lines[0]
            .split(/(?=\d+\.\s+)/)
            .map((line) => line.replace(/^\d+\.\s*/, "").trim())
            .filter(Boolean);

        if (numberedParts.length >= 2) {
            return `
                <ul>
                    ${numberedParts.slice(0, 6).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
                </ul>
            `;
        }

        const sentenceParts = lines[0]
            .split(/(?<=[.!?;:])\s+/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (sentenceParts.length >= 3) {
            return `
                <ul>
                    ${sentenceParts.slice(0, 5).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
                </ul>
            `;
        }
    }

    return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function renderStructuredBulletLine(line, bulletPattern) {
    const clean = String(line || "").replace(bulletPattern, "").trim();
    return `<li>${escapeHtml(clean)}</li>`;
}

function clearMediaAspect(slideRoot, media) {
    delete slideRoot.dataset.mediaAspect;
    delete media.dataset.mediaAspect;
}

function applyMediaAspect(slideRoot, media, onChange) {
    const image = media.querySelector("img[src]");
    if (!image) {
        clearMediaAspect(slideRoot, media);
        onChange?.();
        return;
    }

    const setAspect = () => {
        if (!image.naturalWidth || !image.naturalHeight) {
            clearMediaAspect(slideRoot, media);
            onChange?.();
            return;
        }

        const ratio = image.naturalWidth / image.naturalHeight;
        const aspect = ratio >= 1.35 ? "landscape" : ratio <= 0.82 ? "portrait" : "square";
        slideRoot.dataset.mediaAspect = aspect;
        media.dataset.mediaAspect = aspect;
        onChange?.();
    };

    if (image.complete) {
        setAspect();
        return;
    }

    image.addEventListener("load", setAspect, { once: true });
    image.addEventListener("error", () => {
        clearMediaAspect(slideRoot, media);
        onChange?.();
    }, { once: true });
}

function setSlideDensityClass(slideRoot, densityClass) {
    slideRoot.classList.remove(
        "presentation-slide--comfort",
        "presentation-slide--compact",
        "presentation-slide--dense"
    );

    slideRoot.classList.add(densityClass);
}

function isSlideOverflowing(slideRoot, copyRoot) {
    return slideRoot.scrollHeight > slideRoot.clientHeight + 4
        || copyRoot.scrollHeight > copyRoot.clientHeight + 4;
}

function applySlideDensity(slideRoot, copyRoot, slide, viewport = {}) {
    const densityOrder = [
        "presentation-slide--comfort",
        "presentation-slide--compact",
        "presentation-slide--dense"
    ];

    const titleLength = String(slide.title || "").length;
    const subtitleLength = String(slide.subtitle || "").length;
    const bodyLength = String(slide.body || "").length;
    const lineCount = String(slide.body || "").replace(/\r/g, "").split("\n").filter((line) => line.trim()).length;
    const hasImage = Boolean(slide.imageUrl || slide.imagePrompt);
    const stageHeight = Number(viewport.stageHeight || window.innerHeight);
    const stageWidth = Number(viewport.stageWidth || window.innerWidth);
    const viewportPenalty = Math.max(0, 700 - stageHeight) * 1.45 + Math.max(0, 1240 - stageWidth) * 0.2;
    const densityScore = titleLength
        + subtitleLength
        + bodyLength
        + (lineCount * 28)
        + (hasImage ? 120 : 0)
        + viewportPenalty;

    let densityIndex = 0;

    if (densityScore > 620) {
        densityIndex = 2;
    } else if (densityScore > 380) {
        densityIndex = 1;
    }

    for (let index = densityIndex; index < densityOrder.length; index += 1) {
        setSlideDensityClass(slideRoot, densityOrder[index]);
        if (!copyRoot || !isSlideOverflowing(slideRoot, copyRoot)) {
            return;
        }
    }

    setSlideDensityClass(slideRoot, densityOrder[densityOrder.length - 1]);
}

function applySlideLayout(slideRoot, slide) {
    slideRoot.classList.remove(
        "presentation-slide--stack",
        "presentation-slide--split",
        "presentation-slide--feature",
        "presentation-slide--text-only"
    );

    slideRoot.style.display = "";
    slideRoot.style.gridTemplateColumns = "";
    slideRoot.style.gridTemplateRows = "";
    slideRoot.style.gap = "";
    slideRoot.style.alignItems = "";
    slideRoot.style.flexDirection = "";

    if (!slide.imageUrl && !slide.imagePrompt) {
        slideRoot.classList.add("presentation-slide--text-only");
        return;
    }

    if (slide.layoutMode === "split") {
        slideRoot.classList.add("presentation-slide--split");
        return;
    }

    if (slide.layoutMode === "feature") {
        slideRoot.classList.add("presentation-slide--feature");
        return;
    }

    slideRoot.classList.add("presentation-slide--stack");
}

function resolveSplitMediaOffset(slideRoot, media) {
    const mediaAspect = slideRoot.dataset.mediaAspect || media.dataset.mediaAspect || "";

    if (mediaAspect === "portrait") {
        return "clamp(-52px, -1.8vh, -18px)";
    }

    if (mediaAspect === "square") {
        return "clamp(-84px, -3.4vh, -30px)";
    }

    if (mediaAspect === "landscape") {
        return "clamp(-128px, -6vh, -52px)";
    }

    return "clamp(-76px, -3.2vh, -28px)";
}

function renderPresentation(slides) {
    const slideRoot = document.querySelector("[data-presentation-slide]");
    const copyRoot = document.querySelector("[data-presentation-copy]");
    const slideTitle = document.querySelector("[data-presentation-title]");
    const slideSubtitle = document.querySelector("[data-presentation-subtitle]");
    const slideBody = document.querySelector("[data-presentation-body]");
    const classLabel = document.querySelector("[data-presentation-class]");
    const prevButton = document.querySelector("[data-presentation-prev]");
    const nextButton = document.querySelector("[data-presentation-next]");
    const counter = document.querySelector("[data-presentation-counter]");
    const media = document.querySelector("[data-presentation-media]");
    const controls = document.querySelector("[data-presentation-controls]");
    const shell = document.querySelector(".presentation-shell--lesson");
    const topbar = document.querySelector(".presentation-topbar");
    const frame = document.querySelector(".presentation-frame--solo");
    let currentIndex = 0;
    let viewport = {
        stageHeight: window.innerHeight,
        stageWidth: window.innerWidth
    };
    let resizeFrame = 0;

    const turma = typeof readSelectedClass === "function" ? readSelectedClass() : "";

    const updateViewportMetrics = () => {
        const shellStyles = shell ? getComputedStyle(shell) : null;
        const frameStyles = frame ? getComputedStyle(frame) : null;
        const shellPadding = shellStyles
            ? parseFloat(shellStyles.paddingTop || 0) + parseFloat(shellStyles.paddingBottom || 0)
            : 0;
        const shellGap = shellStyles ? parseFloat(shellStyles.rowGap || shellStyles.gap || 0) : 0;
        const frameGap = frameStyles ? parseFloat(frameStyles.rowGap || frameStyles.gap || 0) : 0;
        const topbarHeight = topbar?.offsetHeight || 0;
        const controlsHeight = controls?.offsetHeight || 0;
        const frameWidth = frame?.clientWidth || window.innerWidth;
        const stageHeight = Math.max(320, window.innerHeight - shellPadding - shellGap - topbarHeight - frameGap - controlsHeight - 20);
        const stageWidth = Math.max(320, frameWidth - 8);

        viewport = {
            stageHeight,
            stageWidth
        };

        document.documentElement.style.setProperty("--presentation-stage-height", `${stageHeight}px`);
        document.documentElement.style.setProperty("--presentation-stage-width", `${stageWidth}px`);
        document.body.classList.toggle("presentation-page--compact", stageHeight < 620 || frameWidth < 1180);
    };

    const resetMediaStyles = () => {
        clearMediaAspect(slideRoot, media);
        copyRoot.style.order = "";
        media.style.order = "";
        media.style.alignSelf = "";
        media.style.height = "";
        media.style.marginTop = "";
        media.style.marginBottom = "";
        media.style.minHeight = "";
        media.style.gridColumn = "";
        media.style.gridRow = "";
        copyRoot.style.gridColumn = "";
        copyRoot.style.gridRow = "";
    };

    const paint = () => {
        const slide = slides[currentIndex];

        slideTitle.textContent = slide.title;
        slideSubtitle.textContent = slide.subtitle || "";
        slideSubtitle.hidden = !slide.subtitle;
        slideBody.innerHTML = renderStructuredSlideBody(slide.body);
        classLabel.textContent = turma ? `${turma} • ${slide.title}` : slide.title;
        counter.textContent = `${currentIndex + 1} de ${slides.length}`;

        slideRoot.style.background = `linear-gradient(180deg, ${slide.slideColor} 0%, #ffffff 100%)`;
        slideRoot.style.setProperty("--slide-accent", slide.accentColor || slide.textColor);
        slideRoot.style.color = slide.textColor;
        copyRoot.style.color = slide.textColor;
        slideTitle.style.color = slide.textColor;
        slideSubtitle.style.color = slide.textColor;
        slideBody.style.color = slide.textColor;
        slideRoot.dataset.slideFont = String(slide.fontChoice || "Destaque moderno")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "-");

        applySlideLayout(slideRoot, slide);
        resetMediaStyles();

        if (slide.imageUrl || slide.imagePrompt) {
            media.hidden = false;
            media.innerHTML = slide.imageUrl
                ? `<img data-presentation-image alt="${escapeHtml(slide.imagePrompt || slide.title)}" src="${escapeHtml(slide.imageUrl)}">`
                : renderMediaPlaceholder(slide);
            applyMediaAspect(slideRoot, media, () => {
                if (slide.layoutMode === "split") {
                    media.style.marginTop = resolveSplitMediaOffset(slideRoot, media);
                }

                applySlideDensity(slideRoot, copyRoot, slide, viewport);
            });

            if (slide.layoutMode === "split") {
                slideRoot.style.display = "grid";
                slideRoot.style.gridTemplateColumns = "minmax(0, 1fr) minmax(320px, 0.9fr)";
                slideRoot.style.gridTemplateRows = "minmax(0, 1fr)";
                slideRoot.style.gap = "20px";
                slideRoot.style.alignItems = "start";
                copyRoot.style.gridColumn = "1";
                copyRoot.style.gridRow = "1";
                media.style.gridColumn = "2";
                media.style.gridRow = "1";
                media.style.alignSelf = "end";
                media.style.marginTop = resolveSplitMediaOffset(slideRoot, media);
                media.style.minHeight = "0";
                media.style.height = "auto";
            } else if (slide.layoutMode === "feature") {
                slideRoot.style.display = "grid";
                slideRoot.style.gridTemplateColumns = "minmax(0, 1fr)";
                slideRoot.style.gridTemplateRows = "minmax(280px, 0.58fr) minmax(0, 0.42fr)";
                slideRoot.style.gap = "18px";
                slideRoot.style.alignItems = "stretch";
                media.style.gridColumn = "1";
                media.style.gridRow = "1";
                copyRoot.style.gridColumn = "1";
                copyRoot.style.gridRow = "2";
                media.style.marginTop = "0";
                media.style.marginBottom = "0";
                media.style.minHeight = "100%";
            }
        } else {
            media.hidden = true;
            media.innerHTML = '<img data-presentation-image alt="">';
            applySlideDensity(slideRoot, copyRoot, slide, viewport);
        }

        prevButton.disabled = currentIndex === 0;
        nextButton.disabled = currentIndex === slides.length - 1;
        slideRoot.style.visibility = "visible";
    };

    prevButton.addEventListener("click", () => {
        if (currentIndex === 0) return;
        currentIndex -= 1;
        paint();
    });

    nextButton.addEventListener("click", () => {
        if (currentIndex >= slides.length - 1) return;
        currentIndex += 1;
        paint();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (currentIndex === 0) return;
            currentIndex -= 1;
            paint();
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            if (currentIndex >= slides.length - 1) return;
            currentIndex += 1;
            paint();
        }
    });

    updateViewportMetrics();
    paint();

    window.addEventListener("resize", () => {
        if (resizeFrame) {
            window.cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = window.requestAnimationFrame(() => {
            updateViewportMetrics();
            paint();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readSlidesDraft();
    const slides = draft ? parseSlideCards(draft.stackHtml) : [];
    renderPresentation(slides.length ? slides : buildFallbackSlides());
});
