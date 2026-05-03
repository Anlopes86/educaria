import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules"]);
const checkedExtensions = new Set([".js"]);
const skippedModuleDirs = new Set(["ai-service"]);

function normalizeRelative(filePath) {
    return path.relative(root, filePath).replace(/\\/g, "/");
}

function walk(dir, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relative = normalizeRelative(fullPath);

        if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name) && !ignoredDirs.has(relative) && !skippedModuleDirs.has(relative)) {
                walk(fullPath, results);
            }
            continue;
        }

        if (checkedExtensions.has(path.extname(entry.name))) {
            results.push(fullPath);
        }
    }

    return results;
}

const files = walk(root);
const errors = [];

for (const filePath of files) {
    try {
        new vm.Script(fs.readFileSync(filePath, "utf8"), { filename: normalizeRelative(filePath) });
    } catch (error) {
        errors.push(`Syntax check failed: ${normalizeRelative(filePath)}\n${error.message}`);
    }
}

if (errors.length) {
    console.error(errors.join("\n\n"));
    process.exit(1);
}

console.log(`js syntax ok: ${files.length} browser/commonjs files checked`);
