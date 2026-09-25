import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import path from "node:path";

const serviceRoot = path.resolve(import.meta.dirname, "..");
const port = 19000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let server;
let serverStderr = "";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function productionEnvironment(overrides = {}) {
    return {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        AI_AUTH_REQUIRED: "true",
        FIREBASE_PROJECT_ID: "educaria-test",
        ALLOWED_ORIGIN: "https://app.educaria.test",
        GEMINI_API_KEY: "",
        BILLING_CHECKOUT_URL: "",
        BILLING_WEBHOOK_SECRET: "",
        ...overrides
    };
}

async function waitForServer() {
    for (let attempt = 0; attempt < 120; attempt += 1) {
        if (server?.exitCode !== null) {
            throw new Error(`Test server exited before startup.${serverStderr ? `\n${serverStderr}` : ""}`);
        }
        try {
            const response = await fetch(`${baseUrl}/api/health`);
            if (response.ok) return;
        } catch {
            // Server is still starting.
        }
        await delay(100);
    }
    throw new Error(`Test server did not start within 12 seconds.${serverStderr ? `\n${serverStderr}` : ""}`);
}

before(async () => {
    server = spawn(process.execPath, ["server.js"], {
        cwd: serviceRoot,
        env: productionEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
    });
    server.stderr.on("data", (chunk) => {
        serverStderr += String(chunk);
    });
    await waitForServer();
});

after(async () => {
    if (!server || server.exitCode !== null) return;
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await Promise.race([exited, delay(3000)]);
});

test("production health response does not expose configuration", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: "educaria-ai" });
});

test("AI credits reject unauthenticated requests", async () => {
    const response = await fetch(`${baseUrl}/api/ai/credits`);
    assert.equal(response.status, 401);
});

test("AI generation rejects unauthenticated requests before processing input", async () => {
    const response = await fetch(`${baseUrl}/api/ai/generate`, {
        method: "POST",
        body: new FormData()
    });
    assert.equal(response.status, 401);
});

test("account deletion endpoint rejects unauthenticated requests", async () => {
    const response = await fetch(`${baseUrl}/api/account`, { method: "DELETE" });
    assert.equal(response.status, 401);
});

test("CORS blocks an unapproved browser origin", async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Origin: "https://malicious.example" }
    });
    assert.ok(response.status >= 400);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("production refuses to start with authentication disabled", async () => {
    const child = spawn(process.execPath, ["server.js"], {
        cwd: serviceRoot,
        env: productionEnvironment({ AI_AUTH_REQUIRED: "false", PORT: String(port + 1) }),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
    });

    const exitCode = await new Promise((resolve) => child.once("exit", resolve));
    assert.equal(exitCode, 1);
    assert.match(stderr, /cannot be disabled in production/i);
});
