const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "mesa.html"), "utf8");
const guestHtml = fs.readFileSync(path.join(root, "mesa-jogador.html"), "utf8");
const code = fs.readFileSync(path.join(root, "tabletop-documents.js"), "utf8");
const masterOnline = fs.readFileSync(path.join(root, "tabletop-online.js"), "utf8");
const guestOnline = fs.readFileSync(path.join(root, "tabletop-guest.js"), "utf8");

for (const id of ["hudDocumentForm", "hudDocumentList", "hudDocumentKind", "hudDocumentTitle",
    "hudDocumentText", "hudDocumentImage", "hudDocumentStatus"]) assert.match(html, new RegExp(`id="${id}"`));
for (const id of ["guestDocument", "guestDocumentOpen", "guestDocumentClose", "guestDocumentHandle",
    "guestDocumentContent", "guestDocumentPages", "guestDocumentPrevious", "guestDocumentNext", "guestDocumentText",
    "guestDocumentImage"]) assert.match(guestHtml, new RegExp(`id="${id}"`));
for (const edge of ["n", "e", "s", "w", "ne", "se", "sw", "nw"]) {
    assert.match(guestHtml, new RegExp(`data-document-resize="${edge}"`));
}
assert.doesNotMatch(guestHtml, /guestDocument(?:Smaller|Larger)/);
assert.doesNotMatch(guestOnline, /showModal\(/, "pista não deve bloquear o mapa");
assert.match(masterOnline, /event: "document-request"/);
assert.match(masterOnline, /event: "document"/);
assert.match(guestOnline, /event: "document-request"/);
assert.match(guestOnline, /event: "document"/);
assert.doesNotMatch(code, /localStorage|\.from\("tabletop_rooms"\)/);

function element() {
    return {
        hidden: false, textContent: "", value: "", required: false, children: [], handlers: {},
        addEventListener(name, fn) { this.handlers[name] = fn; },
        replaceChildren(...children) { this.children = children; },
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); },
        focus() {}, reportValidity() { return true; },
        reset() { ids.hudDocumentTitle.value = ""; ids.hudDocumentText.value = ""; ids.hudDocumentKind.value = "text"; },
        files: []
    };
}

const names = ["hudDocumentForm", "hudDocumentList", "hudDocumentKind", "hudDocumentTitle",
    "hudDocumentText", "hudDocumentImage", "hudDocumentStatus", "hudDocumentEmpty",
    "hudDocumentTextLabel", "hudDocumentImageLabel", "hudDocumentImageHint", "hudDocumentFormTitle",
    "hudDocumentSave", "hudDocumentCancel"];
const ids = Object.fromEntries(names.map((name) => [name, element()]));
ids.hudDocumentKind.value = "text";
const storage = new Map();
const database = {
    createObjectStore() {}, close() {},
    transaction() {
        const transaction = { error: null, objectStore() {
            return {
                get(key) {
                    const request = { result: storage.get(key) };
                    queueMicrotask(() => request.onsuccess?.());
                    return request;
                },
                put(value, key) {
                    storage.set(key, structuredClone(value));
                    queueMicrotask(() => transaction.oncomplete?.());
                }
            };
        } };
        return transaction;
    }
};
const indexedDB = { open() {
    const request = { result: database };
    queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
} };
let live = false;
const sent = [];
const events = {};
const context = {
    indexedDB, crypto: { randomUUID: () => "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" },
    window: {
        REAL_TABLETOP_MASTER: { campaignKey: "campaign:one" },
        REAL_TABLETOP_ONLINE: { isLive: () => live, async sendDocument(payload) { sent.push(payload); return true; } },
        addEventListener(name, fn) { events[name] = fn; }
    },
    document: { getElementById: (id) => ids[id], createElement: () => element() },
    confirm: () => true
};

(async () => {
    vm.runInNewContext(code, context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ids.hudDocumentEmpty.hidden, false);
    ids.hudDocumentTitle.value = "Carta secreta";
    ids.hudDocumentText.value = "A senha está no porão.";
    await ids.hudDocumentForm.handlers.submit({ preventDefault() {} });
    assert.equal(storage.get("campaign:one").documents.length, 1);
    assert.equal(storage.get("campaign:one").revealedId, null);
    assert.equal(sent.length, 0, "salvar não revela");
    assert.equal(ids.hudDocumentList.children[0].children[0].children[1].textContent, "Privado");
    const revealButton = ids.hudDocumentList.children[0].children[1].children[0];
    await revealButton.handlers.click();
    assert.equal(sent.length, 0, "não revela fora da transmissão");
    live = true;
    await revealButton.handlers.click();
    assert.equal(sent[0].kind, "show");
    assert.equal(sent[0].document.text, "A senha está no porão.");
    assert.equal(storage.get("campaign:one").revealedId, "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
    assert.equal(ids.hudDocumentList.children[0].children[0].children[1].textContent, "Revelado");
    await context.window.REAL_TABLETOP_DOCUMENTS.sendCurrent("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    assert.equal(sent[1].viewerId, "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb", "entrada tardia é direcionada");
    await ids.hudDocumentList.children[0].children[1].children[0].handlers.click();
    assert.equal(sent[2].kind, "hide");
    assert.equal(storage.get("campaign:one").revealedId, null);
    console.log("Documentos: salvamento privado, revelação, entrada tardia e ocultação: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
