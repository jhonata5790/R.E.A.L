// O jogador recebe somente uma imagem da área publicada, nunca o estado da mesa do mestre.
(function () {
    "use strict";

    const status = document.getElementById("guestStatus");
    const frame = document.getElementById("guestFrame");
    const waiting = document.getElementById("guestWaiting");
    const config = window.REAL_SUPABASE_CONFIG;
    const inviteCode = new URLSearchParams(location.hash.slice(1)).get("convite");
    const validCode = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteCode || "");
    let busy = false;
    let lastPublishedAt = null;

    function say(message) { status.textContent = message; }
    function showWaiting(message) {
        frame.hidden = true;
        frame.removeAttribute("src");
        waiting.hidden = false;
        if (message) say(message);
    }

    if (!validCode) { showWaiting("Convite ausente ou inválido."); return; }
    if (!config) { showWaiting("A conexão online não está configurada."); return; }

    async function refresh() {
        if (busy || document.visibilityState === "hidden") return;
        busy = true;
        try {
            const response = await fetch(`${config.url}/functions/v1/tabletop-guest-view`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: config.publishableKey },
                body: JSON.stringify({ inviteCode }),
                cache: "no-store"
            });
            if (response.status === 404) { showWaiting("Convite não encontrado. Peça um novo link ao mestre."); return; }
            if (!response.ok) throw new Error("Conexão indisponível");
            const view = await response.json();
            if (!view.live || !view.frame) {
                lastPublishedAt = null;
                showWaiting("Aguardando o mestre iniciar a transmissão…");
                return;
            }
            if (view.publishedAt !== lastPublishedAt) {
                frame.src = view.frame;
                lastPublishedAt = view.publishedAt;
            }
            frame.hidden = false;
            waiting.hidden = true;
            say("Mesa ao vivo · somente observação");
        } catch { say("Conexão interrompida. Tentando novamente…"); }
        finally { busy = false; }
    }

    if (window.supabase?.createClient) {
        const client = window.supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: false } });
        client.channel(`real-tabletop:${inviteCode}`)
            .on("broadcast", { event: "changed" }, refresh)
            .subscribe();
    }
    refresh();
    setInterval(refresh, 4000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });
})();
