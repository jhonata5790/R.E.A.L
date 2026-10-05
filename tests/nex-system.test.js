const assert = require("node:assert/strict");
const rules = require("../nex-rules.js");

assert.deepEqual(rules.allowedNex("mundano"), [0]);
assert.equal(rules.allowedNex("combatente")[0], 5);
assert.equal(rules.allowedNex("combatente").at(-1), 99);
assert.equal(rules.allowedNex("combatente").length, 20);
assert.equal(rules.normalizeNex("especialista", 0), 5);
assert.equal(rules.normalizeNex("mundano", 50), 0);
assert.equal(rules.calculate({ classId: "desconhecida", nex: 5 }), null);
assert.equal(rules.trainingMaximum("especialista", 5), 5);
assert.equal(rules.trainingMaximum("especialista", 35), 10);
assert.equal(rules.trainingMaximum("especialista", 70), 15);
assert.equal(rules.trainingMaximum("mundano", 0), 5);
assert.equal(rules.nextTrainingMilestone("combatente", 5), 35);
assert.equal(rules.nextTrainingMilestone("combatente", 35), 70);
assert.equal(rules.nextTrainingMilestone("combatente", 70), null);

const attributes = { vigor: 2, presenca: 3 };
for (const [classId, start, next] of [
    ["combatente", { vida: 22, esforco: 5, sanidade: 12 }, { vida: 28, esforco: 10, sanidade: 15 }],
    ["especialista", { vida: 18, esforco: 6, sanidade: 16 }, { vida: 23, esforco: 12, sanidade: 20 }],
    ["ocultista", { vida: 14, esforco: 7, sanidade: 20 }, { vida: 18, esforco: 14, sanidade: 25 }]
]) {
    const initial = rules.calculate({ classId, nex: 5, attributes });
    assert.deepEqual(initial.maxima, start, `${classId} em NEX 5%`);
    assert.equal(initial.level, 1);
    assert.equal(initial.pePerTurn, 1);
    const advanced = rules.calculate({ classId, nex: 10, attributes });
    assert.deepEqual(advanced.maxima, next, `${classId} em NEX 10%`);
    assert.equal(advanced.level, 2);
    assert.equal(advanced.pePerTurn, 2);
}

const maxed = rules.calculate({ classId: "ocultista", nex: 99, attributes });
assert.equal(maxed.level, 20);
assert.equal(maxed.pePerTurn, 20);
assert.deepEqual(maxed.maxima, { vida: 90, esforco: 140, sanidade: 115 });
assert.deepEqual(rules.calculate({ classId: "mundano", nex: 0, attributes }).maxima, { vida: 10, esforco: 4, sanidade: 8 });
assert.equal(rules.calculate({ classId: "mundano", nex: 0, attributes }).pePerTurn, 1);
assert.equal(rules.calculate({ classId: "ocultista", nex: 5, attributes, origin: "cultista-arrependido" }).maxima.sanidade, 10);
assert.equal(rules.calculate({ classId: "ocultista", nex: 10, attributes, origin: "cultista-arrependido" }).maxima.sanidade, 15);
assert.deepEqual(rules.calculate({ classId: "especialista", nex: 5, attributes, bonuses: { vida: 5, esforco: -2, sanidade: 3 } }).maxima,
    { vida: 23, esforco: 4, sanidade: 19 });
assert.equal(rules.clampBonus(2000), 999);
assert.equal(rules.clampBonus(-2000), -999);
console.log("NEX e recursos: classes, Mundano, Cultista, limites, PE por turno e ajustes: OK");
