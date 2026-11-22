(function (root) {
    "use strict";
    function render(host, feedback) {
        if (!host) return;
        host.replaceChildren();
        const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
        const message = clean(feedback?.message, 600), summary = clean(feedback?.summary, 450);
        host.hidden = !message && !summary;
        if (host.hidden) return;
        host.classList.add("ai-result-feedback");
        const heading = document.createElement("strong");
        heading.textContent = message ? "Retorno da IA" : "Resumo do resultado";
        host.append(heading);
        if (message) { const paragraph = document.createElement("p"); paragraph.textContent = message; host.append(paragraph); }
        if (summary) { const paragraph = document.createElement("p"); paragraph.className = "ai-result-feedback-summary"; paragraph.textContent = summary; host.append(paragraph); }
    }
    root.EducariaAiFeedback = Object.freeze({ render });
})(window);
