(function (root) {
    "use strict";
    const core = root.EducariaItemRefinement, adapters = root.EducariaItemRefinementAdapters;
    const uid = () => root.educariaGenerationRecovery?.currentUid() || "";
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const states = new Map();
    let activeDialog, pending = false;
    function text(node, value) { if (node.textContent !== value) node.textContent = value; }
    function button(label, attr, secondary = false) {
        const node = document.createElement("button"); node.type = "button"; node.setAttribute(attr, "");
        node.className = `platform-link-button ${secondary ? "platform-link-secondary" : "item-refinement-trigger"}`;
        node.textContent = label; return node;
    }
    function refresh(state) {
        const { group, selected, toolbar } = state, cards = group.cards();
        for (const card of selected) if (!cards.includes(card)) selected.delete(card);
        cards.forEach((card, index) => {
            let actions = card.querySelector("[data-refinement-actions]");
            if (!actions) {
                // Upgrade drafts saved by the first, single-item version.
                card.querySelectorAll("[data-refine-item], [data-undo-refinement]").forEach(node => node.remove());
                actions = document.createElement("div"); actions.dataset.refinementActions = ""; actions.className = "item-refinement-actions";
                const label = document.createElement("label"); label.className = "item-refinement-select";
                const check = document.createElement("input"); check.type = "checkbox"; check.dataset.refineSelect = "";
                const caption = document.createElement("span"); caption.textContent = "Selecionar"; label.append(check, caption);
                actions.append(label, button("Ajustar com IA", "data-refine-item"));
                (card.querySelector(".activity-card-header, .platform-card-header, header, .lesson-sequence-inline-editor-item-head") || card).append(actions);
            }
            const check = actions.querySelector("input");
            check.checked = selected.has(card); check.disabled = pending;
            check.setAttribute("aria-label", `Selecionar ${core.definitions[group.type].label.toLowerCase()} ${index + 1} para ajustar`);
            check.closest("label").hidden = !state.selecting;
            const trigger = actions.querySelector("[data-refine-item]"); trigger.disabled = pending;
            trigger.setAttribute("aria-label", `Ajustar ${core.definitions[group.type].label.toLowerCase()} ${index + 1} com IA`);
            card.classList.toggle("is-refinement-selected", selected.has(card));
        });
        toolbar.hidden = cards.length === 0;
        toolbar.querySelector("[data-refine-selection-mode]").disabled = pending;
        text(toolbar.querySelector("[data-refine-selection-mode]"), state.selecting ? "Cancelar seleção" : group.type === "quiz" ? "Selecionar questões" : "Selecionar itens");
        const batch = toolbar.querySelector("[data-refine-selected]"); batch.hidden = !state.selecting;
        batch.disabled = pending || !selected.size;
        text(batch, `Ajustar selecionados (${selected.size})`);
        const distribute = toolbar.querySelector("[data-refine-distribute]");
        if (distribute) {
            const targets = state.selecting ? cards.filter(card => selected.has(card)) : cards;
            distribute.disabled = pending || !targets.some(card => group.read(card).kind === "multiple_choice");
            text(distribute, state.selecting ? "Distribuir gabarito da seleção" : "Distribuir gabarito");
        }
        const undo = state.undo;
        toolbar.querySelector("[data-undo-refinement]").hidden = !undo || undo.owner !== uid()
            || undo.changes.some(change => !cards.includes(change.card) || !equal(group.read(change.card), change.after));
    }
    function refreshAll() { states.forEach(refresh); }
    function contextFor(group, cards) {
        return { ...group.context(), neighbors: group.cards().filter(card => !cards.includes(card)).map(card => {
            const item = group.read(card); return String(item.title || item.prompt || item.front || item.term || item.answer || item.text || item.left || "").slice(0, 200);
        }).filter(Boolean).slice(0, 30) };
    }
    function open(state, cards, trigger, { distribute = false } = {}) {
        if (activeDialog || pending || !cards.length) return;
        const { group } = state, type = group.type, owner = uid();
        const all = group.cards();
        const records = cards.map(card => ({ card, id: `item-${all.indexOf(card) + 1}`, index: all.indexOf(card), before: group.read(card) }));
        const context = contextFor(group, cards);
        const dialog = document.createElement("dialog"); dialog.className = "item-refinement-dialog";
        dialog.setAttribute("aria-labelledby", "item-refinement-title");
        dialog.innerHTML = `<form class="item-refinement-form"><header><span class="platform-section-label">Ajuste com IA</span>
            <h2 id="item-refinement-title"></h2><p>Altere só a seleção. As outras partes ficam como estão.</p></header>
            <div class="item-refinement-body"><div class="item-refinement-presets" data-refine-presets aria-label="Sugestões de ajuste"></div>
            <label class="platform-field"><span>O que ajustar?</span><select data-refine-field><option value="all">Conteúdo dos itens selecionados</option></select></label>
            <label class="platform-field"><span>Qual mudança você quer?</span><textarea data-refine-instruction rows="3" maxlength="1500" required placeholder="Ex.: refaça com exemplos mais próximos do cotidiano e linguagem para o 6º ano."></textarea></label>
            <p data-refine-scope class="item-refinement-credit-note"></p>
            <p class="item-refinement-credit-note" data-refine-credit-note>Usa créditos conforme o consumo, mesmo se a sugestão não for aplicada.</p>
            <div data-refine-feedback hidden></div>
            <div class="item-refinement-result" data-refine-result hidden></div><p class="item-refinement-status" data-refine-status role="status" aria-live="polite"></p></div>
            <footer><button type="button" data-refine-close class="platform-link-button platform-link-secondary">Cancelar</button>
            <button type="submit" data-refine-generate class="platform-link-button platform-link-primary">Gerar sugestão</button>
            <button type="button" data-refine-apply class="platform-link-button platform-link-primary" hidden>Aplicar sugestões</button></footer></form>`;
        const form = dialog.querySelector("form"), field = dialog.querySelector("select"), instruction = dialog.querySelector("textarea");
        const generate = dialog.querySelector("[data-refine-generate]"), apply = dialog.querySelector("[data-refine-apply]");
        const result = dialog.querySelector("[data-refine-result]"), status = dialog.querySelector("[data-refine-status]");
        const feedback = dialog.querySelector("[data-refine-feedback]");
        let localDistribution = false;
        dialog.querySelector("h2").textContent = `${core.definitions[type].label} · ${records.map(entry => entry.index + 1).join(", ")}`;
        dialog.querySelector("[data-refine-scope]").textContent = type === "slides" ? "Ajuste dos textos. Imagens, cores e formatação são mantidas."
            : type === "quiz" ? "Ao refazer questões, a IA revisa também alternativas e gabarito. O formato de cada questão é mantido." : "";
        const firstFields = core.fields(type, records[0].before);
        Object.entries(firstFields).forEach(([key, spec]) => {
            try { records.forEach(entry => core.selectedKeys(type, entry.before, key)); }
            catch { return; }
            const option = document.createElement("option"); option.value = key; option.textContent = `Somente ${spec.label.toLowerCase()}`; field.append(option);
        });
        const canDistribute = type === "quiz" && records.every(entry => entry.before.kind === "multiple_choice") && root.EducariaQuizAnswers;
        if (canDistribute) {
            const option = document.createElement("option"); option.value = "options"; option.textContent = "Somente alternativas e gabarito"; field.append(option);
        }
        let patches, approvals;
        function current() { return dialog.isConnected && dialog.open && owner && owner === uid() && records.every(entry => entry.card.isConnected
            && group.cards()[entry.index] === entry.card && equal(group.read(entry.card), entry.before)); }
        function message(value, error = false) { status.textContent = value; status.dataset.error = String(error); }
        function reset() { patches = null; result.replaceChildren(); result.hidden = true; apply.hidden = true; generate.hidden = false; root.EducariaAiFeedback?.render(feedback, null); }
        function choosePreset(value) {
            if (pending) return;
            localDistribution = value === "distribute";
            dialog.querySelector(".platform-section-label").textContent = localDistribution ? "Ajuste sem usar IA" : "Ajuste com IA";
            field.value = localDistribution ? "options" : "all";
            field.disabled = instruction.disabled = localDistribution;
            instruction.closest("label").hidden = localDistribution;
            field.closest("label").hidden = localDistribution;
            instruction.value = localDistribution ? "Distribua as respostas corretas entre A, B, C e D sem alterar o conteúdo."
                : value === "replace" ? (type === "quiz" ? "Substitua as questões selecionadas por perguntas novas sobre o mesmo tema. Revise alternativas, resposta correta e explicação. Evite repetir as demais questões." : "Refaça os itens selecionados com uma nova abordagem sobre o mesmo tema.")
                    : value === "simplify" ? "Simplifique os itens selecionados, com linguagem mais fácil e exemplos concretos."
                        : "Aprofunde os itens selecionados com explicações e exemplos, mantendo o tema e o público.";
            generate.textContent = localDistribution ? "Preparar distribuição" : "Gerar sugestão";
            dialog.querySelector("[data-refine-credit-note]").textContent = localDistribution
                ? "Não usa créditos de IA. Mantém as perguntas e o texto das respostas; muda apenas a ordem das alternativas."
                : "Usa créditos conforme o consumo, mesmo se a sugestão não for aplicada.";
            reset(); message("");
            if (!localDistribution) instruction.focus();
        }
        const presets = [["replace", type === "quiz" ? "Substituir questões" : "Refazer"], ["simplify", "Simplificar"], ["develop", "Aprofundar"], ...(canDistribute ? [["distribute", "Distribuir gabarito"]] : [])];
        presets.forEach(([value, label]) => {
            const preset = button(label, "data-refine-preset", true); preset.dataset.refinePreset = value;
            preset.addEventListener("click", () => choosePreset(value)); dialog.querySelector("[data-refine-presets]").append(preset);
        });
        function invalidate(event) { event.stopPropagation(); if (event.target.closest("[data-refine-result]")) return; if (!pending) { reset(); message(""); } }
        form.addEventListener("input", invalidate); form.addEventListener("change", invalidate);
        dialog.querySelector("[data-refine-close]").addEventListener("click", () => dialog.close());
        form.addEventListener("submit", async event => {
            event.preventDefault(); event.stopPropagation();
            if (pending || !instruction.value.trim()) { instruction.focus(); return; }
            if (!current()) { message("Os itens ou a conta mudaram. Feche e abra o ajuste novamente.", true); return; }
            if (!localDistribution && records.length > core.maxBatch) { message(`Selecione até ${core.maxBatch} itens por ajuste com IA.`, true); return; }
            reset(); pending = true; generate.disabled = true; field.disabled = true; instruction.disabled = true;
            form.setAttribute("aria-busy", "true"); refreshAll(); message("Preparando as sugestões…");
            dialog.querySelectorAll("[data-refine-preset]").forEach(node => { node.disabled = true; });
            const selection = field.value;
            try {
                const refinement = { field: selection, instruction: instruction.value.trim(), items: records.map(({ id, before }) => ({ id, item: before })), context };
                let payload;
                if (localDistribution) {
                    const fixedAnswers = all.filter(card => !cards.includes(card)).map(card => group.read(card)).filter(item => item.kind === "multiple_choice").map(item => item.correct);
                    const balanced = root.EducariaQuizAnswers.balanceItems(records.map(entry => entry.before), { fixedAnswers });
                    payload = { operation: "refine-item", materialType: type, charge: { cost: 0 },
                        material: { items: Object.fromEntries(records.map((entry, index) => [entry.id, Object.fromEntries(core.selectedKeys(type, entry.before, selection).map(key => [key, balanced.items[index][key]]))])) },
                        feedback: { summary: `${balanced.changed} ${balanced.changed === 1 ? "questão com nova posição" : "questões com novas posições"} para a resposta correta. Nenhum crédito utilizado.${balanced.skipped.length ? " Questões com referências a letras ou posições foram preservadas; use o ajuste com IA para reescrevê-las." : ""}` } };
                } else payload = group.request ? await group.request(refinement)
                    : await requestStructuredMaterial(type, "", null, "Ajustar itens selecionados", undefined, undefined, refinement);
                if (!dialog.isConnected || !dialog.open || owner !== uid()) return;
                if (!current()) throw new Error("Um item mudou durante a geração. Feche e abra o ajuste novamente.");
                const proposed = payload?.material?.items;
                if (payload?.operation !== "refine-item" || payload.materialType !== type || !proposed || Array.isArray(proposed)
                    || Object.keys(proposed).length !== records.length) throw new Error("A IA não retornou todos os itens selecionados. Seu conteúdo foi preservado.");
                patches = records.map(entry => ({ ...entry, patch: core.validatePatch(type, entry.before, proposed[entry.id], selection, context) }));
                approvals = new Set();
                patches.forEach(entry => {
                    const changed = Object.keys(entry.patch).filter(key => entry.before[key] !== entry.patch[key]);
                    if (!changed.length) return;
                    approvals.add(entry.id);
                    const section = document.createElement("section"), label = document.createElement("label"), check = document.createElement("input"), caption = document.createElement("strong");
                    check.type = "checkbox"; check.checked = true; check.dataset.refineApprove = entry.id;
                    caption.textContent = `${core.definitions[type].label} ${entry.index + 1}`; label.className = "item-refinement-approval"; label.append(check, caption); section.append(label);
                    check.addEventListener("change", () => { if (check.checked) approvals.add(entry.id); else approvals.delete(entry.id); apply.disabled = !approvals.size; });
                    const specs = core.fields(type, entry.before);
                    changed.forEach(key => {
                        const heading = document.createElement("h4"); heading.textContent = specs[key].label;
                        const old = document.createElement("details"), summary = document.createElement("summary"), previous = document.createElement("p"), next = document.createElement("p");
                        summary.textContent = "Ver texto atual"; previous.textContent = entry.before[key] || "Campo vazio";
                        next.textContent = entry.patch[key] || "Campo ficará vazio"; old.append(summary, previous); section.append(heading, old, next);
                    });
                    result.append(section);
                });
                if (!approvals.size) {
                    reset(); root.EducariaAiFeedback?.render(feedback, payload.feedback);
                    message(localDistribution ? "Nenhuma mudança necessária ou possível sem reescrever o conteúdo. As questões foram mantidas." : "A sugestão ficou igual ao conteúdo atual. Descreva a mudança de outra forma."); return;
                }
                root.EducariaAiFeedback?.render(feedback, payload.feedback);
                result.hidden = false; apply.hidden = false; apply.disabled = false; generate.hidden = true;
                const cost = Number(payload?.charge?.cost);
                message(`Confira as sugestões e mantenha marcadas as que deseja aplicar.${Number.isFinite(cost) ? ` Consumo: ${cost} crédito${cost === 1 ? "" : "s"}.` : ""}`);
                (feedback?.hidden ? result : feedback).scrollIntoView({ block: "nearest", behavior: "smooth" }); apply.focus({ preventScroll: true });
            } catch (error) {
                if (dialog.isConnected && dialog.open && owner === uid()) message(error instanceof TypeError ? "Não foi possível conectar à IA. Tente novamente." : error.message, true);
            } finally {
                pending = false; generate.disabled = false; field.disabled = instruction.disabled = localDistribution;
                dialog.querySelectorAll("[data-refine-preset]").forEach(node => { node.disabled = false; });
                form.removeAttribute("aria-busy"); refreshAll();
            }
        });
        apply.addEventListener("click", () => {
            if (!patches || !current()) { message("Os itens ou a conta mudaram. Feche e abra o ajuste novamente.", true); return; }
            const changes = patches.filter(entry => approvals.has(entry.id)); if (!changes.length) return;
            try {
                validateCollection(group, changes);
                group.commit(changes);
                state.undo = { owner, changes: changes.map(entry => ({ ...entry, after: group.read(entry.card) })) };
                state.toolbar.querySelector("[data-refine-applied]").textContent = `${type === "quiz" ? "Questões" : "Itens"} ${changes.map(entry => entry.index + 1).join(", ")} atualizados. Os demais foram preservados.`;
                state.selected.clear(); state.selecting = false; refresh(state); dialog.close();
            } catch (error) { message(error.message || "Não foi possível aplicar o ajuste.", true); }
        });
        dialog.addEventListener("close", () => { activeDialog = null; dialog.remove(); if (trigger.isConnected) trigger.focus(); }, { once: true });
        document.body.append(dialog); activeDialog = dialog; dialog.showModal();
        if (distribute && canDistribute) { choosePreset("distribute"); generate.focus(); }
        else instruction.focus();
    }
    function validateCollection(group, changes) {
        if (!["wordtrail", "wordsearch", "crossword"].includes(group.type)) return;
        const key = group.type === "crossword" ? "answer" : "term";
        const words = group.cards().map(card => core.cleanWord((changes.find(entry => entry.card === card)?.patch[key] ?? group.read(card)[key]) || "")).filter(Boolean);
        if (new Set(words).size !== words.length) throw new Error("A sugestão repete uma palavra que já existe. Ajuste o pedido antes de aplicar.");
    }
    function bindGroups() {
        for (const [host, state] of states) if (!host.isConnected) { state.toolbar.remove(); states.delete(host); }
        adapters.groups().forEach(group => {
            if (states.has(group.host)) return;
            const toolbar = document.createElement("div"); toolbar.className = "item-refinement-toolbar";
            const caption = document.createElement("strong"); caption.textContent = "Ajustes pontuais com IA"; caption.className = "item-refinement-toolbar-title"; toolbar.append(caption);
            toolbar.append(button("Selecionar itens", "data-refine-selection-mode", true), button("Ajustar selecionados (0)", "data-refine-selected"), button("Desfazer último ajuste", "data-undo-refinement", true));
            if (group.type === "quiz") {
                const distribute = button("Distribuir gabarito", "data-refine-distribute", true);
                distribute.title = "Reorganiza as alternativas sem gastar créditos e mantém o gabarito correto."; toolbar.append(distribute);
            }
            const applied = document.createElement("p"); applied.dataset.refineApplied = ""; applied.setAttribute("role", "status"); toolbar.append(applied);
            if (group.host.matches("[data-worksheet-activity]")) {
                // Keep activity sections adjacent so moving them preserves order.
                group.host.querySelectorAll(":scope > .item-refinement-toolbar").forEach(node => node.remove());
                group.host.querySelector("header").after(toolbar);
            } else group.host.before(toolbar);
            const state = { group, toolbar, selected: new Set(), selecting: false }; states.set(group.host, state);
            toolbar.addEventListener("click", event => {
                event.stopPropagation();
                if (event.target.closest("[data-refine-selection-mode]")) { state.selecting = !state.selecting; state.selected.clear(); refresh(state); }
                if (event.target.closest("[data-refine-selected]")) open(state, group.cards().filter(card => state.selected.has(card)), event.target);
                if (event.target.closest("[data-refine-distribute]")) open(state, group.cards().filter(card => (!state.selecting || state.selected.has(card)) && group.read(card).kind === "multiple_choice"), event.target, { distribute: true });
                if (event.target.closest("[data-undo-refinement]")) {
                    const undo = state.undo;
                    if (undo?.owner === uid() && undo.changes.every(entry => group.cards().includes(entry.card) && equal(group.read(entry.card), entry.after))) {
                        try { group.commit(undo.changes.map(entry => ({ card: entry.card, patch: entry.before }))); applied.textContent = "Último ajuste desfeito."; }
                        catch (error) { root.alert(error.message); }
                    }
                    state.undo = null; refresh(state);
                }
            });
            group.host.addEventListener("change", event => {
                if (!event.target.matches("[data-refine-select]")) return;
                event.stopPropagation();
                const card = group.cards().find(card => card.contains(event.target));
                if (event.target.checked) state.selected.add(card); else state.selected.delete(card); refresh(state);
            });
            group.host.addEventListener("click", event => {
                const trigger = event.target.closest("[data-refine-item]"); if (!trigger) return;
                event.preventDefault(); event.stopPropagation(); const card = group.cards().find(card => card.contains(trigger)); if (card) open(state, [card], trigger);
            });
            group.host.addEventListener("input", event => {
                if (event.target.matches("[data-refine-select]")) { event.stopPropagation(); return; }
                refresh(state);
            });
            refresh(state);
        });
    }
    document.addEventListener("educaria-auth-changed", () => { activeDialog?.close(); states.forEach(state => { state.undo = null; state.selected.clear(); state.selecting = false; }); refreshAll(); });
    document.addEventListener("DOMContentLoaded", () => {
        bindGroups();
        const target = document.querySelector("[data-worksheet-items], [data-lesson-sequence-blocks]") || document.querySelector("main") || document.body;
        new MutationObserver(() => { bindGroups(); refreshAll(); }).observe(target, { childList: true, subtree: true });
    });
})(window);
