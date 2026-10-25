import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { until } from "./browser-recovery-checks.mjs";

async function evaluate(cdp, expression) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
}

export async function checkContextHelp(cdp, screenshotDir) {
    await until(cdp, "document.querySelector('[data-context-help-trigger]')");
    const initial = await evaluate(cdp, `(() => {
        const advanced=document.querySelector('.editor-advanced-options');
        return { closed:advanced?!advanced.open:null, repeatedJourney:!!document.querySelector('[data-editor-journey]'),
            movedStatus:!!document.querySelector('[role=status][popover], [role=alert][popover]') };
    })()`);
    assert.equal(initial.movedStatus, false);
    assert.equal(initial.repeatedJourney, false);
    assert.notEqual(initial.closed, false, 'Optional slide settings start collapsed');
    await evaluate(cdp, `(() => {
        const button=document.querySelector('[data-context-help-trigger]');
        window.__helpCheck={button,tip:document.getElementById(button.dataset.contextHelpTrigger),clicks:0};
        button.addEventListener('click',()=>__helpCheck.clicks++,true);
        for(let p=button.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
        button.scrollIntoView({block:'center'});
        __helpCheck.values=[...document.querySelectorAll('input,select,textarea')].map(n=>n.value);
    })()`);
    await until(cdp,"__helpCheck.button.getBoundingClientRect().height>0");
    const rect=await evaluate(cdp,"(()=>{const r=__helpCheck.button.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});
    await until(cdp,"__helpCheck.tip.matches(':popover-open')");
    assert.equal(await evaluate(cdp,"__helpCheck.button.getAttribute('aria-expanded')==='true' && __helpCheck.button.getAttribute('aria-controls')===__helpCheck.tip.id"),true);
    const fits=await evaluate(cdp,"(()=>{const r=__helpCheck.tip.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()");
    assert.equal(fits,true,'Help stays inside the viewport');
    if(screenshotDir){
        await fs.mkdir(screenshotDir,{recursive:true});
        const label=await evaluate(cdp,"location.pathname.split('/').at(-1).replace('.html','')+'-'+innerWidth+'x'+innerHeight");
        const shot=await cdp.send('Page.captureScreenshot',{format:'png'});
        await fs.writeFile(path.join(screenshotDir,label+'-help.png'),Buffer.from(shot.data,'base64'));
    }
    await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until(cdp,"!__helpCheck.tip.matches(':popover-open')");
    // A focused help button opens for keyboard users; Enter pins it until dismissed.
    await evaluate(cdp,"__helpCheck.button.focus()");
    await until(cdp,"__helpCheck.tip.matches(':popover-open')");
    assert.equal(await evaluate(cdp,"document.activeElement===__helpCheck.button"),true,'Help keeps keyboard focus on its trigger');
    await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});
    await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert.equal(await evaluate(cdp,"__helpCheck.clicks"),1,'Enter activates the focused help button');
    await evaluate(cdp,"__helpCheck.button.click()");
    await until(cdp,"!__helpCheck.tip.matches(':popover-open')");
    // Click/tap does not submit a form or change any selected values.
    await evaluate(cdp,"__helpCheck.button.click()");
    await until(cdp,"__helpCheck.tip.matches(':popover-open')");
    await evaluate(cdp,"__helpCheck.button.click()");
    await until(cdp,"!__helpCheck.tip.matches(':popover-open')");
    assert.equal(await evaluate(cdp,"JSON.stringify(__helpCheck.values)===JSON.stringify([...document.querySelectorAll('input,select,textarea')].map(n=>n.value))"),true);
    const mobile = await evaluate(cdp, "innerWidth <= 600");
    if (mobile) {
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        await evaluate(cdp,"__helpCheck.button.blur();__helpCheck.button.scrollIntoView({block:'center'})");
        const touch = await evaluate(cdp,"(()=>{const r=__helpCheck.button.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
        for (const open of [true, false]) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await until(cdp, `__helpCheck.tip.matches(':popover-open') === ${open}`);
        }
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    }
    // Text updated by existing option handlers is also updated in the help.
    if(await evaluate(cdp,"!!document.getElementById('slides-detalhamento')")) {
        await evaluate(cdp,"document.getElementById('slides-detalhamento').selectedIndex=2;document.getElementById('slides-detalhamento').dispatchEvent(new Event('change',{bubbles:true}))");
        assert.match(await evaluate(cdp,"document.getElementById('slides-detalhamento-help').textContent"), /60–110/);
        assert.equal(await evaluate(cdp,"document.getElementById('slides-illustration-feedback').hasAttribute('popover')"),false);
    }
    // Dynamically inserted optional hints use the same component. Status stays inline.
    await evaluate(cdp, `(()=>{const host=document.createElement('div');host.id='help-fixture';host.innerHTML='<small data-context-help="Ajuda dinâmica">Explicação adicional</small><p role="status" data-context-help="Aviso">Erro de validação</p>';document.querySelector('main').append(host)})()`);
    await until(cdp,"document.querySelector('#help-fixture [data-context-help-trigger]')");
    assert.equal(await evaluate(cdp,"!document.querySelector('#help-fixture [role=status]').hasAttribute('popover')"),true);
    await evaluate(cdp,"document.getElementById('help-fixture').remove()");
    return {hover:true,keyboard:true,click:true,touch:mobile,escape:true,viewport:true,valuesPreserved:true,statusVisible:true};
}
