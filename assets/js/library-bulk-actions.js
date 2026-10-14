/* Selection is limited to visible cards. Operations persist once, then sync using
 * the library's existing per-account conflict/tombstone protocol. */
(() => {
    document.addEventListener("DOMContentLoaded", () => {
        const root = document.querySelector("[data-library-materials], [data-saved-lessons]");
        if (!root) return;
        const selected = new Set();
        let context = "";
        let session = null;
        const bar = document.createElement("div");
        bar.className = "collection-bulk-bar";
        bar.innerHTML = '<label><input type="checkbox" data-bulk-all> Selecionar todos exibidos</label><span data-bulk-count role="status" aria-live="polite">Nenhum selecionado</span><div class="collection-bulk-actions"><button type="button" class="platform-link-button platform-link-secondary" data-bulk-action="move">Mover</button><button type="button" class="platform-link-button platform-link-secondary" data-bulk-action="copy">Copiar</button><button type="button" class="platform-link-button platform-link-secondary" data-bulk-action="delete">Excluir</button><button type="button" class="platform-link-button" data-bulk-clear>Limpar seleção</button></div>';
        root.before(bar);
        const dialog = document.createElement("dialog");
        dialog.className = "collection-bulk-dialog";
        dialog.setAttribute("aria-labelledby", "bulk-dialog-title");
        dialog.innerHTML = '<form><h2 id="bulk-dialog-title"></h2><p data-bulk-description></p><label class="platform-field" data-bulk-destination-field>Destino<select data-bulk-destination></select></label><p data-bulk-error role="alert" hidden></p><div class="collection-bulk-dialog-actions"><button type="button" class="platform-link-button platform-link-secondary" data-bulk-cancel>Cancelar</button><button type="submit" class="platform-link-button platform-link-primary" data-bulk-confirm>Confirmar</button></div></form>';
        document.body.append(dialog);
        const cards = () => [...root.querySelectorAll("[data-lesson-card]")];
        const visibleIds = () => cards().map((card) => card.dataset.lessonCard);
        const uid = () => typeof readCurrentTeacher === "function" ? readCurrentTeacher()?.uid || "" : "";
        function render() {
            const nextContext = `${uid()}:${document.querySelector("[data-library-scope-filter]")?.value || currentClassName()}`;
            if (context !== nextContext) selected.clear();
            context = nextContext;
            const visible = new Set(visibleIds());
            for (const id of selected) if (!visible.has(id)) selected.delete(id);
            for (const card of cards()) {
                let label = card.querySelector("[data-bulk-card-label]");
                if (!label) {
                    label = document.createElement("label");
                    label.dataset.bulkCardLabel = "";
                    label.className = "collection-card-select";
                    const input = document.createElement("input");
                    input.type = "checkbox";
                    input.dataset.bulkSelect = card.dataset.lessonCard;
                    input.setAttribute("aria-label", `Selecionar ${card.querySelector("h3")?.textContent || "material"}`);
                    label.append(input, " Selecionar");
                    card.prepend(label);
                }
                label.querySelector("input").checked = selected.has(card.dataset.lessonCard);
                card.classList.toggle("is-selected", selected.has(card.dataset.lessonCard));
            }
            bar.hidden = !visible.size;
            bar.querySelector("[data-bulk-count]").textContent = selected.size ? `${selected.size} ${selected.size === 1 ? "selecionado" : "selecionados"}` : "Nenhum selecionado";
            const all = bar.querySelector("[data-bulk-all]");
            all.checked = visible.size > 0 && selected.size === visible.size;
            all.indeterminate = selected.size > 0 && selected.size < visible.size;
            bar.querySelectorAll("button").forEach((button) => { button.disabled = !selected.size; });
        }
        function close() { dialog.close(); session?.trigger?.focus(); session = null; }
        function open(action, trigger) {
            render();
            if (!selected.size) return;
            session = { action, ids: [...selected], uid: uid(), trigger };
            const verb = { move: "Mover", copy: "Copiar", delete: "Excluir" }[action];
            dialog.querySelector("h2").textContent = `${verb} ${selected.size} ${selected.size === 1 ? "material" : "materiais"}?`;
            dialog.querySelector("[data-bulk-description]").textContent = action === "delete"
                ? "Os materiais selecionados serão excluídos da biblioteca ou turma de origem. Esta ação não pode ser desfeita; cópias independentes em outras turmas serão mantidas."
                : action === "move" ? "Os materiais sairão do local atual e irão para o destino escolhido, mantendo suas edições."
                    : "Os originais serão mantidos. O destino receberá cópias independentes, que você poderá editar separadamente.";
            dialog.querySelector("[data-bulk-destination-field]").hidden = action === "delete";
            const picker = dialog.querySelector("[data-bulk-destination]");
            picker.replaceChildren(new Option("Escolha o destino", ""), new Option("Biblioteca pessoal", "library"),
                ...getAvailableClasses().map((name) => new Option(name, `class:${name}`)));
            dialog.querySelector("[data-bulk-error]").hidden = true;
            dialog.querySelector("[data-bulk-confirm]").textContent = action === "delete" ? "Excluir materiais" : `${verb} materiais`;
            dialog.showModal();
            dialog.querySelector(action === "delete" ? "[data-bulk-cancel]" : "[data-bulk-destination]").focus();
        }
        root.addEventListener("change", (event) => {
            const input = event.target.closest("[data-bulk-select]");
            if (!input) return;
            input.checked ? selected.add(input.dataset.bulkSelect) : selected.delete(input.dataset.bulkSelect);
            render();
        });
        bar.addEventListener("change", (event) => {
            if (!event.target.matches("[data-bulk-all]")) return;
            selected.clear();
            if (event.target.checked) visibleIds().forEach((id) => selected.add(id));
            render();
        });
        bar.addEventListener("click", (event) => {
            if (event.target.closest("[data-bulk-clear]")) { selected.clear(); render(); }
            const trigger = event.target.closest("[data-bulk-action]");
            if (trigger) open(trigger.dataset.bulkAction, trigger);
        });
        dialog.querySelector("[data-bulk-cancel]").addEventListener("click", close);
        dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
        dialog.querySelector("form").addEventListener("submit", (event) => {
            event.preventDefault();
            if (!session) return;
            try {
                if (session.uid !== uid()) throw new Error("A conta mudou. Feche esta janela e selecione os materiais novamente.");
                const value = dialog.querySelector("select").value;
                const destination = value === "library" ? { scope: "library", className: "" }
                    : value.startsWith("class:") ? { scope: "class", className: value.slice(6) } : null;
                const result = organizeLessons(session.ids, session.action, destination);
                const label = { move: "movidos", copy: "copiados", delete: "excluídos" }[session.action];
                selected.clear(); close(); render();
                showLibraryToast(`${result.count} materiais ${label}. Sincronização com a conta em andamento; sem conexão, permanece pendente neste dispositivo.`);
            } catch (error) {
                const feedback = dialog.querySelector("[data-bulk-error]");
                feedback.textContent = error.message || "Não foi possível concluir. Tente novamente.";
                feedback.hidden = false;
            }
        });
        new MutationObserver(render).observe(root, { childList: true });
        document.addEventListener("educaria-auth-changed", () => { selected.clear(); if (dialog.open) close(); render(); });
        render();
    });
})();
