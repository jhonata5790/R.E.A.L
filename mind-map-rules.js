// Modelo e geometria do mapa mental da ficha.
(function (scope) {
    "use strict";

    const SHAPES = Object.freeze({
        square: Object.freeze([160, 160]),
        rectangle: Object.freeze([220, 150]),
        triangle: Object.freeze([190, 175]),
        circle: Object.freeze([170, 170])
    });
    const COLORS = Object.freeze(["violet", "red", "blue", "green", "amber"]);
    const KINDS = Object.freeze({
        idea: "Ideia", person: "Pessoa", clue: "Pista", place: "Local", entity: "Entidade", ritual: "Ritual", question: "Pergunta"
    });
    const RELATIONS = Object.freeze({
        related: "Relacionada", leads: "Leva a", supports: "Confirma", contradicts: "Contradiz", threatens: "Ameaça", protects: "Protege"
    });

    function validNote(note) {
        return Boolean(note && typeof note.id === "string" && SHAPES[note.shape]);
    }

    function key(from, to) {
        return [from, to].sort().join("::");
    }

    function normalizeConnections(connections, notes) {
        const noteIds = new Set((Array.isArray(notes) ? notes : []).filter(validNote).map((note) => note.id));
        const seen = new Set();
        const normalized = [];
        for (const connection of Array.isArray(connections) ? connections : []) {
            if (!connection || typeof connection.id !== "string" || !noteIds.has(connection.from) || !noteIds.has(connection.to) || connection.from === connection.to) continue;
            const connectionKey = key(connection.from, connection.to);
            if (seen.has(connectionKey)) continue;
            seen.add(connectionKey);
            normalized.push({ ...connection, relation: RELATIONS[connection.relation] ? connection.relation : "related" });
        }
        return normalized;
    }

    function addConnection(connections, notes, from, to, id, relation = "related") {
        const normalized = normalizeConnections(connections, notes);
        if (from === to || typeof id !== "string" || !validNote(notes.find((note) => note.id === from)) || !validNote(notes.find((note) => note.id === to))) {
            return Object.freeze({ connections: normalized, added: false });
        }
        if (normalized.some((connection) => key(connection.from, connection.to) === key(from, to))) {
            return Object.freeze({ connections: normalized, added: false });
        }
        return Object.freeze({ connections: [...normalized, { id, from, to, relation: RELATIONS[relation] ? relation : "related" }], added: true });
    }

    function center(note) {
        const [width, height] = SHAPES[note.shape] || [0, 0];
        return Object.freeze({ x: (Number.isFinite(note.x) ? note.x : 0) + width / 2, y: (Number.isFinite(note.y) ? note.y : 0) + height / 2 });
    }

    function title(note) {
        const text = String(note?.text || "").trim().split(/\r?\n/)[0].trim();
        return text ? text.slice(0, 38) : "Ideia sem título";
    }

    function matches(note, query) {
        const normalized = String(query || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
        if (!normalized) return true;
        const content = [note?.text, KINDS[note?.kind] || KINDS.idea].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
        return content.includes(normalized);
    }

    function bounds(notes, padding = 40) {
        const valid = (Array.isArray(notes) ? notes : []).filter(validNote);
        if (!valid.length) return Object.freeze({ x: 0, y: 0, width: 0, height: 0 });
        const left = Math.min(...valid.map((note) => Number.isFinite(note.x) ? note.x : 0));
        const top = Math.min(...valid.map((note) => Number.isFinite(note.y) ? note.y : 0));
        const right = Math.max(...valid.map((note) => (Number.isFinite(note.x) ? note.x : 0) + SHAPES[note.shape][0]));
        const bottom = Math.max(...valid.map((note) => (Number.isFinite(note.y) ? note.y : 0) + SHAPES[note.shape][1]));
        return Object.freeze({ x: Math.max(0, left - padding), y: Math.max(0, top - padding), width: right - left + padding * 2, height: bottom - top + padding * 2 });
    }

    function layout(notes, connections, rootId = "") {
        const valid = (Array.isArray(notes) ? notes : []).filter(validNote);
        if (!valid.length) return Object.freeze({});
        const graph = new Map(valid.map((note) => [note.id, new Set()]));
        for (const connection of normalizeConnections(connections, valid)) {
            graph.get(connection.from).add(connection.to);
            graph.get(connection.to).add(connection.from);
        }
        const chosenRoot = graph.has(rootId) ? rootId : [...graph].sort((left, right) => right[1].size - left[1].size)[0][0];
        const levelById = new Map([[chosenRoot, 0]]);
        const queue = [chosenRoot];
        while (queue.length) {
            const current = queue.shift();
            for (const neighbor of graph.get(current)) {
                if (levelById.has(neighbor)) continue;
                levelById.set(neighbor, levelById.get(current) + 1);
                queue.push(neighbor);
            }
        }
        for (const note of valid) if (!levelById.has(note.id)) levelById.set(note.id, 0);
        const levels = new Map();
        for (const note of valid) {
            const level = levelById.get(note.id);
            if (!levels.has(level)) levels.set(level, []);
            levels.get(level).push(note);
        }
        const positions = {};
        for (const [level, levelNotes] of [...levels].sort((left, right) => left[0] - right[0])) {
            levelNotes.forEach((note, index) => {
                positions[note.id] = { x: 60 + level * 300, y: 55 + index * 215 };
            });
        }
        return Object.freeze(positions);
    }

    const api = Object.freeze({ SHAPES, COLORS, KINDS, RELATIONS, validNote, normalizeConnections, addConnection, center, title, matches, bounds, layout });
    (scope.window || scope).REAL_MIND_MAP_RULES = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
