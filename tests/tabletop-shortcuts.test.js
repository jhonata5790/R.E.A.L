const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const rules = require("../assets/js/tabletop/tabletop-shortcuts.js");
const root = path.join(__dirname, "..");

assert.equal(rules.command({ key: " ", repeat: true }), null);
assert.equal(rules.command({ key: " ", isComposing: true }), null);
assert.equal(rules.command({ key: "z", metaKey: true, shiftKey: true }), "redo");
assert.equal(rules.command({ key: "H", shiftKey: true }), "toggle-hud");
assert.equal(rules.command({ key: "?", shiftKey: true }), "help");
assert.equal(rules.command({ key: "g", altKey: true }), null);
const rotated = rules.bounds([{ x: 10, y: 20, width: 100, height: 20, rotation: Math.PI / 2 }]);
assert.ok(Math.abs(rotated.width - 20) < .0001);
assert.ok(Math.abs(rotated.height - 100) < .0001);
const history = rules.createHistory((a, b) => a === b, 2);
history.reset(0); history.record(1); history.record(2); history.record(3);
assert.equal(history.undo(), 2);
assert.equal(history.undo(), 1);
assert.equal(history.undo(), null, "o histórico respeita o limite");
assert.equal(history.redo(), 2);
history.record(7);
assert.equal(history.redo(), null, "uma alteração nova descarta o futuro antigo");
assert.equal(history.record(7), false, "não adiciona passos vazios");

class Element {
    constructor(id = "") {
        this.id = id; this.hidden = false; this.open = false; this.style = {};
        this.value = ""; this.children = []; this.handlers = {}; this.dataset = {};
        this.classList = { toggle() {}, add() {}, remove() {} };
    }
    addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
    dispatch(name, event = {}) { for (const fn of this.handlers[name] || []) fn({ target: this, preventDefault() {}, ...event }); }
    append(...items) { this.children.push(...items); }
    appendChild(item) { this.children.push(item); }
    replaceChildren(...items) { this.children = items; }
    setAttribute() {}
    contains(target) { return target === this; }
    closest() { return null; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch("close"); }
    getContext() { return { setTransform() {} }; }
}

