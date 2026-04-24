let educariaLatestAiCredits = null;
let educariaAiCreditsHydrationPromise = null;

function aiPlanLabel(plan) {
    return String(plan || "").trim().toLowerCase() === "pro" ? "Pro" : "Gratis";
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
            element.textContent = "Creditos de IA: indisponiveis";
            element.dataset.state = "unavailable";
            return;
        }

        const plan = aiPlanLabel(credits.plan);
        const resetLabel = aiCreditsResetLabel(credits.resetAt);
        element.textContent = `Plano ${plan}: ${credits.remaining} de ${credits.limit} creditos de IA hoje${resetLabel}`;
        element.dataset.state = credits.remaining > 0 ? "available" : "empty";
    });
}

function educariaAiCreditsEmptyMessage(credits) {
    const plan = String(credits?.plan || "").trim().toLowerCase();
    const proLimit = Number(credits?.limits?.pro || 0);
    const currentLimit = Number(credits?.limit || 0);

    if (plan === "free" && proLimit > currentLimit) {
        return "Seus creditos diarios de IA acabaram. O plano Pro libera mais geracoes por dia.";
    }

    return "Seus creditos diarios de IA acabaram por hoje. Tente novamente apos o reset.";
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

    if (!credits) {
        return true;
    }

    if (Number(credits.remaining) > 0) {
        return true;
    }

    if (shouldAlert) {
        window.alert(educariaAiCreditsEmptyMessage(credits));
    }

    return false;
}

window.renderEducariaAiCredits = renderEducariaAiCredits;
window.hydrateEducariaAiCredits = hydrateEducariaAiCredits;
window.refreshEducariaAiCredits = refreshEducariaAiCredits;
window.ensureEducariaAiCreditsAvailable = ensureEducariaAiCreditsAvailable;

document.addEventListener("DOMContentLoaded", () => {
    hydrateEducariaAiCredits();
});

document.addEventListener("educaria-auth-changed", () => {
    hydrateEducariaAiCredits();
});

document.addEventListener("educaria-ai-credits-updated", (event) => {
    renderEducariaAiCredits(event.detail?.credits || null);
});
