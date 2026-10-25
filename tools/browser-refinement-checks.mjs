import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { until } from "./browser-recovery-checks.mjs";
import { refinementFixtures, refinementWords } from "./fixtures/item-refinement.mjs";

async function evaluate(cdp, expression) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
}

// Synthetic accounts and HTTP responses only; real editors, previews, auth guards,
// selection, request serialization and draft persistence run in isolated Chrome.
export async function checkItemRefinement(cdp, screenshotDir = "") {
    await until(cdp, "window.EducariaItemRefinementAdapters && document.readyState === 'complete'");
    await evaluate(cdp, `(() => {
        const type = document.body.dataset.materialType;
        const fixtures = ${JSON.stringify(refinementFixtures)}, words = ${JSON.stringify(refinementWords)};
        if (type === 'quiz') applyQuizFromStructuredData({ title: 'Energia', questions: Array.from({length:8}, (_, i) => ({
            type: i === 4 ? 'true_false' : i === 7 ? 'short_answer' : 'multiple_choice', prompt: 'Questão ' + (i+1),
            options: ['Sol', 'Pedra', 'Areia', 'Solo'], correct_answer: i === 4 ? 'true' : 'Sol', explanation: 'O Sol emite luz.', model_answer: 'O Sol é uma estrela.', criteria: 'Reconhecer a estrela.' })) });
        if (type === 'slides') {
            applySlidesFromStructuredData({title:'Energia', slides:Array.from({length:4}, (_,i)=>({...fixtures.slides,title:'Energia '+(i+1),type:'content'}))});
            const image = document.querySelectorAll('[data-field="slide-image-url"]')[2];
            image.value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
        }
        if (type === 'worksheet') EducariaWorksheetBuilder.apply({ title: 'Energia', order: ['wordtrail','connections','wordsearch','crossword'],
            activities: Object.fromEntries(['wordtrail','connections','wordsearch','crossword'].map(t => [t, { instruction:'Leia e responda.', ...(t === 'connections'
                ? { rounds: [{ answer:'Sol', clues:fixtures.connections.clues.split('\\n'), explanation:fixtures.connections.explanation }] }
                : { words:words.slice(0,4).map(term=>({term,clue:'Pista sobre '+term})) }) }])) });
        if (type === 'wordtrail' || type === 'connections') {
            const payload = type === 'wordtrail' ? { title:'Energia', words:words.slice(0,5).map(term=>({term,clue:'Pista sobre '+term})) }
                : { title:'Energia', rounds:[{answer:'Sol',clues:fixtures.connections.clues.split('\\n'),explanation:fixtures.connections.explanation},{answer:'Lua',clues:['Orbita a Terra','É um satélite','Reflete a luz solar'],explanation:'As pistas indicam a Lua.'}] };
            EducariaDiscoveryBuilder.apply(payload);
        }
        document.querySelectorAll('details.editor-disclosure, [data-worksheet-manual], .lesson-sequence-inline-editor').forEach(node=>{if(node.tagName==='DETAILS')node.open=true;});
        const a = window.__refinementAudit = { fixtures, words, type, calls:0, groups: () => EducariaItemRefinementAdapters.groups() };
        a.snapshot = () => a.groups().map(g=>({type:g.type,items:g.cards().map(g.read)}));
        const originalFetch=window.fetch;
        window.fetch=async (url,options)=> {
            if(options?.body instanceof FormData && options.body.has('refinement')) {
                a.calls++; a.request=JSON.parse(options.body.get('refinement')); a.requestType=options.body.get('materialType');
                return new Promise(resolve=>{a.resolve=(items,status=200)=>resolve(new Response(JSON.stringify(status===200
                    ? {ok:true,operation:'refine-item',materialType:a.requestType,material:{items},charge:{cost:3},credits:{remaining:497}}
                    : {error:'Limite temporário. Tente novamente.',credits:{remaining:497}}),{status,headers:{'Content-Type':'application/json'}}));});
            }
            return originalFetch(url,options);
        };
        a.toolbar = () => a.group.host.matches('[data-worksheet-activity]') ? a.group.host.querySelector('.item-refinement-toolbar') : a.group.host.previousElementSibling;
        a.setup = index => {
            a.group=a.groups()[index]; const g=a.group;
            const changes=g.cards().map((card,i)=>{
                const existing=g.read(card), base=existing.kind==='true_false' || existing.kind==='short_answer' ? existing : fixtures[g.type];
                const patch={...base}; delete patch.kind;
                if('term' in patch) patch.term=words[i%words.length];
                if(['crossword','hangman'].includes(g.type))patch.answer=words[i%words.length];
                return {card,patch};
            });
            g.commit(changes);
            a.before=a.snapshot();
            a.visual=()=>g.cards().map(card=>[...card.querySelectorAll('[type=color], [data-field="slide-image-url"], [data-field="slide-illustration"]')].map(n=>n.value));
            a.visualBefore=a.visual();
            a.indices=a.type==='quiz'?[2,4,7]:a.type==='slides'?[2]:g.cards().length>1?[0,g.cards().length-1]:[0];
            a.open=()=>{
                a.toolbar().querySelector('[data-refine-selection-mode]').click();
                a.indices.forEach(i=>g.cards()[i].querySelector('[data-refine-select]').click());
                a.toolbar().querySelector('[data-refine-selected]').click();
            };
            a.submit=()=>{a.resolve=null;const d=document.querySelector('.item-refinement-dialog');d.querySelector('textarea').value='Refaça os selecionados com exemplos para o 6º ano.';d.querySelector('form').requestSubmit();};
            a.answer=()=>{
                const items=Object.fromEntries(a.request.items.map(({id,item})=>{
                    const patch=Object.fromEntries(EducariaItemRefinement.selectedKeys(g.type,item,a.request.field).map(key=>[key,item[key]]));
                    const key=g.type==='quiz'?'prompt':g.type==='slides'?'body':Object.keys(patch).at(-1);
                    patch[key]='Conteúdo ajustado '+id+'. Exemplo do cotidiano.';
                    return [id,patch];
                }));a.resolve(items);
            };
        };
    })()`);
    await until(cdp,"__refinementAudit.groups().length && document.querySelector('[data-refine-item]')");
    const groups = await evaluate(cdp,"__refinementAudit.groups().map(g=>g.type)");
    for(let index=0;index<groups.length;index++) {
        await evaluate(cdp, `__refinementAudit.setup(${index})`);
        await until(cdp,"__refinementAudit.group.cards().every(card=>card.querySelector('[data-refine-item]'))");
        await evaluate(cdp,"__refinementAudit.open(); __refinementAudit.submit()");
        await until(cdp,"__refinementAudit.resolve");
        assert.deepEqual(await evaluate(cdp,"__refinementAudit.request.items.map(i=>i.id)"),await evaluate(cdp,"__refinementAudit.indices.map(i=>'item-'+(i+1))"));
        await evaluate(cdp,"__refinementAudit.answer()");
        await until(cdp,"!document.querySelector('[data-refine-apply]').hidden");
        assert.equal(await evaluate(cdp,"JSON.stringify(__refinementAudit.snapshot())===JSON.stringify(__refinementAudit.before)"),true,'Preview must not change saved fields');
        assert.equal(await evaluate(cdp,"(()=>{const d=document.querySelector('.item-refinement-dialog');return d.scrollWidth<=d.clientWidth+1 && d.querySelector('footer').getBoundingClientRect().bottom<=innerHeight && d.contains(document.activeElement)})()"),true,'Modal fits the viewport with accessible controls');
        if(screenshotDir && index===0) {
            await fs.mkdir(screenshotDir,{recursive:true});
            const label=await evaluate(cdp,"document.body.dataset.materialType+'-'+innerWidth+'x'+innerHeight");
            const shot=await cdp.send('Page.captureScreenshot',{format:'png'});
            await fs.writeFile(path.join(screenshotDir,label+'-refinement.png'),Buffer.from(shot.data,'base64'));
        }
        // Approve one item, deliberately skip the other selected suggestions.
        await evaluate(cdp,"[...document.querySelectorAll('[data-refine-approve]')].slice(1).forEach(c=>c.click());document.querySelector('[data-refine-apply]').click()");
        await until(cdp,"!document.querySelector('.item-refinement-dialog')");
        assert.equal(await evaluate(cdp,`(()=>{const a=__refinementAudit,after=a.snapshot();return after.every((g,i)=>g.items.every((item,j)=>
            i===${index}&&j===a.indices[0]?JSON.stringify(item)!==JSON.stringify(a.before[i].items[j]):JSON.stringify(item)===JSON.stringify(a.before[i].items[j])))
            &&JSON.stringify(a.visual())===JSON.stringify(a.visualBefore)})()`),true,'Only the approved item changes, including across lesson/worksheet groups');
        await evaluate(cdp,"__refinementAudit.toolbar().querySelector('[data-undo-refinement]').click()");
        assert.equal(await evaluate(cdp,"JSON.stringify(__refinementAudit.snapshot())===JSON.stringify(__refinementAudit.before)"),true,'Undo restores original content');
        // Apply the complete batch and then undo, testing nonadjacent selections.
        await evaluate(cdp,"__refinementAudit.open();__refinementAudit.submit()");
        await until(cdp,"__refinementAudit.resolve");
        await evaluate(cdp,"__refinementAudit.answer()");
        await until(cdp,"!document.querySelector('[data-refine-apply]').hidden");
        await evaluate(cdp,"document.querySelector('[data-refine-apply]').click()");
        await until(cdp,"!document.querySelector('.item-refinement-dialog')");
        assert.equal(await evaluate(cdp,`(()=>{const a=__refinementAudit;return a.snapshot()[${index}].items.every((item,j)=>(JSON.stringify(item)!==JSON.stringify(a.before[${index}].items[j]))===a.indices.includes(j))})()`),true,'All and only selected items change');
        await evaluate(cdp,"__refinementAudit.toolbar().querySelector('[data-undo-refinement]').click()");
        // Cancel, provider errors and late responses after an account event.
        for(const mode of ['cancel','failure','account']) {
            await evaluate(cdp,"__refinementAudit.group.cards()[0].querySelector('[data-refine-item]').click();__refinementAudit.submit()");
            await until(cdp,"__refinementAudit.resolve");
            if(mode==='failure') {
                await evaluate(cdp,"__refinementAudit.resolve(null,429)");
                await until(cdp,"document.querySelector('[data-refine-status]').dataset.error==='true'");
                await evaluate(cdp,"document.querySelector('[data-refine-close]').click()");
            } else if(mode==='account') {
                await evaluate(cdp,"document.dispatchEvent(new Event('educaria-auth-changed'));__refinementAudit.answer()");
            } else {
                await evaluate(cdp,"__refinementAudit.answer()");
                await until(cdp,"!document.querySelector('[data-refine-apply]').hidden");
                await evaluate(cdp,"document.querySelector('[data-refine-close]').click()");
            }
            await until(cdp,"!document.querySelector('.item-refinement-dialog') && !document.querySelector('[data-refine-item]').disabled");
            assert.equal(await evaluate(cdp,"JSON.stringify(__refinementAudit.snapshot())===JSON.stringify(__refinementAudit.before)"),true,mode+' must preserve content');
        }
        // A new manual edit must take precedence over an in-flight AI request.
        await evaluate(cdp,"__refinementAudit.group.cards()[0].querySelector('[data-refine-item]').click();__refinementAudit.submit()");
        await until(cdp,"__refinementAudit.resolve");
        await evaluate(cdp,"(()=>{const a=__refinementAudit,g=a.group,c=g.cards()[0],item=g.read(c),key=Object.keys(item).filter(k=>k!=='kind').at(-1);g.commit([{card:c,patch:{[key]:'Mudança manual mais recente'}}]);a.manual=a.snapshot();a.answer()})()");
        await until(cdp,"document.querySelector('[data-refine-status]').dataset.error==='true'");
        assert.equal(await evaluate(cdp,"JSON.stringify(__refinementAudit.snapshot())===JSON.stringify(__refinementAudit.manual) && document.querySelector('[data-refine-apply]').hidden"),true,'Stale response must be discarded');
        await evaluate(cdp,"document.querySelector('[data-refine-close]').click()");
        await until(cdp,"!document.querySelector('.item-refinement-dialog')");
        // Leave an applied AI result to verify real persistence below.
        await evaluate(cdp,"__refinementAudit.group.cards()[0].querySelector('[data-refine-item]').click();__refinementAudit.submit()");
        await until(cdp,"__refinementAudit.resolve");
        await evaluate(cdp,"__refinementAudit.answer()");
        await until(cdp,"!document.querySelector('[data-refine-apply]').hidden");
        await evaluate(cdp,"document.querySelector('[data-refine-apply]').click()");
        await until(cdp,"!document.querySelector('.item-refinement-dialog')");
    }
    const pageType=await evaluate(cdp,"__refinementAudit.type");
    if(['mindmap','debate'].includes(pageType)) {
        await evaluate(cdp,`(()=>{const a=__refinementAudit,prefix=a.type==='mindmap'?'mind':'debate';
            for(let i=0;i<(a.type==='debate'?4:1);i++)document.querySelector('[data-'+prefix+'-add]').click();
            a.beforeNew=a.snapshot(); const card=a.group.cards().at(-1);
            card.querySelectorAll('input:not([type=color]):not([type=checkbox]),textarea').forEach(n=>n.value='');
        })()`);
        await until(cdp,"__refinementAudit.group.cards().at(-1).querySelector('[data-refine-item]')");
        await evaluate(cdp,"__refinementAudit.group.cards().at(-1).querySelector('[data-refine-item]').click();__refinementAudit.submit()");
        await until(cdp,"__refinementAudit.resolve");
        await evaluate(cdp,"__refinementAudit.resolve({[__refinementAudit.request.items[0].id]:__refinementAudit.fixtures[__refinementAudit.type]})");
        await until(cdp,"!document.querySelector('[data-refine-apply]').hidden");
        await evaluate(cdp,"document.querySelector('[data-refine-apply]').click()");
        await until(cdp,"!document.querySelector('.item-refinement-dialog')");
        assert.equal(await evaluate(cdp,"JSON.stringify(__refinementAudit.snapshot()[0].items.slice(0,-1))===JSON.stringify(__refinementAudit.beforeNew[0].items.slice(0,-1))"),true,'Completing a new item preserves the preceding content');
    }
    const saved=await evaluate(cdp,`(()=>{const a=__refinementAudit;if(a.type==='lesson')persistLessonSequence();else forceSyncDraftFromPage(a.type);
        return {values:a.snapshot(),type:a.type,storage:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('educaria:builder:')).map(k=>[k,localStorage.getItem(k)]))}})()`);
    // Fixture initialization must not overwrite the draft when reloading a lesson.
    if(saved.type==='lesson') await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`Object.entries(${JSON.stringify(saved.storage)}).forEach(([k,v])=>localStorage.setItem(k,v));`});
    await cdp.send('Page.reload');
    await until(cdp,"document.readyState==='complete' && !window.__refinementAudit && window.EducariaItemRefinementAdapters?.groups().length && document.querySelector('[data-refine-item]')");
    const restored=await evaluate(cdp,"EducariaItemRefinementAdapters.groups().map(g=>({type:g.type,items:g.cards().map(g.read)}))");
    assert.deepEqual(restored,saved.values,'Applied changes survive reload');
    return {groups,batch:true,partialApproval:true,undo:true,cancel:true,failure:true,stale:true,accountChange:true,reload:true};
}
