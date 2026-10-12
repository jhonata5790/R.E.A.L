// Navegação do tabletop e lista rápida de espectadores, sem alterar o estado salvo da mesa.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const menu = $("hudMenu");
    const menuButton = $("openHudMenu");
    const peek = $("viewerPeek");
    const peekButton = $("openViewerPeek");
    const canvas = $("gameCanvas");
    const search = new URLSearchParams(location.search);
    const tableId = search.get("table") || search.get("campaign");
    const tableHref = tableId ? `index.html#mesa/${encodeURIComponent(tableId)}` : "index.html#inicio";
    let peekMode = null;

    function renderTable() {
        let library;
        try { library = JSON.parse(localStorage.getItem("cronicas-biblioteca-v2") || "null"); }
        catch { library = null; }
        const table = library?.campaigns?.find((entry) => entry.id === tableId);
        $("hudCampaignName").textContent = table?.name || "Tabletop";
        $("hudCampaignLink").href = tableHref;
    }

    function openMenu() {
        renderTable();
        hidePeek();
        menu.showModal();
        menuButton.setAttribute("aria-expanded", "true");
        $("closeHudMenu").focus();
    }

    function closeMenu() { menu.close(); }
    menuButton.addEventListener("click", openMenu);
    $("closeHudMenu").addEventListener("click", closeMenu);
    menu.addEventListener("click", (event) => { if (event.target === menu) closeMenu(); });
    menu.addEventListener("close", () => {
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.focus();
    });
    window.addEventListener("storage", (event) => {
        if (event.key === "cronicas-biblioteca-v2" && menu.open) renderTable();
    });

    function showPeek(mode) {
        peek.hidden = false;
        peekMode = mode;
        peekButton.setAttribute("aria-expanded", "true");
    }
    function hidePeek() {
        peek.hidden = true;
        peekMode = null;
        peekButton.setAttribute("aria-expanded", "false");
    }
    peekButton.addEventListener("click", () => {
        if (peekMode === "button") hidePeek();
        else showPeek("button");
    });
    $("closeViewerPeek").addEventListener("click", () => { hidePeek(); peekButton.focus(); });
    document.addEventListener("pointerdown", (event) => {
        if (peekMode === "button" && !peek.contains(event.target) && !peekButton.contains(event.target)) hidePeek();
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && peekMode) { hidePeek(); return; }
        if (event.key !== "Tab" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey
            || window.matchMedia("(max-width: 700px)").matches
            || (document.activeElement !== canvas && document.activeElement !== document.body)
            || document.querySelector("dialog[open], .settings-panel:not([hidden]), #emptyTabletop:not([hidden])")) return;
        event.preventDefault();
        showPeek("keyboard");
    });
    window.addEventListener("keyup", (event) => {
        if (event.key === "Tab" && peekMode === "keyboard") hidePeek();
    });
    window.addEventListener("blur", () => { if (peekMode === "keyboard") hidePeek(); });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && peekMode === "keyboard") hidePeek();
    });
    canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));
})();
