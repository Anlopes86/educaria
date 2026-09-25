const EDUCARIA_EDITOR_INITIAL_PARAMS = new URLSearchParams(window.location.search);
const EDUCARIA_EDITOR_IS_NEW = EDUCARIA_EDITOR_INITIAL_PARAMS.get("new") === "1";

if (EDUCARIA_EDITOR_IS_NEW) {
    const materialType = document.body?.dataset.materialType || "";
    const scopedKey = (key) => typeof educariaScopedKey === "function" ? educariaScopedKey(key) : key;
    try {
        if (materialType) localStorage.removeItem(scopedKey(`educaria:builder:${materialType}`));
        localStorage.removeItem(scopedKey("educaria:activeLessonId"));
    } catch (error) {
        console.warn("EducarIA new material state unavailable:", error);
    }

    const cleanParams = new URLSearchParams(EDUCARIA_EDITOR_INITIAL_PARAMS);
    cleanParams.delete("new");
    const cleanQuery = cleanParams.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`);
}

document.addEventListener("DOMContentLoaded", () => {
    const panes = document.querySelectorAll(".activity-builder-pane");
    const focus = EDUCARIA_EDITOR_INITIAL_PARAMS.get("focus") || "";
    const shouldFocusEdit = focus === "edit";
    const isNewMaterial = EDUCARIA_EDITOR_IS_NEW;

    function normalizeLabel(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function disclosureRole(disclosure) {
        const label = normalizeLabel(disclosure.querySelector(":scope > summary")?.textContent);
        if (label.includes("montar com ia")) return "ai";
        if (label.includes("arquivo modelo")) return "model";
        if (label.includes("tema visual") || label.includes("aparencia")) return "theme";
        if (label.includes("editar manualmente")) return "manual";
        return "extra";
    }

    function decorateDisclosure(disclosure) {
        const role = disclosureRole(disclosure);
        disclosure.dataset.disclosureRole = role;
        if (role !== "extra") {
            disclosure.classList.add(`editor-disclosure--${role}`);
        }

        if (role === "model") {
            const summary = disclosure.querySelector(":scope > summary");
            const label = [...(summary?.querySelectorAll("span") || [])]
                .filter((item) => normalizeLabel(item.textContent).includes("arquivo modelo"))
                .sort((left, right) => left.children.length - right.children.length)[0];
            if (label) label.textContent = "Importar arquivo modelo (opcional)";
        }

        return role;
    }

    function syncDisclosureExpandedState(disclosure) {
        const summary = disclosure.querySelector(":scope > summary");
        if (summary) {
            summary.setAttribute("aria-expanded", disclosure.open ? "true" : "false");
        }
    }

    function setStartMode(pane, mode) {
        pane.querySelectorAll("[data-builder-start-mode]").forEach((button) => {
            const isActive = button.dataset.builderStartMode === mode;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function openDisclosure(pane, target, options = {}) {
        if (!(target instanceof HTMLDetailsElement)) return;

        pane.querySelectorAll(".editor-disclosure").forEach((item) => {
            item.open = item === target;
            syncDisclosureExpandedState(item);
        });

        if (options.mode) setStartMode(pane, options.mode);

        requestAnimationFrame(() => {
            if (options.scroll) {
                target.scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                    block: "start"
                });
            }

            if (options.focusSelector) {
                window.setTimeout(() => target.querySelector(options.focusSelector)?.focus(), options.scroll ? 220 : 0);
            }
        });
    }

    function startPanelTemplate() {
        return `
            <section class="builder-start-panel" aria-labelledby="builder-start-title">
                <div class="builder-start-copy">
                    <span class="platform-section-label">Ponto de partida</span>
                    <h2 id="builder-start-title">Como você quer começar?</h2>
                    <p>A IA cria um rascunho. Depois, você pode revisar tudo antes de apresentar.</p>
                </div>
                <div class="builder-start-options" role="group" aria-label="Escolha como iniciar a atividade">
                    <button type="button" class="builder-start-option" data-builder-start-mode="topic" aria-pressed="false">
                        <span class="builder-start-option-icon" aria-hidden="true">✦</span>
                        <strong>Criar com IA</strong>
                        <small>Digite o assunto ou cole um texto.</small>
                    </button>
                    <button type="button" class="builder-start-option" data-builder-start-mode="file" aria-pressed="false">
                        <span class="builder-start-option-icon" aria-hidden="true">↑</span>
                        <strong>Enviar conteúdo</strong>
                        <small>Use seu arquivo como fonte da atividade.</small>
                    </button>
                    <button type="button" class="builder-start-option" data-builder-start-mode="manual" aria-pressed="false">
                        <span class="builder-start-option-icon" aria-hidden="true">✎</span>
                        <strong>Começar do zero</strong>
                        <small>Edite cada parte manualmente.</small>
                    </button>
                </div>
            </section>
        `;
    }

    function injectStartPanel(pane, aiDisclosure, manualDisclosure) {
        if (!aiDisclosure || !manualDisclosure || pane.querySelector(".builder-start-panel")) return;
        pane.insertAdjacentHTML("afterbegin", startPanelTemplate());

        pane.querySelector("[data-builder-start-mode=\"topic\"]")?.addEventListener("click", () => {
            openDisclosure(pane, aiDisclosure, {
                mode: "topic",
                scroll: true,
                focusSelector: 'textarea[id$="-fonte-texto"], textarea'
            });
        });

        pane.querySelector("[data-builder-start-mode=\"file\"]")?.addEventListener("click", () => {
            openDisclosure(pane, aiDisclosure, {
                mode: "file",
                scroll: true,
                focusSelector: 'input[type="file"]'
            });
        });

        pane.querySelector("[data-builder-start-mode=\"manual\"]")?.addEventListener("click", () => {
            openDisclosure(pane, manualDisclosure, {
                mode: "manual",
                scroll: true,
                focusSelector: 'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
            });
        });

        aiDisclosure.querySelector('textarea[id$="-fonte-texto"], textarea')?.addEventListener("focus", () => setStartMode(pane, "topic"));
        aiDisclosure.querySelector('input[type="file"]')?.addEventListener("focus", () => setStartMode(pane, "file"));
    }

    panes.forEach((pane) => {
        const disclosures = [...pane.querySelectorAll(".editor-disclosure")];
        disclosures.forEach(decorateDisclosure);

        const aiDisclosure = disclosures.find((item) => item.dataset.disclosureRole === "ai");
        const manualDisclosure = disclosures.find((item) => item.dataset.disclosureRole === "manual");
        injectStartPanel(pane, aiDisclosure, manualDisclosure);

        disclosures.forEach((item) => {
            item.open = false;
            syncDisclosureExpandedState(item);
        });

        const materialType = document.body?.dataset.materialType || "";
        const activeLesson = typeof readActiveLesson === "function" ? readActiveLesson() : null;
        const isEditingSavedMaterial = activeLesson?.materialType === materialType;

        if ((shouldFocusEdit || isEditingSavedMaterial) && manualDisclosure) {
            openDisclosure(pane, manualDisclosure, { mode: "manual" });
            requestAnimationFrame(() => {
                if (shouldFocusEdit) {
                    manualDisclosure.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        } else if ((isNewMaterial || !isEditingSavedMaterial) && aiDisclosure) {
            openDisclosure(pane, aiDisclosure, { mode: "topic" });
        } else {
            const defaultDisclosure = pane.querySelector('.editor-disclosure[data-disclosure-default]');
            if (defaultDisclosure instanceof HTMLDetailsElement) {
                openDisclosure(pane, defaultDisclosure, {
                    mode: defaultDisclosure === manualDisclosure ? "manual" : ""
                });
            }
        }

        pane.addEventListener(
            "toggle",
            (event) => {
                const current = event.target;
                const savedScrollY = Number(pane.dataset.disclosureScrollY || window.scrollY || 0);

                if (!(current instanceof HTMLDetailsElement)) {
                    return;
                }

                if (!current.classList.contains("editor-disclosure")) {
                    return;
                }

                syncDisclosureExpandedState(current);

                if (!current.open) {
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: savedScrollY, behavior: "auto" });
                    });
                    return;
                }

                pane.querySelectorAll(".editor-disclosure").forEach((item) => {
                    if (item !== current) {
                        item.open = false;
                        syncDisclosureExpandedState(item);
                    }
                });

                if (current.dataset.disclosureRole === "manual") setStartMode(pane, "manual");
                if (current.dataset.disclosureRole === "ai" && !pane.querySelector("[data-builder-start-mode].is-active")) {
                    setStartMode(pane, "topic");
                }

                requestAnimationFrame(() => {
                    window.scrollTo({ top: savedScrollY, behavior: "auto" });
                });
            },
            true
        );

        pane.addEventListener(
            "click",
            (event) => {
                const summary = event.target instanceof Element ? event.target.closest(".editor-disclosure > summary") : null;
                if (!summary) return;
                pane.dataset.disclosureScrollY = String(window.scrollY || 0);
            },
            true
        );

        document.addEventListener("educaria-material-generated", () => {
            if (!manualDisclosure) return;
            openDisclosure(pane, manualDisclosure, { mode: "manual" });
        });
    });
});
