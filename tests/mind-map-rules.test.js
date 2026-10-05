const assert = require("node:assert/strict");
const rules = require("../mind-map-rules.js");

const notes = [
    { id: "a", shape: "square", x: 20, y: 30, text: "Suspeito\nViu a criatura" },
    { id: "b", shape: "circle", x: 300, y: 100, text: "Local do ritual" }
];

assert.deepEqual(rules.center(notes[0]), { x: 100, y: 110 });
assert.equal(rules.title(notes[0]), "Suspeito");
assert.equal(rules.title({ text: "" }), "Ideia sem título");

const added = rules.addConnection([], notes, "a", "b", "ligacao-1");
assert.equal(added.added, true);
assert.equal(added.connections.length, 1);
assert.equal(added.connections[0].relation, "related");
const duplicate = rules.addConnection(added.connections, notes, "b", "a", "ligacao-2");
assert.equal(duplicate.added, false, "a mesma ligação invertida não é duplicada");
assert.equal(duplicate.connections.length, 1);
assert.equal(rules.addConnection([], notes, "a", "a", "ligacao-3").added, false);

assert.deepEqual(rules.normalizeConnections([
    ...added.connections,
    { id: "invalida", from: "a", to: "ausente" },
    { id: "duplicada", from: "b", to: "a" }
], notes), added.connections);
assert.equal(rules.addConnection([], notes, "a", "b", "ligacao-4", "contradicts").connections[0].relation, "contradicts");
assert.equal(rules.matches({ kind: "person", text: "Arthur Cervero" }, "pessoa"), true);
assert.equal(rules.matches({ kind: "clue", text: "Símbolo no chão" }, "simbolo"), true);
assert.equal(rules.matches({ kind: "place", text: "Mansão" }, "ritual"), false);
assert.deepEqual(rules.bounds(notes), { x: 0, y: 0, width: 530, height: 320 });
assert.deepEqual(rules.layout(notes, added.connections, "a"), { a: { x: 60, y: 55 }, b: { x: 360, y: 55 } });

console.log("Mapa mental: formas, geometria, títulos, conexões e duplicatas: OK");
