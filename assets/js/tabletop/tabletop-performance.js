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

    const MODES = ["auto", "economy", "balanced", "high"];
    const PROFILES = [
        { label: "Leve", bitrate: 180000, fps: 4, scale: 2 },
        { label: "Equilibrada", bitrate: 420000, fps: 8, scale: 1.5 },
        { label: "Alta", bitrate: 1000000, fps: 15, scale: 1 }
    ];
    function quality(value) { return MODES.includes(value) ? value : "auto"; }
    function profile(mode, level = 1) { return PROFILES[mode === "high" ? 2 : mode === "balanced" ? 1 : Math.max(0, Math.min(2, level))]; }
    function adapt(previous = {}, sample = {}) {
        const level = Math.max(0, Math.min(2, previous.level ?? 1));
        const valid = Number.isFinite(sample.loss) && Number.isFinite(sample.rtt);
        if (sample.limited === "bandwidth") return { level: Math.max(0, level - 1), good: 0 };
        if (!valid) return { ...previous, level, good: 0 };
        if (sample.loss > .06 || sample.rtt > .55 || sample.limited === "bandwidth") return { level: Math.max(0, level - 1), good: 0 };
        const good = sample.loss < .015 && sample.rtt < .2 ? (previous.good || 0) + 1 : 0;
        return good >= 4 ? { level: Math.min(2, level + 1), good: 0 } : { level, good };
    }
    function retryDelay(attempt = 0) { return Math.min(30000, 2000 * (2 ** Math.min(4, Math.max(0, attempt)))); }
    // getStats counters are cumulative; an unchanged scene is NOT a frozen video.
    function receiverHealth(previous, sample, paused = false) {
        if (!previous || sample.bytes < previous.bytes || sample.frames < previous.frames) return { stale: 0, frozen: false };
        const stale = sample.frames > previous.frames ? 0 : (previous.stale || 0) + Math.max(0, sample.at - previous.at);
        return { stale, frozen: !paused && stale > 16000 };
    }
    function viewport(state, width, height) {
        const scale = Math.max(1, Math.min(4, Number(state.scale) || 1));
        return { scale, x: Math.max(-width * (scale - 1) / 2, Math.min(width * (scale - 1) / 2, Number(state.x) || 0)),
            y: Math.max(-height * (scale - 1) / 2, Math.min(height * (scale - 1) / 2, Number(state.y) || 0)) };
    }
    const api = Object.freeze({ prefersEconomy, refreshDelay, fallbackRequest, quality, profile, adapt, retryDelay, receiverHealth, viewport });
    (scope.window || scope).REAL_TABLETOP_PERFORMANCE = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
