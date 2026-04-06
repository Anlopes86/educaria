(function () {
    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    function normalizeAnswer(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase();
    }

    function clampSize(value) {
        const parsed = Number(value || 11);
        return Math.max(9, Math.min(17, parsed || 11));
    }

    function sanitizeEntries(entries) {
        const used = new Set();
        return (Array.isArray(entries) ? entries : [])
            .map((entry, index) => {
                const answer = String(entry?.answer || "").trim();
                const clue = String(entry?.clue || "").trim();
                const cleanAnswer = normalizeAnswer(answer);
                return {
                    id: entry?.id || `crossword-${index + 1}`,
                    order: index,
                    answer,
                    clue,
                    cleanAnswer
                };
            })
            .filter((entry) => entry.cleanAnswer.length >= 2)
            .filter((entry) => {
                if (used.has(entry.cleanAnswer)) return false;
                used.add(entry.cleanAnswer);
                return true;
            })
            .sort((left, right) => {
                if (right.cleanAnswer.length !== left.cleanAnswer.length) {
                    return right.cleanAnswer.length - left.cleanAnswer.length;
                }
                return left.order - right.order;
            });
    }

    function createGrid(size) {
        return Array.from({ length: size }, () => Array(size).fill(null));
    }

    function directionDelta(orientation) {
        return orientation === "down" ? { row: 1, col: 0 } : { row: 0, col: 1 };
    }

    function insideGrid(grid, row, col) {
        return row >= 0 && row < grid.length && col >= 0 && col < grid[0].length;
    }

    function cellAt(grid, row, col) {
        return insideGrid(grid, row, col) ? grid[row][col] : null;
    }

    function canPlaceEntry(grid, entry, row, col, orientation, requireIntersection = true) {
        const delta = directionDelta(orientation);
        const beforeCell = cellAt(grid, row - delta.row, col - delta.col);
        if (beforeCell) return null;

        const endRow = row + delta.row * entry.cleanAnswer.length;
        const endCol = col + delta.col * entry.cleanAnswer.length;
        const afterCell = cellAt(grid, endRow, endCol);
        if (afterCell) return null;

        let intersections = 0;

        for (let index = 0; index < entry.cleanAnswer.length; index += 1) {
            const targetRow = row + delta.row * index;
            const targetCol = col + delta.col * index;
            if (!insideGrid(grid, targetRow, targetCol)) return null;

            const existing = grid[targetRow][targetCol];
            if (existing) {
                if (existing.letter !== entry.cleanAnswer[index]) return null;
                if ((orientation === "across" && existing.across) || (orientation === "down" && existing.down)) {
                    return null;
                }
                intersections += 1;
                continue;
            }

            if (orientation === "across") {
                if (cellAt(grid, targetRow - 1, targetCol) || cellAt(grid, targetRow + 1, targetCol)) {
                    return null;
                }
            } else if (cellAt(grid, targetRow, targetCol - 1) || cellAt(grid, targetRow, targetCol + 1)) {
                return null;
            }
        }

        if (requireIntersection && intersections === 0) return null;

        return { row, col, orientation, intersections };
    }

    function placeEntry(grid, entry, placement) {
        const delta = directionDelta(placement.orientation);

        for (let index = 0; index < entry.cleanAnswer.length; index += 1) {
            const targetRow = placement.row + delta.row * index;
            const targetCol = placement.col + delta.col * index;
            const existing = grid[targetRow][targetCol];
            if (!existing) {
                grid[targetRow][targetCol] = {
                    letter: entry.cleanAnswer[index],
                    across: placement.orientation === "across",
                    down: placement.orientation === "down",
                    entries: [entry.id],
                    number: 0
                };
                continue;
            }

            existing.across = existing.across || placement.orientation === "across";
            existing.down = existing.down || placement.orientation === "down";
            if (!existing.entries.includes(entry.id)) {
                existing.entries.push(entry.id);
            }
        }

        return {
            ...entry,
            row: placement.row,
            col: placement.col,
            orientation: placement.orientation,
            intersections: placement.intersections
        };
    }

    function placementScore(size, placement) {
        const center = Math.floor(size / 2);
        const distance = Math.abs(center - placement.row) + Math.abs(center - placement.col);
        return placement.intersections * 100 - distance;
    }

    function candidatePlacements(grid, entry) {
        const seen = new Set();
        const candidates = [];
        const size = grid.length;

        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                const cell = grid[row][col];
                if (!cell) continue;

                for (let index = 0; index < entry.cleanAnswer.length; index += 1) {
                    if (entry.cleanAnswer[index] !== cell.letter) continue;

                    if (cell.down) {
                        const candidate = canPlaceEntry(grid, entry, row, col - index, "across");
                        if (candidate) {
                            const key = `${candidate.orientation}:${candidate.row}:${candidate.col}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                candidates.push(candidate);
                            }
                        }
                    }

                    if (cell.across) {
                        const candidate = canPlaceEntry(grid, entry, row - index, col, "down");
                        if (candidate) {
                            const key = `${candidate.orientation}:${candidate.row}:${candidate.col}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                candidates.push(candidate);
                            }
                        }
                    }
                }
            }
        }

        return candidates.sort((left, right) => {
            const scoreDiff = placementScore(size, right) - placementScore(size, left);
            if (scoreDiff !== 0) return scoreDiff;
            if (left.row !== right.row) return left.row - right.row;
            if (left.col !== right.col) return left.col - right.col;
            return left.orientation.localeCompare(right.orientation);
        });
    }

    function buildPuzzleForSize(entries, size) {
        if (!entries.length) {
            return {
                size,
                grid: createGrid(size),
                placedEntries: [],
                omittedEntries: []
            };
        }

        if (entries[0].cleanAnswer.length > size) return null;

        const grid = createGrid(size);
        const placedEntries = [];
        const omittedEntries = [];
        const first = entries[0];
        const initialPlacement = {
            row: Math.floor(size / 2),
            col: Math.max(0, Math.floor((size - first.cleanAnswer.length) / 2)),
            orientation: "across",
            intersections: 0
        };

        placedEntries.push(placeEntry(grid, first, initialPlacement));

        entries.slice(1).forEach((entry) => {
            const candidates = candidatePlacements(grid, entry);
            if (!candidates.length) {
                omittedEntries.push(entry);
                return;
            }

            placedEntries.push(placeEntry(grid, entry, candidates[0]));
        });

        return { size, grid, placedEntries, omittedEntries };
    }

    function trimGrid(result) {
        const occupied = [];
        result.grid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell) occupied.push({ row: rowIndex, col: colIndex });
            });
        });

        if (!occupied.length) {
            return {
                ...result,
                rows: result.size,
                cols: result.size
            };
        }

        const minRow = Math.min(...occupied.map((item) => item.row));
        const maxRow = Math.max(...occupied.map((item) => item.row));
        const minCol = Math.min(...occupied.map((item) => item.col));
        const maxCol = Math.max(...occupied.map((item) => item.col));

        const grid = Array.from({ length: maxRow - minRow + 1 }, (_, rowOffset) =>
            Array.from({ length: maxCol - minCol + 1 }, (_, colOffset) => result.grid[minRow + rowOffset][minCol + colOffset])
        );

        const placedEntries = result.placedEntries.map((entry) => ({
            ...entry,
            row: entry.row - minRow,
            col: entry.col - minCol
        }));

        return {
            ...result,
            grid,
            placedEntries,
            rows: grid.length,
            cols: grid[0]?.length || 0
        };
    }

    function assignNumbers(puzzle) {
        const grid = puzzle.grid;
        let nextNumber = 1;
        const acrossEntries = [];
        const downEntries = [];

        const findEntry = (row, col, orientation) => {
            return puzzle.placedEntries.find((entry) => entry.row === row && entry.col === col && entry.orientation === orientation) || null;
        };

        for (let row = 0; row < grid.length; row += 1) {
            for (let col = 0; col < grid[row].length; col += 1) {
                const cell = grid[row][col];
                if (!cell) continue;

                const startsAcross = cell.across && !cellAt(grid, row, col - 1);
                const startsDown = cell.down && !cellAt(grid, row - 1, col);
                if (!startsAcross && !startsDown) continue;

                cell.number = nextNumber;

                if (startsAcross) {
                    const entry = findEntry(row, col, "across");
                    if (entry) {
                        entry.number = nextNumber;
                        acrossEntries.push(entry);
                    }
                }

                if (startsDown) {
                    const entry = findEntry(row, col, "down");
                    if (entry) {
                        entry.number = nextNumber;
                        downEntries.push(entry);
                    }
                }

                nextNumber += 1;
            }
        }

        return {
            ...puzzle,
            acrossEntries: acrossEntries.sort((left, right) => left.number - right.number),
            downEntries: downEntries.sort((left, right) => left.number - right.number)
        };
    }

    function createPuzzle(options = {}) {
        const entries = sanitizeEntries(options.entries);
        const requestedSize = clampSize(options.size);

        if (!entries.length) {
            return {
                requestedSize,
                size: requestedSize,
                sizeAdjusted: false,
                rows: requestedSize,
                cols: requestedSize,
                grid: createGrid(requestedSize),
                placedEntries: [],
                omittedEntries: [],
                acrossEntries: [],
                downEntries: []
            };
        }

        const maxSize = Math.max(requestedSize, Math.min(17, Math.max(entries[0].cleanAnswer.length, requestedSize + 4)));
        let bestPuzzle = null;

        for (let size = Math.max(requestedSize, entries[0].cleanAnswer.length); size <= maxSize; size += 1) {
            const result = buildPuzzleForSize(entries, size);
            if (!result) continue;

            const trimmed = assignNumbers(trimGrid(result));
            const currentArea = trimmed.rows * trimmed.cols;
            const bestArea = bestPuzzle ? bestPuzzle.rows * bestPuzzle.cols : Infinity;

            if (!bestPuzzle
                || trimmed.placedEntries.length > bestPuzzle.placedEntries.length
                || (trimmed.placedEntries.length === bestPuzzle.placedEntries.length && currentArea < bestArea)) {
                bestPuzzle = trimmed;
            }

            if (trimmed.omittedEntries.length === 0) break;
        }

        return {
            ...bestPuzzle,
            requestedSize,
            sizeAdjusted: bestPuzzle.size !== requestedSize
        };
    }

    function buildBoardMarkup(puzzle, options = {}) {
        const mode = options.mode || "preview";
        const revealAnswers = options.revealAnswers !== false;
        const values = typeof options.values === "object" && options.values ? options.values : {};
        const correctCells = options.correctCells instanceof Set ? options.correctCells : new Set();
        const incorrectCells = options.incorrectCells instanceof Set ? options.incorrectCells : new Set();
        const rows = Number(puzzle?.rows || puzzle?.grid?.length || 0);
        const cols = Number(puzzle?.cols || puzzle?.grid?.[0]?.length || 0);
        const grid = Array.isArray(puzzle?.grid) ? puzzle.grid : [];

        return `
            <div class="crossword-grid" style="--crossword-cols:${cols};" role="grid" aria-label="Grade das palavras cruzadas">
                ${grid.map((row, rowIndex) => row.map((cell, colIndex) => {
                    const key = `${rowIndex}-${colIndex}`;
                    if (!cell) {
                        return `<span class="crossword-cell crossword-cell--blocked" aria-hidden="true"></span>`;
                    }

                    const classes = ["crossword-cell"];
                    if (mode === "play") classes.push("crossword-cell--play");
                    if (correctCells.has(key)) classes.push("is-correct");
                    if (incorrectCells.has(key)) classes.push("is-incorrect");

                    const number = cell.number ? `<span class="crossword-cell-number">${cell.number}</span>` : "";
                    const inputValue = String(values[key] || "").slice(0, 1).toUpperCase();

                    if (mode === "play" && !revealAnswers) {
                        return `
                            <label class="${classes.join(" ")}" data-crossword-cell="${key}">
                                ${number}
                                <input type="text" maxlength="1" autocomplete="off" spellcheck="false" inputmode="latin" value="${escapeHtml(inputValue)}" data-crossword-input="${key}" aria-label="Celula ${rowIndex + 1}, ${colIndex + 1}">
                            </label>
                        `;
                    }

                    const letter = revealAnswers ? cell.letter : inputValue;
                    return `
                        <span class="${classes.join(" ")}" data-crossword-cell="${key}">
                            ${number}
                            <strong>${escapeHtml(letter)}</strong>
                        </span>
                    `;
                }).join("")).join("")}
            </div>
        `;
    }

    window.EducarIACrossword = {
        buildBoardMarkup,
        createPuzzle,
        escapeHtml,
        normalizeAnswer
    };
}());
