// TABLETOP 2D — MESA TÁTICA

const $ = (id) => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const panels = { grid: $("gridPanel"), tokens: $("tokenPanel"), session: $("sessionPanel"), view: $("playerViewPanel"), transmission: $("transmissionPanel"), scenes: $("scenesPanel") };
const panelButtons = { grid: $("toolMap"), tokens: $("toolToken"), session: $("toolSession"), view: $("toolPlayerView"), transmission: $("toolTransmission"), scenes: $("toolScenes") };
const toolbar = $("toolbar");
const dockToggle = $("toggleToolDock");
dockToggle.addEventListener("click", () => {
    const opening = toolbar.hidden;
    if (!opening && toolbar.contains(document.activeElement)) dockToggle.focus();
    toolbar.hidden = !opening;
    document.body.classList.toggle("tool-dock-collapsed", !opening);
    dockToggle.setAttribute("aria-expanded", String(opening));
    dockToggle.setAttribute("aria-label", opening ? "Recolher ferramentas da mesa" : "Abrir ferramentas da mesa");
});
const VIEW_RULES = window.REAL_TABLETOP_VIEW;
const SELECTION_RULES = window.REAL_TABLETOP_SELECTION;
const SHORTCUTS = window.REAL_TABLETOP_SHORTCUTS;
const WORKSPACE = window.REAL_TABLE_WORKSPACE;
let currentSceneId = null;
const previewDialog = $("playerPreview");
const previewCanvas = $("playerPreviewCanvas");
const previewCtx = previewCanvas.getContext("2d");
let playerStream = null;
let playerStreamTrack = null;
let playerFrameTimer = null;
let lastPlayerFrameAt = 0;

const THEME = { background: "#070509", grid: "#cd263d", accent: "#fb3b53", accentSoft: "#fecdd3" };
const DEFAULT_GRID = { visible: false, snapTokens: false, size: 50, opacity: 0.32, offsetX: 0, offsetY: 0, metersPerSquare: 3 };
const TYPE_COLORS = { player: "#4ade80", ally: "#38bdf8", enemy: "#fb3b53", neutral: "#facc15" };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const MIN_TOKEN_SIZE = 40;
const MAX_TOKEN_SIZE = 500;
const RESIZE_HANDLE_RADIUS = 17;
const ROTATION_HANDLE_RADIUS = 17;
const ROTATION_HANDLE_GAP = 28;

const camera = { x: 0, y: 0, zoom: 1 };
const playerView = VIEW_RULES.normalize();
const gridSettings = { ...DEFAULT_GRID };
const mapState = {
    image: new Image(), loaded: false, source: null,
    name: "Nenhum mapa", x: 0, y: 0, scale: 1
};

const tokens = [];
let selectedToken = null;
const selectedTokens = new Set();
let nextTokenId = 1;
let activeMode = "select";
let hudVisible = true;
let renderFrameRequested = false;
let saveTimer = null;

const interaction = {
    type: null, token: null, lastX: 0, lastY: 0,
    offsetX: 0, offsetY: 0, rotationOffset: 0, resizeOffset: 0,
    tokens: [], anchorStart: null, marqueeStart: null, marqueeEnd: null,
    selectionBeforeMarquee: [], additive: false, moved: false
};
const measurement = { drawing: false, start: null, end: null };
let followingPlayer = null;
let lastMouse = null;
let tokenClipboard = [];
let pasteCount = 0;
let historyReady = false;
let restoringHistory = false;
let sceneLoading = false;

function captureSceneState() {
    return {
        camera: { ...camera }, playerView: { ...playerView }, grid: { ...gridSettings },
        map: { ...mapState }, tokens: tokens.map((token) => ({ ...token })),
        selectedIds: selectedTokenList().map((token) => token.id), primaryId: selectedToken?.id
    };
}

function sameSceneState(a, b) {
    const equal = (left, right) => Object.keys(left).length === Object.keys(right).length
        && Object.keys(left).every((key) => left[key] === right[key]);
    return equal(a.camera, b.camera) && equal(a.playerView, b.playerView) && equal(a.grid, b.grid)
        && equal(a.map, b.map) && a.tokens.length === b.tokens.length
        && a.tokens.every((token, index) => equal(token, b.tokens[index]));
}

const sceneHistory = SHORTCUTS.createHistory(sameSceneState);

function recordSceneState() {
    if (!historyReady || restoringHistory || sceneLoading || followingPlayer) return;
    sceneHistory.record(captureSceneState());
    updateHistoryUI();
}

function updateHistoryUI() {
    $("undoScene").disabled = !sceneHistory.canUndo;
    $("redoScene").disabled = !sceneHistory.canRedo;
}

function restoreSceneState(state) {
    restoringHistory = true;
    resetInteraction();
    clearMeasurement();
    setMode("select");
    Object.assign(camera, state.camera);
    Object.assign(playerView, state.playerView);
    Object.assign(gridSettings, state.grid);
    Object.assign(mapState, state.map);
    tokens.splice(0, tokens.length, ...state.tokens.map((token) => ({ ...token })));
    nextTokenId = Math.max(nextTokenId, ...tokens.map((token) => token.id + 1));
    const selection = tokens.filter((token) => state.selectedIds.includes(token.id));
    setTokenSelection(selection, tokens.find((token) => token.id === state.primaryId));
    updateMapUI(); updateGridUI(); updateEmptyTabletop(); updatePlayerViewUI();
    requestRender(); scheduleSave();
    restoringHistory = false;
    updateHistoryUI();
}

function travelHistory(direction) {
    if (!historyReady || sceneLoading) return;
    if (followingPlayer) cancelPlayerFollow();
    if (interaction.type || measurement.drawing) return;
    const state = sceneHistory[direction]();
    if (state) {
        restoreSceneState(state);
        shortcutNotice(direction === "undo" ? "Alteração desfeita" : "Alteração refeita");
    }
}

// Renderização sob demanda
function requestRender() {
    if (renderFrameRequested) return;
    renderFrameRequested = true;
    requestAnimationFrame(() => {
        renderFrameRequested = false;
        draw();
        window.dispatchEvent(new Event("real:tabletop-ui"));
        if (previewDialog.open || playerStream) {
            drawPlayerPreview();
            requestPlayerStreamFrame();
        }
    });
}

function requestPlayerStreamFrame(force = false) {
    if (!playerStreamTrack || typeof playerStreamTrack.requestFrame !== "function") return;
    const now = performance.now();
    const wait = Math.max(0, 125 - (now - lastPlayerFrameAt));
    if (force || wait === 0) {
        clearTimeout(playerFrameTimer);
        playerFrameTimer = null;
        lastPlayerFrameAt = now;
        try { playerStreamTrack.requestFrame(); }
        catch { /* O fallback automático do navegador mantém a transmissão. */ }
        return;
    }
    if (!playerFrameTimer) {
        playerFrameTimer = setTimeout(() => {
            playerFrameTimer = null;
            requestPlayerStreamFrame(true);
        }, wait);
    }
}

function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    requestRender();
}
window.addEventListener("resize", resizeCanvas);

// Carregamento de imagens
function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = source;
    });
}

function isImportedImage(source) {
    return typeof source === "string" && source.startsWith("data:image/");
}

function updateEmptyTabletop() {
    $("emptyTabletop").hidden = mapState.loaded;
}

function clearMap(shouldSave = true) {
    Object.assign(mapState, {
        image: new Image(), loaded: false, source: null,
        name: "Nenhum mapa", x: 0, y: 0, scale: 1
    });
    gridSettings.visible = false;
    updateMapUI(); updateGridUI(); updateEmptyTabletop(); requestRender();
    if (shouldSave) scheduleSave();
}

async function setMapSource(source, name, shouldSave = true) {
    try {
        const image = await loadImage(source);
        Object.assign(mapState, { image, source, name, loaded: true });
        updateMapUI(); updateEmptyTabletop();
        requestRender();
        if (shouldSave) scheduleSave();
        return true;
    } catch {
        setSaveStatus("Não foi possível carregar o mapa");
        return false;
    }
}

function getTokenDisplayName(fileName) {
    return fileName.replace(/\.[^.]+$/, "").trim() || "Token";
}

