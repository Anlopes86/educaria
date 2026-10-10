import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

test("the dashboard and both relevant editors expose no second teacher-request field", async () => {
    for (const file of ["index", "slides-builder", "flashcards-builder"]) {
        const html = await fs.readFile(new URL(`../../plataforma/${file}.html`, import.meta.url), "utf8");
        assert.doesNotMatch(html, /teacher-instructions|data-dashboard-context="teacherInstructions"/);
        assert.match(html, /Seu pedido e conteúdo/);
    }
});

test("saved legacy requests are moved to the main field without losing or duplicating text", async () => {
    const source = await fs.readFile(new URL("../../assets/js/local-persistence.js", import.meta.url), "utf8");
    for (const prefix of ["slides", "cards"]) {
        const field = { value: "" };
        const context = vm.createContext({ document: { getElementById: (id) => id === `${prefix}-fonte-texto` ? field : null } });
        vm.runInContext(source.slice(source.indexOf("function restoreControls("), source.indexOf("function captureControls(")), context);
        const controls = { [`${prefix}-fonte-texto`]: "English source text", [`${prefix}-teacher-instructions`]: "Não traduza. Preserve o texto." };
        context.restoreControls(controls);
        assert.equal(field.value, "Não traduza. Preserve o texto.\n\nEnglish source text");
        context.restoreControls(controls);
        assert.equal(field.value, "Não traduza. Preserve o texto.\n\nEnglish source text");
        context.restoreControls({ ...controls, [`${prefix}-fonte-texto`]: field.value });
        assert.equal(field.value.match(/Não traduza/g).length, 1);
    }
});

test("older generated results bring their request into the main editor field", async () => {
    const source = await fs.readFile(new URL("../../assets/js/ai-material-generator.js", import.meta.url), "utf8");
    const field = { value: "Primeira Guerra Mundial" };
    const context = vm.createContext({
        document: { getElementById: () => field },
        materialConfig: () => ({ textId: "slides-fonte-texto" })
    });
    vm.runInContext(source.slice(source.indexOf("function applyGenerationOptionsToEditor("), source.indexOf("function readDashboardQuickResult(")), context);
    context.applyGenerationOptionsToEditor("slides", { teacherInstructions: "Explique as causas com exemplos." });
    context.applyGenerationOptionsToEditor("slides", { teacherInstructions: "Explique as causas com exemplos." });
    assert.equal(field.value, "Explique as causas com exemplos.\n\nPrimeira Guerra Mundial");
});
