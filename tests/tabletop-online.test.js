const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const masterHtml = read("mesa.html");
const masterCode = read("tabletop-online.js");
const tabletopCode = read("script.js");
const guestHtml = read("mesa-jogador.html");
const guestCode = read("tabletop-guest.js");
const edgeCode = read("supabase/functions/tabletop-guest-view/index.ts");
const configCode = read("supabase-config.js");

assert.match(masterHtml, /id="onlineAuthForm"/);
assert.match(masterHtml, /id="onlineToggle"/);
assert.match(masterHtml, /id="onlineInvite"/);
assert.match(masterCode, /auth\.signInWithPassword/);
assert.match(masterCode, /auth\.signUp/);
assert.match(masterCode, /published_frame: frame/);
assert.match(masterCode, /new RTCPeerConnection/);
assert.match(masterCode, /kind: "offer"/);
assert.match(masterCode, /auth\.signOut/);
assert.match(masterCode, /\.update\(\{ is_live: false, published_frame: null/);
assert.match(tabletopCode, /capturePlayerFrame\(\)/);
assert.match(tabletopCode, /previewCanvas\.captureStream\(24\)/);
assert.match(tabletopCode, /previewDialog\.open \|\| playerStream/);
assert.match(tabletopCode, /VIEW_RULES\.publishedTokens\(tokens\)/);
assert.match(tabletopCode, /window\.dispatchEvent\(new Event\("real:tabletop-changed"\)\)/);
assert.match(guestHtml, /id="guestFrame"/);
assert.match(guestHtml, /id="guestVideo"/);
assert.match(guestCode, /kind: "answer"/);
assert.doesNotMatch(guestHtml, /id="(?:gameCanvas|toolToken|toolMap|tokenLibrary)"/);
assert.match(edgeCode, /select", "is_live,published_frame,published_at"/);
assert.doesNotMatch(edgeCode, /select", "\*"/);
assert.match(edgeCode, /SUPABASE_SECRET_KEYS/);
assert.match(configCode, /sb_publishable_/);
assert.doesNotMatch(configCode, /sb_secret_|SERVICE_ROLE/i);

async function runGuest(hash, response) {
    const ids = {
        guestStatus: { textContent: "" },
        guestFrame: { hidden: true, src: "", removeAttribute(name) { if (name === "src") this.src = ""; } },
        guestVideo: { hidden: true, srcObject: null, addEventListener() {} },
        guestWaiting: { hidden: false }
    };
    const calls = [];
    const context = {
        document: { visibilityState: "visible", getElementById: (id) => ids[id], addEventListener() {} },
        location: { hash },
        window: { REAL_SUPABASE_CONFIG: { url: "https://example.supabase.co", publishableKey: "sb_publishable_test" }, addEventListener() {} },
        crypto: { randomUUID: () => "11111111-2222-4333-8444-555555555555" },
        URLSearchParams,
        setInterval() {},
        fetch: async (url, options) => { calls.push({ url, options }); return response; }
    };
    vm.runInNewContext(guestCode, context);
    await new Promise((resolve) => setImmediate(resolve));
    return { ids, calls };
}

async function runMaster() {
    const handlers = {};
    const ids = Object.fromEntries([
        "onlineStatus", "onlineAuthForm", "onlineMasterControls", "onlineToggle", "onlineInvite",
        "onlineCopy", "onlineMasterName", "onlineEmail", "onlinePassword", "onlineSignIn",
        "onlineSignUp", "onlineSignOut"
    ].map((id) => [id, { hidden: false, disabled: false, value: "", textContent: "",
        addEventListener(name, fn) { handlers[`${id}:${name}`] = fn; }, reportValidity() { return true; } }]));
    const user = { id: "master-1", email: "mestre@example.test" };
    const writes = [];
    let savedRoom = null;
    const client = {
        from(table) {
            assert.equal(table, "tabletop_rooms");
            return {
                select() { return this; }, eq() { return this; },
                maybeSingle: async () => ({ data: savedRoom, error: null }),
                insert(data) { writes.push({ kind: "insert", data }); savedRoom = { id: "room-1", invite_code: "11111111-2222-4333-8444-555555555555", ...data }; return this; },
                update(data) { writes.push({ kind: "update", data }); savedRoom = { ...savedRoom, ...data }; return this; },
                single: async () => ({ data: savedRoom, error: null })
            };
        },
        channel() { return { on() { return this; }, subscribe() { return this; }, send: async () => {} }; },
        removeChannel() {},
        auth: { onAuthStateChange() {}, getUser: async () => ({ data: { user } }) }
    };
    const context = {
        document: { getElementById: (id) => ids[id] },
        window: { REAL_SUPABASE_CONFIG: { url: "https://example.supabase.co", publishableKey: "sb_publishable_test" },
            REAL_TABLETOP_MASTER: { ready: Promise.resolve(), campaignKey: "autosave", capturePlayerFrame: () => "data:image/jpeg;base64,abc" },
            supabase: { createClient: () => client }, addEventListener(name, fn) { handlers[`window:${name}`] = fn; } },
        location: { href: "https://example.test/mesa.html", protocol: "https:" },
        URL, URLSearchParams, setTimeout, clearTimeout, navigator: { clipboard: { writeText: async () => {} } }
    };
    vm.runInNewContext(masterCode, context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ids.onlineAuthForm.hidden, true);
    await handlers["onlineToggle:click"]();
    assert.equal(writes[0].kind, "insert");
    assert.equal(writes[0].data.owner_id, user.id);
    assert.equal(writes[0].data.published_frame, "data:image/jpeg;base64,abc");
    assert.equal(ids.onlineCopy.disabled, false);
    assert.match(ids.onlineInvite.value, /mesa-jogador\.html#convite=/);
    await handlers["onlineToggle:click"]();
    assert.equal(writes[1].kind, "update");
    assert.equal(writes[1].data.is_live, false);
    assert.equal(writes[1].data.published_frame, null);
}

async function runLive() {
    const code = "11111111-2222-4333-8444-555555555555";
    const room = { id: "room-1", invite_code: code, is_live: true, published_at: "2026-09-28T00:00:00Z" };
    const channels = [];
    const signals = [];
    const track = { stopped: false, stop() { this.stopped = true; } };
    const stream = { getTracks: () => [track] };
    const videoHandlers = {};
    const guestIds = {
        guestStatus: { textContent: "" },
        guestFrame: { hidden: true, src: "", removeAttribute() { this.src = ""; } },
        guestVideo: { hidden: true, srcObject: null, addEventListener(name, fn) { videoHandlers[name] = fn; },
            play() { videoHandlers.playing(); return Promise.resolve(); } },
        guestWaiting: { hidden: false }
    };
    const masterIds = Object.fromEntries([
        "onlineStatus", "onlineAuthForm", "onlineMasterControls", "onlineToggle", "onlineInvite",
        "onlineCopy", "onlineMasterName", "onlineEmail", "onlinePassword", "onlineSignIn",
        "onlineSignUp", "onlineSignOut"
    ].map((id) => [id, { hidden: false, disabled: false, value: "", textContent: "", addEventListener() {} }]));
    const handlers = {};
    masterIds.onlineToggle.addEventListener = (name, fn) => { handlers[name] = fn; };

    class FakePeerConnection {
        constructor() { this.connectionState = "new"; this.remoteDescription = null; this.localDescription = null; this.tracks = []; }
        addTrack(value) { this.tracks.push(value); }
        async createOffer() { return { type: "offer", sdp: "test-offer" }; }
        async createAnswer() { return { type: "answer", sdp: "test-answer" }; }
        async setLocalDescription(value) { this.localDescription = value; }
        async setRemoteDescription(value) {
            this.remoteDescription = value;
            if (value.type === "offer") queueMicrotask(() => this.ontrack?.({ streams: [stream] }));
        }
        async addIceCandidate() {}
        close() { this.connectionState = "closed"; }
    }
    function createClient() {
        return {
            channel(topic) {
                const handlers = {};
                const channel = {
                    topic, handlers,
                    on(type, filter, fn) { assert.equal(type, "broadcast"); handlers[filter.event] = fn; return this; },
                    subscribe(fn) { channels.push(this); fn?.("SUBSCRIBED"); return this; },
                    async send(message) {
                        signals.push(message);
                        channels.filter((other) => other !== this && other.topic === topic).forEach((other) => {
                            queueMicrotask(() => other.handlers[message.event]?.({ payload: message.payload }));
                        });
                    }
                };
                return channel;
            },
            removeChannel(channel) { const index = channels.indexOf(channel); if (index >= 0) channels.splice(index, 1); },
            from(table) {
                assert.equal(table, "tabletop_rooms");
                return {
                    select() { return this; }, eq() { return this; },
                    maybeSingle: async () => ({ data: room, error: null }),
                    update(data) { Object.assign(room, data); return this; },
                    single: async () => ({ data: room, error: null })
                };
            },
            auth: { onAuthStateChange() {}, getUser: async () => ({ data: { user: { id: "master-1", email: "master@example.test" } } }) }
        };
    }
    const ids = [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ];
    const shared = {
        RTCPeerConnection: FakePeerConnection,
        crypto: { randomUUID: () => ids.shift() || "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
        URL, URLSearchParams, setTimeout, clearTimeout, setInterval() {}
    };
    const masterContext = {
        ...shared,
        document: { getElementById: (id) => masterIds[id] },
        window: { REAL_SUPABASE_CONFIG: { url: "https://example.supabase.co", publishableKey: "sb_publishable_test" },
            REAL_TABLETOP_MASTER: { ready: Promise.resolve(), campaignKey: "autosave", startPlayerStream: () => stream,
                stopPlayerStream: () => track.stop(), capturePlayerFrame: () => "data:image/jpeg;base64,abc" },
            supabase: { createClient }, addEventListener() {} },
        location: { href: "https://example.test/mesa.html", protocol: "https:" },
        navigator: { clipboard: { writeText: async () => {} } }
    };
    vm.runInNewContext(masterCode, masterContext);
    await new Promise((resolve) => setImmediate(resolve));
    const guestContext = {
        ...shared,
        document: { visibilityState: "visible", getElementById: (id) => guestIds[id], addEventListener() {} },
        window: { REAL_SUPABASE_CONFIG: { url: "https://example.supabase.co", publishableKey: "sb_publishable_test" },
            supabase: { createClient }, addEventListener() {} },
        location: { hash: `#convite=${code}` },
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ live: room.is_live,
            frame: room.is_live ? "data:image/jpeg;base64,abc" : null, publishedAt: room.published_at }) })
    };
    vm.runInNewContext(guestCode, guestContext);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.ok(signals.some((message) => message.payload.kind === "join"));
    assert.ok(signals.some((message) => message.payload.kind === "offer"));
    assert.ok(signals.some((message) => message.payload.kind === "answer"));
    assert.equal(guestIds.guestVideo.srcObject, stream);
    assert.equal(guestIds.guestVideo.hidden, false);
    assert.equal(guestIds.guestFrame.hidden, true);
    await handlers.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(track.stopped, true);
    assert.equal(guestIds.guestVideo.hidden, true);
    assert.equal(guestIds.guestWaiting.hidden, false);
}

(async () => {
    await runMaster();
    const noInvite = await runGuest("", null);
    assert.equal(noInvite.calls.length, 0);
    assert.match(noInvite.ids.guestStatus.textContent, /inválido/);

    const code = "11111111-2222-4333-8444-555555555555";
    const live = await runGuest(`#convite=${code}`, {
        ok: true, status: 200,
        json: async () => ({ live: true, frame: "data:image/jpeg;base64,abc", publishedAt: "2026-09-28T00:00:00Z" })
    });
    assert.equal(live.calls.length, 1);
    assert.equal(live.calls[0].options.method, "POST");
    assert.equal(JSON.parse(live.calls[0].options.body).inviteCode, code);
    assert.equal(live.ids.guestFrame.src, "data:image/jpeg;base64,abc");
    assert.equal(live.ids.guestFrame.hidden, false);

    const paused = await runGuest(`#convite=${code}`, {
        ok: true, status: 200,
        json: async () => ({ live: false, frame: null, publishedAt: null })
    });
    assert.equal(paused.ids.guestFrame.hidden, true);
    assert.equal(paused.ids.guestWaiting.hidden, false);
    await runLive();
    console.log("Mesa online: convite, vídeo ao vivo, imagem de reserva e encerramento: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
