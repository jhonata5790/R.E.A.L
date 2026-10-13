// Custom authentication: publishable API key + secret UUID of an ACTIVE room.
// Permanent TURN secret and service credentials never leave the server.
const cors = {
    "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
};
const stun = { urls: "stun:stun.l.google.com:19302" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Método inválido" }, 405);
    try {
        const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
        if (!Object.values(keys).includes(request.headers.get("apikey") || "")) return json({ error: "Convite inválido" }, 401);
        const raw = await request.text();
        if (raw.length > 1000) return json({ error: "Convite inválido" }, 400);
        const { inviteCode } = JSON.parse(raw);
        if (typeof inviteCode !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteCode)) return json({ error: "Convite inválido" }, 400);
        const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default, project = Deno.env.get("SUPABASE_URL");
        if (!secret || !project) return json({ error: "Serviço indisponível" }, 503);
        const url = new URL("/rest/v1/tabletop_rooms", project);
        url.searchParams.set("select", "is_live"); url.searchParams.set("invite_code", `eq.${inviteCode}`); url.searchParams.set("limit", "1");
        const response = await fetch(url, { headers: { apikey: secret, Accept: "application/json" } });
        if (!response.ok) return json({ error: "Serviço indisponível" }, 503);
        const rooms = await response.json();
        if (!Array.isArray(rooms) || !rooms[0]?.is_live) return json({ error: "Transmissão indisponível" }, 404);
        const turnSecret = Deno.env.get("REAL_TURN_SHARED_SECRET");
        const urls = JSON.parse(Deno.env.get("REAL_TURN_URLS") || "[]");
        // Restrict to TURN protocols and bounded server URLs; reject embedded permanent credentials.
        const valid = Array.isArray(urls) && urls.length > 0 && urls.length <= 6 && urls.every((value) => typeof value === "string"
            && value.length <= 250 && /^turns?:[a-z0-9.-]+(?::\d{1,5})?(?:\?transport=(?:udp|tcp))?$/i.test(value));
        if (!turnSecret || !valid) return json({ iceServers: [stun], relayAvailable: false, expiresAt: Math.floor(Date.now() / 1000) + 300 });
        // Stable per-room/time-window credentials avoid issuing a new relay identity for every retry.
        const expiresAt = (Math.floor(Date.now() / 300000) + 3) * 300;
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inviteCode.toLowerCase())));
        const tag = Array.from(digest.slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
        const username = `${expiresAt}:real-${tag}`;
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(turnSecret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
        const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username)));
        const credential = btoa(String.fromCharCode(...signature));
        return json({ iceServers: [stun, { urls, username, credential }], relayAvailable: true, expiresAt });
    } catch { return json({ error: "Configuração indisponível" }, 503); }
});
