(function () {
    const LETTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    function normalizeText(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase();
    }

    function directionLabel(mode) {
        if (mode === "basic") return "Horizontal e vertical";
        if (mode === "full") return "Todas as direções";
        return "Com diagonais";
    }

    function directionVectors(mode) {
        if (mode === "basic") {
            return [
                { key: "E", row: 0, col: 1 },
                { key: "S", row: 1, col: 0 }
            ];
        }

        if (mode === "full") {
            return [
                { key: "E", row: 0, col: 1 },
                { key: "W", row: 0, col: -1 },
                { key: "S", row: 1, col: 0 },
                { key: "N", row: -1, col: 0 },
                { key: "SE", row: 1, col: 1 },
                { key: "SW", row: 1, col: -1 },
                { key: "NE", row: -1, col: 1 },
                { key: "NW", row: -1, col: -1 }
            ];
        }

        return [
            { key: "E", row: 0, col: 1 },
            { key: "S", row: 1, col: 0 },
            { key: "SE", row: 1, col: 1 },
            { key: "NE", row: -1, col: 1 }
        ];
    }

    function clampRows(value) {
        const parsed = Number(value || 10);
        return Math.max(6, Math.min(14, parsed || 10));
    }

    function deriveWideCols(rows) {
        const presets = new Map([
            [6, 10],
            [8, 14],
            [10, 17],
            [12, 20],
            [14, 24]
        ]);

        return presets.get(rows) || Math.min(24, Math.max(rows + 4, Math.ceil(rows * 1.65)));
    }

    function hashSeed(seed) {
        const text = String(seed || "");
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function seededRandom(seed) {
        let state = hashSeed(seed) || 1;
        return function nextRandom() {
            state += 0x6d2b79f5;
            let value = state;
            value = Math.imul(value ^ (value >>> 15), value | 1);
            value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
            return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
    }

    function createGrid(rows, cols) {
        return Array.from({ length: rows }, () => Array(cols).fill(""));
    }

    function sanitizeWords(words) {
        const unique = new Set();
        return (Array.isArray(words) ? words : [])
            .map((item, index) => {
                const term = String(item?.term || "").trim();
                const clue = String(item?.clue || "").trim();
                const cleanTerm = normalizeText(term);
                return {
                    id: item?.id || `word-${index + 1}`,
                    order: index,
                    term,
                    clue,
                    cleanTerm
                };
            })
            .filter((item) => item.cleanTerm.length >= 2)
            .filter((item) => {
                if (unique.has(item.cleanTerm)) return false;
                unique.add(item.cleanTerm);
                return true;
            });
    }

    function scorePlacement(grid, word, row, col, direction) {
        let overlapScore = 0;

        for (let index = 0; index < word.length; index += 1) {
            const targetRow = row + direction.row * index;
            const targetCol = col + direction.col * index;
            const current = grid[targetRow]?.[targetCol];

            if (current === undefined) return -1;
            if (current && current !== word[index]) return -1;
            if (current === word[index]) overlapScore += 1;
        }

        return overlapScore;
    }

    function placeWord(grid, entry, row, col, direction) {
        for (let index = 0; index < entry.cleanTerm.length; index += 1) {
            const targetRow = row + direction.row * index;
            const targetCol = col + direction.col * index;
            grid[targetRow][targetCol] = entry.cleanTerm[index];
        }
    }

    function fillEmptyCells(grid, random) {
        grid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell) return;
                const nextIndex = Math.floor(random() * LETTER_POOL.length);
                grid[rowIndex][colIndex] = LETTER_POOL[nextIndex];
            });
        });
    }

    function buildPuzzleForDimensions(entries, rows, cols, mode, seed) {
        const random = seededRandom(`${seed}:${rows}:${cols}:${mode}`);
        const grid = createGrid(rows, cols);
        const placed = new Map();
        const sortedEntries = [...entries].sort((left, right) => {
            if (right.cleanTerm.length !== left.cleanTerm.length) {
                return right.cleanTerm.length - left.cleanTerm.length;
            }
            return left.order - right.order;
        });

        sortedEntries.forEach((entry) => {
            let bestScore = -1;
            const candidates = [];

            directionVectors(mode).forEach((direction) => {
                for (let row = 0; row < rows; row += 1) {
                    for (let col = 0; col < cols; col += 1) {
                        const score = scorePlacement(grid, entry.cleanTerm, row, col, direction);
                        if (score < 0) continue;

                        if (score > bestScore) {
                            bestScore = score;
                            candidates.length = 0;
                            candidates.push({ row, col, direction });
                            continue;
                        }

                        if (score === bestScore) {
                            candidates.push({ row, col, direction });
                        }
                    }
                }
            });

            if (!candidates.length) return;

            const chosen = candidates[Math.floor(random() * candidates.length)];
            placeWord(grid, entry, chosen.row, chosen.col, chosen.direction);
            placed.set(entry.id, {
                ...entry,
                row: chosen.row,
                col: chosen.col,
                direction: chosen.direction.key
            });
        });

        fillEmptyCells(grid, random);

        const entriesOrdered = [...entries]
            .sort((left, right) => left.order - right.order)
            .map((entry) => placed.get(entry.id) || { ...entry, row: -1, col: -1, direction: "" });

        return {
            rows,
            cols,
            mode,
            entries: entriesOrdered,
            placedEntries: entriesOrdered.filter((entry) => entry.row >= 0 && entry.col >= 0),
            omittedEntries: entriesOrdered.filter((entry) => entry.row < 0 || entry.col < 0),
            grid
        };
    }

    function createPuzzle(options = {}) {
        const entries = sanitizeWords(options.words);
        const requestedRows = clampRows(options.size);
        const requestedCols = deriveWideCols(requestedRows);
        const mode = options.mode || "diagonal";
        const seed = options.seed || JSON.stringify({
            mode,
            rows: requestedRows,
            cols: requestedCols,
            words: entries.map((entry) => `${entry.term}|${entry.clue}`)
        });

        if (!entries.length) {
            return {
                requestedRows,
                requestedCols,
                rows: requestedRows,
                cols: requestedCols,
                mode,
                sizeAdjusted: false,
                entries: [],
                placedEntries: [],
                omittedEntries: [],
                grid: createGrid(requestedRows, requestedCols)
            };
        }

        const longestWord = Math.max(...entries.map((entry) => entry.cleanTerm.length), requestedCols);
        const totalLetters = entries.reduce((total, entry) => total + entry.cleanTerm.length, 0);
        const startRows = requestedRows;
        const startCols = Math.max(requestedCols, longestWord);
        const maxRows = Math.max(startRows, Math.min(14, requestedRows + 2));
        const estimatedCols = Math.ceil(totalLetters / Math.max(1, requestedRows * 0.72));
        const maxCols = Math.max(startCols, Math.min(24, Math.max(requestedCols + 8, longestWord + 4, estimatedCols)));

        let bestPuzzle = null;

        for (let rows = startRows; rows <= maxRows; rows += 1) {
            const preferredCols = Math.max(startCols, deriveWideCols(rows));
            for (let cols = preferredCols; cols <= maxCols; cols += 1) {
                const puzzle = buildPuzzleForDimensions(entries, rows, cols, mode, seed);
                if (!bestPuzzle || puzzle.placedEntries.length > bestPuzzle.placedEntries.length) {
                    bestPuzzle = puzzle;
                }

                if (!puzzle.omittedEntries.length) {
                    bestPuzzle = puzzle;
                    rows = maxRows;
                    break;
                }
            }
        }

        return {
            ...bestPuzzle,
            requestedRows,
            requestedCols,
            sizeAdjusted: bestPuzzle.rows !== requestedRows || bestPuzzle.cols !== requestedCols
        };
    }

    function directionVectorByKey(key) {
        return directionVectors("full").find((direction) => direction.key === key) || { row: 0, col: 1 };
    }

    function buildSolutionCellSet(puzzle) {
        const cells = new Set();
        (puzzle?.placedEntries || []).forEach((entry) => {
            const direction = directionVectorByKey(entry.direction);
            for (let index = 0; index < entry.cleanTerm.length; index += 1) {
                const row = entry.row + direction.row * index;
                const col = entry.col + direction.col * index;
                cells.add(`${row}-${col}`);
            }
        });
        return cells;
    }

    function buildBoardMarkup(puzzle, options = {}) {
        const highlightCells = options.highlightCells instanceof Set ? options.highlightCells : new Set();
        const highlightMap = options.highlightMap instanceof Map ? options.highlightMap : new Map();
        const grid = Array.isArray(puzzle?.grid) ? puzzle.grid : [];
        const rows = Number(puzzle?.rows || grid.length || 0);
        const cols = Number(puzzle?.cols || grid[0]?.length || 0);

        return `
            <div class="wordsearch-grid-inner" style="--wordsearch-rows:${rows}; --wordsearch-cols:${cols};" role="grid" aria-label="Grade do caça-palavras">
                ${grid.map((row, rowIndex) => row.map((letter, colIndex) => {
                    const key = `${rowIndex}-${colIndex}`;
                    const mappedHighlight = highlightMap.get(key);
                    const classes = ["wordsearch-cell"];
                    let style = "";

                    if (mappedHighlight) {
                        classes.push("is-word-highlight");
                        if (typeof mappedHighlight === "string") {
                            style = ` style="${mappedHighlight}"`;
                        } else {
                            if (mappedHighlight.className) classes.push(mappedHighlight.className);
                            if (mappedHighlight.style) style = ` style="${mappedHighlight.style}"`;
                        }
                    } else if (highlightCells.has(key)) {
                        classes.push("is-solution");
                    }

                    return `<span class="${classes.join(" ")}" role="gridcell" data-wordsearch-cell="${key}" data-wordsearch-row="${rowIndex}" data-wordsearch-col="${colIndex}"${style}>${escapeHtml(letter || "")}</span>`;
                }).join("")).join("")}
            </div>
        `;
    }

    window.EducarIAWordsearch = {
        buildBoardMarkup,
        buildSolutionCellSet,
        createPuzzle,
        directionLabel,
        escapeHtml,
        normalizeText
    };
}());
