(() => {
    const root = document.querySelector("[data-admin-usage]");
    if (!root) return;
    const form = root.querySelector("form");
    const feedback = root.querySelector("[data-usage-status]");
    const results = root.querySelector("[data-usage-results]");
    const submit = form.querySelector("button");
    const numbers = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
    const dollars = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 5, maximumFractionDigits: 5 });
    const dates = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const labels = { slides: "Slides", quiz: "Quiz", flashcards: "Flashcards", memory: "Memória", match: "Ligue os pontos", wheel: "Roleta",
        mindmap: "Mapa mental", debate: "Debate guiado", wordsearch: "Caça-palavras", crossword: "Palavras cruzadas", hangman: "Forca", image: "Imagem para slide" };
    const number = value => value == null ? "—" : numbers.format(value);
    const quantity = (value, singular, plural) => `${number(value)} ${value === 1 ? singular : plural}`;
    const money = value => value == null ? "Não estimado" : dollars.format(value);
    const date = value => value && Number.isFinite(Date.parse(value)) ? dates.format(new Date(value)) : "—";
    let controller, version = 0, page = 1;
    function el(tag, value, className) {
        const node = document.createElement(tag);
        if (value !== undefined) node.textContent = String(value);
        if (className) node.className = className;
        return node;
    }
    function row(values, headers) {
        const tr = el("tr");
        values.forEach((value, index) => { const td = el("td"); td.dataset.label = headers[index];
            if (value instanceof Node) td.append(value); else td.textContent = String(value); tr.append(td); });
        return tr;
    }
    function identity(user) { return user?.name || user?.email || "Conta não disponível"; }
    function table(target, headers, rows, caption) {
        const wrap = root.querySelector(target);
        wrap.replaceChildren();
        if (!rows.length) { wrap.append(el("p", "Ainda não há registros para estes filtros.", "admin-footnote")); return; }
        const table = el("table", undefined, "admin-table admin-usage-table");
        table.append(el("caption", caption, "sr-only"));
        const head = el("thead"), tr = el("tr"), body = el("tbody");
        headers.forEach(title => { const th = el("th", title); th.scope = "col"; tr.append(th); });
        head.append(tr); body.append(...rows.map(values => row(values, headers))); table.append(head, body); wrap.append(table);
    }
    function clear() {
        version += 1; controller?.abort();
        results.hidden = true;
        root.querySelectorAll("[data-usage-output]").forEach(node => node.replaceChildren());
        root.querySelectorAll("[data-usage-metric]").forEach(node => { node.textContent = "—"; });
        const select = form.elements.uid;
        select.replaceChildren(el("option", "Todos os professores")); select.firstChild.value = "";
        feedback.textContent = ""; root.setAttribute("aria-busy", "false"); submit.disabled = false;
    }
    function details(event) {
        const box = el("details", undefined, "admin-usage-detail");
        box.append(el("summary", `${number(event.usage?.totalTokens)} tokens · ${quantity(event.attempts.length, "tentativa", "tentativas")}`));
        const coverage = { complete: "Completo", partial: "Parcial", unknown: "Não informado pelo provedor" };
        box.append(el("p", `Consumo: ${coverage[event.usageCoverage] || "Desconhecido"}. ${event.provider} · ${event.model}`));
        const context = event.context;
        box.append(el("p", `Itens: ${event.generatedCount ?? "—"} gerados / ${context.requestedCount ?? "automático"} solicitados. Arquivo: ${context.hasFile ? "sim" : "não"}. Tempo: ${number(event.durationMs / 1000)} s.`));
        if (context.detail) box.append(el("p", `Detalhamento: ${{ concise: "enxuto", balanced: "equilibrado", detailed: "detalhado" }[context.detail]}. Ilustração: ${context.illustration ? "sim" : "não"}.`));
        const errors = { rate_limit: "limite do provedor", timeout: "tempo esgotado", unavailable: "conexão indisponível", generation_failed: "falha na geração" };
        if (event.errorCategory) box.append(el("p", `Falha: ${errors[event.errorCategory] || "não classificada"}.`));
        event.attempts.forEach(attempt => {
            const usage = attempt.usage;
            box.append(el("p", usage
                ? `Tentativa ${attempt.number}: entrada ${number(usage.inputTokens)} (cache ${number(usage.cachedInputTokens)}); saída ${number(usage.outputTokens)}; raciocínio ${number(usage.thoughtTokens)}; ferramentas ${number(usage.toolTokens)}. Total: ${number(usage.totalTokens)}.`
                : `Tentativa ${attempt.number}: consumo desconhecido.`));
        });
        box.append(el("p", `Créditos descontados: ${number(event.creditsCharged)}. Equivalente medido: ${number(event.measuredCredits)}.`));
        return box;
    }
    function render(payload) {
        const summary = payload.summary;
        const values = { generations: number(summary.generations), tokens: number(summary.knownTokens), cost: money(summary.estimatedCostUsd), failed: number(summary.failed) };
        root.querySelectorAll("[data-usage-metric]").forEach(node => { node.textContent = values[node.dataset.usageMetric]; });
        const warnings = ["O histórico começa com a publicação desta versão. Não inclui gerações anteriores."];
        if (!payload.collection.enabled) warnings.push("Coleta desativada no servidor.");
        else if (payload.collection.store !== "firestore") warnings.push("Armazenamento temporário: estes registros desaparecem ao reiniciar o serviço.");
        if (payload.truncated) warnings.push("Amostra limitada aos 5.000 registros mais recentes dos últimos 30 dias. Totais e filtros não representam todo o período.");
        if (payload.collection.failedWrites) warnings.push(`${quantity(payload.collection.failedWrites, "gravação sem confirmação", "gravações sem confirmação")} desde o reinício do serviço; o relatório pode estar incompleto.`);
        if (payload.collection.pendingWrites) warnings.push(`${quantity(payload.collection.pendingWrites, "gravação", "gravações")} em andamento.`);
        if (summary.incompleteMeasurements) warnings.push(`${quantity(summary.incompleteMeasurements, "geração", "gerações")} com consumo parcial ou desconhecido, fora do cálculo das médias.`);
        if (summary.unpricedGenerations) warnings.push(`${quantity(summary.unpricedGenerations, "geração", "gerações")} sem estimativa de custo completa. O valor exibido soma apenas as parcelas conhecidas.`);
        if (summary.unknownCharges) warnings.push(`${quantity(summary.unknownCharges, "desconto de créditos sem confirmação", "descontos de créditos sem confirmação")}.`);
        root.querySelector("[data-usage-notes]").textContent = warnings.join(" ");
        root.querySelector("[data-usage-updated]").textContent = `Período: ${date(payload.period.from)} a ${date(payload.period.to)}. Consultado em ${date(payload.updatedAt)}.`;
        table("[data-usage-materials]", ["Atividade", "Gerações / falhas", "Média de tokens", "P95 de tokens", "Custo estimado"], payload.byMaterial.map(item => [
            labels[item.id] || item.id, `${number(item.generations)} / ${number(item.failed)}`, `${number(item.averageTokens)} (${quantity(item.completeMeasurements, "medição completa", "medições completas")})`, number(item.p95Tokens), money(item.estimatedCostUsd)
        ]), "Consumo por tipo de atividade");
        table("[data-usage-users]", ["Professor", "Gerações", "Tokens conhecidos", "Créditos descontados", "Custo estimado"], payload.byUser.map(item => [
            identity(item.user), number(item.generations), number(item.knownTokens), number(item.creditsCharged), money(item.estimatedCostUsd)
        ]), "Até 20 professores com maior consumo no período");
        table("[data-usage-expensive]", ["Atividade", "Professor", "Data", "Custo estimado"], payload.expensive.map(item => [
            labels[item.materialType] || item.materialType, identity(item.user), date(item.createdAt), `${money(item.estimatedCostUsd)}${item.costCoverage !== "complete" ? " (parcial)" : ""}`
        ]), "Cinco gerações mais caras entre os custos conhecidos");
        table("[data-usage-events]", ["Data / professor", "Atividade", "Resultado", "Consumo e detalhes", "Custo estimado"], payload.events.map(event => {
            const person = el("div"); person.append(el("strong", identity(event.user)), el("span", date(event.createdAt), "admin-secondary"));
            if (event.unlimited) person.append(el("small", "Sem limite individual", "admin-secondary"));
            return [person, labels[event.materialType] || event.materialType, event.status === "success" ? "Concluída" : "Falhou", details(event),
                `${money(event.estimatedCostUsd)}${event.costCoverage === "partial" ? " (parcial)" : ""}`];
        }), "Histórico de gerações, tentativas e tokens");
        const selected = form.elements.uid.value;
        const options = [el("option", "Todos os professores")]; options[0].value = "";
        payload.userOptions.forEach(user => { const option = el("option", `${identity(user)}${user.email ? ` · ${user.email}` : ""}`); option.value = user.uid; options.push(option); });
        if (selected && !payload.userOptions.some(user => user.uid === selected)) { const option = el("option", "Professor selecionado (sem registros neste período)"); option.value = selected; options.push(option); }
        form.elements.uid.replaceChildren(...options); form.elements.uid.value = selected;
        page = payload.pagination.page;
        root.querySelector("[data-usage-prev]").disabled = page <= 1;
        root.querySelector("[data-usage-next]").disabled = page >= payload.pagination.totalPages;
        root.querySelector("[data-usage-page]").textContent = `Página ${page} de ${payload.pagination.totalPages} · ${number(payload.pagination.totalMatches)} registros`;
        feedback.textContent = summary.generations ? `${quantity(summary.generations, "geração encontrada", "gerações encontradas")}.` : "Ainda não há gerações registradas para estes filtros. Use a plataforma normalmente e atualize o relatório.";
        results.hidden = false;
    }
    async function load(refresh = false) {
        const current = ++version;
        controller?.abort(); controller = new AbortController();
        results.hidden = true; feedback.textContent = "Consultando o consumo de IA…";
        submit.disabled = true; root.setAttribute("aria-busy", "true");
        try {
            const params = Object.fromEntries(new FormData(form));
            const payload = await window.educariaAdminApi.request("/usage", { ...params, page, refresh: String(refresh) }, controller.signal);
            if (current !== version) return;
            if (!payload.ok || !payload.summary || !Array.isArray(payload.events)) throw new Error("invalid_usage_response");
            render(payload);
        } catch (error) {
            if (current !== version) return;
            clear();
            if (error.status === 401 || error.status === 403) document.dispatchEvent(new CustomEvent("educaria-admin-access-denied", { detail: { status: error.status } }));
            feedback.textContent = error.status === 401 || error.status === 403 ? "Sua sessão não permite consultar este relatório. Entre novamente."
                : "Não foi possível consultar o consumo. Use Atualizar relatório para tentar novamente; os dados não foram considerados zero.";
        } finally {
            if (current === version) { submit.disabled = false; root.setAttribute("aria-busy", "false"); }
        }
    }
    form.addEventListener("submit", event => { event.preventDefault(); page = 1; load(true); });
    root.querySelector("[data-usage-prev]").addEventListener("click", () => { page -= 1; load(); });
    root.querySelector("[data-usage-next]").addEventListener("click", () => { page += 1; load(); });
    window.educariaAdminUsage = { clear, load };
})();