async function createToken(source, name, options = {}) {
    try {
        const image = options.image || await loadImage(source);
        const offset = (tokens.length % 7) * 16;
        const type = options.type || "player";
        const token = {
            id: options.id ?? nextTokenId++, name, image, source, loaded: true,
            x: options.x ?? -camera.x + offset,
            y: options.y ?? -camera.y + offset,
            width: options.width ?? 100,
            rotation: options.rotation ?? 0,
            type,
            color: options.color || TYPE_COLORS[type],
            visibleToPlayers: options.visibleToPlayers !== false,
            hp: options.hp ?? 10,
            maxHp: options.maxHp ?? 10,
            condition: options.condition || "",
            showName: options.showName ?? true,
            showHealth: options.showHealth ?? true
        };
        nextTokenId = Math.max(nextTokenId, token.id + 1);
        tokens.push(token);
        if (options.select !== false) selectToken(token);
        else updateTokenLibrary();
        requestRender();
        if (options.save !== false) scheduleSave();
        return token;
    } catch {
        setSaveStatus("Não foi possível carregar o token");
        return null;
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Painéis
function closePanels(except = null) {
    Object.entries(panels).forEach(([name, panel]) => {
        const open = name === except;
        panel.hidden = !open;
        panelButtons[name].setAttribute("aria-expanded", String(open));
    });
}

Object.entries(panelButtons).forEach(([name, button]) => {
    button.addEventListener("click", () => closePanels(panels[name].hidden ? name : null));
});
$("closeGridPanel").addEventListener("click", () => closePanels());
$("closeTokenPanel").addEventListener("click", () => closePanels());
$("closeSessionPanel").addEventListener("click", () => closePanels());
$("closePlayerViewPanel").addEventListener("click", () => closePanels());
$("closeTransmissionPanel").addEventListener("click", () => closePanels());
$("closeScenesPanel").addEventListener("click", () => closePanels());
$("startMapImport").addEventListener("click", () => closePanels("grid"));
$("startTokenImport").addEventListener("click", () => closePanels("tokens"));

// Mapa e grade
function formatMeters(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function updateMapUI() {
    $("mapName").textContent = mapState.name;
    $("mapScale").disabled = !mapState.loaded;
    $("resetMap").disabled = !mapState.loaded;
    $("removeMap").disabled = !mapState.loaded;
    document.querySelectorAll("[data-map-dx], [data-map-dy]").forEach((button) => {
        button.disabled = !mapState.loaded;
    });
    $("mapScale").value = Math.round(mapState.scale * 100);
    $("mapScaleValue").value = Math.round(mapState.scale * 100) + "%";
    $("mapOffsetValue").textContent = "X " + Math.round(mapState.x) + " · Y " + Math.round(mapState.y);
}

function updateGridUI() {
    $("gridVisible").checked = gridSettings.visible;
    $("gridSnap").checked = gridSettings.snapTokens;
    $("gridSize").value = gridSettings.size;
    $("gridSizeValue").value = gridSettings.size + " px";
    $("gridOpacity").value = Math.round(gridSettings.opacity * 100);
    $("gridOpacityValue").value = Math.round(gridSettings.opacity * 100) + "%";
    $("gridMeters").value = gridSettings.metersPerSquare;
    $("gridMetersValue").value = formatMeters(gridSettings.metersPerSquare) + " m";
    $("gridOffsetValue").textContent = "X " + gridSettings.offsetX + " · Y " + gridSettings.offsetY;
}

$("mapFileInput").addEventListener("change", async () => {
    const file = $("mapFileInput").files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
        setSaveStatus("Escolha um mapa em PNG");
        $("mapFileInput").value = "";
        return;
    }
    const source = await readFileAsDataURL(file);
    Object.assign(mapState, { x: 0, y: 0, scale: 1 });
    gridSettings.visible = true;
    const loaded = await setMapSource(source, file.name);
    if (loaded) updateGridUI();
    else clearMap(false);
    $("mapFileInput").value = "";
});

$("mapScale").addEventListener("input", (event) => {
    mapState.scale = Number(event.target.value) / 100;
    updateMapUI(); requestRender(); scheduleSave();
});

document.querySelectorAll("[data-map-dx], [data-map-dy]").forEach((button) => {
    button.addEventListener("click", () => {
        mapState.x += Number(button.dataset.mapDx || 0);
        mapState.y += Number(button.dataset.mapDy || 0);
        updateMapUI(); requestRender(); scheduleSave();
    });
});

$("resetMap").addEventListener("click", () => {
    Object.assign(mapState, { x: 0, y: 0, scale: 1 });
    updateMapUI(); requestRender(); scheduleSave();
});
$("removeMap").addEventListener("click", () => {
    if (mapState.loaded && window.confirm("Remover o mapa desta mesa? Os tokens serão mantidos.")) clearMap();
});

$("gridVisible").addEventListener("change", (event) => {
    gridSettings.visible = event.target.checked; requestRender(); scheduleSave();
});
$("gridSnap").addEventListener("change", (event) => {
    gridSettings.snapTokens = event.target.checked; scheduleSave();
});
$("gridSize").addEventListener("input", (event) => {
    gridSettings.size = Number(event.target.value); updateGridUI(); requestRender(); scheduleSave();
});
$("gridOpacity").addEventListener("input", (event) => {
    gridSettings.opacity = Number(event.target.value) / 100; updateGridUI(); requestRender(); scheduleSave();
});
$("gridMeters").addEventListener("input", (event) => {
    gridSettings.metersPerSquare = Number(event.target.value); updateGridUI(); requestRender(); scheduleSave();
});
document.querySelectorAll("[data-grid-dx], [data-grid-dy]").forEach((button) => {
    button.addEventListener("click", () => {
        gridSettings.offsetX += Number(button.dataset.gridDx || 0);
        gridSettings.offsetY += Number(button.dataset.gridDy || 0);
        updateGridUI(); requestRender(); scheduleSave();
    });
});
$("resetGrid").addEventListener("click", () => {
    Object.assign(gridSettings, DEFAULT_GRID); updateGridUI(); requestRender(); scheduleSave();
});

// Tokens e camadas
function selectedTokenList() {
    return tokens.filter((token) => selectedTokens.has(token));
}

function setTokenSelection(selection, primary = null) {
    const valid = new Set((Array.isArray(selection) ? selection : []).filter((token) => tokens.includes(token)));
    selectedTokens.clear();
    valid.forEach((token) => selectedTokens.add(token));
    selectedToken = primary && selectedTokens.has(primary) ? primary : selectedTokenList().at(-1) || null;
    updateTokenLibrary();
    updateTokenInspector();
    requestRender();
}

function selectToken(token, options = {}) {
    if (!token) {
        setTokenSelection([]);
        return;
    }
    if (options.additive) {
        const selection = selectedTokenList();
        if (selectedTokens.has(token)) setTokenSelection(selection.filter((item) => item !== token));
        else setTokenSelection([...selection, token], token);
        return;
    }
    if (options.preserveGroup && selectedTokens.has(token)) {
        setTokenSelection(selectedTokenList(), token);
        return;
    }
    setTokenSelection([token], token);
}

function updateTokenLibrary() {
    $("tokenCount").textContent = tokens.length + (tokens.length === 1 ? " token na mesa" : " tokens na mesa");
    const list = $("tokenList");
    list.replaceChildren();
    if (tokens.length === 0) {
        const empty = document.createElement("p");
        empty.className = "token-list__empty";
        empty.textContent = "Importe um PNG para adicionar o primeiro token.";
        list.append(empty);
    }
    tokens.forEach((token) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "token-list__item";
        item.setAttribute("aria-pressed", String(selectedTokens.has(token)));
        item.dataset.primary = String(selectedToken === token);
        const thumbnail = document.createElement("img");
        thumbnail.src = token.source;
        thumbnail.alt = "";
        const information = document.createElement("span");
        const name = document.createElement("strong");
        const details = document.createElement("small");
        name.textContent = token.name;
        details.textContent = token.hp + "/" + token.maxHp + " PV · " + Math.round(token.width) + " px" + (token.visibleToPlayers ? "" : " · só mestre");
        information.append(name, details);
        const identifier = document.createElement("small");
        identifier.textContent = "#" + token.id;
        item.append(thumbnail, information, identifier);
        item.addEventListener("click", (event) => selectToken(token, { additive: event.ctrlKey || event.metaKey || event.shiftKey }));
        list.append(item);
    });
    const selectionCount = selectedTokens.size;
    const enabled = selectionCount > 0;
    $("tokenSelectionCount").textContent = selectionCount ? `${selectionCount} selecionado${selectionCount === 1 ? "" : "s"}` : "Nenhum selecionado";
    $("duplicateToken").disabled = !enabled;
    $("deleteToken").disabled = !enabled;
    $("selectAllTokens").disabled = !tokens.length || selectionCount === tokens.length;
    $("clearTokenSelection").disabled = !enabled;
}

function updateTokenInspector() {
    const inspector = $("tokenInspector");
    inspector.hidden = selectedTokens.size !== 1 || !selectedToken;
    if (inspector.hidden) return;
    $("tokenNameInput").value = selectedToken.name;
    $("tokenTypeInput").value = selectedToken.type;
    $("tokenColorInput").value = selectedToken.color;
    $("tokenHpInput").value = selectedToken.hp;
    $("tokenMaxHpInput").value = selectedToken.maxHp;
    $("tokenConditionInput").value = selectedToken.condition;
    $("tokenVisibleToPlayersInput").checked = selectedToken.visibleToPlayers;
    $("tokenShowNameInput").checked = selectedToken.showName;
    $("tokenShowHealthInput").checked = selectedToken.showHealth;
    const index = tokens.indexOf(selectedToken);
    $("sendTokenBackward").disabled = index <= 0;
    $("bringTokenForward").disabled = index >= tokens.length - 1;
}

function updateSelectedTokenFromInspector() {
    if (!selectedToken) return;
    selectedToken.name = $("tokenNameInput").value.trim() || "Token";
    selectedToken.type = $("tokenTypeInput").value;
    selectedToken.color = $("tokenColorInput").value;
    selectedToken.maxHp = Math.max(1, Number($("tokenMaxHpInput").value) || 1);
    selectedToken.hp = Math.max(0, Math.min(selectedToken.maxHp, Number($("tokenHpInput").value) || 0));
    selectedToken.condition = $("tokenConditionInput").value.trim();
    selectedToken.visibleToPlayers = $("tokenVisibleToPlayersInput").checked;
    selectedToken.showName = $("tokenShowNameInput").checked;
    selectedToken.showHealth = $("tokenShowHealthInput").checked;
    $("tokenHpInput").value = selectedToken.hp;
    $("tokenMaxHpInput").value = selectedToken.maxHp;
    updateTokenLibrary(); requestRender(); scheduleSave();
}

["tokenNameInput", "tokenColorInput", "tokenHpInput", "tokenMaxHpInput", "tokenConditionInput"]
    .forEach((id) => $(id).addEventListener("input", updateSelectedTokenFromInspector));

["tokenVisibleToPlayersInput", "tokenShowNameInput", "tokenShowHealthInput"]
    .forEach((id) => $(id).addEventListener("change", updateSelectedTokenFromInspector));

$("tokenTypeInput").addEventListener("change", () => {
    if (!selectedToken) return;
    selectedToken.type = $("tokenTypeInput").value;
    selectedToken.color = TYPE_COLORS[selectedToken.type];
    updateTokenInspector(); updateTokenLibrary(); requestRender(); scheduleSave();
});

$("tokenFileInput").addEventListener("change", async () => {
    const files = Array.from($("tokenFileInput").files || []);
    for (const file of files) {
        if (file.type !== "image/png") {
            setSaveStatus("Use arquivos PNG para os tokens");
            continue;
        }
        const source = await readFileAsDataURL(file);
        await createToken(source, getTokenDisplayName(file.name));
    }
    $("tokenFileInput").value = "";
});

async function duplicateSelectedToken() {
    const originals = selectedTokenList();
    if (!originals.length || sceneLoading) return;
    sceneLoading = true;
    const copies = [];
    try {
        for (const token of originals) {
            const copy = await createToken(token.source, token.name + " (cópia)", {
                image: token.image,
                x: token.x + 24, y: token.y + 24,
                width: token.width, rotation: token.rotation,
                type: token.type, color: token.color,
                hp: token.hp, maxHp: token.maxHp,
                condition: token.condition,
                visibleToPlayers: token.visibleToPlayers,
                showName: token.showName,
                showHealth: token.showHealth,
                select: false,
                save: false
            });
            if (copy) copies.push(copy);
        }
        if (copies.length) setTokenSelection(copies, copies.at(-1));
    } finally { sceneLoading = false; scheduleSave(); }
}

function deleteSelectedToken() {
    const removing = new Set(selectedTokenList());
    if (!removing.size) return;
    for (let index = tokens.length - 1; index >= 0; index--) if (removing.has(tokens[index])) tokens.splice(index, 1);
    setTokenSelection([]);
    scheduleSave();
}

function moveSelectedTokenLayer(direction) {
    if (!selectedToken || selectedTokens.size !== 1) return;
    const index = tokens.indexOf(selectedToken);
    const target = index + direction;
    if (target < 0 || target >= tokens.length) return;
    [tokens[index], tokens[target]] = [tokens[target], tokens[index]];
    updateTokenLibrary(); updateTokenInspector(); requestRender(); scheduleSave();
}

$("duplicateToken").addEventListener("click", duplicateSelectedToken);
$("deleteToken").addEventListener("click", deleteSelectedToken);
$("selectAllTokens").addEventListener("click", () => setTokenSelection(tokens, tokens.at(-1) || null));
$("clearTokenSelection").addEventListener("click", () => setTokenSelection([]));
$("sendTokenBackward").addEventListener("click", () => moveSelectedTokenLayer(-1));
$("bringTokenForward").addEventListener("click", () => moveSelectedTokenLayer(1));

// Coordenadas e controles do token
function screenToWorld(x, y) {
    return {
        x: (x - window.innerWidth / 2) / camera.zoom - camera.x,
        y: (y - window.innerHeight / 2) / camera.zoom - camera.y
    };
}

function worldToScreen(point) {
    return {
        x: window.innerWidth / 2 + (camera.x + point.x) * camera.zoom,
        y: window.innerHeight / 2 + (camera.y + point.y) * camera.zoom
    };
}

function getTokenHeight(token) {
    return token.width * token.image.height / token.image.width;
}

function getTokenTransform(token) {
    const center = worldToScreen(token);
    return {
        x: center.x, y: center.y,
        width: token.width * camera.zoom,
        height: getTokenHeight(token) * camera.zoom,
        rotation: token.rotation
    };
}

function isPointInsideToken(token, worldX, worldY) {
    if (!token?.loaded) return false;
    const dx = worldX - token.x;
    const dy = worldY - token.y;
    const cosine = Math.cos(token.rotation);
    const sine = Math.sin(token.rotation);
    const localX = dx * cosine + dy * sine;
    const localY = -dx * sine + dy * cosine;
    return Math.abs(localX) <= token.width / 2 && Math.abs(localY) <= getTokenHeight(token) / 2;
}

function getTopmostTokenAt(point) {
    for (let index = tokens.length - 1; index >= 0; index--) {
        if (isPointInsideToken(tokens[index], point.x, point.y)) return tokens[index];
    }
    return null;
}

function getTokenControls(token) {
    const transform = getTokenTransform(token);
    const halfWidth = transform.width / 2;
    const halfHeight = transform.height / 2;
    const cosine = Math.cos(transform.rotation);
    const sine = Math.sin(transform.rotation);
    const handleDistance = halfHeight + ROTATION_HANDLE_GAP;
    return {
        resize: {
            x: transform.x + halfWidth * cosine + halfHeight * sine,
            y: transform.y + halfWidth * sine - halfHeight * cosine,
            radius: RESIZE_HANDLE_RADIUS
        },
        rotation: {
            x: transform.x - Math.sin(transform.rotation) * handleDistance,
            y: transform.y + Math.cos(transform.rotation) * handleDistance,
            radius: ROTATION_HANDLE_RADIUS
        },
        tokenBase: {
            x: transform.x - Math.sin(transform.rotation) * halfHeight,
            y: transform.y + Math.cos(transform.rotation) * halfHeight
        }
    };
}

function isInsideControl(x, y, control) {
    return Math.hypot(x - control.x, y - control.y) <= control.radius;
}

function getResizeWidth(token, x, y) {
    const transform = getTokenTransform(token);
    const dx = x - transform.x;
    const dy = y - transform.y;
    const cosine = Math.cos(transform.rotation);
    const sine = Math.sin(transform.rotation);
    const localX = dx * cosine + dy * sine;
    const localY = -dx * sine + dy * cosine;
    const aspect = token.image.height / token.image.width;
    const halfWidth = (localX - aspect * localY) / (1 + aspect * aspect);
    return halfWidth * 2 / camera.zoom;
}

// Régua
function setMode(mode) {
    if (followingPlayer) cancelPlayerFollow();
    activeMode = mode;
    updateRulerUI();
    updatePlayerViewUI();
    canvas.style.cursor = mode === "ruler" || mode === "player-view" ? "crosshair" : "default";
    requestRender();
}

function toggleHud() {
    hudVisible = !hudVisible;
    document.body.classList.toggle("hud-hidden", !hudVisible);
    if (!hudVisible) {
        closePanels();
        setMode("select");
        measurement.drawing = false;
        interaction.type = null;
        interaction.token = null;
    }
    requestRender();
}

function updateRulerUI() {
    const rulerActive = activeMode === "ruler";
    const hasMeasurement = Boolean(measurement.start && measurement.end);
    $("toolRuler").setAttribute("aria-pressed", String(rulerActive));
    $("rulerControls").hidden = !rulerActive && !hasMeasurement;
    $("modeBadge").textContent = rulerActive
        ? "Régua ativa · arraste entre dois pontos"
        : "Medição no mapa";
    $("clearMeasurement").hidden = !hasMeasurement;
}

function clearMeasurement() {
    Object.assign(measurement, { drawing: false, start: null, end: null });
    updateRulerUI();
    requestRender();
}

function snapMeasurementPoint(point) {
    const directToken = getTopmostTokenAt(point);
    if (directToken) return { x: directToken.x, y: directToken.y };
    const limit = 24 / camera.zoom;
    let closest = null;
    let closestDistance = limit;
    tokens.forEach((token) => {
        const distance = Math.hypot(point.x - token.x, point.y - token.y);
        if (distance < closestDistance) {
            closest = token;
            closestDistance = distance;
        }
    });
    return closest ? { x: closest.x, y: closest.y } : point;
}

function measurementMeters() {
    if (!measurement.start || !measurement.end) return 0;
    const pixels = Math.hypot(
        measurement.end.x - measurement.start.x,
        measurement.end.y - measurement.start.y
    );
    return pixels / gridSettings.size * gridSettings.metersPerSquare;
}

$("toolRuler").addEventListener("click", () => {
    closePanels();
    setMode(activeMode === "ruler" ? "select" : "ruler");
});
$("clearMeasurement").addEventListener("click", clearMeasurement);
$("toolMove").addEventListener("click", () => setMode("select"));
$("toolZoom").addEventListener("click", () => {
    Object.assign(camera, { x: 0, y: 0, zoom: 1 });
    requestRender(); scheduleSave();
});

function updatePlayerViewUI() {
    const moving = activeMode === "player-view";
    $("movePlayerView").setAttribute("aria-pressed", String(moving));
    $("toolPlayerView").setAttribute("aria-pressed", String(moving));
    $("movePlayerView").textContent = moving ? "Movendo retângulo · clique para sair" : "Mover retângulo no mapa";
    $("playerViewWidth").value = String(playerView.width);
    $("playerViewSize").value = String(playerView.width);
}

$("movePlayerView").addEventListener("click", () => {
    closePanels();
    setMode(activeMode === "player-view" ? "select" : "player-view");
});
$("alignPlayerView").addEventListener("click", () => {
    playerView.x = -camera.x - playerView.width / 2;
    playerView.y = -camera.y - playerView.height / 2;
    requestRender(); scheduleSave();
});
$("playerViewWidth").addEventListener("input", () => {
    const width = Number($("playerViewWidth").value);
    const centerX = playerView.x + playerView.width / 2;
    const centerY = playerView.y + playerView.height / 2;
    playerView.width = width;
    playerView.height = width / VIEW_RULES.ASPECT_RATIO;
    playerView.x = centerX - playerView.width / 2;
    playerView.y = centerY - playerView.height / 2;
    updatePlayerViewUI(); requestRender(); scheduleSave();
});
document.querySelectorAll("[data-player-dx], [data-player-dy]").forEach((button) => {
    button.addEventListener("click", () => {
        playerView.x += Number(button.dataset.playerDx || 0);
        playerView.y += Number(button.dataset.playerDy || 0);
        requestRender(); scheduleSave();
    });
});
$("openPlayerPreview").addEventListener("click", () => {
    previewDialog.showModal();
    drawPlayerPreview();
});
$("closePlayerPreview").addEventListener("click", () => previewDialog.close());

// Interação com o canvas
canvas.addEventListener("mousedown", (event) => {
    if (sceneLoading) return;
    lastMouse = { x: event.clientX, y: event.clientY };
    const point = screenToWorld(event.clientX, event.clientY);
    if (event.button === 2 || event.button === 1) {
        event.preventDefault();
        Object.assign(interaction, { type: "pan", lastX: event.clientX, lastY: event.clientY });
        canvas.style.cursor = "grabbing";
        return;
    }
    if (event.button !== 0) return;
    if (followingPlayer) return;
    if (activeMode === "ruler") {
        measurement.drawing = true;
        measurement.start = snapMeasurementPoint(point);
        measurement.end = measurement.start;
        updateRulerUI();
        requestRender();
        return;
    }
    if (activeMode === "player-view") {
        const inside = VIEW_RULES.contains(playerView, point);
        interaction.type = "player-view";
        interaction.offsetX = inside ? point.x - playerView.x : playerView.width / 2;
        interaction.offsetY = inside ? point.y - playerView.y : playerView.height / 2;
        playerView.x = point.x - interaction.offsetX;
        playerView.y = point.y - interaction.offsetY;
        canvas.style.cursor = "grabbing";
        requestRender();
        return;
    }
    if (hudVisible && selectedToken && selectedTokens.size === 1) {
        const controls = getTokenControls(selectedToken);
        if (isInsideControl(event.clientX, event.clientY, controls.resize)) {
            interaction.type = "resize";
            interaction.token = selectedToken;
            interaction.resizeOffset = selectedToken.width - getResizeWidth(selectedToken, event.clientX, event.clientY);
            canvas.style.cursor = "nesw-resize";
            return;
        }
        if (isInsideControl(event.clientX, event.clientY, controls.rotation)) {
            const transform = getTokenTransform(selectedToken);
            const angle = Math.atan2(event.clientY - transform.y, event.clientX - transform.x);
            interaction.type = "rotate";
            interaction.token = selectedToken;
            interaction.rotationOffset = angle - selectedToken.rotation;
            canvas.style.cursor = "grabbing";
            return;
        }
    }
    const token = getTopmostTokenAt(point);
    if (token) {
        const additive = event.ctrlKey || event.metaKey || event.shiftKey;
        selectToken(token, { additive, preserveGroup: !additive });
        if (!selectedTokens.has(token)) return;
        interaction.type = "drag";
        interaction.token = token;
        interaction.offsetX = point.x - token.x;
        interaction.offsetY = point.y - token.y;
        interaction.anchorStart = { x: token.x, y: token.y };
        interaction.tokens = selectedTokenList().map((item) => ({ token: item, x: item.x, y: item.y }));
        interaction.moved = false;
        canvas.style.cursor = "grabbing";
    } else {
        const additive = event.ctrlKey || event.metaKey || event.shiftKey;
        interaction.type = "marquee";
        interaction.marqueeStart = point;
        interaction.marqueeEnd = point;
        interaction.additive = additive;
        interaction.selectionBeforeMarquee = additive ? selectedTokenList() : [];
        if (!additive) selectToken(null);
        canvas.style.cursor = "crosshair";
    }
});

canvas.addEventListener("mousemove", (event) => {
    lastMouse = { x: event.clientX, y: event.clientY };
    const point = screenToWorld(event.clientX, event.clientY);
    if (measurement.drawing) {
        measurement.end = snapMeasurementPoint(point); requestRender(); return;
    }
    if (interaction.type === "pan") {
        camera.x += (event.clientX - interaction.lastX) / camera.zoom;
        camera.y += (event.clientY - interaction.lastY) / camera.zoom;
        interaction.lastX = event.clientX;
        interaction.lastY = event.clientY;
        if (followingPlayer) movePlayerToMouse();
        requestRender(); return;
    }
    if (followingPlayer) { movePlayerToMouse(); return; }
    if (interaction.type === "player-view") {
        playerView.x = point.x - interaction.offsetX;
        playerView.y = point.y - interaction.offsetY;
        requestRender(); return;
    }
    if (interaction.type === "marquee") {
        interaction.marqueeEnd = point;
        requestRender(); return;
    }
    const token = interaction.token;
    if (interaction.type === "drag" && token) {
        const nextX = point.x - interaction.offsetX;
        const nextY = point.y - interaction.offsetY;
        const deltaX = nextX - interaction.anchorStart.x;
        const deltaY = nextY - interaction.anchorStart.y;
        interaction.tokens.forEach((item) => {
            item.token.x = item.x + deltaX;
            item.token.y = item.y + deltaY;
        });
        interaction.moved = interaction.moved || Math.abs(deltaX) > .5 || Math.abs(deltaY) > .5;
        requestRender(); return;
    }
    if (interaction.type === "resize" && token) {
        const width = getResizeWidth(token, event.clientX, event.clientY) + interaction.resizeOffset;
        token.width = Math.max(MIN_TOKEN_SIZE, Math.min(MAX_TOKEN_SIZE, width));
        requestRender(); return;
    }
    if (interaction.type === "rotate" && token) {
        const transform = getTokenTransform(token);
        const angle = Math.atan2(event.clientY - transform.y, event.clientX - transform.x);
        token.rotation = (angle - interaction.rotationOffset + Math.PI * 2) % (Math.PI * 2);
        requestRender(); return;
    }
    if (!hudVisible) canvas.style.cursor = getTopmostTokenAt(point) ? "grab" : "default";
    else if (activeMode === "ruler" || activeMode === "player-view") canvas.style.cursor = "crosshair";
    else if (selectedToken && selectedTokens.size === 1) {
        const controls = getTokenControls(selectedToken);
        if (isInsideControl(event.clientX, event.clientY, controls.resize)) canvas.style.cursor = "nesw-resize";
        else if (isInsideControl(event.clientX, event.clientY, controls.rotation)) canvas.style.cursor = "grab";
        else canvas.style.cursor = getTopmostTokenAt(point) ? "grab" : "default";
    } else canvas.style.cursor = getTopmostTokenAt(point) ? "grab" : "default";
});

function finishCanvasInteraction(event) {
    if (event.button === 0 && measurement.drawing) {
        measurement.drawing = false; updateRulerUI(); requestRender();
    }
    if (event.button === 0 && interaction.type === "drag" && interaction.token && interaction.moved && (event.shiftKey || gridSettings.snapTokens)) {
        const delta = SELECTION_RULES.snapDelta(interaction.token, gridSettings);
        interaction.tokens.forEach((item) => {
            item.token.x += delta.x;
            item.token.y += delta.y;
        });
    }
    if (event.button === 0 && interaction.type === "marquee") {
        const ids = SELECTION_RULES.rectangleIds(tokens, interaction.marqueeStart, interaction.marqueeEnd);
        const inside = tokens.filter((token) => ids.includes(token.id));
        const combined = interaction.additive ? [...interaction.selectionBeforeMarquee, ...inside.filter((token) => !interaction.selectionBeforeMarquee.includes(token))] : inside;
        setTokenSelection(combined, inside.at(-1) || combined.at(-1) || null);
    }
    if (interaction.type && interaction.type !== "pan" && interaction.type !== "player-view") {
        updateTokenLibrary(); updateTokenInspector(); scheduleSave();
    }
    if (interaction.type === "pan" || interaction.type === "player-view") scheduleSave();
    if (event.button === 2 || event.button === 1 || event.button === 0) {
        interaction.type = null;
        interaction.token = null;
        interaction.tokens = [];
        interaction.anchorStart = null;
        interaction.moved = false;
        interaction.marqueeStart = null;
        interaction.marqueeEnd = null;
        canvas.style.cursor = activeMode === "ruler" || activeMode === "player-view" ? "crosshair" : "default";
        requestRender();
    }
}
canvas.addEventListener("mouseup", finishCanvasInteraction);
window.addEventListener("mouseup", finishCanvasInteraction);

canvas.addEventListener("mouseleave", (event) => {
    if (interaction.type || measurement.drawing) finishCanvasInteraction({
        button: interaction.type === "pan" ? 2 : 0, shiftKey: event.shiftKey
    });
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("auxclick", (event) => { if (event.button === 1) event.preventDefault(); });
canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const point = screenToWorld(event.clientX, event.clientY);
    camera.zoom += event.deltaY < 0 ? 0.1 : -0.1;
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom));
    camera.x = (event.clientX - window.innerWidth / 2) / camera.zoom - point.x;
    camera.y = (event.clientY - window.innerHeight / 2) / camera.zoom - point.y;
    if (followingPlayer) movePlayerToMouse();
    requestRender(); scheduleSave();
}, { passive: false });

