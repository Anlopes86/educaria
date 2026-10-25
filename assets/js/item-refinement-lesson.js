// The lesson owns its block draft. Changes here never rewrite the source activity.
window.educariaLessonRefinementGroups = function () {
    const adapters = window.EducariaItemRefinementAdapters;
    return [...document.querySelectorAll("[data-refine-lesson-block]")].map(host => {
        const block = lessonSequenceState.blocks.find(block => block.id === host.dataset.refineLessonBlock);
        const type = block?.materialType || "slides", config = adapters.configs[type];
        if (!block || !config) return null;
        const parse = () => {
            const draft = parseLessonDraftState(effectiveDraftForBlock(block));
            const doc = new DOMParser().parseFromString(`<div>${draft.stackHtml || ""}</div>`, "text/html");
            return { draft, doc, nodes: [...doc.querySelectorAll(config.card)] };
        };
        return { type, host, cards: () => [...host.querySelectorAll("[data-refine-lesson-item]")],
            read(card) { const node = parse().nodes[Number(card.dataset.refineLessonItem)]; if (!node) return {}; return adapters.readCard(type, node); },
            context: () => ({ ...adapters.contextFromControls(config, parse().draft.controls), title: block.label || lessonSequenceState.title || "",
                description: String(lessonSequenceState.objective || "").slice(0, 1500) }),
            request: refinement => requestLessonAiMaterial(type, "", "Ajustar itens selecionados do bloco", refinement),
            commit(changes) {
                if (!lessonSequenceState.blocks.includes(block) || !host.isConnected) throw new Error("O bloco não está mais disponível.");
                const { draft, doc, nodes } = parse();
                // All edits occur in a detached draft before the single commit.
                for (const { card, patch } of changes) {
                    const node = nodes[Number(card.dataset.refineLessonItem)];
                    if (!node) throw new Error("Um item do bloco mudou.");
                    adapters.writeCard(type, node, patch);
                }
                doc.querySelectorAll("input, textarea, select").forEach(node => {
                    if (node.tagName === "TEXTAREA") node.textContent = node.value;
                    else if (node.tagName === "SELECT") [...node.options].forEach(option => option.toggleAttribute("selected", option.selected));
                    else node.setAttribute("value", node.value);
                });
                draft.stackHtml = doc.body.firstElementChild.innerHTML;
                // The debate player can prefer the structured steps over stackHtml.
                if (type === "debate") draft.steps = nodes.map((node, index) => ({ index, ...adapters.readCard(type, node) }));
                updateBlockDraftSnapshot(block, JSON.stringify(draft)); persistLessonSequence();
                for (const { card } of changes) {
                    const node = nodes[Number(card.dataset.refineLessonItem)];
                    card.querySelectorAll("[data-block-draft-field]").forEach(field => {
                        field.value = node.querySelectorAll(field.dataset.draftFieldSelector)[Number(field.dataset.draftFieldOccurrence || 0)]?.value || "";
                    });
                }
                refreshLessonSequencePanels(block.id);
            } };
    }).filter(Boolean);
};
