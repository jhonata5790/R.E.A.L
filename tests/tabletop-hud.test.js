const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("mesa.html");
const css = read("style.css");
const script = read("tabletop-hud.js");
for (const id of ["gameCanvas", "openHudMenu", "hudMenu", "hudCampaignName", "hudShield", "hudDocuments",
    "hudCharacterList", "viewerPeek", "openViewerPeek", "onlineViewerList"]) {
    assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(css, /@media \(max-width: 700px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

class Element {
    constructor() { this.hidden = false; this.attributes = {}; this.children = []; this.handlers = {}; this.dataset = {}; this.textContent = ""; }
    addEventListener(type, fn) { this.handlers[type] = fn; }
    setAttribute(key, value) { this.attributes[key] = value; }
    focus() { this.focused = true; }
    contains(target) { return target === this; }
    appendChild(item) { this.children.push(item); }
    append(...items) { this.children.push(...items); }
    replaceChildren() { this.children = []; }
    showModal() { this.open = true; }
    close() { this.open = false; this.handlers.close?.(); }
}

const ids = Object.fromEntries(["gameCanvas", "hudMenu", "openHudMenu", "closeHudMenu", "viewerPeek", "openViewerPeek",
    "closeViewerPeek", "hudShield", "hudDocuments", "hudCampaignName", "hudCampaignNotes",
    "hudCampaignLink", "hudCharacterList", "hudCharacterEmpty"].map((id) => [id, new Element()]));
const navButtons = ["shield", "documents"].map((name) => {
    const button = new Element(); button.dataset.hudSection = name; return button;
});
ids.hudShield.hidden = ids.hudDocuments.hidden = ids.viewerPeek.hidden = true;
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
    createElement: () => new Element(),
    querySelectorAll: () => navButtons,
    querySelector: () => modalActive ? {} : null,
    addEventListener(type, fn) { documentHandlers[type] = fn; }
};
const window = {
    matchMedia: () => ({ matches: mobile }),
    addEventListener(type, fn) { windowHandlers[type] = fn; }
};
const library = { campaigns: [{ id: "camp-1", name: "Caso Sombrio", notes: "Pista secreta", characters: ["char-1"] }],
    characters: [{ id: "char-1", name: "Lia", player: "Ana" }, { id: "char-2", name: "Outra" }] };
const localStorage = { getItem: () => JSON.stringify(library) };
vm.runInNewContext(script, { document, window, localStorage, location: { search: "?campaign=camp-1" }, URLSearchParams,
    encodeURIComponent });

ids.openHudMenu.handlers.click();
assert.equal(ids.hudMenu.open, true);
assert.equal(ids.hudCampaignName.textContent, "Caso Sombrio");
assert.equal(ids.hudCharacterList.children.length, 1);
assert.equal(ids.hudCharacterList.children[0].children[0].href, "personagem.html?id=char-1");
navButtons[0].handlers.click();
assert.equal(ids.hudShield.hidden, false);
assert.equal(ids.hudDocuments.hidden, true);
navButtons[1].handlers.click();
assert.equal(ids.hudShield.hidden, true);
assert.equal(ids.hudDocuments.hidden, false);
assert.equal(ids.hudCampaignNotes.textContent, "Pista secreta");
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
modalActive = false; document.activeElement = navButtons[0];
windowHandlers.keydown(tab);
assert.equal(blocked, false);
mobile = true;
ids.openViewerPeek.handlers.click();
assert.equal(ids.viewerPeek.hidden, false);
ids.closeViewerPeek.handlers.click();
assert.equal(ids.viewerPeek.hidden, true);
console.log("HUD da mesa: menu, fichas, documentos, Tab e botão móvel: OK");
