let educariaLatestAiCredits = null;
let educariaAiCreditsHydrationPromise = null;

function aiPlanLabel(plan) {
    return String(plan || "").trim().toLowerCase() === "pro" ? "Pro" : "Gratuito";
}

function aiCreditsResetLabel(resetAt) {
    if (!resetAt) return "";

    try {
        const date = new Date(resetAt);
        if (Number.isNaN(date.getTime())) return "";
        return ` • renovação às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
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
            element.textContent = "Saldo de IA indisponível";
            element.dataset.state = "unavailable";
            return;
        }

        const remaining = Number(credits.remaining || 0);
        const limit = Number(credits.limit || 0);
        const used = Number(credits.used || 0);
        const plan = aiPlanLabel(credits.plan);
        const resetLabel = aiCreditsResetLabel(credits.resetAt);
        const requests = credits.requests || null;
        const requestQuotaEnabled = requests?.enabled === true;
        const requestRemaining = Number(requests?.remaining || 0);
        const requestLimit = Number(requests?.limit || 0);
        const platformRemaining = Number(requests?.platform?.remaining || 0);
        const platformTokens = credits.platformTokens || null;
        const platformTokensAvailable = platformTokens?.enabled !== true
            || Number(platformTokens.remaining || 0) > 0;
        const requestQuotaVisible = requestQuotaEnabled && requests?.display !== false;
        const requestLabel = requestQuotaVisible
            ? ` • ${requestRemaining} de ${requestLimit} ${requestLimit === 1 ? "geração" : "gerações"} hoje`
            : "";
        const quotaAvailable = (!requestQuotaEnabled || (requestRemaining > 0 && platformRemaining > 0))
            && platformTokensAvailable;

        if (credits.unlimited === true) {
            element.textContent = "Créditos de IA ilimitados para testes";
            element.title = `Conta de testes sem limite individual${resetLabel}`;
            element.dataset.state = quotaAvailable ? "available" : "empty";
            return;
        }

        element.textContent = `${remaining} de ${limit} créditos de IA disponíveis${requestLabel}`;
        element.title = requestQuotaVisible
            ? `Plano ${plan} • ${used} créditos usados • limite diário de ${requestLimit} ${requestLimit === 1 ? "geração" : "gerações"}${resetLabel}`
            : `Plano ${plan} • ${used} usados pelo consumo real da IA${resetLabel}`;
        element.dataset.state = remaining > 0 && quotaAvailable ? "available" : "empty";
    });
}

function educariaAiCreditsEmptyMessage(credits) {
    if (credits?.platformTokens?.enabled && Number(credits.platformTokens.remaining || 0) <= 0) {
        return "A capacidade diária de IA da plataforma foi atingida. O acesso volta no próximo reset.";
    }
    const requests = credits?.requests || null;
    if (requests?.enabled && Number(requests?.platform?.remaining || 0) <= 0) {
        return "A capacidade diária de IA da plataforma foi atingida. O acesso volta no próximo reset.";
    }
    if (requests?.enabled && Number(requests.remaining || 0) <= 0) {
        return "Você atingiu seu limite diário de gerações com IA. O acesso volta no próximo reset.";
    }

    const plan = String(credits?.plan || "").trim().toLowerCase();
    const proLimit = Number(credits?.limits?.pro || 0);
    const currentLimit = Number(credits?.limit || 0);
    const upgradeHint = plan === "free" && proLimit > currentLimit
        ? " O plano Pro oferece um saldo maior."
        : "";

    return `Seus créditos de IA acabaram por hoje.${upgradeHint} O saldo volta no próximo reset.`;
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
    const requiredRequests = Math.max(1, Math.floor(Number(options.requiredRequests) || 1));
    const credits = refresh ? await refreshEducariaAiCredits() : educariaLatestAiCredits;

    if (!credits) {
        return true;
    }

    const requests = credits.requests || null;
    const requestQuotaEnabled = requests?.enabled === true;
    const requestRemaining = Number(requests?.remaining || 0);
    const platformRemaining = Number(requests?.platform?.remaining || 0);
    const platformTokensAvailable = credits?.platformTokens?.enabled !== true
        || Number(credits.platformTokens.remaining || 0) > 0;
    const hasCredits = credits.unlimited === true || Number(credits.remaining) > 0;
    const hasRequests = !requestQuotaEnabled
        || (requestRemaining >= requiredRequests && platformRemaining >= requiredRequests);

    if (hasCredits && hasRequests && platformTokensAvailable) return true;

    if (shouldAlert) {
        if (requestQuotaEnabled && hasCredits && requestRemaining > 0 && requestRemaining < requiredRequests) {
            window.alert(`Esta ação precisa de ${requiredRequests} gerações com IA, mas você tem ${requestRemaining} disponíveis hoje.`);
        } else if (requestQuotaEnabled && hasCredits && platformRemaining > 0 && platformRemaining < requiredRequests) {
            window.alert("A plataforma não tem cota diária suficiente para concluir toda esta ação agora.");
        } else {
            window.alert(educariaAiCreditsEmptyMessage(credits));
        }
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