// Salvamento persistente com IndexedDB
const DB_NAME = "tabletop2d-storage";
const DB_STORE = "sessions";
const tableParams = new URLSearchParams(location.search);
const tableId = tableParams.get("table") || tableParams.get("campaign");
const SESSION_KEY = tableId ? "campaign:" + tableId : "autosave";
if (tableId) {
    document.querySelector(".campaign-return").href = "index.html#mesa/" + encodeURIComponent(tableId);
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function writeSession(data) {
    if (WORKSPACE) {
        const workspace = await WORKSPACE.saveSession(tableId || "autosave", data, window.REAL_TABLETOP_MASTER?.captureThumbnail());
        if (data.sceneId && workspace.activeSceneId !== data.sceneId) return;
    }
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(DB_STORE, "readwrite");
        transaction.objectStore(DB_STORE).put(data, SESSION_KEY);
        transaction.oncomplete = () => { database.close?.(); resolve(); };
        transaction.onerror = () => { database.close?.(); reject(transaction.error); };
        transaction.onabort = () => { database.close?.(); reject(transaction.error); };
    });
}

async function readSession() {
    if (WORKSPACE) {
        const workspace = await WORKSPACE.read(tableId || "autosave");
        const scene = WORKSPACE.active(workspace);
        return { ...scene.session, sceneId: scene.id };
    }
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const store = database.transaction(DB_STORE, "readonly").objectStore(DB_STORE);
        const request = store.get(SESSION_KEY);
        request.onsuccess = () => {
            if (request.result || tableId !== "campanha-inicial") {
                database.close?.();
                resolve(request.result || null);
                return;
            }
            const legacy = store.get("autosave");
            legacy.onsuccess = () => { database.close?.(); resolve(legacy.result || null); };
            legacy.onerror = () => { database.close?.(); reject(legacy.error); };
        };
        request.onerror = () => { database.close?.(); reject(request.error); };
    });
}

