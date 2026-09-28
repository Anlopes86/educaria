let educariaLatestAiCredits = null;
let educariaAiCreditsHydrationPromise = null;

const EDUCARIA_AI_FALLBACK_COSTS = Object.freeze({
    wheel: 1,
    hangman: 1,
    wordsearch: 1,
    memory: 2,
    match: 2,
    flashcards: 2,
    crossword: 2,
    quiz: 3,
    mindmap: 3,
    debate: 3,
    slides: 4,
    image: 5
});

const EDUCARIA_AI_MATERIAL_LABELS = Object.freeze({
    wheel: "Roleta",
    hangman: "Força",
    wordsearch: "Caça-palavras",
    memory: "Jogo da memória",
    match: "Ligar pontos",
    flashcards: "Flashcards",
    crossword: "Palavras cruzadas",
    quiz: "Quiz",
    mindmap: "Mapa mental",
    debate: "Debate guiado",
    slides: "Slides",
    image: "Imagem",
    lesson: "Aula completa"
});

function aiPlanLabel(plan) {
    return String(plan || "").trim().toLowerCase() === "pro" ? "Pro" : "Gratuito";
}

function educariaAiCostFor(materialType, credits = educariaLatestAiCredits) {
    const normalizedType = String(materialType || "").trim().toLowerCase();
    const configured = Number(credits?.costs?.[normalizedType]);
    if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
    return Number(EDUCARIA_AI_FALLBACK_COSTS[normalizedType] || 1);
}

function educariaAiTotalCost(materialTypes = [], credits = educariaLatestAiCredits) {
    return materialTypes.reduce((total, materialType) => total + educariaAiCostFor(materialType, credits), 0);
}

function educariaAiMaterialLabel(materialType) {
    const normalizedType = String(materialType || "").trim().toLowerCase();
    return EDUCARIA_AI_MATERIAL_LABELS[normalizedType] || "Esta atividade";
}

function currentEducariaAiMaterialType() {
    const materialType = String(document.body?.dataset?.materialType || "").trim().toLowerCase();
    return materialType === "lesson" ? "" : materialType;
}

function aiCreditCountLabel(value) {
    const count = Number(value || 0);
    return `${count} ${count === 1 ? "crédito" : "créditos"}`;
}

