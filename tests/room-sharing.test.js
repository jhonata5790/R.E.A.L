const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const code = fs.readFileSync(path.join(__dirname, "..", "assets/js/portal/room-sharing.js"), "utf8");
const names = ["roomShareStatus", "roomLiveBadge", "roomLiveToggle", "roomCopyInvite", "roomInvite", "roomViewerCount", "roomViewerList"];
const elements = Object.fromEntries(names.map((name) => [name, { value: "", textContent: "", children: [], handlers: {}, classList: { toggle() {} },
    replaceChildren(...items) { this.children = items; }, append(item) { this.children.push(item); },
    addEventListener(type, fn) { this.handlers[type] = fn; }, select() {} }]));
const queries = [], writes = [], broadcasts = [], channels = [];
let user = { id: "owner-1" }, storedRoom = null, openedAccount = false;
const invite = "11111111-2222-4333-8444-555555555555";
const client = {
    from(table) {
        assert.equal(table, "tabletop_rooms"); const query = { filters: [] }; queries.push(query);
        return {
            select(fields) { query.fields = fields; return this; },
            eq(key, value) { query.filters.push([key, value]); return this; },
            maybeSingle: async () => ({ data: storedRoom, error: null }),
            insert(data) { writes.push(data); storedRoom = { id: "room-1", invite_code: invite, ...data }; return this; },
            update(data) { writes.push(data); storedRoom = { ...storedRoom, ...data }; return this; },
            single: async () => ({ data: storedRoom, error: null })
        };
    },
    channel(topic) {
        const handlers = {};
        const channel = { topic: "realtime:" + topic, handlers,
            on(type, options, fn) { handlers[type + ":" + options.event] = fn; return this; },
            subscribe(fn) { fn("SUBSCRIBED"); return this; },
            presenceState: () => ({ player: [{ role: "viewer", name: "Ana" }], master: [{ role: "master", name: "Privado" }] }),
            async send(value) { broadcasts.push(value); return "ok"; }
        }; channels.push(channel); return channel;
    }, removeChannel() {}
};
const window = {
    REAL_ACCOUNT: { ready: Promise.resolve(), currentUser: () => user, isSignedIn: () => Boolean(user), client: () => client, open: () => { openedAccount = true; } },
    REAL_TABLE_WORKSPACE: {
        read: async () => ({ scenes: [{ session: { tokens: [] } }] }), active: (workspace) => workspace.scenes[0],
        renderSession: async () => "data:image/jpeg;base64,public-frame",
        readDocuments: async () => ({ documents: [{ id: "letter", title: "Carta", kind: "text", text: "Pista revelada", privateNotes: "Nunca enviar" }], revealedId: "letter" })
    }, addEventListener() {}, dispatchEvent() {}
};
vm.runInNewContext(code, { window, document: { getElementById: (name) => elements[name], createElement: () => ({}) },
    location: { href: "https://real.example/index.html" }, URL, URLSearchParams, CustomEvent: class {},
    navigator: { clipboard: { writeText: async () => {} } } });

(async () => {
    await window.REAL_ROOM_SHARING.setTable("table-A");
    assert.ok(queries[0].filters.some(([key, value]) => key === "owner_id" && value === "owner-1"));
    assert.ok(queries[0].filters.some(([key, value]) => key === "campaign_key" && value === "table-A"));
    assert.equal(queries[0].fields.includes("published_frame"), false, "consulta de status não baixa quadros");
    await elements.roomLiveToggle.handlers.click();
    assert.equal(writes[0].owner_id, "owner-1");
    assert.equal(writes[0].campaign_key, "table-A");
    assert.equal(writes[0].published_frame, "data:image/jpeg;base64,public-frame");
    assert.equal(elements.roomViewerCount.textContent, "1");
    assert.equal(elements.roomViewerList.children[0].textContent, "Ana");
    assert.match(elements.roomInvite.value, /mesa-jogador.html#convite=/);
    await channels[0].handlers["broadcast:document-request"]({ payload: { viewerId: invite } });
    await new Promise((resolve) => setImmediate(resolve));
    const documentBroadcast = broadcasts.find((item) => item.event === "document");
    assert.equal(documentBroadcast.payload.document.text, "Pista revelada");
    assert.equal("privateNotes" in documentBroadcast.payload.document, false);
    await elements.roomLiveToggle.handlers.click();
    assert.equal(writes[1].is_live, false); assert.equal(writes[1].published_frame, null);
    assert.equal(elements.roomInvite.value, "");
    user = null;
    await window.REAL_ROOM_SHARING.setTable("table-B");
    await elements.roomLiveToggle.handlers.click();
    assert.equal(openedAccount, true); assert.equal(writes.length, 2);
    await window.REAL_ROOM_SHARING.setTable(null);
    assert.equal(elements.roomViewerCount.textContent, "0");
    console.log("Sala online: propriedade, transmissão estática, espectadores, documentos revelados e encerramento: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
