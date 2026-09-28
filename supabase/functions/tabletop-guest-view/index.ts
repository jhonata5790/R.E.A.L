// Convite sem conta: o UUID secreto autoriza SOMENTE a leitura da imagem publicada.
// Nunca devolva mapa, tokens, câmera do mestre ou a linha completa da tabela.
const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
    });
}

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Método inválido" }, 405);

    try {
        const publishableKeys: Record<string, string> = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
        if (!Object.values(publishableKeys).includes(request.headers.get("apikey") || "")) {
            return json({ error: "Convite inválido" }, 401);
        }
        const body = await request.text();
        if (body.length > 1000) return json({ error: "Convite inválido" }, 400);
        const inviteCode = JSON.parse(body).inviteCode;
        if (typeof inviteCode !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteCode)) {
            return json({ error: "Convite inválido" }, 400);
        }

        const secretKeys: Record<string, string> = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
        const secretKey = secretKeys.default;
        const projectUrl = Deno.env.get("SUPABASE_URL");
        if (!secretKey || !projectUrl) return json({ error: "Serviço indisponível" }, 503);

        const url = new URL("/rest/v1/tabletop_rooms", projectUrl);
        url.searchParams.set("select", "is_live,published_frame,published_at");
        url.searchParams.set("invite_code", `eq.${inviteCode}`);
        url.searchParams.set("limit", "1");
        const response = await fetch(url, { headers: { apikey: secretKey, Accept: "application/json" } });
        if (!response.ok) return json({ error: "Serviço indisponível" }, 503);
        const rooms = await response.json();
        if (!Array.isArray(rooms) || rooms.length === 0) return json({ error: "Convite não encontrado" }, 404);
        const room = rooms[0];
        return json({
            live: room.is_live === true,
            frame: room.is_live === true ? room.published_frame : null,
            publishedAt: room.published_at,
        });
    } catch {
        return json({ error: "Convite inválido" }, 400);
    }
});
