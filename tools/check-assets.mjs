import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules"]);
const checkedExtensions = new Set([".html", ".css"]);
const optionalAssets = new Set(["assets/js/firebase-config.local.js"]);
const urlAttributes = ["href", "src", "poster", "data-src"];

function normalizeRelative(filePath) {
    return path.relative(root, filePath).replace(/\\/g, "/");
}

function walk(dir, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relative = normalizeRelative(fullPath);

        if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name) && !ignoredDirs.has(relative)) {
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

function stripUrlDecorations(value) {
    return value.split("#")[0].split("?")[0].trim();
}

function isLocalUrl(value) {
    return value
        && !value.startsWith("#")
        && !value.startsWith("//")
        && !/^[a-z][a-z0-9+.-]*:/i.test(value)
        && !value.startsWith("{{")
        && !value.startsWith("${");
}

function cssUrls(content) {
    const urls = [];
    const pattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    for (const match of content.matchAll(pattern)) {
        urls.push(match[2]);
    }
    return urls;
}

function htmlUrls(content) {
    const urls = [];
    const attributePattern = new RegExp(`\\b(?:${urlAttributes.join("|")})=["']([^"']+)["']`, "g");
    for (const match of content.matchAll(attributePattern)) {
        urls.push(match[1]);
    }

    const srcsetPattern = /\bsrcset=["']([^"']+)["']/g;
    for (const match of content.matchAll(srcsetPattern)) {
        for (const candidate of match[1].split(",")) {
            const [url] = candidate.trim().split(/\s+/);
            urls.push(url);
        }
    }

    return urls;
}

function referencedUrls(filePath, content) {
    if (path.extname(filePath) === ".css") {
        return cssUrls(content);
    }

    return htmlUrls(content);
}

function resolveAsset(ownerFile, rawUrl) {
    const cleanUrl = stripUrlDecorations(rawUrl);
    if (!isLocalUrl(cleanUrl)) {
        return null;
    }

    const normalizedUrl = cleanUrl.startsWith("/")
        ? cleanUrl.slice(1)
        : path.join(path.dirname(normalizeRelative(ownerFile)), cleanUrl);

    return path.normalize(path.join(root, normalizedUrl));
}

const errors = [];
const checkedFiles = walk(root);
let referenceCount = 0;

for (const filePath of checkedFiles) {
    const content = fs.readFileSync(filePath, "utf8");

    for (const rawUrl of referencedUrls(filePath, content)) {
        const resolved = resolveAsset(filePath, rawUrl);
        if (!resolved) {
            continue;
        }

        referenceCount += 1;
        const relative = normalizeRelative(resolved);
        if (optionalAssets.has(relative)) {
            continue;
        }

        if (!fs.existsSync(resolved)) {
            errors.push(`${normalizeRelative(filePath)} references missing asset: ${rawUrl}`);
        }
    }
}

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log(`assets ok: ${checkedFiles.length} files checked, ${referenceCount} local references`);
