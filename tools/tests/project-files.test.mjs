import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listProjectFiles } from "../project-files.mjs";

test("source inventory includes nested modules and excludes private files and generated output", async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "educaria-source-inventory-"));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const files = ["index.html", "service-worker.js", "assets/js/main.js", "assets/css/main.css", "plataforma/index.html", "ai-service/materials/prompts.js", "tools/check.mjs", ".data/preview.js", "assets/js/firebase-config.local.js", "assets/.private/local.js", "assets/node_modules/library.js", "assets/dist/generated.js", "assets/coverage/summary.js", "credential.json"];
    for (const file of files) {
        await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
        await fs.writeFile(path.join(root, file), "");
    }
    const relative = options => listProjectFiles({ root, ...options }).map(file => path.relative(root, file).replaceAll("\\", "/"));
    assert.deepEqual(relative({}), ["assets/css/main.css", "assets/js/main.js", "index.html", "plataforma/index.html", "service-worker.js"]);
    assert.deepEqual(relative({ directories: ["ai-service", "tools"], extensions: [".js", ".mjs"], includeRoot: false }), ["ai-service/materials/prompts.js", "tools/check.mjs"]);
    assert.deepEqual(relative({ directories: ["missing"], extensions: [".html"] }), ["index.html"]);
});
