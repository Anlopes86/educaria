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
            .replace(/[^A-Za-z0-9\s-]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    function sanitizeEntries(entries) {
        const used = new Set();

        return (Array.isArray(entries) ? entries : [])
            .map((entry, index) => {
                const answer = String(entry?.answer || "").trim();
                const clue = String(entry?.clue || "").trim();
                const category = String(entry?.category || "").trim();
                const cleanAnswer = normalizeAnswer(answer);
                const guessableChars = [...cleanAnswer].filter((char) => /[A-Z0-9]/.test(char));

                return {
                    id: entry?.id || `hangman-${index + 1}`,
                    answer,
                    clue,
                    category,
                    cleanAnswer,
                    guessableChars,
                    guessableSet: new Set(guessableChars)
                };
            })
            .filter((entry) => entry.guessableChars.length >= 2)
            .filter((entry) => {
                if (used.has(entry.cleanAnswer)) return false;
                used.add(entry.cleanAnswer);
                return true;
            });
    }

    function buildMask(entry, guessedLetters, revealAnswer = false) {
        const guessed = guessedLetters instanceof Set ? guessedLetters : new Set();
        const source = entry?.cleanAnswer || "";

        return [...source].map((char) => {
            const guessable = /[A-Z0-9]/.test(char);
            const visible = revealAnswer || !guessable || guessed.has(char);

            return {
                char,
                guessable,
                visible,
                display: visible ? char : "_"
            };
        });
    }

    function isSolved(entry, guessedLetters) {
        const guessed = guessedLetters instanceof Set ? guessedLetters : new Set();
        return [...(entry?.guessableSet || [])].every((char) => guessed.has(char));
    }

    function keyboardRows() {
        return [
            ["A", "B", "C", "D", "E", "F", "G"],
            ["H", "I", "J", "K", "L", "M", "N"],
            ["O", "P", "Q", "R", "S", "T", "U"],
            ["V", "W", "X", "Y", "Z"]
        ];
    }

    window.EducarIAHangman = {
        buildMask,
        escapeHtml,
        isSolved,
        keyboardRows,
        normalizeAnswer,
        sanitizeEntries
    };
}());
