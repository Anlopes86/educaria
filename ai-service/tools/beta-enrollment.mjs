import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createFirebaseServices } from "../firebase-admin-services.js";
import { createBetaEnrollment } from "../beta-enrollment.js";

// Explicit project and operation; no .env loading, user dumps or secret logging.
const { values } = parseArgs({ options: {
    project: { type: "string" }, credentials: { type: "string" }, activate: { type: "boolean", default: false }
} });
try {
    if (!values.project) throw new Error("project_required");
    const env = { ...process.env, FIREBASE_PROJECT_ID: values.project };
    if (values.credentials) {
        env.FIREBASE_SERVICE_ACCOUNT_JSON = await readFile(values.credentials, "utf8");
        delete env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    }
    const enrollment = createBetaEnrollment({ getServices: createFirebaseServices(env) });
    const result = values.activate ? await enrollment.activate({ newSlots: 25, freeDailyCredits: 250 }) : await enrollment.status();
    console.log(JSON.stringify({ project: values.project, ...result }, null, 2));
} catch {
    console.error("Não foi possível consultar/ativar o beta. Confira o projeto, as credenciais administrativas e a conexão. Nenhuma cota existente é reiniciada por este comando.");
    process.exitCode = 1;
}
