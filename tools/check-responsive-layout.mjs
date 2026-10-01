import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkQuickRecovery, checkImageUpload } from "./browser-recovery-checks.mjs";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const root = path.resolve(import.meta.dirname, "..");
const auditBaseUrl = process.env.EDUCARIA_AUDIT_BASE_URL || "";
const auditWidth = Math.max(320, Number(process.env.EDUCARIA_AUDIT_WIDTH || 390));
const auditHeight = Math.max(480, Number(process.env.EDUCARIA_AUDIT_HEIGHT || 844));
const auditScreenshotDir = process.env.EDUCARIA_AUDIT_SCREENSHOT_DIR
    ? path.resolve(process.env.EDUCARIA_AUDIT_SCREENSHOT_DIR)
    : "";
const auditDisableDashboardTour = process.env.EDUCARIA_AUDIT_DISABLE_DASHBOARD_TOUR === "1";
const auditScrollTo = process.env.EDUCARIA_AUDIT_SCROLL_TO || "";
const auditSeedDashboard = process.env.EDUCARIA_AUDIT_SEED_DASHBOARD === "1";
const auditFlashcardSide = process.env.EDUCARIA_AUDIT_FLASHCARD_SIDE || "front";
const auditMindmapLayout = process.env.EDUCARIA_AUDIT_MINDMAP_LAYOUT || "Radial";
const auditDebateFormat = process.env.EDUCARIA_AUDIT_DEBATE_FORMAT || "Dois lados";
const auditLessonIndex = Math.max(0, Number(process.env.EDUCARIA_AUDIT_LESSON_INDEX || 0));
const auditBuilderOverlay = process.env.EDUCARIA_AUDIT_BUILDER_OVERLAY || "";
const auditStorageFailure = process.env.EDUCARIA_AUDIT_STORAGE_FAILURE === "1";
const auditRecovery = process.env.EDUCARIA_AUDIT_RECOVERY === "1";
const auditMobile = auditWidth < 768;
const pages = process.argv.slice(2).length
    ? process.argv.slice(2).map((page) => ({
        path: page.startsWith("auth:") ? page.slice(5) : page,
        authenticated: page.startsWith("auth:")
    }))
    : [
        { path: "index.html", authenticated: false },
        { path: "login.html", authenticated: false },
        { path: "cadastro.html", authenticated: false },
        { path: "privacidade.html", authenticated: false },
        { path: "termos.html", authenticated: false },
        { path: "plataforma/index.html", authenticated: true },
        { path: "plataforma/configuracoes.html", authenticated: true }
    ];
const port = 9322 + Math.floor(Math.random() * 500);
const profilePath = await fs.mkdtemp(path.join(os.tmpdir(), "educaria-layout-"));

let chromeStderr = "";
const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--allow-file-access-from-files",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    "about:blank"
], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });

chrome.stderr.setEncoding("utf8");
chrome.stderr.on("data", (chunk) => {
    chromeStderr = `${chromeStderr}${chunk}`.slice(-4000);
});

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForDebugger() {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok) return;
        } catch {
            // Chrome is still starting.
        }
        if (chrome.exitCode !== null) {
            throw new Error(`Chrome exited before the DevTools endpoint started (code ${chrome.exitCode}).\n${chromeStderr}`);
        }
        await delay(100);
    }
    throw new Error(`Chrome DevTools endpoint did not start within 20 seconds.\n${chromeStderr}`);
}

async function createPage(url) {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    if (!response.ok) throw new Error(`Could not create browser page (${response.status}).`);
    return response.json();
}

function connect(wsUrl) {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    const diagnostics = [];
    let requestId = 0;

    const rejectPending = (message) => {
        for (const { reject, timeoutId, method } of pending.values()) {
            clearTimeout(timeoutId);
            reject(new Error(`${message} Pending command: ${method}. Chrome exit code: ${chrome.exitCode ?? "running"}.`));
        }
        pending.clear();
    };

    const opened = new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
    });

    socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));
        if (!message.id) {
            if (message.method === "Runtime.exceptionThrown") {
                const details = message.params?.exceptionDetails || {};
                const description = details.exception?.description || details.exception?.value || "";
                const location = details.url ? `${details.url}:${Number(details.lineNumber || 0) + 1}` : "";
                diagnostics.push([details.text || "Uncaught runtime exception", description, location].filter(Boolean).join(" — "));
            } else if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
                diagnostics.push(message.params.entry.text || "Browser log error");
            }
            return;
        }
        if (!pending.has(message.id)) return;
        const { resolve, reject, timeoutId } = pending.get(message.id);
        pending.delete(message.id);
        clearTimeout(timeoutId);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result || {});
    });
    socket.addEventListener("close", (event) => rejectPending(`Chrome DevTools connection closed unexpectedly (code ${event.code}${event.reason ? `: ${event.reason}` : ""}).`));
    socket.addEventListener("error", () => rejectPending("Chrome DevTools connection failed."));

    return {
        opened,
        diagnostics,
        send(method, params = {}) {
            const id = ++requestId;
            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error(`Chrome DevTools command timed out: ${method}`));
                }, 10000);
                pending.set(id, { resolve, reject, timeoutId, method });
                socket.send(JSON.stringify({ id, method, params }));
            });
        },
        close() {
            socket.close();
        }
    };
}

async function waitForPageCondition(cdp, expression, attempts = 40) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const evaluation = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
        if (evaluation.result.value) return true;
        await delay(100);
    }
    return false;
}

