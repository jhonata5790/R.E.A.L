// A sala prepara e publica um quadro estático. O tabletop cuida do vídeo ao vivo.
(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);
    let tableId = null, room = null, channel = null, subscribed = false, generation = 0, busy = false;
    const account = () => window.REAL_ACCOUNT;
    const client = () => account()?.client();

    function say(message) { $("roomShareStatus").textContent = message; }
    function inviteUrl(code) {
        const url = new URL("mesa-jogador.html", location.href);
        url.hash = new URLSearchParams({ convite: code }).toString(); return url.href;
    }
    function viewers() {
        const names = room?.is_live && channel ? Object.values(channel.presenceState()).flat()
            .filter((entry) => entry?.role === "viewer" && typeof entry.name === "string")
            .map((entry) => entry.name.trim().slice(0, 32)).filter(Boolean) : [];
        $("roomViewerCount").textContent = String(names.length);
        $("roomViewerList").replaceChildren();
        for (const name of (names.length ? names.sort((a, b) => a.localeCompare(b, "pt-BR")) : ["Ninguém conectado."])) {
            const item = document.createElement("li"); item.textContent = name; $("roomViewerList").append(item);
        }
    }
    function render() {
        const signedIn = account()?.isSignedIn();
        $("roomLiveBadge").textContent = room?.is_live ? "Ao vivo" : "Offline";
        $("roomLiveBadge").classList.toggle("is-live", Boolean(room?.is_live));
        $("roomLiveToggle").textContent = !signedIn ? "Entrar para compartilhar" : room?.is_live ? "Encerrar transmissão" : "Iniciar transmissão";
        $("roomLiveToggle").disabled = busy;
        $("roomCopyInvite").disabled = !room?.is_live || busy;
        $("roomInvite").value = room?.is_live ? inviteUrl(room.invite_code) : "";
        viewers();
    }

    async function sendDocument(payload) {
        if (!room?.is_live || !channel || !subscribed) return false;
        const result = await channel.send({ type: "broadcast", event: "document", payload });
        return result === "ok" || result === undefined;
    }
    async function lateDocument(payload) {
        if (!room?.is_live || !/^[0-9a-f-]{36}$/i.test(payload?.viewerId || "")) return;
        const capturedId = tableId;
        const saved = await window.REAL_TABLE_WORKSPACE.readDocuments(capturedId);
        if (capturedId !== tableId) return;
        const item = saved.documents.find((doc) => doc.id === saved.revealedId);
        if (item) await sendDocument({ kind: "show", viewerId: payload.viewerId, document: {
            id: item.id, title: item.title, kind: item.kind, ...(item.kind === "image" ? { image: item.image } : { text: item.text })
        } });
    }
    function detach() {
        if (channel && client()) client().removeChannel(channel);
        channel = null; subscribed = false;
    }
    function attach() {
        if (channel?.topic === `realtime:real-tabletop:${room?.invite_code}`) return;
        detach();
        if (!room) return;
        const capturedId = tableId;
        const next = client().channel(`real-tabletop:${room.invite_code}`)
            .on("presence", { event: "sync" }, () => { if (capturedId === tableId) viewers(); })
            .on("broadcast", { event: "changed" }, () => refresh())
            .on("broadcast", { event: "document-request" }, ({ payload }) => { lateDocument(payload).catch(() => {}); })
            .on("broadcast", { event: "document" }, () => window.dispatchEvent(new CustomEvent("real:room-documents-refresh")))
            .subscribe((state) => { if (capturedId === tableId) subscribed = state === "SUBSCRIBED"; });
        channel = next;
    }

    async function refresh() {
        const captured = generation, capturedId = tableId;
        if (!capturedId) return;
        await account()?.ready;
        if (captured !== generation) return;
        const user = account()?.currentUser();
        if (!user || !client()) { room = null; detach(); render(); say("Entre na conta do mestre para compartilhar esta mesa."); return; }
        try {
            const { data, error } = await client().from("tabletop_rooms").select("id,invite_code,is_live,published_at")
                .eq("owner_id", user.id).eq("campaign_key", capturedId).maybeSingle();
            if (error) throw error;
            if (captured !== generation) return;
            const oldCode = room?.invite_code; room = data;
            if (!channel || oldCode !== room?.invite_code) attach();
            render(); say(room?.is_live ? "Mesa ao vivo. Envie o convite para o grupo." : "Tudo pronto. Inicie a transmissão para gerar o convite.");
        } catch { if (captured === generation) { render(); say("Não foi possível consultar a transmissão. Tente novamente."); } }
    }

    async function publishStatic() {
        const captured = generation, capturedId = tableId, user = account()?.currentUser();
        if (!capturedId || !user || !client()) throw new Error("Entre na conta do mestre primeiro.");
        const workspace = await window.REAL_TABLE_WORKSPACE.read(capturedId);
        const frame = await window.REAL_TABLE_WORKSPACE.renderSession(window.REAL_TABLE_WORKSPACE.active(workspace).session);
        if (captured !== generation) throw new Error("A sala aberta mudou. Tente novamente.");
        if (frame.length > 1000000) throw new Error("O quadro ficou grande demais. Use uma cena menor.");
        const changes = { is_live: true, transmission_paused: false, published_frame: frame, published_at: new Date().toISOString(), pointer_authority: null };
        const request = room ? client().from("tabletop_rooms").update(changes).eq("id", room.id).eq("owner_id", user.id)
            : client().from("tabletop_rooms").insert({ ...changes, owner_id: user.id, campaign_key: capturedId });
        const { data, error } = await request.select("id,invite_code,is_live,published_at").single();
        if (error) throw error;
        if (captured !== generation) return;
        const oldCode = room?.invite_code; room = data;
        if (oldCode !== room.invite_code || !channel) attach();
        await channel?.send({ type: "broadcast", event: "changed", payload: {} });
        render(); say("Cena publicada. Abra o tabletop para transmitir os movimentos.");
    }
    async function end() {
        if (!room?.is_live) return true;
        const user = account()?.currentUser(); if (!user) throw new Error("Entre na conta do mestre para encerrar.");
        const { data, error } = await client().from("tabletop_rooms")
            .update({ is_live: false, published_frame: null, published_at: new Date().toISOString(), pointer_authority: null })
            .eq("id", room.id).eq("owner_id", user.id).select("id,invite_code,is_live,published_at").single();
        if (error) throw error;
        room = data;
        await channel?.send({ type: "broadcast", event: "rtc", payload: { kind: "ended" } });
        await channel?.send({ type: "broadcast", event: "changed", payload: {} });
        try {
            const saved = await window.REAL_TABLE_WORKSPACE.readDocuments(tableId);
            saved.revealedId = null;
            await window.REAL_TABLE_WORKSPACE.writeDocuments(tableId, saved);
        } catch { /* O encerramento online já foi confirmado; os materiais privados permanecem intactos. */ }
        render(); say("Transmissão encerrada. Seus materiais continuam neste aparelho."); return true;
    }
    async function endTable(id) {
        await account()?.ready;
        const user = account()?.currentUser(); if (!user || !client()) return true;
        const { data: target, error } = await client().from("tabletop_rooms").select("id,invite_code,is_live")
            .eq("owner_id", user.id).eq("campaign_key", id).maybeSingle();
        if (error) throw error; if (!target?.is_live) return true;
        if (id === tableId) { room = target; return end(); }
        const result = await client().from("tabletop_rooms").update({ is_live: false, published_frame: null, published_at: new Date().toISOString(), pointer_authority: null }).eq("id", target.id).eq("owner_id", user.id);
        if (result.error) throw result.error;
        const signal = client().channel(`real-tabletop:${target.invite_code}`);
        try { await signal.send({ type: "broadcast", event: "changed", payload: {} }); }
        finally { client().removeChannel(signal); }
        return true;
    }

    $("roomLiveToggle").addEventListener("click", async () => {
        if (!account()?.isSignedIn()) { account()?.open(); return; }
        busy = true; render();
        try { if (room?.is_live) await end(); else await publishStatic(); }
        catch (error) { say(error.message || "Não foi possível alterar a transmissão."); }
        finally { busy = false; render(); }
    });
    $("roomCopyInvite").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText($("roomInvite").value); say("Convite copiado. Pode enviar para o grupo."); }
        catch { $("roomInvite").select(); say("Selecione e copie o convite."); }
    });
    window.addEventListener("focus", () => { if (tableId && !busy) refresh(); });
    window.addEventListener("real:account-changed", () => { if (tableId) refresh(); });
    window.REAL_ROOM_SHARING = {
        async setTable(id) { generation++; tableId = id; room = null; detach(); render(); if (id) await refresh(); },
        isLive: () => Boolean(room?.is_live), publishStatic, end, endTable, sendDocument, refresh
    };
})();
