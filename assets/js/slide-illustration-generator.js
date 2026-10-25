(function (root) {
    "use strict";
    const uid = () => root.educariaGenerationRecovery?.currentUid() || "";
    const editing = () => root.EducariaSlideDiagramEditing;
    const value = (card, name) => card.querySelector(`[data-field="${name}"]`)?.value || "";
    const snapshot = card => JSON.stringify([...card.querySelectorAll("[data-field]")].map(field => [field.dataset.field, field.value]));
    let activeDialog, pending = false;

    function refresh() {
        document.querySelectorAll("[data-slides-stack] [data-slide-card]").forEach((card, index) => {
            const upload = card.querySelector("[data-open-resource]");
            if (!upload) return;
            const summary = upload.closest(".activity-optional-disclosure")?.querySelector("summary");
            if (summary && summary.textContent !== "Imagem e ilustração") summary.textContent = "Imagem e ilustração";
            let trigger = card.querySelector("[data-generate-slide-illustration]");
            if (!trigger) {
                trigger = document.createElement("button"); trigger.type = "button";
                trigger.className = "platform-link-button platform-link-secondary";
                trigger.dataset.generateSlideIllustration = "";
                trigger.textContent = "Gerar ilustração com IA"; upload.after(trigger);
            }
            trigger.disabled = pending;
            trigger.setAttribute("aria-label", `Gerar ilustração com IA para o slide ${index + 1}`);
        });
    }

    function open(card, trigger, stack) {
        if (activeDialog || pending || !editing()) return;
        const owner = uid(), index = [...stack.querySelectorAll("[data-slide-card]")].indexOf(card);
        const before = snapshot(card);
        const request = { title: value(card, "slide-title"), subtitle: value(card, "slide-subtitle"), body: value(card, "slide-body"),
            audience: document.getElementById("slides-publico")?.value || "" };
        const theme = { accent: value(card, "slide-accent-color") };
        const dialog = document.createElement("dialog");
        dialog.className = "slide-diagram-dialog"; dialog.setAttribute("aria-labelledby", "slide-illustration-title");
        dialog.innerHTML = `<form class="slide-diagram-editor slide-illustration-generator">
            <header><h2 id="slide-illustration-title">Gerar ilustração com IA</h2><p data-illustration-context></p></header>
            <div class="slide-diagram-editor-body">
                <div class="slide-diagram-editor-fields">
                    <label class="platform-field"><span>Orientação para a ilustração (opcional)</span>
                        <textarea data-illustration-instruction rows="4" maxlength="1000" placeholder="Ex.: mostre as etapas em sequência ou compare os dois conceitos."></textarea></label>
                    <p>Cria diagramas e símbolos editáveis a partir deste slide.</p>
                    <p class="slide-illustration-credit-note">Usa créditos conforme o consumo, mesmo se você não aplicar a sugestão.</p>
                </div>
                <aside class="slide-diagram-editor-preview"><strong>Prévia</strong><img data-illustration-preview hidden alt="">
                    <p data-illustration-status role="status" aria-live="polite">A imagem atual só será substituída ao clicar em “Usar ilustração”.</p></aside>
            </div>
            <footer><button type="button" data-illustration-cancel class="platform-link-button platform-link-secondary">Cancelar</button>
                <button type="submit" data-illustration-generate class="platform-link-button platform-link-primary">Gerar ilustração</button>
                <button type="button" data-illustration-apply class="platform-link-button platform-link-primary" hidden>Usar ilustração</button></footer>
        </form>`;
        dialog.querySelector("[data-illustration-context]").textContent = `Slide ${index + 1}${request.title ? ` · ${request.title}` : ""}`;
        const form = dialog.querySelector("form"), instruction = dialog.querySelector("textarea"), preview = dialog.querySelector("img");
        const generate = dialog.querySelector("[data-illustration-generate]"), apply = dialog.querySelector("[data-illustration-apply]");
        const status = dialog.querySelector("[data-illustration-status]");
        let result = null;
        const current = () => dialog.isConnected && dialog.open && owner && owner === uid() && card.isConnected
            && stack.querySelectorAll("[data-slide-card]")[index] === card && snapshot(card) === before;
        function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
        function reset() {
            result = null; preview.hidden = true; preview.removeAttribute("src"); apply.hidden = true;
            generate.textContent = "Gerar ilustração"; generate.classList.replace("platform-link-secondary", "platform-link-primary");
        }
        form.addEventListener("input", event => { event.stopPropagation(); reset(); message("Clique em gerar para usar a nova orientação."); });
        form.addEventListener("change", event => event.stopPropagation());
        dialog.querySelector("[data-illustration-cancel]").addEventListener("click", () => dialog.close());
        form.addEventListener("submit", async event => {
            event.preventDefault(); event.stopPropagation();
            if (pending) return;
            if (!current()) { message("O slide ou a conta mudou. Feche e abra a geração novamente.", true); return; }
            if (card.querySelector("[data-upload-input]")?.disabled) { message("Aguarde a imagem enviada terminar de carregar.", true); return; }
            const content = { ...request, instruction: instruction.value.trim() };
            if (![content.title, content.subtitle, content.body, content.instruction].some(text => text.trim())) {
                message("Escreva o conteúdo do slide ou descreva a ilustração desejada.", true); instruction.focus(); return;
            }
            reset(); pending = true; generate.disabled = true; instruction.disabled = true;
            form.setAttribute("aria-busy", "true"); refresh(); message("Criando a ilustração deste slide…");
            try {
                const payload = await requestStructuredMaterial("slides", "", null, "Ilustrar apenas o slide selecionado", undefined, undefined, undefined, content);
                if (!dialog.isConnected || !dialog.open || owner !== uid()) return;
                if (!current()) throw new Error("O slide mudou durante a geração. Sua imagem foi preservada; abra a geração novamente.");
                if (payload?.operation !== "illustrate-slide" || payload.materialType !== "slides") throw new Error("O serviço não retornou a ilustração deste slide. Atualize a página e tente novamente.");
                const illustration = payload.material?.illustration;
                const image = root.EducariaSlideIllustrations?.render(illustration, theme);
                const data = image && editing().encode(illustration, image.url, theme);
                if (!data) throw new Error("A ilustração não ficou legível. Tente uma orientação mais simples; sua imagem foi preservada.");
                result = { ...image, data }; preview.src = result.url; preview.alt = result.description; preview.hidden = false;
                apply.hidden = false;
                generate.textContent = "Gerar outra"; generate.classList.replace("platform-link-primary", "platform-link-secondary");
                const cost = Number(payload.charge?.cost);
                message(`Confira a ilustração antes de aplicar.${Number.isFinite(cost) ? ` Consumo: ${cost} crédito${cost === 1 ? "" : "s"}.` : ""}`);
                apply.focus({ preventScroll: true });
            } catch (error) {
                if (dialog.open && owner === uid()) message(error instanceof TypeError ? "Não foi possível conectar à IA. Tente novamente." : error.message, true);
            } finally {
                pending = false; generate.disabled = false; instruction.disabled = false;
                form.removeAttribute("aria-busy"); refresh();
            }
        });
        apply.addEventListener("click", () => {
            if (!result || !current()) { message("O slide ou a conta mudou. Sua imagem foi preservada; abra a geração novamente.", true); return; }
            if (!editing().writeCard(card, result)) { message("Não foi possível aplicar a ilustração.", true); return; }
            editing().writeField(card, "slide-layout", "Lado a lado");
            const uploadPanel = card.querySelector("[data-image-panel]"); if (uploadPanel) uploadPanel.hidden = true;
            if (typeof dispatchBuilderContentChange === "function") {
                dispatchBuilderContentChange("input", stack); dispatchBuilderContentChange("change", stack);
            }
            dialog.close();
        });
        dialog.addEventListener("close", () => {
            activeDialog = null; preview.removeAttribute("src"); dialog.remove();
            if (trigger.isConnected) trigger.focus();
        }, { once: true });
        document.body.append(dialog); activeDialog = dialog; dialog.showModal(); instruction.focus();
    }

    document.addEventListener("educaria-auth-changed", () => activeDialog?.close());
    document.addEventListener("DOMContentLoaded", () => {
        const stack = document.querySelector("[data-slides-stack]");
        if (!stack) return;
        refresh(); new MutationObserver(refresh).observe(stack, { childList: true, subtree: true });
        stack.addEventListener("click", event => {
            const trigger = event.target.closest("[data-generate-slide-illustration]");
            if (!trigger) return;
            event.preventDefault(); open(trigger.closest("[data-slide-card]"), trigger, stack);
        });
    });
})(window);
