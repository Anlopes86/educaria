// Local-only static server + existing isolated browser harness. No real login or AI.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { isPublicFile } from "./build-pages.mjs";
const root = path.resolve(import.meta.dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
        const relative = path.relative(root, file);
        if (!isPublicFile(relative.replaceAll("\\", "/")) || !mime[path.extname(file)]) throw new Error("Not a public asset");
        response.setHeader("Content-Type", `${mime[path.extname(file)]}; charset=utf-8`);
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.end(await fs.readFile(file));
    } catch { response.writeHead(404); response.end("Not found"); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
    const child = spawn(process.execPath, ["tools/check-responsive-layout.mjs", "auth:plataforma/index.html"], {
        cwd: root, windowsHide: true, stdio: "inherit", env: { ...process.env,
            EDUCARIA_AUDIT_BASE_URL: `http://127.0.0.1:${server.address().port}/`, EDUCARIA_AUDIT_EXAMPLES: "1",
            EDUCARIA_AUDIT_DISABLE_DASHBOARD_TOUR: "1", EDUCARIA_AUDIT_SEED_DASHBOARD: "1",
            EDUCARIA_AUDIT_WIDTH: process.env.EDUCARIA_AUDIT_WIDTH || "1366", EDUCARIA_AUDIT_HEIGHT: process.env.EDUCARIA_AUDIT_HEIGHT || "768"
        }
    });
    process.exitCode = await new Promise((resolve, reject) => { child.on("exit", code => resolve(code ?? 1)); child.on("error", reject); });
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