function serializeSession() {
    return {
        version: 1,
        sceneId: currentSceneId,
        savedAt: new Date().toISOString(),
        camera: { ...camera },
        playerView: { ...playerView },
        grid: { ...gridSettings },
        map: { source: mapState.source, name: mapState.name, x: mapState.x, y: mapState.y, scale: mapState.scale },
        tokens: tokens.map((token) => ({
            id: token.id, name: token.name, source: token.source,
            x: token.x, y: token.y, width: token.width, rotation: token.rotation,
            type: token.type, color: token.color, hp: token.hp,
            visibleToPlayers: token.visibleToPlayers,
            maxHp: token.maxHp, condition: token.condition,
            showName: token.showName, showHealth: token.showHealth
        })),
        selectedTokenId: selectedToken?.id || null,
        selectedTokenIds: selectedTokenList().map((token) => token.id)
    };
}

function setSaveStatus(message) {
    $("saveStatus").textContent = message;
    $("sessionDetails").textContent = message;
}

let sessionSaveQueue = Promise.resolve();
async function saveSession(message = "Mesa salva automaticamente") {
    const snapshot = serializeSession();
    try {
        sessionSaveQueue = sessionSaveQueue.catch(() => {}).then(() => writeSession(snapshot));
        await sessionSaveQueue;
        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setSaveStatus(message + " · " + time);
        return true;
    } catch {
        setSaveStatus("Não foi possível salvar esta mesa");
        return false;
    }
}

