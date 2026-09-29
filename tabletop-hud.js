// Navegação da mesa e lista rápida de espectadores, sem alterar o estado salvo da campanha.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const menu = $("hudMenu");
    const menuButton = $("openHudMenu");
    const peek = $("viewerPeek");
    const peekButton = $("openViewerPeek");
    const canvas = $("gameCanvas");
    const sections = { shield: $("hudShield"), documents: $("hudDocuments") };
    const campaignId = new URLSearchParams(location.search).get("campaign");
    const campaignHref = campaignId ? `index.html#campanha/${encodeURIComponent(campaignId)}` : "index.html#campanhas";
    let peekMode = null;

    function renderCampaign() {
        let library;
        try { library = JSON.parse(localStorage.getItem("cronicas-biblioteca-v2") || "null"); }
        catch { library = null; }
        const campaign = library?.campaigns?.find((entry) => entry.id === campaignId);
        $("hudCampaignName").textContent = campaign?.name || (campaignId ? "Campanha" : "Mesa sem campanha");
        $("hudCampaignNotes").textContent = campaign?.notes?.trim() || "Ainda não há anotações nesta campanha.";
        $("hudCampaignLink").href = campaignHref;
        const ids = new Set(Array.isArray(campaign?.characters) ? campaign.characters : []);
        const characters = (Array.isArray(library?.characters) ? library.characters : [])
            .filter((entry) => ids.has(entry.id));
        const list = $("hudCharacterList");
        list.replaceChildren();
        $("hudCharacterEmpty").hidden = characters.length > 0;
        characters.forEach((character) => {
            const item = document.createElement("li");
            const link = document.createElement("a");
            const name = document.createElement("strong");
            const detail = document.createElement("small");
            name.textContent = character.name || "Personagem sem nome";
            detail.textContent = character.player || character.class || "Ficha de personagem";
            link.href = `personagem.html?id=${encodeURIComponent(character.id)}`;
            link.append(name, detail);
            item.appendChild(link);
            list.appendChild(item);
        });
    }

    function setSection(next) {
        document.querySelectorAll("[data-hud-section]").forEach((button) => {
            const selected = button.dataset.hudSection === next;
            button.setAttribute("aria-expanded", String(selected));
        });
        Object.entries(sections).forEach(([name, section]) => { section.hidden = name !== next; });
    }

    function openMenu() {
        renderCampaign();
        setSection(null);
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
    document.querySelectorAll("[data-hud-section]").forEach((button) => {
        button.addEventListener("click", () => {
            const name = button.dataset.hudSection;
            setSection(sections[name].hidden ? name : null);
        });
    });
    window.addEventListener("storage", (event) => {
        if (event.key === "cronicas-biblioteca-v2" && menu.open) renderCampaign();
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
