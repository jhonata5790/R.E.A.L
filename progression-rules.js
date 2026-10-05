// Progressão de habilidades do livro básico, derivada do catálogo conferido no C.R.I.S.
(function (scope) {
    "use strict";

    const TRAIL_MILESTONES = Object.freeze([10, 40, 65, 99]);
    const POWER_MILESTONES = Object.freeze([15, 30, 45, 60, 75, 90]);
    const ATTRIBUTE_MILESTONES = Object.freeze([20, 50, 80, 95]);
    const TRAINING_MILESTONES = Object.freeze([35, 70]);
    const CLASS_IDS = Object.freeze(["combatente", "especialista", "ocultista"]);

    function validCatalog(catalog) {
        return Array.isArray(catalog) ? catalog.filter((item) => item && typeof item.name === "string") : [];
    }

    function trails(catalog, classId) {
        if (!CLASS_IDS.includes(classId)) return [];
        return [...new Set(validCatalog(catalog)
            .filter((item) => item.category === classId && item.kind === "Habilidade de trilha")
            .map((item) => item.subgroup))];
    }

    function normalizeTrail(catalog, classId, value) {
        const wanted = String(value || "").trim().toLocaleLowerCase("pt-BR");
        return trails(catalog, classId).find((trail) => trail.toLocaleLowerCase("pt-BR") === wanted) || "";
    }

    function classAbilities(catalog, classId, nex) {
        const currentNex = Number.isFinite(nex) ? nex : 0;
        return validCatalog(catalog).filter((item) => item.category === classId
            && item.kind === "Habilidade de classe" && item.minNex <= currentNex)
            .sort((left, right) => left.minNex - right.minNex);
    }

    function trailAbilities(catalog, classId, trail, nex) {
        const selected = normalizeTrail(catalog, classId, trail);
        const currentNex = Number.isFinite(nex) ? nex : 0;
        if (!selected || currentNex < TRAIL_MILESTONES[0]) return [];
        return validCatalog(catalog).filter((item) => item.category === classId
            && item.kind === "Habilidade de trilha" && item.subgroup === selected && item.minNex <= currentNex);
    }

    function automaticAbilities({ catalog, classId, trail, nex }) {
        return [
            ...classAbilities(catalog, classId, nex).map((item) => ({ ...item, progressionSource: "class" })),
            ...trailAbilities(catalog, classId, trail, nex).map((item) => ({ ...item, progressionSource: "trail" }))
        ];
    }

    function trailTimeline(catalog, classId, trail, nex) {
        const selected = normalizeTrail(catalog, classId, trail);
        if (!selected) return [];
        const currentNex = Number.isFinite(nex) ? nex : 0;
        return validCatalog(catalog).filter((item) => item.category === classId
            && item.kind === "Habilidade de trilha" && item.subgroup === selected)
            .sort((left, right) => left.minNex - right.minNex)
            .map((item) => ({ ...item, unlocked: item.minNex <= currentNex }));
    }

    function ritualCircle(classId, nex, learnRitualChoices = 0) {
        const currentNex = Number.isFinite(nex) ? nex : 0;
        if (classId === "ocultista") return currentNex >= 85 ? 4 : currentNex >= 55 ? 3 : currentNex >= 25 ? 2 : currentNex >= 5 ? 1 : 0;
        if (learnRitualChoices < 1) return 0;
        return currentNex >= 75 ? 3 : currentNex >= 45 ? 2 : 1;
    }

    function occultistRitualsKnown(nex) {
        const currentNex = Number.isFinite(nex) ? nex : 0;
        const steps = [...Array.from({ length: 19 }, (_, index) => (index + 1) * 5), 99];
        const level = steps.indexOf(currentNex) + 1;
        return level ? level + 2 : 0;
    }

    function unlocked(milestones, nex) {
        const currentNex = Number.isFinite(nex) ? nex : 0;
        return milestones.filter((value) => value <= currentNex);
    }

    function progressionChoices(nex, versatility = "") {
        const powers = unlocked(POWER_MILESTONES, nex);
        const attributes = unlocked(ATTRIBUTE_MILESTONES, nex);
        const training = unlocked(TRAINING_MILESTONES, nex);
        const currentNex = Number.isFinite(nex) ? nex : 0;
        return Object.freeze({
            powerMilestones: powers,
            powerSlots: powers.length + (currentNex >= 50 && versatility === "power" ? 1 : 0),
            attributeMilestones: attributes,
            attributeIncreases: attributes.length,
            trainingMilestones: training,
            versatilityAvailable: currentNex >= 50
        });
    }

    function nextChoiceMilestone(nex) {
        const currentNex = Number.isFinite(nex) ? nex : 0;
        const milestones = [
            ...TRAIL_MILESTONES.map(value => ({ nex: value, label: "Habilidade de trilha" })),
            ...POWER_MILESTONES.map(value => ({ nex: value, label: "Poder de classe" })),
            ...ATTRIBUTE_MILESTONES.map(value => ({ nex: value, label: "Aumento de atributo" })),
            ...TRAINING_MILESTONES.map(value => ({ nex: value, label: "Grau de treinamento" })),
            { nex: 50, label: "Versatilidade" }
        ].sort((left, right) => left.nex - right.nex);
        return milestones.find((item) => item.nex > currentNex) || null;
    }

    const api = Object.freeze({ TRAIL_MILESTONES, POWER_MILESTONES, ATTRIBUTE_MILESTONES, TRAINING_MILESTONES, CLASS_IDS, trails, normalizeTrail, classAbilities, trailAbilities, automaticAbilities, trailTimeline, ritualCircle, occultistRitualsKnown, progressionChoices, nextChoiceMilestone });
    (scope.window || scope).REAL_PROGRESSION_RULES = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
