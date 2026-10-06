// TABLETOP 2D — MESA TÁTICA

const $ = (id) => document.getElementById(id);
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const panels = { grid: $("gridPanel"), tokens: $("tokenPanel"), session: $("sessionPanel"), view: $("playerViewPanel") };
const panelButtons = { grid: $("toolMap"), tokens: $("toolToken"), session: $("toolSession"), view: $("toolPlayerView") };
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
const previewDialog = $("playerPreview");
const previewCanvas = $("playerPreviewCanvas");
const previewCtx = previewCanvas.getContext("2d");
let playerStream = null;

const THEME = { background: "#070509", grid: "#cd263d", accent: "#fb3b53", accentSoft: "#fecdd3" };
const DEFAULT_GRID = { visible: false, size: 50, opacity: 0.32, offsetX: 0, offsetY: 0, metersPerSquare: 3 };
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

// Renderização sob demanda
function requestRender() {
    if (renderFrameRequested) return;
    renderFrameRequested = true;
    requestAnimationFrame(() => {
        renderFrameRequested = false;
        draw();
        if (previewDialog.open || playerStream) drawPlayerPreview();
    });
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

// Tokens, ficha e camadas
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
    if (!originals.length) return;
    const copies = [];
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
    scheduleSave();
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
    activeMode = mode;
    updateRulerUI();
    updatePlayerViewUI();
    canvas.style.cursor = mode === "ruler" || mode === "player-view" ? "crosshair" : "default";
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
    const point = screenToWorld(event.clientX, event.clientY);
    if (event.button === 2) {
        Object.assign(interaction, { type: "pan", lastX: event.clientX, lastY: event.clientY });
        canvas.style.cursor = "grabbing";
        return;
    }
    if (event.button !== 0) return;
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
    const point = screenToWorld(event.clientX, event.clientY);
    if (measurement.drawing) {
        measurement.end = snapMeasurementPoint(point); requestRender(); return;
    }
    if (interaction.type === "pan") {
        camera.x += (event.clientX - interaction.lastX) / camera.zoom;
        camera.y += (event.clientY - interaction.lastY) / camera.zoom;
        interaction.lastX = event.clientX;
        interaction.lastY = event.clientY;
        requestRender(); return;
    }
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

canvas.addEventListener("mouseup", (event) => {
    if (event.button === 0 && measurement.drawing) {
        measurement.drawing = false; updateRulerUI(); requestRender();
    }
    if (event.button === 0 && interaction.type === "drag" && interaction.token && interaction.moved && event.shiftKey) {
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
    if (interaction.type === "pan") scheduleSave();
    if (event.button === 2 || event.button === 0) {
        interaction.type = null;
        interaction.token = null;
        interaction.tokens = [];
        interaction.anchorStart = null;
        interaction.moved = false;
        interaction.marqueeStart = null;
        interaction.marqueeEnd = null;
        canvas.style.cursor = activeMode === "ruler" || activeMode === "player-view" ? "crosshair" : "default";
    }
});

canvas.addEventListener("mouseleave", () => {
    if (interaction.type) scheduleSave();
    interaction.type = null;
    interaction.token = null;
    interaction.tokens = [];
    interaction.anchorStart = null;
    interaction.moved = false;
    interaction.marqueeStart = null;
    interaction.marqueeEnd = null;
    measurement.drawing = false;
    canvas.style.cursor = activeMode === "ruler" || activeMode === "player-view" ? "crosshair" : "default";
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const point = screenToWorld(event.clientX, event.clientY);
    camera.zoom += event.deltaY < 0 ? 0.1 : -0.1;
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom));
    camera.x = (event.clientX - window.innerWidth / 2) / camera.zoom - point.x;
    camera.y = (event.clientY - window.innerHeight / 2) / camera.zoom - point.y;
    requestRender(); scheduleSave();
}, { passive: false });

