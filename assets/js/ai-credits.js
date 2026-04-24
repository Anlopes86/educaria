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
    document.querySelectorAll("[data-ai-credits]").forEach((element) => {
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

async function hydrateEducariaAiCredits() {
    if (typeof window.educariaAiCreditsEndpoint !== "function" || typeof window.educariaAiAuthHeaders !== "function") {
        renderEducariaAiCredits(null);
        return;
    }

    try {
        const response = await fetch(window.educariaAiCreditsEndpoint(), {
            method: "GET",
            headers: await window.educariaAiAuthHeaders()
        });

        if (!response.ok) {
            renderEducariaAiCredits(null);
            return;
        }

        const payload = await response.json();
        renderEducariaAiCredits(payload?.credits || null);
    } catch (error) {
        console.warn("EducarIA AI credits unavailable:", error);
        renderEducariaAiCredits(null);
    }
}

window.renderEducariaAiCredits = renderEducariaAiCredits;
window.hydrateEducariaAiCredits = hydrateEducariaAiCredits;

document.addEventListener("DOMContentLoaded", () => {
    hydrateEducariaAiCredits();
});

document.addEventListener("educaria-auth-changed", () => {
    hydrateEducariaAiCredits();
});

document.addEventListener("educaria-ai-credits-updated", (event) => {
    renderEducariaAiCredits(event.detail?.credits || null);
});
