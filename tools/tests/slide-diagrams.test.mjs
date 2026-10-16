import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import model from "../../assets/js/slide-diagram-model.js";
import { normalizeSlideIllustration, slideIllustrationInstructions, slideIllustrationSchema } from "../../ai-service/slide-illustration-policy.js";
import { normalizeSlidesMaterial } from "../../ai-service/materials/slides.js";
import { diagramExamples } from "../fixtures/slide-diagrams.mjs";

const context = vm.createContext({});
for (const file of ["slide-diagram-model", "slide-diagram-renderer", "slide-illustrations"]) vm.runInContext(await fs.readFile(new URL(`../../assets/js/${file}.js`, import.meta.url), "utf8"), context);
const api = context.EducariaSlideIllustrations;
const renderer = context.EducariaSlideDiagramRenderer;
const plain = value => JSON.parse(JSON.stringify(value));
const svg = image => decodeURIComponent(image.url.slice(image.url.indexOf(",") + 1));

for (const example of diagramExamples) test(`general illustration: ${example.title}`, () => {
    const normalized = normalizeSlideIllustration(example, true);
    assert.equal(normalized.status, "ready");
    assert.deepEqual(plain(context.EducariaSlideDiagramModel.normalize(example)), normalized);
    const image = api.render(plain(normalized)); assert.ok(image, example.layout);
    assert.equal(image.description, example.description);
    assert.ok(image.url.length < 60000);
    const drawing = svg(image);
    assert.match(drawing, /viewBox="0 0 600 600"/);
    assert.doesNotMatch(drawing, /<script|<foreignObject|<image|href=|onload=/);
    assert.equal((drawing.match(/marker-end=/g) || []).length, example.links.filter(link => link.kind === "arrow").length);
    assert.equal(normalizeSlidesMaterial({ slides:[{ body:"Conteúdo preservado", illustration: example }] }, { includeIllustration:true }).slides[0].layout, "split");
    const boxes = renderer.positions(normalized);
    for (const box of boxes) {
        assert.ok(box.x >= 12 && box.y >= 76 && box.x+box.width <= 588 && box.y+box.height <= 552, `${box.id} out of bounds`);
        for (const other of boxes) {
            if (box.id === other.id) continue;
            assert.ok(box.x+box.width <= other.x || other.x+other.width <= box.x || box.y+box.height <= other.y || other.y+other.height <= box.y, `${box.id} overlaps ${other.id}`);
        }
    }
});

test("new schema cannot request raw drawing coordinates, arbitrary colors, external URLs or topic-specific layouts", () => {
    assert.deepEqual(slideIllustrationSchema, model.schema);
    for (const key of ["elements", "labels", "color", "geometry", "url", "svg"]) assert.equal(slideIllustrationSchema.properties[key], undefined);
    assert.deepEqual(slideIllustrationSchema.properties.layout.enum, ["process","cycle","comparison","concept-map","hierarchy","cards"]);
    const instructions = slideIllustrationInstructions({ includeIllustration:true }).join("\n");
    for (const value of [/QUALQUER DISCIPLINA/, /objetivo visual/, /needs-image/, /fatos, relações causais/, /não por palavras-chave/]) assert.match(instructions, value);
    assert.doesNotMatch(instructions, /Sol, Mercúrio|raioX|centroX|solar-system/);
});

test("invalid graphs, identities, quantities and unsafe icons fail closed in both environments", () => {
    const original = diagramExamples[0];
    const invalid = [
        { ...original, layout:"__proto__" }, { ...original, title:"" }, { ...original, nodes:original.nodes.slice(0,1) },
        { ...original, links:[] }, { ...original, links:[...original.links, original.links[0]] },
        { ...original, links:[{ from:"sun", to:"missing", kind:"arrow" }, ...original.links.slice(1)] },
        { ...original, links:[{ from:"plant", to:"sun", kind:"arrow" }, ...original.links.slice(1)] },
        { ...original, nodes:original.nodes.map(node => ({ ...node, id:"same" })) },
        { ...original, nodes:[{...original.nodes[0], icon:'"><script>alert(1)</script>'}, ...original.nodes.slice(1)] },
        { ...diagramExamples[3], links:diagramExamples[3].links.map(link => ({...link, from:"vote"})) },
        { ...diagramExamples[4], links:diagramExamples[4].links.map(link => ({...link, to:"animals"})) },
        { ...diagramExamples[5], links:diagramExamples[5].links.slice(0,-1) }
    ];
    for (const raw of invalid) {
        assert.equal(normalizeSlideIllustration(raw,true).status,"invalid");
        assert.equal(api.render(raw),null);
    }
});

