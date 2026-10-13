(() => {
    const root = document.querySelector("[data-admin-dashboard]");
    if (!root) return;
    const content = root.querySelector("[data-admin-content]");
    const feedback = root.querySelector("[data-admin-feedback]");
    const status = root.querySelector("[data-admin-status]");
    const retry = root.querySelector("[data-admin-retry]");
    const form = root.querySelector("[data-admin-filters]");
    const tbody = root.querySelector("[data-admin-users]");
    const empty = root.querySelector("[data-admin-empty]");
    const previous = root.querySelector("[data-admin-prev]");
    const next = root.querySelector("[data-admin-next]");
    const refresh = root.querySelector("[data-admin-refresh]");
    const login = root.querySelector("[data-admin-login]");
    const numbers = new Intl.NumberFormat("pt-BR");
    const dates = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
    let page = 1;
    let generation = 0;
    let controller;

    function element(tag, className, value) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (value !== undefined) node.textContent = String(value);
        return node;
    }
    function dateLabel(value, fallback = "Não informado") {
        return value && Number.isFinite(Date.parse(value)) ? dates.format(new Date(value)) : fallback;
    }
    function clearPrivateData() {
        window.educariaAdminUsage?.clear();
        content.hidden = true;
        tbody.replaceChildren();
        root.querySelectorAll("[data-admin-metric]").forEach(node => { node.textContent = "—"; });
        root.querySelector("[data-admin-updated]").textContent = "";
    }
    function showStatus(message, kind = "loading", canRetry = false) {
        feedback.hidden = false;
        feedback.dataset.state = kind;
        status.textContent = message;
        retry.hidden = !canRetry;
        login.hidden = kind !== "session";
    }
    function renderUser(user) {
        const row = element("tr");
        const cell = label => { const node = element("td"); node.dataset.label = label; row.append(node); return node; };
        const identity = cell("Professor");
        const person = element("div", "admin-person");
        const avatar = element("span", "admin-avatar", (user.name || user.email || "?").slice(0, 2).toUpperCase());
        avatar.setAttribute("aria-hidden", "true");
        const copy = element("div");
        copy.append(element("strong", "", user.name || "Nome não informado"), element("span", "admin-secondary", user.email || "E-mail não informado"));
        if (!user.emailVerified) copy.append(element("small", "admin-unverified", "E-mail não verificado"));
        person.append(avatar, copy); identity.append(person);
        cell("Escola").append(element("span", "", user.school || "Não informada"));
        const activity = cell("Cadastro e login");
        activity.append(element("span", "", dateLabel(user.createdAt)), element("small", "admin-secondary", `Último login: ${dateLabel(user.lastSignInAt, "ainda não registrado")}`));
        const account = cell("Conta");
        account.append(element("span", `admin-badge ${user.disabled ? "admin-badge--muted" : "admin-badge--green"}`, user.disabled ? "Desativada" : "Habilitada"),
            element("small", "admin-secondary", user.plan === "pro" ? "Plano Pro" : "Plano gratuito"));
        const usage = cell("IA hoje");
        const credits = user.credits;
        if (!credits) usage.append(element("span", "admin-secondary", "Saldo indisponível"));
        else if (credits.unlimited) {
            usage.append(element("strong", "", "Sem limite individual"), element("small", "admin-secondary", "Sem desconto de créditos. Veja o consumo no relatório abaixo."));
        } else {
            usage.append(element("strong", "", `${numbers.format(credits.remaining)} disponíveis`),
                element("small", "admin-secondary", `${numbers.format(credits.used)} usados de ${numbers.format(credits.limit)}`));
            if (credits.reserved > 0) usage.append(element("small", "admin-secondary", `${numbers.format(credits.reserved)} reservados em geração`));
            usage.title = `Renovação: ${dateLabel(credits.resetAt)}. Valores em créditos, não em tokens.`;
            if (credits.store !== "firestore") usage.append(element("small", "admin-unverified", "Saldo em armazenamento temporário"));
        }
        return row;
    }
    function render(payload, forceRefresh = false) {
        root.querySelectorAll("[data-admin-metric]").forEach(node => { node.textContent = numbers.format(payload.summary[node.dataset.adminMetric] ?? 0); });
        tbody.replaceChildren(...payload.users.map(renderUser));
        empty.hidden = payload.users.length !== 0;
        root.querySelector("[data-admin-table]").hidden = payload.users.length === 0;
        const pagination = payload.pagination;
        page = pagination.page;
        previous.disabled = page <= 1;
        next.disabled = page >= pagination.totalPages;
        root.querySelector("[data-admin-count]").textContent = `${numbers.format(pagination.totalMatches)} ${pagination.totalMatches === 1 ? "professor encontrado" : "professores encontrados"}`;
        root.querySelector("[data-admin-page]").textContent = `Página ${page} de ${pagination.totalPages}`;
        root.querySelector("[data-admin-updated]").textContent = `Cadastros consultados em ${dateLabel(payload.directoryUpdatedAt)}. Saldos atualizados em ${dateLabel(payload.balancesUpdatedAt)}.`;
        feedback.hidden = true;
        content.hidden = false;
        window.educariaAdminUsage?.load(forceRefresh);
    }
    async function load(forceRefresh = false, focusResults = false) {
        const current = ++generation;
        controller?.abort();
        controller = new AbortController();
        clearPrivateData();
        showStatus("Consultando os usuários… O serviço pode levar alguns instantes para responder.");
        root.setAttribute("aria-busy", "true");
        refresh.disabled = true;
        try {
            const fields = new FormData(form);
            const payload = await window.educariaAdminApi.request("/users", {
                q: fields.get("q") || "", status: fields.get("status") || "all", plan: fields.get("plan") || "all",
                page, refresh: String(forceRefresh)
            }, controller.signal);
            if (current !== generation) return;
            if (!payload.ok || !Array.isArray(payload.users) || !payload.pagination || !payload.summary) throw new Error("Resposta inválida.");
            render(payload, forceRefresh);
            if (focusResults) root.querySelector("[data-admin-count]").focus({ preventScroll: true });
        } catch (error) {
            if (current !== generation) return;
            clearPrivateData();
            if (error.status === 403) showStatus("Esta área é exclusiva da administração. Sua conta não tem permissão para consultar os usuários.", "denied");
            else if (error.status === 401) showStatus("Entre novamente para acessar a administração.", "session");
            else if (error.status === 429) showStatus("Muitas consultas em sequência. Aguarde um minuto e tente novamente.", "error", true);
            else showStatus(error.name === "AbortError" ? "A consulta demorou mais do que o esperado. Tente novamente." : "Não foi possível carregar os usuários. Confira a conexão e tente novamente.", "error", true);
        } finally {
            if (current === generation) { root.setAttribute("aria-busy", "false"); refresh.disabled = false; }
        }
    }
    form.addEventListener("submit", event => { event.preventDefault(); page = 1; load(false, true); });
    previous.addEventListener("click", () => { page -= 1; load(false, true); });
    next.addEventListener("click", () => { page += 1; load(false, true); });
    retry.addEventListener("click", () => load());
    refresh.addEventListener("click", () => load(true));
    root.querySelector("[data-admin-clear]").addEventListener("click", () => { form.reset(); page = 1; load(false, true); });
    document.addEventListener("educaria-auth-changed", () => { page = 1; load(); });
    document.addEventListener("educaria-admin-access-denied", event => {
        generation += 1; controller?.abort(); clearPrivateData();
        root.setAttribute("aria-busy", "false"); refresh.disabled = false;
        showStatus(event.detail?.status === 401 ? "Entre novamente para acessar a administração." : "Sua conta não tem permissão para acessar a administração.", event.detail?.status === 401 ? "session" : "denied");
    });
    window.addEventListener("pagehide", () => { generation += 1; controller?.abort(); clearPrivateData(); });
    window.addEventListener("pageshow", event => { if (event.persisted) load(); });
    load();
})();
