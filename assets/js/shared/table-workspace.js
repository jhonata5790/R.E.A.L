// Cenas e materiais privados no aparelho. Mantém o salvamento antigo como cópia compatível.
(function (scope) {
    "use strict";
    const databaseName = "real-table-workspace-v1";
    const storeName = "tables";
    const queues = new Map();
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const now = () => new Date().toISOString();
    const id = () => crypto.randomUUID();
    const channel = typeof window !== "undefined" && typeof BroadcastChannel === "function" ? new BroadcastChannel("real-table-workspace") : null;

    function notify(tableId, kind = "workspace") {
        const detail = { tableId, kind };
        scope.dispatchEvent?.(new CustomEvent("real:workspace-changed", { detail }));
        channel?.postMessage(detail);
    }
    if (channel) channel.onmessage = ({ data }) => {
        if (typeof data?.tableId === "string") scope.dispatchEvent(new CustomEvent("real:workspace-changed", { detail: data }));
    };

    function open(name, store) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(name, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function get(name, store, key) {
        const db = await open(name, store);
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(store, "readonly");
                const request = tx.objectStore(store).get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } finally { db.close(); }
    }

    async function put(name, store, key, value) {
        const db = await open(name, store);
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(store, "readwrite");
                if (value === null) tx.objectStore(store).delete(key);
                else tx.objectStore(store).put(value, key);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        } finally { db.close(); }
    }

    function emptySession() {
        return { version: 1, camera: { x: 0, y: 0, zoom: 1 },
            playerView: { x: -600, y: -337.5, width: 1200, height: 675 },
            grid: { visible: false, snapTokens: false, size: 50, opacity: .32, offsetX: 0, offsetY: 0, metersPerSquare: 3 },
            map: { source: null, name: "Nenhum mapa", x: 0, y: 0, scale: 1 }, tokens: [], selectedTokenIds: [] };
    }

    function normalize(value, legacy = null) {
        if (value?.version === 1 && Array.isArray(value.scenes) && value.scenes.length) {
            const result = clone(value);
            if (!result.scenes.some((scene) => scene.id === result.activeSceneId)) result.activeSceneId = result.scenes[0].id;
            return result;
        }
        return { version: 1, notes: "", activeSceneId: "scene-initial",
            scenes: [{ id: "scene-initial", name: legacy?.map?.source ? (legacy.map.name || "Cena inicial") : "Cena inicial",
                session: clone(legacy || emptySession()), preview: null, updatedAt: legacy?.savedAt || now() }] };
    }

    async function read(tableId) {
        const saved = await get(databaseName, storeName, tableId);
        if (saved) return normalize(saved);
        let legacy = await get("tabletop2d-storage", "sessions", tableId === "autosave" ? "autosave" : "campaign:" + tableId);
        if (!legacy && tableId === "campanha-inicial") legacy = await get("tabletop2d-storage", "sessions", "autosave");
        const initial = normalize(null, legacy);
        if (legacy?.map?.source) initial.scenes[0].preview = await renderSession(legacy, 320).catch(() => null);
        // A outra aba pode ter concluído a migração enquanto as imagens eram preparadas.
        return mutate(tableId, (value) => value || initial, false);
    }

    function enqueue(tableId, work) {
        const previous = queues.get(tableId) || Promise.resolve();
        const next = previous.catch(() => {}).then(work);
        queues.set(tableId, next);
        next.finally(() => { if (queues.get(tableId) === next) queues.delete(tableId); }).catch(() => {});
        return next;
    }

    function mutate(tableId, change, announce = true) {
        return enqueue(tableId, async () => {
            const db = await open(databaseName, storeName);
            try {
                const result = await new Promise((resolve, reject) => {
                    const tx = db.transaction(storeName, "readwrite");
                    const store = tx.objectStore(storeName);
                    const request = store.get(tableId);
                    let updated;
                    request.onsuccess = () => {
                        try { updated = change(request.result ? normalize(request.result) : null); store.put(updated, tableId); }
                        catch (error) { reject(error); tx.abort(); }
                    };
                    tx.oncomplete = () => resolve(updated);
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(tx.error || new Error("Salvamento interrompido"));
                });
                if (announce) notify(tableId);
                return result;
            } finally { db.close(); }
        });
    }

    const active = (workspace) => workspace.scenes.find((scene) => scene.id === workspace.activeSceneId) || workspace.scenes[0];

    async function saveSession(tableId, session, preview = null) {
        await read(tableId);
        return mutate(tableId, (workspace) => {
            const target = workspace.scenes.find((scene) => scene.id === session.sceneId) || (!session.sceneId ? active(workspace) : null);
            if (!target) throw new Error("Esta cena foi removida em outra aba. Salve uma cópia antes de continuar.");
            target.session = clone(session); target.session.sceneId = target.id;
            target.updatedAt = now();
            if (preview) target.preview = preview;
            return workspace;
        });
    }

    async function addScene(tableId, name, session = emptySession()) {
        await read(tableId);
        const preview = session.map?.source || session.tokens?.length ? await renderSession(session, 320).catch(() => null) : null;
        return mutate(tableId, (workspace) => {
            if (workspace.scenes.length >= 50) throw new Error("Uma mesa pode ter até 50 cenas.");
            workspace.scenes.push({ id: id(), name: name.trim().slice(0, 60) || "Nova cena", session: clone(session), preview, updatedAt: now() });
            return workspace;
        });
    }

    async function activate(tableId, sceneId) {
        await read(tableId);
        return mutate(tableId, (workspace) => {
            if (!workspace.scenes.some((scene) => scene.id === sceneId)) throw new Error("Cena não encontrada");
            workspace.activeSceneId = sceneId; return workspace;
        });
    }

    async function updateScene(tableId, sceneId, action, name = "") {
        await read(tableId);
        return mutate(tableId, (workspace) => {
            const scene = workspace.scenes.find((entry) => entry.id === sceneId);
            if (!scene) throw new Error("Cena não encontrada");
            if (action === "rename") scene.name = name.trim().slice(0, 60) || scene.name;
            if (action === "copy") {
                if (workspace.scenes.length >= 50) throw new Error("Limite de 50 cenas atingido");
                const copy = clone(scene); copy.id = id(); copy.name = (scene.name + " (cópia)").slice(0, 60);
                delete copy.session.sceneId; workspace.scenes.push(copy);
            }
            if (action === "delete") {
                if (workspace.scenes.length === 1) throw new Error("Mantenha pelo menos uma cena nesta mesa.");
                workspace.scenes = workspace.scenes.filter((entry) => entry.id !== sceneId);
                if (workspace.activeSceneId === sceneId) workspace.activeSceneId = workspace.scenes[0].id;
            }
            return workspace;
        });
    }

    async function saveNotes(tableId, notes) {
        await read(tableId);
        return mutate(tableId, (workspace) => { workspace.notes = String(notes).slice(0, 20000); return workspace; });
    }

    async function readDocuments(tableId) {
        return await get("real-tabletop-documents-v1", "campaigns", tableId) || { documents: [], revealedId: null };
    }
    async function writeDocuments(tableId, value) {
        await put("real-tabletop-documents-v1", "campaigns", tableId, value);
        notify(tableId, "documents");
    }

    async function duplicateTable(sourceId, targetId) {
        const workspace = await read(sourceId);
        await put(databaseName, storeName, targetId, workspace);
        const documents = await readDocuments(sourceId);
        await writeDocuments(targetId, { documents: documents.documents, revealedId: null });
    }
    async function removeTable(tableId) {
        await put(databaseName, storeName, tableId, null);
        await put("tabletop2d-storage", "sessions", tableId === "autosave" ? "autosave" : "campaign:" + tableId, null);
        await put("real-tabletop-documents-v1", "campaigns", tableId, null);
        notify(tableId);
    }

    async function restoreBackup(tableId, source, sourceDocuments) {
        if (!Array.isArray(source?.scenes) || !source.scenes.length || source.scenes.length > 50) throw new Error("Cenas do backup inválidas");
        const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
        const asset = (value, max = 24_000_000) => typeof value === "string" && /^data:image\/(png|jpeg|webp)[;,]/i.test(value) && value.length <= max ? value : null;
        const scenes = source.scenes.map((entry) => {
            if (!entry || typeof entry.session !== "object" || !entry.session) throw new Error("Cena incompleta no backup");
            const original = entry.session, session = emptySession();
            session.camera = { x: number(original.camera?.x, 0, -1e7, 1e7), y: number(original.camera?.y, 0, -1e7, 1e7), zoom: number(original.camera?.zoom, 1, .25, 3) };
            const width = number(original.playerView?.width, 1200, 400, 4000);
            session.playerView = { x: number(original.playerView?.x, -600, -1e7, 1e7), y: number(original.playerView?.y, -337.5, -1e7, 1e7), width, height: width * 9 / 16 };
            session.grid = { ...session.grid, visible: original.grid?.visible === true, snapTokens: original.grid?.snapTokens === true,
                size: number(original.grid?.size, 50, 10, 300), opacity: number(original.grid?.opacity, .32, .05, 1),
                offsetX: number(original.grid?.offsetX, 0, -1e7, 1e7), offsetY: number(original.grid?.offsetY, 0, -1e7, 1e7), metersPerSquare: number(original.grid?.metersPerSquare, 3, .5, 15) };
            session.map = { source: asset(original.map?.source), name: String(original.map?.name || "Mapa importado").slice(0, 120), x: number(original.map?.x, 0, -1e7, 1e7), y: number(original.map?.y, 0, -1e7, 1e7), scale: number(original.map?.scale, 1, .25, 2.5) };
            if ((original.tokens?.length || 0) > 2000) throw new Error("O backup tem tokens demais numa cena");
            session.tokens = (Array.isArray(original.tokens) ? original.tokens : []).filter((token) => asset(token?.source)).map((token, index) => ({
                id: index + 1, name: String(token.name || "Token").slice(0, 80), source: asset(token.source),
                x: number(token.x, 0, -1e7, 1e7), y: number(token.y, 0, -1e7, 1e7), width: number(token.width, 100, 40, 500), rotation: number(token.rotation, 0, -100, 100),
                type: ["player", "ally", "enemy", "neutral"].includes(token.type) ? token.type : "player", color: /^#[0-9a-f]{6}$/i.test(token.color || "") ? token.color : "#4ade80",
                hp: number(token.hp, 10, 0, 1e6), maxHp: number(token.maxHp, 10, 1, 1e6), condition: String(token.condition || "").slice(0, 120),
                visibleToPlayers: token.visibleToPlayers !== false, showName: token.showName !== false, showHealth: token.showHealth !== false
            }));
            return { id: String(entry.id || id()).slice(0, 80), name: String(entry.name || "Cena").slice(0, 60), session, preview: asset(entry.preview, 200000), updatedAt: now() };
        });
        if (new Set(scenes.map((scene) => scene.id)).size !== scenes.length) throw new Error("Cenas com identificadores repetidos no backup");
        const docs = (Array.isArray(sourceDocuments?.documents) ? sourceDocuments.documents : []).slice(0, 200).map((doc) => ({ id: id(), title: String(doc?.title || "Documento").slice(0, 80), kind: doc?.kind === "image" ? "image" : "text", text: String(doc?.text || "").slice(0, 12000), image: asset(doc?.image, 180000) }));
        await put(databaseName, storeName, tableId, { version: 1, scenes, notes: String(source.notes || "").slice(0, 20000), activeSceneId: scenes.some((scene) => scene.id === source.activeSceneId) ? source.activeSceneId : scenes[0].id });
        await writeDocuments(tableId, { documents: docs, revealedId: null });
    }

    function loadImage(source) {
        return new Promise((resolve, reject) => {
            if (!/^data:image\/(png|jpeg|webp)[;,]/i.test(source || "")) { reject(new Error("Imagem inválida")); return; }
            const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Não foi possível ler a imagem")); image.src = source;
        });
    }

    async function renderSession(session, width = 720) {
        const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = Math.round(width * 9 / 16);
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#070509"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const view = session.playerView || emptySession().playerView;
        const scale = width / view.width;
        ctx.save(); ctx.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale);
        if (session.map?.source) {
            const map = session.map; const image = await loadImage(map.source);
            const w = image.width * (map.scale || 1), h = image.height * (map.scale || 1);
            ctx.drawImage(image, (map.x || 0) - w / 2, (map.y || 0) - h / 2, w, h);
        }
        if (session.grid?.visible && session.grid.size > 0 && view.width / session.grid.size < 300) {
            const grid = session.grid, size = grid.size;
            ctx.beginPath();
            for (let x = Math.ceil((view.x - grid.offsetX) / size) * size + grid.offsetX; x <= view.x + view.width; x += size) { ctx.moveTo(x, view.y); ctx.lineTo(x, view.y + view.height); }
            for (let y = Math.ceil((view.y - grid.offsetY) / size) * size + grid.offsetY; y <= view.y + view.height; y += size) { ctx.moveTo(view.x, y); ctx.lineTo(view.x + view.width, y); }
            ctx.strokeStyle = `rgba(205,38,61,${grid.opacity || .32})`; ctx.lineWidth = 1 / scale; ctx.stroke();
        }
        for (const token of (session.tokens || []).filter((entry) => entry.visibleToPlayers !== false && entry.source)) {
            const image = await loadImage(token.source).catch(() => null); if (!image) continue;
            const h = token.width * image.height / image.width;
            ctx.save(); ctx.translate(token.x, token.y); ctx.rotate(token.rotation || 0);
            ctx.drawImage(image, -token.width / 2, -h / 2, token.width, h); ctx.restore();
            let labelY = token.y + h / 2 + 14 / scale;
            if (token.showName) {
                ctx.font = `600 ${12 / scale}px Segoe UI, Arial`; ctx.textAlign = "center"; ctx.lineWidth = 3 / scale;
                ctx.strokeStyle = "#070509"; ctx.strokeText(token.name, token.x, labelY); ctx.fillStyle = "#fff1f3"; ctx.fillText(token.name, token.x, labelY); labelY += 7 / scale;
            }
            if (token.showHealth) {
                const barWidth = Math.max(60 / scale, token.width);
                ctx.fillStyle = "#070509"; ctx.fillRect(token.x - barWidth / 2, labelY, barWidth, 5 / scale);
                ctx.fillStyle = token.color || "#4ade80"; ctx.fillRect(token.x - barWidth / 2, labelY, barWidth * Math.max(0, Math.min(1, token.hp / token.maxHp)), 5 / scale);
            }
        }
        ctx.restore(); return canvas.toDataURL("image/jpeg", .65);
    }

    function readFile(file, types = ["image/png"], max = 16_000_000) {
        return new Promise((resolve, reject) => {
            if (!file || !types.includes(file.type) || file.size > max) { reject(new Error("Escolha uma imagem no formato permitido, de até 16 MB.")); return; }
            const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Não foi possível abrir o arquivo")); reader.readAsDataURL(file);
        });
    }

    async function prepareImage(file, maxSide = 1000, maxLength = 180000) {
        const source = await readFile(file, ["image/png", "image/jpeg", "image/webp"]);
        const image = await loadImage(source);
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio));
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#181018"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [.8, .65, .5, .35, .25]) { const value = canvas.toDataURL("image/jpeg", quality); if (value.length <= maxLength) return value; }
        throw new Error("Imagem grande demais. Tente um arquivo menor.");
    }

    const api = { read, active, emptySession, saveSession, addScene, activate, updateScene, saveNotes,
        readDocuments, writeDocuments, duplicateTable, removeTable, restoreBackup, renderSession, readFile, prepareImage, normalize,
        announceDocuments: (tableId) => notify(tableId, "documents") };
    scope.REAL_TABLE_WORKSPACE = Object.freeze(api);
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