test("No always wins; unsupported detailed imagery never becomes a misleading diagram", () => {
    const needsImage = { ...diagramExamples[0], status:"needs-image" };
    const normalized = normalizeSlideIllustration(needsImage,true);
    assert.equal(normalized.nodes.length,0); assert.equal(api.render(normalized),null);
    assert.deepEqual(normalizeSlideIllustration(diagramExamples[0],false),{description:"",elements:[]});
    assert.equal(api.resolveImage({generation_options:{includeIllustration:false}},{illustration:diagramExamples[0]},0).url,"");
    const result = normalizeSlidesMaterial({slides:[{body:"Texto completo",illustration:needsImage}]},{includeIllustration:true}).slides[0];
    assert.equal(result.body,"Texto completo"); assert.equal(result.layout,"stack");
});

test("partial failures are explained even when another slide has a valid illustration", () => {
    const material = {generation_options:{includeIllustration:true},slides:[{illustration:diagramExamples[0]},{illustration:{version:2,status:"needs-image"}},{illustration:{version:2,status:"invalid"}}]};
    const message = api.feedback(material);
    assert.match(message,/slides 2 exige uma imagem mais detalhada/);
    assert.match(message,/slides 3/);
    material.cover_image = "data:image/png;base64,aW1hZ2U=";
    material.slides = [{illustration:{version:2,status:"needs-image"}}];
    assert.equal(api.feedback(material),"");
});

test("captions and node labels are escaped and long labels fit or are explicitly rejected", () => {
    const example = plain(diagramExamples[6]);
    example.nodes[0].label = '<script>bad()</script>';
    example.title = 'Texto <não é código>';
    const image = api.render(example); assert.ok(image);
    assert.doesNotMatch(svg(image), /<script|<não/);
    assert.match(svg(image), /&lt;/);
    const tinyBox = {x:0,y:0,width:60,height:30};
    assert.equal(renderer.fitText("W".repeat(100), tinyBox,24,16),null);
    for (const label of ["Configuração e transformação", "W".repeat(32), "代表不同概念的说明文字", "A".repeat(33)]) {
        example.nodes[0].label = label;
        const rendered = api.render(example);
        if (label.length > 32) assert.equal(rendered,null);
        else if (rendered) assert.doesNotMatch(svg(rendered), /textLength|clip-path/);
    }
});

test("Portuguese diagram labels shrink without breaking words in the middle", () => {
    for (const word of ["Evaporação", "Condensação", "Precipitação", "Vertebrados", "Invertebrados", "Mamíferos", "Artrópodes"]) {
        const fitted = renderer.fitText(word, { x:0, y:0, width:110, height:70 }, 19, 14);
        assert.ok(fitted, word);
        assert.ok(fitted.markup.includes(`>${word}</tspan>`), word);
    }
});

test("slide presentation preserves the entire instructional illustration", async () => {
    const css = await fs.readFile(new URL("../../assets/css/components/activity-visual-system.css", import.meta.url), "utf8");
    assert.match(css, /body\.presentation-page \.presentation-slide--split \.presentation-media img\[src\^="data:image\/svg\+xml"\]\s*\{[^}]*object-fit:\s*contain/);
});

test("all supported diagram quantities fit without overlapping cards", () => {
    const counts = { process:[2,3,4,5], cycle:[3,4,5,6], comparison:[2,4,6], "concept-map":[3,4,5], cards:[1,2,3,4,5,6] };
    for (const [layout, values] of Object.entries(counts)) for (const count of values) {
        const nodes = Array.from({ length:count }, (_, index) => ({ id:`n${index}`, label:`Etapa ${index+1}`, detail:"", icon:"idea" }));
        const links = layout === "process" || layout === "cycle"
            ? nodes.slice(0, layout === "cycle" ? count : count-1).map((node,index)=>({ from:node.id, to:nodes[(index+1)%count].id, kind:"arrow" }))
            : layout === "concept-map" ? nodes.slice(1).map(node=>({ from:nodes[0].id, to:node.id, kind:"line" })) : [];
        const example = { ...diagramExamples[0], layout, nodes, links };
        assert.ok(api.render(example), `${layout}: ${count}`);
        const boxes = renderer.positions(example);
        for (const [index, box] of boxes.entries()) for (const other of boxes.slice(index+1)) {
            assert.ok(box.x+box.width <= other.x || other.x+other.width <= box.x || box.y+box.height <= other.y || other.y+other.height <= box.y, `${layout}: ${box.id} overlaps ${other.id}`);
        }
    }
});