function scheduleSave() {
    recordSceneState();
    clearTimeout(saveTimer);
    $("saveStatus").textContent = "Salvando…";
    saveTimer = setTimeout(() => saveSession(), 300);
    window.dispatchEvent(new Event("real:tabletop-changed"));
}

async function applySession(data) {
    if (!data) return false;
    currentSceneId = data.sceneId || currentSceneId;
    Object.assign(measurement, { drawing: false, start: null, end: null });
    Object.assign(camera, { x: 0, y: 0, zoom: 1 }, data.camera || {});
    Object.assign(playerView, VIEW_RULES.normalize(data.playerView));
    Object.assign(gridSettings, DEFAULT_GRID, data.grid || {});
    if (isImportedImage(data.map?.source)) {
        Object.assign(mapState, {
            x: data.map?.x ?? 0,
            y: data.map?.y ?? 0,
            scale: data.map?.scale ?? 1
        });
        if (!await setMapSource(data.map.source, data.map.name || "Mapa importado", false)) clearMap(false);
    } else clearMap(false);
    tokens.splice(0);
    selectedToken = null;
    selectedTokens.clear();
    nextTokenId = 1;
    for (const savedToken of (data.tokens || []).filter((token) => isImportedImage(token.source))) {
        await createToken(savedToken.source, savedToken.name, { ...savedToken, select: false, save: false });
    }
    const restoredIds = SELECTION_RULES.validIds(tokens, data.selectedTokenIds, data.selectedTokenId);
    restoredIds.forEach((id) => {
        const token = tokens.find((item) => item.id === id);
        if (token) selectedTokens.add(token);
    });
    selectedToken = tokens.find((token) => token.id === data.selectedTokenId && selectedTokens.has(token)) || selectedTokenList().at(-1) || null;
    updateMapUI(); updateGridUI(); updateTokenLibrary(); updateTokenInspector(); updateRulerUI(); updatePlayerViewUI(); requestRender();
    return true;
}

async function loadLastSession(showMessage = true) {
    if (sceneLoading) return false;
    if (followingPlayer) cancelPlayerFollow();
    sceneLoading = true;
    try {
        const data = await readSession();
        if (!data) return false;
        const previousSceneId = currentSceneId;
        await applySession(data);
        if (historyReady && previousSceneId !== currentSceneId) { sceneHistory.reset(captureSceneState()); updateHistoryUI(); }
        if (showMessage) setSaveStatus("Última mesa carregada");
        return true;
    } catch {
        setSaveStatus("Não foi possível carregar a mesa");
        return false;
    } finally {
        sceneLoading = false;
        if (historyReady) { recordSceneState(); scheduleSave(); }
    }
}

