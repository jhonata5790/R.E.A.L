// Transmissão da visão publicada. O mapa completo continua somente no navegador do mestre.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const config = window.REAL_SUPABASE_CONFIG;
    const master = window.REAL_TABLETOP_MASTER;
    const status = $("onlineStatus");
    const authForm = $("onlineAuthForm");
    const controls = $("onlineMasterControls");
    const toggle = $("onlineToggle");
    const invite = $("onlineInvite");
    const copy = $("onlineCopy");
    const viewerCount = $("onlineViewerCount");
    const viewerList = $("onlineViewerList");
    const mobileViewerCount = $("mobileViewerCount");
    let client;
    let user = null;
    let room = null;
    let channel = null;
    let channelReady = false;
    let publishTimer = null;
    let publishing = false;
    let publishAgain = false;
    const peers = new Map();
    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

    function say(message) { status.textContent = message; }

    function inviteUrl(code) {
        const url = new URL("mesa-jogador.html", location.href);
        url.hash = new URLSearchParams({ convite: code }).toString();
        return url.href;
    }

    function showState() {
        authForm.hidden = !!user;
        controls.hidden = !user;
        if (!user) return;
        $("onlineMasterName").textContent = `Mestre: ${user.email || "conta conectada"}`;
        toggle.textContent = room?.is_live ? "Encerrar transmissão" : "Iniciar transmissão";
        invite.value = room ? inviteUrl(room.invite_code) : "";
        copy.disabled = !room?.is_live;
        showViewers();
    }

    function showViewers() {
        const names = room?.is_live && channel?.presenceState
            ? Object.values(channel.presenceState()).flat()
                .filter((entry) => entry?.role === "viewer" && typeof entry.name === "string")
                .map((entry) => entry.name.trim().slice(0, 32)).filter(Boolean)
            : [];
        viewerCount.textContent = `(${names.length})`;
        if (mobileViewerCount) mobileViewerCount.textContent = String(names.length);
        $("openViewerPeek")?.setAttribute("aria-label", `Mostrar espectadores, ${names.length} assistindo`);
        viewerList.replaceChildren();
        if (!names.length) {
            const empty = document.createElement("li");
            empty.textContent = "Ninguém está assistindo.";
            viewerList.appendChild(empty);
            return;
        }
        names.sort((a, b) => a.localeCompare(b, "pt-BR"));
        names.forEach((name) => {
            const item = document.createElement("li");
            item.textContent = name;
            viewerList.appendChild(item);
        });
    }

    function closePeers() {
        peers.forEach(({ connection }) => connection.close());
        peers.clear();
    }

    function stopLiveStream() {
        closePeers();
        master.stopPlayerStream?.();
    }

    async function signal(payload) {
        if (!channel) return;
        try { await channel.send({ type: "broadcast", event: "rtc", payload }); }
        catch { /* O convite continua funcionando por imagem se o sinal falhar. */ }
    }

    async function addRemoteCandidate(peer, candidate) {
        if (!candidate) return;
        if (!peer.connection.remoteDescription) {
            peer.pendingCandidates.push(candidate);
            return;
        }
        try { await peer.connection.addIceCandidate(candidate); }
        catch { /* Um candidato inválido não deve interromper a mesa. */ }
    }

    async function startPeer(viewerId) {
        if (!room?.is_live || !user || typeof RTCPeerConnection === "undefined") return;
        const existing = peers.get(viewerId);
        if (existing && !["failed", "closed"].includes(existing.connection.connectionState)
            && Date.now() - existing.createdAt < 10000) return;
        if (existing) existing.connection.close();
        await master.ready;
        let stream;
        try { stream = master.startPlayerStream?.(); }
        catch { return; }
        if (!stream) return;
        const connection = new RTCPeerConnection({ iceServers });
        const sessionId = crypto.randomUUID();
        const peer = { connection, sessionId, pendingCandidates: [], createdAt: Date.now() };
        peers.set(viewerId, peer);
        stream.getTracks().forEach((track) => connection.addTrack(track, stream));
        connection.onicecandidate = (event) => {
            if (event.candidate) signal({ kind: "candidate", viewerId, sessionId, candidate: event.candidate.toJSON() });
        };
        connection.onconnectionstatechange = () => {
            if (connection.connectionState === "failed" && peers.get(viewerId) === peer) {
                connection.close();
                peers.delete(viewerId);
            }
        };
        try {
            await connection.setLocalDescription(await connection.createOffer());
            await signal({ kind: "offer", viewerId, sessionId,
                description: { type: connection.localDescription.type, sdp: connection.localDescription.sdp } });
        } catch {
            connection.close();
            if (peers.get(viewerId) === peer) peers.delete(viewerId);
        }
    }

    async function handleSignal({ payload }) {
        if (!payload || typeof payload.viewerId !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.viewerId)) return;
        if (payload.kind === "join") { await startPeer(payload.viewerId); return; }
        const peer = peers.get(payload.viewerId);
        if (!peer || peer.sessionId !== payload.sessionId) return;
        try {
            if (payload.kind === "answer" && payload.description?.type === "answer") {
                await peer.connection.setRemoteDescription(payload.description);
                for (const candidate of peer.pendingCandidates.splice(0)) await addRemoteCandidate(peer, candidate);
            } else if (payload.kind === "candidate") await addRemoteCandidate(peer, payload.candidate);
        } catch { /* A conexão poderá ser refeita pelo próximo pedido do jogador. */ }
    }

    function attachChannel() {
        if (channel) client.removeChannel(channel);
        closePeers();
        channelReady = false;
        channel = room ? client.channel(`real-tabletop:${room.invite_code}`)
            .on("broadcast", { event: "rtc" }, handleSignal)
            .on("broadcast", { event: "document-request" }, ({ payload }) => {
                if (room?.is_live && /^[0-9a-f-]{36}$/i.test(payload?.viewerId || "")) {
                    window.REAL_TABLETOP_DOCUMENTS?.sendCurrent(payload.viewerId);
                }
            })
            .on("presence", { event: "sync" }, showViewers).subscribe((state) => {
                channelReady = state === "SUBSCRIBED";
            }) : null;
        showViewers();
    }

    window.REAL_TABLETOP_ONLINE = {
        isLive: () => !!user && !!room?.is_live,
        async sendDocument(payload) {
            if (!user || !room?.is_live || !channel || !channelReady) return false;
            try {
                const result = await channel.send({ type: "broadcast", event: "document", payload });
                return result === "ok" || result === undefined;
            } catch { return false; }
        }
    };

    async function loadRoom() {
        if (!user) return;
        const { data, error } = await client.from("tabletop_rooms")
            .select("id,invite_code,is_live,published_at")
            .eq("owner_id", user.id)
            .eq("campaign_key", master.campaignKey)
            .maybeSingle();
        if (error) throw error;
        room = data;
        attachChannel();
        if (room?.is_live) {
            try { master.startPlayerStream?.(); }
            catch { /* A publicação por imagem permanece disponível. */ }
        }
        showState();
        say(room?.is_live ? "Mesa ao vivo. Os jogadores veem apenas a área publicada." : "Mesa local pronta. Inicie a transmissão para criar um convite.");
    }

    async function setUser(nextUser) {
        clearTimeout(publishTimer);
        stopLiveStream();
        user = nextUser;
        room = null;
        if (channel) { client.removeChannel(channel); channel = null; }
        channelReady = false;
        showViewers();
        showState();
        if (!user) { say("Entre com a conta do mestre para compartilhar a mesa."); return; }
        say("Carregando sua sala…");
        try { await loadRoom(); }
        catch { say("Não foi possível abrir a sala online. Tente novamente."); }
    }

    async function sendChanged() {
        if (!channel) return;
        try { await channel.send({ type: "broadcast", event: "changed", payload: {} }); }
        catch { /* O jogador também consulta a sala periodicamente. */ }
    }

    async function publish() {
        if (!user) return;
        if (publishing) { publishAgain = true; return; }
        publishing = true;
        toggle.disabled = true;
        try {
            await master.ready;
            const frame = master.capturePlayerFrame();
            if (frame.length > 1000000) throw new Error("A imagem publicada ficou grande demais.");
            const changes = { published_frame: frame, is_live: true, published_at: new Date().toISOString() };
            let result;
            if (room) {
                result = await client.from("tabletop_rooms").update(changes)
                    .eq("id", room.id).select("id,invite_code,is_live,published_at").single();
            } else {
                result = await client.from("tabletop_rooms").insert({
                    ...changes, owner_id: user.id, campaign_key: master.campaignKey
                }).select("id,invite_code,is_live,published_at").single();
            }
            if (result.error) throw result.error;
            const previousCode = room?.invite_code;
            room = result.data;
            if (room.invite_code !== previousCode) attachChannel();
            try { master.startPlayerStream?.(); }
            catch { /* O quadro estático continua disponível como reserva. */ }
            showState();
            say(location.protocol === "file:"
                ? "Ao vivo. Este link local só funciona neste computador; abra o site publicado para convidar outras pessoas."
                : "Ao vivo. Compartilhe o convite com os jogadores.");
            await sendChanged();
        } catch (error) {
            say(error.message === "A imagem publicada ficou grande demais."
                ? error.message : "Não foi possível publicar a visão. A mesa local continua salva.");
        } finally {
            publishing = false;
            toggle.disabled = false;
            if (publishAgain && room?.is_live) {
                publishAgain = false;
                queuePublish();
            }
        }
    }

    function queuePublish() {
        if (!room?.is_live || !user) return;
        clearTimeout(publishTimer);
        publishTimer = setTimeout(publish, 2000);
    }

    async function stop() {
        if (!room || !user) return false;
        clearTimeout(publishTimer);
        toggle.disabled = true;
        try {
            const { data, error } = await client.from("tabletop_rooms")
                .update({ is_live: false, published_frame: null, published_at: new Date().toISOString() })
                .eq("id", room.id).select("id,invite_code,is_live,published_at").single();
            if (error) throw error;
            room = data;
            await signal({ kind: "ended" });
            stopLiveStream();
            window.dispatchEvent(new Event("real:tabletop-stopped"));
            showState();
            say("Transmissão encerrada. A mesa continua salva neste navegador.");
            await sendChanged();
            return true;
        } catch { say("Não foi possível encerrar a transmissão. Tente novamente."); return false; }
        finally { toggle.disabled = false; }
    }

    async function authenticate(createAccount) {
        if (!authForm.reportValidity()) return;
        const email = $("onlineEmail").value.trim();
        const password = $("onlinePassword").value;
        $("onlineSignIn").disabled = $("onlineSignUp").disabled = true;
        say(createAccount ? "Criando conta…" : "Entrando…");
        try {
            const { data, error } = createAccount
                ? await client.auth.signUp({ email, password })
                : await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            $("onlinePassword").value = "";
            if (!data.session) {
                say("Confira seu e-mail para confirmar a conta e depois entre aqui.");
            } else await setUser(data.user);
        } catch {
            say(createAccount ? "Não foi possível criar a conta. Confira o e-mail e a senha." : "Não foi possível entrar. Confira o e-mail e a senha.");
        } finally { $("onlineSignIn").disabled = $("onlineSignUp").disabled = false; }
    }

    if (!config || !window.supabase?.createClient || !master) {
        say("A conexão online não carregou. A mesa local continua disponível.");
        return;
    }
    client = window.supabase.createClient(config.url, config.publishableKey);
    authForm.addEventListener("submit", (event) => { event.preventDefault(); authenticate(false); });
    $("onlineSignUp").addEventListener("click", () => authenticate(true));
    $("onlineSignOut").addEventListener("click", async () => {
        if (room?.is_live && !await stop()) return;
        const { error } = await client.auth.signOut();
        if (error) { say("Não foi possível sair da conta."); return; }
        await setUser(null);
    });
    toggle.addEventListener("click", () => room?.is_live ? stop() : publish());
    copy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(invite.value);
            say(location.protocol === "file:"
                ? "Link local copiado. Para convidar outro computador, abra a mesa pelo site publicado e copie o link de lá."
                : "Convite copiado. Quem tiver esse link poderá assistir à área publicada.");
        } catch {
            invite.select();
            say("Selecione e copie o convite mostrado acima.");
        }
    });
    window.addEventListener("real:tabletop-changed", queuePublish);
    client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") setUser(null);
        else if (event === "SIGNED_IN" && session?.user?.id !== user?.id) {
            setTimeout(() => { if (session.user.id !== user?.id) setUser(session.user); }, 0);
        }
    });
    client.auth.getUser().then(({ data }) => setUser(data.user || null))
        .catch(() => setUser(null));
})();
