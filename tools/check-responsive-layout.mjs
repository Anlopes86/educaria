import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const root = path.resolve(import.meta.dirname, "..");
const auditBaseUrl = process.env.EDUCARIA_AUDIT_BASE_URL || "";
const auditWidth = Math.max(320, Number(process.env.EDUCARIA_AUDIT_WIDTH || 390));
const auditHeight = Math.max(480, Number(process.env.EDUCARIA_AUDIT_HEIGHT || 844));
const auditScreenshotDir = process.env.EDUCARIA_AUDIT_SCREENSHOT_DIR
    ? path.resolve(process.env.EDUCARIA_AUDIT_SCREENSHOT_DIR)
    : "";
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
        await cdp.send("Network.setBlockedURLs", { urls: ["*gstatic.com/firebasejs/*"] });
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:auth:teacher-cache', JSON.stringify({ uid: 'layout-audit', name: 'Professor Auditoria', email: 'auditoria@educaria.test', institution: 'Escola de Teste', role: 'teacher', plan: 'free' })); localStorage.setItem('educaria:auth:session', 'auditoria@educaria.test');${pagePath.includes("biblioteca.html") ? ` localStorage.setItem('educaria:lessons:layout-audit', JSON.stringify([{ id: 'lesson-library-audit', className: '', scope: 'library', title: 'Quiz para renomear', summary: 'Atividade de auditoria', type: 'Quiz', materialType: 'quiz', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'draft', draft: '' }]));` : ""}`
        });
    }
    if (localPagePath.endsWith("plataforma/apresentacao.html")) {
        const slideStack = `
            <section data-slide-card data-slide-type="cover">
                <input data-field="slide-title" value="Como a tecnologia transforma a aprendizagem">
                <input data-field="slide-subtitle" value="Uma conversa sobre escolhas, oportunidades e responsabilidade">
                <textarea data-field="slide-body">Observe o que já mudou\nCompare diferentes experiências\nPrepare uma pergunta para a turma</textarea>
                <select data-field="slide-image-mode"><option selected>Sem imagem</option></select>
                <select data-field="slide-layout"><option selected>Lado a lado</option></select>
                <textarea data-field="slide-image-prompt"></textarea>
                <input data-field="slide-image-url" value="">
                <select data-field="slide-font"><option selected>Destaque moderno</option></select>
                <input data-field="slide-accent-color" value="#2dd4bf">
                <input data-field="slide-color" value="#102a43">
                <input data-field="slide-text-color" value="#f8fafc">
            </section>
        `;
        await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
            source: `localStorage.setItem('educaria:builder:slides:guest', ${JSON.stringify(JSON.stringify({ stackHtml: slideStack }))});`
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
    if (pagePath.includes("biblioteca.html")) {
        await waitForPageCondition(cdp, "Boolean(document.querySelector('[data-library-count]')?.textContent.trim() && document.querySelector('[data-library-materials] details'))", 80);
    }
    if (auditBaseUrl) {
        await waitForPageCondition(cdp, "Boolean(document.documentElement.dataset.educariaOffline)");
    }
    await delay(250);

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
        const previewPane = document.querySelector('.activity-preview-pane');
        const previewStyle = previewPane ? getComputedStyle(previewPane) : null;
        return {
            viewportWidth,
            scrollWidth,
            overflow: scrollWidth > viewportWidth + 1,
            offenders,
            dashboardReady: document.body?.dataset?.dashboardReady || '',
            dashboardRuntime: typeof window.refreshTeacherDashboard,
            hasPresentation: Boolean(document.querySelector('.presentation-shell')),
            hasPrintAction: Boolean(document.querySelector('[data-presentation-print]')),
            previewScroll: previewPane ? {
                overflowY: previewStyle.overflowY,
                maxHeight: previewStyle.maxHeight,
                position: previewStyle.position
            } : null,
            flashcardState: flashcardStage ? {
                visibility: getComputedStyle(flashcardStage).visibility,
                display: getComputedStyle(flashcardStage).display,
                width: Math.round(flashcardRect?.width || 0),
                height: Math.round(flashcardRect?.height || 0),
                front: document.querySelector('[data-flashcard-front]')?.textContent || ''
            } : null,
            offlineState: document.documentElement.dataset.educariaOffline || ''
        };
    })()`;
    const evaluation = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
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
    cdp.close();
    return { ...evaluation.result.value, mobileMenu, topbarRestore, quizJourney, libraryRename, screenshotPath, diagnostics: cdp.diagnostics };
}

let failed = false;
try {
    await waitForDebugger();
    for (const page of pages) {
        const result = await auditPage(page);
        console.log(`${page.path}: viewport=${result.viewportWidth} scroll=${result.scrollWidth} overflow=${result.overflow}`);
        if (page.path.includes("plataforma/index.html")) {
            console.log(`  dashboard-ready=${result.dashboardReady || "missing"} runtime=${result.dashboardRuntime}`);
        }
        if (result.screenshotPath) console.log(`  screenshot=${result.screenshotPath}`);
        if (result.diagnostics?.length) console.log(`  browser-errors=${JSON.stringify(result.diagnostics)}`);
        if (result.overflow) {
            failed = true;
            result.offenders.forEach((offender) => console.log(`  ${JSON.stringify(offender)}`));
        }
        if (result.hasPresentation) {
            console.log(`  print-action=${result.hasPrintAction ? "ok" : "failed"}`);
            if (!result.hasPrintAction) failed = true;
            const restoreWorks = result.topbarRestore?.exists
                && result.topbarRestore.collapsed
                && result.topbarRestore.visible
                && result.topbarRestore.restored;
            console.log(`  topbar-restore=${restoreWorks ? "ok" : "failed"}${restoreWorks ? "" : ` state=${JSON.stringify(result.topbarRestore)}`}`);
            if (!restoreWorks) failed = true;
        }
        if (result.flashcardState) console.log(`  flashcard-stage=${JSON.stringify(result.flashcardState)}`);
        if (result.previewScroll && !auditMobile) {
            const previewScrollWorks = result.previewScroll.overflowY === "auto"
                && result.previewScroll.maxHeight !== "none"
                && result.previewScroll.position === "sticky";
            console.log(`  preview-scroll=${previewScrollWorks ? "ok" : "failed"}`);
            if (!previewScrollWorks) failed = true;
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
                && (!["hangman", "wheel", "match"].includes(result.quizJourney.journeyType) || result.quizJourney.structuredGeneration?.ok);
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
