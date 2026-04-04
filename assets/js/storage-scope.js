function educariaCurrentUserScope() {
    try {
        const raw = localStorage.getItem("educaria:auth:teacher-cache") || "";
        if (!raw) return "guest";
        const teacher = JSON.parse(raw);
        const source = String(teacher?.uid || teacher?.email || "guest").trim().toLowerCase();
        return source.replace(/[^a-z0-9_-]+/g, "-") || "guest";
    } catch (error) {
        return "guest";
    }
}

function educariaScopedKey(baseKey) {
    return `${baseKey}:${educariaCurrentUserScope()}`;
}
