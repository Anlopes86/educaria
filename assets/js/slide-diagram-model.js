(function (root) {
    "use strict";
    // Shared, DOM-free contract: the server and recovered browser drafts use the
    // same structural checks. No generated markup, URLs or coordinates are accepted.
    const icons = ["none", "idea", "question", "person", "people", "book", "speech", "building", "balance", "globe", "clock", "calendar", "plant", "leaf", "water", "sun", "cloud", "animal", "cell", "atom", "energy", "flask", "gear", "computer", "shield", "heart", "number"];
    const layouts = { process: [2, 5], cycle: [3, 6], comparison: [2, 6], "concept-map": [3, 5], hierarchy: [3, 7], cards: [1, 6] };
    const textSchema = maxLength => ({ type: "string", maxLength });
    const schema = {
        type: "object", additionalProperties: false,
        required: ["version", "status", "description", "title", "layout", "caption", "nodes", "links"],
        properties: {
            version: { type: "integer", enum: [2] },
            status: { type: "string", enum: ["ready", "not-needed", "needs-image"] },
            description: textSchema(300), title: textSchema(52),
            layout: { type: "string", enum: Object.keys(layouts) }, caption: textSchema(100),
            nodes: { type: "array", maxItems: 7, items: {
                type: "object", additionalProperties: false, required: ["id", "label", "detail", "icon"],
                properties: { id: textSchema(16), label: textSchema(32), detail: textSchema(48), icon: { type: "string", enum: icons } }
            } },
            links: { type: "array", maxItems: 7, items: {
                type: "object", additionalProperties: false, required: ["from", "to", "kind"],
                properties: { from: textSchema(16), to: textSchema(16), kind: { type: "string", enum: ["arrow", "line"] } }
            } }
        }
    };
    const clean = (value, max) => typeof value === "string" && value.length <= max ? value.replace(/[\u0000-\u001f]/g, " ").trim() : null;
    const invalid = () => ({ version: 2, status: "invalid", description: "", title: "", layout: "cards", caption: "", nodes: [], links: [] });

    function normalize(raw) {
        if (!raw || raw.version !== 2) return null;
        if (["not-needed", "needs-image", "invalid"].includes(raw.status)) return { ...invalid(), status: raw.status };
        if (raw.status !== "ready" || !Object.hasOwn(layouts, raw.layout)) return invalid();
        const description = clean(raw.description, 300), title = clean(raw.title, 52), caption = clean(raw.caption, 100);
        if (!description || !title || caption === null || !Array.isArray(raw.nodes) || !Array.isArray(raw.links)) return invalid();
        const [min, max] = layouts[raw.layout];
        if (raw.nodes.length < min || raw.nodes.length > max || raw.links.length > 7) return invalid();
        if (raw.layout === "comparison" && raw.nodes.length % 2) return invalid();
        const nodes = [], ids = new Set();
        for (const node of raw.nodes) {
            if (!node || typeof node.id !== "string" || !/^[a-z][a-z0-9_-]{0,15}$/.test(node.id) || ids.has(node.id)) return invalid();
            const label = clean(node.label, 32), detail = clean(node.detail, 48);
            if (!label || detail === null || !icons.includes(node.icon)) return invalid();
            // Dense relational drawings only have room for their actual labels.
            if (["cycle", "concept-map", "hierarchy"].includes(raw.layout) && detail) return invalid();
            nodes.push({ id: node.id, label, detail, icon: node.icon }); ids.add(node.id);
        }
        const links = [], seen = new Set();
        for (const link of raw.links) {
            if (!link || !ids.has(link.from) || !ids.has(link.to) || link.from === link.to) return invalid();
            const key = `${link.from}>${link.to}`;
            if (!["arrow", "line"].includes(link.kind) || seen.has(key)) return invalid();
            links.push({ from: link.from, to: link.to, kind: link.kind }); seen.add(key);
        }
        const count = nodes.length;
        if (["cards", "comparison"].includes(raw.layout) && links.length) return invalid();
        if (["process", "cycle"].includes(raw.layout)) {
            const expected = raw.layout === "cycle" ? count : count - 1;
            if (links.length !== expected) return invalid();
            if (links.some(link => link.kind !== "arrow")) return invalid();
            for (let i = 0; i < expected; i++) if (!seen.has(`${nodes[i].id}>${nodes[(i + 1) % count].id}`)) return invalid();
        }
        if (raw.layout === "concept-map") {
            const center = nodes[0].id;
            if (links.length !== count - 1) return invalid();
            const connected = new Set();
            for (const link of links) {
                if (link.from !== center && link.to !== center) return invalid();
                connected.add(link.from === center ? link.to : link.from);
            }
            if (connected.size !== count - 1) return invalid();
        }
        if (raw.layout === "hierarchy") {
            const center = nodes[0].id, parents = new Map();
            if (links.length !== count - 1) return invalid();
            for (const link of links) {
                if (link.to === center || parents.has(link.to)) return invalid();
                parents.set(link.to, link.from);
            }
            for (const node of nodes.slice(1)) {
                let cursor = node.id, depth = 0;
                while (cursor !== center && depth <= 2) { cursor = parents.get(cursor); depth++; }
                if (cursor !== center || depth > 2) return invalid();
            }
            const leafCount = nodes.filter(node => !links.some(link => link.from === node.id)).length;
            if (leafCount > 4) return invalid();
        }
        return { version: 2, status: "ready", description, title, layout: raw.layout, caption, nodes, links };
    }
    const api = Object.freeze({ schema, normalize, icons: Object.freeze(icons) });
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.EducariaSlideDiagramModel = api;
})(typeof window === "undefined" ? globalThis : window);
