// Portal e preparação da mesa. Metadados na conta; cenas e materiais privados no aparelho.
(function () {
    "use strict";
    const $ = (id) => document.getElementById(id);
    const STORAGE_KEY = "cronicas-biblioteca-v2";
    const PORTAL = window.REAL_TABLE_PORTAL;
    const STORE = window.REAL_TABLE_WORKSPACE;
    const SHARE = window.REAL_ROOM_SHARING;
    let state = loadState(), selectedTableId = null, editingTableId = null, editingSceneId = null, editingDocumentId = null;
    let workspace = null, documents = null, roomGeneration = 0, toastTimer = null, notesTimer = null;

    function loadState() {
        let saved;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { saved = null; }
        if (saved && Array.isArray(saved.campaigns)) return { ...saved,
            campaigns: saved.campaigns.map((table) => ({ ...table, name: table.name || "Minha mesa" })),
            characters: saved.characters || [], homebrew: saved.homebrew || [] };
        let legacy;
        try { legacy = JSON.parse(localStorage.getItem("cronicas-campanha-v1") || "null"); } catch { legacy = null; }
        return { campaigns: legacy ? [{ id: "campanha-inicial", name: legacy.campaign?.name || "Minha mesa", description: legacy.campaign?.description || "", characters: [] }] : [], characters: [], homebrew: [] };
    }
    function freshLibrary() {
        const current = loadState();
        // A sincronização pode atualizar a marca da conta entre duas edições locais.
        state._account = current._account;
        state.characters = current.characters; state.homebrew = current.homebrew;
    }
    function saveState() {
        freshLibrary();
        window.REAL_ACCOUNT?.markLibraryDirty(state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        window.REAL_ACCOUNT?.libraryChanged();
    }
    function tableById(id) { return state.campaigns.find((table) => table.id === id); }
    function make(tag, className, text) {
        const node = document.createElement(tag); if (className) node.className = className;
        if (text !== undefined) node.textContent = text; return node;
    }
    function button(text, action, className = "") {
        const node = make("button", className, text); node.type = "button";
        node.addEventListener("click", () => Promise.resolve().then(action).catch((error) => toast(error.message || "Não foi possível concluir agora.", true)));
        return node;
    }
    function toast(message, error = false) {
        clearTimeout(toastTimer); $("portalToast").textContent = message; $("portalToast").dataset.error = String(error); $("portalToast").hidden = false;
        toastTimer = setTimeout(() => { $("portalToast").hidden = true; }, error ? 6500 : 3000);
    }
    function openedLabel(table) {
        if (!table.lastOpenedAt) return "Ainda não aberta";
        const date = new Date(table.lastOpenedAt);
        return Number.isNaN(date.getTime()) ? "Ainda não aberta" : "Última abertura: " + date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    }
    function markOpened(id) {
        const table = tableById(id); if (!table) return;
        table.lastOpenedAt = new Date().toISOString(); saveState();
    }
    async function flushNotes() {
        clearTimeout(notesTimer);
        if (!selectedTableId || !workspace) return;
        const id = selectedTableId, notes = $("roomNotes").value;
        if (workspace.notes === notes) return;
        await STORE.saveNotes(id, notes);
        if (id === selectedTableId) { workspace.notes = notes; $("notesStatus").textContent = "Salvo neste aparelho"; }
    }
    async function navigate(view, id = null, fromHistory = false) {
        try { await flushNotes(); } catch { toast("As anotações não foram salvas. Continue nesta sala e tente novamente.", true); return; }
        if (view === "table" && !tableById(id)) view = "home";
        selectedTableId = view === "table" ? id : null;
        for (const id of ["tableDialog", "accessDialog", "sceneDialog", "roomDocumentDialog"]) if ($(id).open) $(id).close();
        roomGeneration++;
        $("view-home").hidden = view !== "home"; $("view-table").hidden = view !== "table";
        const hash = view === "table" ? PORTAL.tableHash(id) : "#inicio";
        if (!fromHistory && location.hash !== hash) history.pushState(null, "", hash);
        SHARE.setTable(selectedTableId);
        if (view === "table") {
            try { markOpened(id); } catch { toast("Não foi possível registrar a última abertura. Confira o espaço disponível neste aparelho.", true); }
            await renderRoom();
        }
        else { workspace = null; renderTables(); }
        document.title = view === "table" ? `${tableById(id).name} | R.E.A.L` : "R.E.A.L | Tabletop online";
        window.scrollTo?.(0, 0);
    }

    function card(table) {
        const article = make("article", "table-card");
        const link = make("a", "table-card__main"); link.href = PORTAL.tableHash(table.id);
        const media = make("div", "table-card__media");
        const image = make("img"); image.alt = ""; image.loading = "lazy"; image.hidden = true;
        const placeholder = make("span", "", "⌗"); media.append(image, placeholder);
        const setCover = (source) => { if (/^data:image\/(jpeg|png|webp)[;,]/i.test(source || "")) { image.src = source; image.hidden = false; placeholder.hidden = true; } };
        if (table.cover) setCover(table.cover);
        else STORE.read(table.id).then((value) => setCover(STORE.active(value).preview)).catch(() => {});
        const copy = make("div", "table-card__copy");
        copy.append(make("small", "", openedLabel(table)), make("h3", "", table.name), make("p", "", table.description || "Uma nova cena espera pelo grupo."), make("span", "", "Preparar mesa →"));
        link.append(media, copy); article.append(link);
        const menu = make("details", "table-card__menu"); const trigger = make("summary", "", "⋯"); trigger.setAttribute("aria-label", `Opções de ${table.name}`);
        const actions = make("div", "table-card__actions");
        actions.append(button("Editar", () => { menu.open = false; openTableEditor(table.id); }), button("Duplicar", async () => {
            menu.open = false; const newId = crypto.randomUUID(); await STORE.duplicateTable(table.id, newId);
            state.campaigns.unshift({ ...table, id: newId, name: (table.name + " (cópia)").slice(0, 60), lastOpenedAt: null });
            saveState(); renderTables(); toast("Mesa duplicada com cenas e documentos privados.");
        }), button("Excluir", () => deleteTable(table.id), "is-danger"));
        menu.append(trigger, actions); article.append(menu); return article;
    }
    function renderTables() {
        const query = $("searchTables").value.trim().toLocaleLowerCase("pt-BR");
        const tables = [...state.campaigns].sort((a, b) => $("sortTables").value === "name" ? a.name.localeCompare(b.name, "pt-BR") : Date.parse(b.lastOpenedAt || b.createdAt || 0) - Date.parse(a.lastOpenedAt || a.createdAt || 0));
        const filtered = tables.filter((table) => `${table.name} ${table.description || ""}`.toLocaleLowerCase("pt-BR").includes(query));
        $("tableList").replaceChildren(...filtered.map(card));
        $("tableCount").textContent = `${state.campaigns.length} ${state.campaigns.length === 1 ? "mesa" : "mesas"}`;
        $("emptyTables").hidden = state.campaigns.length > 0;
        $("noTableResults").hidden = !state.campaigns.length || filtered.length > 0;
        const latest = [...state.campaigns].filter((table) => table.lastOpenedAt).sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt))[0];
        $("continueTable").hidden = !latest;
        if (latest) { $("continueTableName").textContent = "Continuar: " + latest.name; $("continueTable").href = PORTAL.tabletopUrl(latest.id); }
        $("ownedTableList").replaceChildren(...tables.map((table) => button(table.name + " →", () => { $("accessDialog").close(); return navigate("table", table.id); }, "owned-table-button")));
        $("ownedTablesBlock").hidden = tables.length === 0;
    }

    function renderScenes() {
        const active = STORE.active(workspace);
        $("activeSceneName").textContent = active.name;
        $("sceneCount").textContent = String(workspace.scenes.length);
        $("roomPreviewImage").hidden = !active.preview; $("roomPreviewBlank").hidden = Boolean(active.preview);
        if (active.preview) $("roomPreviewImage").src = active.preview;
        if (active.session.map?.source || active.session.tokens?.length) {
            const id = selectedTableId, sceneId = active.id;
            STORE.renderSession(active.session).then((frame) => {
                if (id !== selectedTableId || !workspace || STORE.active(workspace).id !== sceneId) return;
                $("roomPreviewImage").src = frame; $("roomPreviewImage").hidden = false; $("roomPreviewBlank").hidden = true;
            }).catch(() => {});
        }
        $("tabletopSummary").textContent = `${active.session.tokens?.length || 0} tokens · ${active.session.map?.source ? active.session.map.name || "Mapa preparado" : "Sem mapa importado"}`;
        const sceneCards = workspace.scenes.map((scene) => {
            const item = make("article", "scene-card" + (scene.id === active.id ? " is-active" : ""));
            const image = make("img"); image.alt = ""; image.loading = "lazy";
            if (scene.preview) image.src = scene.preview; else image.hidden = true;
            const cover = make("div", "scene-card__preview"); cover.append(image); if (!scene.preview) cover.append(make("span", "", "⌗"));
            item.append(cover, make("strong", "", scene.name), make("small", "", scene.id === active.id ? "Cena ativa" : `${scene.session.tokens?.length || 0} tokens`));
            const actions = make("div", "scene-card__actions");
            actions.append(button(scene.id === active.id ? "Abrir" : "Ativar", async () => {
                if (scene.id === active.id) { await flushNotes(); location.href = PORTAL.tabletopUrl(selectedTableId); return; }
                workspace = await STORE.activate(selectedTableId, scene.id); renderScenes();
                if (SHARE.isLive()) await SHARE.publishStatic(); toast("Cena ativa: " + scene.name);
            }), button("⋯", () => openSceneEditor(scene.id)));
            const extras = make("div", "scene-card__extras");
            extras.append(button("Duplicar", async () => { workspace = await STORE.updateScene(selectedTableId, scene.id, "copy"); renderScenes(); toast("Cena duplicada."); }), button("Excluir", async () => {
                if (!confirm(`Excluir a cena “${scene.name}” deste aparelho?`)) return;
                workspace = await STORE.updateScene(selectedTableId, scene.id, "delete"); renderScenes(); if (SHARE.isLive()) await SHARE.publishStatic();
                toast("Cena excluída.");
            }, "is-danger"));
            const more = make("details"); more.append(make("summary", "", "Mais opções"), extras);
            item.append(actions, more); return item;
        });
        $("sceneList").replaceChildren(...sceneCards);
    }
    function renderDocuments() {
        const nodes = documents.documents.map((doc) => {
            const row = make("article", "room-document");
            const info = make("div"); info.append(make("strong", "", doc.title), make("small", "", `${doc.kind === "image" ? "Imagem" : "Texto"} · ${documents.revealedId === doc.id ? "Revelado" : "Privado"}`));
            const actions = make("div");
            actions.append(button("Editar", () => openDocument(doc.id)), button(documents.revealedId === doc.id ? "Ocultar" : "Revelar", async () => {
                if (!SHARE.isLive()) throw new Error("Inicie a transmissão para revelar um documento.");
                const hide = documents.revealedId === doc.id;
                if (!await SHARE.sendDocument(hide ? { kind: "hide" } : { kind: "show", document: { id: doc.id, title: doc.title, kind: doc.kind, ...(doc.kind === "image" ? { image: doc.image } : { text: doc.text }) } })) throw new Error("A transmissão ainda está conectando. Tente novamente.");
                documents.revealedId = hide ? null : doc.id; await STORE.writeDocuments(selectedTableId, documents); renderDocuments(); toast(hide ? "Documento ocultado." : "Documento revelado ao grupo.");
            }), button("Excluir", async () => {
                if (!confirm(`Excluir “${doc.title}” deste aparelho?`)) return;
                if (documents.revealedId === doc.id && SHARE.isLive() && !await SHARE.sendDocument({ kind: "hide" })) throw new Error("Não foi possível ocultar o documento. Tente de novo.");
                documents.documents = documents.documents.filter((item) => item.id !== doc.id);
                if (documents.revealedId === doc.id) documents.revealedId = null;
                await STORE.writeDocuments(selectedTableId, documents); renderDocuments(); toast("Documento excluído.");
            }, "is-danger"));
            row.append(info, actions); return row;
        });
        $("roomDocumentList").replaceChildren(...(nodes.length ? nodes : [make("p", "room-hint", "Nenhum documento preparado. Adicione uma pista, carta ou imagem para a sessão.")]));
    }
    async function renderRoom() {
        const id = selectedTableId, token = roomGeneration, table = tableById(id);
        $("tableTitle").textContent = table.name; $("tableDescription").textContent = table.description || "Prepare tudo antes de encontrar o grupo.";
        $("openTabletop").href = PORTAL.tabletopUrl(id);
        $("tabletopSummary").textContent = "Abrindo suas cenas…";
        workspace = null; documents = null;
        try {
            const [loaded, docs] = await Promise.all([STORE.read(id), STORE.readDocuments(id)]);
            if (token !== roomGeneration) return;
            workspace = loaded; documents = docs;
            $("roomNotes").value = workspace.notes || "";
            renderScenes(); renderDocuments();
        } catch (error) { if (token === roomGeneration) toast("Não foi possível abrir os materiais deste aparelho. " + error.message, true); }
    }

    function openTableEditor(id = null) {
        const table = tableById(id); editingTableId = table?.id || null;
        $("tableDialogTitle").textContent = table ? "Editar mesa" : "Criar mesa";
        $("tableNameInput").value = table?.name || ""; $("tableDescriptionInput").value = table?.description || "";
        $("tableCoverInput").value = ""; $("tableRemoveCover").checked = false; $("tableFormStatus").textContent = "";
        $("tableDialog").showModal(); $("tableNameInput").focus();
    }
    function openSceneEditor(id = null) {
        if (!workspace) return;
        editingSceneId = id;
        $("sceneDialogTitle").textContent = id ? "Renomear cena" : "Nova cena";
        $("sceneNameInput").value = workspace.scenes.find((scene) => scene.id === id)?.name || "";
        $("sceneMapInput").value = ""; $("sceneMapLabel").hidden = Boolean(id); $("sceneFormStatus").textContent = "";
        $("sceneDialog").showModal(); $("sceneNameInput").focus();
    }
    function setDocumentKind() {
        const image = $("roomDocumentKind").value === "image";
        $("roomDocumentTextLabel").hidden = image; $("roomDocumentImageLabel").hidden = !image;
        $("roomDocumentText").required = !image;
    }
    function openDocument(id = null) {
        if (!documents) return;
        editingDocumentId = id; const doc = documents.documents.find((item) => item.id === id);
        $("roomDocumentTitle").value = doc?.title || ""; $("roomDocumentKind").value = doc?.kind || "text";
        $("roomDocumentText").value = doc?.text || ""; $("roomDocumentImage").value = ""; $("roomDocumentFormStatus").textContent = "";
        setDocumentKind(); $("roomDocumentDialog").showModal(); $("roomDocumentTitle").focus();
    }
    async function deleteTable(id) {
        const table = tableById(id); if (!table || !confirm(`Excluir “${table.name}”, suas cenas e documentos deste aparelho? Faça um backup se quiser recuperar depois.`)) return;
        await SHARE.endTable(id);
        const before = state.campaigns;
        state.campaigns = state.campaigns.filter((item) => item.id !== id);
        try { saveState(); } catch (error) { state.campaigns = before; throw error; }
        try { await STORE.removeTable(id); } catch (error) { state.campaigns = before; saveState(); throw error; }
        if (selectedTableId === id) { workspace = null; clearTimeout(notesTimer); await navigate("home"); } else renderTables();
        toast("Mesa removida. Uma cópia pode ser restaurada pelo backup.");
    }

    $("tableForm").addEventListener("submit", async (event) => {
        event.preventDefault(); $("tableSubmit").disabled = true;
        try {
            const existing = tableById(editingTableId), name = $("tableNameInput").value.trim(); if (!name) return;
            const coverFile = $("tableCoverInput").files?.[0];
            const cover = coverFile ? await STORE.prepareImage(coverFile, 480, 60000) : $("tableRemoveCover").checked ? null : existing?.cover || null;
            const table = { ...existing, id: existing?.id || crypto.randomUUID(), name, description: $("tableDescriptionInput").value.trim(), cover, createdAt: existing?.createdAt || new Date().toISOString(), characters: existing?.characters || [] };
            const before = [...state.campaigns];
            if (existing) state.campaigns = state.campaigns.map((item) => item.id === table.id ? table : item); else state.campaigns.unshift(table);
            try { saveState(); } catch (error) { state.campaigns = before; throw error; }
            $("tableDialog").close(); await navigate("table", table.id); toast(existing ? "Mesa atualizada." : "Sua mesa está pronta para preparar.");
        } catch (error) { $("tableFormStatus").textContent = error.message || "Não foi possível salvar a mesa."; }
        finally { $("tableSubmit").disabled = false; }
    });
    $("sceneForm").addEventListener("submit", async (event) => {
        event.preventDefault(); const capturedId = selectedTableId; $("sceneSubmit").disabled = true;
        try {
            const name = $("sceneNameInput").value.trim(); if (!name) return;
            let result;
            if (editingSceneId) result = await STORE.updateScene(capturedId, editingSceneId, "rename", name);
            else {
                const session = STORE.emptySession(), file = $("sceneMapInput").files?.[0];
                if (file) { session.map.source = await STORE.readFile(file); session.map.name = file.name; }
                result = await STORE.addScene(capturedId, name, session);
            }
            $("sceneDialog").close(); if (selectedTableId === capturedId) { workspace = result; renderScenes(); } toast("Cena salva neste aparelho.");
        } catch (error) { $("sceneFormStatus").textContent = error.message; }
        finally { $("sceneSubmit").disabled = false; }
    });
    $("roomDocumentForm").addEventListener("submit", async (event) => {
        event.preventDefault(); const capturedId = selectedTableId; $("roomDocumentSubmit").disabled = true;
        try {
            const title = $("roomDocumentTitle").value.trim(), kind = $("roomDocumentKind").value, text = $("roomDocumentText").value.trim();
            const capturedDocuments = documents;
            const existing = capturedDocuments.documents.find((doc) => doc.id === editingDocumentId);
            const file = $("roomDocumentImage").files?.[0];
            const image = kind === "image" ? (file ? await STORE.prepareImage(file) : existing?.image) : null;
            if (!title || (kind === "text" && !text) || (kind === "image" && !image)) throw new Error("Preencha o título e o conteúdo do documento.");
            const item = { id: existing?.id || crypto.randomUUID(), title, kind, text: kind === "text" ? text : "", image };
            const next = { ...capturedDocuments, documents: existing ? capturedDocuments.documents.map((doc) => doc.id === existing.id ? item : doc) : [...capturedDocuments.documents, item] };
            await STORE.writeDocuments(capturedId, next);
            if (capturedId === selectedTableId) { documents = next; if (documents.revealedId === item.id && SHARE.isLive()) await SHARE.sendDocument({ kind: "show", document: item }); renderDocuments(); }
            $("roomDocumentDialog").close(); toast("Documento salvo.");
        } catch (error) { $("roomDocumentFormStatus").textContent = error.message; }
        finally { $("roomDocumentSubmit").disabled = false; }
    });
    $("roomNotes").addEventListener("input", () => {
        clearTimeout(notesTimer); $("notesStatus").textContent = "Salvando…";
        notesTimer = setTimeout(() => flushNotes().catch(() => { $("notesStatus").textContent = "Falha ao salvar · tente novamente"; }), 500);
    });
    $("openTabletop").addEventListener("click", async (event) => { event.preventDefault(); try { await flushNotes(); location.href = PORTAL.tabletopUrl(selectedTableId); } catch { toast("Não foi possível salvar as anotações.", true); } });
    $("continueTable").addEventListener("click", () => {
        const table = [...state.campaigns].filter((item) => item.lastOpenedAt).sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt))[0];
        try { if (table) markOpened(table.id); } catch { /* A mesa ainda pode ser aberta se o armazenamento da lista estiver cheio. */ }
    });
    $("exportTable").addEventListener("click", async () => {
        try {
            await flushNotes(); const id = selectedTableId;
            const [tableWorkspace, docs] = await Promise.all([STORE.read(id), STORE.readDocuments(id)]);
            const backup = { type: "real-table-backup", version: 1, table: tableById(id), workspace: tableWorkspace, documents: { ...docs, revealedId: null } };
            const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
            const link = document.createElement("a"); link.href = url; link.download = "real-mesa-backup.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast("Backup da mesa preparado.");
        } catch (error) { toast(error.message, true); }
    });
    $("importTable").addEventListener("change", async () => {
        try {
            const file = $("importTable").files?.[0]; if (!file) return;
            if (file.size > 120_000_000) throw new Error("O backup deve ter até 120 MB.");
            const backup = JSON.parse(await file.text());
            if (backup.type !== "real-table-backup" || backup.version !== 1 || !Array.isArray(backup.workspace?.scenes) || !backup.workspace.scenes.length || backup.workspace.scenes.length > 50 || !Array.isArray(backup.documents?.documents)) throw new Error("Este arquivo não é um backup válido da mesa.");
            const newId = crypto.randomUUID();
            await STORE.restoreBackup(newId, backup.workspace, backup.documents);
            const cover = typeof backup.table?.cover === "string" && /^data:image\/(png|jpeg|webp)[;,]/i.test(backup.table.cover) && backup.table.cover.length <= 60000 ? backup.table.cover : null;
            state.campaigns.unshift({ id: newId, name: String(backup.table?.name || "Mesa restaurada").slice(0, 60), description: String(backup.table?.description || "").slice(0, 240), cover, createdAt: new Date().toISOString(), characters: [] });
            saveState(); await navigate("table", newId); toast("Backup restaurado em uma nova mesa.");
        } catch (error) { toast(error.message || "Não foi possível restaurar o backup.", true); }
        finally { $("importTable").value = ""; }
    });

    $("createTable").addEventListener("click", () => openTableEditor());
    $("accessTable").addEventListener("click", () => { $("inviteInput").value = ""; $("inviteMessage").textContent = ""; renderTables(); $("accessDialog").showModal(); $("inviteInput").focus(); });
    $("accessForm").addEventListener("submit", (event) => { event.preventDefault(); const code = PORTAL.extractInvite($("inviteInput").value, location.href); if (!code) { $("inviteMessage").textContent = "Cole um link ou código válido enviado pelo mestre."; return; } location.href = PORTAL.guestUrl(code); });
    $("backToHome").addEventListener("click", () => navigate("home"));
    $("editTable").addEventListener("click", () => openTableEditor(selectedTableId));
    $("deleteTable").addEventListener("click", () => deleteTable(selectedTableId).catch((error) => toast(error.message, true)));
    $("addScene").addEventListener("click", () => openSceneEditor());
    $("addDocument").addEventListener("click", () => openDocument());
    $("roomDocumentKind").addEventListener("change", setDocumentKind);
    $("searchTables").addEventListener("input", renderTables); $("sortTables").addEventListener("change", renderTables);
    for (const [dialog, buttons] of [["tableDialog", ["closeTableDialog", "cancelTableDialog"]], ["accessDialog", ["closeAccessDialog"]], ["sceneDialog", ["closeSceneDialog", "cancelSceneDialog"]], ["roomDocumentDialog", ["closeRoomDocument", "cancelRoomDocument"]]]) {
        buttons.forEach((id) => $(id).addEventListener("click", () => $(dialog).close()));
        $(dialog).addEventListener("click", (event) => { if (event.target === $(dialog)) $(dialog).close(); });
    }
    async function followRoute() {
        let value; try { value = decodeURIComponent(location.hash.slice(1)); } catch { value = ""; }
        const id = value.startsWith("mesa/") ? value.slice(5) : value.startsWith("campanha/") ? value.slice(9) : null;
        try { await navigate(id ? "table" : "home", id, true); }
        catch (error) { toast(error.message || "Não foi possível abrir a sala.", true); }
    }
    window.addEventListener("hashchange", followRoute);
    window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) { state = loadState(); if (!selectedTableId) renderTables(); } });
    window.addEventListener("real:library-updated", () => { state = loadState(); if (!selectedTableId) renderTables(); });
    async function refreshRoomDocuments() {
        const id = selectedTableId;
        if (!id) return;
        try {
            const loaded = await STORE.readDocuments(id);
            if (id === selectedTableId) { documents = loaded; renderDocuments(); }
        } catch { toast("Não foi possível atualizar os documentos deste aparelho.", true); }
    }
    window.addEventListener("real:room-documents-refresh", refreshRoomDocuments);
    window.addEventListener("real:workspace-changed", async (event) => {
        if (event.detail?.kind !== "documents" || event.detail.tableId !== selectedTableId) return;
        await refreshRoomDocuments();
    });
    window.addEventListener("focus", async () => {
        if (!selectedTableId || !workspace) return;
        const id = selectedTableId, next = await STORE.read(id).catch(() => null);
        if (next && id === selectedTableId) { workspace = next; renderScenes(); await refreshRoomDocuments(); }
    });
    window.addEventListener("beforeunload", (event) => { if (workspace && workspace.notes !== $("roomNotes").value) { event.preventDefault(); event.returnValue = ""; } });
    renderTables(); followRoute();
})();
