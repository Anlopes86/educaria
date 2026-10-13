import { spawnSync } from "node:child_process";
import { listProjectFiles, projectRoot } from "./project-files.mjs";

const checksOnly = process.argv.slice(2);
if (checksOnly.some(argument => argument !== "--checks-only")) {
    console.error("Uso: node tools/verify.mjs [--checks-only]");
    process.exit(1);
}

const steps = [
    ["Traduções", ["tools/check-i18n.mjs"]],
    ["Referências de arquivos", ["tools/check-assets.mjs"]],
    ["Configuração pública do Firebase", ["tools/check-firebase-config.mjs"]],
    ["Sintaxe do frontend, backend e ferramentas", ["tools/check-js-syntax.mjs"]]
];
if (!checksOnly.includes("--checks-only")) {
    const tests = listProjectFiles({ directories: ["ai-service/tests", "tools/tests"], extensions: [".mjs"], includeRoot: false }).filter(file => file.endsWith(".test.mjs"));
    steps.push(["Testes do backend e frontend", ["--test", ...tests]]);
}

for (const [label, args] of steps) {
    console.log(`\n${label}`);
    const result = spawnSync(process.execPath, args, { cwd: projectRoot, stdio: "inherit", windowsHide: true });
    if (result.error || result.status !== 0) {
        console.error(`Falha na etapa: ${label}${result.error ? ` — ${result.error.message}` : ""}`);
        process.exit(result.status || 1);
    }
}
console.log("\nVerificações concluídas. Emuladores Firebase e revisão visual são etapas separadas; consulte CONTRIBUTING.md.");
