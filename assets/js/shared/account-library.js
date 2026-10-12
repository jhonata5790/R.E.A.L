// Regras puras para sincronizar a biblioteca local com a conta.
(function (scope) {
    "use strict";

    const COLLECTIONS = ["campaigns", "characters", "homebrew"];

    function normalize(value) {
        const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
        return {
            ...source,
            campaigns: Array.isArray(source.campaigns) ? source.campaigns : [],
            characters: Array.isArray(source.characters) ? source.characters : [],
            homebrew: Array.isArray(source.homebrew) ? source.homebrew : []
        };
    }

    function clean(value) {
        const library = normalize(value);
        const result = { ...library };
        delete result._account;
        return result;
    }

    function mergeCollection(remote, local) {
        const records = new Map();
        for (const entry of [...remote, ...local]) {
            if (!entry || typeof entry !== "object") continue;
            const id = entry.id == null ? null : String(entry.id);
            if (id) records.set(id, entry);
        }
        return [...records.values()];
    }

    function merge(remoteValue, localValue) {
        const remote = normalize(remoteValue);
        const local = normalize(localValue);
        const result = { ...remote, ...local };
        for (const collection of COLLECTIONS) result[collection] = mergeCollection(remote[collection], local[collection]);
        delete result._account;
        return result;
    }

    function timestamp(value) {
        const parsed = Date.parse(value || "");
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function decision(localValue, remoteUpdatedAt, userId) {
        const local = normalize(localValue);
        const meta = local._account && typeof local._account === "object" ? local._account : {};
        const sameUser = Boolean(userId && meta.userId === userId);
        const syncedAt = timestamp(meta.lastSyncedAt);
        const localChanged = sameUser && timestamp(meta.localUpdatedAt) > syncedAt;
        const remoteChanged = !sameUser || timestamp(remoteUpdatedAt) > syncedAt;
        if (localChanged && remoteChanged) return "merge";
        if (localChanged) return "upload";
        if (remoteChanged) return "download";
        return "none";
    }

    const api = Object.freeze({ normalize, clean, merge, decision });
    (scope.window || scope).REAL_ACCOUNT_LIBRARY = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
