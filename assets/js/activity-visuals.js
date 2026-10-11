/* Shared display palettes. Never write to saved materials from a presentation. */
(function (root) {
    "use strict";
    const slidePalettes = [
        [["#d7f5f6", "#0f172a", "#0ea5e9"], ["#153c41", "#f8f9ec", "#d7e6b9"]],
        [["#102a43", "#f8fafc", "#2dd4bf"], ["#153c41", "#f8f9ec", "#d7e6b9"]],
        [["#153e3a", "#f8fafc", "#facc15"], ["#153c41", "#f8f9ec", "#d7e6b9"]],
        [["#fff7ed", "#7c2d12", "#f97316"], ["#f5f0de", "#473e24", "#927044"]],
        [["#f0fdfa", "#16324f", "#0f766e"], ["#e8f3ed", "#173c43", "#226963"]],
        [["#eff6ff", "#172554", "#2563eb"], ["#faf8ef", "#173c43", "#226963"]]
    ];
    const equal = (a, b) => a.every((value, i) => String(value || "").toLowerCase() === b[i]);
    function slide(colors) {
        const match = slidePalettes.find(([old]) => equal([colors.slideColor, colors.textColor, colors.accentColor], old));
        return match ? { ...colors, slideColor: match[1][0], textColor: match[1][1], accentColor: match[1][2] } : { ...colors };
    }
    function flashcard(colors) {
        return equal([colors.frontColor, colors.backColor, colors.textColor], ["#ffffff", "#dbeafe", "#0f172a"])
            ? { ...colors, frontColor: "#e1d7f0", backColor: "#fffaf1", textColor: "#463563" }
            : { ...colors };
    }
    const wheelLegacy = ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
    const wheelPalette = ["#a9d6c7", "#b4cce5", "#e9bc77", "#e9a78e", "#c2b5df", "#b9d9bd"];
    function wheel(segments, palette = segments) {
        const colors = palette.map(segment => String(segment.color || "").toLowerCase());
        const isLegacy = new Set(colors).size > 1 && colors.every(color => wheelLegacy.includes(color));
        return segments.map(segment => ({ ...segment, color: isLegacy ? wheelPalette[wheelLegacy.indexOf(segment.color.toLowerCase())] : segment.color }));
    }
    root.EducariaVisuals = Object.freeze({ slide, flashcard, wheel });
})(typeof window === "undefined" ? globalThis : window);