async function createNewSession() {
    if (followingPlayer) cancelPlayerFollow();
    resetInteraction();
    tokens.splice(0);
    selectedToken = null;
    selectedTokens.clear();
    nextTokenId = 1;
    Object.assign(camera, { x: 0, y: 0, zoom: 1 });
    Object.assign(playerView, VIEW_RULES.normalize());
    Object.assign(gridSettings, DEFAULT_GRID);
    Object.assign(measurement, { drawing: false, start: null, end: null });
    clearMap(false);
    updateTokenLibrary(); updateTokenInspector(); updateRulerUI(); updatePlayerViewUI();
    recordSceneState();
    window.dispatchEvent(new Event("real:tabletop-changed"));
    await saveSession("Nova mesa criada");
}

$("saveSession").addEventListener("click", () => saveSession("Mesa salva"));
$("loadSession").addEventListener("click", () => loadLastSession());
$("newSession").addEventListener("click", async () => {
    if (window.confirm("Limpar o mapa e os tokens da cena atual? Ctrl + Z recupera durante esta visita.")) await createNewSession();
});

// Teclado
let shortcutNoticeTimer = null;

function shortcutNotice(message, persistent = false) {
    clearTimeout(shortcutNoticeTimer);
    const status = $("shortcutStatus");
    status.textContent = message;
    status.hidden = false;
    if (!persistent) shortcutNoticeTimer = setTimeout(() => { status.hidden = true; }, 2400);
}

function resetInteraction() {
    Object.assign(interaction, { type: null, token: null, tokens: [], anchorStart: null,
        moved: false, marqueeStart: null, marqueeEnd: null });
    measurement.drawing = false;
    canvas.style.cursor = "default";
}

function movePlayerToMouse() {
    if (!followingPlayer || !lastMouse) return;
    const point = screenToWorld(lastMouse.x, lastMouse.y);
    playerView.x = point.x - playerView.width / 2;
    playerView.y = point.y - playerView.height / 2;
    requestRender();
}

function togglePlayerFollow() {
    if (followingPlayer) {
        movePlayerToMouse();
        followingPlayer = null;
        canvas.style.cursor = "default";
        requestRender(); scheduleSave();
        shortcutNotice("Visão do jogador fixada");
        return;
    }
    closePanels(); setMode("select");
    canvas.focus({ preventScroll: true });
    followingPlayer = { ...playerView };
    if (!lastMouse) lastMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    canvas.style.cursor = "crosshair";
    movePlayerToMouse();
    shortcutNotice("Posicionando visão do jogador · Espaço fixa · Esc cancela", true);
}

function cancelPlayerFollow() {
    if (!followingPlayer) return false;
    Object.assign(playerView, followingPlayer);
    followingPlayer = null;
    canvas.style.cursor = "default";
    requestRender(); scheduleSave();
    shortcutNotice("Visão do jogador voltou à posição anterior");
    return true;
}

function selectedBounds() {
    return SHORTCUTS.bounds(selectedTokenList().map((token) => ({
        x: token.x, y: token.y, width: token.width, height: getTokenHeight(token), rotation: token.rotation
    })));
}

function centerPlayerOnSelection() {
    const rect = selectedBounds();
    if (!rect) { shortcutNotice("Selecione os tokens para centralizar a visão do jogador"); return; }
    if (followingPlayer) cancelPlayerFollow();
    playerView.x = rect.x - playerView.width / 2;
    playerView.y = rect.y - playerView.height / 2;
    requestRender(); scheduleSave();
    shortcutNotice("Visão do jogador centralizada nos tokens");
}

function frameMasterCamera() {
    let rect = selectedBounds();
    if (!rect && mapState.loaded) rect = {
        x: mapState.x, y: mapState.y,
        width: mapState.image.width * mapState.scale, height: mapState.image.height * mapState.scale
    };
    if (!rect) { shortcutNotice("Importe um mapa ou selecione tokens para enquadrar"); return; }
    Object.assign(camera, SHORTCUTS.fitCamera(rect, { width: window.innerWidth, height: window.innerHeight }, MIN_ZOOM, MAX_ZOOM));
    requestRender(); scheduleSave();
    shortcutNotice("Câmera do mestre enquadrada");
}

function toggleSelectedVisibility() {
    const selection = selectedTokenList();
    if (!selection.length) { shortcutNotice("Selecione os tokens que deseja ocultar ou revelar"); return; }
    const visible = !selection.some((token) => token.visibleToPlayers !== false);
    selection.forEach((token) => { token.visibleToPlayers = visible; });
    updateTokenLibrary(); updateTokenInspector(); requestRender(); scheduleSave();
    shortcutNotice(visible ? "Tokens revelados aos jogadores" : "Tokens ocultados dos jogadores");
}

function copySelectedTokens() {
    const selection = selectedTokenList();
    if (!selection.length) { shortcutNotice("Selecione tokens para copiar"); return; }
    tokenClipboard = selection.map((token) => ({ ...token }));
    pasteCount = 0;
    shortcutNotice(`${selection.length} ${selection.length === 1 ? "token copiado" : "tokens copiados"} · Ctrl + V cola no mouse`);
}

async function pasteTokens() {
    if (!tokenClipboard.length || sceneLoading) { shortcutNotice("Copie os tokens da mesa primeiro"); return; }
    sceneLoading = true;
    try {
        const center = SHORTCUTS.bounds(tokenClipboard.map((token) => ({ ...token, height: getTokenHeight(token) })));
        const point = lastMouse ? screenToWorld(lastMouse.x, lastMouse.y) : { x: -camera.x, y: -camera.y };
        const offset = pasteCount++ * 24;
        const copies = [];
        for (const token of tokenClipboard) {
            const copy = await createToken(token.source, token.name, {
                ...token, id: nextTokenId++, x: token.x - center.x + point.x + offset,
                y: token.y - center.y + point.y + offset, select: false, save: false
            });
            if (copy) copies.push(copy);
        }
        setTokenSelection(copies, copies.at(-1));
        shortcutNotice("Tokens colados na mesa");
    } finally { sceneLoading = false; scheduleSave(); }
}

function showShortcutHelp() {
    if (followingPlayer) cancelPlayerFollow();
    closePanels();
    if (!$("shortcutHelp").open) $("shortcutHelp").showModal();
}

$("openShortcutHelp").addEventListener("click", showShortcutHelp);
$("closeShortcutHelp").addEventListener("click", () => $("shortcutHelp").close());
$("shortcutHelp").addEventListener("close", () => canvas.focus({ preventScroll: true }));
$("shortcutHelp").addEventListener("click", (event) => {
    if (event.target === $("shortcutHelp")) $("shortcutHelp").close();
});
$("undoScene").addEventListener("click", () => travelHistory("undo"));
$("redoScene").addEventListener("click", () => travelHistory("redo"));
window.addEventListener("blur", () => {
    if (interaction.type) { resetInteraction(); scheduleSave(); }
    cancelPlayerFollow();
});
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cancelPlayerFollow();
});
document.addEventListener("focusin", (event) => {
    if (followingPlayer && event.target !== canvas && event.target !== document.body) cancelPlayerFollow();
});

window.addEventListener("keydown", (event) => {
    const typingSelector = "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']";
    if (event.target?.closest?.(typingSelector) || document.activeElement?.closest?.(typingSelector)) return;
    if (document.querySelector("dialog[open]")) return;
    const command = SHORTCUTS.command(event);
    if (!command || !historyReady || sceneLoading) return;
    const panelOpen = document.querySelector(".settings-panel:not([hidden])");
    if (panelOpen && command !== "cancel") return;
    if ((interaction.type || measurement.drawing) && command !== "cancel") return;
    if (followingPlayer && !["follow-player", "center-player", "cancel", "help"].includes(command)) return;
    event.preventDefault();
    switch (command) {
        case "follow-player": togglePlayerFollow(); break;
        case "center-player": centerPlayerOnSelection(); break;
        case "frame": frameMasterCamera(); break;
        case "ruler": setMode(activeMode === "ruler" ? "select" : "ruler"); break;
        case "show-grid":
            gridSettings.visible = !gridSettings.visible;
            updateGridUI(); requestRender(); scheduleSave();
            shortcutNotice(gridSettings.visible ? "Grade visível" : "Grade oculta"); break;
        case "snap-grid":
            gridSettings.snapTokens = !gridSettings.snapTokens;
            updateGridUI(); scheduleSave();
            shortcutNotice(gridSettings.snapTokens ? "Encaixe na grade ativo" : "Encaixe na grade desativado"); break;
        case "visibility": toggleSelectedVisibility(); break;
        case "toggle-hud": toggleHud(); break;
        case "copy": copySelectedTokens(); break;
        case "paste": pasteTokens(); break;
        case "undo": travelHistory("undo"); break;
        case "redo": travelHistory("redo"); break;
        case "delete": deleteSelectedToken(); break;
        case "select-all": setTokenSelection(tokens, tokens.at(-1)); break;
        case "duplicate": duplicateSelectedToken(); break;
        case "help": showShortcutHelp(); break;
        case "cancel":
            if (panelOpen) { closePanels(); canvas.focus({ preventScroll: true }); break; }
            if (cancelPlayerFollow()) { resetInteraction(); break; }
            if (interaction.type || measurement.drawing) { resetInteraction(); scheduleSave(); }
            clearMeasurement();
            if (activeMode !== "select") setMode("select");
            else setTokenSelection([]);
            requestRender(); break;
    }
});

