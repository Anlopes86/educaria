/* Read-only examples. Only shipped HTML is loaded; never user drafts or AI. */
(function () {
    "use strict";
    const catalog = window.EducariaExampleCatalog;
    if (!catalog) return;
    const base = new URL("./", location.href);
    const asset = name => new URL(`../assets/${name}`, base).href;
    const e = catalog.escape;
    let dialog, opener, current, frame, instance, timer, timeout, abort, revision = 0;
    let index = 0, playing = false, ready = false, zoomed = false, restoreOpener = true;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const keyForHref = href => Object.keys(catalog.tools).find(key => new URL(catalog.tools[key].builder, base).pathname === new URL(href, base).pathname);
    function enhance() {
        document.querySelectorAll("#activity-toolkit a[href], .dashboard-worksheet-entry").forEach(link => {
            const key = keyForHref(link.getAttribute("href"));
            if (!key || link.parentElement.classList.contains("activity-example-card")) return;
            const wrapper = document.createElement("div");
            wrapper.className = "activity-example-card";
            link.before(wrapper); wrapper.append(link);
            const button = document.createElement("button");
            button.type = "button"; button.className = "activity-example-trigger";
            button.dataset.activityExample = key;
            button.textContent = "▷ Ver exemplo";
            button.setAttribute("aria-label", `Ver exemplo: ${catalog.tools[key].label}`);
            wrapper.append(button);
        });
    }
    function createDialog() {
        dialog = document.createElement("dialog");
        dialog.className = "activity-example-dialog";
        dialog.setAttribute("aria-labelledby", "activity-example-title");
        dialog.innerHTML = `<div class="activity-example-layout">
            <header class="activity-example-header"><div><small>VEJA ANTES DE CRIAR · SEM GASTAR IA</small><h2 id="activity-example-title"></h2></div><button type="button" data-example-close aria-label="Fechar exemplo">✕</button></header>
            <div class="activity-example-options"><span data-example-kind>Exemplo de apresentação</span><div data-example-print hidden><button type="button" data-example-student aria-pressed="true">Folha do aluno</button><button type="button" data-example-answers aria-pressed="false">Gabarito</button></div><button type="button" data-example-zoom aria-pressed="false">Ampliar</button></div>
            <div class="activity-example-stage" data-example-stage><p data-example-loading role="status">Preparando o exemplo…</p><div data-example-canvas></div></div>
            <footer class="activity-example-footer"><div class="activity-example-caption"><span data-example-progress></span><p data-example-caption aria-live="polite"></p></div><div class="activity-example-actions"><div><button type="button" data-example-play>Pausar</button><button type="button" data-example-next>Próxima etapa →</button><button type="button" data-example-restart aria-label="Repetir exemplo">↻ Repetir</button></div><button type="button" class="activity-example-create" data-example-create>Criar minha atividade →</button></div></footer>
        </div>`;
        document.body.append(dialog);
        dialog.querySelector("[data-example-close]").onclick = () => dialog.close();
        dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
        dialog.addEventListener("keydown", event => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dialog.close(); }
        });
        dialog.addEventListener("close", () => { if (!dialog.open) dispose(); });
        dialog.querySelector("[data-example-play]").onclick = () => { playing ? pause() : play(); };
        dialog.querySelector("[data-example-next]").onclick = () => { pause(); advance(); };
        dialog.querySelector("[data-example-restart]").onclick = restart;
        dialog.querySelector("[data-example-student]").onclick = () => { pause(); showAnswers(false); };
        dialog.querySelector("[data-example-answers]").onclick = () => { pause(); showAnswers(true); };
        dialog.querySelector("[data-example-zoom]").onclick = () => { zoomed = !zoomed; fit(); };
        dialog.querySelector("[data-example-create]").onclick = createMine;
        new ResizeObserver(fit).observe(dialog.querySelector("[data-example-stage]"));
    }
    const node = selector => dialog.querySelector(selector);
    function post(data) { if (ready && frame) frame.contentWindow.postMessage({ instance, ...data }, "*"); }
    function fit() {
        if (!frame) return;
        const stage = node("[data-example-stage]"), canvas = node("[data-example-canvas]");
        const width = current === "worksheet" ? 860 : 1280, height = current === "worksheet" ? 1150 : 720;
        const scale = zoomed ? 1 : Math.min(1, (stage.clientWidth - 16) / width, (stage.clientHeight - 16) / height);
        frame.style.width = `${width}px`; frame.style.height = `${height}px`;
        frame.style.transform = `scale(${Math.max(.1, scale)})`;
        canvas.style.width = `${width * scale}px`; canvas.style.height = `${height * scale}px`;
        stage.classList.toggle("is-zoomed", zoomed);
        node("[data-example-zoom]").textContent = zoomed ? "Ajustar à janela" : "Ampliar";
        node("[data-example-zoom]").setAttribute("aria-pressed", String(zoomed));
    }
    function controls() {
        const steps = catalog.tools[current].steps;
        node("[data-example-play]").textContent = playing ? "Ⅱ Pausar" : "▷ Reproduzir";
        node("[data-example-play]").disabled = !ready || index === steps.length - 1;
        node("[data-example-next]").disabled = !ready || index === steps.length - 1;
        node("[data-example-restart]").disabled = !ready;
        node("[data-example-progress]").textContent = `${index + 1} / ${steps.length}`;
        node("[data-example-caption]").textContent = steps[index].text;
    }
    function pause() { playing = false; clearTimeout(timer); if (dialog?.open) controls(); }
    function schedule() {
        clearTimeout(timer);
        if (!playing || !ready) return;
        if (index === catalog.tools[current].steps.length - 1) { pause(); return; }
        timer = setTimeout(advance, catalog.tools[current].steps[index].delay);
    }
    function play() { if (!ready) return; playing = true; controls(); schedule(); }
    function showAnswers(value) {
        node("[data-example-student]").setAttribute("aria-pressed", String(!value));
        node("[data-example-answers]").setAttribute("aria-pressed", String(value));
        post({ command: "answers", value });
    }
    function advance() {
        if (!ready || index >= catalog.tools[current].steps.length - 1) return;
        index++;
        if (current === "lesson") loadFrame(catalog.tools.lesson.sequence[index]);
        else { post({ command: "step", index }); if (current === "worksheet") showAnswers(true); }
        controls(); schedule();
    }
    function restart() {
        index = 0; playing = !reduceMotion.matches; showAnswers(false);
        loadFrame(current === "lesson" ? "slides" : current); controls();
    }
    async function getDocument(path, signal) {
        const response = await fetch(new URL(path, base), { signal });
        if (!response.ok) throw new Error("Example unavailable");
        return new DOMParser().parseFromString(await response.text(), "text/html");
    }
    function draftFrom(doc, type) {
        const controls = {};
        doc.querySelectorAll("input[id], textarea[id], select[id]").forEach(field => {
            if (field.type !== "file") controls[field.id] = field.type === "checkbox" ? String(field.checked) : field.value;
        });
        const fixture = catalog.draft(type);
        return { ...fixture, controls: { ...controls, ...fixture.controls } };
    }
    async function loadFrame(type) {
        const run = ++revision;
        abort?.abort(); abort = new AbortController(); clearTimeout(timer); clearTimeout(timeout);
        ready = false; instance = crypto.randomUUID();
        frame?.remove(); frame = null;
        node("[data-example-loading]").hidden = false;
        node("[data-example-loading]").textContent = "Preparando o exemplo…";
        controls();
        try {
            let doc, draft = {};
            if (type === "worksheet") {
                doc = new DOMParser().parseFromString('<!doctype html><html lang="pt-BR"><head></head><body class="worksheet-page"><main data-example-paper></main></body></html>', "text/html");
                for (const path of ["css/estilo-premium.css?v=20261023-1", "css/components/worksheet.css"]) {
                    const link = doc.createElement("link"); link.rel = "stylesheet"; link.href = asset(path); doc.head.append(link);
                }
                for (const name of ["discovery-core", "wordsearch-core", "crossword-core", "worksheet-core", "worksheet-view"]) {
                    const script = doc.createElement("script"); script.src = asset(`js/${name}.js`); script.defer = true; doc.head.append(script);
                }
            } else {
                const [page, builder] = await Promise.all([getDocument(catalog.tools[type].page, abort.signal), getDocument(catalog.tools[type].builder, abort.signal)]);
                doc = page; draft = draftFrom(builder, type);
                doc.querySelectorAll("script").forEach(script => {
                    const url = script.getAttribute("src");
                    if (!url || !catalog.scripts.has(new URL(url, base).pathname.split("/").pop())) script.remove();
                });
            }
            if (run !== revision || !dialog.open) return;
            // Keep shipped presentation markup, but strip navigation and event attributes.
            // Dialog forms are local close controls, not data submission. Keep a
            // working button without granting form permissions to the sandbox.
            doc.querySelectorAll('form[method="dialog"]').forEach(form => {
                const close = doc.createElement("button"); close.type = "button";
                close.dataset.exampleCloseDialog = "";
                close.className = "platform-link-button platform-link-secondary";
                close.textContent = "Fechar explicação ×";
                form.replaceWith(close);
            });
            doc.querySelectorAll("base, iframe, object, embed, form").forEach(el => el.remove());
            doc.querySelectorAll("*").forEach(el => [...el.attributes].forEach(attr => { if (attr.name.startsWith("on")) el.removeAttribute(attr.name); }));
            doc.body.classList.add("activity-example-frame");
            doc.body.dataset.materialType = type;
            const baseNode = doc.createElement("base"); baseNode.href = base.href; doc.head.prepend(baseNode);
            const origin = base.protocol === "file:" ? "file:" : base.origin;
            const policy = doc.createElement("meta"); policy.httpEquiv = "Content-Security-Policy";
            policy.content = `default-src 'none'; script-src ${origin}; style-src ${origin} 'unsafe-inline' https://fonts.googleapis.com; font-src ${origin} data: https://fonts.gstatic.com; img-src ${origin} data: blob:; connect-src 'none'; form-action 'none'; base-uri ${origin};`;
            doc.head.prepend(policy);
            const config = doc.createElement("script"); config.id = "educaria-example-config"; config.type = "application/json";
            config.textContent = JSON.stringify({ type, draft, steps: catalog.tools[type].steps, instance, parentOrigin: location.origin, worksheet: type === "worksheet" ? catalog.worksheet : null }).replaceAll("<", "\\u003c");
            const bootstrap = doc.createElement("script"); bootstrap.src = asset("js/activity-example-frame.js?v=20261023-1"); bootstrap.defer = true;
            const firstScript = doc.head.querySelector("script");
            doc.head.insertBefore(config, firstScript); doc.head.insertBefore(bootstrap, firstScript);
            const style = doc.createElement("link"); style.rel = "stylesheet"; style.href = asset("css/components/activity-examples.css?v=20261023-1"); doc.head.append(style);
            frame = document.createElement("iframe"); frame.title = `Exemplo: ${catalog.tools[type].label}`;
            frame.setAttribute("sandbox", "allow-scripts"); frame.setAttribute("referrerpolicy", "no-referrer");
            frame.srcdoc = `<!doctype html>${doc.documentElement.outerHTML}`;
            node("[data-example-canvas]").append(frame); fit();
            timeout = setTimeout(() => failure(run), 15000);
        } catch (error) { if (error.name !== "AbortError") failure(run); }
    }
    function failure(run) {
        if (run !== revision || !dialog.open) return;
        clearTimeout(timeout); pause(); ready = false; frame?.remove(); frame = null;
        node("[data-example-loading]").hidden = false;
        node("[data-example-loading]").textContent = "Não foi possível carregar o exemplo. Feche e tente novamente. Sua criação continua intacta.";
        controls();
    }
    function open(type, trigger) {
        if (!catalog.tools[type]) return;
        if (!dialog) createDialog();
        opener = trigger; current = type; index = 0; zoomed = false; restoreOpener = true;
        dialog.dataset.exampleType = type;
        playing = !reduceMotion.matches && !document.hidden;
        node("#activity-example-title").textContent = catalog.tools[type].label;
        node("[data-example-print]").hidden = type !== "worksheet";
        node("[data-example-kind]").textContent = type === "worksheet" ? "Prévia de uma folha A4" : type === "lesson" ? "Exemplo de sequência: Slides → Quiz → Mapa mental" : "Exemplo de apresentação · você também pode interagir";
        node("[data-example-create]").disabled = document.querySelector("[data-dashboard-quick-form]")?.dataset.generating === "true";
        dialog.showModal(); document.documentElement.classList.add("activity-example-open");
        node("[data-example-close]").focus(); showAnswers(false);
        loadFrame(type === "lesson" ? "slides" : type);
    }
    function dispose() {
        revision++; abort?.abort(); clearTimeout(timer); clearTimeout(timeout);
        frame?.remove(); frame = null; ready = false; playing = false;
        document.documentElement.classList.remove("activity-example-open");
        if (restoreOpener && opener?.isConnected) opener.focus({ preventScroll: true });
    }
    function createMine() {
        if (document.querySelector("[data-dashboard-quick-form]")?.dataset.generating === "true") return;
        const type = current;
        restoreOpener = false;
        dialog.close();
        const select = document.querySelector("[data-dashboard-quick-format]");
        const option = select && [...select.options].find(item => item.dataset.materialType === type);
        if (option) {
            select.value = option.value; select.dispatchEvent(new Event("change", { bubbles: true }));
            document.querySelector("[data-dashboard-quick-topic]")?.focus();
            select.closest("[data-dashboard-quick-form]")?.scrollIntoView({ behavior: reduceMotion.matches ? "instant" : "smooth", block: "center" });
        } else if (type === "worksheet" && document.body.dataset.materialType === "worksheet") {
            document.getElementById("worksheet-source")?.focus();
        } else location.href = new URL(catalog.tools[type].builder, base).href;
    }
    document.addEventListener("click", event => {
        const trigger = event.target.closest("[data-activity-example]");
        if (!trigger) return;
        event.preventDefault();
        const type = trigger.dataset.activityExample === "selected" ? document.querySelector("[data-dashboard-quick-format]")?.selectedOptions[0]?.dataset.materialType : trigger.dataset.activityExample;
        open(type, trigger);
    });
    window.addEventListener("message", event => {
        if (!frame || event.source !== frame.contentWindow || event.origin !== "null" || event.data?.channel !== "educaria-example" || event.data.instance !== instance) return;
        if (event.data.event === "ready") { clearTimeout(timeout); ready = true; node("[data-example-loading]").hidden = true; controls(); schedule(); }
        else if (event.data.event === "error") failure(revision);
        else if (event.data.event === "interact") pause();
        else if (event.data.event === "close") dialog.close();
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
    reduceMotion.addEventListener("change", () => { if (reduceMotion.matches) pause(); });
    window.addEventListener("pagehide", () => { if (dialog?.open) dialog.close(); });
    window.EducariaExamples = Object.freeze({ enhance });
    document.addEventListener("DOMContentLoaded", enhance);
})();
