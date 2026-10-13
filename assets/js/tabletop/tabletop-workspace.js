// Preparação e navegação durante a sessão. O canvas continua responsável pela cena atual.
(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);
    const STORE = window.REAL_TABLE_WORKSPACE;
    const master = window.REAL_TABLETOP_MASTER;
    const controls = window.REAL_TABLETOP_CONTROLS;
    const tableId = master.campaignKey;
    let workspace = null, working = false, stampedOpening = false;

    function status(message) { $("mainSceneStatus").textContent = message; }
    function group(label, ids) {
        const section = document.createElement("div"); section.className = "tool-group";
        const title = document.createElement("span"); title.className = "tool-group__label"; title.textContent = label;
        const actions = document.createElement("div"); actions.className = "tool-group__buttons";
        ids.forEach((id) => actions.append($(id))); section.append(title, actions); $("toolbar").append(section);
    }
    group("Cena", ["toolScenes", "toolMove", "toolZoom", "toolMap", "toolRuler", "undoScene", "redoScene", "toolSession"]);
    group("Jogadores", ["toolToken", "toolPlayerView"]);
    group("Transmissão", ["toolTransmission", "openShortcutHelp"]);
    if (typeof ResizeObserver === "function") new ResizeObserver(([entry]) => {
        document.documentElement.style.setProperty("--dock-height", `${entry.target.offsetHeight}px`);
    }).observe($("toolDock"));

    function updateState() {
        const state = controls.state();
        $("stateRuler").hidden = !state.ruler; $("stateSnap").hidden = !state.snap; $("stateFollow").hidden = !state.following;
        $("stateLive").classList.toggle("is-live", window.REAL_TABLETOP_ONLINE?.isLive() || false);
        $("stateLive").textContent = window.REAL_TABLETOP_ONLINE?.isLive()
            ? window.REAL_TABLETOP_ONLINE?.isPaused?.() ? "Ⅱ Visão pausada" : "● Ao vivo" : "○ Offline";
        $("topbarFollow").setAttribute("aria-pressed", String(state.following));
        $("tokenQuickActions").hidden = !state.selection.length || !state.hudVisible;
        $("tokenQuickName").textContent = state.selection.length === 1 ? state.selection[0].name : `${state.selection.length} tokens selecionados`;
        $("quickTokenVisibility").textContent = state.selection.some((token) => token.visible !== false) ? "Ocultar" : "Revelar";
    }
    $("quickTokenFocus").addEventListener("click", controls.focusSelection);
    $("quickTokenVisibility").addEventListener("click", controls.toggleVisibility);
    $("quickTokenDuplicate").addEventListener("click", controls.duplicate);
    $("quickTokenEdit").addEventListener("click", controls.editSelection);
    $("quickTokenDelete").addEventListener("click", controls.remove);
    $("topbarFollow").addEventListener("click", controls.toggleFollow);
    $("topbarTransmission").addEventListener("click", () => $("toolTransmission").click());
    window.addEventListener("real:tabletop-ui", updateState);
    window.addEventListener("real:online-state", updateState);

    async function switchScene(id) {
        if (working || id === master.sceneId()) return;
        working = true; $("activeSceneSelect").disabled = true; status("Salvando a cena atual e abrindo a próxima…");
        try {
            if (!await master.switchScene(id)) throw new Error("Aguarde a operação atual terminar.");
            await refreshScenes(); status("Cena carregada. A anterior continua guardada.");
        } catch (error) { status(error.message); $("activeSceneSelect").value = master.sceneId(); }
        finally { working = false; $("activeSceneSelect").disabled = false; updateState(); }
    }
    function action(text, run) {
        const button = document.createElement("button"); button.type = "button"; button.textContent = text;
        button.addEventListener("click", async () => { try { await run(); } catch (error) { status(error.message); } }); return button;
    }
    async function refreshScenes() {
        await master.ready;
        workspace = await STORE.read(tableId);
        $("activeSceneSelect").replaceChildren(); $("mainSceneList").replaceChildren();
        workspace.scenes.forEach((scene) => {
            const option = document.createElement("option"); option.value = scene.id; option.textContent = scene.name; $("activeSceneSelect").append(option);
            const item = document.createElement("article"); item.className = "main-scene" + (scene.id === master.sceneId() ? " is-active" : "");
            const image = document.createElement("img"); image.alt = ""; image.loading = "lazy";
            if (scene.preview) image.src = scene.preview; else image.hidden = true;
            const name = document.createElement("strong"); name.textContent = scene.name;
            const buttons = document.createElement("div");
            buttons.append(action(scene.id === master.sceneId() ? "Em uso" : "Abrir", () => switchScene(scene.id)),
                action("Duplicar", async () => { if (!await master.flush()) throw new Error("Não foi possível salvar a cena atual."); await STORE.updateScene(tableId, scene.id, "copy"); await refreshScenes(); status("Cena duplicada."); }),
                action("Excluir", async () => {
                    if (workspace.scenes.length === 1) throw new Error("Mantenha uma cena nesta mesa.");
                    if (!confirm(`Excluir “${scene.name}” deste aparelho?`)) return;
                    if (scene.id === master.sceneId()) await switchScene(workspace.scenes.find((entry) => entry.id !== scene.id).id);
                    if (scene.id === master.sceneId()) throw new Error("Não foi possível trocar de cena; a exclusão foi cancelada.");
                    await STORE.updateScene(tableId, scene.id, "delete"); await refreshScenes(); status("Cena excluída.");
                }));
            item.append(image, name, buttons); $("mainSceneList").append(item);
        });
        $("activeSceneSelect").value = master.sceneId();
        $("mainSceneRename").value = workspace.scenes.find((scene) => scene.id === master.sceneId())?.name || "";
        $("hudPrivateNotes").textContent = workspace.notes || "Nenhuma anotação privada. Prepare suas notas na sala da mesa.";
        let library; try { library = JSON.parse(localStorage.getItem("cronicas-biblioteca-v2") || "null"); } catch { library = null; }
        $("topbarTableName").textContent = library?.campaigns?.find((table) => table.id === tableId)?.name || "Minha mesa";
        const table = library?.campaigns?.find((entry) => entry.id === tableId);
        if (table && !stampedOpening) {
            table.lastOpenedAt = new Date().toISOString();
            library._account = { ...library._account, localUpdatedAt: table.lastOpenedAt };
            localStorage.setItem("cronicas-biblioteca-v2", JSON.stringify(library)); stampedOpening = true;
        }
        updateState();
    }
    $("activeSceneSelect").addEventListener("change", (event) => switchScene(event.target.value));
    $("toolScenes").addEventListener("click", () => refreshScenes().catch((error) => status(error.message)));
    $("renameMainScene").addEventListener("click", async () => {
        try { await STORE.updateScene(tableId, master.sceneId(), "rename", $("mainSceneRename").value); await refreshScenes(); status("Nome atualizado."); }
        catch (error) { status(error.message); }
    });
    $("mainSceneForm").addEventListener("submit", async (event) => {
        event.preventDefault(); $("createMainScene").disabled = true;
        try {
            const name = $("mainSceneName").value.trim(); if (!name) return;
            const session = STORE.emptySession(), file = $("mainSceneMap").files?.[0];
            if (file) { session.map.source = await STORE.readFile(file); session.map.name = file.name; }
            await STORE.addScene(tableId, name, session); $("mainSceneForm").reset(); await refreshScenes(); status("Cena criada. Abra quando estiver pronto.");
        } catch (error) { status(error.message); }
        finally { $("createMainScene").disabled = false; }
    });
    window.addEventListener("real:scene-switched", () => refreshScenes().catch((error) => status(error.message)));
    window.addEventListener("focus", () => refreshScenes().catch((error) => status(error.message)));
    refreshScenes().catch((error) => status(error.message));
})();
