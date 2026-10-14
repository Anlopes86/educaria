(() => {
    "use strict";
    const root = document.querySelector("[data-admin-usage]");
    const button = root?.querySelector("[data-usage-export]");
    if (!button) return;
    const form = root.querySelector("form");
    const label = button.querySelector("span");
    const feedback = root.querySelector("[data-usage-export-status]");
    const downloads = new Set();
    let version = 0, controller, available = false, busy = false;
    function reset(disable = true) {
        version += 1; controller?.abort(); controller = null; busy = false;
        if (disable) available = false;
        button.disabled = !available;
        label.textContent = "Exportar relatório";
        feedback.textContent = "";
        for (const download of downloads) { clearTimeout(download.timer); URL.revokeObjectURL(download.url); }
        downloads.clear();
    }
    async function exportReport() {
        if (!available || busy) return;
        const current = ++version;
        controller = new AbortController(); busy = true;
        button.disabled = true; label.textContent = "Preparando arquivo…";
        feedback.textContent = "Consultando todas as páginas dos filtros selecionados, sem dados de identificação…";
        try {
            const params = Object.fromEntries(new FormData(form));
            const payload = await window.educariaAdminApi.request("/usage/export", params, controller.signal);
            if (current !== version) return;
            const report = payload.report;
            if (!payload.ok || report?.format !== "educaria-ai-usage" || report.version !== 1 || !Array.isArray(report.events)
                || !Array.isArray(report.warnings) || report.completeness?.exportedRecords !== report.events.length
                || report.summary?.generations !== report.events.length || !Number.isFinite(Date.parse(report.exportedAt))) {
                throw new Error("invalid_usage_export");
            }
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const download = { url, timer: null };
            downloads.add(download);
            const link = document.createElement("a");
            link.href = url;
            link.download = `educaria-uso-ia-${new Date(report.exportedAt).toISOString().replace(/[:.]/g, "-")}.json`;
            link.hidden = true;
            try { document.body.append(link); link.click(); }
            finally {
                link.remove();
                // Allow the browser to consume the Blob, then release memory.
                download.timer = setTimeout(() => { URL.revokeObjectURL(url); downloads.delete(download); }, 10_000);
            }
            const count = new Intl.NumberFormat("pt-BR").format(report.events.length);
            feedback.textContent = `Arquivo preparado com ${count} ${report.events.length === 1 ? "registro" : "registros"}. Anexe o JSON à conversa para análise.`
                + (report.warnings.length ? " O arquivo inclui avisos sobre a cobertura dos dados." : "");
        } catch (error) {
            if (current !== version) return;
            if (error.status === 401 || error.status === 403) {
                reset();
                document.dispatchEvent(new CustomEvent("educaria-admin-access-denied", { detail: { status: error.status } }));
                return;
            }
            feedback.textContent = error.status === 404 || error.status === 405
                ? "A exportação ainda não está disponível no servidor. É necessário publicar também a atualização da API."
                : error.status === 429 ? "Muitas consultas em sequência. Aguarde um minuto e tente exportar novamente."
                : "Não foi possível preparar o arquivo. Tente exportar novamente; nenhum relatório incompleto foi baixado.";
        } finally {
            if (current === version) { busy = false; controller = null; button.disabled = !available; label.textContent = "Exportar relatório"; }
        }
    }
    button.addEventListener("click", exportReport);
    form.addEventListener("change", () => reset(false));
    document.addEventListener("educaria-auth-changed", () => reset());
    window.addEventListener("pagehide", () => reset());
    window.educariaAdminUsageExport = {
        clear: () => reset(),
        enable() { available = true; button.disabled = busy; }
    };
})();
