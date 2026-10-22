(function (root) {
    "use strict";
    const escape = value => String(value).toWellFormed().replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
    const palette = ["#a9d6c7", "#b4cce5", "#e9bc77", "#c2b5df", "#e9a78e", "#b9d9bd"];
    function normalizeTheme(raw) {
        if (!/^#[0-9a-f]{6}$/i.test(raw?.accent || "")) return null;
        return { accent: raw.accent.toLowerCase(), secondary_accent: /^#[0-9a-f]{6}$/i.test(raw.secondary_accent || "") ? raw.secondary_accent.toLowerCase() : raw.accent.toLowerCase() };
    }
    function mix(color, target, amount) {
        return "#" + [1, 3, 5].map(i => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - amount) + parseInt(target.slice(i, i + 2), 16) * amount).toString(16).padStart(2, "0")).join("");
    }
    function themeTokens(raw) {
        const theme = normalizeTheme(raw);
        if (!theme) return { palette, ink: "#173c43", detail: "#34545b", caption: "#4f7076", line: "#527f83", central: "#245961", icon: "#244b52", border: "#d6e5e3", canvas: "#eef5f3" };
        // White canvases and dark ink stay readable even for white/neon accents.
        return {
            palette: [mix(theme.accent, "#ffffff", .66), mix(theme.secondary_accent, "#ffffff", .66)],
            ink: mix(theme.accent, "#000000", .82), detail: mix(theme.accent, "#000000", .74),
            caption: mix(theme.accent, "#000000", .68), line: mix(theme.accent, "#000000", .48),
            central: mix(theme.accent, "#000000", .66), icon: mix(theme.accent, "#000000", .78),
            border: mix(theme.accent, "#ffffff", .82), canvas: mix(theme.accent, "#ffffff", .96)
        };
    }
    // Original, symbolic pictograms. Never accepted from generated markup.
    const symbols = {
        idea: '<path d="M17 32C5 21 12 6 24 6s19 15 7 26l-2 5H19Z"/><path d="M19 42h10M24 1v2M4 16l4 2M40 18l4-2"/>',
        question: '<circle cx="24" cy="24" r="19"/><path d="M18 17a6 6 0 1 1 10 5c-4 2-4 4-4 6M24 35v1"/>',
        person: '<circle cx="24" cy="13" r="8"/><path d="M8 43v-7a16 16 0 0 1 32 0v7Z"/>',
        people: '<circle cx="17" cy="15" r="7"/><circle cx="35" cy="17" r="5"/><path d="M3 42v-6a14 14 0 0 1 28 0v6ZM33 28c9-1 13 6 12 14H35"/>',
        book: '<path d="M24 12C16 6 7 7 3 9v30c8-3 16-1 21 4 5-5 13-7 21-4V9c-4-2-13-3-21 3v31M9 16l9 2M9 23l9 2M30 18l9-2M30 25l9-2"/>',
        speech: '<path d="M9 6h30a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H22L9 46v-8a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6ZM12 17h24M12 25h16"/>',
        building: '<path d="M4 43h40M7 18h34L24 5ZM11 20v20M24 20v20M37 20v20M5 43v-3h38v3"/>',
        balance: '<path d="M24 6v35M13 43h22M6 14h36M11 14 3 31h16ZM37 14 29 31h16Z"/>',
        globe: '<circle cx="24" cy="24" r="20"/><ellipse cx="24" cy="24" rx="9" ry="20"/><path d="M4 24h40M8 12c10 5 22 5 32 0M8 36c10-5 22-5 32 0"/>',
        clock: '<circle cx="24" cy="24" r="20"/><path d="M24 10v15l10 6"/>',
        calendar: '<rect x="5" y="8" width="38" height="35" rx="5"/><path d="M5 19h38M14 3v10M34 3v10M14 27h3M25 27h3M14 35h3M25 35h3"/>',
        plant: '<path d="M24 44V19M24 29C10 30 6 23 6 13c12-1 20 7 18 16ZM24 20C24 9 33 3 43 4c0 12-8 19-19 16ZM15 44h18"/>',
        leaf: '<path d="M7 40C-2 19 17 2 42 4c3 26-11 45-31 35M7 44 33 14M18 31l-1-11M25 23l10 1"/>',
        water: '<path d="M24 3C20 13 7 23 7 32a17 17 0 0 0 34 0C41 23 28 13 24 3ZM14 31c-1 5 3 9 7 9"/>',
        sun: '<circle cx="24" cy="24" r="11"/><path d="M24 2v6M24 40v6M2 24h6M40 24h6M8 8l5 5M35 35l5 5M8 40l5-5M35 13l5-5"/>',
        cloud: '<path d="M11 37a9 9 0 1 1 0-18 14 14 0 0 1 27-1 10 10 0 0 1 0 20ZM16 43v3M25 43v3M34 43v3"/>',
        animal: '<path d="M6 24C18 5 34 8 40 24 34 40 18 43 6 24Zm0 0L1 13v22ZM26 15c-5 5-5 13 0 18"/><circle cx="32" cy="22" r="1"/>',
        cell: '<path d="M7 14C15 0 39 3 44 20s-9 27-25 22S-2 30 7 14Z"/><circle cx="25" cy="24" r="8"/><path d="M12 19l3 2M15 34l3-2M34 13l2 3M36 33l3 1"/>',
        atom: '<ellipse cx="24" cy="24" rx="21" ry="8"/><ellipse cx="24" cy="24" rx="21" ry="8" transform="rotate(60 24 24)"/><ellipse cx="24" cy="24" rx="21" ry="8" transform="rotate(120 24 24)"/><circle cx="24" cy="24" r="3"/>',
        energy: '<path d="M28 2 8 28h14l-2 18 20-28H26Z"/>',
        flask: '<path d="M17 4h14M20 4v15L7 38a4 4 0 0 0 3 6h28a4 4 0 0 0 3-6L28 19V4M14 30h21M18 37h1M29 35h1"/>',
        gear: '<path d="M20 4h8l2 7 6-3 6 6-3 6 7 2v8l-7 2 3 6-6 6-6-3-2 6h-8l-2-6-6 3-6-6 3-6-7-2v-8l7-2-3-6 6-6 6 3Z"/><circle cx="24" cy="25" r="8"/>',
        computer: '<rect x="4" y="6" width="40" height="28" rx="4"/><path d="M24 34v8M13 43h22M5 28h38"/>',
        shield: '<path d="M24 3 6 10v13c0 12 10 18 18 23 8-5 18-11 18-23V10ZM15 23l6 6 12-12"/>',
        heart: '<path d="M24 43C-6 25 3 1 19 10l5 5 5-5c16-9 25 15-5 33Z"/>',
        number: '<path d="M7 7h9M12 7v14M7 21h10M28 9c8-7 16 1 6 8l-6 5h13M8 36h12M14 30v12M30 32l10 10M40 32 30 42"/>'
    };
    function textWidth(value, size) {
        return [...value].reduce((width, char) => width + size * (/\s/.test(char) ? .32 : /[MW@%]/.test(char) ? 1 : /[ilIjt.,:;!'|]/.test(char) ? .38 : /[A-Z0-9]/.test(char) ? .75 : /[\u0000-\u024f]/.test(char) ? .64 : 1), 0);
    }
    function wrap(value, width, size) {
        const lines = []; let current = "";
        for (const word of value.split(/\s+/).filter(Boolean)) {
            // Keep words intact. A smaller type size is preferable to arbitrary
            // breaks such as "Evaporaçã / o" in an instructional label.
            if (textWidth(word, size) > width) return null;
            const proposed = current ? `${current} ${word}` : word;
            if (textWidth(proposed, size) <= width) { current = proposed; continue; }
            if (current) lines.push(current);
            current = word;
        }
        if (current) lines.push(current);
        return lines;
    }
    function fitText(value, box, preferred, minimum, weight = 600, color = "#173c43") {
        if (!value) return { markup: "", height: 0 };
        for (let size = preferred; size >= minimum; size--) {
            const lines = wrap(value, box.width, size);
            if (!lines) continue;
            const height = lines.length * size * 1.2;
            if (height > box.height) continue;
            const top = box.y + (box.height - height) / 2;
            return { height, markup: `<text fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="middle">${lines.map((line, index) => `<tspan x="${box.x + box.width / 2}" y="${top + size + index * size * 1.2}">${escape(line)}</tspan>`).join("")}</text>` };
        }
        return null; // Do not crop or silently discard instructional labels.
    }
    function positions(diagram) {
        const nodes = diagram.nodes, count = nodes.length;
        const positioned = (node, x, y, width, height) => ({ ...node, x, y, width, height });
        if (diagram.layout === "process") {
            const gap = 26, height = (434 - gap * (count - 1)) / count;
            return nodes.map((node, index) => positioned(node, 38, 96 + index * (height + gap), 524, height));
        }
        if (diagram.layout === "cycle") return nodes.map((node, index) => {
            const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
            return positioned(node, 300 + 174 * Math.cos(angle) - 71, 318 + 174 * Math.sin(angle) - 54, 142, 108);
        });
        if (diagram.layout === "concept-map") return nodes.map((node, index) => {
            if (index === 0) return positioned(node, 220, 260, 160, 116);
            const angle = -Math.PI / 2 + (index - 1) * 2 * Math.PI / (count - 1);
            return positioned(node, 300 + 206 * Math.cos(angle) - 75, 318 + 178 * Math.sin(angle) - 54, 150, 108);
        });
        if (diagram.layout === "hierarchy") {
            const children = id => diagram.links.filter(link => link.from === id).map(link => link.to);
            const locations = new Map(); let leaf = 0;
            function visit(id, depth) {
                const descendants = children(id);
                const slots = descendants.map(child => visit(child, depth + 1));
                const slot = slots.length ? (Math.min(...slots) + Math.max(...slots)) / 2 : leaf++;
                locations.set(id, { slot, depth }); return slot;
            }
            visit(nodes[0].id, 0);
            const slotWidth = 552 / leaf, width = Math.min(196, slotWidth - 12);
            return nodes.map(node => { const position = locations.get(node.id); return positioned(node, 24 + (position.slot + .5) * slotWidth - width / 2, 90 + position.depth * 166, width, 112); });
        }
        if (count === 1) return [positioned(nodes[0], 88, 130, 424, 360)];
        const rows = Math.ceil(count / 2), height = (426 - 16 * (rows - 1)) / rows;
        return nodes.map((node, index) => positioned(node, count % 2 && index === count - 1 ? 169 : index % 2 ? 312 : 26, 98 + Math.floor(index / 2) * (height + 16), 262, height));
    }
    function port(from, to, padding = 3) {
        const x = from.x + from.width / 2, y = from.y + from.height / 2;
        const dx = to.x + to.width / 2 - x, dy = to.y + to.height / 2 - y;
        const ratio = Math.min(Math.abs(dx) ? (from.width / 2 + padding) / Math.abs(dx) : Infinity, Math.abs(dy) ? (from.height / 2 + padding) / Math.abs(dy) : Infinity);
        return [x + dx * ratio, y + dy * ratio];
    }
    function connection(link, nodes, colors) {
        const from = nodes.find(node => node.id === link.from), to = nodes.find(node => node.id === link.to);
        const [x1, y1] = port(from, to), [x2, y2] = port(to, from);
        const head = link.kind === "arrow" ? ' marker-end="url(#diagram-arrow)"' : "";
        return `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${colors.line}" stroke-width="3" stroke-linecap="round"${head}/>`;
    }
    function card(node, index, diagram, colors) {
        const { x, y, width, height } = node;
        const color = colors.palette[diagram.layout === "comparison" ? index % 2 : index % colors.palette.length];
        const central = diagram.layout === "concept-map" && index === 0;
        const ink = central ? "#f6fbfa" : colors.ink;
        const step = diagram.layout === "process";
        // Repeated pictograms add noise, not information. Keep all labels/links;
        // ordered processes use their actual position, never an invented symbol.
        const repeatedIcon = diagram.nodes.length > 1 && diagram.nodes.every(item => item.icon === node.icon);
        const hasIcon = !step && !repeatedIcon && node.icon !== "none" && Object.hasOwn(symbols, node.icon);
        const hasBadge = step || hasIcon;
        const horizontal = diagram.layout === "process" || (height < 170 && width > 220);
        const iconSize = step ? 36 : hasIcon ? (height > 250 ? 88 : height > 170 ? 64 : horizontal ? 36 : 24) : 0;
        const symbolX = horizontal ? x + 18 : x + (width - iconSize) / 2;
        const symbolY = horizontal ? y + (height - iconSize) / 2 : y + (height > 250 ? 40 : 8);
        const textInset = width < 170 ? 8 : 12;
        const textX = horizontal && hasBadge ? x + 70 : x + textInset;
        const textWidth = horizontal && hasBadge ? width - 84 : width - textInset * 2;
        const textY = !horizontal && hasIcon ? symbolY + iconSize + 8 : y + 8;
        const textHeight = y + height - 10 - textY;
        const labelBox = { x: textX, y: textY, width: textWidth, height: node.detail ? textHeight * .48 : textHeight };
        const detailBox = { x: textX, y: textY + textHeight * .48 + 5, width: textWidth, height: textHeight * .52 - 5 };
        const label = fitText(node.label, labelBox, width < 170 ? 19 : 24, width < 170 ? 14 : 16, 700, ink);
        const detail = fitText(node.detail, detailBox, 19, 16, 500, central ? ink : colors.detail);
        if (!label || !detail) return hasIcon ? card({ ...node, icon: "none" }, index, diagram, colors) : null;
        const background = `<rect x="${x}" y="${y+4}" width="${width}" height="${height}" rx="18" fill="${colors.ink}" opacity=".1"/><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="${central ? colors.central : "#ffffff"}" stroke="${central ? colors.central : colors.border}"/>`;
        const accent = `<rect data-diagram-accent="${index}" x="${x}" y="${y+18}" width="4" height="${height-36}" rx="2" fill="${central ? colors.palette[0] : color}"/>`;
        const badge = hasBadge ? `<rect x="${symbolX-6}" y="${symbolY-6}" width="${iconSize+12}" height="${iconSize+12}" rx="12" fill="${color}"/>` : "";
        const icon = hasIcon ? `<g data-diagram-icon="${node.icon}" transform="translate(${symbolX} ${symbolY}) scale(${iconSize/48})" fill="none" stroke="${colors.icon}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${symbols[node.icon]}</g>` : "";
        const number = step ? `<text data-diagram-step="${index+1}" x="${symbolX+iconSize/2}" y="${symbolY+iconSize/2+8}" text-anchor="middle" fill="${colors.ink}" font-family="Arial, sans-serif" font-size="24" font-weight="700">${index+1}</text>` : "";
        return background + accent + badge + icon + number + label.markup + detail.markup;
    }
    function render(raw, theme) {
        const diagram = root.EducariaSlideDiagramModel?.normalize(raw);
        if (!diagram || diagram.status !== "ready") return null;
        const nodes = positions(diagram);
        const colors = themeTokens(theme);
        const title = fitText(diagram.title, { x: 28, y: 14, width: 544, height: 62 }, 27, 22, 700, colors.ink);
        const caption = fitText(diagram.caption, { x: 30, y: 556, width: 540, height: 38 }, 16, 13, 500, colors.caption);
        const cards = nodes.map((node, index) => card(node, index, diagram, colors));
        if (!title || !caption || cards.some(value => value === null)) return null;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img"><title>${escape(diagram.description)}</title><defs><marker id="diagram-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1 9 5 0 9Z" fill="${colors.line}"/></marker></defs><rect width="600" height="600" rx="28" fill="${colors.canvas}"/>${title.markup}${diagram.links.map(link => connection(link, nodes, colors)).join("")}${cards.join("")}${caption.markup}</svg>`;
        return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, description: diagram.description };
    }
    root.EducariaSlideDiagramRenderer = Object.freeze({ render, positions, fitText, normalizeTheme });
})(typeof window === "undefined" ? globalThis : window);
