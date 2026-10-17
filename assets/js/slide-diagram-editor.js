(function (root) {
    "use strict";
    let activeDialog;
    const editing = () => root.EducariaSlideDiagramEditing;

    function open({ data, url, trigger, onApply }) {
        const original = editing()?.decode(data, url);
        if (!original || activeDialog) return false;
        const dialog = document.createElement("dialog");
        dialog.className = "slide-diagram-dialog";
        dialog.setAttribute("aria-labelledby", "slide-diagram-editor-title");
        dialog.setAttribute("aria-describedby", "slide-diagram-editor-help");
        dialog.innerHTML = `<form class="slide-diagram-editor" novalidate>
            <header><span class="platform-section-label">Ajustes da ilustração</span>
                <h2 id="slide-diagram-editor-title">Editar textos da ilustração</h2>
                <p id="slide-diagram-editor-help">Corrija ou adapte os textos. O desenho é atualizado sem usar IA nem gastar créditos.</p>
            </header>
            <div class="slide-diagram-editor-body">
                <div class="slide-diagram-editor-fields"></div>
                <aside class="slide-diagram-editor-preview"><strong>Prévia</strong><img alt=""><p data-diagram-validation role="status" aria-live="polite"></p></aside>
            </div>
            <footer><button type="button" data-diagram-cancel class="platform-link-button platform-link-secondary">Cancelar</button>
                <button type="submit" class="platform-link-button platform-link-primary">Aplicar alterações</button></footer>
        </form>`;
        const form = dialog.querySelector("form"), fields = dialog.querySelector(".slide-diagram-editor-fields");
        const preview = dialog.querySelector("img"), status = dialog.querySelector("[data-diagram-validation]");
        const apply = dialog.querySelector('[type="submit"]');
        function addField(parent, label, value, maxLength, required = false) {
            const wrapper = document.createElement("label");
            wrapper.className = "platform-field";
            const text = document.createElement("span"); text.textContent = label;
            const input = document.createElement(maxLength > 100 ? "textarea" : "input");
            if (input.tagName === "INPUT") input.type = "text";
            else input.rows = 3;
            input.value = value; input.maxLength = maxLength; input.required = required;
            const hint = document.createElement("small"); hint.textContent = `Até ${maxLength} caracteres`;
            wrapper.append(text, input, hint); parent.appendChild(wrapper);
            return input;
        }
        const title = addField(fields, "Título da ilustração", original.title, 52, true);
        const caption = addField(fields, "Legenda (opcional)", original.caption, 100);
        const nodes = original.nodes.map((node, i) => {
            const group = document.createElement("fieldset");
            const legend = document.createElement("legend"); legend.textContent = `Elemento ${i + 1}`;
            group.appendChild(legend); fields.appendChild(group);
            return { id: node.id, label: addField(group, `Nome do elemento ${i + 1}`, node.label, 32, true),
                detail: ["process", "comparison", "cards"].includes(original.layout) ? addField(group, `Explicação do elemento ${i + 1} (opcional)`, node.detail, 48) : null };
        });
        const description = addField(fields, "Descrição acessível", original.description, 300, true);
        let result;
        function updatePreview() {
            result = editing().revise(data, url, { title: title.value, caption: caption.value, description: description.value,
                nodes: nodes.map(node => ({ id: node.id, label: node.label.value, detail: node.detail?.value || "" })) });
            apply.disabled = Boolean(result.error);
            status.textContent = result.error || "As alterações só serão aplicadas ao confirmar.";
            status.dataset.error = result.error ? "true" : "false";
            preview.hidden = Boolean(result.error);
            if (!result.error) { preview.src = result.url; preview.alt = result.description; }
        }
        // Typing in the modal must not autosave the underlying lesson or draft.
        form.addEventListener("input", event => { event.stopPropagation(); updatePreview(); });
        form.addEventListener("change", event => event.stopPropagation());
        dialog.querySelector("[data-diagram-cancel]").addEventListener("click", () => dialog.close());
        form.addEventListener("submit", event => {
            event.preventDefault(); event.stopPropagation(); updatePreview();
            if (result.error) return;
            try {
                if (onApply(result) === false) throw new Error("O slide mudou enquanto a janela estava aberta. Feche e abra novamente.");
                dialog.close();
            } catch (error) {
                status.textContent = error.message || "Não foi possível aplicar as alterações.";
                status.dataset.error = "true";
            }
        });
        dialog.addEventListener("close", () => {
            activeDialog = null; dialog.remove();
            if (trigger?.isConnected) trigger.focus();
        }, { once: true });
        document.body.appendChild(dialog); activeDialog = dialog;
        updatePreview(); dialog.showModal(); title.focus();
        return true;
    }

    function refreshCard(card) {
        const { data, url } = editing().readCard(card);
        let toolbar = card.querySelector("[data-diagram-toolbar]");
        if (!toolbar) {
            toolbar = document.createElement("div"); toolbar.dataset.diagramToolbar = "";
            toolbar.className = "slide-diagram-toolbar";
            toolbar.innerHTML = '<button type="button" class="platform-link-button platform-link-secondary" data-edit-slide-diagram>Editar ilustração</button><small data-diagram-note></small>';
            const upload = card.querySelector("[data-open-resource]");
            if (upload) upload.before(toolbar); else card.appendChild(toolbar);
        }
        toolbar.hidden = !url.startsWith("data:image/svg+xml;");
        const editable = Boolean(editing().decode(data, url));
        toolbar.querySelector("button").hidden = !editable;
        const message = editable ? "Ajuste os textos do desenho, sem gastar créditos." : "Esta imagem não tem textos editáveis salvos. Você pode mantê-la ou enviar outra imagem.";
        const note = toolbar.querySelector("[data-diagram-note]");
        if (note.textContent !== message) note.textContent = message;
    }
    function bind() {
        const stack = document.querySelector("[data-slides-stack]");
        if (!stack || !editing()) return;
        const refresh = () => stack.querySelectorAll("[data-slide-card]").forEach(refreshCard);
        refresh();
        new MutationObserver(refresh).observe(stack, { childList: true, subtree: true });
        document.addEventListener("input", refresh);
        document.addEventListener("change", refresh);
        stack.addEventListener("click", event => {
            const trigger = event.target.closest("[data-edit-slide-diagram]");
            if (!trigger) return;
            const card = trigger.closest("[data-slide-card]");
            const before = editing().readCard(card);
            open({ ...before, trigger, onApply(result) {
                const current = editing().readCard(card);
                if (!card.isConnected || current.data !== before.data || current.url !== before.url) return false;
                if (!editing().writeCard(card, result)) return false;
                if (typeof dispatchBuilderContentChange === "function") {
                    dispatchBuilderContentChange("input", stack); dispatchBuilderContentChange("change", stack);
                }
                refresh();
                return true;
            } });
        });
    }
    // Do not retain a modal's unsaved contents after switching accounts.
    document.addEventListener("educaria-auth-changed", () => activeDialog?.close());
    document.addEventListener("DOMContentLoaded", bind);
    root.EducariaSlideDiagramEditor = Object.freeze({ open });
})(window);
