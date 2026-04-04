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

        const normalizeLayout = (value) => {
            const text = String(value || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            if (text.includes("lado")) return "split";
            if (text.includes("destaque")) return "feature";
            return "stack";
        };

        return {
            index,
            type: fieldLabel("slide-type") || "Slide",
            title: fieldValue("slide-title") || `Slide ${index + 1}`,
            subtitle: fieldValue("slide-subtitle"),
            body: fieldValue("slide-body") || "Sem conteudo definido.",
            note: fieldValue("slide-note") || "Sem nota do professor.",
            layout: fieldLabel("slide-layout") || "Texto acima",
            layoutMode: normalizeLayout(fieldLabel("slide-layout")),
            imageMode: fieldLabel("slide-image-mode") || "Sem imagem",
            imageUrl: fieldValue("slide-image-url"),
            imagePrompt: fieldValue("slide-image-prompt"),
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
        type: "Abertura",
        title: "Has technology changed education?",
        subtitle: "Observe a transformacao da sala de aula",
        body: "Observe as imagens e pense no que mudou na sala de aula ao longo dos anos.",
        note: "Use este slide como aquecimento oral antes da explicacao.",
        layout: "Texto acima",
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

    if (!slide.imageUrl) {
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
    const image = document.querySelector("[data-presentation-image]");
    const controls = document.querySelector("[data-presentation-controls]");
    let currentIndex = 0;

    const turma = typeof readSelectedClass === "function" ? readSelectedClass() : "";

    const resetMediaStyles = () => {
        copyRoot.style.order = "";
        media.style.order = "";
        media.style.marginTop = "";
        media.style.marginBottom = "";
        media.style.minHeight = "";
        media.style.gridColumn = "";
        media.style.gridRow = "";
        copyRoot.style.gridColumn = "";
        copyRoot.style.gridRow = "";
        controls.style.gridColumn = "";
    };

    const paint = () => {
        const slide = slides[currentIndex];

        slideTitle.textContent = slide.title;
        slideSubtitle.textContent = slide.subtitle || "";
        slideSubtitle.hidden = !slide.subtitle;
        slideBody.textContent = slide.body;
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

        if (slide.imageUrl) {
            media.hidden = false;
            image.src = slide.imageUrl;
            image.alt = slide.imagePrompt || slide.title;

            if (slide.layoutMode === "split") {
                slideRoot.style.display = "grid";
                slideRoot.style.gridTemplateColumns = "minmax(0, 1fr) minmax(320px, 0.9fr)";
                slideRoot.style.gridTemplateRows = "1fr auto";
                slideRoot.style.gap = "20px";
                slideRoot.style.alignItems = "stretch";
                copyRoot.style.gridColumn = "1";
                copyRoot.style.gridRow = "1";
                media.style.gridColumn = "2";
                media.style.gridRow = "1";
                controls.style.gridColumn = "1 / -1";
                media.style.marginTop = "0";
                media.style.minHeight = "100%";
            } else if (slide.layoutMode === "feature") {
                slideRoot.style.display = "flex";
                slideRoot.style.flexDirection = "column";
                copyRoot.style.order = "2";
                media.style.order = "-1";
                media.style.marginTop = "0";
                media.style.marginBottom = "18px";
            }
        } else {
            media.hidden = true;
            image.removeAttribute("src");
            image.alt = "";
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

    paint();
}

document.addEventListener("DOMContentLoaded", () => {
    const draft = readSlidesDraft();
    const slides = draft ? parseSlideCards(draft.stackHtml) : [];
    renderPresentation(slides.length ? slides : buildFallbackSlides());
});
