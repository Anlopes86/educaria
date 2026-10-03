import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

async function adapter(file, bindings) {
    const source = await fs.readFile(new URL(`../../assets/js/${file}`, import.meta.url), "utf8");
    const start = source.indexOf("    window.educariaPresentationProgress = {");
    assert.ok(start >= 0, `Missing progress adapter: ${file}`);
    const end = source.indexOf("\n    };", start) + 7;
    const context = vm.createContext({ window: { clearTimeout() {} }, console, ...bindings });
    vm.runInContext(source.slice(start, end), context);
    return { api: context.window.educariaPresentationProgress, context };
}
const noop = () => {};
const roundtrip = (value) => JSON.parse(JSON.stringify(value));

test("memory preserves card order, found pairs and attempts without stale pending flips", async () => {
    const cards = [{ id: "1-back", found: true }, { id: "1-front", found: true }];
    const { api, context } = await adapter("memory-runtime.js", { cards, attempts: 3, mismatchTimer: 1, selected: [], locked: false, paint: noop });
    const saved = roundtrip(api.capture());
    cards.reverse(); context.attempts = 0; context.locked = true;
    api.restore(saved);
    assert.equal(cards[0].id, "1-back"); assert.equal(context.attempts, 3); assert.equal(context.locked, false);
});
test("quiz restores answers and bounds the question index", async () => {
    const { api, context } = await adapter("quiz-runtime.js", { currentIndex: 0, answers: {}, state: { questions: [{}, {}] }, paint: noop });
    api.restore({ currentIndex: 9, answers: { 1: "Alternativa B" } });
    assert.equal(context.currentIndex, 1); assert.equal(context.answers[1], "Alternativa B");
});
test("slides and flashcards return to the same position and face", async () => {
    for (const [file, state] of [["presentation-runtime.js", { state: { slides: [{}, {}] } }], ["flashcards-runtime.js", { draftState: { cards: [{}, {}] }, isFlipped: false }]]) {
        const { api, context } = await adapter(file, { ...state, currentIndex: 0, paint: noop });
        api.restore({ currentIndex: 1, isFlipped: true });
        assert.equal(context.currentIndex, 1);
        if (file.startsWith("flashcards")) assert.equal(context.isFlipped, true);
    }
});
test("matching retains the randomized order and found pairs", async () => {
    const { api, context } = await adapter("match-runtime.js", { matchedIds: new Set(["pair-1"]), rightItems: [{id:"pair-1"},{id:"pair-0"}], selectedLeft: "", selectedRight: "", statusRoot: { textContent: "Par correto" }, state: { pairs: [{}, {}] }, renderLists: noop, updateStatus: noop });
    const saved = roundtrip(api.capture()); context.matchedIds = new Set(); context.rightItems = [];
    api.restore(saved); assert.equal(context.matchedIds.has("pair-1"), true); assert.equal(context.rightItems[0].id, "pair-1");
});
test("hangman restores the round and all guesses", async () => {
    const { api, context } = await adapter("hangman-runtime.js", { rounds: [{}, {}], currentIndex: 1, guessedLetters: new Set(["A", "T"]), wrongLetters: new Set(["T"]), revealAnswer: false, renderStage: noop });
    const saved = roundtrip(api.capture()); context.currentIndex = 0; context.guessedLetters.clear();
    api.restore(saved); assert.equal(context.currentIndex, 1); assert.equal(context.guessedLetters.has("T"), true);
});
test("mindmap keeps layout, selected topic and explanation scroll", async () => {
    const { api, context } = await adapter("mindmap-runtime.js", { activeIndex: 0, state: { branches: [{}, {}], controls: {} }, detailTextRoot: { scrollTop: 0 }, renderStatic: noop, renderMap: noop, renderDetail: noop });
    api.restore({ activeIndex: 1, layout: "Tópicos", scrollTop: 180 });
    assert.equal(context.activeIndex, 1); assert.equal(context.state.controls["mapa-layout"], "Tópicos"); assert.equal(context.detailTextRoot.scrollTop, 180);
});
test("wordsearch retains found words and revealed solution", async () => {
    const { api, context } = await adapter("wordsearch-runtime.js", { revealSolution: false, activeEntryIds: [], foundEntryIds: [], toggleButton: {}, syncBankSelectionState: noop, paintBoard: noop, resetNoteMessage: noop });
    api.restore({ revealSolution: true, activeEntryIds: ["word-1"], foundEntryIds: ["word-0"] });
    assert.equal(context.foundEntryIds[0], "word-0"); assert.equal(context.toggleButton.textContent, "Ocultar gabarito");
});
test("crossword restores entered letters and feedback", async () => {
    const { api, context } = await adapter("crossword-runtime.js", { values: {}, revealAnswers: false, activeCellKey: "", activeDirection: "across", correctCells: new Set(), incorrectCells: new Set(), toggleButton: {}, noteRoot: {}, recomputeSolvedEntries: noop, renderClues: noop, paintBoard: noop });
    api.restore({ values: { "2-3": "A" }, correctCells: ["2-3"], activeCellKey: "2-3", note: "1 letra correta" });
    assert.equal(context.values["2-3"], "A"); assert.equal(context.correctCells.has("2-3"), true); assert.equal(context.noteRoot.textContent, "1 letra correta");
});
test("wheel finishes an already drawn result before switching blocks and keeps eliminations", async () => {
    const bindings = { isSpinning: true, spinTimer: 4, currentRotation: 90, activeSegments: [{index:2,text:"C"}], pendingRemovalIndex: -1, resultRoot: { textContent: "Girando" }, renderDisc: noop, updateButtonsAvailability: noop };
    const { api, context } = await adapter("wheel-runtime.js", bindings);
    context.finishSpin = () => { context.resultRoot.textContent = "C"; context.pendingRemovalIndex = 0; };
    const saved = roundtrip(api.capture()); assert.equal(saved.result, "C"); assert.equal(saved.pendingRemovalIndex, 0);
    api.restore(saved); assert.equal(context.activeSegments[0].index, 2);
});

