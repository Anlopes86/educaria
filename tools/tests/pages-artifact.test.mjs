import assert from "node:assert/strict";
import { test } from "node:test";
import { isPublicFile } from "../build-pages.mjs";

test("Pages includes the application and excludes backend, credentials and private reports", () => {
    for (const file of ["index.html", "exclusao-conta.html", "assets/js/account-deletion-client.js", "plataforma/quiz-builder.html", "assets/js/firebase-config.js", "assets/i18n/pt-BR.json", "img/img index.png", "service-worker.js"]) {
        assert.equal(isPublicFile(file), true, file);
    }
    for (const file of ["ai-service/server.js", "ai-service/node_modules/express/package.json", "docs/auditoria.local/relatorio.md", "tools/check-assets.mjs", "firebase/firestore.rules", ".env", "educaria-firebase-adminsdk-test.json", "assets/js/firebase-config.local.js", "assets/.private/key.json", "assets/node_modules/library/index.js", "assets/secret.env", "assets/private.local.json"]) {
        assert.equal(isPublicFile(file), false, file);
    }
});
