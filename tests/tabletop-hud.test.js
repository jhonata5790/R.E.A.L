const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("mesa.html");
const css = read("assets/css/tabletop.css");
const script = read("assets/js/tabletop/tabletop-hud.js");
for (const id of ["gameCanvas", "openHudMenu", "hudMenu", "hudCampaignName", "hudDocuments",
    "hudCampaignLink", "viewerPeek", "openViewerPeek", "onlineViewerList"]) {
    assert.match(html, new RegExp(`id="${id}"`));
}
assert.doesNotMatch(html, /hudShield|hudCharacterList|Fichas da campanha|personagem\.html/);
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

class Element {
    constructor() { this.hidden = false; this.attributes = {}; this.handlers = {}; this.textContent = ""; }
    addEventListener(type, fn) { this.handlers[type] = fn; }
    setAttribute(key, value) { this.attributes[key] = value; }
    focus() { this.focused = true; }
    contains(target) { return target === this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.handlers.close?.(); }
}

const ids = Object.fromEntries(["gameCanvas", "hudMenu", "openHudMenu", "closeHudMenu", "viewerPeek", "openViewerPeek",
    "closeViewerPeek", "hudCampaignName", "hudCampaignLink"].map((id) => [id, new Element()]));
ids.viewerPeek.hidden = true;
let blocked = false;
let modalActive = false;
let mobile = false;
const windowHandlers = {};
const documentHandlers = {};
const document = {
    visibilityState: "visible",
    body: {},
    activeElement: ids.gameCanvas,
    getElementById: (id) => ids[id],
    querySelector: () => modalActive ? {} : null,
    addEventListener(type, fn) { documentHandlers[type] = fn; }
};
const window = {
    matchMedia: () => ({ matches: mobile }),
    addEventListener(type, fn) { windowHandlers[type] = fn; }
};
const library = { campaigns: [{ id: "table-1", name: "Caso Sombrio" }] };
const localStorage = { getItem: () => JSON.stringify(library) };
vm.runInNewContext(script, { document, window, localStorage, location: { search: "?table=table-1" }, URLSearchParams,
    encodeURIComponent });

ids.openHudMenu.handlers.click();
assert.equal(ids.hudMenu.open, true);
assert.equal(ids.hudCampaignName.textContent, "Caso Sombrio");
assert.equal(ids.hudCampaignLink.href, "index.html#mesa/table-1");
ids.closeHudMenu.handlers.click();
assert.equal(ids.hudMenu.open, false);

const tab = { key: "Tab", altKey: false, ctrlKey: false, metaKey: false, target: { closest: () => null },
    preventDefault() { blocked = true; } };
windowHandlers.keydown(tab);
assert.equal(blocked, true);
assert.equal(ids.viewerPeek.hidden, false);
windowHandlers.keyup({ key: "Tab" });
assert.equal(ids.viewerPeek.hidden, true);
modalActive = true; blocked = false;
windowHandlers.keydown(tab);
assert.equal(blocked, false);
mobile = true;
ids.openViewerPeek.handlers.click();
assert.equal(ids.viewerPeek.hidden, false);
ids.closeViewerPeek.handlers.click();
assert.equal(ids.viewerPeek.hidden, true);
console.log("HUD do tabletop: sala, documentos, espectadores, Tab e botão móvel: OK");
