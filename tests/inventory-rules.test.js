const assert = require("node:assert/strict");
const rules = require("../inventory-rules.js");

assert.equal(rules.PATENTS.length, 5);
assert.deepEqual(rules.PATENTS.map((item) => [item.prestige, item.name, item.credit, Object.values(item.limits)]), [
    [0, "Recruta", "Baixo", [2, 0, 0, 0]],
    [20, "Operador", "Médio", [3, 1, 0, 0]],
    [50, "Agente especial", "Médio", [3, 2, 1, 0]],
    [100, "Oficial de operações", "Alto", [3, 3, 2, 1]],
    [200, "Agente de elite", "Ilimitado", [3, 3, 3, 2]]
]);
assert.equal(rules.patentForPrestige(49).id, "operador");
assert.equal(rules.patentForPrestige(200).id, "agente-de-elite");
assert.equal(rules.baseCapacity(0), 2);
assert.equal(rules.baseCapacity(3), 15);

const result = rules.calculate({
    prestige: 20,
    strength: 1,
    items: [
        { category: "armas", weaponCategory: 1, space: 2 },
        { category: "geral", itemCategory: 1, space: 1 },
        { category: "geral", itemCategory: 1, space: 1 },
        { category: "amaldicoados", itemCategory: 2, space: 1 },
        { category: "geral", itemCategory: 0, space: 1 },
        { category: "geral", itemCategory: 0, space: -2 },
        { category: "itens", name: "Legado sem dados" }
    ]
});
assert.equal(result.patent.id, "operador");
assert.deepEqual(result.counts, { 1: 3, 2: 1, 3: 0, 4: 0 });
assert.deepEqual(result.excess, { 1: 0, 2: 0, 3: 0, 4: 0 });
assert.equal(result.categoryZero, 2);
assert.equal(result.unknownCategory, 1);
assert.equal(result.unknownSpace, 1);
assert.equal(result.used, 4);
assert.equal(result.capacity, 5);
assert.equal(result.overloaded, false);

const overloaded = rules.calculate({ prestige: 0, strength: 0, items: [{ category: "armas", weaponCategory: 3, space: 5 }] });
assert.equal(overloaded.excess[3], 1);
assert.equal(overloaded.overloaded, true);
assert.equal(overloaded.immobile, true);
const adjusted = rules.calculate({ prestige: 0, strength: 0, categoryBonuses: { 3: 1 }, loadBonus: 3, items: [{ category: "armas", weaponCategory: 3, space: 5 }] });
assert.equal(adjusted.excess[3], 0);
assert.equal(adjusted.overloaded, false);

console.log("Inventário: patentes, categorias, crédito, carga e ajustes: OK");
