// Apontadores efêmeros. O dono assina permissões e pontos; espectadores assinam apenas seus pedidos.
(function (scope) {
    "use strict";
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const COLORS = ["#60a5fa", "#fbbf24", "#a78bfa", "#34d399", "#fb7185", "#22d3ee"];
    const DURATION = 3000, COOLDOWN = 1200;
    const bytes = (value) => new TextEncoder().encode(value);
    const supported = () => Boolean(scope.crypto?.subtle);
    function publicKey(value) {
        if (!value || value.kty !== "EC" || value.crv !== "P-256" || value.d !== undefined
            || !/^[\w-]{43}$/.test(value.x || "") || !/^[\w-]{43}$/.test(value.y || "")) return null;
        return { kty: "EC", crv: "P-256", x: value.x, y: value.y, ext: true };
    }
    async function identity() {
        const keys = await scope.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
        return { privateKey: keys.privateKey, publicKey: publicKey(await scope.crypto.subtle.exportKey("jwk", keys.publicKey)) };
    }
    async function importKey(value) {
        const key = publicKey(value); if (!key) throw new Error("Identidade inválida");
        return scope.crypto.subtle.importKey("jwk", key, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    }
    async function sign(value, privateKey) {
        const body = JSON.stringify(value);
        const signature = new Uint8Array(await scope.crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, bytes(body)));
        return { body, signature: btoa(String.fromCharCode(...signature)) };
    }
    async function verify(envelope, key) {
        try {
            if (typeof envelope?.body !== "string" || envelope.body.length > 25000
                || typeof envelope.signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)) return null;
            const signature = Uint8Array.from(atob(envelope.signature), (char) => char.charCodeAt(0));
            if (!await scope.crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, bytes(envelope.body))) return null;
            return JSON.parse(envelope.body);
        } catch { return null; }
    }
    function relativePoint(rect, ratio, x, y) {
        if (!(rect.width > 0 && rect.height > 0 && ratio > 0)) return null;
        const width = Math.min(rect.width, rect.height * ratio), height = width / ratio;
        const left = rect.left + (rect.width - width) / 2, top = rect.top + (rect.height - height) / 2;
        const nx = (x - left) / width, ny = (y - top) / height;
        return Number.isFinite(nx) && Number.isFinite(ny) && nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1
            ? { x: nx, y: ny, left, top, width, height } : null;
    }
    function overlay(root, project) {
        const points = new Map();
        function clear(viewerId) {
            for (const [id, point] of points) if (!viewerId || id === viewerId) {
                clearTimeout(point.timer); point.node.remove(); points.delete(id);
            }
        }
        function reflow() {
            for (const point of points.values()) {
                const pos = project(point.value); point.node.hidden = !pos;
                if (pos) { point.node.style.left = pos.x + "px"; point.node.style.top = pos.y + "px"; }
            }
        }
        function add(value) {
            if (!root) return;
            clear(value.viewerId);
            const node = document.createElement("div"); node.className = "tabletop-pointer";
            node.style.setProperty("--pointer-color", COLORS.includes(value.color) ? value.color : COLORS[0]);
            const label = document.createElement("span"); label.textContent = String(value.name || "Jogador").slice(0, 32);
            node.append(label); root.append(node);
            points.set(value.viewerId, { node, value, timer: setTimeout(() => clear(value.viewerId), DURATION) }); reflow();
        }
        return { add, clear, reflow };
    }

    function createMaster(options) {
        const { master, onChange = () => {} } = options;
        const markers = overlay(options.root, (point) => master.pointOnScreen?.(point));
        let context = null, keys = null, authority = null, connected = false, revision = 0;
        let view = null, frameInfo = null, sequence = 0, queue = Promise.resolve(), statePending = false, lastMasterAt = 0;
        let paused = Boolean(master.isTransmissionPaused?.());
        const entries = new Map(), helloTimes = new Map();
        const hint = (message) => { if (options.hint) options.hint.textContent = message; };
        function currentView() {
            const data = master.pointerView?.(); if (!data) return null;
            const stamp = JSON.stringify(data);
            if (view?.stamp !== stamp) {
                view = { ...data, viewId: scope.crypto.randomUUID(), stamp }; markers.clear();
            }
            return view;
        }
        function emit(message) {
            const captured = revision;
            queue = queue.catch(() => {}).then(async () => {
                if (!authority || !keys || !context || !connected || captured !== revision) return;
                const value = typeof message === "function" ? message() : message;
                const envelope = await sign({ ...value, sessionId: authority.sessionId, seq: ++sequence, issuedAt: Date.now() }, keys.privateKey);
                if (captured === revision && connected) await context.send("pointer-state", envelope);
            }).catch(() => hint("Não foi possível enviar o apontador. Tente novamente."));
            return queue;
        }
        function emitState(challenge = null) {
            if (!authority || !connected || (!challenge && statePending) || !currentView()) return queue;
            if (!challenge) statePending = true;
            return emit(() => {
                if (!challenge) statePending = false; const visible = currentView();
                return { kind: "state", view: { x: visible.x, y: visible.y, width: visible.width, height: visible.height,
                    sceneId: visible.sceneId, viewId: visible.viewId }, frameInfo, paused,
                    ...(challenge ? { challenge } : {}),
                    grants: [...entries.values()].filter((entry) => entry.allowed).map((entry) => ({ viewerId: entry.viewerId,
                        grantId: entry.grantId, name: entry.name, color: entry.color })) };
            });
        }
        function stop() {
            revision++; context = null; keys = null; authority = null; connected = false;
            entries.clear(); helloTimes.clear(); view = null; frameInfo = null; statePending = false; markers.clear(); onChange();
            hint("Cada jogador precisa da sua permissão para apontar. As permissões valem só nesta sessão.");
        }
        async function start(next) {
            stop(); context = next; connected = Boolean(next.connected); const captured = revision;
            if (!supported()) { hint("Este navegador não oferece o apontador seguro. Use uma versão atualizada."); return; }
            try {
                await master.ready;
                if (captured !== revision) return;
                const generated = await identity();
                if (captured !== revision) return;
                const nextAuthority = { sessionId: scope.crypto.randomUUID(), publicKey: generated.publicKey };
                const result = await next.client.from("tabletop_rooms").update({ pointer_authority: nextAuthority })
                    .eq("id", next.roomId).eq("owner_id", next.ownerId).select("id,pointer_authority").single();
                if (result.error) throw result.error;
                if (captured !== revision) return;
                keys = generated; authority = nextAuthority;
                frameInfo = null;
                hint("Marque “Permitir apontar” ao lado do jogador. Desmarque para retirar a permissão.");
                options.refreshViewers?.(); await next.send("changed", {}); await emitState(); onChange(); options.onReady?.();
            } catch { if (captured === revision) { stop(); hint("O apontador não conectou. A transmissão continua disponível."); } }
        }
        function present(viewers) {
            const seen = new Set(); let changed = false;
            for (const raw of viewers.slice(0, 64)) {
                const key = publicKey(raw.pointerKey);
                if (!UUID.test(raw.viewerId || "") || !key) continue;
                const id = raw.viewerId, serialized = JSON.stringify(key); seen.add(id);
                const old = entries.get(id);
                // Uma chave diferente com o mesmo ID não herda uma autorização anterior.
                if (old && old.serialized !== serialized) { entries.delete(id); markers.clear(id); changed = true; continue; }
                const name = String(raw.name || "Jogador").trim().slice(0, 32);
                if (!old) {
                    const color = COLORS[parseInt(id.slice(0, 8), 16) % COLORS.length];
                    entries.set(id, { viewerId: id, name, color, serialized, publicKey: key, allowed: false, lastAt: 0, lastSeq: 0 }); changed = true;
                } else if (old.name !== name) { old.name = name; changed = true; }
            }
            for (const id of entries.keys()) if (!seen.has(id)) { entries.delete(id); markers.clear(id); changed = true; }
            if (changed && authority) emitState();
        }
        function permission(raw) {
            const entry = entries.get(raw.viewerId);
            return entry && JSON.stringify(publicKey(raw.pointerKey)) === entry.serialized ? entry : null;
        }
        async function setAllowed(raw, allowed) {
            const entry = permission(raw), captured = revision;
            if (!entry || !authority || !connected) return false;
            const key = await importKey(entry.publicKey).catch(() => null);
            if (!key || captured !== revision || entries.get(entry.viewerId) !== entry) return false;
            entry.key = key; entry.allowed = Boolean(allowed); entry.grantId = scope.crypto.randomUUID();
            if (!entry.allowed) markers.clear(entry.viewerId);
            onChange(); await emitState(); return true;
        }
        async function receive(payload) {
            if (!authority || !context || !connected) return false;
            if (payload?.kind === "hello" && UUID.test(payload.viewerId || "") && UUID.test(payload.nonce || "")) {
                const now = Date.now(); if (!entries.has(payload.viewerId) || now - (helloTimes.get(payload.viewerId) || 0) < 1200) return false;
                helloTimes.set(payload.viewerId, now); await emitState({ viewerId: payload.viewerId, nonce: payload.nonce }); return true;
            }
            if (typeof payload?.body !== "string" || payload.body.length > 1200) return false;
            let unchecked; try { unchecked = JSON.parse(payload.body); } catch { return false; }
            const entry = entries.get(unchecked.viewerId), captured = revision;
            if (paused || !entry?.allowed || !entry.key || Date.now() - entry.lastAt < COOLDOWN) return false;
            const message = await verify(payload, entry.key), visible = currentView();
            if (paused || !message || captured !== revision || !entry.allowed || entries.get(entry.viewerId) !== entry
                || message.kind !== "point" || message.sessionId !== authority.sessionId || message.grantId !== entry.grantId
                || message.viewId !== visible?.viewId || !Number.isSafeInteger(message.seq) || message.seq <= entry.lastSeq
                || !Number.isFinite(message.x) || !Number.isFinite(message.y) || message.x < 0 || message.x > 1 || message.y < 0 || message.y > 1
                || Date.now() - entry.lastAt < COOLDOWN) return false;
            entry.lastSeq = message.seq; entry.lastAt = Date.now();
            const point = { kind: "point", viewerId: entry.viewerId, name: entry.name, color: entry.color,
                viewId: visible.viewId, x: visible.x + message.x * visible.width, y: visible.y + message.y * visible.height };
            markers.add(point); await emit(point); return true;
        }
        async function pointMaster(x, y) {
            const visible = currentView();
            if (!authority || !connected || paused || !visible || Date.now() - lastMasterAt < COOLDOWN
                || !Number.isFinite(x) || !Number.isFinite(y) || x < visible.x || y < visible.y
                || x > visible.x + visible.width || y > visible.y + visible.height) return false;
            lastMasterAt = Date.now();
            const point = { kind: "point", role: "master", viewerId: authority.sessionId, name: "Mestre", color: COLORS[1],
                viewId: visible.viewId, x, y };
            markers.add(point); await emit(point); return true;
        }
        return { start, stop, present, permission, setAllowed, receive, pointMaster,
            ready: () => Boolean(authority && connected), authority: () => authority,
            setConnected(value) { connected = Boolean(value); if (!connected) statePending = false; onChange(); if (connected) emitState(); },
            changed() {
                const nextPaused = Boolean(master.isTransmissionPaused?.()), changedPause = paused !== nextPaused;
                paused = nextPaused; if (changedPause) markers.clear();
                const oldId = view?.viewId; currentView(); if (changedPause || oldId !== view?.viewId) emitState(); markers.reflow();
            },
            frameContext: () => currentView()?.viewId,
            published(viewId, publishedAt) { frameInfo = { viewId, publishedAt }; emitState(); },
            reconcile(value) { if (authority && value?.sessionId !== authority.sessionId) stop(); },
            settled: () => queue };
    }

    function createGuest(options) {
        const { viewerId, button, status, send } = options;
        let keys = null, authority = null, ownerKey = null, state = null, grant = null, armed = false;
        let generation = 0, highestSeq = 0, requestSeq = 0, lastAt = 0, down = null, clockOffset = 0;
        let synchronized = false, helloNonce = null, helloSentAt = 0;
        let display = { live: false, ready: false, video: false, stamp: null };
        const markers = overlay(options.root, (point) => {
            const source = options.source(); if (!source || !state || point.viewId !== state.view.viewId) return null;
            const box = relativePoint(source.getBoundingClientRect(), 16 / 9, source.getBoundingClientRect().left + source.getBoundingClientRect().width / 2,
                source.getBoundingClientRect().top + source.getBoundingClientRect().height / 2);
            const x = (point.x - state.view.x) / state.view.width, y = (point.y - state.view.y) / state.view.height;
            const pos = box && x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x: box.left + x * box.width, y: box.top + y * box.height } : null;
            const clip = options.stage?.getBoundingClientRect?.();
            return pos && (!clip || pos.x >= clip.left && pos.x <= clip.left + clip.width && pos.y >= clip.top && pos.y <= clip.top + clip.height) ? pos : null;
        });
        const identityReady = supported() ? identity().then((value) => { keys = value; return value.publicKey; }).catch(() => null) : Promise.resolve(null);
        function canPoint() {
            return Boolean(keys && ownerKey && synchronized && grant && !state?.paused && !display.paused && display.live && display.ready && state?.view
                && (display.video || (state.frameInfo?.viewId === state.view.viewId && state.frameInfo.publishedAt === display.stamp)));
        }
        function render() {
            if (!canPoint()) armed = false;
            button.hidden = !grant || !display.live;
            button.disabled = !canPoint(); button.textContent = armed ? "Cancelar apontador" : "◎ Apontar";
            button.setAttribute("aria-pressed", String(armed)); options.stage?.classList.toggle("is-pointing", armed);
            status.hidden = !grant || !display.live;
            status.textContent = state?.paused || display.paused ? "O apontador volta quando o mestre retomar a transmissão." : !canPoint() ? "Sincronizando a visão da mesa…" : armed ? "Toque ou clique no mapa para apontar. Esc cancela." : "O mestre permitiu que você aponte no mapa.";
            markers.reflow();
        }
        async function setAuthority(value) {
            if (authority?.sessionId === value?.sessionId && JSON.stringify(authority?.publicKey) === JSON.stringify(value?.publicKey)) return;
            const captured = ++generation; authority = null; ownerKey = null; state = null; grant = null; highestSeq = 0;
            synchronized = false; helloNonce = null; helloSentAt = 0; markers.clear(); render();
            if (!UUID.test(value?.sessionId || "") || !publicKey(value.publicKey)) return;
            const key = await importKey(value.publicKey).catch(() => null); if (!key || captured !== generation) return;
            authority = value; ownerKey = key; await hello();
        }
        async function hello() {
            if (!authority || !display.live || !display.ready || Date.now() - helloSentAt < COOLDOWN) return;
            helloNonce = scope.crypto.randomUUID(); helloSentAt = Date.now();
            await send("pointer-request", { kind: "hello", viewerId, nonce: helloNonce });
        }
        async function receive(payload) {
            if (!ownerKey || !display.live || !display.ready) return false;
            const captured = generation, message = await verify(payload, ownerKey);
            if (!message || captured !== generation || message.sessionId !== authority?.sessionId
                || !Number.isSafeInteger(message.seq) || message.seq <= highestSeq || !Number.isFinite(message.issuedAt)) return false;
            if (message.kind === "state") {
                const fresh = message.challenge?.viewerId === viewerId && message.challenge.nonce === helloNonce
                    && Date.now() - helloSentAt < 10000;
                if (!synchronized && !fresh) return false;
                const view = message.view;
                if (!UUID.test(view?.viewId || "") || ![view.x, view.y, view.width, view.height].every(Number.isFinite)
                    || view.width < 400 || view.width > 4000 || Math.abs(view.height - view.width * 9 / 16) > .01
                    || !Array.isArray(message.grants) || message.grants.length > 64) return false;
                const previous = state?.view?.viewId, previousGrants = state?.grants || []; state = message;
                if (fresh) { clockOffset = Date.now() - message.issuedAt; synchronized = true; helloNonce = null; }
                grant = message.grants.find((entry) => entry.viewerId === viewerId && UUID.test(entry.grantId || "")) || null;
                if (previous !== view.viewId || message.paused) markers.clear();
                else for (const old of previousGrants) if (!message.grants.some((entry) => entry.viewerId === old.viewerId)) markers.clear(old.viewerId);
                highestSeq = message.seq; render(); return true;
            }
            if (message.kind !== "point" || !synchronized || !state || state.paused || display.paused || message.viewId !== state.view.viewId
                || !(message.role === "master" && message.viewerId === authority.sessionId
                    || message.role !== "master" && state.grants.some((entry) => entry.viewerId === message.viewerId))
                || !Number.isFinite(message.x) || !Number.isFinite(message.y) || Date.now() - clockOffset - message.issuedAt > DURATION
                || message.x < state.view.x || message.x > state.view.x + state.view.width
                || message.y < state.view.y || message.y > state.view.y + state.view.height) return false;
            highestSeq = message.seq;
            if (display.video || (state.frameInfo?.viewId === state.view.viewId && state.frameInfo.publishedAt === display.stamp)) markers.add(message);
            return true;
        }
        async function point(x, y) {
            if (!armed || !canPoint() || Date.now() - lastAt < COOLDOWN) return false;
            const source = options.source(), pos = source && relativePoint(source.getBoundingClientRect(), 16 / 9, x, y);
            if (!pos) return false;
            const clip = options.stage?.getBoundingClientRect?.();
            if (clip && (x < clip.left || x > clip.left + clip.width || y < clip.top || y > clip.top + clip.height)) return false;
            const captured = generation, token = grant.grantId, viewId = state.view.viewId;
            const envelope = await sign({ kind: "point", sessionId: authority.sessionId, viewerId, grantId: token,
                viewId, seq: ++requestSeq, x: pos.x, y: pos.y }, keys.privateKey);
            if (captured !== generation || !canPoint() || grant.grantId !== token || state.view.viewId !== viewId) return false;
            lastAt = Date.now(); armed = false; render(); await send("pointer-request", envelope); return true;
        }
        button.addEventListener("click", () => { if (canPoint()) { armed = !armed; render(); } });
        options.stage?.addEventListener("pointerdown", (event) => {
            down = armed && event.isPrimary !== false && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
        });
        options.stage?.addEventListener("pointerup", (event) => {
            const start = down; down = null;
            if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8)
                point(event.clientX, event.clientY).catch(() => { status.textContent = "Não foi possível apontar. Tente novamente."; });
        });
        options.stage?.addEventListener("pointercancel", () => { down = null; });
        scope.addEventListener?.("keydown", (event) => { if (event.key === "Escape") { armed = false; render(); } });
        scope.addEventListener?.("resize", markers.reflow);
        render();
        return { identityReady, setAuthority, receive, hello, point, canPoint, isArmed: () => armed,
            cancelGesture() { down = null; },
            setDisplay(value) { display = { ...display, ...value }; if (!display.live || !display.ready) {
                grant = null; state = null; synchronized = false; helloNonce = null; helloSentAt = 0; markers.clear();
            } render(); },
            reflow: markers.reflow, clear: markers.clear };
    }
    scope.REAL_POINTERS = Object.freeze({ supported, publicKey, identity, importKey, sign, verify, relativePoint, createMaster, createGuest, DURATION, COOLDOWN });
})(typeof window === "undefined" ? globalThis : window);
