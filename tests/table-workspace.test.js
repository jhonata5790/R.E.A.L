const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const databases = new Map();
let sequence = 0;
const indexedDB = { open(name) {
    const fresh = !databases.has(name); if (fresh) databases.set(name, new Map());
    const stores = databases.get(name);
    const db = { close() {}, objectStoreNames: { contains: (key) => stores.has(key) },
        createObjectStore(key) { stores.set(key, new Map()); },
        transaction(storeName) {
            const data = stores.get(storeName); if (!data) throw new Error("Store ausente: " + storeName);
            const tx = { error: null, abort() { queueMicrotask(() => tx.onabort?.()); }, objectStore() { return {
                get(key) { const req = { result: data.has(key) ? structuredClone(data.get(key)) : undefined }; queueMicrotask(() => req.onsuccess?.()); return req; },
                put(value, key) { data.set(key, structuredClone(value)); queueMicrotask(() => tx.oncomplete?.()); },
                delete(key) { data.delete(key); queueMicrotask(() => tx.oncomplete?.()); }
            }; } }; return tx;
        }
    };
    const request = { result: db }; queueMicrotask(() => { if (fresh) request.onupgradeneeded?.(); request.onsuccess?.(); }); return request;
} };
const canvasContext = new Proxy({}, { get: (obj, key) => key in obj ? obj[key] : () => {} });
class Element {
    constructor() { this.hidden = false; this.style = {}; this.handlers = {}; this.children = []; this.value = ""; this.dataset = {}; this.classList = { toggle() {} }; }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    setAttribute() {} append(...items) { this.children.push(...items); } appendChild(item) { this.append(item); }
    replaceChildren(...items) { this.children = items; } focus() {} contains() { return false; }
    getContext() { return canvasContext; } toDataURL() { return "data:image/jpeg;base64,preview"; }
}
const html = fs.readFileSync(path.join(root, "mesa.html"), "utf8");
const ids = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element()]));
const window = { innerWidth: 1000, innerHeight: 800, addEventListener() {}, dispatchEvent() {}, confirm: () => true };
const document = { body: new Element(), getElementById: (id) => ids[id], querySelector: () => new Element(), querySelectorAll: () => [], createElement: () => new Element(), addEventListener() {} };
class Image {
    constructor() { this.width = 100; this.height = 100; }
    set src(value) { queueMicrotask(() => this.onload?.()); }
}
const context = vm.createContext({ window, document, indexedDB, Image, crypto: { randomUUID: () => `scene-${++sequence}` },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    Event, URLSearchParams, location: { search: "?table=old" }, performance: { now: () => 0 },
    requestAnimationFrame() {}, setTimeout() { return 1; }, clearTimeout() {}, console });
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/shared/table-workspace.js"), "utf8"), context);
const store = window.REAL_TABLE_WORKSPACE;
const plain = (value) => JSON.parse(JSON.stringify(value));

(async () => {
    databases.set("tabletop2d-storage", new Map([["sessions", new Map([["campaign:old", {
        ...plain(store.emptySession()), map: { source: "data:image/png;base64,old", name: "Mapa antigo", x: 0, y: 0, scale: 1 },
        tokens: [{ id: 1, name: "Lia", source: "data:image/png;base64,token", x: 0, y: 0, width: 100, rotation: 0, visibleToPlayers: false }]
    }]])]]));
    let workspace = await store.read("old");
    assert.equal(workspace.scenes.length, 1);
    const first = store.active(workspace).id;
    assert.equal(store.active(workspace).session.map.name, "Mapa antigo", "migra o salvamento antigo");
    assert.equal(store.active(workspace).session.tokens[0].visibleToPlayers, false);
    const nextSession = plain(store.emptySession()); nextSession.camera.x = 44;
    workspace = await store.addScene("old", "No cais", nextSession);
    const second = workspace.scenes[1].id;
    assert.equal(workspace.activeSceneId, first, "criar não abandona a cena atual");
    await store.activate("old", second);
    await store.saveSession("old", { ...workspace.scenes[0].session, sceneId: first, camera: { x: 99, y: 0, zoom: 1 } });
    workspace = await store.read("old");
    assert.equal(workspace.activeSceneId, second, "salvamento atrasado da outra aba não troca a cena ativa");
    assert.equal(workspace.scenes[0].session.camera.x, 99);
    await Promise.all([store.saveNotes("old", "Notas privadas"), store.updateScene("old", second, "rename", "Cais de madrugada")]);
    workspace = await store.read("old");
    assert.equal(workspace.notes, "Notas privadas", "alterações concorrentes preservam as notas");
    assert.equal(workspace.scenes[1].name, "Cais de madrugada");
    await store.writeDocuments("old", { documents: [{ id: "doc", title: "Carta", kind: "text", text: "Pista privada" }], revealedId: "doc" });
    await store.duplicateTable("old", "copy");
    assert.equal((await store.read("copy")).scenes.length, 2);
    assert.equal((await store.readDocuments("copy")).revealedId, null, "duplicação não revela documentos");
    await store.updateScene("copy", first, "delete");
    await assert.rejects(store.updateScene("copy", second, "delete"), /pelo menos uma cena/);
    await assert.rejects(store.saveSession("copy", { sceneId: first }), /removida/);
    await store.restoreBackup("restored", workspace, await store.readDocuments("old"));
    assert.equal((await store.read("restored")).notes, "Notas privadas");
    assert.equal((await store.readDocuments("restored")).revealedId, null);
    const unsafe = plain(workspace); unsafe.scenes[0].session.map.source = "https://example.test/private";
    unsafe.scenes[0].session.camera.zoom = 999999;
    await store.restoreBackup("sanitized", unsafe, { documents: [] });
    const sanitized = (await store.read("sanitized")).scenes[0].session;
    assert.equal(sanitized.map.source, null); assert.equal(sanitized.camera.zoom, 3);

    for (const file of ["tabletop-view.js", "tabletop-selection.js", "tabletop-shortcuts.js", "tabletop.js"]) vm.runInContext(fs.readFileSync(path.join(root, "assets/js/tabletop", file), "utf8"), context);
    const master = window.REAL_TABLETOP_MASTER;
    await master.ready;
    assert.equal(master.sceneId(), second);
    assert.equal(vm.runInContext("camera.x", context), 44);
    await master.switchScene(first);
    assert.equal(vm.runInContext("tokens.length", context), 1);
    vm.runInContext("tokens[0].x = 88; tokens[0].rotation = .8; scheduleSave()", context);
    await master.switchScene(second);
    assert.equal(vm.runInContext("tokens.length", context), 0);
    await master.switchScene(first);
    assert.equal(vm.runInContext("tokens[0].x", context), 88);
    assert.equal(vm.runInContext("tokens[0].rotation", context), .8);
    assert.equal(vm.runInContext("sceneHistory.canUndo", context), false, "histórico não atravessa cenas");
    assert.equal("notes" in master.snapshot(), false, "notas privadas não entram no quadro publicado");
    await store.removeTable("copy");
    assert.equal(databases.get("real-table-workspace-v1").get("tables").has("copy"), false);
    assert.equal((await store.readDocuments("copy")).documents.length, 0);
    console.log("Workspace: migração, cenas independentes, concorrência, cópia, backup privado e troca no canvas: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