test("all generation entrypoints load the shared model and renderer before the compatibility layer", async () => {
    for (const page of ["index","slides-builder","criar-aula"]) {
        const html = await fs.readFile(new URL(`../../plataforma/${page}.html`,import.meta.url),"utf8");
        const positions = ["slide-diagram-model.js","slide-diagram-renderer.js","slide-illustrations.js"].map(file => html.indexOf(file));
        assert.ok(positions[0] > 0 && positions[0] < positions[1] && positions[1] < positions[2],page);
    }
});

test("Render deploy includes the shared diagram contract and rebuilds when it changes", async () => {
    const blueprint = await fs.readFile(new URL("../../render.yaml", import.meta.url), "utf8");
    assert.doesNotMatch(blueprint, /^\s*rootDir:/m);
    assert.match(blueprint, /^\s*buildCommand: npm ci --prefix ai-service\s*$/m);
    assert.match(blueprint, /^\s*startCommand: npm start --prefix ai-service\s*$/m);
    for (const path of ["ai-service/**", "assets/js/slide-diagram-model.js", "render.yaml"]) {
        assert.ok(blueprint.includes(`- ${path}`), `missing deploy trigger: ${path}`);
    }
});

test("processes have numbered steps and enough separation to see arrowheads", () => {
    for (const count of [2, 3, 4, 5]) {
        const nodes = Array.from({ length: count }, (_, index) => ({ id: `n${index}`, label: `Etapa ${index + 1}`, detail: "Uma ação bem definida", icon: "idea" }));
        const diagram = { ...diagramExamples[0], nodes, links: nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id, kind: "arrow" })) };
        const original = plain(diagram);
        const image = api.render(diagram); assert.ok(image);
        const drawing = svg(image);
        assert.deepEqual([...drawing.matchAll(/data-diagram-step="(\d+)"/g)].map(match => Number(match[1])), Array.from({ length: count }, (_, i) => i + 1));
        assert.equal((drawing.match(/marker-end=/g) || []).length, count - 1);
        assert.doesNotMatch(drawing, /data-diagram-icon=/);
        const boxes = renderer.positions(diagram);
        boxes.slice(1).forEach((box, index) => assert.ok(box.y - boxes[index].y - boxes[index].height >= 25.9));
        assert.deepEqual(diagram, original, "display refinements must not change the material");
    }
});

test("repeated decorative icons are omitted without losing labels, details or inventing relationships", () => {
    const diagram = plain(diagramExamples[6]);
    diagram.nodes = diagram.nodes.map(node => ({ ...node, icon: "idea" }));
    const original = plain(diagram);
    const drawing = svg(api.render(diagram));
    assert.doesNotMatch(drawing, /data-diagram-icon=|data-diagram-step=|marker-end=/);
    assert.equal((drawing.match(/data-diagram-accent=/g) || []).length, diagram.nodes.length);
    for (const node of diagram.nodes) assert.ok(drawing.includes(node.label));
    assert.deepEqual(diagram, original);
    const varied = svg(api.render(diagramExamples[6]));
    assert.match(varied, /data-diagram-icon="sun"/);
    assert.match(varied, /data-diagram-icon="water"/);
});

test("comparison colours group each side consistently even without icons", () => {
    const diagram = plain(diagramExamples[1]);
    diagram.nodes = diagram.nodes.map(node => ({ ...node, icon: "none" }));
    const drawing = svg(api.render(diagram));
    const colours = [...drawing.matchAll(/<rect data-diagram-accent="\d+"[^>]*fill="(#[a-f0-9]+)"/g)].map(match => match[1]);
    assert.equal(colours.length, 4);
    assert.equal(colours[0], colours[2]); assert.equal(colours[1], colours[3]);
    assert.notEqual(colours[0], colours[1]);
    assert.doesNotMatch(drawing, /data-diagram-step=|marker-end=/);
});

test("illustration guidance selects relationships without a ready-made cards example or a specific topic", () => {
    const instructions = slideIllustrationInstructions({ includeIllustration: true }).join("\n");
    for (const fragment of ["ordem ou transformação", "repetição com retorno real", "mesmo critério", "classificação", "conceito central", "exemplos realmente independentes", "símbolos diferentes a conceitos equivalentes", "apenas repetir os bullets", "não comprova causalidade", "concordam com o texto do slide"]) assert.ok(instructions.includes(fragment), fragment);
    assert.doesNotMatch(instructions, /"status":"ready".*"layout":"cards"/);
    assert.doesNotMatch(instructions, /Polônia|Alemanha|Sistema Solar|Mercúrio/i);
    assert.match(slideIllustrationInstructions({ includeIllustration: false }).join("\n"), /Não inclua o campo illustration/);
});
