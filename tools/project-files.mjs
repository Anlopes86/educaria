import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));

/** Deterministic source inventory; never follows symlinks or scans local/private output. */
export function listProjectFiles({ root = projectRoot, directories = ["assets", "plataforma"], extensions = [".html", ".css", ".js"], includeRoot = true } = {}) {
    const selected = new Set(extensions);
    const ignored = new Set(["node_modules", "dist", "coverage"]);
    const results = [];
    function visit(directory, recursive) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.name.startsWith(".") || ignored.has(entry.name) || /\.local(?:\.|$)/.test(entry.name)) continue;
            const file = path.join(directory, entry.name);
            if (recursive && entry.isDirectory()) visit(file, true);
            else if (entry.isFile() && selected.has(path.extname(entry.name))) results.push(file);
        }
    }
    if (includeRoot) visit(root, false);
    for (const directory of directories) {
        const fullPath = path.join(root, directory);
        if (fs.existsSync(fullPath)) visit(fullPath, true);
    }
    return [...new Set(results)].sort();
}
