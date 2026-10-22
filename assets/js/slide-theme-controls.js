const SLIDE_THEME_PRESETS = {
    moderno: {
        font: "Destaque moderno",
        accent: "#d7e6b9",
        bg: "#153c41",
        text: "#f8f9ec"
    },
    academico: {
        font: "Serifada clássica",
        accent: "#1d4ed8",
        bg: "#eef2ff",
        text: "#172554"
    },
    vibrante: {
        font: "Destaque moderno",
        accent: "#ea580c",
        bg: "#fff1e6",
        text: "#7c2d12"
    },
    minimalista: {
        font: "Leitura limpa",
        accent: "#475569",
        bg: "#f8fafc",
        text: "#0f172a"
    },
    infantil: {
        font: "Leitura limpa",
        accent: "#db2777",
        bg: "#fff1f2",
        text: "#4c1d95"
    }
};

function slideThemeFields() {
    return {
        preset: document.getElementById("slides-tema-visual"),
        font: document.getElementById("slides-tema-fonte"),
        accent: document.getElementById("slides-tema-accent"),
        bg: document.getElementById("slides-tema-bg"),
        text: document.getElementById("slides-tema-text"),
        visualMode: document.getElementById("slides-visual-mode"),
        visualModeHelp: document.querySelector("[data-slides-visual-mode-help]")
    };
}

function syncSlideVisualModeHelp() {
    const fields = slideThemeFields();
    if (!fields.visualModeHelp) return;
    fields.visualModeHelp.textContent = fields.visualMode?.value === "ai"
        ? "Na próxima geração, a IA escolherá cores, fontes e composições ligadas ao assunto. As ilustrações seguirão a mesma paleta. Você poderá editar depois."
        : "Usa uma identidade visual segura e previsível, pronta para projeção.";
}

function syncSlidePedagogyHelp() {
    const choices = [
        ["slides-detalhamento", [
            "Ideia principal e exemplo breve: em geral, 35–60 palavras por slide de conteúdo.",
            "Só o essencial: em geral, 15–35 palavras por slide de conteúdo.",
            "Ideia principal, explicação e exemplo desenvolvido: em geral, 60–110 palavras por slide de conteúdo."
        ]],
        ["slides-tom", [
            "Explicação objetiva, didática e com exemplos do cotidiano.",
            "Comparações, sequências e palavras-chave para uma leitura rápida.",
            "Mostra como e por que acontece, com etapas e relações de causa e consequência.",
            "Abre com perguntas ou situações reais e propõe desafios para a turma. Não altera a paleta de cores."
        ]]
    ];
    choices.forEach(([id, descriptions]) => {
        const field = document.getElementById(id);
        const help = document.getElementById(`${id}-help`);
        if (field && help) help.textContent = descriptions[field.selectedIndex] || descriptions[0];
    });
}

function setSelectValueByText(select, desiredText) {
    if (!select) return;
    const match = [...select.options].find((option) => option.text.trim() === desiredText);
    select.selectedIndex = match ? match.index : 0;
}

function syncThemePresetToControls() {
    const fields = slideThemeFields();
    if (!fields.preset) return;

    const preset = SLIDE_THEME_PRESETS[fields.preset.value];
    if (!preset) return;

    setSelectValueByText(fields.font, preset.font);
    if (fields.accent) fields.accent.value = preset.accent;
    if (fields.bg) fields.bg.value = preset.bg;
    if (fields.text) fields.text.value = preset.text;
}

function applyThemeToAllSlides() {
    const fields = slideThemeFields();
    const cards = [...document.querySelectorAll("[data-slide-card]")];
    if (!cards.length) return;

    cards.forEach((card) => {
        const font = card.querySelector('[data-field="slide-font"]');
        const accent = card.querySelector('[data-field="slide-accent-color"]');
        const bg = card.querySelector('[data-field="slide-color"]');
        const text = card.querySelector('[data-field="slide-text-color"]');

        setSelectValueByText(font, fields.font?.options?.[fields.font.selectedIndex]?.text?.trim() || "Destaque moderno");
        if (accent && fields.accent) accent.value = fields.accent.value;
        if (bg && fields.bg) bg.value = fields.bg.value;
        if (text && fields.text) text.value = fields.text.value;
        card.dataset.slideVisualMode = "manual";
        const editing = window.EducariaSlideDiagramEditing;
        const saved = editing?.readCard(card);
        const recolored = saved && editing.recolor(saved.data, saved.url, { accent: fields.accent?.value });
        if (recolored) editing.writeCard(card, recolored);
    });

    dispatchBuilderContentChange("input");
    dispatchBuilderContentChange("change");
}

function bindSlideThemeControls() {
    const fields = slideThemeFields();
    if (!fields.preset) return;

    syncThemePresetToControls();
    syncSlideVisualModeHelp();
    syncSlidePedagogyHelp();
    ["slides-detalhamento", "slides-tom"].forEach((id) => {
        document.getElementById(id)?.addEventListener("change", syncSlidePedagogyHelp);
    });

    fields.preset.addEventListener("change", () => {
        syncThemePresetToControls();
        const summary = document.querySelector("[data-ai-slide-theme-summary]");
        if (summary && fields.preset.value !== "ia-personalizado") summary.hidden = true;
    });

    fields.visualMode?.addEventListener("change", syncSlideVisualModeHelp);

    // Capture before the live preview's palette migration runs.
    for (const name of ["input", "change"]) document.addEventListener(name, (event) => {
        if (!event.target?.matches?.('[data-field="slide-font"], [data-field="slide-accent-color"], [data-field="slide-color"], [data-field="slide-text-color"]')) return;
        const card = event.target.closest("[data-slide-card]");
        if (card) card.dataset.slideVisualMode = "manual";
    }, true);

    document.addEventListener("click", (event) => {
        const button = event.target.closest("[data-apply-slides-theme]");
        if (!button) return;

        event.preventDefault();
        applyThemeToAllSlides();
    });
}

document.addEventListener("DOMContentLoaded", bindSlideThemeControls);
