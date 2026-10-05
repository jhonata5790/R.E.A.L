const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const catalog = require("../ability-catalog.js");
const rules = require("../progression-rules.js");

assert.deepEqual(rules.TRAIL_MILESTONES, [10, 40, 65, 99]);
for (const classId of rules.CLASS_IDS) assert.equal(rules.trails(catalog.catalog, classId).length, 5);
assert.deepEqual(rules.trails(catalog.catalog, "mundano"), []);
assert.equal(rules.normalizeTrail(catalog.catalog, "especialista", "infiltrador"), "Infiltrador");
assert.equal(rules.normalizeTrail(catalog.catalog, "especialista", "Guerreiro"), "");

assert.deepEqual(rules.classAbilities(catalog.catalog, "combatente", 5).map((item) => item.name), ["Ataque Especial"]);
assert.deepEqual(rules.classAbilities(catalog.catalog, "especialista", 5).map((item) => item.name), ["Eclético", "Perito"]);
assert.deepEqual(rules.classAbilities(catalog.catalog, "especialista", 40).map((item) => item.name), ["Eclético", "Perito", "Engenhosidade"]);
assert.deepEqual(rules.classAbilities(catalog.catalog, "ocultista", 5).map((item) => item.name), ["Escolhido pelo Outro Lado"]);

assert.deepEqual(rules.trailAbilities(catalog.catalog, "especialista", "Infiltrador", 9), []);
assert.deepEqual(rules.trailAbilities(catalog.catalog, "especialista", "Infiltrador", 10).map((item) => item.name), ["Ataque Furtivo"]);
assert.deepEqual(rules.trailAbilities(catalog.catalog, "especialista", "Infiltrador", 65).map((item) => item.name), ["Ataque Furtivo", "Gatuno", "Assassinar"]);
assert.deepEqual(rules.trailTimeline(catalog.catalog, "especialista", "Infiltrador", 40).map(({ minNex, unlocked }) => [minNex, unlocked]), [[10, true], [40, true], [65, false], [99, false]]);

const automatic = rules.automaticAbilities({ catalog: catalog.catalog, classId: "especialista", trail: "Infiltrador", nex: 40 });
assert.deepEqual(automatic.map((item) => item.name), ["Eclético", "Perito", "Engenhosidade", "Ataque Furtivo", "Gatuno"]);
assert.deepEqual(automatic.map((item) => item.progressionSource), ["class", "class", "class", "trail", "trail"]);
assert.equal(rules.ritualCircle("ocultista", 5), 1);
assert.equal(rules.ritualCircle("ocultista", 25), 2);
assert.equal(rules.ritualCircle("ocultista", 55), 3);
assert.equal(rules.ritualCircle("ocultista", 85), 4);
assert.equal(rules.ritualCircle("especialista", 40, 1), 1);
assert.equal(rules.ritualCircle("especialista", 45, 1), 2);
assert.equal(rules.ritualCircle("especialista", 75, 1), 3);
assert.equal(rules.ritualCircle("especialista", 99, 0), 0);
assert.equal(rules.occultistRitualsKnown(5), 3);
assert.equal(rules.occultistRitualsKnown(25), 7);
assert.equal(rules.occultistRitualsKnown(99), 22);
assert.deepEqual(rules.progressionChoices(14).powerMilestones, []);
assert.deepEqual(rules.progressionChoices(45).powerMilestones, [15, 30, 45]);
assert.equal(rules.progressionChoices(50).powerSlots, 3);
assert.equal(rules.progressionChoices(50, "power").powerSlots, 4);
assert.deepEqual(rules.progressionChoices(99).attributeMilestones, [20, 50, 80, 95]);
assert.deepEqual(rules.progressionChoices(99).trainingMilestones, [35, 70]);
assert.deepEqual(rules.nextChoiceMilestone(14), { nex: 15, label: "Poder de classe" });
assert.equal(rules.nextChoiceMilestone(99), null);

const html = fs.readFileSync(path.join(__dirname, "..", "personagem.html"), "utf8");
assert.match(html, /id="trailSelect"/);
assert.match(html, /id="trailTimeline"/);
assert.match(html, /progression-rules\.js\?v=20261003-progression/);

console.log("Progressão por NEX: classes, trilhas e marcos automáticos: OK");
