// Seleção múltipla e deslocamento em grupo dos tokens da mesa.
(function (scope) {
    "use strict";

    function validIds(tokens, ids, legacyId = null) {
        const available = new Set((Array.isArray(tokens) ? tokens : []).map((token) => token?.id));
        const requested = Array.isArray(ids) ? ids : legacyId === null || legacyId === undefined ? [] : [legacyId];
        return [...new Set(requested)].filter((id) => available.has(id));
    }

    function toggle(ids, id) {
        const selected = new Set(Array.isArray(ids) ? ids : []);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        return [...selected];
    }

    function rectangleIds(tokens, start, end) {
        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const bottom = Math.max(start.y, end.y);
        return (Array.isArray(tokens) ? tokens : []).filter((token) => token && Number.isFinite(token.x) && Number.isFinite(token.y)
            && token.x >= left && token.x <= right && token.y >= top && token.y <= bottom).map((token) => token.id);
    }

    function translatedPositions(tokens, ids, deltaX, deltaY) {
        const selected = new Set(Array.isArray(ids) ? ids : []);
        return Object.fromEntries((Array.isArray(tokens) ? tokens : []).filter((token) => selected.has(token.id)).map((token) => [token.id, {
            x: token.x + deltaX,
            y: token.y + deltaY
        }]));
    }

    function snapDelta(token, grid) {
        const size = Number.isFinite(grid?.size) && grid.size > 0 ? grid.size : 50;
        const offsetX = Number.isFinite(grid?.offsetX) ? grid.offsetX : 0;
        const offsetY = Number.isFinite(grid?.offsetY) ? grid.offsetY : 0;
        const x = Math.round((token.x - offsetX) / size) * size + offsetX;
        const y = Math.round((token.y - offsetY) / size) * size + offsetY;
        return Object.freeze({ x: x - token.x, y: y - token.y });
    }

    const api = Object.freeze({ validIds, toggle, rectangleIds, translatedPositions, snapDelta });
    (scope.window || scope).REAL_TABLETOP_SELECTION = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