async function auditPage(pageConfig) {
    const pagePath = pageConfig.path;
    const [localPagePath, localQuery = ""] = pagePath.split("?");
    const absolutePath = path.resolve(root, localPagePath);
    const url = auditBaseUrl
        ? new URL(pagePath, auditBaseUrl.endsWith("/") ? auditBaseUrl : `${auditBaseUrl}/`).href
        : `${new URL(`file:///${absolutePath.replaceAll("\\", "/")}`).href}${localQuery ? `?${localQuery}` : ""}`;
    const target = await createPage("about:blank");
    const cdp = connect(target.webSocketDebuggerUrl);
    await cdp.opened;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Network.enable");
    if (pageConfig.authenticated) {
        const dashboardTourSeed = auditDisableDashboardTour
            ? " localStorage.setItem('educaria:dashboard-tour:layout-audit', 'done'); localStorage.setItem('educaria:dashboard-tour:auditoria@educaria.test', 'done');"
            : "";
        const dashboardContentSeed = auditSeedDashboard && pagePath.includes("plataforma/index.html")
            ? ` localStorage.setItem('educaria:classList:layout-audit', JSON.stringify(['8º Ano A', '6º Ano B', 'Inglês - 9º Ano'])); localStorage.setItem('educaria:lessons:layout-audit', JSON.stringify([{ id: 'dashboard-slides-audit', className: '8º Ano A', scope: 'class', title: 'Sistema solar: movimentos e descobertas', type: 'Slides', materialType: 'slides', createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(), status: 'draft', draft: '' }, { id: 'dashboard-quiz-audit', className: '6º Ano B', scope: 'class', title: 'Quiz sobre frações equivalentes', type: 'Quiz', materialType: 'quiz', createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(), status: 'ready', draft: '' }]));`
            : "";
        const blockedUrls = ["*gstatic.com/firebasejs/*"];
        if (auditRecovery) blockedUrls.push("*onrender.com/*");
        if (pagePath.includes("criar-aula.html") || pagePath.includes("aula-completa-apresentacao.html")) {
            blockedUrls.push("*auth-flow.js*");
        }
        await cdp.send("Network.setBlockedURLs", { urls: blockedUrls });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:auth:teacher-cache', JSON.stringify({ uid: 'layout-audit', name: 'Professor Auditoria', email: 'auditoria@educaria.test', institution: 'Escola de Teste', role: 'teacher', plan: 'free' })); localStorage.setItem('educaria:auth:session', 'auditoria@educaria.test');${dashboardTourSeed}${dashboardContentSeed}${pagePath.includes("biblioteca.html") ? ` localStorage.setItem('educaria:lessons:layout-audit', JSON.stringify([{ id: 'lesson-library-audit', className: '', scope: 'library', title: 'Quiz para renomear', summary: 'Atividade de auditoria', type: 'Quiz', materialType: 'quiz', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'draft', draft: '' }]));` : ""}`
        });
    }
    if (localPagePath.endsWith("plataforma/criar-aula.html")
        || localPagePath.endsWith("plataforma/aula-completa-apresentacao.html")) {
        const lessonSlideImage = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dff8f0"/><stop offset="1" stop-color="#b9ddff"/></linearGradient></defs><rect width="1200" height="675" rx="48" fill="url(#bg)"/><circle cx="935" cy="145" r="72" fill="#fbbf24"/><path d="M90 554C250 330 390 350 520 554M450 554C650 260 830 330 1040 554" fill="none" stroke="#0f766e" stroke-width="30" stroke-linecap="round"/><path d="M290 516c22-118 83-190 181-225M725 508c5-112 60-192 167-244" fill="none" stroke="#22c55e" stroke-width="24" stroke-linecap="round"/><path d="M465 291l-28 76 80-12M890 264l-43 69 82 3" fill="#22c55e"/><text x="82" y="112" fill="#134e4a" font-family="Arial, sans-serif" font-size="52" font-weight="700">Energia no ecossistema</text><text x="82" y="172" fill="#155e75" font-family="Arial, sans-serif" font-size="30">Do Sol aos produtores e consumidores</text></svg>`)}`;
        const lessonSlidesDraft = JSON.stringify({
            stackHtml: `<section data-slide-card data-slide-type="cover"><input data-field="slide-title" value="A energia que move os ecossistemas"><input data-field="slide-subtitle" value="Fotossíntese, cadeias alimentares e equilíbrio ambiental"><textarea data-field="slide-body">Observe como a energia do Sol entra no ecossistema e acompanha cada relação entre produtores e consumidores.</textarea><select data-field="slide-image-mode"><option selected>Imagem sugerida</option></select><select data-field="slide-layout"><option selected>Lado a lado</option></select><textarea data-field="slide-image-prompt">Fluxo de energia em um ecossistema</textarea><input data-field="slide-image-url" value="${lessonSlideImage}"><select data-field="slide-font"><option selected>Destaque moderno</option></select><input data-field="slide-accent-color" value="#2dd4bf"><input data-field="slide-color" value="#102a43"><input data-field="slide-text-color" value="#f8fafc"></section>`
        });
        const lessonQuizDraft = JSON.stringify({
            controls: { "quiz-tema": "Fotossíntese e ecossistemas" },
            stackHtml: `<section data-quiz-question><textarea data-field="prompt">As plantas transformam energia luminosa em energia química durante a fotossíntese.</textarea><select data-field="type"><option selected>Verdadeiro ou falso</option></select><select data-field="correct"><option selected>Alternativa A</option></select><input data-option data-option-key="Alternativa A" value="Verdadeiro"><input data-option data-option-key="Alternativa B" value="Falso"><textarea data-field="explanation">A fotossíntese converte a energia da luz em energia armazenada na matéria orgânica.</textarea></section>`
        });
        const lessonMatchDraft = JSON.stringify({
            controls: { "ligar-titulo": "Relações ecológicas", "ligar-coluna-a": "Conceito", "ligar-coluna-b": "Definição", "ligar-embaralhar": "Não", "ligar-cores": "shuffle", "ligar-cor-unica": "#7c3aed" },
            stackHtml: `<section data-match-pair><input data-match-left value="Produtor"><input data-match-right value="Produz o próprio alimento"><input data-match-color type="color" value="#22c55e"></section><section data-match-pair><input data-match-left value="Consumidor"><input data-match-right value="Obtém energia de outros seres"><input data-match-color type="color" value="#0ea5e9"></section>`
        });
        const activityLessons = [
            { id: "lesson-sequence-slides-audit", className: "8º Ano A", scope: "class", title: "Energia nos ecossistemas", summary: "Introdução visual aos fluxos de energia.", type: "Slides", materialType: "slides", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "ready", draft: lessonSlidesDraft },
            { id: "lesson-sequence-match-audit", className: "8º Ano A", scope: "class", title: "Relações ecológicas", summary: "Ligações entre conceitos e definições.", type: "Ligar pontos", materialType: "match", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "ready", draft: lessonMatchDraft },
            { id: "lesson-sequence-quiz-audit", className: "", scope: "library", title: "Quiz de fechamento", summary: "Perguntas rápidas para conferir a aprendizagem.", type: "Quiz", materialType: "quiz", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "ready", draft: lessonQuizDraft },
            { id: "lesson-sequence-other-class-audit", className: "6º Ano B", scope: "class", title: "Ciclo da água", summary: "Slides usados em outra turma para testar o filtro.", type: "Slides", materialType: "slides", createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(), status: "ready", draft: lessonSlidesDraft }
        ];
        const sequenceDraft = {
            title: "Energia e equilíbrio nos ecossistemas",
            objective: "Compreender como a energia circula nas cadeias alimentares e verificar a aprendizagem ao final.",
            duration: 45,
            blocks: activityLessons.slice(0, 3).map((lesson, index) => ({
                id: `lesson-sequence-block-${index + 1}`,
                lessonRefId: lesson.id,
                materialType: lesson.materialType,
                sourceScope: lesson.scope,
                label: lesson.title,
                duration: [12, 10, 8][index],
                note: "",
                lessonTitle: lesson.title,
                lessonSummary: lesson.summary,
                lessonDraft: lesson.draft
            }))
        };
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `['layout-audit', 'guest', 'auditoria-educaria-test'].forEach((scope) => { localStorage.setItem('educaria:selectedClass:' + scope, '8º Ano A'); localStorage.setItem('educaria:classList:' + scope, JSON.stringify(['8º Ano A'])); localStorage.setItem('educaria:lessons:' + scope, ${JSON.stringify(JSON.stringify(activityLessons))}); localStorage.setItem('educaria:builder:lesson:' + scope, ${JSON.stringify(JSON.stringify(sequenceDraft))}); }); localStorage.setItem('educaria:lessons', ${JSON.stringify(JSON.stringify(activityLessons))}); localStorage.setItem('educaria:builder:lesson', ${JSON.stringify(JSON.stringify(sequenceDraft))});`
        });
    }
    if (localPagePath.endsWith("plataforma/apresentacao.html")) {
        const legacyFeatureImage = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#dff8f0"/><circle cx="590" cy="165" r="76" fill="#fbbf24"/><path d="M90 500C260 270 450 290 710 500" fill="none" stroke="#0f766e" stroke-width="36" stroke-linecap="round"/></svg>`)}`;
        const slideStack = `
            <section data-slide-card data-slide-type="cover">
                <input data-field="slide-title" value="Como a tecnologia transforma a aprendizagem">
                <input data-field="slide-subtitle" value="Uma conversa sobre escolhas, oportunidades e responsabilidade">
                <textarea data-field="slide-body">Observe o que já mudou\nCompare diferentes experiências\nPrepare uma pergunta para a turma</textarea>
                <select data-field="slide-image-mode"><option selected>Enviar imagem</option></select>
                <select data-field="slide-layout"><option selected>Imagem em destaque</option></select>
                <textarea data-field="slide-image-prompt">Tecnologia e aprendizagem</textarea>
                <input data-field="slide-image-url" value="${legacyFeatureImage}">
                <select data-field="slide-font"><option selected>Destaque moderno</option></select>
                <input data-field="slide-accent-color" value="#2dd4bf">
                <input data-field="slide-color" value="#102a43">
                <input data-field="slide-text-color" value="#f8fafc">
            </section>
        `;
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `['guest', 'layout-audit', 'auditoria-educaria-test'].forEach((scope) => localStorage.setItem('educaria:builder:slides:' + scope, ${JSON.stringify(JSON.stringify({ stackHtml: slideStack }))}));`
        });
    }
    if (localPagePath.endsWith("plataforma/quiz-aplicacao.html")) {
        const quizStack = `
            <section data-quiz-question>
                <textarea data-field="prompt">A fotossíntese transforma energia luminosa em energia química.</textarea>
                <select data-field="type"><option selected>Verdadeiro ou falso</option></select>
                <select data-field="correct"><option selected>Alternativa A</option></select>
                <input data-option data-option-key="Alternativa A" value="Verdadeiro">
                <input data-option data-option-key="Alternativa B" value="Falso">
                <textarea data-field="explanation">As plantas armazenam parte da energia luminosa na matéria orgânica produzida.</textarea>
            </section>
        `;
        const quizDraft = JSON.stringify({ controls: { "quiz-tema": "Fotossíntese e ecossistemas" }, stackHtml: quizStack });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:builder:quiz:guest', ${JSON.stringify(quizDraft)}); localStorage.setItem('educaria:builder:quiz:layout-audit', ${JSON.stringify(quizDraft)});`
        });
    }
    if (localPagePath.endsWith("plataforma/flashcards-apresentacao.html")) {
        const flashcardsStack = `
            <section data-flashcard>
                <textarea data-field="front">Fotossíntese</textarea>
                <textarea data-field="back">Produção de energia pelas plantas</textarea>
                <textarea data-field="example">Anote no quadro: a planta utiliza luz, água e gás carbônico para produzir matéria orgânica e liberar oxigênio.</textarea>
                <input data-field="front-color" value="#ffffff">
                <input data-field="back-color" value="#dbeafe">
                <input data-field="text-color" value="#0f172a">
            </section>
        `;
        const flashcardsDraft = JSON.stringify({ controls: { "cards-tema": "Fotossíntese", "cards-exemplo": "Sim" }, stackHtml: flashcardsStack });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:builder:flashcards:guest', ${JSON.stringify(flashcardsDraft)}); localStorage.setItem('educaria:builder:flashcards:layout-audit', ${JSON.stringify(flashcardsDraft)});`
        });
    }
    if (localPagePath.endsWith("plataforma/ligar-pontos-apresentacao.html")) {
        const matchDraft = JSON.stringify({
            controls: { "ligar-titulo": "Relações ecológicas", "ligar-coluna-a": "Conceito", "ligar-coluna-b": "Definição", "ligar-embaralhar": "Não", "ligar-cores": "same", "ligar-cor-unica": "#7c3aed" },
            stackHtml: `<section data-match-pair><input data-match-left value="Produtor"><input data-match-right value="Produz o próprio alimento"><input data-match-color type="color" value="#22c55e"></section><section data-match-pair><input data-match-left value="Consumidor"><input data-match-right value="Obtém energia de outros seres"><input data-match-color type="color" value="#0ea5e9"></section>`
        });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:builder:match:guest', ${JSON.stringify(matchDraft)}); localStorage.setItem('educaria:builder:match:layout-audit', ${JSON.stringify(matchDraft)});`
        });
    }
    if (localPagePath.endsWith("plataforma/mapa-mental-apresentacao.html")) {
        const mindmapBranches = [
            ["Causas", "O que inicia o processo", "A Revolução Industrial reuniu mudanças econômicas, técnicas e sociais.\n\n- Acúmulo de capital\n- Disponibilidade de carvão e ferro\n- Crescimento dos mercados consumidores\n- Transformações no campo", "#22c55e"],
            ["Inovações", "Máquinas e novas fontes de energia", "A máquina a vapor ampliou a capacidade produtiva e permitiu mecanizar diferentes etapas do trabalho.", "#0ea5e9"],
            ["Trabalho", "Novas relações de produção", "O trabalho artesanal perdeu espaço para a produção fabril, com divisão de tarefas, jornadas extensas e novas formas de organização.", "#f59e0b"],
            ["Cidades", "Urbanização acelerada", "O crescimento das fábricas atraiu trabalhadores e transformou o espaço urbano, muitas vezes sem infraestrutura suficiente.", "#ec4899"],
            ["Impactos", "Consequências sociais e ambientais", "A industrialização aumentou a produção, mas também intensificou desigualdades, poluição e conflitos trabalhistas.", "#8b5cf6"],
            ["Legados", "Mudanças que permanecem", "Muitos processos atuais de produção, consumo, transporte e organização do trabalho têm raízes nesse período.", "#14b8a6"],
            ["Tecnologia", "Aperfeiçoamento contínuo", "Novas máquinas e técnicas aceleraram os ciclos de inovação e modificaram a relação entre ciência e produção.", "#ef4444"],
            ["Debates", "Interpretações históricas", "Historiadores analisam diferentes ritmos de industrialização e seus efeitos em grupos sociais e regiões distintas.", "#6366f1"]
        ];
        const mindmapStack = mindmapBranches.map(([title, subtitle, detail, color]) => `
            <section data-mind-branch>
                <input data-mind-title value="${title}">
                <input data-mind-subtitle value="${subtitle}">
                <textarea data-mind-detail>${detail}</textarea>
                <input data-mind-color value="${color}">
            </section>
        `).join("");
        const mindmapDraft = JSON.stringify({
            controls: {
                "mapa-centro": "Revolução Industrial",
                "mapa-subtitulo": "Transformações do século XVIII ao XIX",
                "mapa-layout": auditMindmapLayout
            },
            stackHtml: mindmapStack
        });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:builder:mindmap:guest', ${JSON.stringify(mindmapDraft)}); localStorage.setItem('educaria:builder:mindmap:layout-audit', ${JSON.stringify(mindmapDraft)});`
        });
    }
    if (localPagePath.endsWith("plataforma/debate-guiado-apresentacao.html")
        || localPagePath.endsWith("plataforma/debate-guiado-builder.html")) {
        const debateDraft = JSON.stringify({
            controls: {
                "debate-titulo": "Celular em sala: aliado ou distração?",
                "debate-formato": auditDebateFormat,
                "debate-acao-ia": "Organizar roteiro de debate",
                "debate-pergunta": "O uso de celulares deve ser permitido durante as aulas quando houver uma finalidade pedagógica?",
                "debate-lado-a": "Permitir com regras claras e objetivos de aprendizagem",
                "debate-lado-b": "Restringir para preservar a atenção e a convivência"
            },
            steps: [
                { title: "Abertura", time: "4 min", question: "Que experiências da turma ajudam a compreender os benefícios e os riscos do uso do celular?", guidance: "Apresente a proposição e combine as regras de escuta.\n\n- Evite interrupções\n- Peça exemplos concretos" },
                { title: "Argumentos", time: "8 min", question: "Qual é o argumento mais forte de cada lado e em quais evidências ele se apoia?", guidance: "Alterne as falas e peça que cada grupo justifique suas afirmações." },
                { title: "Contrapontos", time: "6 min", question: "Como cada lado responderia à principal preocupação apresentada pelo grupo oposto?", guidance: "Incentive respostas diretas, respeitosas e baseadas no que foi dito." },
                { title: "Síntese", time: "5 min", question: "Que acordo equilibrado a turma poderia propor para conciliar aprendizagem, atenção e responsabilidade?", guidance: "Registre os consensos e os pontos que ainda dividem a turma." }
            ]
        });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:builder:debate:guest', ${JSON.stringify(debateDraft)}); localStorage.setItem('educaria:builder:debate:layout-audit', ${JSON.stringify(debateDraft)});`
        });
    }
    await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: auditWidth,
        height: auditHeight,
        deviceScaleFactor: 1,
        mobile: auditMobile,
        screenWidth: auditWidth,
        screenHeight: auditHeight
    });
    await cdp.send("Page.navigate", { url });
    await waitForPageCondition(cdp, "document.readyState === 'complete'");
    if (pagePath.includes("apresentacao.html") || pagePath.includes("quiz-aplicacao.html")) {
        await waitForPageCondition(cdp, `(() => {
            if (!document.body?.classList.contains('presentation-runtime-page')) return false;
            const flashcardStage = document.querySelector('[data-flashcard-stage]');
            return !flashcardStage || getComputedStyle(flashcardStage).visibility !== 'hidden';
        })()`, 80);
    }
    if (pagePath.includes("plataforma/index.html")) {
        await waitForPageCondition(cdp, "document.body?.dataset?.dashboardReady === 'true'", 80);
    }
    if (pagePath.includes("-builder.html") && pagePath.includes("new=1")) {
        await waitForPageCondition(cdp, "Boolean(document.querySelector('.builder-start-panel') && document.querySelector('.editor-disclosure--ai[open]'))", 80);
    }
    if (pagePath.includes("-builder.html") && pagePath.includes("focus=edit")) {
        await waitForPageCondition(cdp, "Boolean(document.querySelector('.editor-disclosure--manual[open]') && document.querySelector('[data-builder-item-navigator]:not([hidden])'))", 80);
    }
    if (pagePath.includes("biblioteca.html")) {
        await waitForPageCondition(cdp, "Boolean(document.querySelector('[data-library-count]')?.textContent.trim() && document.querySelector('[data-library-materials] details'))", 80);
    }
    if (localPagePath.endsWith("plataforma/criar-aula.html")) {
        await waitForPageCondition(cdp, "Boolean(document.querySelector('[data-lesson-tool-grid]')?.children.length && document.querySelectorAll('[data-progress-item-id]').length)", 80);
    }
    if (localPagePath.endsWith("plataforma/aula-completa-apresentacao.html")) {
        await waitForPageCondition(cdp, "Boolean(document.querySelectorAll('[data-lesson-player-select]').length && document.querySelector('[data-lesson-player-iframe]')?.src)", 80);
        if (auditLessonIndex > 0) {
            await cdp.send("Runtime.evaluate", {
                expression: `document.querySelector('[data-lesson-player-select="${auditLessonIndex}"]')?.click()`
            });
            await waitForPageCondition(cdp, `document.querySelector('[data-lesson-player-select="${auditLessonIndex}"]')?.classList.contains('is-active')`, 80);
            await waitForPageCondition(cdp, "document.querySelector('[data-lesson-player-iframe]')?.contentDocument?.body?.classList.contains('lesson-sequence-embedded')", 80);
        }
    }
    if (auditBaseUrl) {
        await waitForPageCondition(cdp, "Boolean(document.documentElement.dataset.educariaOffline)");
    }
    await delay(250);

    if (localPagePath.endsWith("plataforma/flashcards-apresentacao.html") && auditFlashcardSide === "back") {
        await cdp.send("Runtime.evaluate", {
            expression: "document.querySelector('[data-flashcard-flip]')?.click()"
        });
        await waitForPageCondition(cdp, "document.querySelector('[data-flashcard-stage]')?.classList.contains('is-flipped')");
        await delay(600);
    }

    if (localPagePath.endsWith("plataforma/mapa-mental-builder.html")) {
        await cdp.send("Runtime.evaluate", {
            expression: `(() => { const field = document.querySelector('#mapa-layout'); if (!field) return false; field.value = ${JSON.stringify(auditMindmapLayout)}; field.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`
        });
        await delay(250);
    }

    if (localPagePath.endsWith("-builder.html") && auditBuilderOverlay === "projector") {
        await waitForPageCondition(cdp, "Boolean(document.querySelector('[data-projector-preview]'))", 80);
        await cdp.send("Runtime.evaluate", {
            expression: "document.querySelector('[data-projector-preview]')?.click()"
        });
        await waitForPageCondition(cdp, "Boolean(document.querySelector('[data-projector-preview-modal]:not([hidden])') && document.querySelector('[data-projector-preview-frame]')?.contentDocument?.readyState === 'complete')", 120);
        await delay(500);
    } else if (localPagePath.endsWith("-builder.html") && auditBuilderOverlay === "ai-ready") {
        await waitForPageCondition(cdp, "typeof openAiReadyModal === 'function'", 80);
        await cdp.send("Runtime.evaluate", {
            expression: "openAiReadyModal(document.body.dataset.materialType || 'slides')"
        });
        await waitForPageCondition(cdp, "Boolean(document.querySelector('[data-ai-ready-modal]:not([hidden])'))", 80);
        await delay(180);
    }

    if (auditScrollTo) {
        await cdp.send("Runtime.evaluate", {
            expression: `(() => { const target = document.querySelector(${JSON.stringify(auditScrollTo)}); if (!target) return false; target.scrollIntoView({ block: 'start' }); return true; })()`,
            returnByValue: true
        });
        await delay(180);
    }

    let storageFailureJourney = null;
    if (auditStorageFailure && localPagePath.endsWith("-builder.html")) {
        const storageFailure = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const original = Storage.prototype.setItem;
                window.__auditRestoreStorage = () => { Storage.prototype.setItem = original; };
                Storage.prototype.setItem = function(key, value) {
                    if (String(key).startsWith('educaria:builder:') || String(key).startsWith('educaria:lessons')) {
                        throw new DOMException('Audit storage quota exceeded', 'QuotaExceededError');
                    }
                    return original.call(this, key, value);
                };
                const outcome = saveBuilderState(builderConfig());
                const warning = document.querySelector('[data-storage-warning]');
                return { failed: outcome.saved === false, visible: Boolean(warning && !warning.hidden),
                    recoveryAvailable: Boolean(warning?.querySelector('[data-storage-download]')) };
            })()`, returnByValue: true
        });
        storageFailureJourney = storageFailure.result.value;
    }

    let screenshotPath = "";
    if (auditScreenshotDir) {
        await fs.mkdir(auditScreenshotDir, { recursive: true });
        const screenshot = await cdp.send("Page.captureScreenshot", {
            format: "png",
            captureBeyondViewport: false
        });
        const screenshotName = pagePath
            .replace(/[?#].*$/, "")
            .replace(/\.html$/i, "")
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "") || "pagina";
        screenshotPath = path.join(auditScreenshotDir, `${screenshotName}-${auditWidth}x${auditHeight}.png`);
        await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
    }

    if (storageFailureJourney) {
        const recovery = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                window.__auditRestoreStorage();
                const result = saveBuilderState(builderConfig());
                return result.saved && document.querySelector('[data-storage-warning]')?.hidden;
            })()`, returnByValue: true
        });
        storageFailureJourney.recovered = recovery.result.value;
    }

    let lessonFilterJourney = null;
    let lessonMatchColorJourney = null;
    if (localPagePath.endsWith("plataforma/criar-aula.html")) {
        const filterEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const visibleTitles = () => [...document.querySelectorAll('[data-lesson-material-grid] .lesson-sequence-material-card-copy strong')].map((item) => item.textContent.trim());
                const search = document.querySelector('[data-lesson-material-search]');
                if (!search) return { exists: false };

                search.value = 'quiz de fechamento';
                search.dispatchEvent(new Event('input', { bubbles: true }));
                const searchTitles = visibleTitles();
                document.querySelector('[data-clear-lesson-material-filters]')?.click();

                const classFilter = document.querySelector('[data-lesson-material-class-filter]');
                classFilter.value = 'class:6º Ano B';
                classFilter.dispatchEvent(new Event('change', { bubbles: true }));
                const classTitles = visibleTitles();
                document.querySelector('[data-clear-lesson-material-filters]')?.click();

                const typeFilter = document.querySelector('[data-lesson-material-type-filter]');
                typeFilter.value = 'slides';
                typeFilter.dispatchEvent(new Event('change', { bubbles: true }));
                const typeTitles = visibleTitles();
                document.querySelector('[data-clear-lesson-material-filters]')?.click();

                return {
                    exists: true,
                    searchTitles,
                    classTitles,
                    typeTitles,
                    resetCount: visibleTitles().length
                };
            })()`,
            returnByValue: true
        });
        lessonFilterJourney = filterEvaluation.result.value;

        const matchColorEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const blockId = 'lesson-sequence-block-2';
                if (typeof updateBlockDraftControlField !== 'function' || typeof lessonSequenceState !== 'object') {
                    return { exists: false };
                }
                updateBlockDraftControlField(blockId, 'ligar-cores', 'same');
                updateBlockDraftControlField(blockId, 'ligar-cor-unica', '#d946ef');
                const block = lessonSequenceState.blocks.find((item) => item.id === blockId);
                const sameDraft = block?.lessonDraft ? JSON.parse(block.lessonDraft) : null;
                const sameDoc = new DOMParser().parseFromString('<div>' + (sameDraft?.stackHtml || '') + '</div>', 'text/html');
                const sameState = {
                    mode: sameDraft?.controls?.['ligar-cores'] || '',
                    singleColor: sameDraft?.controls?.['ligar-cor-unica'] || '',
                    values: [...sameDoc.querySelectorAll('[data-match-color]')].map((field) => field.value.toLowerCase()),
                    attributes: [...sameDoc.querySelectorAll('[data-match-color]')].map((field) => (field.getAttribute('value') || '').toLowerCase())
                };

                updateBlockDraftControlField(blockId, 'ligar-cores', 'shuffle');
                const shuffleDraft = block?.lessonDraft ? JSON.parse(block.lessonDraft) : null;
                const shuffleDoc = new DOMParser().parseFromString('<div>' + (shuffleDraft?.stackHtml || '') + '</div>', 'text/html');
                return {
                    exists: Boolean(block && sameDraft && shuffleDraft),
                    same: sameState,
                    shuffle: {
                        mode: shuffleDraft?.controls?.['ligar-cores'] || '',
                        values: [...shuffleDoc.querySelectorAll('[data-match-color]')].map((field) => field.value.toLowerCase()),
                        attributes: [...shuffleDoc.querySelectorAll('[data-match-color]')].map((field) => (field.getAttribute('value') || '').toLowerCase())
                    }
                };
            })()`,
            returnByValue: true
        });
        lessonMatchColorJourney = matchColorEvaluation.result.value;
    }

    const expression = `(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
        const offenders = [...document.querySelectorAll('body *')]
            .map((element) => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ element, rect }) => {
                const style = getComputedStyle(element);
                return style.display !== 'none' && style.position !== 'fixed'
                    && (rect.right > viewportWidth + 1 || rect.left < -1);
            })
            .slice(0, 8)
            .map(({ element, rect }) => ({
                tag: element.tagName.toLowerCase(),
                id: element.id || '',
                className: String(element.className || '').slice(0, 100),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width)
            }));
        const flashcardStage = document.querySelector('[data-flashcard-stage]');
        const flashcardRect = flashcardStage?.getBoundingClientRect();
        const flashcardScene = document.querySelector('.flashcards-stage-scene');
        const flashcardSceneRect = flashcardScene?.getBoundingClientRect();
        const flashcardInner = document.querySelector('.flashcards-stage-inner');
        const flashcardInnerRect = flashcardInner?.getBoundingClientRect();
        const flashcardFlip = document.querySelector('[data-flashcard-flip]');
        const flashcardFlipRect = flashcardFlip?.getBoundingClientRect();
        const mindmapRoot = document.querySelector('[data-mind-stage-map]');
        const mindmapRootRect = mindmapRoot?.getBoundingClientRect();
        const mindmapBranches = mindmapRoot ? [...mindmapRoot.querySelectorAll('[data-mind-stage-branch]')] : [];
        const mindmapBranchRects = mindmapBranches.map((branch) => branch.getBoundingClientRect());
        const mindmapOverlapCount = mindmapBranchRects.reduce((total, rect, index) => total + mindmapBranchRects.slice(index + 1).filter((other) => {
            const overlapWidth = Math.min(rect.right, other.right) - Math.max(rect.left, other.left);
            const overlapHeight = Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top);
            return overlapWidth > 2 && overlapHeight > 2;
        }).length, 0);
        const mindmapOutOfBoundsCount = mindmapRootRect ? mindmapBranchRects.filter((rect) => (
            rect.left < mindmapRootRect.left - 1 || rect.right > mindmapRootRect.right + 1
            || rect.top < mindmapRootRect.top - 1 || rect.bottom > mindmapRootRect.bottom + 1
        )).length : 0;
        const mindmapDetail = document.querySelector('[data-mind-stage-detail-text]');
        const mindmapDetailHint = document.querySelector('[data-mind-stage-detail-scroll]');
        const debateCard = document.querySelector('.debate-stage-card');
        const debateQuestionCard = document.querySelector('.debate-stage-step-question-card');
        const debateFormatField = document.getElementById('debate-formato');
        const previewPane = document.querySelector('.activity-preview-pane');
        const previewStyle = previewPane ? getComputedStyle(previewPane) : null;
        const builderNavigator = document.querySelector('[data-builder-item-navigator]');
        const builderNavigatorButtons = [...(builderNavigator?.querySelectorAll('[data-builder-item-target]') || [])];
        const builderCards = [...document.querySelectorAll('.activity-card-stack > .activity-content-card')];
        const lessonPlayerIframe = document.querySelector('[data-lesson-player-iframe]');
        const lessonPlayerDocument = lessonPlayerIframe?.contentDocument;
        const embeddedSlide = lessonPlayerDocument?.querySelector('[data-presentation-slide]');
        const embeddedSlideRect = embeddedSlide?.getBoundingClientRect();
        const embeddedFrame = lessonPlayerDocument?.querySelector('.presentation-frame--solo');
        const embeddedFrameRect = embeddedFrame?.getBoundingClientRect();
        const embeddedCopy = lessonPlayerDocument?.querySelector('.presentation-slide-copy');
        const embeddedMedia = lessonPlayerDocument?.querySelector('.presentation-media');
        const embeddedMediaRect = embeddedMedia?.getBoundingClientRect();
        const embeddedBinaryQuizButtons = [...(lessonPlayerDocument?.querySelectorAll('.quiz-application-options .option-btn.is-binary') || [])];
        const embeddedMatchItems = [...(lessonPlayerDocument?.querySelectorAll('.match-stage-item') || [])];
        const slideLayoutFields = [...document.querySelectorAll('[data-slide-card] [data-field="slide-layout"]')];
        const presentedSlide = document.querySelector('[data-presentation-slide]');
        const presentedSlideRect = presentedSlide?.getBoundingClientRect();
        const presentedCopy = document.querySelector('[data-presentation-copy]');
        const presentedCopyRect = presentedCopy?.getBoundingClientRect();
        const presentedControls = document.querySelector('[data-presentation-controls]');
        const presentedControlsRect = presentedControls?.getBoundingClientRect();
        const presentedProgress = document.querySelector('.presentation-slide-progress');
        const presentedProgressRect = presentedProgress?.getBoundingClientRect();
        const presentedCopyChildren = presentedCopy ? [...presentedCopy.children].filter((element) => {
            const style = getComputedStyle(element);
            return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden';
        }) : [];
        const presentedContentBottom = presentedCopyChildren.reduce((bottom, element) => (
            Math.max(bottom, element.getBoundingClientRect().bottom)
        ), presentedCopyRect?.top || 0);
        const binaryQuizButtons = [...document.querySelectorAll('.quiz-application-options .option-btn.is-binary')];
        const matchStageItems = [...document.querySelectorAll('.match-stage-item')];
        const wordsearchShell = document.querySelector('.wordsearch-stage-board-shell');
        const wordsearchShellRect = wordsearchShell?.getBoundingClientRect();
        const wordsearchGrid = wordsearchShell?.querySelector('.wordsearch-grid-inner');
        const wordsearchGridRect = wordsearchGrid?.getBoundingClientRect();
        const presentationTopbar = document.querySelector('.presentation-topbar');
        const presentationTopbarRect = presentationTopbar?.getBoundingClientRect();
        const presentationTopbarStyle = presentationTopbar ? getComputedStyle(presentationTopbar) : null;
        const projectorModal = document.querySelector('[data-projector-preview-modal]');
        const projectorFrame = document.querySelector('[data-projector-preview-frame]');
        const aiReadyModal = document.querySelector('[data-ai-ready-modal]');
        return {
            viewportWidth,
            scrollWidth,
            overflow: scrollWidth > viewportWidth + 1,
            offenders,
            dashboardReady: document.body?.dataset?.dashboardReady || '',
            dashboardRuntime: typeof window.refreshTeacherDashboard,
            dashboardRecentState: document.querySelector('[data-dashboard-recent-classes]') ? {
                cardCount: document.querySelectorAll('.dashboard-recent-card').length,
                visualCount: document.querySelectorAll('.dashboard-recent-visual').length,
                editActionCount: document.querySelectorAll('.dashboard-recent-card [data-edit-lesson]').length,
                presentActionCount: document.querySelectorAll('.dashboard-recent-card [data-present-lesson]').length
            } : null,
            projectorPreviewState: projectorModal ? {
                visible: !projectorModal.hidden,
                triggerVisible: Boolean(document.querySelector('[data-projector-preview]')),
                framePath: projectorFrame?.getAttribute('src') || '',
                frameWidth: projectorFrame?.contentWindow?.innerWidth || 0,
                frameHeight: projectorFrame?.contentWindow?.innerHeight || 0,
                checks: [...projectorModal.querySelectorAll('[data-projector-check]')].map((item) => ({
                    name: item.dataset.projectorCheck,
                    state: item.dataset.state,
                    copy: item.querySelector('small')?.textContent.trim() || ''
                }))
            } : null,
            aiReadyState: aiReadyModal ? {
                visible: !aiReadyModal.hidden,
                actionCount: aiReadyModal.querySelectorAll('[data-ai-ready-review], [data-ai-ready-projector], [data-ai-ready-present]').length,
                presentPath: aiReadyModal.querySelector('[data-ai-ready-present]')?.getAttribute('href') || ''
            } : null,
            hasPresentation: Boolean(document.querySelector('.presentation-shell')),
            hasPrintAction: Boolean(document.querySelector('[data-presentation-print]')),
            presentationTopbarState: presentationTopbar ? {
                bodyClasses: document.body.className,
                scrollY: Math.round(window.scrollY),
                top: Math.round(presentationTopbarRect?.top || 0),
                bottom: Math.round(presentationTopbarRect?.bottom || 0),
                height: Math.round(presentationTopbarRect?.height || 0),
                opacity: presentationTopbarStyle?.opacity || '',
                transform: presentationTopbarStyle?.transform || '',
                visible: Boolean(presentationTopbarRect && presentationTopbarRect.bottom > 0 && presentationTopbarRect.top < window.innerHeight)
            } : null,
            slideBuilderState: slideLayoutFields.length ? {
                count: slideLayoutFields.length,
                values: slideLayoutFields.map((field) => field.value),
                visibleCount: slideLayoutFields.filter((field) => {
                    const wrapper = field.closest('.platform-field');
                    return getComputedStyle(field).display !== 'none'
                        && !field.hidden
                        && !(wrapper && (wrapper.hidden || getComputedStyle(wrapper).display === 'none'));
                }).length,
                featureOptionCount: slideLayoutFields.reduce((total, field) => total + [...(field.options || [])].filter((option) => option.textContent.toLowerCase().includes('destaque')).length, 0)
            } : null,
            slidePresentationState: presentedSlide ? {
                split: presentedSlide.classList.contains('presentation-slide--split'),
                feature: presentedSlide.classList.contains('presentation-slide--feature'),
                density: [...presentedSlide.classList].find((name) => name.startsWith('presentation-slide--dense') || name.startsWith('presentation-slide--compact') || name.startsWith('presentation-slide--comfort')) || '',
                copyOverflow: Boolean(
                    presentedCopy
                    && presentedSlideRect
                    && presentedCopyRect
                    && (
                        presentedCopy.scrollHeight > presentedCopy.clientHeight + 4
                        || presentedContentBottom > Math.min(presentedCopyRect.bottom, presentedSlideRect.bottom) + 3
                    )
                ),
                controlsClearance: presentedControlsRect && presentedSlideRect
                    ? Math.round(presentedControlsRect.top - presentedSlideRect.bottom)
                    : null,
                progressClearance: presentedProgressRect
                    ? Math.round(presentedProgressRect.top - presentedContentBottom)
                    : null
            } : null,
            wordsearchStageState: wordsearchShell ? {
                shellHeight: Math.round(wordsearchShellRect?.height || 0),
                gridHeight: Math.round(wordsearchGridRect?.height || 0),
                boardContained: Boolean(
                    wordsearchGridRect
                    && wordsearchShellRect
                    && wordsearchGridRect.left >= wordsearchShellRect.left - 1
                    && wordsearchGridRect.right <= wordsearchShellRect.right + 1
                    && wordsearchGridRect.top >= wordsearchShellRect.top - 1
                    && wordsearchGridRect.bottom <= wordsearchShellRect.bottom + 1
                )
            } : null,
            binaryQuizState: binaryQuizButtons.length ? {
                buttonCount: binaryQuizButtons.length,
                buttonTexts: binaryQuizButtons.map((button) => button.textContent.trim()),
                optionTextCounts: binaryQuizButtons.map((button) => button.querySelectorAll('.option-text').length),
                optionLetterCounts: binaryQuizButtons.map((button) => button.querySelectorAll('.option-letter').length)
            } : null,
            matchColorState: matchStageItems.length ? {
                itemCount: matchStageItems.length,
                colors: [...new Set(matchStageItems.map((item) => getComputedStyle(item).getPropertyValue('--match-accent').trim().toLowerCase()))]
            } : null,
            previewScroll: previewPane ? {
                overflowY: previewStyle.overflowY,
                maxHeight: previewStyle.maxHeight,
                position: previewStyle.position
            } : null,
            builderNavigatorState: builderNavigator ? {
                hidden: builderNavigator.hidden,
                position: getComputedStyle(builderNavigator).position,
                itemCount: builderNavigatorButtons.length,
                cardCount: builderCards.length,
                activeCount: builderNavigator.querySelectorAll('[data-builder-item-target].is-active[aria-current="true"]').length,
                countText: builderNavigator.querySelector('[data-builder-item-count]')?.textContent.trim() || '',
                targetsUnique: new Set(builderNavigatorButtons.map((button) => button.dataset.builderItemTarget)).size === builderNavigatorButtons.length,
                allTargetsExist: builderNavigatorButtons.every((button) => document.getElementById(button.dataset.builderItemTarget || ''))
            } : null,
            flashcardState: flashcardStage ? {
                visibility: getComputedStyle(flashcardStage).visibility,
                display: getComputedStyle(flashcardStage).display,
                width: Math.round(flashcardRect?.width || 0),
                height: Math.round(flashcardRect?.height || 0),
                sceneHeight: Math.round(flashcardSceneRect?.height || 0),
                cardBottom: Math.round(flashcardInnerRect?.bottom || 0),
                sceneBottom: Math.round(flashcardSceneRect?.bottom || 0),
                flipTop: Math.round(flashcardFlipRect?.top || 0),
                cardContained: Boolean(flashcardInnerRect && flashcardSceneRect && flashcardInnerRect.bottom <= flashcardSceneRect.bottom + 1),
                flipClearance: flashcardInnerRect && flashcardFlipRect ? Math.round(flashcardFlipRect.top - flashcardInnerRect.bottom) : 0,
                front: document.querySelector('[data-flashcard-front]')?.textContent || '',
                frontSize: getComputedStyle(document.querySelector('[data-flashcard-front]')).fontSize,
                backSize: getComputedStyle(document.querySelector('[data-flashcard-back]')).fontSize,
                noteSize: getComputedStyle(document.querySelector('[data-flashcard-example]')).fontSize
            } : null,
            mindmapState: mindmapRoot ? {
                layout: mindmapRoot.dataset.mindLayout || '',
                branchCount: mindmapBranches.length,
                overlapCount: mindmapOverlapCount,
                outOfBoundsCount: mindmapOutOfBoundsCount,
                hasCentralNode: Boolean(mindmapRoot.querySelector('.mind-stage-central')),
                connectorCount: mindmapRoot.querySelectorAll('.mind-stage-connector').length,
                detailClientHeight: mindmapDetail?.clientHeight || 0,
                detailScrollHeight: mindmapDetail?.scrollHeight || 0,
                detailOverflowY: mindmapDetail ? getComputedStyle(mindmapDetail).overflowY : '',
                detailHintVisible: Boolean(mindmapDetailHint && !mindmapDetailHint.hidden)
            } : null,
            debateState: debateCard ? {
                variant: [...debateCard.classList].find((name) => name.startsWith('debate-variant--')) || '',
                format: document.querySelector('[data-debate-stage-format]')?.textContent.trim() || '',
                progressCount: document.querySelectorAll('[data-debate-stage-jump]').length,
                activeProgress: document.querySelector('[data-debate-stage-jump].is-active')?.textContent.trim() || '',
                sidesVisible: getComputedStyle(document.querySelector('.debate-stage-sides')).display !== 'none',
                cardOverflow: debateCard.scrollHeight > debateCard.clientHeight + 1,
                questionOverflow: debateQuestionCard ? debateQuestionCard.scrollHeight > debateQuestionCard.clientHeight + 1 : false
            } : null,
            debateBuilderState: debateFormatField ? {
                value: debateFormatField.value,
                options: [...debateFormatField.options].map((option) => option.textContent.trim()),
                aiOptions: [...(document.getElementById('debate-formato-ia')?.options || [])].map((option) => option.textContent.trim())
            } : null,
            lessonSequenceState: document.querySelector('[data-lesson-tool-grid]') ? {
                scope: typeof educariaCurrentUserScope === 'function' ? educariaCurrentUserScope() : '',
                libraryCount: typeof readLessonsLibrary === 'function' ? readLessonsLibrary().length : -1,
                blockCount: typeof lessonSequenceState === 'object' && Array.isArray(lessonSequenceState?.blocks) ? lessonSequenceState.blocks.length : -1,
                pickerLength: document.querySelector('[data-lesson-tool-grid]')?.innerHTML.length || 0,
                progressCount: document.querySelectorAll('[data-progress-item-id]').length
            } : null,
            lessonPlayerState: document.querySelector('[data-lesson-player-list]') ? {
                itemCount: document.querySelectorAll('[data-lesson-player-select]').length,
                activeIndex: [...document.querySelectorAll('[data-lesson-player-select]')].findIndex((item) => item.classList.contains('is-active')),
                currentTitle: document.querySelector('[data-lesson-player-current-title]')?.textContent.trim() || '',
                iframePath: lessonPlayerIframe?.getAttribute('src') || '',
                embeddedMode: Boolean(lessonPlayerDocument?.body?.classList.contains('lesson-sequence-embedded')),
                embeddedMaterial: lessonPlayerDocument?.body?.dataset.lessonSequenceMaterial || '',
                childTopbarHidden: lessonPlayerDocument?.querySelector('.presentation-topbar') ? getComputedStyle(lessonPlayerDocument.querySelector('.presentation-topbar')).display === 'none' : false,
                childViewport: lessonPlayerDocument ? {
                    width: lessonPlayerDocument.documentElement.clientWidth,
                    height: lessonPlayerDocument.documentElement.clientHeight
                } : null,
                slideRect: embeddedSlideRect ? {
                    left: Math.round(embeddedSlideRect.left),
                    top: Math.round(embeddedSlideRect.top),
                    right: Math.round(embeddedSlideRect.right),
                    bottom: Math.round(embeddedSlideRect.bottom),
                    width: Math.round(embeddedSlideRect.width),
                    height: Math.round(embeddedSlideRect.height)
                } : null,
                frameRect: embeddedFrameRect ? {
                    width: Math.round(embeddedFrameRect.width),
                    height: Math.round(embeddedFrameRect.height)
                } : null,
                mediaRect: embeddedMediaRect ? {
                    width: Math.round(embeddedMediaRect.width),
                    height: Math.round(embeddedMediaRect.height)
                } : null,
                contentOverflow: Boolean(
                    (embeddedCopy && (embeddedCopy.scrollHeight > embeddedCopy.clientHeight + 1 || embeddedCopy.scrollWidth > embeddedCopy.clientWidth + 1))
                    || (embeddedMedia && (embeddedMedia.scrollHeight > embeddedMedia.clientHeight + 1 || embeddedMedia.scrollWidth > embeddedMedia.clientWidth + 1))
                ),
                slideBox: embeddedSlide ? {
                    clientWidth: embeddedSlide.clientWidth,
                    clientHeight: embeddedSlide.clientHeight,
                    scrollWidth: embeddedSlide.scrollWidth,
                    scrollHeight: embeddedSlide.scrollHeight
                } : null,
                copyBox: embeddedCopy ? {
                    clientHeight: embeddedCopy.clientHeight,
                    scrollHeight: embeddedCopy.scrollHeight
                } : null,
                binaryQuiz: embeddedBinaryQuizButtons.length ? {
                    buttonTexts: embeddedBinaryQuizButtons.map((button) => button.textContent.trim()),
                    optionTextCounts: embeddedBinaryQuizButtons.map((button) => button.querySelectorAll('.option-text').length),
                    optionLetterCounts: embeddedBinaryQuizButtons.map((button) => button.querySelectorAll('.option-letter').length)
                } : null,
                matchColors: embeddedMatchItems.length
                    ? [...new Set(embeddedMatchItems.map((item) => getComputedStyle(item).getPropertyValue('--match-accent').trim().toLowerCase()))]
                    : null
            } : null,
            offlineState: document.documentElement.dataset.educariaOffline || ''
        };
    })()`;
    const evaluation = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
    let builderNavigatorJourney = null;
    if (localPagePath.endsWith("-builder.html") && evaluation.result.value.builderNavigatorState && !evaluation.result.value.builderNavigatorState.hidden) {
        const navigatorEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(async () => {
                const buttons = [...document.querySelectorAll('[data-builder-item-target]')];
                const button = buttons[buttons.length - 1] || buttons[0];
                if (!button) return { exists: false, active: false, focusedWithin: false, targetId: '' };
                const targetId = button.dataset.builderItemTarget || '';
                const card = document.getElementById(targetId);
                button.click();
                await new Promise((resolve) => setTimeout(resolve, 420));
                return {
                    exists: Boolean(card),
                    active: button.classList.contains('is-active') && button.getAttribute('aria-current') === 'true',
                    focusedWithin: Boolean(card && card.contains(document.activeElement)),
                    targetId
                };
            })()`,
            returnByValue: true,
            awaitPromise: true
        });
        builderNavigatorJourney = navigatorEvaluation.result.value;
    }
    let quizJourney = null;
    let libraryRename = null;
    const builderJourneyConfigs = {
        quiz: { path: "quiz-builder.html", field: "#quiz-tema", title: "Quiz de auditoria da jornada", subject: "quiz-disciplina", grade: "quiz-ano" },
        slides: { path: "slides-builder.html", field: '[data-slide-card] [data-field="slide-title"]', title: "Slides de auditoria da jornada", subject: "slides-disciplina", grade: "slides-publico" },
        flashcards: { path: "flashcards-builder.html", field: "#cards-tema", title: "Flashcards de auditoria da jornada", subject: "cards-disciplina", grade: "cards-ano" },
        memory: { path: "jogo-memoria-builder.html", field: "#memoria-titulo", title: "Memória de auditoria da jornada", subject: "memoria-disciplina", grade: "memoria-ano" },
        hangman: { path: "forca-builder.html", field: "#forca-titulo", title: "Forca de auditoria da jornada", subject: "forca-disciplina", grade: "forca-ano" },
        wheel: { path: "roleta-builder.html", field: "#roleta-titulo", title: "Roleta de auditoria da jornada", subject: "roleta-disciplina", grade: "roleta-ano" },
        match: { path: "ligar-pontos-builder.html", field: "#ligar-titulo", title: "Ligar pontos de auditoria da jornada", subject: "ligar-disciplina", grade: "ligar-ano" }
    };
    const builderJourneyType = Object.keys(builderJourneyConfigs)
        .find((type) => pagePath.includes(builderJourneyConfigs[type].path)) || "";
    if (builderJourneyType) {
        const journeyConfig = builderJourneyConfigs[builderJourneyType];
        const journeyFieldSelector = journeyConfig.field;
        const journeyTitle = journeyConfig.title;
        const journeySubjectId = journeyConfig.subject;
        const journeyGradeId = journeyConfig.grade;
        let structuredGeneration = null;
        if (builderJourneyType === "slides") {
            await waitForPageCondition(cdp, "typeof applySlidesFromStructuredData === 'function'");
            const generationEvaluation = await cdp.send("Runtime.evaluate", {
                expression: `(() => {
                    if (typeof applySlidesFromStructuredData !== 'function') return { ok: false, generator: typeof applySlidesFromStructuredData };
                    const applied = applySlidesFromStructuredData({
                        title: 'Revolucao Industrial',
                        visual_mode: 'ai',
                        visual_theme: {
                            name: 'Industria e vapor',
                            rationale: 'Paleta inspirada em metal, carvao e energia a vapor.',
                            font: 'Serifada clássica',
                            accent: '#f59e0b',
                            secondary_accent: '#0ea5e9',
                            background: '#fff7ed',
                            alternate_background: '#e0f2fe',
                            text: '#1e293b',
                            contrast_background: '#292524',
                            contrast_text: '#fafaf9'
                        },
                        slides: [
                            { type: 'cover', title: 'Revolucao Industrial', subtitle: 'Mudancas no trabalho', body: 'Uma nova forma de produzir', teacher_notes: '', image_prompt: '', visual_variant: 'hero', layout: 'stack' },
                            { type: 'content', title: 'A maquina a vapor', subtitle: '', body: 'Energia e mecanizacao', teacher_notes: '', image_prompt: '', visual_variant: 'alternate', layout: 'stack' },
                            { type: 'closing', title: 'O que mudou?', subtitle: '', body: 'Compare permanencias e rupturas', teacher_notes: '', image_prompt: '', visual_variant: 'contrast', layout: 'stack' }
                        ]
                    });
                    const cards = [...document.querySelectorAll('[data-slide-card]')];
                    return {
                        ok: Boolean(
                            applied
                            && cards.length === 3
                            && document.getElementById('slides-visual-mode')?.value === 'ai'
                            && document.getElementById('slides-tema-visual')?.value === 'ia-personalizado'
                            && cards[0].querySelector('[data-field="slide-color"]')?.value.toLowerCase() === '#292524'
                            && cards[1].querySelector('[data-field="slide-color"]')?.value.toLowerCase() === '#e0f2fe'
                            && !document.querySelector('[data-ai-slide-theme-summary]')?.hidden
                        ),
                        applied: Boolean(applied),
                        count: cards.length,
                        visualMode: document.getElementById('slides-visual-mode')?.value || '',
                        preset: document.getElementById('slides-tema-visual')?.value || ''
                    };
                })()`,
                returnByValue: true
            });
            structuredGeneration = generationEvaluation.result.value;
        }
        if (builderJourneyType === "hangman") {
            await waitForPageCondition(cdp, "typeof applyHangmanFromStructuredData === 'function' && typeof applyHangmanTemplateData === 'function'");
            const generationEvaluation = await cdp.send("Runtime.evaluate", {
                expression: `(() => {
                    if (typeof applyHangmanFromStructuredData !== 'function') {
                        return { ok: false, generator: typeof applyHangmanFromStructuredData, template: typeof applyHangmanTemplateData };
                    }
                    const applied = applyHangmanFromStructuredData({
                        title: 'Forca gerada na auditoria',
                        subtitle: 'Descubra conceitos de ciencias.',
                        entries: [
                            { answer: 'CELULA', clue: 'Unidade basica dos seres vivos.', category: 'Biologia' },
                            { answer: 'ATOMO', clue: 'Unidade fundamental da materia.', category: 'Quimica' }
                        ]
                    });
                    const entries = [...document.querySelectorAll('[data-hangman-entry]')];
                    return {
                        ok: Boolean(applied
                        && entries.length === 2
                        && entries[0].querySelector('[data-hangman-answer]')?.value === 'CELULA'
                        && entries[0].querySelector('[data-hangman-clue]')?.value.includes('Unidade basica')),
                        generator: typeof applyHangmanFromStructuredData,
                        template: typeof applyHangmanTemplateData,
                        applied: Boolean(applied),
                        count: entries.length
                    };
                })()`,
                returnByValue: true
            });
            structuredGeneration = generationEvaluation.result.value;
        }
        if (builderJourneyType === "wheel") {
            await waitForPageCondition(cdp, "typeof applyWheelFromStructuredData === 'function'");
            const generationEvaluation = await cdp.send("Runtime.evaluate", {
                expression: `(() => {
                    if (typeof applyWheelFromStructuredData !== 'function') return { ok: false, generator: typeof applyWheelFromStructuredData };
                    const applied = applyWheelFromStructuredData({
                        title: 'Roleta gerada na auditoria',
                        eliminate_used: true,
                        segments: [
                            { text: 'Explique fotossintese', color: '#22c55e' },
                            { text: 'Defina ecossistema', color: '#0ea5e9' }
                        ]
                    });
                    const segments = [...document.querySelectorAll('[data-wheel-segment]')];
                    return { ok: Boolean(applied && segments.length === 2 && segments[0].querySelector('[data-wheel-text]')?.value.includes('fotossintese')), applied: Boolean(applied), count: segments.length };
                })()`,
                returnByValue: true
            });
            structuredGeneration = generationEvaluation.result.value;
        }
        if (builderJourneyType === "match") {
            await waitForPageCondition(cdp, "typeof applyMatchFromStructuredData === 'function'");
            const generationEvaluation = await cdp.send("Runtime.evaluate", {
                expression: `(() => {
                    if (typeof applyMatchFromStructuredData !== 'function') return { ok: false, generator: typeof applyMatchFromStructuredData };
                    const applied = applyMatchFromStructuredData({
                        title: 'Pares gerados na auditoria',
                        left_label: 'Conceito',
                        right_label: 'Definicao',
                        shuffle_right: true,
                        pairs: [
                            { left: 'Celula', right: 'Unidade dos seres vivos', color: '#22c55e' },
                            { left: 'Atomo', right: 'Unidade da materia', color: '#0ea5e9' }
                        ]
                    });
                    const pairs = [...document.querySelectorAll('[data-match-pair]')];
                    return { ok: Boolean(applied && pairs.length === 2 && pairs[0].querySelector('[data-match-left]')?.value === 'Celula' && pairs[0].querySelector('[data-match-right]')?.value.includes('seres vivos')), applied: Boolean(applied), count: pairs.length };
                })()`,
                returnByValue: true
            });
            structuredGeneration = generationEvaluation.result.value;
        }
        await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const topic = document.querySelector(${JSON.stringify(journeyFieldSelector)});
                if (!topic) return false;
                topic.value = ${JSON.stringify(journeyTitle)};
                const subject = document.getElementById(${JSON.stringify(journeySubjectId)});
                const grade = document.getElementById(${JSON.stringify(journeyGradeId)});
                if (subject) subject.value = 'Ciências';
                if (grade) grade.value = '7º ano';
                topic.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            })()`
        });
        await delay(1800);
        const quizEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const lesson = typeof readActiveLesson === 'function' ? readActiveLesson() : null;
                return {
                    status: document.querySelector('[data-builder-save-status], [data-quiz-save-status]')?.dataset.state || '',
                    lessonId: lesson?.id || '',
                    materialType: lesson?.materialType || '',
                    title: lesson?.title || '',
                    subject: lesson?.subject || '',
                    grade: lesson?.grade || ''
                };
            })()`,
            returnByValue: true
        });
        quizJourney = quizEvaluation.result.value;
        quizJourney.structuredGeneration = structuredGeneration;
        await cdp.send("Page.reload");
        await waitForPageCondition(cdp, "document.readyState === 'complete'");
        await delay(500);
        const recoveryEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const lesson = typeof readActiveLesson === 'function' ? readActiveLesson() : null;
                return {
                    lessonId: lesson?.id || '',
                    materialType: lesson?.materialType || '',
                    status: document.querySelector('[data-builder-save-status], [data-quiz-save-status]')?.dataset.state || ''
                };
            })()`,
            returnByValue: true
        });
        quizJourney.journeyType = builderJourneyType;
        quizJourney.recovered = recoveryEvaluation.result.value?.lessonId === quizJourney.lessonId
            && recoveryEvaluation.result.value?.materialType === builderJourneyType;
        await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const button = document.querySelector('[data-save-lesson][data-save-scope="library"]');
                if (!button) return false;
                button.dataset.saveTarget = '#audit-saved';
                button.click();
                return true;
            })()`
        });
        await delay(350);
        const readyEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const lesson = typeof readActiveLesson === 'function' ? readActiveLesson() : null;
                return lesson?.status || '';
            })()`,
            returnByValue: true
        });
        quizJourney.explicitReady = readyEvaluation.result.value === "ready";
    }
    if (pagePath.includes("biblioteca.html")) {
        await cdp.send("Runtime.evaluate", {
            expression: `document.querySelector('[data-rename-lesson]')?.click()`
        });
        await delay(150);
        const renameEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const modal = document.querySelector('[data-rename-modal]');
                const input = modal?.querySelector('[data-rename-modal-input]');
                if (!modal || modal.hidden || !input) return { opened: false, renamed: false };
                input.value = 'Quiz renomeado na auditoria';
                modal.querySelector('[data-rename-modal-confirm]')?.click();
                const lesson = typeof readLessonsLibrary === 'function'
                    ? readLessonsLibrary().find((item) => item.id === 'lesson-library-audit')
                    : null;
                return { opened: true, renamed: lesson?.title === 'Quiz renomeado na auditoria' };
            })()`,
            returnByValue: true
        });
        libraryRename = renameEvaluation.result.value;
    }
    let mobileMenu = null;
    if (pageConfig.authenticated && auditMobile) {
        const sidebarEvaluation = await cdp.send("Runtime.evaluate", {
            expression: "Boolean(document.querySelector('.app-sidebar'))",
            returnByValue: true
        });
        if (sidebarEvaluation.result.value) {
        await waitForPageCondition(cdp, "Boolean(document.querySelector('[data-sidebar-mobile-toggle]'))");
        await cdp.send("Runtime.evaluate", {
            expression: `document.querySelector('[data-sidebar-mobile-toggle]')?.click()`
        });
        await waitForPageCondition(cdp, `(() => {
            const sidebar = document.querySelector('.app-sidebar');
            const rect = sidebar?.getBoundingClientRect();
            return Boolean(rect && rect.left >= -1 && rect.right > 0);
        })()`, 15);
        const menuEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(() => {
                const button = document.querySelector('[data-sidebar-mobile-toggle]');
                const sidebar = document.querySelector('.app-sidebar');
                const rect = sidebar?.getBoundingClientRect();
                return {
                    exists: Boolean(button && sidebar),
                    expanded: button?.getAttribute('aria-expanded') === 'true',
                    bodyOpen: document.body.classList.contains('app-sidebar-open'),
                    visible: Boolean(rect && rect.left >= -1 && rect.right > 0)
                };
            })()`,
            returnByValue: true
        });
        mobileMenu = menuEvaluation.result.value;
        }
    }
    let topbarRestore = null;
    if (evaluation.result.value.hasPresentation) {
        const restoreEvaluation = await cdp.send("Runtime.evaluate", {
            expression: `(async () => {
                const toggle = document.querySelector('[data-presentation-topbar]');
                const restore = document.querySelector('[data-presentation-topbar-restore]');
                if (!toggle || !restore) return { exists: false, collapsed: false, visible: false, restored: false };
                toggle.click();
                await new Promise((resolve) => setTimeout(resolve, 240));
                const collapsed = document.body.classList.contains('presentation-topbar-collapsed');
                const restoreStyle = getComputedStyle(restore);
                const restoreRect = restore.getBoundingClientRect();
                const visible = restoreRect.width > 0
                    && restoreRect.bottom > 0
                    && restoreStyle.pointerEvents !== 'none'
                    && Number(restoreStyle.opacity) > 0.5;
                restore.click();
                await new Promise((resolve) => setTimeout(resolve, 240));
                return {
                    exists: true,
                    collapsed,
                    visible,
                    restored: !document.body.classList.contains('presentation-topbar-collapsed'),
                    opacity: restoreStyle.opacity,
                    pointerEvents: restoreStyle.pointerEvents,
                    rect: { top: Math.round(restoreRect.top), bottom: Math.round(restoreRect.bottom), width: Math.round(restoreRect.width) }
                };
            })()`,
            returnByValue: true,
            awaitPromise: true
        });
        topbarRestore = restoreEvaluation.result.value;
    }
    let recoveryJourney = null;
    let imageUploadJourney = null;
    if (auditRecovery && localPagePath === "plataforma/index.html") recoveryJourney = await checkQuickRecovery(cdp, url, auditScreenshotDir);
    if (auditRecovery && ["plataforma/slides-builder.html", "plataforma/criar-aula.html"].includes(localPagePath)) {
        imageUploadJourney = await checkImageUpload(cdp, localPagePath.endsWith("criar-aula.html"));
    }
    cdp.close();
    return { ...evaluation.result.value, mobileMenu, topbarRestore, builderNavigatorJourney, quizJourney, libraryRename, lessonFilterJourney, lessonMatchColorJourney, storageFailureJourney, recoveryJourney, imageUploadJourney, screenshotPath, diagnostics: cdp.diagnostics };
}

