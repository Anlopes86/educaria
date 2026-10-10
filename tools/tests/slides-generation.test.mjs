import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end)); }

test("complete explanations survive editor import", () => {
    const context = vm.createContext({});
    vm.runInContext(section("function compactSlideBodyText(", "function splitParagraphs("), context);
    const line = "D. Pedro viveu no Brasil. Depois retornou a Portugal; estes acontecimentos ajudam a entender esse período histórico.";
    assert.equal(context.compactSlideBodyText(line, "cover"), line);
    const body = Array.from({ length: 6 }, () => line).join("\r\n");
    assert.equal(context.compactSlideBodyText(body), Array.from({ length: 6 }, () => line).join("\n"));
});

function generationHarness() {
    let posted, applied;
    const fields = {
        text: { value: "Fotossíntese" }, file: { files: [] }, count: { value: "8" },
        action: { selectedIndex: 0, options: [{ text: "Organizar texto em slides" }] },
        detail: { selectedIndex: 0, options: [{ text: "Mais detalhado" }] },
        tone: { selectedIndex: 0, options: [{ text: "Mais explicativo" }] },
        audience: { value: "EJA" }, objective: { value: "Explicar. Relacionar ao cotidiano." },
        subject: { value: "Ciências" }, className: { value: "7º ano A" }, visual: { value: "ai" },
        instructions: { value: "" }
    };
    const context = vm.createContext({
        FormData, CustomEvent: class {}, console,
        window: { educariaAiAuthHeaders: async () => ({ Authorization: "Bearer test-token" }), alert: (message) => { throw new Error(message); } },
        document: { getElementById: (id) => fields[id], dispatchEvent() {} },
        fetch: async (url, request) => { posted = request; return { ok: true, json: async () => ({ material: { slides: [{}] } }) }; },
        resolveAiEndpoint: () => "https://ai.example.test/api/ai/generate",
        materialConfig: () => ({ textId: "text", fileId: "file", actionId: "action", countId: "count", detailId: "detail", toneId: "tone", audienceId: "audience", objectiveId: "objective", subjectId: "subject", classId: "className", visualModeId: "visual", instructionsId: "instructions", apply(value) { applied = value; return true; } }),
        readTextFile: async () => "", educariaTrackAiEvent() {}, checkAiHealth: async () => {}, openAiReadyModal() {}, reviewGeneratedMaterial() {}
    });
    vm.runInContext(section("async function requestStructuredMaterial(", "async function requestTemplateStructuredMaterial("), context);
    vm.runInContext(section("async function generateMaterial(", "function readDashboardQuickResult("), context);
    return { context, fields, get posted() { return posted; }, get applied() { return applied; } };
}

test("editor selections reach the request as distinct fields, including selected class", async () => {
    const h = generationHarness();
    const button = { textContent: "Gerar", disabled: false };
    assert.equal(await h.context.generateMaterial("slides", button), true);
    assert.deepEqual(JSON.parse(h.posted.body.get("slideOptions")), {
        detail: "Mais detalhado", tone: "Mais explicativo", audience: "EJA", objective: "Explicar. Relacionar ao cotidiano.", subject: "Ciências", className: "7º ano A"
    });
    assert.match(h.posted.body.get("action"), /Gerar 8 slides/);
    assert.match(h.posted.body.get("action"), /personalizado/);
    assert.equal(h.posted.body.get("sourceText"), "Fotossíntese");
    assert.equal(h.posted.headers.Authorization, "Bearer test-token");
    assert.equal(h.applied.visual_mode, "ai");
    assert.equal(button.disabled, false);
});

test("long slide settings do not overflow the action field", async () => {
    const h = generationHarness();
    h.fields.objective.value = "a".repeat(280);
    h.fields.audience.value = "b".repeat(160);
    h.fields.subject.value = "c".repeat(120);
    await h.context.generateMaterial("slides", { textContent: "Gerar" });
    assert.ok(h.posted.body.get("action").length < 500);
    assert.equal(JSON.parse(h.posted.body.get("slideOptions")).objective.length, 280);
});

test("editor sends an expansion request with automatic quantity without mixing it into the text", async () => {
    const h = generationHarness();
    h.fields.count.value = "";
    h.fields.action.options[0].text = "Desenvolver e aprofundar o assunto";
    h.fields.instructions.value = "Explique as causas com exemplos. Não inclua capa.";
    assert.equal(await h.context.generateMaterial("slides", { textContent: "Gerar" }), true);
    const sent = JSON.parse(h.posted.body.get("generationOptions"));
    assert.equal(sent.contentMode, "develop");
    assert.equal(sent.teacherInstructions, h.fields.instructions.value);
    assert.equal(sent.count, undefined);
    assert.equal(h.posted.body.get("sourceText"), "Fotossíntese");
    assert.doesNotMatch(h.posted.body.get("action"), /Gerar \d+ slides/);
});

test("file upload and non-slide requests keep the original transport", async () => {
    const h = generationHarness();
    await h.context.requestStructuredMaterial("quiz", "Tema", new Blob(["Arquivo"], { type: "text/plain" }), "Gerar 4 perguntas.", { detail: "detailed" });
    assert.equal(h.posted.body.get("slideOptions"), null);
    assert.equal(await h.posted.body.get("file").text(), "Arquivo");
});

test("editor sends the attached text once, leaving extraction to the API", async () => {
    const h = generationHarness();
    h.fields.file.files = [new Blob(["Texto do arquivo"], { type: "text/plain" })];
    h.context.readTextFile = async () => { throw new Error("Must not duplicate file text"); };
    assert.equal(await h.context.generateMaterial("slides", { textContent: "Gerar" }), true);
    assert.equal(h.posted.body.get("sourceText"), "Fotossíntese");
    assert.equal(await h.posted.body.get("file").text(), "Texto do arquivo");
});

test("detail and tone help follow all selected options without generating again", async () => {
    const theme = await fs.readFile(new URL("../../assets/js/slide-theme-controls.js", import.meta.url), "utf8");
    const fields = Object.fromEntries(["slides-detalhamento", "slides-tom", "slides-detalhamento-help", "slides-tom-help"].map((id) => [id, { selectedIndex: 0 }]));
    const context = vm.createContext({ document: { getElementById: (id) => fields[id], addEventListener() {} } });
    vm.runInContext(theme, context);
    const details = new Set(), tones = new Set();
    for (let index = 0; index < 4; index++) {
        fields["slides-tom"].selectedIndex = index;
        fields["slides-detalhamento"].selectedIndex = Math.min(index, 2);
        context.syncSlidePedagogyHelp();
        details.add(fields["slides-detalhamento-help"].textContent);
        tones.add(fields["slides-tom-help"].textContent);
    }
    assert.equal(details.size, 3);
    assert.equal(tones.size, 4);
});
