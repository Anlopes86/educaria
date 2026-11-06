let educariaLatestAiCredits = null;
let educariaAiCreditsHydrationPromise = null;
let educariaAiCreditsRevision = 0;
let educariaAiCreditsHelpDialog = null;
let educariaAiCreditsHelpTrigger = null;

function aiCreditsResetLabel(resetAt) {
    if (!resetAt) return "";

    try {
        const date = new Date(resetAt);
        if (Number.isNaN(date.getTime())) return "";
        return `Renovação prevista do saldo: ${date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.`;
    } catch (_error) {
        return "";
    }
}

function aiCreditsKnownNumber(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function aiCreditsBlockReason(credits, requiredRequests = 1) {
    if (!credits) return "";
    const requests = credits.requests;
    const tokens = credits.platformTokens;
    const platformTokens = aiCreditsKnownNumber(tokens?.remaining);
    const platformRequests = aiCreditsKnownNumber(requests?.platform?.remaining);
    const personalRequests = aiCreditsKnownNumber(requests?.remaining);
    const remaining = aiCreditsKnownNumber(credits.remaining);
    if (tokens?.enabled === true && platformTokens !== null && platformTokens <= 0) return "platform";
    if (requests?.enabled === true && platformRequests !== null && platformRequests < requiredRequests) return "platform";
    if (requests?.enabled === true && personalRequests !== null && personalRequests < requiredRequests) return "requests";
    if (credits.unlimited !== true && remaining !== null && remaining <= 0) return "balance";
    return "";
}

function aiCreditsPresentation(credits) {
    const remaining = aiCreditsKnownNumber(credits?.remaining);
    const limit = aiCreditsKnownNumber(credits?.limit);
    const reason = aiCreditsBlockReason(credits);
    let label = "Seu saldo de IA: consulta indisponível";
    if (credits?.unlimited === true) label = "Conta de testes: sem limite individual";
    else if (remaining !== null) label = `Seu saldo: ${remaining}${limit !== null ? ` de ${limit}` : ""} créditos`;
    const notice = reason === "platform"
        ? "IA temporariamente indisponível: cota compartilhada atingida."
        : reason === "requests" ? "Seu limite diário de gerações foi atingido."
            : reason === "balance" ? "Seu saldo de hoje acabou." : "";
    return { label, notice, state: reason ? "empty" : remaining !== null || credits?.unlimited === true ? "available" : "unavailable" };
}

function updateAiCreditsHelp() {
    if (!educariaAiCreditsHelpDialog) return;
    const credits = educariaLatestAiCredits;
    const { label, notice, state } = aiCreditsPresentation(credits);
    const summary = educariaAiCreditsHelpDialog.querySelector("[data-ai-credits-help-summary]");
    const status = educariaAiCreditsHelpDialog.querySelector("[data-ai-credits-help-status]");
    const requests = educariaAiCreditsHelpDialog.querySelector("[data-ai-credits-help-requests]");
    const reset = educariaAiCreditsHelpDialog.querySelector("[data-ai-credits-help-reset]");
    summary.textContent = label;
    status.textContent = notice || (state === "unavailable" ? "Não foi possível consultar seu saldo agora. Tente novamente em instantes." : "");
    status.hidden = !status.textContent;
    const requestRemaining = aiCreditsKnownNumber(credits?.requests?.remaining);
    const requestLimit = aiCreditsKnownNumber(credits?.requests?.limit);
    const showRequests = credits?.requests?.enabled === true && credits.requests.display !== false
        && Number.isInteger(requestRemaining) && Number.isInteger(requestLimit)
        && requestLimit > 0 && requestRemaining <= requestLimit;
    requests.textContent = showRequests
        ? `Seu limite diário: ${requestRemaining} de ${requestLimit} ${requestLimit === 1 ? "geração restante" : "gerações restantes"}.`
        : "";
    requests.hidden = !showRequests;
    reset.textContent = credits?.unlimited === true ? "" : aiCreditsResetLabel(credits?.resetAt);
    reset.hidden = !reset.textContent;
}

function showAiCreditsHelp(trigger) {
    if (!educariaAiCreditsHelpDialog) {
        const dialog = document.createElement("dialog");
        dialog.className = "ai-credits-help-dialog";
        dialog.setAttribute("aria-labelledby", "ai-credits-help-title");
        dialog.innerHTML = `<h2 id="ai-credits-help-title">Saldo e disponibilidade de IA</h2>
            <p class="ai-credits-help-summary" data-ai-credits-help-summary></p>
            <p data-ai-credits-help-status hidden></p>
            <p data-ai-credits-help-requests hidden></p>
            <p>Seu saldo é individual. As gerações também dependem da cota compartilhada da plataforma e dos limites do provedor. Ter créditos não garante que a IA esteja disponível naquele momento.</p>
            <p data-ai-credits-help-reset hidden></p>
            <p>Mesmo quando a IA não está disponível, você pode editar, apresentar e imprimir os materiais salvos.</p>
            <form method="dialog"><button type="submit" class="platform-link-button platform-link-primary">Entendi</button></form>`;
        dialog.addEventListener("close", () => {
            educariaAiCreditsHelpTrigger?.setAttribute("aria-expanded", "false");
            if (educariaAiCreditsHelpTrigger?.isConnected) educariaAiCreditsHelpTrigger.focus({ preventScroll: true });
        });
        document.body.append(dialog);
        educariaAiCreditsHelpDialog = dialog;
    }
    educariaAiCreditsHelpTrigger = trigger;
    updateAiCreditsHelp();
    trigger.setAttribute("aria-expanded", "true");
    educariaAiCreditsHelpDialog.showModal();
}

function renderEducariaAiCredits(credits) {
    // A generation result or an account change invalidates older balance requests.
    educariaAiCreditsRevision++;
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

        if (!element.querySelector("[data-ai-credits-label]")) {
            element.textContent = "";
            element.classList.add("ai-credits-status");
            const label = document.createElement("span");
            label.dataset.aiCreditsLabel = "";
            const notice = document.createElement("span");
            notice.dataset.aiCreditsNotice = "";
            const help = document.createElement("button");
            help.type = "button";
            help.className = "ai-credits-help-trigger";
            help.textContent = "?";
            help.setAttribute("aria-label", "Entender saldo e disponibilidade de IA");
            help.setAttribute("aria-haspopup", "dialog");
            help.setAttribute("aria-expanded", "false");
            help.addEventListener("click", (event) => {
                // Some balance labels sit inside an editor disclosure summary.
                event.preventDefault();
                event.stopPropagation();
                showAiCreditsHelp(help);
            });
            element.append(label, help, notice);
        }
        const presentation = aiCreditsPresentation(credits);
        element.querySelector("[data-ai-credits-label]").textContent = presentation.label;
        const notice = element.querySelector("[data-ai-credits-notice]");
        notice.textContent = presentation.notice;
        notice.hidden = !presentation.notice;
        element.dataset.state = presentation.state;
        element.removeAttribute("title");
    });
    updateAiCreditsHelp();
}

