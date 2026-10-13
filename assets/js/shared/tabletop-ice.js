// Credentials are short-lived and issued by the server, never stored in the site.
(function (scope) {
    "use strict";
    const fallback = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }], relayAvailable: false };
    let cached = null, pending = null;
    async function get(inviteCode) {
        if (cached?.code === inviteCode && cached.expiresAt > Date.now() + 60000) return cached.value;
        if (pending?.code === inviteCode) return pending.promise;
        const config = scope.REAL_SUPABASE_CONFIG;
        if (!config || typeof fetch === "undefined") return fallback;
        const promise = Promise.resolve().then(async () => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 7000);
            try {
                const response = await fetch(`${config.url}/functions/v1/tabletop-ice-config`, {
                    method: "POST", headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
                    body: JSON.stringify({ inviteCode }), cache: "no-store", signal: controller.signal
                });
                if (!response.ok) throw new Error("Configuração indisponível");
                const value = await response.json();
                if (!Array.isArray(value.iceServers) || !value.iceServers.length || value.iceServers.length > 8) throw new Error("Configuração inválida");
                cached = { code: inviteCode, value, expiresAt: Math.min(Date.now() + 600000, Number(value.expiresAt) * 1000 || Date.now() + 60000) };
                return value;
            } catch { return fallback; }
            finally { clearTimeout(timer); if (pending?.promise === promise) pending = null; }
        });
        pending = { code: inviteCode, promise }; return promise;
    }
    scope.REAL_TABLETOP_ICE = Object.freeze({ get });
})(window);
