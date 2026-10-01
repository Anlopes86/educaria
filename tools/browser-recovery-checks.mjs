import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

async function evaluate(cdp, expression) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
}
async function until(cdp, expression) {
    for (let i = 0; i < 60; i++) {
        if (await evaluate(cdp, expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`Browser recovery check timed out: ${expression}`);
}

async function navigate(cdp, url) {
    await evaluate(cdp, "window.__recoveryPreviousDocument = true");
    await cdp.send(url ? "Page.navigate" : "Page.reload", url ? { url } : {});
    await until(cdp, "!window.__recoveryPreviousDocument && document.readyState === 'complete'");
}

export async function checkQuickRecovery(cdp, dashboardUrl, screenshotDir = "") {
    const records = await evaluate(cdp, `(() => {
        const api = window.educariaGenerationRecovery;
        const quiz = api.create({ ownerUid: api.currentUid(), topic: 'Fotossíntese', materialType: 'quiz', className: '7º ano B', label: 'Quiz',
            payload: { material: { title: 'Ciências', questions: [{ type: 'multiple_choice', prompt: 'O que as plantas produzem?', options: ['Oxigênio', 'Areia'], correct_answer: 0, explanation: 'A fotossíntese libera oxigênio.' }] }, charge: { cost: 12 } } });
        quiz.createdAt -= 86400000;
        const slides = api.create({ ownerUid: api.currentUid(), topic: 'Fotossíntese', materialType: 'slides', className: '', label: 'Slides',
            payload: { material: { slides: [{ type: 'cover', title: 'Energia para a vida', body: 'As plantas transformam luz em energia química.' }] }, charge: { cost: 9 } } });
        api.save(quiz); api.save(slides); restoreDashboardQuickResults(true);
        return { quiz, slides };
    })()`);
    await navigate(cdp);
    await until(cdp, `document.readyState === 'complete' && document.querySelector('[data-dashboard-ai-result-modal]')?.hidden === false`);
    assert.equal(await evaluate(cdp, `window.educariaGenerationRecovery.list().length`), 2);
    assert.equal(await evaluate(cdp, `document.querySelector('[data-dashboard-ai-result-topic]').textContent`), "Fotossíntese");
    assert.equal(await evaluate(cdp, `(() => {
        const card = document.querySelector('.dashboard-ai-result-card'); const rect = card.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && card.scrollWidth <= card.clientWidth;
    })()`), true);
    if (screenshotDir) {
        const screenshot = await cdp.send("Page.captureScreenshot", { format: "png" });
        await fs.mkdir(screenshotDir, { recursive: true });
        await fs.writeFile(path.join(screenshotDir, "quick-ai-recovery-modal.png"), Buffer.from(screenshot.data, "base64"));
    }
    const keyboard = await evaluate(cdp, `(() => {
        const first = document.querySelector('[data-dashboard-ai-result-edit]'); first.focus();
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
        return document.activeElement.hasAttribute('data-dashboard-ai-result-later');
    })()`);
    assert.equal(keyboard, true);
    await evaluate(cdp, `document.querySelector('[data-dashboard-ai-result-later]').click()`);
    assert.equal(await evaluate(cdp, `document.querySelector('[data-dashboard-ai-result-resume]').hidden`), false);
    await evaluate(cdp, `document.querySelector('[data-dashboard-ai-result-resume]').click(); document.querySelector('[data-dashboard-ai-result-edit]').click();`);
    await until(cdp, `location.pathname.endsWith('quiz-builder.html') && typeof readActiveLesson === 'function' && !window.educariaQuickImportPending && Boolean(readActiveLesson()?.draft)`);
    const lessonId = `lesson-ai-${records.quiz.id}`;
    const saved = await evaluate(cdp, `readActiveLesson()`);
    assert.equal(saved.id, lessonId); assert.equal(saved.className, "7º ano B"); assert.match(saved.draft, /O que as plantas produzem/);
    assert.equal(await evaluate(cdp, `window.educariaGenerationRecovery.list().length`), 1);

    await evaluate(cdp, `(() => {
        const field = document.querySelector('[data-field="prompt"]'); field.value = 'Revisão feita pelo professor';
        field.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await until(cdp, `readActiveLesson()?.draft?.includes('Revisão feita pelo professor')`);
    // Simulate the narrow window where the library saved but removing the pending key failed.
    const replayUrl = await evaluate(cdp, `(() => {
        const record = ${JSON.stringify(records.quiz)}; window.educariaGenerationRecovery.save(record);
        return new URL(window.educariaGenerationRecovery.editorUrl(record), location.href).href;
    })()`);
    await navigate(cdp, replayUrl);
    await until(cdp, `location.pathname.endsWith('quiz-builder.html') && !location.search.includes('quickApply') && document.querySelector('[data-field="prompt"]')?.value === 'Revisão feita pelo professor'`);
    assert.equal(await evaluate(cdp, `readLessonsLibrary().filter((lesson) => lesson.id === ${JSON.stringify(lessonId)}).length`), 1);

    await navigate(cdp, dashboardUrl);
    await until(cdp, `document.readyState === 'complete' && document.querySelector('[data-dashboard-ai-result-tool]')?.textContent === 'Slides'`);
    await evaluate(cdp, `document.querySelector('[data-dashboard-ai-result-present]').click()`);
    await until(cdp, `location.pathname.endsWith('/apresentacao.html') && document.body?.textContent.includes('Energia para a vida')`);
    const editorIntact = await evaluate(cdp, `(() => {
        const saved = JSON.parse(localStorage.getItem(educariaScopedKey('educaria:lessons'))).find((lesson) => lesson.id === ${JSON.stringify(`lesson-ai-${records.slides.id}`)});
        return JSON.parse(saved.draft).stackHtml === readSlidesDraft().stackHtml;
    })()`);
    assert.equal(editorIntact, true, "Opening the presentation must not rewrite the editor draft");
    const inlinePreservesControls = await evaluate(cdp, `(() => {
        const original = '<section data-slide-card><input data-field="slide-title" value=""></section>' + readSlidesDraft().stackHtml;
        const slides = parseSlideCards(original); slides[0].title = 'Edição na apresentação';
        const doc = new DOMParser().parseFromString(serializeSlideCards(slides, original), 'text/html');
        return doc.querySelectorAll('[data-slide-card]').length === 2
            && doc.querySelector('[data-slide-card] [data-field="slide-title"]').value === ''
            && doc.querySelectorAll('[data-slide-card]')[1].querySelector('[data-field="slide-title"]').value === 'Edição na apresentação'
            && Boolean(doc.querySelector('[data-upload-input]'));
    })()`);
    assert.equal(inlinePreservesControls, true);
    return { recoveredAfterReload: true, multipleResults: true, classPreserved: true, keyboard: true, replayPreservedEdits: true, presentation: true, editorIntact, inlinePreservesControls };
}

export async function checkImageUpload(cdp, inline = false) {
    const result = await evaluate(cdp, `(async () => {
        const canvas = document.createElement('canvas'); canvas.width = 3200; canvas.height = 1800;
        const ctx = canvas.getContext('2d'); const gradient = ctx.createLinearGradient(0, 0, 3200, 1800);
        gradient.addColorStop(0, '#a5f3fc'); gradient.addColorStop(1, '#6366f1'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 3200, 1800);
        ctx.fillStyle = '#0f172a'; ctx.font = 'bold 120px Arial'; ctx.fillText('Fotossíntese', 160, 900);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], 'fotossintese.png', { type: 'image/png' });
        const encoded = await window.educariaImages.optimize(file);
        const decoded = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = encoded; });
        let invalidRejected = false; let oversizeRejected = false;
        try { await window.educariaImages.optimize(new File(['not an image'], 'bad.png', { type: 'image/png' })); } catch { invalidRejected = true; }
        try { await window.educariaImages.optimize(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })); } catch { oversizeRejected = true; }
        let uploaded = false; let canceled = true; let mode = ''; let legacyControlsRestored = true;
        if (${inline}) {
            const field = document.querySelector('[data-block-draft-file]');
            if (!field) throw new Error('Inline slide upload field missing');
            const blockId = field.dataset.blockDraftFile; const transfer = new DataTransfer(); transfer.items.add(file); field.files = transfer.files;
            await uploadLessonSlideImage(field);
            const draft = JSON.parse(lessonSequenceState.blocks.find((block) => block.id === blockId).lessonDraft);
            const doc = new DOMParser().parseFromString(draft.stackHtml, 'text/html');
            uploaded = doc.querySelector('[data-field="slide-image-url"]').value === encoded;
            mode = doc.querySelector('[data-field="slide-image-mode"]').value;
        } else {
            const card = document.querySelector('[data-slide-card]'); const input = card.querySelector('[data-upload-input]');
            if (!input || !card.querySelector('[data-field="slide-image-url"]')) throw new Error('Slide image controls missing: ' + card.outerHTML.slice(0, 1200));
            await handleLocalUpload(card, file, input);
            uploaded = card.querySelector('[data-field="slide-image-url"]').value === encoded;
            mode = card.querySelector('[data-field="slide-image-mode"]').value;
            const optimize = window.educariaImages.optimize; let finish;
            window.educariaImages.optimize = () => new Promise((resolve) => { finish = resolve; });
            try {
                const pending = handleLocalUpload(card, file, input);
                const select = card.querySelector('[data-field="slide-image-mode"]'); select.value = 'Sem imagem'; select.dispatchEvent(new Event('change', { bubbles: true }));
                finish(encoded); await pending;
                canceled = card.querySelector('[data-field="slide-image-url"]').value === '';
            } finally { window.educariaImages.optimize = optimize; }
            const oldTitle = card.querySelector('[data-field="slide-title"]').value;
            card.querySelector('[data-field="slide-image-mode"]').remove();
            card.querySelector('[data-image-panel]').remove();
            card.querySelectorAll('[data-open-resource]').forEach((button) => button.remove());
            normalizeSlideBuilder(document.querySelector('[data-slides-stack]'));
            legacyControlsRestored = Boolean(card.querySelector('[data-upload-input]') && card.querySelector('[data-field="slide-image-mode"]'))
                && card.querySelector('[data-field="slide-title"]').value === oldTitle;
        }
        return { width: decoded.naturalWidth, height: decoded.naturalHeight, length: encoded.length, invalidRejected, oversizeRejected, uploaded, canceled, mode, legacyControlsRestored };
    })()`);
    assert.ok(result.width <= 1600 && result.height <= 1000 && result.length <= 160 * 1024);
    assert.ok(result.invalidRejected && result.oversizeRejected && result.uploaded && result.canceled && result.legacyControlsRestored);
    assert.ok(["Upload", "Enviar imagem"].includes(result.mode));
    return result;
}
