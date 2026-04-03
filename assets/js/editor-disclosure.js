document.addEventListener("DOMContentLoaded", () => {
    const panes = document.querySelectorAll(".activity-builder-pane");

    panes.forEach((pane) => {
        pane.addEventListener(
            "toggle",
            (event) => {
                const current = event.target;

                if (!(current instanceof HTMLDetailsElement)) {
                    return;
                }

                if (!current.classList.contains("editor-disclosure") || !current.open) {
                    return;
                }

                pane.querySelectorAll(".editor-disclosure").forEach((item) => {
                    if (item !== current) {
                        item.open = false;
                    }
                });
            },
            true
        );
    });
});
