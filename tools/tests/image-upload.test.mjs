import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const source = await fs.readFile(new URL("../../assets/js/image-upload.js", import.meta.url), "utf8");
function harness(options = {}) {
    const state = { revoked: 0, encoded: 0, dimensions: [] };
    const canvas = {
        getContext: () => options.noCanvas ? null : { drawImage() {} },
        toDataURL() {
            state.encoded++; state.dimensions.push([canvas.width, canvas.height]);
            return `data:image/webp;base64,${"A".repeat(options.alwaysLarge || (options.reduce && state.encoded === 1) ? 200000 : 1000)}`;
        }
    };
    class Image {
        naturalWidth = options.width || 3200;
        naturalHeight = options.height || 1800;
        set src(_) { queueMicrotask(() => options.invalid ? this.onerror() : this.onload()); }
    }
    const window = {};
    vm.runInNewContext(source, { window, Image, document: { createElement: () => canvas },
        URL: { createObjectURL: () => "blob:test", revokeObjectURL() { state.revoked++; } } });
    return { api: window.educariaImages, state };
}
const file = { type: "image/png", size: 500000 };

test("image upload bounds dimensions and output size and releases the temporary URL", async () => {
    const h = harness(); const encoded = await h.api.optimize(file);
    assert.ok(encoded.length <= h.api.maxDataUrlLength);
    assert.deepEqual(h.state.dimensions[0], [1600, 900]); assert.equal(h.state.revoked, 1);
});
test("image upload rejects invalid MIME, empty and oversized files before decoding", async () => {
    const h = harness();
    await assert.rejects(h.api.optimize({ type: "image/svg+xml", size: 20 }), /JPG/);
    await assert.rejects(h.api.optimize({ ...file, size: 0 }), /8 MB/);
    await assert.rejects(h.api.optimize({ ...file, size: 8 * 1024 * 1024 + 1 }), /8 MB/);
    assert.equal(h.state.encoded, 0);
});
test("image upload rejects corrupt content and releases the temporary URL", async () => {
    const h = harness({ invalid: true }); await assert.rejects(h.api.optimize(file), /válida/); assert.equal(h.state.revoked, 1);
});
test("failed canvas creation never falls back to embedding the full original file", async () => {
    const h = harness({ noCanvas: true }); await assert.rejects(h.api.optimize(file), /navegador/); assert.equal(h.state.revoked, 1);
});
test("image upload progressively reduces output and fails if the bounded output cannot be obtained", async () => {
    const h = harness({ reduce: true }); await h.api.optimize(file);
    assert.equal(h.state.encoded, 2); assert.ok(h.state.dimensions[1][0] < h.state.dimensions[0][0]);
    const bad = harness({ alwaysLarge: true }); await assert.rejects(bad.api.optimize(file), /versão menor/);
    assert.equal(bad.state.encoded, 6); assert.equal(bad.state.revoked, 1);
});
test("images beyond the decoded pixel limit are not drawn to canvas", async () => {
    const h = harness({ width: 10000, height: 10000 }); await assert.rejects(h.api.optimize(file), /32 megapixels/);
    assert.equal(h.state.encoded, 0);
});