function aiCreditsResetLabel(resetAt) {
    if (!resetAt) return "";

    try {
        const date = new Date(resetAt);
        if (Number.isNaN(date.getTime())) return "";
        return ` - reset ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (_error) {
        return "";
    }
}

function renderEducariaAiCredits(credits) {
    educariaLatestAiCredits = credits || null;
    window.educariaLatestAiCredits = educariaLatestAiCredits;
    document.dispatchEvent(new CustomEvent("educaria-ai-credits-rendered", {
        detail: { credits: educariaLatestAiCredits }
    }));

    document.querySelectorAll("[data-ai-credits]").forEach((element) => {
        if (!element.getAttribute("role")) {
            element.setAttribute("role", "status");
        }
        if (!element.getAttribute("aria-live")) {
            element.setAttribute("aria-live", "polite");
        }
        if (!element.getAttribute("aria-atomic")) {
            element.setAttribute("aria-atomic", "true");
        }

        if (!credits) {
            element.textContent = "Créditos de IA: indisponíveis";
            element.dataset.state = "unavailable";
            return;
        }

        const remaining = Number(credits.remaining || 0);
        const limit = Number(credits.limit || 0);
        const used = Number(credits.used || 0);
        const materialType = currentEducariaAiMaterialType();
        const generationCost = materialType ? educariaAiCostFor(materialType, credits) : 0;
        const plan = aiPlanLabel(credits.plan);
        const resetLabel = aiCreditsResetLabel(credits.resetAt);
        const costLabel = generationCost
            ? ` • ${educariaAiMaterialLabel(materialType)} usa ${aiCreditCountLabel(generationCost)}`
            : "";
        element.textContent = `${remaining} de ${limit} créditos de IA disponíveis hoje${costLabel}`;
        element.title = `Plano ${plan} • ${used} usados hoje${resetLabel}`;
        element.dataset.state = remaining <= 0
            ? "empty"
            : generationCost > remaining
                ? "insufficient"
                : "available";
    });
}

function educariaAiCreditsEmptyMessage(credits, requiredCost = 1, materialType = "") {
    const plan = String(credits?.plan || "").trim().toLowerCase();
    const proLimit = Number(credits?.limits?.pro || 0);
    const currentLimit = Number(credits?.limit || 0);
    const remaining = Number(credits?.remaining || 0);
    const cost = Math.max(1, Number(requiredCost || 1));
    const upgradeHint = plan === "free" && proLimit > currentLimit
        ? " O plano Pro oferece um saldo diário maior."
        : "";

    if (remaining > 0 && remaining < cost) {
        const label = materialType ? educariaAiMaterialLabel(materialType) : "Esta geração";
        return `${label} usa ${aiCreditCountLabel(cost)}, mas você tem ${aiCreditCountLabel(remaining)} disponível.${upgradeHint}`;
    }

    return `Seus créditos diários de IA acabaram por hoje.${upgradeHint} O saldo volta no próximo reset.`;
}

async function hydrateEducariaAiCredits() {
    if (typeof window.educariaAiCreditsEndpoint !== "function" || typeof window.educariaAiAuthHeaders !== "function") {
        renderEducariaAiCredits(null);
        return null;
    }

    try {
        const response = await fetch(window.educariaAiCreditsEndpoint(), {
            method: "GET",
            headers: await window.educariaAiAuthHeaders()
        });

        if (!response.ok) {
            renderEducariaAiCredits(null);
            return null;
        }

        const payload = await response.json();
        const credits = payload?.credits || null;
        renderEducariaAiCredits(credits);
        return credits;
    } catch (error) {
        console.warn("EducarIA AI credits unavailable:", error);
        renderEducariaAiCredits(null);
        return null;
    }
}

async function refreshEducariaAiCredits() {
    if (!educariaAiCreditsHydrationPromise) {
        educariaAiCreditsHydrationPromise = hydrateEducariaAiCredits()
            .finally(() => {
                educariaAiCreditsHydrationPromise = null;
            });
    }

    return educariaAiCreditsHydrationPromise;
}

async function ensureEducariaAiCreditsAvailable(options = {}) {
    const refresh = options.refresh !== false;
    const shouldAlert = options.alert !== false;
    const credits = refresh ? await refreshEducariaAiCredits() : educariaLatestAiCredits;
    const materialType = String(options.materialType || currentEducariaAiMaterialType()).trim().toLowerCase();
    const configuredCost = Number(options.cost);
    const requiredCost = Number.isFinite(configuredCost) && configuredCost > 0
        ? Math.floor(configuredCost)
        : educariaAiCostFor(materialType, credits);

    if (!credits) {
        return true;
    }

    if (Number(credits.remaining) >= requiredCost) {
        return true;
    }

    if (shouldAlert) {
        window.alert(educariaAiCreditsEmptyMessage(credits, requiredCost, materialType));
    }

    return false;
}

window.renderEducariaAiCredits = renderEducariaAiCredits;
window.hydrateEducariaAiCredits = hydrateEducariaAiCredits;
window.refreshEducariaAiCredits = refreshEducariaAiCredits;
window.ensureEducariaAiCreditsAvailable = ensureEducariaAiCreditsAvailable;
window.educariaAiCostFor = educariaAiCostFor;
window.educariaAiTotalCost = educariaAiTotalCost;
window.educariaAiCreditCosts = EDUCARIA_AI_FALLBACK_COSTS;

document.addEventListener("DOMContentLoaded", () => {
    hydrateEducariaAiCredits();
});

document.addEventListener("educaria-auth-changed", () => {
    hydrateEducariaAiCredits();
});

document.addEventListener("educaria-ai-credits-updated", (event) => {
    renderEducariaAiCredits(event.detail?.credits || null);
});