let failed = false;
try {
    await waitForDebugger();
    for (const page of pages) {
        const result = await auditPage(page);
        console.log(`${page.path}: viewport=${result.viewportWidth} scroll=${result.scrollWidth} overflow=${result.overflow}`);
        if (result.recoveryJourney) console.log(`  quick-ai-recovery=ok ${JSON.stringify(result.recoveryJourney)}`);
        if (result.imageUploadJourney) console.log(`  image-upload=ok ${JSON.stringify(result.imageUploadJourney)}`);
        if (result.storageFailureJourney) {
            const storageWorks = result.storageFailureJourney.failed && result.storageFailureJourney.visible
                && result.storageFailureJourney.recoveryAvailable && result.storageFailureJourney.recovered;
            console.log(`  storage-failure-recovery=${storageWorks ? "ok" : "failed"} state=${JSON.stringify(result.storageFailureJourney)}`);
            if (!storageWorks) failed = true;
        }
        if (page.path.includes("plataforma/index.html")) {
            console.log(`  dashboard-ready=${result.dashboardReady || "missing"} runtime=${result.dashboardRuntime}`);
            if (auditSeedDashboard) {
                const dashboardRecentWorks = result.dashboardRecentState?.cardCount === 3
                    && result.dashboardRecentState?.visualCount === 2
                    && result.dashboardRecentState?.editActionCount === 2
                    && result.dashboardRecentState?.presentActionCount === 2;
                console.log(`  dashboard-recent=${dashboardRecentWorks ? "ok" : "failed"} state=${JSON.stringify(result.dashboardRecentState)}`);
                if (!dashboardRecentWorks) failed = true;
            }
        }
        if (auditBuilderOverlay === "projector" && page.path.includes("-builder.html")) {
            const projectorWorks = result.projectorPreviewState?.visible
                && result.projectorPreviewState?.triggerVisible
                && result.projectorPreviewState?.frameWidth === 1280
                && result.projectorPreviewState?.frameHeight === 720
                && result.projectorPreviewState?.checks.length === 3
                && result.projectorPreviewState?.checks.every((check) => check.state !== "pending");
            console.log(`  projector-preview=${projectorWorks ? "ok" : "failed"} state=${JSON.stringify(result.projectorPreviewState)}`);
            if (!projectorWorks) failed = true;
        }
        if (auditBuilderOverlay === "ai-ready" && page.path.includes("-builder.html")) {
            const aiReadyWorks = result.aiReadyState?.visible
                && result.aiReadyState?.actionCount === 3
                && Boolean(result.aiReadyState?.presentPath);
            console.log(`  ai-ready-review=${aiReadyWorks ? "ok" : "failed"} state=${JSON.stringify(result.aiReadyState)}`);
            if (!aiReadyWorks) failed = true;
        }
        if (result.screenshotPath) console.log(`  screenshot=${result.screenshotPath}`);
        if (result.diagnostics?.length) console.log(`  browser-errors=${JSON.stringify(result.diagnostics)}`);
        if (result.overflow) {
            failed = true;
            result.offenders.forEach((offender) => console.log(`  ${JSON.stringify(offender)}`));
        }
        if (result.hasPresentation) {
            console.log(`  topbar-initial=${JSON.stringify(result.presentationTopbarState)}`);
            console.log(`  print-action=${result.hasPrintAction ? "ok" : "failed"}`);
            if (!result.hasPrintAction) failed = true;
            const restoreWorks = result.topbarRestore?.exists
                && result.topbarRestore.collapsed
                && result.topbarRestore.visible
                && result.topbarRestore.restored;
            console.log(`  topbar-restore=${restoreWorks ? "ok" : "failed"}${restoreWorks ? "" : ` state=${JSON.stringify(result.topbarRestore)}`}`);
            if (!restoreWorks) failed = true;
        }
        if (result.flashcardState) {
            const flashcardLayoutWorks = result.flashcardState.cardContained && result.flashcardState.flipClearance >= 8;
            console.log(`  flashcard-stage=${flashcardLayoutWorks ? "ok" : "failed"} state=${JSON.stringify(result.flashcardState)}`);
            if (!flashcardLayoutWorks) failed = true;
        }
        if (result.mindmapState) console.log(`  mindmap-stage=${JSON.stringify(result.mindmapState)}`);
        if (result.debateState) console.log(`  debate-stage=${JSON.stringify(result.debateState)}`);
        if (result.debateBuilderState) console.log(`  debate-builder=${JSON.stringify(result.debateBuilderState)}`);
        if (result.slideBuilderState) {
            const slideBuilderUsesSplitOnly = result.slideBuilderState.visibleCount === 0
                && result.slideBuilderState.featureOptionCount === 0
                && result.slideBuilderState.values.every((value) => value === "Lado a lado");
            console.log(`  slide-layout-control=${slideBuilderUsesSplitOnly ? "ok" : "failed"} state=${JSON.stringify(result.slideBuilderState)}`);
            if (!slideBuilderUsesSplitOnly) failed = true;
        }
        if (result.slidePresentationState) {
            const slidePresentationWorks = result.slidePresentationState.split
                && !result.slidePresentationState.feature
                && !result.slidePresentationState.copyOverflow
                && (result.slidePresentationState.controlsClearance === null || result.slidePresentationState.controlsClearance >= 8)
                && (result.slidePresentationState.progressClearance === null || result.slidePresentationState.progressClearance >= 6);
            console.log(`  slide-presentation-layout=${slidePresentationWorks ? "ok" : "failed"} state=${JSON.stringify(result.slidePresentationState)}`);
            if (!slidePresentationWorks) failed = true;
        }
        if (result.wordsearchStageState) {
            console.log(`  wordsearch-board=${result.wordsearchStageState.boardContained ? "ok" : "failed"} state=${JSON.stringify(result.wordsearchStageState)}`);
            if (!result.wordsearchStageState.boardContained) failed = true;
        }
        if (result.binaryQuizState) {
            const binaryQuizLabelsWork = result.binaryQuizState.buttonCount === 2
                && result.binaryQuizState.buttonTexts.join('|') === 'Verdadeiro|Falso'
                && result.binaryQuizState.optionTextCounts.every((count) => count === 1)
                && result.binaryQuizState.optionLetterCounts.every((count) => count === 0);
            console.log(`  binary-quiz-labels=${binaryQuizLabelsWork ? "ok" : "failed"} state=${JSON.stringify(result.binaryQuizState)}`);
            if (!binaryQuizLabelsWork) failed = true;
        }
        if (result.matchColorState) {
            const matchSingleColorWorks = result.matchColorState.itemCount === 4
                && result.matchColorState.colors.length === 1
                && result.matchColorState.colors[0] === '#7c3aed';
            console.log(`  match-single-color=${matchSingleColorWorks ? "ok" : "failed"} state=${JSON.stringify(result.matchColorState)}`);
            if (!matchSingleColorWorks) failed = true;
        }
        if (result.lessonSequenceState) console.log(`  lesson-sequence=${JSON.stringify(result.lessonSequenceState)}`);
        if (result.lessonPlayerState) {
            console.log(`  lesson-player=${JSON.stringify(result.lessonPlayerState)}`);
            if (result.lessonPlayerState.embeddedMaterial === 'quiz') {
                const embeddedBinaryQuizWorks = result.lessonPlayerState.binaryQuiz?.buttonTexts?.join('|') === 'Verdadeiro|Falso'
                    && result.lessonPlayerState.binaryQuiz.optionTextCounts.every((count) => count === 1)
                    && result.lessonPlayerState.binaryQuiz.optionLetterCounts.every((count) => count === 0);
                console.log(`  embedded-binary-quiz-labels=${embeddedBinaryQuizWorks ? "ok" : "failed"}`);
                if (!embeddedBinaryQuizWorks) failed = true;
            }
            if (result.lessonPlayerState.embeddedMaterial === 'match') {
                const embeddedMatchShuffleWorks = result.lessonPlayerState.matchColors?.length === 2
                    && result.lessonPlayerState.matchColors.includes('#f59e0b')
                    && result.lessonPlayerState.matchColors.includes('#6366f1');
                console.log(`  embedded-match-shuffled-colors=${embeddedMatchShuffleWorks ? "ok" : "failed"}`);
                if (!embeddedMatchShuffleWorks) failed = true;
            }
        }
        if (result.lessonFilterJourney) {
            const lessonFiltersWork = result.lessonFilterJourney.exists
                && result.lessonFilterJourney.searchTitles.length === 1
                && result.lessonFilterJourney.searchTitles[0] === "Quiz de fechamento"
                && result.lessonFilterJourney.classTitles.length === 1
                && result.lessonFilterJourney.classTitles[0] === "Ciclo da água"
                && result.lessonFilterJourney.typeTitles.length === 2
                && result.lessonFilterJourney.resetCount === 4;
            console.log(`  lesson-filters=${lessonFiltersWork ? "ok" : "failed"} state=${JSON.stringify(result.lessonFilterJourney)}`);
            if (!lessonFiltersWork) failed = true;
        }
        if (result.lessonMatchColorJourney) {
            const lessonMatchColorWorks = result.lessonMatchColorJourney.exists
                && result.lessonMatchColorJourney.same.mode === 'same'
                && result.lessonMatchColorJourney.same.singleColor === '#d946ef'
                && result.lessonMatchColorJourney.same.values.length === 2
                && result.lessonMatchColorJourney.same.values.every((color) => color === '#d946ef')
                && result.lessonMatchColorJourney.same.attributes.every((color) => color === '#d946ef')
                && result.lessonMatchColorJourney.shuffle.mode === 'shuffle'
                && new Set(result.lessonMatchColorJourney.shuffle.values).size === 2
                && result.lessonMatchColorJourney.shuffle.values.every((color, index) => color === result.lessonMatchColorJourney.shuffle.attributes[index]);
            console.log(`  lesson-match-color-edit=${lessonMatchColorWorks ? "ok" : "failed"} state=${JSON.stringify(result.lessonMatchColorJourney)}`);
            if (!lessonMatchColorWorks) failed = true;
        }
        if (result.previewScroll && !auditMobile) {
            const previewScrollWorks = result.previewScroll.overflowY === "auto"
                && result.previewScroll.maxHeight !== "none"
                && result.previewScroll.position === "sticky";
            console.log(`  preview-scroll=${previewScrollWorks ? "ok" : "failed"}`);
            if (!previewScrollWorks) failed = true;
        }
        if (result.builderNavigatorState && !auditMobile) {
            const navigatorStartsHidden = page.path.includes("new=1");
            const builderNavigatorWorks = result.builderNavigatorState.hidden === navigatorStartsHidden
                && result.builderNavigatorState.position === "sticky"
                && result.builderNavigatorState.itemCount === result.builderNavigatorState.cardCount
                && result.builderNavigatorState.itemCount > 0
                && result.builderNavigatorState.activeCount === 1
                && result.builderNavigatorState.targetsUnique
                && result.builderNavigatorState.allTargetsExist;
            console.log(`  builder-item-navigator=${builderNavigatorWorks ? "ok" : "failed"} state=${JSON.stringify(result.builderNavigatorState)}`);
            if (!builderNavigatorWorks) failed = true;
            if (!navigatorStartsHidden) {
                const builderNavigatorJourneyWorks = result.builderNavigatorJourney?.exists
                    && result.builderNavigatorJourney?.active
                    && result.builderNavigatorJourney?.focusedWithin;
                console.log(`  builder-item-jump=${builderNavigatorJourneyWorks ? "ok" : "failed"} state=${JSON.stringify(result.builderNavigatorJourney)}`);
                if (!builderNavigatorJourneyWorks) failed = true;
            }
        }
        if (auditBaseUrl) {
            console.log(`  offline-registration=${result.offlineState || "missing"}`);
            if (result.offlineState !== "registered") failed = true;
        }
        if (result.quizJourney) {
            const journeyWorks = ["local", "saved"].includes(result.quizJourney.status)
                && Boolean(result.quizJourney.lessonId)
                && result.quizJourney.materialType === result.quizJourney.journeyType
                && result.quizJourney.subject === "Ciências"
                && result.quizJourney.grade === "7º ano"
                && result.quizJourney.recovered
                && result.quizJourney.explicitReady
                && (!["slides", "hangman", "wheel", "match"].includes(result.quizJourney.journeyType) || result.quizJourney.structuredGeneration?.ok);
            console.log(`  ${result.quizJourney.journeyType}-autosave=${journeyWorks ? "ok" : "failed"}`);
            if (!journeyWorks) {
                failed = true;
                console.log(`  quiz-autosave-state=${JSON.stringify(result.quizJourney)}`);
            }
        }
        if (result.libraryRename) {
            const renameWorks = result.libraryRename.opened && result.libraryRename.renamed;
            console.log(`  library-rename=${renameWorks ? "ok" : "failed"}`);
            if (!renameWorks) failed = true;
        }
        if (page.authenticated && result.mobileMenu) {
            const menuWorks = result.mobileMenu?.exists && result.mobileMenu.expanded
                && result.mobileMenu.bodyOpen && result.mobileMenu.visible;
            console.log(`  mobile-menu=${menuWorks ? "ok" : "failed"}`);
            if (!menuWorks) {
                failed = true;
                console.log(`  mobile-menu-state=${JSON.stringify(result.mobileMenu)}`);
            }
        }
    }
} finally {
    if (chrome.exitCode === null) {
        const exited = new Promise((resolve) => chrome.once("exit", resolve));
        chrome.kill();
        const stoppedGracefully = await Promise.race([
            exited.then(() => true),
            delay(3000).then(() => false)
        ]);
        if (!stoppedGracefully && chrome.exitCode === null) {
            const forcedExit = new Promise((resolve) => chrome.once("exit", resolve));
            chrome.kill("SIGKILL");
            await Promise.race([forcedExit, delay(3000)]);
        }
    }

    await fs.rm(profilePath, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 250
    });
}

if (failed) process.exitCode = 1;
