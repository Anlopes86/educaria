import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { listProjectFiles, projectRoot } from "./project-files.mjs";

const files = listProjectFiles({
    directories: ["assets", "plataforma", "ai-service", "tools", "firebase"],
    extensions: [".js", ".mjs"]
});
const errors = [];
let browserFiles = 0;
let moduleFiles = 0;

for (const file of files) {
    const relative = path.relative(projectRoot, file).replaceAll("\\", "/");
    if (relative.startsWith("ai-service/") || relative.startsWith("firebase/") || file.endsWith(".mjs")) {
        // --check parses ESM without importing it: no server, secrets or network calls.
        const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8", windowsHide: true, timeout: 20000 });
        if (result.error || result.status !== 0) errors.push(`Syntax check failed: ${relative}\n${result.stderr || result.error || "check failed"}`);
        moduleFiles++;
    } else {
        try {
            new vm.Script(fs.readFileSync(file, "utf8"), { filename: relative });
        } catch (error) {
            errors.push(`Syntax check failed: ${relative}\n${error.message}`);
        }
        browserFiles++;
    }
}

if (errors.length) {
    console.error(errors.join("\n\n"));
    process.exit(1);
}
console.log(`js syntax ok: ${browserFiles} browser/commonjs files and ${moduleFiles} modules checked`);