const html = fs.readFileSync(path.join(root, "mesa.html"), "utf8");
const ids = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map((match) => [match[1], new Element(match[1])]));
for (const id of ["gridPanel", "tokenPanel", "sessionPanel", "playerViewPanel"]) ids[id].hidden = true;
const documentEvents = {};
const document = {
    body: new Element(), visibilityState: "visible", activeElement: ids.gameCanvas,
    getElementById(id) { assert.ok(ids[id], `elemento ${id} existe na página`); return ids[id]; },
    createElement: () => new Element(), querySelectorAll: () => [],
    querySelector(selector) {
        if (selector === ".campaign-return") return new Element();
        if (selector === "dialog[open]") return Object.values(ids).find((node) => node.open) || null;
        if (selector === ".settings-panel:not([hidden])") return ["gridPanel", "tokenPanel", "sessionPanel", "playerViewPanel"].map((id) => ids[id]).find((node) => !node.hidden) || null;
        return null;
    },
    addEventListener(name, fn) { (documentEvents[name] ||= []).push(fn); }
};
const windowEvents = {};
const window = {
    innerWidth: 1000, innerHeight: 800, devicePixelRatio: 1,
    addEventListener(name, fn) { (windowEvents[name] ||= []).push(fn); },
    dispatchEvent() {}, confirm: () => true
};
const stored = new Map();
const database = {
    createObjectStore() {},
    transaction() {
        const tx = { objectStore() { return {
            get(key) { const request = { result: stored.get(key) }; queueMicrotask(() => request.onsuccess?.()); return request; },
            put(value, key) { stored.set(key, value); queueMicrotask(() => tx.oncomplete?.()); }
        }; } };
        return tx;
    }
};
class FakeImage {
    constructor() { this.width = 100; this.height = 100; }
    set src(value) { this.source = value; queueMicrotask(() => this.onload?.()); }
}
const context = vm.createContext({ document, window, Image: FakeImage, URLSearchParams, Event,
    location: { search: "?table=test" }, performance: { now: () => 0 },
    indexedDB: { open() { const request = { result: database }; queueMicrotask(() => request.onsuccess?.()); return request; } },
    requestAnimationFrame() {}, setTimeout() { return 1; }, clearTimeout() {}, console
});
for (const name of ["tabletop-view.js", "tabletop-selection.js", "tabletop-shortcuts.js", "tabletop.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "assets/js/tabletop", name), "utf8"), context);
}
const read = (expression) => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
const run = (expression) => vm.runInContext(expression, context);
const key = (name, options = {}) => {
    let prevented = false;
    const event = { key: name, target: ids.gameCanvas, shiftKey: false, ctrlKey: false, metaKey: false,
        preventDefault() { prevented = true; }, ...options };
    for (const fn of windowEvents.keydown) fn(event);
    return prevented;
};
const settle = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
    await window.REAL_TABLETOP_MASTER.ready;
    await run('createToken("data:image/png;base64,one", "Primeiro", { x: 0, y: 0, hp: 7, maxHp: 20, condition: "Ferido", rotation: .3 })');
    await run('createToken("data:image/png;base64,two", "Segundo", { x: 120, y: 60, width: 80, visibleToPlayers: false })');
    run("setTokenSelection(tokens, tokens[0]); sceneHistory.reset(captureSceneState()); updateHistoryUI()");

    const originalView = read("playerView");
    ids.gameCanvas.dispatch("mousemove", { clientX: 600, clientY: 450 });
    key(" ");
    assert.ok(read("Boolean(followingPlayer)"));
    assert.equal(read("playerView.x + playerView.width / 2"), 100);
    ids.gameCanvas.dispatch("mousemove", { clientX: 730, clientY: 480 });
    assert.equal(read("playerView.x + playerView.width / 2"), 230);
    key("Escape");
    assert.deepEqual(read("playerView"), originalView, "Esc restaura a visão anterior");
    assert.equal(read("Boolean(followingPlayer)"), false);
    key(" "); key(" ");
    assert.equal(read("Boolean(followingPlayer)"), false);
    const fixed = read("playerView");
    ids.gameCanvas.dispatch("mousemove", { clientX: 810, clientY: 550 });
    assert.deepEqual(read("playerView"), fixed, "a segunda pressão fixa a visão");
    key("z", { ctrlKey: true });
    assert.deepEqual(read("playerView"), originalView);
    key("z", { ctrlKey: true, shiftKey: true });
    assert.deepEqual(read("playerView"), fixed);

    key(" ", { shiftKey: true });
    const selectedRect = read("selectedBounds()");
    assert.ok(Math.abs(read("playerView.x + playerView.width / 2") - selectedRect.x) < .00001);
    key("f");
    assert.equal(read("camera.x"), -selectedRect.x);
    run("setTokenSelection([]); Object.assign(mapState, { loaded: true, x: 300, y: 400, scale: 2 })");
    key("f");
    assert.equal(read("camera.x"), -300, "sem seleção enquadra o mapa");
    assert.equal(read("camera.y"), -400);
    run("Object.assign(camera, { x: 0, y: 0, zoom: 1 }); setTokenSelection(tokens, tokens[0]); scheduleSave()");

    key("g"); assert.equal(read("gridSettings.visible"), true);
    key("g", { shiftKey: true }); assert.equal(read("gridSettings.snapTokens"), true);
    ids.gameCanvas.dispatch("mousedown", { button: 0, clientX: 500, clientY: 400 });
    ids.gameCanvas.dispatch("mousemove", { clientX: 533, clientY: 414 });
    ids.gameCanvas.dispatch("mouseup", { button: 0 });
    assert.deepEqual(read("tokens.map(({ x, y }) => ({ x, y }))"), [{ x: 50, y: 0 }, { x: 170, y: 60 }]);
    key("z", { ctrlKey: true });
    assert.deepEqual(read("tokens.map(({ x, y }) => ({ x, y }))"), [{ x: 0, y: 0 }, { x: 120, y: 60 }], "um desfazer restaura o grupo inteiro");
    key("z", { ctrlKey: true, shiftKey: true });
    assert.equal(read("tokens[0].x"), 50);

    run("setTokenSelection(tokens, tokens[0])");
    key("h"); assert.deepEqual(read("tokens.map(t => t.visibleToPlayers)"), [false, false]);
    key("h"); assert.deepEqual(read("tokens.map(t => t.visibleToPlayers)"), [true, true]);
    key("c", { ctrlKey: true });
    ids.gameCanvas.dispatch("mousemove", { clientX: 820, clientY: 610 });
    key("v", { ctrlKey: true }); await settle();
    assert.equal(read("tokens.length"), 4);
    assert.equal(read("tokens[2].hp"), 7);
    assert.equal(read("tokens[2].rotation"), .3);
    assert.equal(read("tokens[2].condition"), "Ferido");
    assert.equal(read("tokens[3].x - tokens[2].x"), 120);
    assert.equal(read("new Set(tokens.map(t => t.id)).size"), 4);
    key("z", { ctrlKey: true }); assert.equal(read("tokens.length"), 2, "colar grupo gera só um passo");
    key("z", { ctrlKey: true, shiftKey: true }); assert.equal(read("tokens.length"), 4);
    key("Delete"); assert.equal(read("tokens.length"), 2);
    key("z", { ctrlKey: true }); assert.equal(read("tokens.length"), 4, "exclusão recuperável");
    key("g"); assert.equal(read("sceneHistory.canRedo"), false);

    run("setTokenSelection([tokens[0]], tokens[0])");
    const rotationBefore = read("tokens[0].rotation");
    let control = read("getTokenControls(tokens[0]).rotation");
    const transform = read("getTokenTransform(tokens[0])");
    ids.gameCanvas.dispatch("mousedown", { button: 0, clientX: control.x, clientY: control.y });
    assert.equal(read("interaction.type"), "rotate");
    ids.gameCanvas.dispatch("mousemove", { clientX: transform.x + 70, clientY: transform.y });
    ids.gameCanvas.dispatch("mouseup", { button: 0 });
    assert.notEqual(read("tokens[0].rotation"), rotationBefore);
    key("z", { ctrlKey: true }); assert.equal(read("tokens[0].rotation"), rotationBefore);
    run("setTokenSelection([tokens[0]], tokens[0])");
    const widthBefore = read("tokens[0].width");
    control = read("getTokenControls(tokens[0]).resize");
    ids.gameCanvas.dispatch("mousedown", { button: 0, clientX: control.x, clientY: control.y });
    assert.equal(read("interaction.type"), "resize");
    ids.gameCanvas.dispatch("mousemove", { clientX: control.x + 40, clientY: control.y - 40 });
    ids.gameCanvas.dispatch("mouseup", { button: 0 });
    assert.notEqual(read("tokens[0].width"), widthBefore);
    key("z", { ctrlKey: true }); assert.equal(read("tokens[0].width"), widthBefore);
    await run('setMapSource("data:image/png;base64,map", "Mapa de teste")');
    run("clearMap()");
    assert.equal(read("mapState.loaded"), false);
    key("z", { ctrlKey: true });
    assert.equal(read("mapState.loaded"), true);
    assert.equal(read("mapState.name"), "Mapa de teste", "desfazer recupera o mapa e a imagem");

    const cameraBefore = read("camera");
    let middlePrevented = false;
    ids.gameCanvas.dispatch("mousedown", { button: 1, clientX: 400, clientY: 300, preventDefault() { middlePrevented = true; } });
    ids.gameCanvas.dispatch("mousemove", { clientX: 460, clientY: 350 });
    ids.gameCanvas.dispatch("mouseup", { button: 1 });
    assert.equal(middlePrevented, true);
    assert.equal(read("interaction.type"), null);
    assert.equal(read("camera.x"), cameraBefore.x + 60 / cameraBefore.zoom);
    key("z", { ctrlKey: true }); assert.deepEqual(read("camera"), cameraBefore);

    key("r"); assert.equal(read("activeMode"), "ruler");
    key("Escape"); assert.equal(read("activeMode"), "select");
    const gridBefore = read("gridSettings.visible");
    const typing = { closest: () => ({}) };
    assert.equal(key("g", { target: typing }), false);
    assert.equal(read("gridSettings.visible"), gridBefore);
    ids.gridPanel.hidden = false;
    assert.equal(key("g"), false);
    key("Escape"); assert.equal(ids.gridPanel.hidden, true);
    ids.hudMenu.open = true;
    assert.equal(key("Delete"), false);
    ids.hudMenu.open = false;
    key("?", { shiftKey: true }); assert.equal(ids.shortcutHelp.open, true);
    assert.equal(key(" "), false);
    ids.shortcutHelp.close();
    key("h", { shiftKey: true }); assert.equal(read("hudVisible"), false);
    key("h", { shiftKey: true }); assert.equal(read("hudVisible"), true);
    key(" ");
    for (const fn of windowEvents.blur) fn();
    assert.equal(read("Boolean(followingPlayer)"), false, "trocar de janela cancela o modo de câmera");
    console.log("Atalhos: câmera do jogador, enquadramento, grade, cópia, histórico, foco e botão do meio: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
