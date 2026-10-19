(() => {
    "use strict";
    const core = window.EducariaWorksheet, view = window.EducariaWorksheetView;
    const $ = selector => document.querySelector(selector);
    const owner = typeof readCurrentTeacher === "function" ? readCurrentTeacher()?.uid || "" : "";
    const isOwner = () => owner && readCurrentTeacher()?.uid === owner;
    let mode = "student", timer = 0, valid = false;
    const engines = { discovery: window.EducariaDiscovery, wordsearch: window.EducarIAWordsearch, crossword: window.EducarIACrossword };
    function read() {
        const stack = $("[data-worksheet-items]");
        persistMaterializedFields(stack);
        return core.readDraft({ controls: { "worksheet-title": $("#worksheet-title").value, "worksheet-subtitle": $("#worksheet-subtitle").value }, stackHtml: stack.innerHTML }, DOMParser);
    }
    function settings() {
        return { school: $("#worksheet-school").value, className: $("#worksheet-class-name").value, trailClues: $("#worksheet-trail-clues").value === "true", wordBank: $("#worksheet-word-bank").value === "true" };
    }
    function changed() { $("[data-worksheet-items]").dispatchEvent(new Event("input", { bubbles: true })); }
    function syncSelection(restore = false) {
        if (restore) {
            try { const selected = core.selection(JSON.parse($("#worksheet-selected-types").value)); document.querySelectorAll("[data-ws-select]").forEach(node => { node.checked = selected.includes(node.dataset.wsSelect); }); }
            catch { /* An invalid saved selection is corrected by the next edit. */ }
        }
        $("#worksheet-selected-types").value = JSON.stringify([...document.querySelectorAll("[data-ws-select]:checked")].map(node => node.dataset.wsSelect));
    }
    function sourceHelp() {
        const result = window.EducariaDiscoveryInput.resolve($("#worksheet-source").value, $("#worksheet-input-mode").value);
        $("[data-worksheet-source-help]").textContent = result.mode === "words"
            ? `${result.answers.length} palavras exatas: ${result.answers.join(" · ")}. A lista será preservada em cada atividade selecionada. Isso pode ocupar mais de uma página.`
            : "A IA criará os exercícios a partir do tema ou conteúdo informado, no idioma que você pedir.";
    }
    function fitPreview() {
        const host = $("[data-worksheet-pages]"), width = 210 * 96 / 25.4, height = 297 * 96 / 25.4;
        const scale = Math.min(1, Math.max(.15, host.clientWidth / width));
        host.querySelectorAll(".worksheet-page-wrap").forEach(wrap => { wrap.style.width = `${width * scale}px`; wrap.style.height = `${height * scale}px`; wrap.firstElementChild.style.transform = `scale(${scale})`; });
    }
    function paginate(data, blocks, config) {
        const host = $("[data-worksheet-pages]"); host.replaceChildren();
        let body;
        const page = () => {
            const wrap = document.createElement("div"); wrap.className = "worksheet-page-wrap";
            wrap.innerHTML = `<section class="worksheet-sheet">${view.pageHeader(data, config, mode === "answers")}<div class="worksheet-body"></div><footer><span>${mode === "answers" ? "Gabarito · uso do professor" : "EducarIA · Atividades para aprender"}</span><span data-ws-page-number></span></footer></section>`;
            host.append(wrap); body = wrap.querySelector(".worksheet-body"); return body;
        };
        page();
        const queue = blocks.slice();
        while (queue.length) {
            const row = document.createElement("div"); row.className = "worksheet-print-row";
            const first = queue.shift(), second = queue.shift();
            row.innerHTML = first + (second || ""); body.append(row);
            if (row.querySelector(".worksheet-grid-wide") || row.offsetHeight > body.clientHeight) {
                if (second) { queue.unshift(second); row.lastElementChild.remove(); }
                if (row.querySelector(".worksheet-grid-wide") || row.offsetHeight > body.clientHeight) row.classList.add("is-wide");
            }
            if (row.offsetHeight > body.clientHeight + 1) throw new Error("Um exercício ficou maior que uma página. Encurte as pistas ou remova alguns itens antes de imprimir.");
            if (body.scrollHeight > body.clientHeight + 1 && body.children.length > 1) { row.remove(); page().append(row); }
            if (body.scrollHeight > body.clientHeight + 1) throw new Error("O cabeçalho e o exercício não cabem nesta página. Reduza o texto antes de imprimir.");
        }
        const count = host.children.length;
        host.querySelectorAll("[data-ws-page-number]").forEach((node, i) => { node.textContent = `${i + 1} / ${count}`; });
        $("[data-worksheet-page-count]").textContent = `${count} ${count === 1 ? "página" : "páginas"} · ${mode === "answers" ? "Gabarito" : "Folha do aluno"}`;
        fitPreview(); return count;
    }
    function render() {
        clearTimeout(timer); valid = false;
        const feedback = $("[data-worksheet-validation]"), host = $("[data-worksheet-pages]");
        try {
            if (!isOwner()) throw new Error("Entre na sua conta para preparar a folha.");
            const data = core.normalize(read()), config = settings();
            const result = view.units(data, engines, mode === "answers", config);
            const pages = paginate(data, result.units, config);
            feedback.textContent = [...result.notices, pages > 1 && $("#worksheet-page-mode").value === "compact" ? "O conteúdo precisou de mais páginas para manter a leitura e o espaço de resposta. Nenhum exercício foi cortado." : "Pronta para revisar. O gabarito é impresso separadamente."].join(" ");
            valid = true;
        } catch (error) {
            feedback.textContent = error.message;
            host.innerHTML = '<div class="worksheet-empty"><span aria-hidden="true">▤</span><h2>Prepare sua folha</h2><p>Gere com IA ou complete os exercícios no editor. A prévia aparece aqui quando o conteúdo estiver pronto.</p></div>';
            $("[data-worksheet-page-count]").textContent = "Prévia aguardando conteúdo";
        }
        feedback.dataset.valid = String(valid);
        document.querySelectorAll("[data-worksheet-print]").forEach(button => { button.disabled = !valid; });
        document.querySelectorAll("[data-worksheet-preview-mode]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.worksheetPreviewMode === mode)));
        return valid;
    }
    function generationOptions() {
        syncSelection();
        return { worksheetTypes: core.selection(JSON.parse($("#worksheet-selected-types").value)), pageMode: $("#worksheet-page-mode").value, difficulty: $("#worksheet-difficulty").value };
    }
    function apply(payload) {
        if (!isOwner()) throw new Error("A conta foi alterada. Entre novamente antes de abrir o resultado.");
        const data = core.normalize(payload);
        $("#worksheet-title").value = data.title; $("#worksheet-subtitle").value = data.subtitle;
        $("[data-worksheet-items]").innerHTML = core.stackHtml(data);
        $("#worksheet-selected-types").value = JSON.stringify(data.order); syncSelection(true);
        mode = "student";
        changed(); render();
        $("[data-worksheet-generation-status]").textContent = "Folha gerada. Revise o conteúdo e a prévia antes de imprimir.";
        $(".worksheet-preview").focus({ preventScroll: true });
        $(".worksheet-preview").scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
    }
    window.EducariaWorksheetBuilder = Object.freeze({ apply, generationOptions, read, render });
    document.addEventListener("DOMContentLoaded", () => {
        syncSelection(true); sourceHelp();
        const stack = $("[data-worksheet-items]");
        $("[data-worksheet-blank]").addEventListener("click", () => {
            const data = read();
            try {
                for (const type of generationOptions().worksheetTypes) if (!data.order.includes(type)) { data.order.push(type); data.activities[type] = core.blankActivity(type); }
                stack.innerHTML = core.stackHtml(data); changed();
            } catch (error) { $("[data-worksheet-generation-status]").textContent = error.message; }
        });
        stack.addEventListener("click", event => {
            const button = event.target.closest("button"), section = button?.closest("[data-worksheet-activity]");
            if (!section) return;
            if (button.hasAttribute("data-ws-move")) {
                const neighbor = Number(button.dataset.wsMove) < 0 ? section.previousElementSibling : section.nextElementSibling;
                if (neighbor) { if (Number(button.dataset.wsMove) < 0) stack.insertBefore(section, neighbor); else stack.insertBefore(neighbor, section); }
            } else if (button.hasAttribute("data-ws-remove")) section.remove();
            else if (button.hasAttribute("data-ws-remove-item")) button.closest(".worksheet-edit-item").remove();
            else if (button.hasAttribute("data-ws-add-item")) {
                const data = read(), type = section.dataset.worksheetActivity, key = type === "connections" ? "rounds" : "words";
                if (data.activities[type][key].length >= 8) { $("[data-worksheet-validation]").textContent = "O limite é de 8 itens por atividade."; return; }
                data.activities[type][key].push(core.blankActivity(type)[key][0]); stack.innerHTML = core.stackHtml(data);
            }
            changed();
        });
        document.addEventListener("input", event => { if (event.target.matches?.("#worksheet-source")) sourceHelp(); clearTimeout(timer); timer = setTimeout(render, 160); });
        document.addEventListener("change", event => { if (event.target.matches("[data-ws-select]")) syncSelection(); sourceHelp(); render(); });
        document.querySelectorAll("[data-worksheet-preview-mode]").forEach(button => button.addEventListener("click", () => { mode = button.dataset.worksheetPreviewMode; render(); }));
        document.querySelectorAll("[data-worksheet-print]").forEach(button => button.addEventListener("click", async () => {
            mode = button.dataset.worksheetPrint; await document.fonts.ready;
            if (!render()) return;
            if (saveBuilderState(builderConfig())?.saved === false) { $("[data-worksheet-validation]").textContent = "Não foi possível guardar o rascunho neste navegador. A impressão continua disponível; salve seu PDF para não perder o material."; }
            await new Promise(resolve => requestAnimationFrame(resolve)); window.print();
        }));
        window.addEventListener("beforeprint", render);
        document.addEventListener("educaria-auth-changed", () => { if (!isOwner()) { stack.replaceChildren(); render(); } });
        new ResizeObserver(fitPreview).observe($("[data-worksheet-pages]"));
        void document.fonts.ready.then(render);
    });
})();
