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
    const peerRequests = new Map();
    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    const rules = window.REAL_TABLETOP_PERFORMANCE;
    let diagnosticsTimer = null, diagnosticsBusy = false, pauseBusy = false, masterPointArmed = false;
    let operationQueue = Promise.resolve();
    const pointerController = window.REAL_POINTERS?.createMaster({ master,
        root: $("masterPointers"), hint: $("pointerMasterHint"), onChange: showViewers,
        refreshViewers: showViewers, onReady: queuePublish });

    function say(message) { status.textContent = message; }

    function inviteUrl(code) {
        const url = new URL("mesa-jogador.html", location.href);
        url.hash = new URLSearchParams({ convite: code }).toString();
        return url.href;
    }

    function showState() {
        window.dispatchEvent(new Event("real:online-state"));
        authForm.hidden = !!user;
        controls.hidden = !user;
        if ((!user || !room?.is_live) && pointerController?.authority()) pointerController.stop();
        if (!user) return;
        $("onlineMasterName").textContent = `Mestre: ${user.email || "conta conectada"}`;
        toggle.textContent = room?.is_live ? "Encerrar transmissão" : "Iniciar transmissão";
        invite.value = room ? inviteUrl(room.invite_code) : "";
        copy.disabled = !room?.is_live;
        const paused = Boolean(master.isTransmissionPaused?.());
        if (paused || !room?.is_live || !pointerController?.ready()) masterPointArmed = false;
        if ($("onlinePause")) { $("onlinePause").disabled = !room?.is_live || pauseBusy; $("onlinePause").textContent = paused ? "Retomar visão" : "Pausar visão"; }
        if ($("onlinePoint")) {
            $("onlinePoint").disabled = !room?.is_live || paused || !pointerController?.ready();
            $("onlinePoint").textContent = masterPointArmed ? "Cancelar apontador" : "◎ Apontar como mestre";
            $("onlinePoint").setAttribute("aria-pressed", String(masterPointArmed));
        }
        if ($("onlinePauseStatus")) $("onlinePauseStatus").textContent = paused
            ? "Visão congelada. Prepare a mesa e clique em Retomar visão para revelar o rascunho."
            : "Os jogadores recebem as mudanças. Pause antes de preparar algo em segredo.";
        showViewers();
    }

    function showViewers() {
        const viewers = room?.is_live && channel?.presenceState
            ? Object.values(channel.presenceState()).flat()
                .filter((entry) => entry?.role === "viewer" && typeof entry.name === "string")
            : [];
        pointerController?.present(viewers);
        const names = viewers.map((entry) => entry.name.trim().slice(0, 32)).filter(Boolean);
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
        const rows = viewers.filter((entry) => entry.name.trim()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        const presentIds = new Set(rows.map((entry) => entry.viewerId));
        for (const [id, peer] of peers) if (!presentIds.has(id)) { peer.connection.close(); peers.delete(id); }
        const seen = new Set();
        rows.forEach((entry) => {
            const name = entry.name.trim().slice(0, 32);
            if (entry.viewerId && seen.has(entry.viewerId)) return;
            if (entry.viewerId) seen.add(entry.viewerId);
            const item = document.createElement("li");
            item.textContent = name;
            const permission = pointerController?.permission(entry);
            if (permission) {
                item.textContent = ""; item.className = "viewer-pointer-permission";
                const label = document.createElement("span"); label.textContent = name;
                const control = document.createElement("label"), input = document.createElement("input");
                input.type = "checkbox"; input.checked = permission.allowed;
                input.disabled = !pointerController.ready();
                input.setAttribute("aria-label", "Permitir que " + name + " aponte no mapa");
                input.addEventListener("change", () => pointerController.setAllowed(entry, input.checked).catch(() => say("Não foi possível alterar a permissão do apontador.")));
                control.append(input, document.createTextNode("Permitir apontar")); item.append(label, control);
            }
            // Presence is a viewer's report, not proof of receiving decoded frames.
            if (entry.viewerId && item.append) {
                const detail = document.createElement("small"), peer = peers.get(entry.viewerId);
                const report = entry.transmission;
                const age = Date.now() - Number(report?.at || 0);
                const state = age >= 0 && age < 20000 ? report?.state : null;
                const labels = { video: "Vídeo recebido", economy: "Imagem econômica", image: "Imagem de reserva", reconnecting: "Reconectando", hidden: "Em segundo plano" };
                detail.className = "viewer-connection";
                const quality = rules?.profile(peer?.mode, peer?.adapt?.level)?.label;
                detail.textContent = `${labels[state] || (peer?.connection.connectionState === "connected" ? "Conexão de vídeo ativa" : "Aguardando diagnóstico")}${state === "video" && quality ? " · " + quality : ""}`;
                if (peer?.sample?.rtt != null) detail.textContent += ` · ${Math.round(peer.sample.rtt * 1000)} ms`;
                if (peer?.sample?.loss != null) detail.textContent += ` · perda ${Math.round(peer.sample.loss * 100)}%`;
                detail.title = "Recebimento informado pelo jogador; latência e perda medidas na conexão quando disponíveis.";
                item.append(detail);
            }
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

    async function tuneVideoSender(sender, mode = "balanced", level = 1) {
        if (!sender?.getParameters || !sender?.setParameters) return;
        try {
            const parameters = sender.getParameters();
            if (!parameters.encodings?.length) parameters.encodings = [{}];
            const profile = rules?.profile(mode, level) || { bitrate: 420000, fps: 8, scale: 1 };
            parameters.encodings[0].maxBitrate = profile.bitrate;
            parameters.encodings[0].maxFramerate = profile.fps;
            parameters.encodings[0].scaleResolutionDownBy = profile.scale;
            parameters.degradationPreference = "maintain-resolution";
            await sender.setParameters(parameters);
        } catch { /* Alguns navegadores escolhem os limites automaticamente. */ }
    }

    async function startPeer(viewerId, mode = "auto", force = false) {
        if (peerRequests.has(viewerId) || peers.size + peerRequests.size >= 64 && !peers.has(viewerId)) return;
        if (window.REAL_POINTERS && !Object.values(channel?.presenceState?.() || {}).flat().some((entry) => entry.viewerId === viewerId && entry.role === "viewer")) return;
        const request = startPeerNow(viewerId, mode, force); peerRequests.set(viewerId, request);
        try { await request; } finally { if (peerRequests.get(viewerId) === request) peerRequests.delete(viewerId); }
    }
    async function startPeerNow(viewerId, mode = "auto", force = false) {
        if (!room?.is_live || !user || typeof RTCPeerConnection === "undefined") return;
        const existing = peers.get(viewerId);
        if (!force && existing && !["failed", "closed"].includes(existing.connection.connectionState)
            && Date.now() - existing.createdAt < 10000) return;
        if (force && existing && Date.now() - existing.createdAt < 1200) return;
        if (existing) existing.connection.close();
        await master.ready;
        let stream;
        try { stream = master.startPlayerStream?.(); }
        catch { return; }
        if (!stream) return;
        if (!room?.is_live || !user) return;
        const code = room.invite_code, owner = user.id, signalingChannel = channel;
        const ice = await window.REAL_TABLETOP_ICE?.get(code);
        if (!room?.is_live || room.invite_code !== code || user?.id !== owner || channel !== signalingChannel) return;
        if ($("onlineRelayStatus")) $("onlineRelayStatus").textContent = ice?.relayAvailable
            ? "Conexão alternativa TURN disponível para redes restritas." : "TURN ainda não configurado. Vídeo direto e imagem de reserva disponíveis.";
        const connection = new RTCPeerConnection({ iceServers: ice?.iceServers || iceServers });
        const sessionId = crypto.randomUUID();
        const peer = { connection, sessionId, pendingCandidates: [], createdAt: Date.now(), mode: rules?.quality(mode) || mode, adapt: { level: 1, good: 0 } };
        peers.set(viewerId, peer);
        const senders = stream.getTracks().map((track) => connection.addTrack(track, stream));
        peer.senders = senders;
        await Promise.all(senders.map((sender) => tuneVideoSender(sender, peer.mode)));
        connection.onicecandidate = (event) => {
            if (event.candidate) signal({ kind: "candidate", viewerId, sessionId, candidate: event.candidate.toJSON() });
        };
        connection.onconnectionstatechange = () => {
            if (connection.connectionState === "failed" && peers.get(viewerId) === peer) {
                connection.close();
                peers.delete(viewerId);
            }
            showViewers();
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
        if (payload.kind === "join") { await startPeer(payload.viewerId, payload.quality || "auto", payload.force === true); return; }
        const peer = peers.get(payload.viewerId);
        if (!peer || peer.sessionId !== payload.sessionId) return;
        if (payload.kind === "leave") { peer.connection.close(); peers.delete(payload.viewerId); showViewers(); return; }
        try {
            if (payload.kind === "answer" && payload.description?.type === "answer") {
                await peer.connection.setRemoteDescription(payload.description);
                for (const candidate of peer.pendingCandidates.splice(0)) await addRemoteCandidate(peer, candidate);
            } else if (payload.kind === "candidate") await addRemoteCandidate(peer, payload.candidate);
        } catch { /* A conexão poderá ser refeita pelo próximo pedido do jogador. */ }
    }

    async function diagnose() {
        if (diagnosticsBusy || !room?.is_live) return;
        diagnosticsBusy = true;
        try {
            await Promise.all([...peers.values()].map(async (peer) => {
                if (!peer.connection.getStats || peer.connection.connectionState !== "connected") return;
                try {
                    const stats = await peer.connection.getStats(); let sample = {};
                    stats.forEach((report) => {
                        if (report.type === "remote-inbound-rtp" && (report.kind === "video" || report.mediaType === "video")) {
                            sample.rtt = report.roundTripTime;
                            const old = peer.counters?.[report.id];
                            const lost = old ? Math.max(0, report.packetsLost - old.lost) : 0;
                            const received = old ? Math.max(0, report.packetsReceived - old.received) : 0;
                            if (lost + received > 0) sample.loss = lost / (lost + received);
                            else if (Number.isFinite(report.fractionLost)) sample.loss = Math.max(0, Math.min(1, report.fractionLost));
                            (peer.counters ||= {})[report.id] = { lost: report.packetsLost, received: report.packetsReceived };
                        }
                        if (report.type === "outbound-rtp" && report.kind === "video") sample.limited = report.qualityLimitationReason;
                        if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated && sample.rtt == null) sample.rtt = report.currentRoundTripTime;
                    });
                    peer.sample = sample;
                    if (peer.mode === "auto" && rules?.adapt) {
                        const next = rules.adapt(peer.adapt, sample);
                        if (next.level !== peer.adapt.level) await Promise.all(peer.senders.map((sender) => tuneVideoSender(sender, peer.mode, next.level)));
                        peer.adapt = next;
                    }
                } catch { /* Stats can disappear while the viewer reconnects. */ }
            }));
            showViewers();
        } finally { diagnosticsBusy = false; }
    }

    function attachChannel() {
        pointerController?.stop();
        if (channel) client.removeChannel(channel);
        closePeers();
        channelReady = false;
        channel = room ? client.channel(`real-tabletop:${room.invite_code}`)
            .on("broadcast", { event: "changed" }, async () => {
                if (!user || !room) return;
                const id = room.id;
                const { data, error } = await client.from("tabletop_rooms").select("id,invite_code,is_live,published_at,pointer_authority,transmission_paused").eq("id", id).eq("owner_id", user.id).maybeSingle();
                if (error || !data || room?.id !== id) return;
                const ended = room.is_live && !data.is_live;
                room = data;
                master.setTransmissionPaused?.(data.transmission_paused === true);
                pointerController?.changed();
                pointerController?.reconcile(data.pointer_authority);
                if (ended) { stopLiveStream(); window.dispatchEvent(new Event("real:tabletop-stopped")); }
                showState();
            })
            .on("broadcast", { event: "rtc" }, handleSignal)
            .on("broadcast", { event: "pointer-request" }, ({ payload }) => pointerController?.receive(payload).catch(() => false))
            .on("broadcast", { event: "document-request" }, ({ payload }) => {
                if (room?.is_live && /^[0-9a-f-]{36}$/i.test(payload?.viewerId || "")) {
                    window.REAL_TABLETOP_DOCUMENTS?.sendCurrent(payload.viewerId);
                }
            })
            .on("presence", { event: "sync" }, showViewers).subscribe((state) => {
                channelReady = state === "SUBSCRIBED";
                pointerController?.setConnected(channelReady);
                showState();
            }) : null;
        showViewers();
        if (room?.is_live && user) pointerController?.start({ client, roomId: room.id, ownerId: user.id,
            connected: channelReady, send: async (event, payload) => {
                if (channel) return channel.send({ type: "broadcast", event, payload });
            } });
    }

    window.REAL_TABLETOP_ONLINE = {
        isLive: () => !!user && !!room?.is_live,
        isPaused: () => Boolean(master.isTransmissionPaused?.()),
        isPointing: () => masterPointArmed,
        togglePause,
        publish,
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
            .select("id,invite_code,is_live,published_at,pointer_authority,transmission_paused,published_frame")
            .eq("owner_id", user.id)
            .eq("campaign_key", master.campaignKey)
            .maybeSingle();
        if (error) throw error;
        room = data;
        await master.ready;
        master.setTransmissionPaused?.(room?.transmission_paused === true);
        if (room?.transmission_paused) await master.restorePublishedFrame?.(room.published_frame);
        attachChannel();
        if (room?.is_live) {
            try { master.startPlayerStream?.(); }
            catch { /* A publicação por imagem permanece disponível. */ }
        }
        showState();
        say(room?.is_live ? "Mesa ao vivo. Os jogadores veem apenas a área publicada." : "Mesa local pronta. Inicie a transmissão para criar um convite.");
    }

    async function setUser(nextUser) {
        pointerController?.stop();
        clearTimeout(publishTimer);
        stopLiveStream();
        user = nextUser;
        room = null;
        if (channel) { client.removeChannel(channel); channel = null; }
        channelReady = false;
        masterPointArmed = false;
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

    function publish() {
        operationQueue = operationQueue.catch(() => {}).then(publishNow); return operationQueue;
    }
    async function publishNow() {
        if (!user || master.isTransmissionPaused?.()) return;
        if (publishing) { publishAgain = true; return; }
        publishing = true;
        toggle.disabled = true;
        try {
            await master.ready;
            const pointerFrameContext = pointerController?.frameContext();
            const frame = master.capturePlayerFrame();
            if (frame.length > 1000000) throw new Error("A imagem publicada ficou grande demais.");
            const changes = { published_frame: frame, is_live: true, transmission_paused: false, published_at: new Date().toISOString() };
            let result;
            if (room) {
                result = await client.from("tabletop_rooms").update(changes)
                    .eq("id", room.id).eq("owner_id", user.id).select("id,invite_code,is_live,published_at,transmission_paused").single();
            } else {
                result = await client.from("tabletop_rooms").insert({
                    ...changes, owner_id: user.id, campaign_key: master.campaignKey
                }).select("id,invite_code,is_live,published_at,transmission_paused").single();
            }
            if (result.error) throw result.error;
            const previousCode = room?.invite_code;
            room = result.data;
            if (room.invite_code !== previousCode) attachChannel();
            pointerController?.published(pointerFrameContext, room.published_at);
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
        if (!room?.is_live || !user || master.isTransmissionPaused?.()) return;
        clearTimeout(publishTimer);
        publishTimer = setTimeout(publish, 2000);
    }

    function stop() {
        operationQueue = operationQueue.catch(() => {}).then(stopNow); return operationQueue;
    }
    async function stopNow() {
        if (!room || !user) return false;
        clearTimeout(publishTimer);
        toggle.disabled = true;
        try {
            const { data, error } = await client.from("tabletop_rooms")
                .update({ is_live: false, transmission_paused: false, published_frame: null, published_at: new Date().toISOString(), pointer_authority: null })
                .eq("id", room.id).select("id,invite_code,is_live,published_at").single();
            if (error) throw error;
            room = data;
            master.setTransmissionPaused?.(false); masterPointArmed = false;
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

    function togglePause() {
        if (pauseBusy || !room?.is_live || !user) return Promise.resolve();
        pauseBusy = true; masterPointArmed = false; clearTimeout(publishTimer);
        // Freeze immediately, before any network await: draft edits never leave this canvas.
        const wasPaused = Boolean(master.isTransmissionPaused?.());
        if (!wasPaused) { master.setTransmissionPaused?.(true); pointerController?.changed(); }
        showState();
        operationQueue = operationQueue.catch(() => {}).then(async () => {
            if (!room?.is_live || !user) return;
            try {
                if (wasPaused) {
                    // Persist the new static frame before letting the stream show the draft.
                    const frame = master.captureDraftFrame();
                    if (frame.length > 1000000) throw new Error("Quadro muito grande");
                    const stamp = new Date().toISOString();
                    const { data, error } = await client.from("tabletop_rooms").update({ transmission_paused: false,
                        published_frame: frame, published_at: stamp }).eq("id", room.id).eq("owner_id", user.id)
                        .select("id,invite_code,is_live,published_at,transmission_paused").single();
                    if (error) throw error;
                    room = data; master.setTransmissionPaused?.(false); pointerController?.changed();
                    pointerController?.published(pointerController.frameContext(), stamp);
                } else {
                    const { data, error } = await client.from("tabletop_rooms").update({ transmission_paused: true })
                        .eq("id", room.id).eq("owner_id", user.id).select("id,invite_code,is_live,published_at,transmission_paused").single();
                    if (error) throw error; room = data;
                }
                await sendChanged(); say(wasPaused ? "Visão retomada. Rascunho revelado ao grupo." : "Visão pausada. Prepare sua próxima cena em segredo.");
            } catch { say("Não foi possível confirmar a alteração. A visão permanece congelada; tente retomar novamente."); }
            finally { pauseBusy = false; showState(); }
        });
        return operationQueue;
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
    $("onlinePause")?.addEventListener("click", togglePause);
    $("onlinePoint")?.addEventListener("click", () => {
        if (!room?.is_live || master.isTransmissionPaused?.() || !pointerController?.ready()) return;
        masterPointArmed = !masterPointArmed;
        say(masterPointArmed ? "Clique dentro da área dos jogadores para apontar. Esc cancela. Tokens não serão movidos." : "Apontador cancelado."); showState();
    });
    $("gameCanvas")?.addEventListener("mousedown", (event) => {
        if (!masterPointArmed || event.button !== 0) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const point = master.pointInWorld?.(event.clientX, event.clientY);
        pointerController?.pointMaster(point?.x, point?.y).then((sent) => {
            if (sent) { masterPointArmed = false; say("Ponto enviado aos jogadores."); showState(); }
            else say("Escolha um ponto dentro da área publicada aos jogadores.");
        }).catch(() => say("Não foi possível enviar o ponto. Tente novamente."));
    }, true);
    window.addEventListener("keydown", (event) => { if (event.key === "Escape") { masterPointArmed = false; showState(); } });
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
    window.addEventListener("real:tabletop-changed", () => pointerController?.changed());
    window.addEventListener("real:tabletop-ui", () => pointerController?.changed());
    diagnosticsTimer = setInterval(diagnose, 5000);
    window.addEventListener("pagehide", () => { pointerController?.stop(); clearInterval(diagnosticsTimer); closePeers(); });
    window.addEventListener("real:scene-switched", () => { if (room?.is_live) publish(); });
    client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") setUser(null);
        else if (event === "SIGNED_IN" && session?.user?.id !== user?.id) {
            setTimeout(() => { if (session.user.id !== user?.id) setUser(session.user); }, 0);
        }
    });
    client.auth.getUser().then(({ data }) => setUser(data.user || null))
        .catch(() => setUser(null));
})();
