// Comandos, enquadramento e histórico da mesa. Imagens são compartilhadas entre os estados.
(function (scope) {
    "use strict";

    function command(event) {
        if (event.repeat || event.isComposing || event.altKey) return null;
        const key = String(event.key || "").toLowerCase();
        const control = event.ctrlKey || event.metaKey;
        if (control) {
            if (key === "z") return event.shiftKey ? "redo" : "undo";
            if (event.shiftKey) return null;
            return { c: "copy", v: "paste", a: "select-all", d: "duplicate" }[key] || null;
        }
        if (key === " " || event.code === "Space") return event.shiftKey ? "center-player" : "follow-player";
        if (key === "g") return event.shiftKey ? "snap-grid" : "show-grid";
        if (key === "h") return event.shiftKey ? "toggle-hud" : "visibility";
        if (key === "?" || (key === "/" && event.shiftKey)) return "help";
        if (event.shiftKey) return null;
        return { f: "frame", r: "ruler", escape: "cancel", delete: "delete" }[key] || null;
    }

    function bounds(items) {
        if (!items.length) return null;
        let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
        for (const item of items) {
            const cosine = Math.abs(Math.cos(item.rotation || 0));
            const sine = Math.abs(Math.sin(item.rotation || 0));
            const halfWidth = (item.width * cosine + item.height * sine) / 2;
            const halfHeight = (item.width * sine + item.height * cosine) / 2;
            left = Math.min(left, item.x - halfWidth); right = Math.max(right, item.x + halfWidth);
            top = Math.min(top, item.y - halfHeight); bottom = Math.max(bottom, item.y + halfHeight);
        }
        return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top };
    }

    function fitCamera(rect, viewport, minZoom = .25, maxZoom = 3) {
        const availableWidth = Math.max(1, viewport.width - 96);
        const availableHeight = Math.max(1, viewport.height - 160);
        const zoom = Math.max(minZoom, Math.min(maxZoom,
            availableWidth / Math.max(1, rect.width), availableHeight / Math.max(1, rect.height)));
        return { x: -rect.x, y: -rect.y, zoom };
    }

    function createHistory(equal, limit = 50) {
        let states = [], cursor = -1;
        return {
            reset(state) { states = [state]; cursor = 0; },
            record(state) {
                if (cursor >= 0 && equal(states[cursor], state)) return false;
                states = states.slice(0, cursor + 1);
                states.push(state);
                if (states.length > limit + 1) states.shift();
                cursor = states.length - 1;
                return true;
            },
            undo() { if (cursor <= 0) return null; return states[--cursor]; },
            redo() { if (cursor >= states.length - 1) return null; return states[++cursor]; },
            get canUndo() { return cursor > 0; },
            get canRedo() { return cursor < states.length - 1; }
        };
    }

    const api = Object.freeze({ command, bounds, fitCamera, createHistory });
    (scope.window || scope).REAL_TABLETOP_SHORTCUTS = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
