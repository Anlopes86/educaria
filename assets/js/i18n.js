(function initEducariaI18n() {
    const STORAGE_KEY = "educaria:i18n:language";
    const DEFAULT_LANGUAGE = "pt-BR";
    const SUPPORTED_LANGUAGES = new Set(["pt-BR", "en-US", "es-ES"]);
    const scriptSrc = document.currentScript?.getAttribute("src") || "";
    const assetPrefix = scriptSrc.includes("../assets/") ? "../assets" : "assets";
    let currentDictionary = {};

    function normalizeLanguage(language) {
        const value = String(language || "").trim();
        if (SUPPORTED_LANGUAGES.has(value)) return value;

        const lower = value.toLowerCase();
        if (lower.startsWith("en")) return "en-US";
        if (lower.startsWith("es")) return "es-ES";
        return DEFAULT_LANGUAGE;
    }

    function storedLanguage() {
        try {
            return localStorage.getItem(STORAGE_KEY) || "";
        } catch (error) {
            console.warn("EducarIA i18n storage unavailable:", error);
            return "";
        }
    }

    function preferredLanguage() {
        return normalizeLanguage(storedLanguage() || navigator.language || DEFAULT_LANGUAGE);
    }

    function dictionaryPath(language) {
        return `${assetPrefix}/i18n/${language}.json`;
    }

    function translate(key) {
        return currentDictionary[key] || "";
    }

    function applyTextTranslations(root = document) {
        const titleKey = document.querySelector("title[data-i18n]")?.dataset?.i18n || "";
        const titleValue = titleKey ? translate(titleKey) : "";
        if (titleValue) {
            document.title = titleValue;
        }

        root.querySelectorAll("[data-i18n]").forEach((element) => {
            const value = translate(element.dataset.i18n);
            if (value) element.textContent = value;
        });

        root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
            const value = translate(element.dataset.i18nPlaceholder);
            if (value) element.setAttribute("placeholder", value);
        });

        root.querySelectorAll("[data-i18n-title]").forEach((element) => {
            const value = translate(element.dataset.i18nTitle);
            if (value) element.setAttribute("title", value);
        });

        root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
            const value = translate(element.dataset.i18nAriaLabel);
            if (value) element.setAttribute("aria-label", value);
        });
    }

    async function loadDictionary(language) {
        const response = await fetch(dictionaryPath(language), { cache: "no-cache" });
        if (!response.ok) throw new Error(`i18n_${language}_${response.status}`);
        return response.json();
    }

    async function setEducariaLanguage(language, options = {}) {
        const normalized = normalizeLanguage(language);
        try {
            currentDictionary = await loadDictionary(normalized);
        } catch (error) {
            currentDictionary = {};
            console.warn("EducarIA i18n unavailable:", error);
        }

        document.documentElement.lang = normalized;
        applyTextTranslations(document);

        if (options.persist !== false) {
            try {
                localStorage.setItem(STORAGE_KEY, normalized);
            } catch (error) {
                console.warn("EducarIA i18n storage unavailable:", error);
            }
        }

        document.dispatchEvent(new CustomEvent("educaria-language-changed", {
            detail: { language: normalized }
        }));
        return normalized;
    }

    window.getEducariaLanguage = function getEducariaLanguage() {
        return document.documentElement.lang || DEFAULT_LANGUAGE;
    };
    window.educariaTranslate = translate;
    window.setEducariaLanguage = setEducariaLanguage;
    window.applyEducariaTranslations = applyTextTranslations;

    document.addEventListener("DOMContentLoaded", () => {
        setEducariaLanguage(preferredLanguage(), { persist: false });
    });
})();
