// Progressão padrão de Ordem Paranormal RPG. Bônus automáticos conferidos
// e ajustes manuais são fornecidos separadamente pela ficha.
(function (scope) {
    const CLASSES = Object.freeze({
        combatente: Object.freeze({ start: { vida: 20, esforco: 2, sanidade: 12 }, gain: { vida: 4, esforco: 2, sanidade: 3 } }),
        especialista: Object.freeze({ start: { vida: 16, esforco: 3, sanidade: 16 }, gain: { vida: 3, esforco: 3, sanidade: 4 } }),
        ocultista: Object.freeze({ start: { vida: 12, esforco: 4, sanidade: 20 }, gain: { vida: 2, esforco: 4, sanidade: 5 } }),
        mundano: Object.freeze({ start: { vida: 8, esforco: 1, sanidade: 8 }, gain: { vida: 0, esforco: 0, sanidade: 0 } })
    });
    const AGENT_NEX = Object.freeze([...Array.from({ length: 19 }, (_, index) => (index + 1) * 5), 99]);
    const RESOURCES = Object.freeze(["vida", "esforco", "sanidade"]);

    function allowedNex(classId) {
        if (!CLASSES[classId]) return [];
        return classId === "mundano" ? [0] : AGENT_NEX;
    }

    function normalizeNex(classId, value) {
        const allowed = allowedNex(classId);
        return allowed.includes(value) ? value : (allowed[0] ?? null);
    }

    function clampBonus(value) {
        return Number.isInteger(value) ? Math.max(-999, Math.min(999, value)) : 0;
    }

    function trainingMaximum(classId, nex) {
        if (!CLASSES[classId]) return 15;
        if (classId === "mundano") return 5;
        const current = normalizeNex(classId, nex) || 5;
        return current >= 70 ? 15 : current >= 35 ? 10 : 5;
    }

    function nextTrainingMilestone(classId, nex) {
        if (!CLASSES[classId] || classId === "mundano") return null;
        const current = normalizeNex(classId, nex) || 5;
        return current < 35 ? 35 : current < 70 ? 70 : null;
    }

    function calculate({ classId, nex, attributes = {}, origin = "", bonuses = {}, automaticBonuses = {} }) {
        const rules = CLASSES[classId];
        if (!rules) return null;
        const level = classId === "mundano" ? 1 : AGENT_NEX.indexOf(normalizeNex(classId, nex)) + 1;
        const vigor = Number.isInteger(attributes.vigor) ? attributes.vigor : 0;
        const presenca = Number.isInteger(attributes.presenca) ? attributes.presenca : 0;
        const cultist = origin === "cultista-arrependido";
        const maxima = {
            vida: rules.start.vida + vigor + (level - 1) * (rules.gain.vida + vigor),
            esforco: rules.start.esforco + presenca + (level - 1) * (rules.gain.esforco + presenca),
            sanidade: (cultist ? Math.floor(rules.start.sanidade / 2) : rules.start.sanidade) + (level - 1) * rules.gain.sanidade
        };
        for (const id of RESOURCES) maxima[id] = Math.max(0, maxima[id] + clampBonus(bonuses[id]) + (Number.isInteger(automaticBonuses[id]) ? automaticBonuses[id] : 0));
        return { nex: normalizeNex(classId, nex), level, pePerTurn: classId === "mundano" ? 1 : level, maxima };
    }

    const api = Object.freeze({ CLASSES, RESOURCES, allowedNex, normalizeNex, clampBonus, trainingMaximum, nextTrainingMilestone, calculate });
    (scope.window || scope).REAL_NEX_RULES = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
