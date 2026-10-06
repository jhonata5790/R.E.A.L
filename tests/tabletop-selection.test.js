const assert = require("node:assert/strict");
const rules = require("../tabletop-selection.js");

const tokens = [
    { id: 1, x: 40, y: 60 },
    { id: 2, x: 120, y: 140 },
    { id: 3, x: 300, y: 300 }
];

assert.deepEqual(rules.validIds(tokens, [3, 2, 2, 99]), [3, 2]);
assert.deepEqual(rules.validIds(tokens, null, 1), [1]);
assert.deepEqual(rules.toggle([1, 2], 2), [1]);
assert.deepEqual(rules.toggle([1], 3), [1, 3]);
assert.deepEqual(rules.rectangleIds(tokens, { x: 150, y: 160 }, { x: 20, y: 30 }), [1, 2]);
assert.deepEqual(rules.translatedPositions(tokens, [1, 2], 15, -10), {
    1: { x: 55, y: 50 },
    2: { x: 135, y: 130 }
});
assert.deepEqual(rules.snapDelta({ x: 113, y: 137 }, { size: 50, offsetX: 5, offsetY: -5 }), { x: -8, y: 8 });

console.log("Tabletop: seleção múltipla, caixa, deslocamento e encaixe em grupo: OK");
