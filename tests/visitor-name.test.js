const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
for (const page of ["index.html", "ficha.html", "personagem.html", "mesa.html", "mesa-jogador.html"]) {
    const html = read(page);
    assert.match(html, /visitor-name\.css\?v=/, `${page}: estilo do nome`);
    assert.match(html, /visitor-name\.js\?v=/, `${page}: entrada direta pede nome`);
}

const saved = new Map();
function loadIdentity() {
    const listeners = {};
    const classes = new Set();
    const input = { value: "", setCustomValidity() {}, reportValidity() {} };
    const form = { addEventListener(type, fn) { listeners[`form:${type}`] = fn; } };
    const dialog = {
        opened: false, setAttribute() {}, showModal() { this.opened = true; }, close() { this.opened = false; },
        querySelector(selector) { return selector === "input" ? input : form; },
        addEventListener(type, fn) { listeners[`dialog:${type}`] = fn; }
    };
    input.focus = () => {};
    input.addEventListener = (type, fn) => { listeners[`input:${type}`] = fn; };
    const body = { children: [], appendChild(item) { this.children.push(item); },
        classList: { add(value) { classes.add(value); }, remove(value) { classes.delete(value); } } };
    const document = { readyState: "complete", body,
        createElement(tag) { return tag === "dialog" ? dialog : { addEventListener() {}, textContent: "" }; } };
    const window = { dispatchEvent(event) { listeners.lastEvent = event; } };
    const localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
    vm.runInNewContext(read("visitor-name.js"), { document, window, localStorage,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
    return { window, input, dialog, listeners, classes };
}

(async () => {
    const first = loadIdentity();
    assert.equal(first.dialog.opened, true);
    assert.equal(first.classes.has("real-visitor-required"), true);
    first.input.value = "  Ana   Maria  ";
    first.listeners["form:submit"]({ preventDefault() {} });
    assert.equal(saved.get("real:visitor-name"), "Ana Maria");
    assert.equal(await first.window.REAL_VISITOR_NAME.ready, "Ana Maria");
    assert.equal(first.dialog.opened, false);
    assert.equal(first.listeners.lastEvent.detail.name, "Ana Maria");
    const returnVisit = loadIdentity();
    assert.equal(returnVisit.dialog.opened, false);
    assert.equal(await returnVisit.window.REAL_VISITOR_NAME.ready, "Ana Maria");
    console.log("Nome local: entrada direta, solicitação inicial e retorno: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
