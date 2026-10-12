(function (root, factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (root) root.REAL_TABLE_PORTAL = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
    "use strict";

    const INVITE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function extractInvite(value, baseUrl = "https://real.local/") {
        const trimmed = String(value || "").trim();
        if (INVITE_PATTERN.test(trimmed)) return trimmed;
        try {
            const url = new URL(trimmed, baseUrl);
            const hashCode = new URLSearchParams(url.hash.slice(1)).get("convite");
            const queryCode = url.searchParams.get("convite");
            const code = hashCode || queryCode;
            return INVITE_PATTERN.test(code || "") ? code : null;
        } catch { return null; }
    }

    function tableHash(id) { return "#mesa/" + encodeURIComponent(id); }
    function tabletopUrl(id) { return "mesa.html?table=" + encodeURIComponent(id); }
    function guestUrl(code) { return "mesa-jogador.html#convite=" + encodeURIComponent(code); }

    return Object.freeze({ extractInvite, tableHash, tabletopUrl, guestUrl });
});
