// Efeitos incondicionais e dados conferidos no C.R.I.S.; não interpreta descrições.
(function (scope) {
    function effects({ entries = [], catalog = [], originAbility = "", level = 1, enabled = true }) {
        const result = { resources: { vida: 0, esforco: 0, sanidade: 0 }, skills: {}, defense: 0,
            meleeDie: 0, meleeDamage: 0, firearmDamage: 0, rangedAgility: false,
            criticalMargin: 0, criticalMultiplier: 0, ritualIntellect: false, perTurn: 0, applied: [] };
        if (!enabled) return result;
        const known = new Map();
        if (originAbility) known.set(originAbility, false);
        for (const entry of entries) {
            const source = catalog.find(item => item.id === entry?.abilityCatalogId);
            if (source) known.set(source.name, Boolean(known.get(source.name) || entry.affinity));
        }
        const skill = (id, bonus) => { result.skills[id] = (result.skills[id] || 0) + bonus; };
        const resistance = bonus => ["fortitude", "reflexos", "vontade"].forEach(id => skill(id, bonus));
        for (const [name, affinity] of known) {
            switch (name) {
                case "Calejado": result.resources.vida += level; break;
                case "Cicatrizes Psicológicas": result.resources.sanidade += level; break;
                case "Dedicação": result.resources.esforco += Math.ceil(level / 2); result.perTurn++; break;
                case "Sangue de Ferro": result.resources.vida += 2 * level; if (affinity) skill("fortitude", 5); break;
                case "Potencial Aprimorado": result.resources.esforco += level * (affinity ? 2 : 1); break;
                case "Reflexos Defensivos": case "Precognição": result.defense += 2; resistance(2); break;
                case "Patrulha": result.defense += 2; break;
                case "Sensitivo": ["diplomacia", "intimidacao", "intuicao"].forEach(id => skill(id, 5)); break;
                case "Visão do Oculto": skill("percepcao", 5); break;
                case "Golpe Pesado": result.meleeDie = 1; break;
                case "Mão Pesada": result.meleeDamage += 2; break;
                case "Para Bellum": result.firearmDamage += 2; break;
                case "Tiro Certeiro": result.rangedAgility = true; break;
                case "Golpe de Sorte": result.criticalMargin++; if (affinity) result.criticalMultiplier++; break;
                case "Ritual Potente": result.ritualIntellect = true; break;
                default: continue;
            }
            result.applied.push(name + (affinity ? " (Afinidade)" : ""));
        }
        return result;
    }

    // Rolagem livre soma dados. Testes de atributo usam rollTest de equipment-rules.
    function rollExpression(expression, bonus = 0, random = Math.random) {
        const clean = String(expression).replace(/\s/g, "").toLowerCase();
        if (!clean || clean.length > 120 || !Number.isFinite(bonus)) return null;
        const tokens = clean.match(/[+-]?(?:\d{1,3}d\d{1,4}|\d{1,6})/g);
        if (!tokens || tokens.join("") !== clean || tokens.length > 12) return null;
        const terms = []; let count = 0; let total = bonus;
        for (const token of tokens) {
            const sign = token.startsWith("-") ? -1 : 1;
            const raw = token.replace(/^[+-]/, "");
            if (raw.includes("d")) {
                const [amount, sides] = raw.split("d").map(Number);
                count += amount;
                if (amount < 1 || count > 500 || sides < 2 || sides > 1000) return null;
                terms.push({ sign, amount, sides });
            } else {
                const value = Number(raw) * sign;
                total += value; terms.push({ value });
            }
        }
        if (!count) return null;
        const details = terms.map(term => {
            if (term.value !== undefined) return `${term.value >= 0 ? "+" : ""}${term.value}`;
            const dice = Array.from({ length: term.amount }, () => Math.floor(random() * term.sides) + 1);
            total += term.sign * dice.reduce((sum, die) => sum + die, 0);
            return `${term.sign < 0 ? "−" : "+"}${term.amount}d${term.sides}: [${dice.join(", ")}]`;
        });
        return { total, details: details.join(" · "), bonus, expression: clean };
    }

    const ritualDice = Object.freeze({
        "Cicatrização": Object.freeze({ normal: "3d8+3", discente: "5d8+5", verdadeiro: "7d8+7", kind: "Cura" }),
        "Eletrocussão": Object.freeze({ normal: "3d6", discente: "6d6", verdadeiro: "8d6", kind: "Dano" }),
        "Descarnar": Object.freeze({ normal: "6d8", discente: "10d8", kind: "Dano imediato" }),
        "Decadência": Object.freeze({ normal: "2d8+2", discente: "3d8+3", verdadeiro: "8d8+8", kind: "Dano do ritual (sem arma)" }),
        "Paradoxo": Object.freeze({ normal: "6d6", discente: "4d6", verdadeiro: "13d6", kind: "Dano" }),
        "Miasma Entrópico": Object.freeze({ normal: "4d8", discente: "6d8", verdadeiro: "4d8", kind: "Dano" }),
        "Poeira da Podridão": Object.freeze({ normal: "4d8", verdadeiro: "4d8+16", kind: "Dano" })
    });
    const api = Object.freeze({ effects, rollExpression, ritualDice });
    scope.REAL_SHEET_MECHANICS = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
