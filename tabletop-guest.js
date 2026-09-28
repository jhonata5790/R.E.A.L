// O jogador recebe somente a área publicada: vídeo WebRTC ou imagem de reserva.
(function () {
    "use strict";

    const status = document.getElementById("guestStatus");
    const frame = document.getElementById("guestFrame");
    const video = document.getElementById("guestVideo");
    const waiting = document.getElementById("guestWaiting");
    const config = window.REAL_SUPABASE_CONFIG;
    const inviteCode = new URLSearchParams(location.hash.slice(1)).get("convite");
    const validCode = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteCode || "");
    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    const viewerId = crypto.randomUUID();
    let busy = false;
    let lastPublishedAt = null;
    let knownLive = false;
    let videoReady = false;
    let channelReady = false;
    let channel = null;
    let peer = null;
    let pendingCandidates = [];
    let liveSince = 0;

    function say(message) { status.textContent = message; }

    function fallbackMessage() {
        return typeof RTCPeerConnection === "undefined" || Date.now() - liveSince > 15000
            ? "Visão por imagem · tentando conectar o vídeo ao vivo…"
            : "Mesa ativa · conectando vídeo ao vivo…";
    }

    function showFallback() {
        videoReady = false;
        video.hidden = true;
        frame.hidden = !knownLive || !frame.src;
        waiting.hidden = !frame.hidden;
        if (knownLive) say(fallbackMessage());
    }

    function closePeer() {
        const current = peer;
        peer = null;
        if (current) current.connection.close();
        video.srcObject = null;
        pendingCandidates = [];
        showFallback();
    }

    function showWaiting(message) {
        knownLive = false;
        liveSince = 0;
        closePeer();
        frame.hidden = true;
        frame.removeAttribute("src");
        waiting.hidden = false;
        if (message) say(message);
    }

    async function signal(payload) {
        if (!channelReady || !channel) return;
        try { await channel.send({ type: "broadcast", event: "rtc", payload }); }
        catch { /* A imagem de reserva segue disponível. */ }
    }

    function requestJoin() {
        if (knownLive && channelReady && !videoReady && typeof RTCPeerConnection !== "undefined") {
            signal({ kind: "join", viewerId });
        }
    }

    async function addCandidate(candidate) {
        if (!peer?.connection.remoteDescription) {
            pendingCandidates.push({ sessionId: peer?.sessionId, candidate });
            return;
        }
        try { await peer.connection.addIceCandidate(candidate); }
        catch { /* Ignora candidatos incompatíveis; a imagem permanece disponível. */ }
    }

    async function handleSignal({ payload }) {
        if (!payload || !knownLive) return;
        if (payload.kind === "ended") {
            showWaiting("Transmissão encerrada pelo mestre.");
            return;
        }
        if (payload.viewerId !== viewerId || typeof RTCPeerConnection === "undefined") return;
        if (payload.kind === "candidate" && payload.candidate) {
            if (peer?.sessionId === payload.sessionId) await addCandidate(payload.candidate);
            else pendingCandidates.push({ sessionId: payload.sessionId, candidate: payload.candidate });
            return;
        }
        if (payload.kind !== "offer" || payload.description?.type !== "offer"
            || !/^[0-9a-f-]{36}$/i.test(payload.sessionId || "")) return;
        if (peer?.sessionId === payload.sessionId) return;
        const earlyCandidates = pendingCandidates.filter((item) => item.sessionId === payload.sessionId);
        closePeer();
        const connection = new RTCPeerConnection({ iceServers });
        peer = { connection, sessionId: payload.sessionId };
        pendingCandidates = earlyCandidates;
        connection.onicecandidate = (event) => {
            if (event.candidate) signal({ kind: "candidate", viewerId, sessionId: payload.sessionId, candidate: event.candidate.toJSON() });
        };
        connection.ontrack = (event) => {
            video.srcObject = event.streams[0] || new MediaStream([event.track]);
            video.play().catch(() => showFallback());
        };
        connection.onconnectionstatechange = () => {
            if (peer?.connection !== connection) return;
            if (connection.connectionState === "failed" || connection.connectionState === "closed") {
                closePeer();
                requestJoin();
            } else if (connection.connectionState === "disconnected") {
                setTimeout(() => {
                    if (peer?.connection === connection && connection.connectionState === "disconnected") {
                        closePeer();
                        requestJoin();
                    }
                }, 4000);
            }
        };
        try {
            await connection.setRemoteDescription(payload.description);
            for (const item of pendingCandidates.splice(0)) await addCandidate(item.candidate);
            await connection.setLocalDescription(await connection.createAnswer());
            await signal({ kind: "answer", viewerId, sessionId: payload.sessionId,
                description: { type: connection.localDescription.type, sdp: connection.localDescription.sdp } });
        } catch {
            closePeer();
        }
    }

    video.addEventListener("playing", () => {
        videoReady = true;
        video.hidden = false;
        frame.hidden = true;
        waiting.hidden = true;
        say("Transmissão ao vivo · somente observação");
    });

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
            if (!knownLive) liveSince = Date.now();
            knownLive = true;
            if (view.publishedAt !== lastPublishedAt) {
                frame.src = view.frame;
                lastPublishedAt = view.publishedAt;
            }
            waiting.hidden = true;
            frame.hidden = videoReady;
            if (!videoReady) say(fallbackMessage());
            requestJoin();
        } catch { say("Conexão interrompida. Tentando novamente…"); }
        finally { busy = false; }
    }

    if (window.supabase?.createClient) {
        const client = window.supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: false } });
        channel = client.channel(`real-tabletop:${inviteCode}`)
            .on("broadcast", { event: "changed" }, refresh)
            .on("broadcast", { event: "rtc" }, handleSignal)
            .subscribe((state) => { channelReady = state === "SUBSCRIBED"; if (channelReady) requestJoin(); });
    }
    refresh();
    setInterval(refresh, 4000);
    setInterval(requestJoin, 5000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { refresh(); requestJoin(); } });
    window.addEventListener("pagehide", closePeer);
})();
