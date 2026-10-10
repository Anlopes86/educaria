import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const expressRequire = createRequire(require.resolve("express/package.json"));
const mammothPackage = require.resolve("mammoth/package.json");
const mammothRequire = createRequire(mammothPackage);

test("proxy trust does not accept arbitrary IPv4 clients through a short mapped IPv6 subnet", () => {
    const proxyaddr = expressRequire("proxy-addr");
    const unsafeSubnet = proxyaddr.compile("::ffff:10.0.0.0/8");
    assert.equal(unsafeSubnet("203.0.113.20", 0), false);
    const validSubnet = proxyaddr.compile("::ffff:10.0.0.0/104");
    assert.equal(validSubnet("10.1.2.3", 0), true);
    assert.equal(validSubnet("203.0.113.20", 0), false);
});

test("Mammoth uses the compatible argparse version without sprintf-js and retains CLI help", () => {
    // argparse 2 keeps the legacy v1 aliases used by Mammoth; v3 removes them.
    assert.equal(mammothRequire("argparse/package.json").version, "2.0.1");
    assert.throws(() => mammothRequire.resolve("sprintf-js"), { code: "MODULE_NOT_FOUND" });
    const result = spawnSync(process.execPath, [path.join(path.dirname(mammothPackage), "bin", "mammoth"), "--help"], {
        encoding: "utf8", windowsHide: true, timeout: 20000
    });
    assert.equal(result.status, 0, result.stderr || String(result.error || "CLI failed"));
    assert.match(result.stdout, /--output-format/);
    assert.match(result.stdout, /docx-path/);
});

test("the dependency update preserves DOCX text extraction, accents and English content", async () => {
    const JSZip = mammothRequire("jszip");
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Aula: revisão e explicação.</w:t></w:r></w:p><w:p><w:r><w:t>1. ENGLISH INTERVIEW</w:t></w:r></w:p><w:p><w:r><w:t>A competitive internship has a 15-minute interview entirely in English.</w:t></w:r></w:p></w:body></w:document>');
    const result = await mammoth.extractRawText({ buffer: await zip.generateAsync({ type: "nodebuffer" }) });
    assert.equal(result.value, "Aula: revisão e explicação.\n\n1. ENGLISH INTERVIEW\n\nA competitive internship has a 15-minute interview entirely in English.\n\n");
});
