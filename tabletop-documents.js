// Biblioteca privada do mestre. Apenas o documento revelado sai deste navegador.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const campaignKey = window.REAL_TABLETOP_MASTER?.campaignKey || "autosave";
    const databaseName = "real-tabletop-documents-v1";
    const storeName = "campaigns";
    const form = $("hudDocumentForm");
    const list = $("hudDocumentList");
    const kind = $("hudDocumentKind");
    let documents = [];
    let revealedId = null;
    let editingId = null;
    let savedImage = null;
    let ready = false;
    let saving = Promise.resolve();

    function status(message) { $("hudDocumentStatus").textContent = message; }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(storeName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function readLibrary() {
        const database = await openDatabase();
        try {
            return await new Promise((resolve, reject) => {
                const transaction = database.transaction(storeName, "readonly");
                const request = transaction.objectStore(storeName).get(campaignKey);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } finally { database.close(); }
    }

    async function writeLibrary(value) {
        const database = await openDatabase();
        try {
            await new Promise((resolve, reject) => {
                const transaction = database.transaction(storeName, "readwrite");
                transaction.objectStore(storeName).put(value, campaignKey);
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            });
        } finally { database.close(); }
    }

    function persist() {
        const snapshot = { documents: documents.map((item) => ({ ...item })), revealedId };
        saving = saving.catch(() => {}).then(() => writeLibrary(snapshot));
        return saving;
    }

    function setKind() {
        const image = kind.value === "image";
        $("hudDocumentTextLabel").hidden = image;
        $("hudDocumentImageLabel").hidden = !image;
        $("hudDocumentImageHint").hidden = !image || !savedImage;
        $("hudDocumentText").required = !image;
        $("hudDocumentImage").required = image && !savedImage;
    }

    function resetForm() {
        form.reset();
        editingId = null;
        savedImage = null;
        $("hudDocumentFormTitle").textContent = "Novo documento";
        $("hudDocumentSave").textContent = "Salvar documento";
        $("hudDocumentCancel").hidden = true;
        $("hudDocumentImageHint").textContent = "";
        setKind();
    }

    function makeButton(label, className, action) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", action);
        return button;
    }

    function render() {
        list.replaceChildren();
        $("hudDocumentEmpty").hidden = documents.length > 0;
        documents.forEach((item) => {
            const row = document.createElement("li");
            row.className = "hud-documents__item";
            const heading = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = item.title;
            const badge = document.createElement("small");
            badge.textContent = revealedId === item.id ? "Revelado" : "Privado";
            heading.append(title, badge);
            const actions = document.createElement("div");
            actions.className = "hud-documents__item-actions";
            actions.append(
                makeButton(revealedId === item.id ? "Ocultar" : "Revelar", "hud-documents__reveal", () => reveal(item.id)),
                makeButton("Editar", "", () => edit(item.id)),
                makeButton("Excluir", "", () => remove(item.id))
            );
            row.append(heading, actions);
            list.appendChild(row);
        });
    }

    function edit(id) {
        const item = documents.find((entry) => entry.id === id);
        if (!item) return;
        editingId = id;
        savedImage = item.image || null;
        $("hudDocumentTitle").value = item.title;
        kind.value = item.kind;
        $("hudDocumentText").value = item.text || "";
        $("hudDocumentImage").value = "";
        $("hudDocumentImageHint").textContent = savedImage ? "Imagem atual mantida se você não escolher outra." : "";
        $("hudDocumentFormTitle").textContent = "Editar documento";
        $("hudDocumentSave").textContent = "Salvar alterações";
        $("hudDocumentCancel").hidden = false;
        setKind();
        $("hudDocumentTitle").focus();
    }

    function imageData(file) {
        return new Promise((resolve, reject) => {
            if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8_000_000) {
                reject(new Error("Escolha uma imagem PNG, JPG ou WebP de até 8 MB."));
                return;
            }
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(url);
                const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                const context = canvas.getContext("2d");
                if (!context) { reject(new Error("Não foi possível preparar a imagem.")); return; }
                context.fillStyle = "#f5f0eb";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                for (const quality of [.8, .65, .5, .35, .25]) {
                    const data = canvas.toDataURL("image/jpeg", quality);
                    if (data.length <= 180_000) { resolve(data); return; }
                }
                reject(new Error("Esta imagem ficou grande demais para a transmissão. Tente uma menor."));
            };
            image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem.")); };
            image.src = url;
        });
    }

    function publicDocument(item) {
        return { id: item.id, title: item.title, kind: item.kind,
            ...(item.kind === "image" ? { image: item.image } : { text: item.text }) };
    }

    async function sendCurrent(viewerId) {
        await loaded;
        const item = documents.find((entry) => entry.id === revealedId);
        if (item) await window.REAL_TABLETOP_ONLINE?.sendDocument({ kind: "show", viewerId, document: publicDocument(item) });
    }

    async function reveal(id) {
        await loaded;
        const item = documents.find((entry) => entry.id === id);
        if (!item) return;
        const live = window.REAL_TABLETOP_ONLINE;
        if (!live?.isLive()) { status("Inicie a transmissão antes de revelar um documento."); return; }
        const nextId = revealedId === id ? null : id;
        const payload = nextId ? { kind: "show", document: publicDocument(item) } : { kind: "hide" };
        if (!await live.sendDocument(payload)) { status("Não foi possível enviar. Confira a conexão da mesa e tente de novo."); return; }
        revealedId = nextId;
        try { await persist(); status(nextId ? `“${item.title}” revelado aos espectadores.` : "Documento ocultado dos espectadores."); }
        catch { status("Documento enviado, mas não foi possível salvar esse estado localmente."); }
        render();
    }

    async function remove(id) {
        const item = documents.find((entry) => entry.id === id);
        if (!item || !confirm(`Excluir “${item.title}” deste navegador?`)) return;
        if (revealedId === id && window.REAL_TABLETOP_ONLINE?.isLive()) {
            if (!await window.REAL_TABLETOP_ONLINE.sendDocument({ kind: "hide" })) {
                status("Não foi possível ocultar o documento na transmissão. Tente novamente."); return;
            }
        }
        documents = documents.filter((entry) => entry.id !== id);
        if (revealedId === id) revealedId = null;
        if (editingId === id) resetForm();
        try { await persist(); status("Documento excluído deste navegador."); }
        catch { status("Não foi possível salvar a exclusão."); }
        render();
    }

    const loaded = readLibrary().then((value) => {
        documents = Array.isArray(value?.documents) ? value.documents : [];
        revealedId = typeof value?.revealedId === "string" ? value.revealedId : null;
        ready = true;
        render();
        status("Documentos guardados somente neste navegador.");
    }).catch(() => {
        status("Não foi possível abrir os documentos locais. Verifique o armazenamento do navegador.");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!ready || !form.reportValidity()) return;
        const title = $("hudDocumentTitle").value.trim();
        const text = $("hudDocumentText").value.trim();
        if (!title || (kind.value === "text" && !text)) { status("Preencha o título e o conteúdo do documento."); return; }
        const button = $("hudDocumentSave");
        button.disabled = true;
        try {
            const file = $("hudDocumentImage").files?.[0];
            const image = kind.value === "image" ? (file ? await imageData(file) : savedImage) : null;
            if (kind.value === "image" && !image) { status("Escolha uma imagem."); return; }
            const existing = documents.find((entry) => entry.id === editingId);
            const item = { id: existing?.id || crypto.randomUUID(), title, kind: kind.value,
                text: kind.value === "text" ? text : "", image };
            const next = existing ? documents.map((entry) => entry.id === item.id ? item : entry) : [...documents, item];
            const previous = documents;
            documents = next;
            try { await persist(); }
            catch (error) { documents = previous; throw error; }
            if (revealedId === item.id && window.REAL_TABLETOP_ONLINE?.isLive()) {
                if (!await window.REAL_TABLETOP_ONLINE.sendDocument({ kind: "show", document: publicDocument(item) })) {
                    status("Salvo localmente, mas a atualização não chegou aos espectadores. Revele novamente.");
                } else status("Documento atualizado e enviado aos espectadores.");
            } else status("Documento salvo neste navegador. Continua privado até você revelar.");
            resetForm();
            render();
        } catch (error) { status(error?.message?.startsWith("Escolha") || error?.message?.includes("imagem")
            ? error.message : "Não foi possível salvar. Verifique o espaço disponível no navegador."); }
        finally { button.disabled = false; }
    });
    kind.addEventListener("change", setKind);
    $("hudDocumentCancel").addEventListener("click", resetForm);
    window.addEventListener("real:tabletop-stopped", () => {
        revealedId = null;
        if (ready) persist().catch(() => status("Não foi possível atualizar os documentos locais."));
        render();
    });
    window.REAL_TABLETOP_DOCUMENTS = { sendCurrent };
    setKind();
})();
