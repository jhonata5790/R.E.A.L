(function (scope) {
    function parseDamage(value) {
        const match = /^(\d{1,3})d(\d{1,4})(?:\s*([+-])\s*(\d{1,4}))?$/i.exec(String(value).trim());
        if (!match) return null;
        const count = Number(match[1]), sides = Number(match[2]);
        if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
        return { count, sides, bonus: match[3] ? Number(match[4]) * (match[3] === "-" ? -1 : 1) : 0 };
    }
    function parseCritical(value) {
        const match = /^(?:(\d{1,2})(?:\/x(\d))?|x(\d))$/i.exec(String(value).trim());
        if (!match) return null;
        const threshold = match[1] ? Number(match[1]) : 20;
        const multiplier = Number(match[2] || match[3] || 2);
        return threshold >= 1 && threshold <= 20 && multiplier >= 2 && multiplier <= 5 ? { threshold, multiplier } : null;
    }
    function rollTest(attribute, random = Math.random) {
        if (!Number.isInteger(attribute) || attribute < -100 || attribute > 100) return null;
        const useLowest = attribute <= 0;
        const count = attribute > 0 ? attribute : attribute === 0 ? 2 : 1 - attribute;
        const dice = Array.from({ length: count }, () => Math.floor(random() * 20) + 1);
        const chosenIndex = dice.indexOf(useLowest ? Math.min(...dice) : Math.max(...dice));
        return { dice, chosenIndex, useLowest };
    }
    function rollDamage(base, extra, multiplier, bonus, random = Math.random) {
        if (!base || !Number.isInteger(multiplier) || multiplier < 1 || multiplier > 6 || !Number.isFinite(bonus)) return null;
        const dice = Array.from({ length: base.count * multiplier }, () => Math.floor(random() * base.sides) + 1);
        const extraDice = extra ? Array.from({ length: extra.count }, () => Math.floor(random() * extra.sides) + 1) : [];
        const fixed = base.bonus + (extra?.bonus || 0) + bonus;
        return { dice, extraDice, fixed, total: Math.max(0, [...dice, ...extraDice].reduce((sum, die) => sum + die, fixed)) };
    }
    function slot(item) {
        if (item?.category === "armas") return "equippedWeaponId";
        if (item?.category !== "protecao") return null;
        return item.protectionKind === "shield" || item.catalogId === "escudo" || item.name?.toLocaleLowerCase("pt-BR") === "escudo" ? "equippedShieldId" : "equippedArmorId";
    }
    function isHeavy(item) { return item?.catalogId === "protecao-pesada"; }
    function twoHands(weapon, lutaTraining = 0) {
        if (!weapon) return false;
        if (weapon.combat?.hands === "one") return false;
        if (weapon.combat?.hands === "two") return true;
        if (weapon.catalogId === "katana" && lutaTraining >= 10) return false;
        return weapon.hands === "Duas Mãos";
    }
    function defaults(weapon) {
        const ranged = weapon.weaponStyle === "Arma de Disparo" || weapon.weaponStyle === "Arma de Fogo";
        const variants = String(weapon.damage || "").split("/");
        const useTwoHands = weapon.combat?.hands === "two" || (weapon.combat?.hands !== "one" && weapon.hands === "Duas Mãos");
        return { skill: ranged ? "pontaria" : "luta", attribute: "skill", damage: variants[useTwoHands ? 1 : 0] || variants[0], critical: String(weapon.critical || "20"),
            damageAttribute: !ranged || weapon.catalogId === "arco-composto" ? "forca" : "none", attackBonus: 0, damageBonus: 0, extraDamage: "", hands: "auto" };
    }
    scope.REAL_EQUIPMENT_RULES = Object.freeze({ parseDamage, parseCritical, rollTest, rollDamage, slot, isHeavy, twoHands, defaults });
})(typeof window !== "undefined" ? window : globalThis);
