// O jogador recebe somente a área publicada: vídeo WebRTC ou imagem de reserva.
(function () {
    "use strict";

    const status = document.getElementById("guestStatus");
    const frame = document.getElementById("guestFrame");
    const video = document.getElementById("guestVideo");
    const waiting = document.getElementById("guestWaiting");
    const economyButton = document.getElementById("guestEconomy");
    const qualitySelect = document.getElementById("guestQuality");
    const documentDialog = document.getElementById("guestDocument");
    const documentOpen = document.getElementById("guestDocumentOpen");
    const documentHandle = document.getElementById("guestDocumentHandle");
    const documentContent = document.getElementById("guestDocumentContent");
    const documentText = document.getElementById("guestDocumentText");
    const documentPages = document.getElementById("guestDocumentPages");
    const config = window.REAL_SUPABASE_CONFIG;
    const performanceRules = window.REAL_TABLETOP_PERFORMANCE || {
        prefersEconomy: () => true,
        refreshDelay: () => 10000,
        fallbackRequest: (code, knownPublishedAt) => ({ inviteCode: code, ...(knownPublishedAt ? { knownPublishedAt } : {}) })
    };
    const inviteCode = new URLSearchParams(location.hash.slice(1)).get("convite");
    const validCode = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inviteCode || "");
    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    const viewerId = crypto.randomUUID();
    let busy = false;
    let lastPublishedAt = null;
    let renderedFrameStamp = null;
    let knownLive = false;
    let videoReady = false;
    let channelReady = false;
    let channel = null;
    let presenceTracked = false;
    let peer = null;
    let pendingCandidates = [];
    let liveSince = 0;
    let documentRequested = false;
    let hasDocument = false;
    let draggingDocument = null;
    let documentPage = 0;
    let documentPageCount = 1;
    let refreshTimer = null;
    let joinTimer = null;
    let refreshFailures = 0;
    let lastJoinRequestAt = 0;
    let transmissionPaused = false, healthTimer = null, healthBusy = false, retryAttempt = 0;
    let lastHealth = null, expectedPixels = false, nextJoinAt = 0, lastPresenceAt = 0;
    let realtimeClient = null, presenceBusy = false, offerGeneration = 0;
    let qualityMode = performanceRules.quality?.((() => { try { return localStorage.getItem("real-tabletop-quality"); } catch { return null; } })()) || "auto";
    let economyMode = performanceRules.prefersEconomy({
        stored: (() => { try { return localStorage.getItem("real-tabletop-economy"); } catch { return null; } })(),
        saveData: typeof navigator !== "undefined" && navigator.connection?.saveData === true,
        effectiveType: typeof navigator !== "undefined" ? navigator.connection?.effectiveType : "",
        narrow: window.matchMedia?.("(max-width: 720px)")?.matches === true,
        coarse: window.matchMedia?.("(pointer: coarse)")?.matches === true
    });
    const automaticEconomy = () => performanceRules.prefersEconomy({ saveData: navigator.connection?.saveData,
        effectiveType: navigator.connection?.effectiveType, narrow: window.matchMedia?.("(max-width: 720px)")?.matches,
        coarse: window.matchMedia?.("(pointer: coarse)")?.matches });
    if (qualitySelect) economyMode = qualityMode === "economy" || qualityMode === "auto" && automaticEconomy();
    const pointerController = window.REAL_POINTERS?.createGuest({ viewerId,
        button: document.getElementById("guestPointerButton"), status: document.getElementById("guestPointerStatus"),
        root: document.getElementById("guestPointers"), stage: document.querySelector(".guest-tabletop__stage"),
        source: () => videoReady ? video : frame.hidden || !renderedFrameStamp ? null : frame,
        send: async (event, payload) => {
            if (knownLive && channelReady && channel) return channel.send({ type: "broadcast", event, payload });
        } });
    function updatePointerDisplay() {
        pointerController?.setDisplay({ live: knownLive, ready: channelReady && document.visibilityState !== "hidden",
            video: videoReady, stamp: renderedFrameStamp, paused: transmissionPaused });
    }
    window.REAL_GUEST_VIEW = { pointing: () => pointerController?.isArmed() === true,
        cancelGesture: () => pointerController?.cancelGesture(), reflow: () => pointerController?.reflow() };
    frame.addEventListener?.("load", () => { renderedFrameStamp = lastPublishedAt; updatePointerDisplay(); });

    function paginateDocument() {
        if (!hasDocument || documentText.hidden) { documentPages.hidden = true; return; }
        documentPages.hidden = true;
        const measure = () => {
            const width = documentContent.clientWidth;
            const height = documentContent.clientHeight;
            if (!width || !height) return 1;
            documentText.style.width = `${width}px`;
            documentText.style.height = `${height}px`;
            documentText.style.columnWidth = `${width}px`;
            documentText.style.transform = "none";
            return Math.max(1, Math.ceil((documentText.scrollWidth - 1) / width));
        };
        documentPageCount = measure();
        if (documentPageCount > 1) {
            documentPages.hidden = false;
            documentPageCount = measure();
        }
        documentPage = Math.min(documentPage, documentPageCount - 1);
        documentText.style.transform = `translateX(-${documentPage * documentContent.clientWidth}px)`;
        document.getElementById("guestDocumentPageStatus").textContent = `${documentPage + 1} / ${documentPageCount}`;
        document.getElementById("guestDocumentPrevious").disabled = documentPage === 0;
        document.getElementById("guestDocumentNext").disabled = documentPage === documentPageCount - 1;
    }

    function showDocumentPage(nextPage) {
        documentPage = Math.max(0, Math.min(nextPage, documentPageCount - 1));
        paginateDocument();
    }

    function moveDocument(left, top) {
        const rect = documentDialog.getBoundingClientRect();
        const maxLeft = Math.max(0, window.innerWidth - rect.width - 12);
        const maxTop = Math.max(0, window.innerHeight - rect.height - 12);
        documentDialog.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
        documentDialog.style.top = `${Math.max(0, Math.min(top, maxTop))}px`;
        documentDialog.style.right = "auto";
        documentDialog.style.bottom = "auto";
    }

    function keepDocumentVisible() {
        if (!documentDialog.open) return;
        const rect = documentDialog.getBoundingClientRect();
        if (rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
            moveDocument(rect.left, rect.top);
        }
        paginateDocument();
    }

    function resizeDocument(start, dx, dy) {
        const margin = 12;
        const minWidth = Math.min(280, window.innerWidth - margin * 2);
        const minHeight = Math.min(240, window.innerHeight - margin * 2);
        const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
        let { left, right, top, bottom } = start.rect;
        if (start.edge.includes("w")) left = clamp(left + dx, margin, right - minWidth);
        if (start.edge.includes("e")) right = clamp(right + dx, left + minWidth, window.innerWidth - margin);
        if (start.edge.includes("n")) top = clamp(top + dy, margin, bottom - minHeight);
        if (start.edge.includes("s")) bottom = clamp(bottom + dy, top + minHeight, window.innerHeight - margin);
        documentDialog.style.left = `${left}px`;
        documentDialog.style.top = `${top}px`;
        documentDialog.style.width = `${right - left}px`;
        documentDialog.style.height = `${bottom - top}px`;
        documentDialog.style.right = "auto";
        documentDialog.style.bottom = "auto";
        paginateDocument();
    }

    function openDocumentWindow() {
        if (!hasDocument) return;
        if (!documentDialog.open) documentDialog.show();
        documentOpen.hidden = true;
        keepDocumentVisible();
    }

    function closeDocumentWindow() {
        if (documentDialog.open) documentDialog.close();
        documentOpen.hidden = !hasDocument;
    }

    documentHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest?.("button")) return;
        const rect = documentDialog.getBoundingClientRect();
        draggingDocument = { id: event.pointerId, x: event.clientX, y: event.clientY,
            left: rect.left, top: rect.top };
        documentHandle.setPointerCapture(event.pointerId);
    });
    documentHandle.addEventListener("pointermove", (event) => {
        if (!draggingDocument || event.pointerId !== draggingDocument.id) return;
        moveDocument(draggingDocument.left + event.clientX - draggingDocument.x,
            draggingDocument.top + event.clientY - draggingDocument.y);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
        documentHandle.addEventListener(name, () => { draggingDocument = null; });
    }
    documentHandle.addEventListener("keydown", (event) => {
        if (event.target !== documentHandle || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const rect = documentDialog.getBoundingClientRect();
        const step = event.shiftKey ? 60 : 20;
        moveDocument(rect.left + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
            rect.top + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0));
    });
    document.querySelectorAll("[data-document-resize]").forEach((handle) => {
        let resizing = null;
        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            const rect = documentDialog.getBoundingClientRect();
            resizing = { id: event.pointerId, x: event.clientX, y: event.clientY,
                edge: handle.dataset.documentResize,
                rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } };
            handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        handle.addEventListener("pointermove", (event) => {
            if (!resizing || event.pointerId !== resizing.id) return;
            resizeDocument(resizing, event.clientX - resizing.x, event.clientY - resizing.y);
        });
        for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
            handle.addEventListener(name, () => { resizing = null; });
        }
        handle.addEventListener("keydown", (event) => {
            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const rect = documentDialog.getBoundingClientRect();
            const step = event.shiftKey ? 60 : 20;
            resizeDocument({ edge: handle.dataset.documentResize,
                rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } },
            event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0,
            event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0);
        });
    });
    document.getElementById("guestDocumentPrevious").addEventListener("click", () => showDocumentPage(documentPage - 1));
    document.getElementById("guestDocumentNext").addEventListener("click", () => showDocumentPage(documentPage + 1));
    documentOpen.addEventListener("click", openDocumentWindow);
    document.getElementById("guestDocumentClose").addEventListener("click", closeDocumentWindow);
    documentDialog.addEventListener("close", () => { documentOpen.hidden = !hasDocument; });
    window.addEventListener("resize", keepDocumentVisible);

    function clearDocument() {
        hasDocument = false;
        documentPage = 0;
        documentPages.hidden = true;
        closeDocumentWindow();
        documentOpen.hidden = true;
        document.getElementById("guestDocumentTitle").textContent = "";
        document.getElementById("guestDocumentText").textContent = "";
        document.getElementById("guestDocumentText").hidden = true;
        const image = document.getElementById("guestDocumentImage");
        image.hidden = true;
        image.removeAttribute("src");
    }

    function handleDocument({ payload }) {
        if (!knownLive || !payload || typeof payload !== "object") return;
        if (payload.viewerId && payload.viewerId !== viewerId) return;
        if (payload.kind === "hide") { clearDocument(); return; }
        const item = payload.document;
        if (payload.kind !== "show" || !item || typeof item.title !== "string"
            || item.title.length > 80 || !item.title.trim()) return;
        if (item.kind === "text" && (typeof item.text !== "string" || item.text.length > 12000)) return;
        if (item.kind === "image" && (typeof item.image !== "string"
            || item.image.length > 180000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(item.image))) return;
        if (item.kind !== "text" && item.kind !== "image") return;
        document.getElementById("guestDocumentTitle").textContent = item.title;
        const text = document.getElementById("guestDocumentText");
        const image = document.getElementById("guestDocumentImage");
        text.hidden = item.kind !== "text";
        image.hidden = item.kind !== "image";
        text.textContent = item.kind === "text" ? item.text : "";
        if (item.kind === "image") { image.src = item.image; image.alt = item.title; }
        else image.removeAttribute("src");
        hasDocument = true;
        documentPage = 0;
        openDocumentWindow();
    }

    function requestDocument() {
        if (!knownLive || !channelReady || !channel || documentRequested) return;
        documentRequested = true;
        channel.send({ type: "broadcast", event: "document-request", payload: { viewerId } })
            .then((result) => { if (result && result !== "ok") documentRequested = false; })
            .catch(() => { documentRequested = false; });
    }

    function say(message) { status.textContent = transmissionPaused && knownLive ? "Visão pausada · o mestre está preparando a próxima cena" : message; }

    function fallbackMessage() {
        if (economyMode) return "Modo econômico · a imagem atualiza quando a mesa mudar";
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
        updatePointerDisplay();
    }

    function closePeer() {
        offerGeneration++;
        const current = peer;
        peer = null;
        if (current && knownLive) signal({ kind: "leave", viewerId, sessionId: current.sessionId });
        if (current) current.connection.close();
        video.srcObject = null;
        lastHealth = null; expectedPixels = false;
        pendingCandidates = [];
        showFallback();
    }

    function showEconomyMode() {
        if (qualitySelect) qualitySelect.value = qualityMode;
        economyButton.setAttribute("aria-pressed", String(economyMode));
        economyButton.querySelector("strong").textContent = economyMode ? "Economia ativa" : "Vídeo ao vivo";
        economyButton.querySelector("small").textContent = economyMode ? "Poupa dados e bateria" : "Mais movimento";
    }

    function setEconomyMode(enabled) {
        qualityMode = enabled ? "economy" : "balanced";
        economyMode = Boolean(enabled);
        try { localStorage.setItem("real-tabletop-economy", economyMode ? "on" : "off"); }
        catch { /* A preferência vale somente nesta visita. */ }
        try { localStorage.setItem("real-tabletop-quality", qualityMode); } catch { /* session only */ }
        showEconomyMode();
        if (economyMode) closePeer();
        else requestJoin(true);
        scheduleJoin();
        updatePresence(true);
    }
    function setQuality(mode) {
        qualityMode = performanceRules.quality?.(mode) || "auto";
        economyMode = qualityMode === "economy" || qualityMode === "auto" && automaticEconomy();
        try { localStorage.setItem("real-tabletop-quality", qualityMode); } catch { /* session only */ }
        preserveLastFrame();
        closePeer(); retryAttempt = 0; nextJoinAt = 0;
        showEconomyMode(); requestJoin(true); scheduleJoin(); updatePresence(true);
    }

    function showWaiting(message) {
        knownLive = false;
        transmissionPaused = false; retryAttempt = 0; nextJoinAt = 0;
        documentRequested = false;
        clearDocument();
        if (presenceTracked && channel) { presenceTracked = false; channel.untrack().catch(() => {}); }
        liveSince = 0;
        closePeer();
        frame.hidden = true;
        frame.removeAttribute("src");
        waiting.hidden = false;
        if (message) say(message);
        pointerController?.setAuthority(null);
        updatePointerDisplay();
    }

    async function signal(payload) {
        if (!channelReady || !channel) return;
        try { await channel.send({ type: "broadcast", event: "rtc", payload }); }
        catch { /* A imagem de reserva segue disponível. */ }
    }

    function requestJoin(force = false) {
        if (economyMode || document.visibilityState === "hidden" || peer) return;
        const now = Date.now();
        if (!force && (now < nextJoinAt || now - lastJoinRequestAt < 2000)) return;
        if (knownLive && channelReady && !videoReady && typeof RTCPeerConnection !== "undefined") {
            lastJoinRequestAt = now;
            nextJoinAt = now + (performanceRules.retryDelay?.(retryAttempt++) || 8000);
            signal({ kind: "join", viewerId, quality: qualityMode, force });
        }
    }

    function scheduleJoin() {
        clearTimeout(joinTimer);
        if (economyMode || document.visibilityState === "hidden") return;
        joinTimer = setTimeout(() => {
            requestJoin();
            scheduleJoin();
        }, 2000);
    }

    async function updatePresence(force = false) {
        if (!knownLive || !channelReady || !channel || presenceBusy || (presenceTracked && !force)) return;
        const name = window.REAL_VISITOR_NAME?.getName();
        if (!name) return;
        presenceTracked = true;
        presenceBusy = true;
        try {
            const pointerKey = await pointerController?.identityReady;
            if (!knownLive || !channelReady || (document.visibilityState === "hidden" && !pointerController)) { presenceTracked = false; return; }
            const transmission = { state: document.visibilityState === "hidden" ? "hidden" : economyMode ? "economy" : videoReady ? "video" : peer ? "reconnecting" : "image",
                quality: qualityMode, at: Date.now(), paused: transmissionPaused };
            if (pointerKey) await channel.track({ role: "viewer", name, viewerId, pointerKey, transmission });
            else await channel.track({ role: "viewer", name });
            lastPresenceAt = Date.now();
            if (!knownLive) { presenceTracked = false; await channel.untrack(); }
        } catch { presenceTracked = false; }
        finally { presenceBusy = false; }
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
        if (economyMode || document.visibilityState === "hidden") return;
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
        const generation = offerGeneration;
        const ice = await window.REAL_TABLETOP_ICE?.get(inviteCode);
        if (generation !== offerGeneration || !knownLive || economyMode || document.visibilityState === "hidden") return;
        const connection = new RTCPeerConnection({ iceServers: ice?.iceServers || iceServers });
        peer = { connection, sessionId: payload.sessionId, createdAt: Date.now() };
        pendingCandidates = earlyCandidates;
        connection.onicecandidate = (event) => {
            if (event.candidate) signal({ kind: "candidate", viewerId, sessionId: payload.sessionId, candidate: event.candidate.toJSON() });
        };
        connection.ontrack = (event) => {
            if (peer?.connection !== connection) return;
            video.srcObject = event.streams[0] || new MediaStream([event.track]);
            video.play().catch(() => showFallback());
        };
        connection.onconnectionstatechange = () => {
            if (peer?.connection !== connection) return;
            if (connection.connectionState === "failed" || connection.connectionState === "closed") {
                preserveLastFrame(); closePeer();
                requestJoin();
            } else if (connection.connectionState === "disconnected") {
                setTimeout(() => {
                    if (peer?.connection === connection && connection.connectionState === "disconnected") {
                        preserveLastFrame(); closePeer();
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
            if (peer?.connection === connection) closePeer();
        }
    }

    function preserveLastFrame() {
        if (!videoReady || !(video.videoWidth > 0) || !document.createElement) return;
        try {
            const snapshot = document.createElement("canvas"); snapshot.width = 720; snapshot.height = 405;
            snapshot.getContext("2d").drawImage(video, 0, 0, 720, 405);
            // A freeze is a visual reserve, not authority to point in a potentially old scene.
            renderedFrameStamp = null; frame.src = snapshot.toDataURL("image/jpeg", .65);
        } catch { /* Existing published image remains available. */ }
    }
    function recover() {
        preserveLastFrame();
        closePeer(); requestJoin(); updatePresence(true);
    }
    async function checkHealth() {
        if (document.visibilityState === "hidden" || !knownLive || healthBusy) return;
        if (Date.now() - lastPresenceAt > 10000) updatePresence(true);
        const current = peer;
        if (!current) return;
        if (!videoReady && Date.now() - current.createdAt > 15000) { recover(); return; }
        if (!current.connection.getStats || !videoReady) return;
        healthBusy = true;
        try {
            const stats = await current.connection.getStats();
            if (peer !== current) return;
            stats.forEach((report) => {
                if (report.type !== "inbound-rtp" || (report.kind || report.mediaType) !== "video"
                    || !Number.isFinite(report.framesDecoded)) return;
                const sample = { bytes: report.bytesReceived || 0, frames: report.framesDecoded, at: Date.now() };
                const health = performanceRules.receiverHealth?.(lastHealth, sample, transmissionPaused) || { stale: 0 };
                if (lastHealth && sample.frames > lastHealth.frames) { expectedPixels = false; retryAttempt = 0; }
                // Demand-rendered static scenes can legitimately produce no new decoded frames.
                if (health.frozen && expectedPixels) recover();
                else lastHealth = { ...sample, stale: health.stale };
            });
        } catch { /* Some browsers cannot inspect video counters. ICE state still reconnects. */ }
        finally { healthBusy = false; }
    }

    video.addEventListener("playing", () => {
        if (economyMode || document.visibilityState === "hidden") { closePeer(); return; }
        videoReady = true;
        retryAttempt = 0; nextJoinAt = 0;
        video.hidden = false;
        frame.hidden = true;
        waiting.hidden = true;
        say("Transmissão ao vivo · somente observação");
        updatePointerDisplay();
        updatePresence(true);
    });

    if (!validCode) { showWaiting("Convite ausente ou inválido."); return; }
    if (!config) { showWaiting("A conexão online não está configurada."); return; }

    function scheduleRefresh(delay) {
        clearTimeout(refreshTimer);
        if (document.visibilityState === "hidden") return;
        refreshTimer = setTimeout(refresh, delay ?? performanceRules.refreshDelay({
            channelReady, knownLive, failures: refreshFailures
        }));
    }

    async function refresh() {
        if (busy) { scheduleRefresh(700); return; }
        if (document.visibilityState === "hidden"
            || (window.REAL_VISITOR_NAME && !window.REAL_VISITOR_NAME.getName())) return;
        busy = true;
        try {
            const response = await fetch(`${config.url}/functions/v1/tabletop-guest-view`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: config.publishableKey },
                body: JSON.stringify(performanceRules.fallbackRequest(inviteCode, lastPublishedAt)),
                cache: "no-store"
            });
            if (response.status === 404) { showWaiting("Convite não encontrado. Peça um novo link ao mestre."); return; }
            if (!response.ok) throw new Error("Conexão indisponível");
            const view = await response.json();
            refreshFailures = 0;
            if (!view.live) {
                lastPublishedAt = null;
        renderedFrameStamp = null;
                showWaiting("Aguardando o mestre iniciar a transmissão…");
                return;
            }
            if (!knownLive) liveSince = Date.now();
            knownLive = true;
            transmissionPaused = view.paused === true;
            if (!view.unchanged && typeof view.frame === "string" && view.frame) {
                if (lastPublishedAt && lastPublishedAt !== view.publishedAt) expectedPixels = true;
                renderedFrameStamp = null;
                lastPublishedAt = view.publishedAt;
                frame.src = view.frame;
            }
            waiting.hidden = Boolean(frame.src);
            frame.hidden = videoReady || !frame.src;
            if (!videoReady) say(fallbackMessage());
            updatePointerDisplay();
            await updatePresence();
            await pointerController?.setAuthority(view.pointerAuthority || null);
            pointerController?.hello().catch(() => {});
            requestJoin();
            requestDocument();
        } catch {
            refreshFailures = Math.min(3, refreshFailures + 1);
            say("Conexão interrompida. Tentando novamente…");
        } finally {
            busy = false;
            scheduleRefresh();
        }
    }

    function attachGuestChannel() {
        if (!realtimeClient) return;
        if (channel) realtimeClient.removeChannel(channel);
        channelReady = false; presenceTracked = false;
        channel = realtimeClient.channel(`real-tabletop:${inviteCode}`)
            .on("broadcast", { event: "changed" }, () => refresh())
            .on("broadcast", { event: "rtc" }, handleSignal)
            .on("broadcast", { event: "pointer-state" }, ({ payload }) => pointerController?.receive(payload).catch(() => false))
            .on("broadcast", { event: "document" }, handleDocument)
            .subscribe((state) => {
                channelReady = state === "SUBSCRIBED";
                updatePointerDisplay();
                if (!channelReady) { presenceTracked = false; documentRequested = false; }
                if (channelReady) {
                    requestJoin(); updatePresence().then(() => pointerController?.hello()).catch(() => {});
                    requestDocument(); scheduleRefresh();
                }
            });
    }
    if (window.supabase?.createClient) {
        realtimeClient = window.supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: false } });
        attachGuestChannel();
    }
    qualitySelect?.addEventListener("change", () => setQuality(qualitySelect.value));
    document.getElementById("guestReconnect")?.addEventListener("click", () => {
        retryAttempt = 0; nextJoinAt = 0; lastJoinRequestAt = 0;
        preserveLastFrame(); closePeer();
        if (!channelReady) attachGuestChannel();
        refresh(); requestJoin(true); say("Reconectando · sua última imagem continua disponível…");
    });
    if (typeof navigator !== "undefined") navigator.connection?.addEventListener?.("change", () => { if (qualityMode === "auto") setQuality("auto"); });
    healthTimer = setInterval(checkHealth, 3000);
    economyButton.addEventListener("click", () => setEconomyMode(!economyMode));
    showEconomyMode();
    window.REAL_VISITOR_NAME?.ready.then(() => { refresh(); updatePresence(); });
    window.addEventListener("real:visitor-name-changed", () => { refresh(); updatePresence(true); });
    refresh();
    scheduleJoin();
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            updatePointerDisplay();
            clearTimeout(refreshTimer);
            clearTimeout(joinTimer);
            if (!pointerController && presenceTracked && channel) { presenceTracked = false; channel.untrack().catch(() => {}); }
            closePeer();
            if (pointerController) updatePresence(true);
            return;
        }
        refresh();
        pointerController?.hello().catch(() => {});
        requestJoin(true);
        scheduleJoin();
    });
    window.addEventListener("pagehide", () => {
        pointerController?.setDisplay({ live: false });
        clearTimeout(refreshTimer);
        clearTimeout(joinTimer);
        clearInterval(healthTimer);
        if (presenceTracked && channel) channel.untrack().catch(() => {});
        closePeer();
    });
})();
