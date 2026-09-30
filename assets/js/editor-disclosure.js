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
    const navigatorLabels = {
        quiz: ["questão", "questões"],
        slides: ["slide", "slides"],
        flashcards: ["card", "cards"],
        memory: ["par", "pares"],
        wheel: ["opção", "opções"],
        match: ["par", "pares"],
        mindmap: ["tópico", "tópicos"],
        debate: ["etapa", "etapas"],
        wordsearch: ["palavra", "palavras"],
        crossword: ["entrada", "entradas"],
        hangman: ["palavra", "palavras"]
    };

    function injectEditorJourney() {
        const context = document.querySelector(".activity-editor-context");
        if (!context || context.querySelector("[data-editor-journey]")) return;

        const materialType = document.body?.dataset.materialType || "";
        const activeLesson = typeof readActiveLesson === "function" ? readActiveLesson() : null;
        const isReviewing = shouldFocusEdit || activeLesson?.materialType === materialType;

        const journey = document.createElement("aside");
        journey.className = "editor-journey";
        journey.dataset.editorJourney = "";
        journey.setAttribute("aria-label", "Etapas para preparar a atividade");
        journey.innerHTML = `
            <div class="editor-journey__head">
                <strong>Seu caminho até a sala</strong>
                <span>Etapa de edição</span>
            </div>
            <ol>
                <li class="${isReviewing ? "is-done" : "is-current"}"${isReviewing ? "" : ' aria-current="step"'}>
                    <span class="editor-journey__number" aria-hidden="true">${isReviewing ? "✓" : "1"}</span>
                    <span class="editor-journey__copy">
                        <strong>Prepare o conteúdo</strong>
                        <small>Use um tema, texto ou arquivo.</small>
                    </span>
                    <span class="editor-journey__state">${isReviewing ? "Base" : "Agora"}</span>
                </li>
                <li${isReviewing ? ' class="is-current" aria-current="step"' : ""}>
                    <span class="editor-journey__number" aria-hidden="true">2</span>
                    <span class="editor-journey__copy">
                        <strong>Revise e personalize</strong>
                        <small>Confira a prévia enquanto ajusta.</small>
                    </span>
                    <span class="editor-journey__state">${isReviewing ? "Agora" : "Depois"}</span>
                </li>
                <li>
                    <span class="editor-journey__number" aria-hidden="true">3</span>
                    <span class="editor-journey__copy">
                        <strong>Salve ou apresente</strong>
                        <small>Leve a atividade pronta para a sala.</small>
                    </span>
                    <span class="editor-journey__state">Depois</span>
                </li>
            </ol>
        `;
        context.appendChild(journey);
    }

    function markEditorJourneyAsReviewing() {
        const items = document.querySelectorAll("[data-editor-journey] li");
        if (items.length < 2) return;

        items[0].classList.remove("is-current");
        items[0].classList.add("is-done");
        items[0].removeAttribute("aria-current");
        const firstNumber = items[0].querySelector(".editor-journey__number");
        const firstState = items[0].querySelector(".editor-journey__state");
        if (firstNumber) firstNumber.textContent = "✓";
        if (firstState) firstState.textContent = "Base";

        items[1].classList.add("is-current");
        items[1].setAttribute("aria-current", "step");
        const secondState = items[1].querySelector(".editor-journey__state");
        if (secondState) secondState.textContent = "Agora";
    }

    injectEditorJourney();

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

    function scrollEditorElement(element, behavior = "smooth") {
        if (!(element instanceof Element)) return;
        const top = Math.max(0, element.getBoundingClientRect().top + window.scrollY - 14);
        window.scrollTo({ top, left: 0, behavior });
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
        if (target.dataset.disclosureRole === "manual") markEditorJourneyAsReviewing();

        requestAnimationFrame(() => {
            if (options.scroll) {
                scrollEditorElement(
                    target,
                    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
                );
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

    function navigatorItemPreview(card) {
        const fields = [...card.querySelectorAll("textarea, input")].filter((field) => {
            const type = String(field.getAttribute("type") || "text").toLowerCase();
            return !["hidden", "color", "file", "button", "submit", "checkbox", "radio"].includes(type);
        });
        const content = fields
            .map((field) => String(field.value || "").replace(/\s+/g, " ").trim())
            .find(Boolean);

        if (!content) return "Ainda sem conteúdo";
        return content.length > 52 ? `${content.slice(0, 49).trimEnd()}…` : content;
    }

    function createItemNavigator(pane, manualDisclosure) {
        const stack = manualDisclosure?.querySelector(".activity-card-stack");
        if (!stack || pane.querySelector("[data-builder-item-navigator]")) return null;

        const materialType = document.body?.dataset.materialType || "";
        const labels = navigatorLabels[materialType] || ["item", "itens"];
        const navigator = document.createElement("nav");
        navigator.className = "builder-item-navigator";
        navigator.dataset.builderItemNavigator = "";
        navigator.setAttribute("aria-label", "Navegar pelos itens da atividade");
        navigator.innerHTML = `
            <div class="builder-item-navigator-head">
                <div>
                    <strong>Navegue pelo conteúdo</strong>
                    <span data-builder-item-count></span>
                </div>
                <small>Clique para ir direto</small>
            </div>
            <div class="builder-item-navigator-track" data-builder-item-track></div>
        `;
        manualDisclosure.before(navigator);

        const track = navigator.querySelector("[data-builder-item-track]");
        const count = navigator.querySelector("[data-builder-item-count]");
        let cards = [];
        let activeCard = null;
        let renderFrame = 0;
        let scrollFrame = 0;
        let activeScrollLockUntil = 0;

        function cardLabel(card, index) {
            const label = String(card.querySelector(".platform-section-label")?.textContent || "").replace(/\s+/g, " ").trim();
            return label || `${labels[0].charAt(0).toUpperCase()}${labels[0].slice(1)} ${index + 1}`;
        }

        function setActiveCard(card) {
            if (!card || !cards.includes(card)) return;
            activeCard = card;
            let activeButton = null;
            navigator.querySelectorAll("[data-builder-item-target]").forEach((button) => {
                const isActive = button.dataset.builderItemTarget === card.id;
                button.classList.toggle("is-active", isActive);
                if (isActive) {
                    activeButton = button;
                    button.setAttribute("aria-current", "true");
                } else {
                    button.removeAttribute("aria-current");
                }
            });

            if (activeButton) {
                const buttonLeft = activeButton.offsetLeft;
                const buttonRight = buttonLeft + activeButton.offsetWidth;
                const visibleLeft = track.scrollLeft;
                const visibleRight = visibleLeft + track.clientWidth;
                if (buttonLeft < visibleLeft || buttonRight > visibleRight) {
                    track.scrollTo({
                        left: Math.max(0, buttonLeft - (track.clientWidth - activeButton.offsetWidth) / 2),
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
                    });
                }
            }
        }

        function renderNavigator() {
            renderFrame = 0;
            cards = [...stack.children].filter((item) => item.classList?.contains("activity-content-card"));
            navigator.hidden = !manualDisclosure.open || cards.length === 0;
            count.textContent = `${cards.length} ${cards.length === 1 ? labels[0] : labels[1]}`;
            const savedScrollLeft = track.scrollLeft;
            track.replaceChildren();

            if (!cards.includes(activeCard)) activeCard = cards[0] || null;

            cards.forEach((card, index) => {
                card.id = `builder-item-${materialType || "activity"}-${index + 1}`;
                const label = cardLabel(card, index);
                const preview = navigatorItemPreview(card);
                const button = document.createElement("button");
                button.type = "button";
                button.className = "builder-item-navigator-button";
                button.dataset.builderItemTarget = card.id;
                button.setAttribute("aria-label", `Ir para ${label}: ${preview}`);

                const number = document.createElement("span");
                number.className = "builder-item-navigator-number";
                number.setAttribute("aria-hidden", "true");
                number.textContent = String(index + 1).padStart(2, "0");

                const copy = document.createElement("span");
                copy.className = "builder-item-navigator-copy";
                const title = document.createElement("strong");
                title.textContent = label;
                const summary = document.createElement("small");
                summary.textContent = preview;
                copy.append(title, summary);
                button.append(number, copy);
                button.addEventListener("click", () => {
                    activeScrollLockUntil = Date.now() + 760;
                    setActiveCard(card);
                    scrollEditorElement(
                        card,
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
                    );
                    window.setTimeout(() => {
                        card.querySelector("textarea, input:not([type='hidden']), select")?.focus({ preventScroll: true });
                    }, 240);
                });
                track.appendChild(button);
            });

            track.scrollLeft = savedScrollLeft;
            if (activeCard) setActiveCard(activeCard);
        }

        function scheduleRender() {
            if (renderFrame) window.cancelAnimationFrame(renderFrame);
            renderFrame = window.requestAnimationFrame(renderNavigator);
        }

        function updateActiveFromScroll() {
            scrollFrame = 0;
            if (Date.now() < activeScrollLockUntil) return;
            if (navigator.hidden || !cards.length) return;
            const referenceTop = navigator.getBoundingClientRect().bottom + 16;
            const nextCard = cards
                .filter((card) => card.getBoundingClientRect().bottom > referenceTop)
                .sort((left, right) => (
                    Math.abs(left.getBoundingClientRect().top - referenceTop)
                    - Math.abs(right.getBoundingClientRect().top - referenceTop)
                ))[0] || cards[cards.length - 1];
            setActiveCard(nextCard);
        }

        const mutationObserver = new MutationObserver(scheduleRender);
        mutationObserver.observe(stack, { childList: true, subtree: true });
        stack.addEventListener("input", scheduleRender);
        stack.addEventListener("focusin", (event) => {
            const card = event.target instanceof Element ? event.target.closest(".activity-content-card") : null;
            if (card) setActiveCard(card);
        });
        window.addEventListener("scroll", () => {
            if (scrollFrame) return;
            scrollFrame = window.requestAnimationFrame(updateActiveFromScroll);
        }, { passive: true });
        track.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            const buttons = [...track.querySelectorAll("button")];
            const currentIndex = buttons.indexOf(document.activeElement);
            let nextIndex = currentIndex;
            if (event.key === "ArrowRight") nextIndex = Math.min(buttons.length - 1, currentIndex + 1);
            if (event.key === "ArrowLeft") nextIndex = Math.max(0, currentIndex - 1);
            if (event.key === "Home") nextIndex = 0;
            if (event.key === "End") nextIndex = buttons.length - 1;
            if (buttons[nextIndex]) {
                event.preventDefault();
                buttons[nextIndex].focus();
            }
        });

        renderNavigator();
        return { navigator, render: scheduleRender };
    }

    panes.forEach((pane) => {
        const disclosures = [...pane.querySelectorAll(".editor-disclosure")];
        disclosures.forEach(decorateDisclosure);

        const aiDisclosure = disclosures.find((item) => item.dataset.disclosureRole === "ai");
        const manualDisclosure = disclosures.find((item) => item.dataset.disclosureRole === "manual");
        injectStartPanel(pane, aiDisclosure, manualDisclosure);
        const itemNavigator = createItemNavigator(pane, manualDisclosure);

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
                    scrollEditorElement(
                        manualDisclosure,
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
                    );
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
                if (current === manualDisclosure && itemNavigator) {
                    itemNavigator.render();
                }

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
                if (current.dataset.disclosureRole === "manual") markEditorJourneyAsReviewing();
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
