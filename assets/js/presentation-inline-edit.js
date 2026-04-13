function readInlineEditableValue(node, multiline = false) {
    const rawValue = multiline ? node.innerText : node.textContent;
    const text = String(rawValue ?? "").replace(/\r/g, "").replace(/\u00a0/g, " ");

    if (multiline) {
        return text
            .split("\n")
            .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
            .join("\n")
            .trim();
    }

    return text.replace(/\s+/g, " ").trim();
}

function createPresentationInlineEditController(config = {}) {
    const bodyClass = config.bodyClass || "presentation-inline-editing";
    const toggleSelector = config.toggleSelector || "[data-inline-edit-toggle]";
    const noteSelector = config.noteSelector || "[data-inline-edit-note]";
    const editableSelector = config.editableSelector || "[data-inline-editable]";
    let enabled = false;

    const syncUi = () => {
        document.body.classList.toggle(bodyClass, enabled);

        document.querySelectorAll(toggleSelector).forEach((button) => {
            button.setAttribute("aria-pressed", String(enabled));
            button.textContent = enabled ? "Concluir edição" : "Editar aqui";
        });

        document.querySelectorAll(noteSelector).forEach((note) => {
            note.hidden = !enabled;
        });

        document.querySelectorAll(editableSelector).forEach((node) => {
            if (enabled) {
                node.setAttribute("contenteditable", "true");
                node.setAttribute("spellcheck", "true");
                node.setAttribute("tabindex", "0");
                node.setAttribute("role", "textbox");
                return;
            }

            node.removeAttribute("contenteditable");
            node.removeAttribute("spellcheck");
            node.removeAttribute("tabindex");
            node.removeAttribute("role");
        });
    };

    const setEnabled = (nextValue) => {
        const normalized = Boolean(nextValue);
        if (enabled === normalized) return;
        enabled = normalized;
        config.onModeChange?.(enabled);
        syncUi();
    };

    document.addEventListener("click", (event) => {
        const toggle = event.target.closest(toggleSelector);
        if (!toggle) return;

        event.preventDefault();
        if (enabled && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        setEnabled(!enabled);
    });

    document.addEventListener("input", (event) => {
        const editable = event.target.closest(`${editableSelector}[contenteditable='true']`);
        if (!editable) return;
        config.onInput?.(editable);
    });

    document.addEventListener("focusout", (event) => {
        const editable = event.target.closest(`${editableSelector}[contenteditable='true']`);
        if (!editable) return;
        config.onCommit?.(editable);
    }, true);

    document.addEventListener("paste", (event) => {
        const editable = event.target.closest(`${editableSelector}[contenteditable='true']`);
        if (!editable) return;

        event.preventDefault();
        const pastedText = (event.clipboardData || window.clipboardData)?.getData("text") || "";
        document.execCommand("insertText", false, pastedText);
    });

    document.addEventListener("keydown", (event) => {
        const editable = event.target.closest(`${editableSelector}[contenteditable='true']`);
        if (!editable) return;

        const multiline = editable.dataset.inlineEditableMultiline === "true";
        if (!multiline && event.key === "Enter") {
            event.preventDefault();
            editable.blur();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            editable.blur();
        }
    });

    syncUi();

    return {
        get enabled() {
            return enabled;
        },
        setEnabled,
        syncUi,
        readValue(node, multiline = false) {
            return readInlineEditableValue(node, multiline);
        }
    };
}
