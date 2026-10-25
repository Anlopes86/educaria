import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { until } from "./browser-recovery-checks.mjs";
import { diagramExamples } from "./fixtures/slide-diagrams.mjs";

async function evaluate(cdp, expression) {
    const response = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
}

export async function checkSlideIllustration(cdp, screenshotDir = "") {
    await until(cdp, "document.querySelector('[data-generate-slide-illustration]')");
    await evaluate(cdp, `(() => {
        applySlidesFromStructuredData({ title:'Energia', slides:Array.from({length:3},(_,i)=>({title:'Energia '+(i+1),subtitle:'Fontes de energia',body:'A energia do Sol é captada pela planta e transferida pela alimentação.',type:'content'})) });
        const a=window.__illustrationAudit={diagram:${JSON.stringify(diagramExamples[0])},calls:0};
        a.cards=()=>[...document.querySelectorAll('[data-slides-stack] [data-slide-card]')];
        a.snapshot=()=>a.cards().map(c=>[...c.querySelectorAll('[data-field]')].map(n=>[n.dataset.field,n.value]));
        a.card=()=>a.cards()[1];
        EducariaSlideDiagramEditing.writeField(a.card(),'slide-image-url','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==');
        EducariaSlideDiagramEditing.writeField(a.card(),'slide-image-mode','Enviar imagem');
        a.before=a.snapshot();
        a.open=()=>{a.card().querySelector('[data-generate-slide-illustration]').click()};
        a.submit=()=>{a.resolve=null;document.querySelector('.slide-illustration-generator textarea').value='Mostre o caminho da energia em etapas.';document.querySelector('.slide-illustration-generator').requestSubmit()};
        a.cancel=()=>document.querySelector('[data-illustration-cancel]').click();
        const original=window.fetch;
        window.fetch=async(url,options)=>{
            if(options?.body instanceof FormData && options.body.has('slideIllustration')) {
                a.calls++;a.request=JSON.parse(options.body.get('slideIllustration'));
                return new Promise(resolve=>{a.resolve=(status=200,material={illustration:a.diagram},operation='illustrate-slide')=>resolve(new Response(JSON.stringify(status===200
                    ? {ok:true,materialType:'slides',operation,material,charge:{cost:7},credits:{remaining:493}}
                    : {error:'Limite temporário. Tente novamente.'}),{status,headers:{'Content-Type':'application/json'}}))});
            }
            return original(url,options);
        };
    })()`);
    await until(cdp, "__illustrationAudit.cards().every(c=>c.querySelector('[data-generate-slide-illustration]'))");
    await evaluate(cdp, "__illustrationAudit.open();__illustrationAudit.submit()");
    await until(cdp, "__illustrationAudit.resolve");
    const request = await evaluate(cdp, "__illustrationAudit.request");
    assert.equal(request.title, "Energia 2"); assert.equal(request.instruction, "Mostre o caminho da energia em etapas.");
    assert.equal(Object.hasOwn(request, "imageUrl"), false);
    await evaluate(cdp, "__illustrationAudit.resolve()");
    await until(cdp, "!document.querySelector('[data-illustration-apply]').hidden && document.querySelector('[data-illustration-preview]').naturalWidth>0");
    assert.equal(await evaluate(cdp, "JSON.stringify(__illustrationAudit.snapshot())===JSON.stringify(__illustrationAudit.before)"), true, "Preview must not alter the original image or text");
    assert.equal(await evaluate(cdp, "document.querySelector('[data-illustration-status]').textContent.includes('7 créditos')"), true);
    assert.equal(await evaluate(cdp, "(()=>{const r=document.querySelector('.slide-diagram-dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"), true);
    if (screenshotDir) {
        await fs.mkdir(screenshotDir, { recursive: true });
        const size = await evaluate(cdp, "innerWidth+'x'+innerHeight");
        const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
        await fs.writeFile(path.join(screenshotDir, `slide-illustration-${size}.png`), Buffer.from(shot.data, "base64"));
    }
    await evaluate(cdp, "document.querySelector('[data-illustration-apply]').click()");
    await until(cdp, "!document.querySelector('.slide-illustration-generator')");
    assert.equal(await evaluate(cdp, `(()=>{const a=__illustrationAudit,after=a.snapshot();return [0,2].every(i=>JSON.stringify(after[i])===JSON.stringify(a.before[i]))
        &&a.before[1].filter(([key])=>!['slide-image-url','slide-image-mode','slide-image-prompt','slide-layout','slide-illustration'].includes(key)).every(([key,v])=>a.card().querySelector('[data-field="'+key+'"]').value===v)
        &&!!EducariaSlideDiagramEditing.decode(...(()=>{const {data,url}=EducariaSlideDiagramEditing.readCard(a.card());return[data,url]})())})()`), true, "Only the selected image changes and remains editable");
    await until(cdp, "!__illustrationAudit.card().querySelector('[data-edit-slide-diagram]').hidden");
    // Cancellation, server failure and old full-deck responses cannot overwrite the result.
    await evaluate(cdp, "__illustrationAudit.before=__illustrationAudit.snapshot()");
    for (const mode of ["cancel", "failure", "old-server", "invalid"]) {
        await evaluate(cdp, "__illustrationAudit.open();__illustrationAudit.submit()");
        await until(cdp, "__illustrationAudit.resolve");
        if (mode === "cancel") {
            await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
            await until(cdp, "!document.querySelector('.slide-illustration-generator')");
            await evaluate(cdp, "__illustrationAudit.resolve()");
        } else {
            await evaluate(cdp, mode === "failure" ? "__illustrationAudit.resolve(429)" : mode === "old-server"
                ? "__illustrationAudit.resolve(200,{slides:[]},'generate')" : "__illustrationAudit.resolve(200,{illustration:{version:2,status:'ready'}})");
            await until(cdp, "document.querySelector('[data-illustration-status]').dataset.error==='true'");
            await evaluate(cdp, "__illustrationAudit.cancel()");
        }
        await until(cdp, "!document.querySelector('.slide-illustration-generator') && !__illustrationAudit.card().querySelector('[data-generate-slide-illustration]').disabled");
        assert.equal(await evaluate(cdp, "JSON.stringify(__illustrationAudit.snapshot())===JSON.stringify(__illustrationAudit.before)"), true, mode);
    }
    await evaluate(cdp, "__illustrationAudit.open();__illustrationAudit.submit()");
    await until(cdp, "__illustrationAudit.resolve");
    await evaluate(cdp, "__illustrationAudit.card().querySelector('[data-field=slide-body]').value='Uma revisão manual mais recente';__illustrationAudit.resolve()");
    await until(cdp, "document.querySelector('[data-illustration-status]').dataset.error==='true'");
    assert.equal(await evaluate(cdp, "document.querySelector('[data-illustration-apply]').hidden"), true);
    await evaluate(cdp, "__illustrationAudit.cancel();document.querySelector('[data-action=add-slide]').click()");
    await until(cdp, "__illustrationAudit.cards().length===4 && __illustrationAudit.cards()[3].querySelector('[data-generate-slide-illustration]')");
    const saved = await evaluate(cdp, "(()=>{forceSyncDraftFromPage('slides');return __illustrationAudit.snapshot()})()");
    await cdp.send("Page.reload");
    await until(cdp, "document.readyState==='complete' && !window.__illustrationAudit && document.querySelectorAll('[data-generate-slide-illustration]').length===4");
    const restored = await evaluate(cdp, "[...document.querySelectorAll('[data-slides-stack] [data-slide-card]')].map(c=>[...c.querySelectorAll('[data-field]')].map(n=>[n.dataset.field,n.value]))");
    // The existing builder normalizes a new blank card's hidden layout on reload.
    const normalized = saved.map(fields => fields.map(([name, value]) => [name, name === "slide-layout" && !value ? "Lado a lado" : value]));
    assert.deepEqual(restored, normalized, "Images, editable diagrams and text survive reload");
    return { preview: true, apply: true, isolated: true, editable: true, cancel: true, errors: true, stale: true, newSlides: true, reload: true };
}
