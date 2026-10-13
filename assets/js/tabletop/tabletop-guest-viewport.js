// Local zoom never writes to the master's camera, scene or tokens.
(function () {
    "use strict";
    const root = document.querySelector(".guest-tabletop"), stage = document.querySelector(".guest-tabletop__stage");
    const viewport = document.getElementById("guestViewport"), fullscreen = document.getElementById("guestFullscreen");
    if (!root || !stage || !viewport) return;
    const rules = window.REAL_TABLETOP_PERFORMANCE, pointers = new Map();
    let state = { scale: 1, x: 0, y: 0 }, gesture = null;
    const center = (points) => ({ x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length });
    const distance = (points) => points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    function render() {
        state = rules.viewport(state, viewport.clientWidth, viewport.clientHeight);
        viewport.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
        stage.classList.toggle("is-zoomed", state.scale > 1); window.REAL_GUEST_VIEW?.reflow();
    }
    function zoom(scale, point) {
        const rect = viewport.getBoundingClientRect(), origin = { x: rect.left + rect.width / 2 - state.x, y: rect.top + rect.height / 2 - state.y };
        const next = Math.max(1, Math.min(4, scale)), ratio = next / state.scale, anchor = point || origin;
        state = { scale: next, x: state.x * ratio + (anchor.x - origin.x) * (1 - ratio), y: state.y * ratio + (anchor.y - origin.y) * (1 - ratio) }; render();
    }
    function begin() {
        const points = [...pointers.values()];
        gesture = points.length ? { ...state, center: center(points), distance: distance(points) } : null;
    }
    stage.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest?.("button")) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size > 1) window.REAL_GUEST_VIEW?.cancelGesture();
        if (!window.REAL_GUEST_VIEW?.pointing() || pointers.size > 1) { stage.setPointerCapture(event.pointerId); begin(); }
    });
    stage.addEventListener("pointermove", (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (!gesture || (window.REAL_GUEST_VIEW?.pointing() && pointers.size < 2)) return;
        const points = [...pointers.values()], middle = center(points);
        const next = gesture.distance && points.length > 1 ? Math.max(1, Math.min(4, gesture.scale * distance(points) / gesture.distance)) : gesture.scale;
        const rect = stage.getBoundingClientRect(), origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, ratio = next / gesture.scale;
        state = { scale: next, x: gesture.x * ratio + (gesture.center.x - origin.x) * (1 - ratio) + middle.x - gesture.center.x,
            y: gesture.y * ratio + (gesture.center.y - origin.y) * (1 - ratio) + middle.y - gesture.center.y };
        if (points.length > 1 || Math.hypot(middle.x - gesture.center.x, middle.y - gesture.center.y) > 8) window.REAL_GUEST_VIEW?.cancelGesture(); render();
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) stage.addEventListener(name, (event) => { pointers.delete(event.pointerId); begin(); });
    stage.addEventListener("wheel", (event) => { event.preventDefault(); zoom(state.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), { x: event.clientX, y: event.clientY }); }, { passive: false });
    document.getElementById("guestZoomIn").addEventListener("click", () => zoom(state.scale * 1.3));
    document.getElementById("guestZoomOut").addEventListener("click", () => zoom(state.scale / 1.3));
    document.getElementById("guestResetView").addEventListener("click", () => { state = { scale: 1, x: 0, y: 0 }; render(); });
    function fullscreenState() { fullscreen.textContent = document.fullscreenElement || root.classList.contains("is-immersive") ? "Sair da tela cheia" : "Tela cheia"; render(); }
    fullscreen.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (root.classList.contains("is-immersive")) root.classList.remove("is-immersive");
            else if (root.requestFullscreen) await root.requestFullscreen();
            else root.classList.add("is-immersive");
        } catch { root.classList.toggle("is-immersive"); }
        fullscreenState();
    });
    document.addEventListener("fullscreenchange", fullscreenState);
    window.addEventListener("keydown", (event) => { if (event.key === "Escape") { root.classList.remove("is-immersive"); fullscreenState(); } });
    window.addEventListener("resize", render); new ResizeObserver(render).observe(viewport); render();
})();