// Desenho
function drawMap() {
    if (!mapState.loaded) return;
    const width = mapState.image.width * mapState.scale;
    const height = mapState.image.height * mapState.scale;
    const center = worldToScreen({ x: mapState.x, y: mapState.y });
    ctx.drawImage(mapState.image,
        center.x - width * camera.zoom / 2,
        center.y - height * camera.zoom / 2,
        width * camera.zoom,
        height * camera.zoom);
}

function drawAtmosphere() {
    ctx.save();
    ctx.fillStyle = "rgba(10,3,9,.18)";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    const vignette = ctx.createRadialGradient(
        window.innerWidth / 2, window.innerHeight / 2,
        Math.min(window.innerWidth, window.innerHeight) * 0.2,
        window.innerWidth / 2, window.innerHeight / 2,
        Math.max(window.innerWidth, window.innerHeight) * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(4,0,4,.68)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
}

function drawGrid() {
    if (!gridSettings.visible) return;
    const step = gridSettings.size * camera.zoom;
    if (step < 5) return;
    const originX = window.innerWidth / 2 + (camera.x + gridSettings.offsetX) * camera.zoom;
    const originY = window.innerHeight / 2 + (camera.y + gridSettings.offsetY) * camera.zoom;
    const startX = ((originX % step) + step) % step;
    const startY = ((originY % step) + step) % step;
    ctx.save(); ctx.beginPath();
    for (let x = startX; x < window.innerWidth; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, window.innerHeight); }
    for (let y = startY; y < window.innerHeight; y += step) { ctx.moveTo(0, y); ctx.lineTo(window.innerWidth, y); }
    ctx.strokeStyle = THEME.grid;
    ctx.globalAlpha = gridSettings.opacity;
    ctx.lineWidth = 1;
    ctx.stroke(); ctx.restore();
}

function drawToken(token) {
    if (!token.loaded) return;
    const transform = getTokenTransform(token);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.rotate(transform.rotation);
    ctx.drawImage(token.image, -transform.width / 2, -transform.height / 2, transform.width, transform.height);
    ctx.restore();
    if (hudVisible) drawTokenInformation(token, transform);
}

function drawTokenInformation(token, transform) {
    const rotatedHeight = Math.abs(transform.width * Math.sin(transform.rotation)) +
        Math.abs(transform.height * Math.cos(transform.rotation));
    let y = transform.y + rotatedHeight / 2 + 7;
    const width = Math.max(64, Math.min(150, transform.width + 26));
    const health = Math.max(0, Math.min(1, token.hp / token.maxHp));
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.font = "600 11px Segoe UI, Arial";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(7,5,9,.9)";
    if (token.showName) {
        ctx.strokeText(token.name, transform.x, y);
        ctx.fillStyle = "#fff1f3"; ctx.fillText(token.name, transform.x, y);
        y += 15;
    }
    if (token.showHealth) {
        ctx.fillStyle = "rgba(7,5,9,.85)"; ctx.fillRect(transform.x - width / 2, y, width, 5);
        ctx.fillStyle = token.color; ctx.fillRect(transform.x - width / 2, y, width * health, 5);
        y += 9;
    }
    if (token.condition) {
        ctx.font = "10px Segoe UI, Arial";
        ctx.fillStyle = token.color; ctx.fillText(token.condition, transform.x, y);
    }
    ctx.restore();
}

function drawTokenSelection(token, primary = false) {
    if (!token?.loaded) return;
    const transform = getTokenTransform(token);
    ctx.save();
    ctx.translate(transform.x, transform.y); ctx.rotate(transform.rotation);
    ctx.strokeStyle = token.color; ctx.lineWidth = primary ? 3 : 2; ctx.setLineDash(primary ? [7, 4] : [4, 4]);
    ctx.strokeRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height);
    ctx.restore();
}

function drawTokenSelections() {
    selectedTokenList().forEach((token) => drawTokenSelection(token, token === selectedToken));
}

function drawCircularHandle(handle, symbol) {
    ctx.save(); ctx.beginPath();
    ctx.arc(handle.x, handle.y, handle.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#230911"; ctx.fill();
    ctx.strokeStyle = selectedToken.color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = THEME.accentSoft; ctx.font = "bold 19px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(symbol, handle.x, handle.y + 1); ctx.restore();
}

function drawTokenControls() {
    if (!selectedToken?.loaded || selectedTokens.size !== 1 || activeMode === "ruler") return;
    const controls = getTokenControls(selectedToken);
    ctx.save(); ctx.beginPath();
    ctx.moveTo(controls.tokenBase.x, controls.tokenBase.y);
    ctx.lineTo(controls.rotation.x, controls.rotation.y);
    ctx.strokeStyle = selectedToken.color; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.restore();
    drawCircularHandle(controls.resize, "↗");
    drawCircularHandle(controls.rotation, "↻");
}

function drawMarqueeSelection() {
    if (interaction.type !== "marquee" || !interaction.marqueeStart || !interaction.marqueeEnd) return;
    const start = worldToScreen(interaction.marqueeStart);
    const end = worldToScreen(interaction.marqueeEnd);
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    ctx.save();
    ctx.fillStyle = "rgba(251,59,83,.12)";
    ctx.strokeStyle = THEME.accentSoft;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 5]);
    ctx.fillRect(left, top, width, height);
    ctx.strokeRect(left, top, width, height);
    ctx.restore();
}

