// Política de economia da mesa dos jogadores, isolada para testes e ajustes.
(function (scope) {
    "use strict";

    function prefersEconomy(options = {}) {
        if (options.stored === "on") return true;
        if (options.stored === "off") return false;
        const connection = String(options.effectiveType || "").toLowerCase();
        return options.saveData === true || connection === "slow-2g" || connection === "2g"
            || options.narrow === true || options.coarse === true;
    }

    function refreshDelay(options = {}) {
        const failures = Math.max(0, Math.min(3, Number(options.failures) || 0));
        const base = options.channelReady ? 20000 : options.knownLive ? 7000 : 5000;
        return Math.min(40000, base * (2 ** failures));
    }

    function fallbackRequest(inviteCode, knownPublishedAt) {
        const payload = { inviteCode };
        if (typeof knownPublishedAt === "string" && knownPublishedAt) payload.knownPublishedAt = knownPublishedAt;
        return payload;
    }

    const api = Object.freeze({ prefersEconomy, refreshDelay, fallbackRequest });
    (scope.window || scope).REAL_TABLETOP_PERFORMANCE = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
