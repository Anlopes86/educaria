import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { buildUsageExport } from "../../ai-service/ai-usage-export.js";
import { parseUsageQuery } from "../../ai-service/ai-usage-analytics.js";
import { usageTestSnapshot, usageTestTime } from "../fixtures/ai-usage.mjs";
const source = await fs.readFile(new URL("../../assets/js/admin-usage-export.js",import.meta.url),"utf8");
const payload = () => ({ ok:true, report:buildUsageExport(usageTestSnapshot(45),parseUsageQuery({}),usageTestTime) });
function harness() {
    const windowEvents = {}, documentEvents = {}, formEvents = {}, buttonEvents = {};
    const calls = [], files = [], revoked = [], dispatched = [], timers = new Map(), blobs = new Map();
    const label = { textContent:"Exportar relatório" }, feedback = { textContent:"" };
    const button = { disabled:true, querySelector:()=>label, addEventListener:(type,fn)=>{buttonEvents[type]=fn;} };
    const form = { values:{days:"30",materialType:"all",status:"all",cohort:"limited",uid:"private-selected-account"},
        addEventListener:(type,fn)=>{formEvents[type]=fn;} };
    const root = {querySelector:selector=>selector === "form" ? form : selector === "[data-usage-export]" ? button : feedback};
    let timerId = 0, urlId = 0;
    const scope = { AbortController, Blob, Intl, Date, JSON, Error,
        FormData:class { constructor(target){return Object.entries(target.values);} },
        CustomEvent:class { constructor(type,options){this.type=type;this.detail=options.detail;} },
        setTimeout:fn=>{timers.set(++timerId,fn);return timerId;}, clearTimeout:id=>timers.delete(id),
        URL:{createObjectURL:blob=>{const url=`blob:local-${++urlId}`;blobs.set(url,blob);return url;},revokeObjectURL:url=>revoked.push(url)},
        document:{querySelector:()=>root,body:{append(){}},
            createElement:()=>({click(){files.push({name:this.download,url:this.href,blob:blobs.get(this.href)});},remove(){}}),
            addEventListener:(type,fn)=>{documentEvents[type]=fn;},dispatchEvent:event=>dispatched.push(event)},
        window:{addEventListener:(type,fn)=>{windowEvents[type]=fn;},educariaAdminApi:{request:async(...args)=>{calls.push(args);return payload();}}}
    };
    vm.runInNewContext(source,scope);
    return { scope, calls, files, revoked, dispatched, timers, label, feedback, button, form, windowEvents, documentEvents, formEvents,
        api:scope.window.educariaAdminUsageExport, click:()=>buttonEvents.click() };
}
test("export is unavailable until the protected usage report has loaded",async()=>{
    const h=harness(); await h.click(); assert.equal(h.calls.length,0); assert.equal(h.button.disabled,true);
    h.api.enable(); assert.equal(h.button.disabled,false);
});
test("export sends all current filters once, downloads JSON and releases its temporary URL",async()=>{
    const h=harness(); h.api.enable(); await h.click();
    assert.equal(h.calls.length,1); assert.equal(h.calls[0][0],"/usage/export");
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][1])),h.form.values);
    assert.equal(h.calls[0][1].page,undefined); assert.equal(h.files.length,1);
    assert.match(h.files[0].name,/^educaria-uso-ia-2026-10-13T18-00-00-000Z\.json$/);
    const downloaded=JSON.parse(await h.files[0].blob.text());
    assert.equal(downloaded.events.length,45); assert.equal(downloaded.summary.generations,45);
    assert.doesNotMatch(JSON.stringify(downloaded),/private-user-|private-selected-account|private-event-/);
    assert.equal(h.files[0].blob.type,"application/json;charset=utf-8");
    assert.match(h.feedback.textContent,/45 registros/); assert.equal(h.button.disabled,false);
    for(const fn of h.timers.values())fn(); assert.deepEqual(h.revoked,[h.files[0].url]);
});
test("double clicks cannot start concurrent downloads",async()=>{
    const h=harness(); let finish, requests=0;
    h.scope.window.educariaAdminApi.request=async()=>{requests++;return new Promise(resolve=>{finish=resolve;});};
    h.api.enable(); const first=h.click(); await h.click(); assert.equal(requests,1); assert.equal(h.button.disabled,true);
    finish(payload()); await first; assert.equal(h.files.length,1);
});
test("session changes, navigation and filter changes discard a pending export even if fetch ignores abort",async()=>{
    for(const reason of ["auth","pagehide","filters","clear"]){
        const h=harness();let finish,signal;
        h.scope.window.educariaAdminApi.request=async(_path,_params,value)=>{signal=value;return new Promise(resolve=>{finish=resolve;});};
        h.api.enable();const pending=h.click();
        if(reason==="auth")h.documentEvents["educaria-auth-changed"]();
        else if(reason==="pagehide")h.windowEvents.pagehide();
        else if(reason==="filters")h.formEvents.change(); else h.api.clear();
        finish(payload());await pending;
        assert.equal(signal.aborted,true);assert.equal(h.files.length,0);assert.equal(h.feedback.textContent,"");
        assert.equal(h.button.disabled,reason!=="filters");
    }
});
test("private access failures clear the component and notify the protected page",async()=>{
    for(const status of [401,403]){
        const h=harness();h.scope.window.educariaAdminApi.request=async()=>{throw Object.assign(Error("PRIVATE"),{status});};
        h.api.enable();await h.click();assert.equal(h.files.length,0);assert.equal(h.button.disabled,true);
        assert.equal(h.dispatched[0].type,"educaria-admin-access-denied");assert.equal(h.dispatched[0].detail.status,status);
        assert.doesNotMatch(h.feedback.textContent,/PRIVATE/);
    }
});
test("outages, old backend and malformed responses never produce a misleading file",async()=>{
    for(const value of [new Error("PRIVATE"),Object.assign(Error("PRIVATE"),{status:405}),Object.assign(Error("PRIVATE"),{status:429}),
        {ok:true,report:{}},{ok:true,report:{...payload().report,summary:{generations:99}}}]){
        const h=harness();h.scope.window.educariaAdminApi.request=async()=>{if(value instanceof Error)throw value;return value;};
        h.api.enable();await h.click();assert.equal(h.files.length,0);assert.equal(h.button.disabled,false);
        assert.ok(h.feedback.textContent);assert.doesNotMatch(h.feedback.textContent,/PRIVATE/);
    }
});
test("page cleanup revokes prepared download URLs and drops references",async()=>{
    const h=harness();h.api.enable();await h.click();h.windowEvents.pagehide();
    assert.deepEqual(h.revoked,[h.files[0].url]);assert.equal(h.timers.size,0);
});
test("export UI is labelled, initially disabled and connected to the private usage lifecycle",async()=>{
    const html=await fs.readFile(new URL("../../plataforma/administracao.html",import.meta.url),"utf8");
    assert.match(html,/data-usage-export aria-describedby="admin-export-help" disabled/);
    assert.match(html,/role="status" aria-live="polite" data-usage-export-status/);
    assert.ok(html.indexOf("admin-usage-export.js")<html.indexOf("admin-usage.js"));
    const usage=await fs.readFile(new URL("../../assets/js/admin-usage.js",import.meta.url),"utf8");
    assert.match(usage,/function clear\(\)\s*\{\s*window\.educariaAdminUsageExport\?\.clear\(\)/);
    assert.match(usage,/results\.hidden = false;\s*window\.educariaAdminUsageExport\?\.enable\(\)/);
    assert.doesNotMatch(source,/innerHTML|localStorage|sessionStorage|console\./);
});
