(function initEducariaFirebaseConfig() {
    const STORAGE_KEY = "educaria:firebase:config";
    const RUNTIME_CONFIG_FILE = "firebase-config.local.js";
    const DEFAULT_CONFIG = {
        apiKey: "COLE_AQUI_API_KEY",
        authDomain: "COLE_AQUI_AUTH_DOMAIN",
        projectId: "COLE_AQUI_PROJECT_ID",
        storageBucket: "COLE_AQUI_STORAGE_BUCKET",
        messagingSenderId: "COLE_AQUI_MESSAGING_SENDER_ID",
        appId: "COLE_AQUI_APP_ID",
        measurementId: "COLE_AQUI_MEASUREMENT_ID"
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

    function loadRuntimeConfigScript() {
        if (typeof document === "undefined") return Promise.resolve();

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
        window.EDUCARIA_FIREBASE_CONFIG_OVERRIDE,
        readStoredConfig()
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
            window.EDUCARIA_FIREBASE_CONFIG_OVERRIDE,
            readStoredConfig()
        );
        return window.EDUCARIA_FIREBASE_CONFIG;
    });
})();
