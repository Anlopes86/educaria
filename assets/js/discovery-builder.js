(function () {
    "use strict";
    const core = window.EducariaDiscovery;
    const type = document.body.dataset.materialType;
    const $ = selector => document.querySelector(selector);
    function read() {
        const stack = $("[data-discovery-items]");
        if (typeof persistMaterializedFields === "function") persistMaterializedFields(stack);
        return core.readDraft(type, { controls: { "discovery-title": $("#discovery-title").value, "discovery-subtitle": $("#discovery-subtitle").value, "discovery-show-clues": $("#discovery-show-clues")?.value }, stackHtml: stack.innerHTML }, DOMParser);
    }
    function preview() {
        const target = $("[data-discovery-preview]");
        try {
            const data = core.normalize(type, read());
            if (type === "wordtrail") {
                const boards = core.createBoards(data), board = boards[0];
                target.innerHTML = `<div class="discovery-mini-grid" style="--cols:${board.cols}">${board.cells.map(cell => `<span class="${cell ? "" : "blocked"}">${cell?.letter || ""}</span>`).join("")}</div><p>${data.words.length} palavras · ${boards.length} ${boards.length === 1 ? "tabuleiro" : "tabuleiros"} · ${data.showClues ? "com pistas" : "sem pistas"}. Prévia do primeiro tabuleiro.</p><p>O conteúdo é dividido para manter letras e pistas legíveis.</p>`;
            } else {
                target.innerHTML = `<div class="discovery-mini-clues">${data.rounds[0].clues.map((clue, i) => `<div><small>Pista ${i + 1}</small><strong>${core.escape(i ? "•••" : clue)}</strong></div>`).join("")}</div><p>${data.rounds.length} desafios · revele uma pista por vez.</p>`;
            }
            $("[data-discovery-validation]").textContent = "Pronto para apresentar. As respostas ficam ocultas no início.";
            $("[data-discovery-validation]").dataset.valid = "true";
        } catch (error) {
            target.innerHTML = `<div class="discovery-empty-preview"><span aria-hidden="true">${type === "wordtrail" ? "A → B" : "? + ?"}</span><h2>${core.labels[type]}</h2><p>Crie com IA ou preencha os campos ao lado para visualizar sua atividade.</p></div>`;
            $("[data-discovery-validation]").textContent = error.message;
            $("[data-discovery-validation]").dataset.valid = "false";
        }
    }
    function changed() {
        $("[data-discovery-items]").querySelectorAll("[data-discovery-item]").forEach((node, index) => {
            const label = `${type === "wordtrail" ? "Palavra" : "Desafio"} ${index + 1}`;
            node.querySelector("[data-discovery-label]").textContent = label;
            node.querySelector("[data-discovery-remove]").setAttribute("aria-label", `Remover ${label.toLowerCase()}`);
        });
        $("[data-discovery-items]").dispatchEvent(new Event("input", { bubbles: true }));
    }
    function blank() {
        return type === "wordtrail" ? { words: [{ term: "", clue: "" }] } : { rounds: [{ answer: "", clues: ["", "", ""], explanation: "" }] };
    }
    window.EducariaDiscoveryBuilder = {
        apply(materialType, payload) {
            if (materialType !== type) return false;
            const data = core.normalize(type, payload);
            $("#discovery-title").value = data.title;
            $("#discovery-subtitle").value = data.subtitle;
            if (type === "wordtrail") $("#discovery-show-clues").value = String(data.showClues);
            $("[data-discovery-items]").innerHTML = core.stackHtml(type, data);
            $("[data-discovery-manual]").open = true;
            changed();
            return true;
        }
    };
    document.addEventListener("DOMContentLoaded", () => {
        const stack = $("[data-discovery-items]");
        if (!stack.children.length) stack.innerHTML = core.stackHtml(type, blank(), true);
        $("[data-discovery-add]").addEventListener("click", () => {
            const maximum = type === "wordtrail" ? 12 : 8;
            if (stack.children.length >= maximum) { $("[data-discovery-validation]").textContent = `O limite é de ${maximum} itens.`; return; }
            stack.insertAdjacentHTML("beforeend", core.stackHtml(type, blank(), true));
            changed();
            stack.lastElementChild.querySelector("input").focus();
        });
        stack.addEventListener("click", event => {
            if (!event.target.closest("[data-discovery-remove]")) return;
            event.target.closest("[data-discovery-item]").remove();
            changed();
        });
        document.addEventListener("input", preview);
        document.addEventListener("change", preview);
        const syncMode = () => { $("#discovery-count").disabled = $("#discovery-input-mode").value === "words"; };
        $("#discovery-input-mode").addEventListener("change", syncMode);
        syncMode();
        $("[data-discovery-present]").addEventListener("click", event => {
            try {
                core.normalize(type, read());
                if (typeof saveBuilderState === "function" && saveBuilderState(builderConfig())?.saved === false) throw new Error("Não foi possível salvar neste navegador. Libere espaço antes de apresentar.");
            }
            catch (error) { event.preventDefault(); $("[data-discovery-validation]").textContent = error.message; $("[data-discovery-manual]").open = true; }
        });
        preview();
    });
})();
