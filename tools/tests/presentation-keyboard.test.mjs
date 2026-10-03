import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const modeSource = await fs.readFile(new URL("../../assets/js/presentation-mode.js", import.meta.url), "utf8");
const hangmanSource = await fs.readFile(new URL("../../assets/js/hangman-runtime.js", import.meta.url), "utf8");

function presentation(materialType) {
    const listeners = {};
    let clicks = 0;
    const next = {disabled:false,offsetParent:{},click:()=>clicks++};
    const shell = {querySelector:()=>null};
    const context = vm.createContext({console,
        document: {
            body:{dataset:{materialType},classList:{add(){},remove(){},contains(){return true;}}},
            querySelector:(selector)=>selector === ".presentation-shell" ? shell : selector === "[data-presentation-topbar-restore]" ? {} : selector === "[data-flashcard-flip]" && materialType === "flashcards" ? {} : null,
            querySelectorAll:(selector)=>selector === "[data-presentation-next]" ? [next] : [],
            addEventListener:(name,callback)=>{(listeners[name] ||= []).push(callback);}
        },
        window:{clearTimeout(){},setTimeout(){return 1;},cancelAnimationFrame(){},requestAnimationFrame(){return 1;},addEventListener(){}}
    });
    vm.runInContext(modeSource,context);
    listeners.DOMContentLoaded[0]();
    return {clicks:()=>clicks,key:(key,target={},extra={})=>{
        const event={key,target,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};
        for(const listener of listeners.keydown) listener(event);
        return event;
    }};
}

test("space is reserved for flipping flashcards instead of skipping a card",()=>{
    const h=presentation("flashcards");
    assert.equal(h.key(" ").defaultPrevented,false);
    assert.equal(h.clicks(),0);
    h.key("ArrowRight");
    assert.equal(h.clicks(),1);
});
test("focused buttons retain their native Enter and Space behavior",()=>{
    const h=presentation("quiz");
    const target={closest:selector=>selector.includes("button") ? {} : null};
    h.key("Enter",target); h.key(" ",target);
    assert.equal(h.clicks(),0);
});
test("hangman letters do not toggle fullscreen or hide the toolbar",()=>{
    const h=presentation("hangman");
    assert.equal(h.key("t").defaultPrevented,false);
    assert.equal(h.key("f").defaultPrevented,false);
});
test("modified keys do not trigger presentation actions",()=>{
    const h=presentation("slides");
    h.key("ArrowRight",{}, {ctrlKey:true});
    assert.equal(h.clicks(),0);
});
test("hangman accepts only single unhandled letters, never ArrowRight, Tab or Enter",()=>{
    let onKey; const guesses=[];
    const start=hangmanSource.lastIndexOf('    document.addEventListener("keydown"');
    const end=hangmanSource.indexOf('\n    window.educariaPresentationProgress',start);
    vm.runInNewContext(hangmanSource.slice(start,end),{
        document:{addEventListener:(_,fn)=>{onKey=fn;}},
        api:{normalizeAnswer:key=>key.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()},
        applyGuess:key=>guesses.push(key)
    });
    for(const key of ["ArrowRight","Tab","Enter","1"," "]) onKey({key,preventDefault(){}});
    onKey({key:"t",defaultPrevented:true});
    onKey({key:"a",preventDefault(){}});
    assert.deepEqual(guesses,["A"]);
});