function drawMeasurement() {
    if (!measurement.start || !measurement.end) return;
    const start = worldToScreen(measurement.start);
    const end = worldToScreen(measurement.end);
    const distance = measurementMeters();
    const text = formatMeters(Math.round(distance * 10) / 10) + " m";
    const x = (start.x + end.x) / 2;
    const y = (start.y + end.y) / 2;
    ctx.save();
    ctx.strokeStyle = "#ffe4e6"; ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    [start, end].forEach((point) => {
        ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = THEME.accent; ctx.fill();
        ctx.strokeStyle = "#fff1f3"; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.font = "700 13px Segoe UI, Arial";
    const width = ctx.measureText(text).width + 20;
    ctx.fillStyle = "rgba(14,7,14,.94)"; ctx.strokeStyle = THEME.accent; ctx.lineWidth = 1;
    ctx.fillRect(x - width / 2, y - 17, width, 30); ctx.strokeRect(x - width / 2, y - 17, width, 30);
    ctx.fillStyle = "#fff1f3"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, x, y - 2); ctx.restore();
}

function drawOverlay() {
    if (!mapState.loaded) return;
    const text = "1 quadrado = " + formatMeters(gridSettings.metersPerSquare) + " m";
    ctx.save(); ctx.font = "600 12px Segoe UI, Arial";
    const width = ctx.measureText(text).width + 20;
    ctx.fillStyle = "rgba(14,7,14,.88)"; ctx.strokeStyle = "rgba(251,59,83,.58)";
    ctx.fillRect(18, 54, width, 28); ctx.strokeRect(18, 54, width, 28);
    ctx.fillStyle = THEME.accentSoft; ctx.textBaseline = "middle"; ctx.fillText(text, 28, 68); ctx.restore();
}

function drawCornerMarks() {
    const margin = 18, size = 24, width = window.innerWidth, height = window.innerHeight;
    ctx.save(); ctx.strokeStyle = "rgba(251,59,83,.72)"; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(margin, margin + size); ctx.lineTo(margin, margin); ctx.lineTo(margin + size, margin);
    ctx.moveTo(width - margin - size, margin); ctx.lineTo(width - margin, margin); ctx.lineTo(width - margin, margin + size);
    ctx.moveTo(margin, height - margin - size); ctx.lineTo(margin, height - margin); ctx.lineTo(margin + size, height - margin);
    ctx.moveTo(width - margin - size, height - margin); ctx.lineTo(width - margin, height - margin); ctx.lineTo(width - margin, height - margin - size);
    ctx.stroke(); ctx.restore();
}

function drawPlayerFrame() {
    const topLeft = worldToScreen(playerView);
    const width = playerView.width * camera.zoom;
    const height = playerView.height * camera.zoom;
    ctx.save();
    ctx.strokeStyle = "#f4d7a1";
    ctx.fillStyle = "rgba(244, 215, 161, .055)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.fillRect(topLeft.x, topLeft.y, width, height);
    ctx.strokeRect(topLeft.x, topLeft.y, width, height);
    ctx.setLineDash([]);
    const label = followingPlayer ? "POSICIONANDO VISÃO DO JOGADOR" : "ÁREA DOS JOGADORES";
    ctx.font = "700 11px Segoe UI, Arial";
    const labelWidth = ctx.measureText(label).width + 18;
    const labelX = Math.max(0, Math.min(window.innerWidth - labelWidth, topLeft.x));
    const labelY = Math.max(0, Math.min(window.innerHeight - 24, topLeft.y - 24));
    ctx.fillStyle = "#241b1b";
    ctx.fillRect(labelX, labelY, labelWidth, 24);
    ctx.fillStyle = "#f4d7a1";
    ctx.fillText(label, labelX + 9, labelY + 16);
    ctx.restore();
}

function drawPlayerPreview() {
    const width = previewCanvas.width;
    const height = previewCanvas.height;
    const scale = width / playerView.width;
    const detailScale = width / 960;
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.fillStyle = THEME.background;
    previewCtx.fillRect(0, 0, width, height);
    previewCtx.save();
    previewCtx.setTransform(scale, 0, 0, scale, -playerView.x * scale, -playerView.y * scale);
    if (mapState.loaded) {
        const mapWidth = mapState.image.width * mapState.scale;
        const mapHeight = mapState.image.height * mapState.scale;
        previewCtx.drawImage(mapState.image, mapState.x - mapWidth / 2, mapState.y - mapHeight / 2, mapWidth, mapHeight);
    }
    if (gridSettings.visible && gridSettings.size > 0 && playerView.width / gridSettings.size < 300) {
        const size = gridSettings.size;
        const startX = Math.ceil((playerView.x - gridSettings.offsetX) / size) * size + gridSettings.offsetX;
        const startY = Math.ceil((playerView.y - gridSettings.offsetY) / size) * size + gridSettings.offsetY;
        previewCtx.beginPath();
        for (let x = startX; x <= playerView.x + playerView.width; x += size) {
            previewCtx.moveTo(x, playerView.y); previewCtx.lineTo(x, playerView.y + playerView.height);
        }
        for (let y = startY; y <= playerView.y + playerView.height; y += size) {
            previewCtx.moveTo(playerView.x, y); previewCtx.lineTo(playerView.x + playerView.width, y);
        }
        previewCtx.strokeStyle = `rgba(205, 38, 61, ${gridSettings.opacity})`;
        previewCtx.lineWidth = detailScale / scale;
        previewCtx.stroke();
    }
    VIEW_RULES.publishedTokens(tokens).forEach((token) => {
        if (!token.loaded) return;
        const tokenHeight = getTokenHeight(token);
        previewCtx.save();
        previewCtx.translate(token.x, token.y);
        previewCtx.rotate(token.rotation);
        previewCtx.drawImage(token.image, -token.width / 2, -tokenHeight / 2, token.width, tokenHeight);
        previewCtx.restore();
        if (token.showName || token.showHealth) {
            let labelY = token.y + tokenHeight / 2 + 12 * detailScale / scale;
            if (token.showName) {
                previewCtx.textAlign = "center";
                previewCtx.font = `600 ${12 * detailScale / scale}px Segoe UI, Arial`;
                previewCtx.lineWidth = 3 * detailScale / scale;
                previewCtx.strokeStyle = "#070509";
                previewCtx.strokeText(token.name, token.x, labelY);
                previewCtx.fillStyle = "#fff1f3";
                previewCtx.fillText(token.name, token.x, labelY);
                labelY += 7 * detailScale / scale;
            }
            if (token.showHealth) {
                const barWidth = Math.max(60 * detailScale / scale, token.width);
                previewCtx.fillStyle = "#070509";
                previewCtx.fillRect(token.x - barWidth / 2, labelY, barWidth, 5 * detailScale / scale);
                previewCtx.fillStyle = token.color;
                previewCtx.fillRect(token.x - barWidth / 2, labelY, barWidth * Math.max(0, Math.min(1, token.hp / token.maxHp)), 5 * detailScale / scale);
            }
        }
    });
    previewCtx.restore();
}

function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.fillStyle = THEME.background;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    drawMap();
    if (hudVisible) { drawAtmosphere(); drawGrid(); }
    tokens.forEach(drawToken);
    if (hudVisible) {
        drawTokenSelections(); drawTokenControls(); drawMarqueeSelection(); drawMeasurement();
        drawPlayerFrame(); drawCornerMarks(); drawOverlay();
    }
    if (!hudVisible && followingPlayer) drawPlayerFrame();
}

// Inicialização
async function initialize() {
    resizeCanvas(); updateMapUI(); updateGridUI(); updateTokenLibrary(); updateTokenInspector();
    const restored = await loadLastSession(false);
    if (!restored) {
        clearMap(false);
        setSaveStatus("Mesa vazia · importe um mapa PNG e seus tokens");
        scheduleSave();
    } else setSaveStatus(mapState.loaded || tokens.length
        ? "Mesa restaurada automaticamente"
        : "Mesa vazia · importe um mapa PNG e seus tokens");
    updateEmptyTabletop();
    sceneHistory.reset(captureSceneState());
    historyReady = true;
    updateHistoryUI();
    requestRender();
}

const tabletopReady = initialize();
window.REAL_TABLETOP_CONTROLS = Object.freeze({
    state: () => ({ ruler: activeMode === "ruler", snap: gridSettings.snapTokens,
        following: Boolean(followingPlayer), hudVisible, selection: selectedTokenList().map((token) => ({ id: token.id, name: token.name, visible: token.visibleToPlayers })) }),
    focusSelection: frameMasterCamera, toggleVisibility: toggleSelectedVisibility,
    duplicate: duplicateSelectedToken, remove: deleteSelectedToken,
    editSelection: () => closePanels("tokens"), toggleFollow: togglePlayerFollow
});
window.REAL_TABLETOP_MASTER = Object.freeze({
    ready: tabletopReady,
    campaignKey: tableId || "autosave",
    sceneId: () => currentSceneId,
    snapshot: serializeSession,
    async flush() { clearTimeout(saveTimer); return saveSession(); },
    async switchScene(sceneId) {
        if (!WORKSPACE || sceneLoading) return false;
        if (followingPlayer) cancelPlayerFollow();
        resetInteraction();
        if (!await this.flush()) throw new Error("A cena atual não pôde ser salva. Tente novamente.");
        sceneLoading = true;
        try {
            const workspace = await WORKSPACE.activate(tableId || "autosave", sceneId);
            const scene = WORKSPACE.active(workspace);
            await applySession({ ...scene.session, sceneId: scene.id });
            sceneHistory.reset(captureSceneState()); updateHistoryUI();
            await saveSession("Cena carregada: " + scene.name);
            window.dispatchEvent(new CustomEvent("real:scene-switched", { detail: { sceneId: scene.id, name: scene.name } }));
            return true;
        } finally { sceneLoading = false; }
    },
    captureThumbnail() {
        drawPlayerPreview();
        const thumbnail = document.createElement("canvas"); thumbnail.width = 320; thumbnail.height = 180;
        thumbnail.getContext("2d").drawImage(previewCanvas, 0, 0, 320, 180);
        return thumbnail.toDataURL("image/jpeg", .6);
    },
    startPlayerStream() {
        if (playerStream) return playerStream;
        if (typeof previewCanvas.captureStream !== "function") return null;
        drawPlayerPreview();
        try {
            playerStream = previewCanvas.captureStream(0);
            playerStreamTrack = playerStream.getVideoTracks()[0] || null;
            if (!playerStreamTrack || typeof playerStreamTrack.requestFrame !== "function") {
                playerStream.getTracks().forEach((track) => track.stop());
                playerStream = previewCanvas.captureStream(8);
                playerStreamTrack = playerStream.getVideoTracks()[0] || null;
            }
        } catch {
            playerStream = previewCanvas.captureStream(8);
            playerStreamTrack = playerStream.getVideoTracks()[0] || null;
        }
        if (playerStreamTrack && "contentHint" in playerStreamTrack) playerStreamTrack.contentHint = "detail";
        requestPlayerStreamFrame(true);
        return playerStream;
    },
    stopPlayerStream() {
        if (!playerStream) return;
        clearTimeout(playerFrameTimer);
        playerFrameTimer = null;
        playerStream.getTracks().forEach((track) => track.stop());
        playerStream = null;
        playerStreamTrack = null;
        lastPlayerFrameAt = 0;
    },
    capturePlayerFrame() {
        drawPlayerPreview();
        const published = document.createElement("canvas");
        published.width = 720;
        published.height = 405;
        published.getContext("2d").drawImage(previewCanvas, 0, 0, published.width, published.height);
        return published.toDataURL("image/jpeg", 0.6);
    }
});
