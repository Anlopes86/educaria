import { GROQ_REFERENCE_PRICE, MATERIAL_LABELS, USAGE_REPORT_MAX_RECORDS, USAGE_REPORT_WINDOW_DAYS,
    selectUsageEvents, summarizeUsageEvents, usageContext } from "./ai-usage-analytics.js";

const amount = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const category = (value, options, fallback = "unknown") => options.includes(value) ? value : fallback;
const coverage = value => category(value, ["complete", "partial", "unknown"]);
const date = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const errorCategory = value => category(value, ["rate_limit", "timeout", "unavailable", "generation_failed"], null);
function usage(value) {
    if (!value || amount(value.totalTokens) === null) return null;
    return Object.fromEntries(["inputTokens", "outputTokens", "thoughtTokens", "toolTokens", "cachedInputTokens", "totalTokens"]
        .map(key => [key, amount(value[key])]));
}
function group(events, key) {
    const groups = new Map();
    for (const row of events) {
        const id = row[key];
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(row);
    }
    return [...groups].map(([id, rows]) => ({ id, ...summarizeUsageEvents(rows) }))
        .sort((a, b) => b.knownTokens - a.knownTokens);
}

// Deliberately independent from the account directory. Explicit projection at
// every level prevents future telemetry fields from entering shared exports.
export function buildUsageExport(snapshot, filters, now = Date.now()) {
    const bounded = { ...snapshot, events: snapshot.events.slice(0, USAGE_REPORT_MAX_RECORDS) };
    const { matches, period } = selectUsageEvents(bounded, filters, now);
    const accounts = new Map();
    const account = uid => {
        if (!uid) return null; // Do not merge unlinked events into a fictitious person.
        if (!accounts.has(uid)) accounts.set(uid, `Professor ${String(accounts.size + 1).padStart(3, "0")}`);
        return accounts.get(uid);
    };
    const events = matches.map((row, index) => ({
        number: index + 1, account: account(row.uid), createdAt: date(row.createdAt),
        plan: category(row.plan, ["free", "pro"]), unlimited: row.unlimited === true,
        materialType: Object.hasOwn(MATERIAL_LABELS, row.materialType) ? row.materialType : "unknown",
        provider: category(row.provider, ["groq", "gemini"]),
        model: typeof row.model === "string" && /^[a-zA-Z0-9_./:-]{1,120}$/.test(row.model) ? row.model : "unknown",
        status: category(row.status, ["success", "failed"]), durationMs: amount(row.durationMs),
        context: usageContext(row.materialType, { count: row.context?.requestedCount, contentMode: row.context?.contentMode },
            { detail: row.context?.detail, includeIllustration: row.context?.illustration }, row.context?.hasFile),
        generatedCount: amount(row.generatedCount), usage: usage(row.usage), usageCoverage: coverage(row.usageCoverage),
        creditsCharged: amount(row.creditsCharged), measuredCredits: amount(row.measuredCredits),
        estimatedCostUsd: amount(row.estimatedCostUsd), costCoverage: coverage(row.costCoverage),
        priceVersion: row.priceVersion === GROQ_REFERENCE_PRICE.version ? row.priceVersion : null,
        errorCategory: errorCategory(row.errorCategory),
        attempts: (Array.isArray(row.attempts) ? row.attempts : []).map((attempt, attemptIndex) => ({
            number: attemptIndex + 1, durationMs: amount(attempt.durationMs),
            status: category(attempt.status, ["returned", "failed"]), usage: usage(attempt.usage),
            estimatedCostUsd: amount(attempt.estimatedCostUsd), errorCategory: errorCategory(attempt.errorCategory)
        }))
    }));
    const summary = summarizeUsageEvents(events);
    const truncated = snapshot.truncated === true || snapshot.events.length > USAGE_REPORT_MAX_RECORDS;
    const collection = {
        enabled: snapshot.collection?.enabled === true,
        store: category(snapshot.collection?.store, ["firestore", "memory", "disabled"]),
        failedWrites: amount(snapshot.collection?.failedWrites), pendingWrites: amount(snapshot.collection?.pendingWrites)
    };
    const warnings = [];
    const warn = (code, message) => warnings.push({ code, message });
    if (truncated) warn("history_truncated", "A amostra contém no máximo os 5.000 registros mais recentes dos últimos 30 dias, antes dos filtros. Os totais não representam necessariamente todo o período.");
    if (!collection.enabled) warn("collection_disabled", "A coleta está desativada; o arquivo não comprova ausência de uso.");
    else if (collection.store !== "firestore") warn("temporary_storage", "O armazenamento não é persistente; registros podem ter sido perdidos ao reiniciar o serviço.");
    if (collection.failedWrites) warn("unconfirmed_writes", `${collection.failedWrites} gravações sem confirmação desde o reinício do serviço.`);
    if (collection.pendingWrites) warn("pending_writes", `${collection.pendingWrites} gravações ainda em andamento no momento da consulta.`);
    if (summary.incompleteMeasurements) warn("incomplete_measurements", `${summary.incompleteMeasurements} gerações com consumo parcial ou desconhecido, excluídas das médias de tokens e do P95.`);
    if (summary.unpricedGenerations) warn("incomplete_costs", `${summary.unpricedGenerations} gerações sem estimativa de custo completa. A soma inclui apenas valores conhecidos.`);
    if (summary.unknownCharges) warn("unknown_charges", `${summary.unknownCharges} descontos de créditos sem confirmação; não devem ser interpretados como zero.`);
    if (!events.length) warn("no_matches", "Não há registros disponíveis para estes filtros; o histórico não é retroativo.");
    return {
        format: "educaria-ai-usage", version: 1, exportedAt: new Date(now).toISOString(),
        snapshotAt: date(snapshot.updatedAt), period,
        filters: { days: filters.days, materialType: filters.materialType, status: filters.status, cohort: filters.cohort,
            account: filters.uid ? "single" : "all" },
        privacy: { directIdentifiersRemoved: true, accountLabelsScope: "this-export", includesMaterials: false,
            note: "Rótulos de professor são locais a este arquivo, sem nome, e-mail, UID ou hash de UID. Datas e padrões de uso permanecem; compartilhe somente com quem fará a análise." },
        completeness: { allMatchingPagesIncluded: true, exportedRecords: events.length, sourceRecords: bounded.events.length,
            sourceLimit: USAGE_REPORT_MAX_RECORDS, sourceWindowDays: USAGE_REPORT_WINDOW_DAYS, truncated, collection },
        notes: [
            "Histórico disponível somente desde a ativação da coleta; não inclui gerações anteriores.",
            "O filtro de período é uma janela móvel, não dias do calendário. Datas estão em UTC.",
            "Gerações são solicitações; tentativas são chamadas ao provedor e podem incluir repetições.",
            "knownTokens já soma as tentativas conhecidas. Não some novamente os tokens das tentativas ao total da geração.",
            "Tokens de cache são parte da entrada. O raciocínio é separado da saída neste relatório.",
            "Médias e P95 de tokens consideram somente medições completas e os filtros selecionados, incluindo falhas quando escolhidas.",
            "Créditos são a unidade interna da plataforma, não tokens ou reais. null significa desconhecido, não zero.",
            "Custos são estimativas de referência em USD, não cobranças; o plano gratuito pode não gerar custo financeiro.",
            "O grupo sem limite individual separa os testes das contas limitadas, mas não determina quem é administrador."
        ],
        warnings, summary, byMaterial: group(events, "materialType"), byAccount: group(events, "account"),
        byCohort: [false, true].map(unlimited => ({ id: unlimited ? "unlimited" : "limited",
            ...summarizeUsageEvents(events.filter(row => row.unlimited === unlimited)) })),
        pricing: GROQ_REFERENCE_PRICE, events
    };
}