// Salvamento persistente com IndexedDB
const DB_NAME = "tabletop2d-storage";
const DB_STORE = "sessions";
const campaignId = new URLSearchParams(location.search).get("campaign");
const SESSION_KEY = campaignId ? "campaign:" + campaignId : "autosave";
if (campaignId) {
    document.querySelector(".campaign-return").href = "index.html#campanha/" + encodeURIComponent(campaignId);
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
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(DB_STORE, "readwrite");
        transaction.objectStore(DB_STORE).put(data, SESSION_KEY);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
}

async function readSession() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const store = database.transaction(DB_STORE, "readonly").objectStore(DB_STORE);
        const request = store.get(SESSION_KEY);
        request.onsuccess = () => {
            if (request.result || campaignId !== "campanha-inicial") {
                resolve(request.result || null);
                return;
            }
            const legacy = store.get("autosave");
            legacy.onsuccess = () => resolve(legacy.result || null);
            legacy.onerror = () => reject(legacy.error);
        };
        request.onerror = () => reject(request.error);
    });
}

function serializeSession() {
    return {
        version: 1,
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

async function saveSession(message = "Mesa salva automaticamente") {
    try {
        await writeSession(serializeSession());
        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setSaveStatus(message + " · " + time);
    } catch {
        setSaveStatus("Não foi possível salvar esta mesa");
    }
}

function scheduleSave() {
    clearTimeout(saveTimer);
    $("saveStatus").textContent = "Salvando…";
    saveTimer = setTimeout(() => saveSession(), 300);
    window.dispatchEvent(new Event("real:tabletop-changed"));
}

async function applySession(data) {
    if (!data) return false;
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
    try {
        const data = await readSession();
        if (!data) return false;
        await applySession(data);
        if (showMessage) setSaveStatus("Última mesa carregada");
        return true;
    } catch {
        setSaveStatus("Não foi possível carregar a mesa");
        return false;
    }
}

async function createNewSession() {
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
    await saveSession("Nova mesa criada");
}

$("saveSession").addEventListener("click", () => saveSession("Mesa salva"));
$("loadSession").addEventListener("click", () => loadLastSession());
$("newSession").addEventListener("click", async () => {
    if (window.confirm("Criar uma nova mesa e substituir o salvamento atual?")) await createNewSession();
});

// Teclado
window.addEventListener("keydown", (event) => {
    const isTyping = event.target.matches?.("input, textarea, select");
    if (!isTyping && !document.querySelector("dialog[open]") && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        toggleHud();
        return;
    }
    if (event.key === "Escape") {
        closePanels();
        clearMeasurement();
        setMode("select");
        if (!isTyping) setTokenSelection([]);
    }
    if (hudVisible && !isTyping && event.key === "Delete") deleteSelectedToken();
    if (hudVisible && !isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault(); setTokenSelection(tokens, tokens.at(-1) || null);
    }
    if (hudVisible && !isTyping && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault(); duplicateSelectedToken();
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
    const label = "ÁREA DOS JOGADORES";
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
    requestRender();
}

const tabletopReady = initialize();
window.REAL_TABLETOP_MASTER = Object.freeze({
    ready: tabletopReady,
    campaignKey: campaignId || "autosave",
    startPlayerStream() {
        if (playerStream) return playerStream;
        if (typeof previewCanvas.captureStream !== "function") return null;
        drawPlayerPreview();
        playerStream = previewCanvas.captureStream(24);
        playerStream.getVideoTracks().forEach((track) => {
            if ("contentHint" in track) track.contentHint = "detail";
        });
        return playerStream;
    },
    stopPlayerStream() {
        if (!playerStream) return;
        playerStream.getTracks().forEach((track) => track.stop());
        playerStream = null;
    },
    capturePlayerFrame() {
        drawPlayerPreview();
        const published = document.createElement("canvas");
        published.width = 800;
        published.height = 450;
        published.getContext("2d").drawImage(previewCanvas, 0, 0, published.width, published.height);
        return published.toDataURL("image/jpeg", 0.68);
    }
});