function educariaAiCreditsEmptyMessage(credits) {
    const reason = aiCreditsBlockReason(credits);
    if (reason === "platform") return "A IA está temporariamente indisponível porque a cota compartilhada foi atingida. Seu saldo individual não garante disponibilidade. Você pode continuar usando os materiais salvos.";
    if (reason === "requests") return "Você atingiu seu limite diário de gerações com IA. Você pode continuar usando os materiais salvos.";
    if (reason === "balance") return `Seus créditos de IA acabaram por hoje. ${aiCreditsResetLabel(credits?.resetAt)}`.trim();
    return "Não foi possível confirmar a disponibilidade da IA agora. Tente novamente em instantes.";
}

async function hydrateEducariaAiCredits() {
    const revision = ++educariaAiCreditsRevision;
    if (typeof window.educariaAiCreditsEndpoint !== "function" || typeof window.educariaAiAuthHeaders !== "function") {
        renderEducariaAiCredits(null);
        return null;
    }

    try {
        const response = await fetch(window.educariaAiCreditsEndpoint(), {
            method: "GET",
            headers: await window.educariaAiAuthHeaders()
        });

        if (revision !== educariaAiCreditsRevision) return educariaLatestAiCredits;
        if (!response.ok) {
            renderEducariaAiCredits(null);
            return null;
        }

        const payload = await response.json();
        if (revision !== educariaAiCreditsRevision) return educariaLatestAiCredits;
        const credits = payload?.credits || null;
        renderEducariaAiCredits(credits);
        return credits;
    } catch (error) {
        if (revision !== educariaAiCreditsRevision) return educariaLatestAiCredits;
        console.warn("EducarIA AI credits unavailable:", error);
        renderEducariaAiCredits(null);
        return null;
    }
}

async function refreshEducariaAiCredits() {
    if (!educariaAiCreditsHydrationPromise) {
        const pending = hydrateEducariaAiCredits()
            .finally(() => {
                if (educariaAiCreditsHydrationPromise === pending) educariaAiCreditsHydrationPromise = null;
            });
        educariaAiCreditsHydrationPromise = pending;
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

    const reason = aiCreditsBlockReason(credits, requiredRequests);
    // Missing quota data is not a zero balance. The API remains the authority.
    if (!reason) return true;

    if (shouldAlert) {
        const requestRemaining = aiCreditsKnownNumber(credits.requests?.remaining);
        const platformRemaining = aiCreditsKnownNumber(credits.requests?.platform?.remaining);
        if (reason === "requests" && requestRemaining > 0) {
            window.alert(`Esta ação precisa de ${requiredRequests} gerações com IA, mas você tem ${requestRemaining} disponíveis hoje.`);
        } else if (reason === "platform" && platformRemaining > 0 && platformRemaining < requiredRequests) {
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
    educariaAiCreditsHydrationPromise = null;
    renderEducariaAiCredits(null);
    hydrateEducariaAiCredits();
});

document.addEventListener("educaria-ai-credits-updated", (event) => {
    renderEducariaAiCredits(event.detail?.credits || null);
});
