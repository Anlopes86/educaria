/* Images stay on the device, carried with the recoverable result rather than
 * sent to the text AI provider. Validate attachments before spending credits. */
function validateDashboardSourceFile(file) {
    if (!file) return;
    if (!/\.(txt|rtf|docx|pdf)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
        throw Object.assign(new Error("Envie um arquivo TXT, RTF, DOCX ou PDF de até 5 MB, com conteúdo selecionável."), { status: 400 });
    }
}

function hydrateDashboardCreationClasses() {
    const field = document.querySelector('[data-dashboard-context="className"]');
    if (!field || field.disabled) return;
    const selected = field.dataset.initialized ? field.value : (typeof readSelectedClass === "function" ? readSelectedClass() : "");
    const classes = typeof getAvailableClasses === "function" ? getAvailableClasses() : [];
    field.replaceChildren(new Option("Biblioteca pessoal", ""), ...classes.map((name) => new Option(name, name)));
    field.value = classes.includes(selected) ? selected : "";
    field.dataset.initialized = "true";
}

async function prepareDashboardSlideImage(form) {
    const file = form.querySelector("[data-dashboard-slide-image]")?.files?.[0];
    if (!file) return "";
    if (form.dashboardImageState?.file !== file) {
        const state = { file, data: "", error: null };
        form.dashboardImageState = state;
        state.pending = window.educariaImages.optimize(file).then((data) => { state.data = data; })
            .catch((error) => { state.error = error; });
    }
    const state = form.dashboardImageState;
    await state.pending;
    if (state.error) throw Object.assign(state.error, { status: 400 });
    return state.data;
}

function bindDashboardCreationAttachments(form) {
    const source = form.querySelector("[data-dashboard-source-file]");
    const removeSource = form.querySelector("[data-dashboard-remove-source]");
    const image = form.querySelector("[data-dashboard-slide-image]");
    const feedback = form.querySelector("[data-dashboard-quick-feedback]");
    const showError = (error) => {
        if (feedback) { feedback.textContent = error.message; feedback.hidden = false; }
    };
    const updateSource = () => {
        form.querySelector("[data-dashboard-quick-topic]")?.setCustomValidity("");
        if (feedback) feedback.hidden = true;
        try { validateDashboardSourceFile(source.files?.[0]); }
        catch (error) { source.value = ""; showError(error); }
        const label = form.querySelector("[data-dashboard-file-label]");
        if (label) label.textContent = source.files?.[0]?.name || "Anexar arquivo do professor";
        if (removeSource) removeSource.hidden = !source.files?.length;
    };
    source?.addEventListener("change", updateSource);
    removeSource?.addEventListener("click", () => {
        source.value = "";
        updateSource();
        source.focus();
    });
    image?.addEventListener("change", async () => {
        if (feedback) feedback.hidden = true;
        const selected = image.files?.[0];
        const preview = form.querySelector("[data-dashboard-image-preview]");
        preview.hidden = true;
        try {
            const url = await prepareDashboardSlideImage(form);
            if (image.files?.[0] !== selected) return;
            const img = preview.querySelector("img");
            if (url) img.src = url;
            else img.removeAttribute("src");
            preview.hidden = !url;
        } catch (error) { if (image.files?.[0] === selected) showError(error); }
    });
    form.querySelector("[data-dashboard-remove-image]")?.addEventListener("click", () => {
        image.value = "";
        form.dashboardImageState = null;
        const preview = form.querySelector("[data-dashboard-image-preview]");
        preview.hidden = true;
        preview.querySelector("img").removeAttribute("src");
    });
    document.addEventListener("educaria-classes-updated", hydrateDashboardCreationClasses);
    document.addEventListener("educaria-auth-changed", () => {
        const classes = form.querySelector('[data-dashboard-context="className"]');
        if (classes) delete classes.dataset.initialized;
        hydrateDashboardCreationClasses();
    });
}
