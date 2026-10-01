import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootFiles = new Set([
    "index.html", "login.html", "cadastro.html", "privacidade.html", "termos.html",
    "service-worker.js", "CNAME", ".nojekyll", "robots.txt", "sitemap.xml"
]);

export function isPublicFile(file) {
    if (rootFiles.has(file)) return true;
    if (!/^(assets|img|plataforma)\//.test(file)) return false;
    if (file.split("/").some((part) => part.startsWith(".") || part === "node_modules")) return false;
    if (/\.local(?:\.|$)|firebase.*local|adminsdk|\.env(?:\.|$)/i.test(file)) return false;
    return /\.(?:html|css|js|json|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|rtf|pdf|txt|mp3|wav|webmanifest)$/i.test(file);
}

export async function buildPages(root) {
    // Only tracked, explicitly public files may reach GitHub Pages. In particular,
    // a local Firebase credential or newly installed server dependency is never copied.
    const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
    const files = tracked.filter(isPublicFile);
    const destination = await fs.mkdtemp(path.join(os.tmpdir(), "educaria-pages-"));
    for (const file of files) {
        const source = path.join(root, file);
        if (!(await fs.lstat(source)).isFile()) throw new Error(`Not a regular public file: ${file}`);
        const target = path.join(destination, file);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(source, target);
    }
    return { destination, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const result = await buildPages(path.resolve(import.meta.dirname, ".."));
    if (process.env.GITHUB_OUTPUT) {
        await fs.appendFile(process.env.GITHUB_OUTPUT, `path=${result.destination}\n`);
    }
    console.log(`Pages artifact: ${result.files.length} public files in ${result.destination}`);
}
