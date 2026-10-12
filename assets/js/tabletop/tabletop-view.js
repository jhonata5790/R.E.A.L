// Geometria da visão publicada, compartilhável com uma futura sala online.
(function (scope) {
    const ASPECT_RATIO = 16 / 9;
    const DEFAULT_VIEW = Object.freeze({ x: -600, y: -337.5, width: 1200, height: 675 });

    function normalize(value) {
        if (!value || typeof value !== "object") return { ...DEFAULT_VIEW };
        const width = Number(value.width);
        const x = Number(value.x);
        const y = Number(value.y);
        if (![width, x, y].every(Number.isFinite) || width < 400 || width > 4000) return { ...DEFAULT_VIEW };
        return { x, y, width, height: width / ASPECT_RATIO };
    }

    function contains(view, point) {
        return point.x >= view.x && point.x <= view.x + view.width &&
            point.y >= view.y && point.y <= view.y + view.height;
    }

    function publishedTokens(tokens) {
        return tokens.filter((token) => token && token.visibleToPlayers !== false);
    }

    const api = Object.freeze({ ASPECT_RATIO, DEFAULT_VIEW, normalize, contains, publishedTokens });
    (scope.window || scope).REAL_TABLETOP_VIEW = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
