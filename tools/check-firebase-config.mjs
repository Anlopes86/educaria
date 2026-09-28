import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("assets/js/firebase-config.js", "utf8");
let appendedScripts = 0;

const localStorage = {
    getItem() {
        return null;
    },
    setItem() {},
    removeItem() {}
};

const window = {
    location: {
        protocol: "https:",
        hostname: "anlopes86.github.io"
    }
};

const document = {
    currentScript: {
        src: "https://anlopes86.github.io/educaria/assets/js/firebase-config.js"
    },
    head: {
        appendChild() {
            appendedScripts += 1;
        }
    },
    createElement() {
        return {};
    }
};

window.window = window;
window.document = document;
window.localStorage = localStorage;

vm.runInNewContext(source, {
    window,
    document,
    localStorage,
    console,
    Promise
}, { filename: "assets/js/firebase-config.js" });

await window.educariaFirebaseConfigReady;

const requiredKeys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
const missingKeys = requiredKeys.filter((key) => {
    const value = window.EDUCARIA_FIREBASE_CONFIG?.[key];
    return typeof value !== "string" || !value.trim() || value.startsWith("COLE_AQUI");
});

if (missingKeys.length) {
    throw new Error(`Firebase production config is incomplete: ${missingKeys.join(", ")}`);
}

if (appendedScripts !== 0) {
    throw new Error("Production config attempted to load a local-only Firebase file.");
}

console.log(`firebase config ok: ${requiredKeys.length} production values available`);