const debate = await fs.readFile(new URL("../../assets/js/debate-runtime.js", import.meta.url), "utf8");
const timerContext = vm.createContext({});
vm.runInContext(debate.slice(debate.indexOf("function debateDurationSeconds"), debate.indexOf("function renderDebateApplication")), timerContext);
test("debate accepts minutes, seconds and clock notation with safe bounds", () => {
    const parse = timerContext.debateDurationSeconds;
    assert.equal(parse("5 min"), 300); assert.equal(parse("30 segundos"), 30); assert.equal(parse("1:30"), 90);
    assert.equal(parse("1,5 min"), 90); assert.equal(parse(""), 300); assert.equal(parse("9999 min"), 14400);
});
test("debate countdown uses elapsed time, pauses and never goes below zero", () => {
    let now = 0; const timer = timerContext.createDebateTimer(60, () => now);
    timer.start(); now = 12200; assert.equal(timer.seconds(), 48);
    timer.pause(); now = 30000; assert.equal(timer.seconds(), 48); assert.equal(timer.running(), false);
    timer.start(); now = 90000; assert.equal(timer.seconds(), 0); assert.equal(timer.running(), false);
    timer.reset(); assert.equal(timer.seconds(), 60);
});
test("debate progress pauses every round and restores remaining time", async () => {
    const timer = timerContext.createDebateTimer(90); timer.start();
    const { api, context } = await adapter("debate-runtime.js", { roundTimers: new Map([[0,timer]]), runtime: { activeIndex: 0, guidanceOpen: true, steps: [{}] }, createDebateTimer: timerContext.createDebateTimer, renderStep: noop });
    const saved = roundtrip(api.capture()); assert.equal(timer.running(), false);
    context.roundTimers.clear(); api.restore(saved); assert.equal(context.roundTimers.get(0).seconds(), 90); assert.equal(context.roundTimers.get(0).running(), false);
});

test("lesson player snapshots by block, copies state and rejects switches during load", async () => {
    const source = await fs.readFile(new URL("../../assets/js/lesson-sequence-player.js", import.meta.url), "utf8");
    let loading = false; const saved = { answers: { 0: "B" } };
    const iframe = { dataset: { loadedIndex: "0" }, contentWindow: { educariaPresentationProgress: { capture: () => saved } } };
    const context = vm.createContext({ console, document: { addEventListener() {}, querySelector: (selector) => selector.includes("iframe") ? iframe : { classList: { contains: () => loading } } } });
    vm.runInContext(source, context);
    vm.runInContext("lessonPlayerState = {blocks: [{id:'a'}, {id:'b'}, {id:'c'}]}; renderLessonPlayer = () => {};", context);
    context.selectLessonPlayerIndex(1);
    saved.answers[0] = "C";
    assert.equal(vm.runInContext("lessonPlayerProgress.get(0).answers[0]", context), "B");
    loading = true; context.selectLessonPlayerIndex(2);
    assert.equal(vm.runInContext("lessonPlayerIndex", context), 1);
    loading = false; context.selectLessonPlayerIndex(NaN); context.selectLessonPlayerIndex(-1);
    assert.equal(vm.runInContext("lessonPlayerIndex", context), 1);
    context.selectLessonPlayerIndex(2);
    assert.equal(vm.runInContext("lessonPlayerProgress.has(1)", context), false, "Late frame state must not be assigned to a different block");
});
