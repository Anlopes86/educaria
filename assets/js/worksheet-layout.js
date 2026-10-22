/* Print layout decisions use measured A4 dimensions, never screen size or AI. */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.EducariaWorksheetLayout = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";
    function useTwoColumns(first, second, { pageHeight, remaining, gap = 0 }) {
        if (!first || !second || !first.half.readable || !second.half.readable) return false;
        const pairHeight = Math.max(first.half.height, second.half.height);
        const separateHeight = first.full.height + second.full.height + gap;
        // Reject cramped text, oversized rows and pairs with negligible space savings.
        if (pairHeight > pageHeight || pairHeight > separateHeight * .88) return false;
        if ([first, second].some(item => item.half.height > item.full.height * 1.65)) return false;
        // Keep the current activity on this page when pairing would push both to the next.
        if (pairHeight > remaining + 1 && first.full.height <= remaining + 1) return false;
        return true;
    }
    return Object.freeze({ useTwoColumns });
});
