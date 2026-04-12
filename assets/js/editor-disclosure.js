document.addEventListener("DOMContentLoaded", () => {
    const panes = document.querySelectorAll(".activity-builder-pane");
    const params = new URLSearchParams(window.location.search);
    const focus = params.get("focus") || "";
    const shouldFocusEdit = focus === "edit";

    panes.forEach((pane) => {
        const disclosures = [...pane.querySelectorAll(".editor-disclosure")];
        disclosures.forEach((item) => {
            item.open = false;
        });

        if (shouldFocusEdit && disclosures.length) {
            const target = disclosures[disclosures.length - 1];
            target.open = true;
            requestAnimationFrame(() => {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
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

                if (!current.open) {
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: savedScrollY, behavior: "auto" });
                    });
                    return;
                }

                pane.querySelectorAll(".editor-disclosure").forEach((item) => {
                    if (item !== current) {
                        item.open = false;
                    }
                });

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
    });
});
