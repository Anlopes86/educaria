(function initEducariaFirebaseConfig() {
    const STORAGE_KEY = "educaria:firebase:config";
    const RUNTIME_CONFIG_FILE = "firebase-config.local.js";
    // A configuração Web identifica o app Firebase no navegador; ela não concede
    // acesso aos dados. A autorização continua protegida por Auth e Security Rules.
    const DEFAULT_CONFIG = {
        apiKey: "AIzaSyBd-ZXX-yNNhIctaYufhWVNhwWk_fXBRL4",
        authDomain: "educaria-f46b2.firebaseapp.com",
        projectId: "educaria-f46b2",
        storageBucket: "educaria-f46b2.firebasestorage.app",
        messagingSenderId: "856146928482",
        appId: "1:856146928482:web:2d5a5aa8b868ef19b1c23b",
        measurementId: "G-MXLZ2HQKY2"
    };

    function readStoredConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            console.warn("EducarIA Firebase config storage unavailable:", error);
            return {};
        }
    }

    function sanitizeConfig(config) {
        if (!config || typeof config !== "object") return {};
        return Object.fromEntries(Object.entries(config).filter(([_, value]) => {
            if (typeof value !== "string") return false;
            const normalized = value.trim();
            if (!normalized) return false;
            return !normalized.startsWith("COLE_AQUI");
        }));
    }

    function buildConfig(nextConfig) {
        return {
            ...DEFAULT_CONFIG,
            ...sanitizeConfig(nextConfig)
        };
    }

    function mergeConfig(...configs) {
        return configs.reduce((accumulator, config) => {
            return {
                ...accumulator,
                ...sanitizeConfig(config)
            };
        }, { ...DEFAULT_CONFIG });
    }

    function runtimeConfigUrl() {
        const currentScript = document.currentScript;
        if (!currentScript?.src) return `assets/js/${RUNTIME_CONFIG_FILE}`;

        return currentScript.src.replace(/firebase-config\.js(?:\?.*)?$/, RUNTIME_CONFIG_FILE);
    }

    function isLocalDevelopment() {
        if (typeof window === "undefined") return false;
        const hostname = String(window.location.hostname || "").toLowerCase();
        return window.location.protocol === "file:"
            || hostname === "localhost"
            || hostname === "127.0.0.1"
            || hostname === "::1";
    }

    function readLocalDevelopmentConfig() {
        return isLocalDevelopment() ? readStoredConfig() : {};
    }

    function loadRuntimeConfigScript() {
        if (typeof document === "undefined" || !isLocalDevelopment()) return Promise.resolve();

        return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = runtimeConfigUrl();
            script.async = false;
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.head.appendChild(script);
        });
    }

    window.EDUCARIA_FIREBASE_CONFIG = mergeConfig(
        window.EDUCARIA_FIREBASE_CONFIG,
        readLocalDevelopmentConfig(),
        window.EDUCARIA_FIREBASE_CONFIG_OVERRIDE
    );

    window.setEducariaFirebaseConfig = function setEducariaFirebaseConfig(nextConfig, options = {}) {
        const persist = Boolean(options.persist);
        const config = buildConfig(nextConfig);
        window.EDUCARIA_FIREBASE_CONFIG = config;

        try {
            if (persist) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeConfig(nextConfig)));
            }
        } catch (error) {
            console.warn("EducarIA Firebase config storage unavailable:", error);
        }

        return window.EDUCARIA_FIREBASE_CONFIG;
    };

    window.resetEducariaFirebaseConfig = function resetEducariaFirebaseConfig() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn("EducarIA Firebase config storage unavailable:", error);
        }
        window.EDUCARIA_FIREBASE_CONFIG = { ...DEFAULT_CONFIG };
        return window.EDUCARIA_FIREBASE_CONFIG;
    };

    window.educariaFirebaseConfigReady = loadRuntimeConfigScript().then(() => {
        window.EDUCARIA_FIREBASE_CONFIG = mergeConfig(
            window.EDUCARIA_FIREBASE_CONFIG,
            readLocalDevelopmentConfig(),
            window.EDUCARIA_FIREBASE_CONFIG_OVERRIDE
        );
        return window.EDUCARIA_FIREBASE_CONFIG;
    });
})();
