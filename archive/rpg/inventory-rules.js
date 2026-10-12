// Patentes, limites de categoria e carga do livro básico.
(function (scope) {
    "use strict";

    const PATENTS = Object.freeze([
        Object.freeze({ id: "recruta", name: "Recruta", prestige: 0, credit: "Baixo", limits: Object.freeze({ 1: 2, 2: 0, 3: 0, 4: 0 }) }),
        Object.freeze({ id: "operador", name: "Operador", prestige: 20, credit: "Médio", limits: Object.freeze({ 1: 3, 2: 1, 3: 0, 4: 0 }) }),
        Object.freeze({ id: "agente-especial", name: "Agente especial", prestige: 50, credit: "Médio", limits: Object.freeze({ 1: 3, 2: 2, 3: 1, 4: 0 }) }),
        Object.freeze({ id: "oficial-de-operacoes", name: "Oficial de operações", prestige: 100, credit: "Alto", limits: Object.freeze({ 1: 3, 2: 3, 3: 2, 4: 1 }) }),
        Object.freeze({ id: "agente-de-elite", name: "Agente de elite", prestige: 200, credit: "Ilimitado", limits: Object.freeze({ 1: 3, 2: 3, 3: 3, 4: 2 }) })
    ]);

    function clampPrestige(value) {
        return Number.isInteger(value) ? Math.max(0, Math.min(999999, value)) : 0;
    }

    function patent(value) {
        return PATENTS.find((item) => item.id === value) || PATENTS[0];
    }

    function patentForPrestige(value) {
        const points = clampPrestige(value);
        return [...PATENTS].reverse().find((item) => points >= item.prestige) || PATENTS[0];
    }

    function categoryOf(item) {
        const value = item?.category === "armas" ? item.weaponCategory : item?.itemCategory;
        return Number.isInteger(value) && value >= 0 && value <= 4 ? value : null;
    }

    function spaceOf(item) {
        return Number.isFinite(item?.space) ? item.space : 0;
    }

    function baseCapacity(strength) {
        return Number.isInteger(strength) && strength > 0 ? strength * 5 : 2;
    }

    function calculate({ items = [], patentId = "recruta", prestige = null, strength = 0, categoryBonuses = {}, loadBonus = 0 }) {
        const selected = prestige === null ? patent(patentId) : patentForPrestige(prestige);
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        let categoryZero = 0;
        let unknownCategory = 0;
        let unknownSpace = 0;
        let used = 0;
        for (const item of Array.isArray(items) ? items : []) {
            const category = categoryOf(item);
            if (category === 0) categoryZero++;
            else if (category) counts[category]++;
            else unknownCategory++;
            if (Number.isFinite(item?.space)) used += spaceOf(item);
            else unknownSpace++;
        }
        used = Math.max(0, used);
        const capacity = Math.max(0, baseCapacity(strength) + (Number.isInteger(loadBonus) ? loadBonus : 0));
        const limits = Object.fromEntries([1, 2, 3, 4].map((category) => [category,
            selected.limits[category] + (Number.isInteger(categoryBonuses[category]) ? Math.max(0, categoryBonuses[category]) : 0)]));
        const excess = Object.fromEntries([1, 2, 3, 4].map((category) => [category, Math.max(0, counts[category] - limits[category])]));
        return Object.freeze({ patent: selected, counts: Object.freeze(counts), limits: Object.freeze(limits), excess: Object.freeze(excess),
            categoryZero, unknownCategory, unknownSpace, used, capacity, overloaded: used > capacity, immobile: used > capacity * 2 });
    }

    const api = Object.freeze({ PATENTS, clampPrestige, patent, patentForPrestige, categoryOf, spaceOf, baseCapacity, calculate });
    (scope.window || scope).REAL_INVENTORY_RULES = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
