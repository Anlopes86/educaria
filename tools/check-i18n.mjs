import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dictionaryDir = path.join(root, "assets", "i18n");
const languages = ["pt-BR", "en-US", "es-ES"];
const ignoredDirs = new Set([".git", "node_modules", "ai-service/node_modules"]);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walk(dir, results = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relative = path.relative(root, fullPath).replace(/\\/g, "/");
        if (entry.isDirectory()) {
            if (!ignoredDirs.has(relative) && !ignoredDirs.has(entry.name)) {
                walk(fullPath, results);
            }
            continue;
        }

        if (/\.(html|js)$/.test(entry.name)) {
            results.push(fullPath);
        }
    }
    return results;
}

function collectReferencedKeys() {
    const keys = new Set();
    const files = walk(root);
    const patterns = [
        /\bdata-i18n(?:-[a-z-]+)?="([^"]+)"/g,
        /\b(?:classesTranslate|dashboardTranslate|lessonLibraryTranslate|settingsTranslate)\(\s*"([^"]+)"/g,
        /\bwindow\.educariaTranslate\(\s*"([^"]+)"/g
    ];

    for (const file of files) {
        const content = fs.readFileSync(file, "utf8");
        for (const pattern of patterns) {
            for (const match of content.matchAll(pattern)) {
                keys.add(match[1]);
            }
        }
    }

    return [...keys].sort();
}

const dictionaries = Object.fromEntries(languages.map((language) => {
    const filePath = path.join(dictionaryDir, `${language}.json`);
    return [language, readJson(filePath)];
}));

const allDictionaryKeys = [...new Set(Object.values(dictionaries).flatMap(Object.keys))].sort();
const referencedKeys = collectReferencedKeys();
const errors = [];

for (const language of languages) {
    const dictionary = dictionaries[language];
    const missingFromLanguage = allDictionaryKeys.filter((key) => !(key in dictionary));
    if (missingFromLanguage.length) {
        errors.push(`${language} missing dictionary keys: ${missingFromLanguage.join(", ")}`);
    }

    const missingReferences = referencedKeys.filter((key) => !(key in dictionary));
    if (missingReferences.length) {
        errors.push(`${language} missing referenced keys: ${missingReferences.join(", ")}`);
    }
}

if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
}

console.log(`i18n ok: ${languages.length} languages, ${allDictionaryKeys.length} dictionary keys, ${referencedKeys.length} referenced keys`);
