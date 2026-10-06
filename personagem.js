const STORAGE_KEY = "cronicas-biblioteca-v2";
const THEMES = window.REAL_ATTRIBUTE_THEMES;
const NEX_RULES = window.REAL_NEX_RULES;
const EQUIPMENT_CATALOG = window.REAL_EQUIPMENT_CATALOG || [];
const EQUIPMENT_COLLECTIONS = window.REAL_EQUIPMENT_COLLECTIONS || [];
const EQUIPMENT_RULES = window.REAL_EQUIPMENT_RULES;
const INVENTORY_RULES = window.REAL_INVENTORY_RULES;
const ABILITY_CATALOG = window.REAL_ABILITY_CATALOG;
const PROGRESSION_RULES = window.REAL_PROGRESSION_RULES;
const RITUAL_CATALOG = window.REAL_RITUAL_CATALOG;
const SHEET_MECHANICS = window.REAL_SHEET_MECHANICS;
const MIND_MAP_RULES = window.REAL_MIND_MAP_RULES;
const ATTRIBUTES = [
    { id: "agilidade", name: "Agilidade" },
    { id: "forca", name: "Força" },
    { id: "intelecto", name: "Intelecto" },
    { id: "presenca", name: "Presença" },
    { id: "vigor", name: "Vigor" }
];
const ORIGINS = window.REAL_ORIGINS;
const ORIGIN_NAMES = Object.fromEntries(ORIGINS.map((origin) => [origin.id, origin.name]));
const $ = (id) => document.getElementById(id);
const attributeNodes = new Map();
let attributesDirty = false;
let refreshResourcesForAttributes = () => {};
let refreshSkillsForAttributes = () => {};
let refreshCombatForAttributes = () => {};
let refreshProgressionForNex = () => {};
let refreshRitualProgression = () => {};
let refreshInventoryLimits = () => {};

function validAttribute(value) {
    return Number.isInteger(value) && value >= -100 && value <= 100;
}

function readLibrary() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved && Array.isArray(saved.characters)) return saved;
    } catch { /* A página mostra a mensagem de ficha não encontrada. */ }
    return { characters: [], campaigns: [] };
}

function textOrFallback(value, fallback = "Não informado") {
    const text = typeof value === "string" ? value.trim() : "";
    return text || fallback;
}

function classTheme(character) {
    const stored = [character.class, character.role].map((value) => String(value || "").toLocaleLowerCase("pt-BR"));
    return Object.keys(THEMES).find((key) => key !== "neutral" && stored.some((value) => value === key || value === THEMES[key].label.toLocaleLowerCase("pt-BR").replace("classe: ", ""))) || "neutral";
}

function applyTheme(key) {
    const theme = THEMES[key];
    document.body.dataset.characterTheme = key;
    for (const [property, value] of Object.entries({
        "--accent": theme.accent,
        "--accent-light": theme.accentLight,
        "--accent-ink": theme.accentInk,
        "--accent-rgb": theme.accentRgb,
        "--border": theme.border,
        "--theme-glow": theme.glow
    })) document.body.style.setProperty(property, value);

    const wheel = $("attributeWheelImage");
    wheel.addEventListener("error", () => {
        if (wheel.getAttribute("src") !== THEMES.neutral.image) wheel.src = THEMES.neutral.image;
    });
    wheel.src = theme.image;
    return theme;
}

function renderAttributes(character, theme) {
    const values = $("attributeWheelValues");
    ATTRIBUTES.forEach(({ id, name }) => {
        const stored = character.attributes?.[id];
        const value = validAttribute(stored) ? String(stored) : "—";
        const marker = document.createElement("div");
        marker.className = "attribute-wheel__value";
        marker.setAttribute("role", "group");
        marker.setAttribute("aria-label", `${name}: ${validAttribute(stored) ? value : "não informado"}`);
        const [x, y] = theme.centers[id];
        marker.style.setProperty("--wheel-x", `${x}%`);
        marker.style.setProperty("--wheel-y", `${y}%`);
        marker.style.setProperty("--wheel-value-top", `${theme.valueTop[id] ?? (id === "presenca" || id === "vigor" ? 17 : 22)}%`);
        const number = document.createElement("span");
        number.textContent = value;
        number.setAttribute("aria-hidden", "true");
        const pick = document.createElement("button");
        pick.type = "button";
        pick.className = "attribute-wheel__pick";
        pick.disabled = false;
        pick.setAttribute("aria-label", `Rolar ${name}, valor ${value}`);
        const input = document.createElement("input");
        input.type = "number";
        input.min = "-100";
        input.max = "100";
        input.step = "1";
        input.inputMode = "numeric";
        input.className = "attribute-wheel__input";
        input.setAttribute("aria-label", `Novo valor de ${name}, de menos 100 a 100`);
        input.hidden = true;
        marker.append(number, pick, input);
        values.append(marker);
        attributeNodes.set(id, { name, marker, number, pick, input });
    });
}

function setupAttributeEditing() {
    const toggle = $("toggleAttributeEdit");
    const values = $("attributeWheelValues");
    const hint = $("attributeEditHint");
    let editing = false;
    let activeId = null;

    function closeInput(id, save) {
        if (activeId !== id) return;
        const node = attributeNodes.get(id);
        const raw = node.input.value.trim();
        const next = save && /^[-+]?\d+$/.test(raw) ? Math.max(-100, Math.min(100, Number(raw))) : null;
        node.input.hidden = true;
        node.pick.hidden = false;
        activeId = null;
        if (next === null) return;
        const previous = character.attributes?.[id];
        if (next === previous) return;
        character.attributes = { ...(character.attributes || {}), [id]: next };
        node.number.textContent = String(next);
        node.marker.setAttribute("aria-label", `${node.name}: ${next}`);
        node.pick.setAttribute("aria-label", `Editar ${node.name}, valor ${next}`);
        attributesDirty = true;
        refreshResourcesForAttributes();
        refreshSkillsForAttributes();
        refreshCombatForAttributes();
        persistSheet();
    }

    attributeNodes.forEach(({ pick, input }, id) => {
        pick.addEventListener("click", () => {
            if (!editing) {
                const roll = EQUIPMENT_RULES.rollTest(character.attributes?.[id]);
                if (!roll) return showRollError("Preencha o valor desse atributo antes de rolar.");
                showDiceResult({ name: attributeNodes.get(id).name }, roll.dice, roll.chosenIndex, 0, roll.useLowest);
                return;
            }
            if (activeId) closeInput(activeId, true);
            activeId = id;
            pick.hidden = true;
            input.value = validAttribute(character.attributes?.[id]) ? String(character.attributes[id]) : "";
            input.hidden = false;
            input.focus();
            input.select?.();
        });
        input.addEventListener("change", () => closeInput(id, true));
        input.addEventListener("blur", () => closeInput(id, true));
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                closeInput(id, event.key === "Enter");
                pick.focus();
            }
        });
    });

    toggle.addEventListener("click", () => {
        if (activeId) closeInput(activeId, true);
        editing = !editing;
        values.dataset.editing = String(editing);
        toggle.setAttribute("aria-pressed", String(editing));
        toggle.setAttribute("aria-label", editing ? "Concluir edição dos atributos" : "Editar atributos");
        toggle.title = editing ? "Concluir edição" : "Editar atributos";
        hint.hidden = !editing;
        attributeNodes.forEach(({ pick, name, number }) => {
            pick.setAttribute("aria-label", `${editing ? "Editar" : "Rolar"} ${name}, valor ${number.textContent}`);
        });
    });
}

function renderOptional(id, value) {
    const element = $(id);
    const content = textOrFallback(value, "Ainda não preenchido.");
    element.textContent = content;
    element.classList.toggle("is-empty", content === "Ainda não preenchido.");
}

const library = readLibrary();
const characterId = new URLSearchParams(location.search).get("id");
const character = library.characters.find((entry) => entry && String(entry.id) === characterId);
if (!character) {
    $("missingCharacter").hidden = false;
} else {
    const theme = applyTheme(classTheme(character));
    const name = textOrFallback(character.name, "Personagem sem nome");
    document.title = `${name} | R.E.A.L`;
    $("characterName").textContent = name;
    $("infoCharacterName").textContent = name;
    $("characterTheme").textContent = theme.label;
    $("characterOrigin").textContent = textOrFallback(character.originName || ORIGIN_NAMES[character.origin]);
    $("characterClass").textContent = theme === THEMES.neutral
        ? textOrFallback(character.role || character.class)
        : theme.label.replace("Classe: ", "");
    $("characterPlayer").textContent = textOrFallback(character.player);
    const campaigns = Array.isArray(library.campaigns) ? library.campaigns : [];
    const joinedCampaigns = campaigns.filter((campaign) => Array.isArray(campaign.characters) && campaign.characters.includes(character.id)).map((campaign) => campaign.name).filter(Boolean).join(" · ");
    $("characterCampaign").textContent = textOrFallback(joinedCampaigns, "Nenhuma campanha");
    $("editCharacter").href = `ficha.html?id=${encodeURIComponent(character.id)}`;
    renderOptional("characterAppearance", character.appearance);
    renderOptional("characterPersonality", character.personality);
    renderOptional("characterHistory", character.history || character.description);
    renderOptional("characterObjective", character.objective);
    renderAttributes(character, theme);
    $("characterContent").hidden = false;
}

function setupTabs(selector, dataKey, initial) {
    const tabs = [...document.querySelectorAll(selector)];
    function activate(id, focus = false) {
        tabs.forEach((tab) => {
            const active = tab.dataset[dataKey] === id;
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
            $(tab.getAttribute("aria-controls")).hidden = !active;
            if (active && focus) tab.focus();
        });
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab.dataset[dataKey]));
        tab.addEventListener("keydown", (event) => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
            else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = tabs.length - 1;
            else return;
            event.preventDefault();
            activate(tabs[next].dataset[dataKey], true);
        });
    });
    activate(initial);
}

function setupSheetTabs() {
    const tabs = [...document.querySelectorAll("[data-sheet-tab]")];
    const pinned = new Set(["atributos"]);
    const desktop = window.matchMedia?.("(min-width: 900px)");
    let mobileSection = "informacoes";
    let desktopSection = "pericias";

    function render() {
        const isDesktop = Boolean(desktop?.matches);
        const navigation = $("sheetTabs");
        navigation.setAttribute("role", isDesktop ? "navigation" : "tablist");
        navigation.setAttribute("aria-label", isDesktop ? "Outras seções da ficha" : "Seções da ficha");
        tabs.forEach((tab) => {
            const id = tab.dataset.sheetTab;
            const panel = $(tab.getAttribute("aria-controls"));
            const selected = id === (isDesktop ? desktopSection : mobileSection);
            panel.hidden = isDesktop ? !pinned.has(id) && !selected : !selected;
            if (isDesktop) {
                tab.removeAttribute("role");
                tab.removeAttribute("aria-selected");
                tab.setAttribute("aria-pressed", String(selected));
                tab.tabIndex = pinned.has(id) ? -1 : 0;
                panel.setAttribute("role", "region");
                panel.setAttribute("aria-label", tab.textContent.trim());
            } else {
                tab.setAttribute("role", "tab");
                tab.setAttribute("aria-selected", String(selected));
                tab.removeAttribute("aria-pressed");
                tab.tabIndex = selected ? 0 : -1;
                panel.setAttribute("role", "tabpanel");
                panel.removeAttribute("aria-label");
            }
        });
    }

    function activate(id, focus = false) {
        if (desktop?.matches) {
            if (!pinned.has(id)) desktopSection = id;
        } else mobileSection = id;
        render();
        if (focus) tabs.find((tab) => tab.dataset.sheetTab === id)?.focus();
    }

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => activate(tab.dataset.sheetTab));
        tab.addEventListener("keydown", (event) => {
            const available = desktop?.matches ? tabs.filter((entry) => !pinned.has(entry.dataset.sheetTab)) : tabs;
            const index = available.indexOf(tab);
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % available.length;
            else if (event.key === "ArrowLeft") next = (index - 1 + available.length) % available.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = available.length - 1;
            else return;
            event.preventDefault();
            activate(available[next].dataset.sheetTab, true);
        });
    });
    desktop?.addEventListener?.("change", render);
    render();
}

const ENTRY_TYPES = {
    inventario: { list: "inventoryList", singular: "item" },
    habilidades: { list: "abilitiesList", singular: "habilidade" },
    rituais: { list: "ritualsList", singular: "ritual" }
};
const INVENTORY_CATEGORIES = {
    itens: "Itens", armas: "Armas", municoes: "Munições", protecao: "Proteção", geral: "Geral", amaldicoados: "Itens amaldiçoados"
};
const CATALOG_CATEGORIES = ["armas", "municoes", "protecao", "geral", "amaldicoados"];

function bookCategoryLabel(value) {
    return ["0", "I", "II", "III", "IV"][value] ?? String(value);
}

function weaponStatsText(weapon) {
    if (!Number.isInteger(weapon.weaponCategory) || typeof weapon.damage !== "string" || typeof weapon.damageType !== "string"
        || !(Number.isInteger(weapon.critical) || (typeof weapon.critical === "string" && /^(?:\d+\/)?x\d+$/.test(weapon.critical)))
        || !Number.isInteger(weapon.space)) return "";
    const details = [];
    if (weapon.weaponClass) details.push([weapon.weaponClass, weapon.weaponStyle, weapon.hands, weapon.weaponTraits].filter(Boolean).join(" · "));
    details.push(`Categoria ${bookCategoryLabel(weapon.weaponCategory)}`);
    if (weapon.range) details.push(`Alcance ${weapon.range}`);
    details.push(`Dano ${weapon.damage} de ${weapon.damageType}`, `Crítico ${weapon.critical}`, `Espaço ${weapon.space}`);
    if (weapon.ammunition) details.push(`Munição ${weapon.ammunition}`);
    return details.join(" · ");
}
function ammunitionStatsText(ammunition) {
    if (!Number.isInteger(ammunition.itemCategory) || !Number.isInteger(ammunition.space)) return "";
    return `Categoria ${bookCategoryLabel(ammunition.itemCategory)} · Espaço ${ammunition.space}`;
}
function protectionStatsText(protection) {
    if (!Number.isInteger(protection.defense) || !Number.isInteger(protection.itemCategory) || !Number.isInteger(protection.space)) return "";
    return `Defesa +${protection.defense} · Categoria ${bookCategoryLabel(protection.itemCategory)} · Espaços ${protection.space}`;
}
function generalItemStatsText(item) {
    if (!Number.isInteger(item.itemCategory) || !Number.isInteger(item.space)) return "";
    return [item.element || item.itemType, `Categoria ${bookCategoryLabel(item.itemCategory)}`, `Espaços ${item.space}`].filter(Boolean).join(" · ");
}

function setupProgression() {
    const selector = $("trailSelect");
    const field = $("trailField");
    const message = $("trailMessage");
    const timeline = $("trailTimeline");
    const classId = classTheme(character);
    const available = PROGRESSION_RULES?.trails(ABILITY_CATALOG?.catalog, classId) || [];
    const progression = progressionData();
    progression.trail = PROGRESSION_RULES?.normalizeTrail(ABILITY_CATALOG?.catalog, classId, progression.trail) || "";
    progression.versatility = ["power", "trail"].includes(progression.versatility) ? progression.versatility : "";

    for (const trail of available) {
        const option = document.createElement("option");
        option.value = trail;
        option.textContent = trail;
        selector.append(option);
    }

    function render() {
        const nex = Number.isFinite(character.nex) ? character.nex : 0;
        const selected = PROGRESSION_RULES?.normalizeTrail(ABILITY_CATALOG?.catalog, classId, progression.trail) || "";
        const classPowers = PROGRESSION_RULES?.classAbilities(ABILITY_CATALOG?.catalog, classId, nex) || [];
        const trailPowers = PROGRESSION_RULES?.trailAbilities(ABILITY_CATALOG?.catalog, classId, selected, nex) || [];
        const choices = PROGRESSION_RULES.progressionChoices(nex, progression.versatility);
        const registeredPowers = (Array.isArray(sheetData().habilidades) ? sheetData().habilidades : []).filter((entry) => {
            const source = ABILITY_CATALOG.catalog.find((item) => item.id === entry?.abilityCatalogId);
            return source?.category === classId && source?.kind === "Poder de classe";
        }).length;
        $("progressionNex").textContent = classId === "mundano" ? "NEX 0%" : `NEX ${nex}%`;
        selector.value = selected;
        selector.disabled = !available.length || nex < 10;
        field.hidden = !available.length;
        if (!available.length) {
            $("progressionSummary").textContent = classId === "mundano"
                ? "Mundanos não escolhem trilha. Ao escolher uma classe, a progressão correspondente aparecerá aqui."
                : "A classe desta ficha não foi reconhecida; a progressão automática fica desativada.";
            message.textContent = "";
        } else if (nex < 10) {
            $("progressionSummary").textContent = `${classPowers.length} habilidade(s) de classe liberada(s) automaticamente.`;
            message.textContent = "A escolha de trilha fica disponível em NEX 10%.";
        } else if (!selected) {
            $("progressionSummary").textContent = `${classPowers.length} habilidade(s) de classe liberada(s) automaticamente.`;
            message.textContent = "Escolha uma trilha para liberar a habilidade de NEX 10% e acompanhar os próximos marcos.";
        } else {
            $("progressionSummary").textContent = `${classPowers.length} habilidade(s) de classe e ${trailPowers.length} habilidade(s) de ${selected} liberada(s) automaticamente.`;
            const next = PROGRESSION_RULES.trailTimeline(ABILITY_CATALOG.catalog, classId, selected, nex).find((item) => !item.unlocked);
            message.textContent = next ? `Próximo marco: ${next.name}, em NEX ${next.minNex}%.` : "Todos os marcos desta trilha foram liberados.";
        }

        timeline.replaceChildren();
        for (const item of PROGRESSION_RULES?.trailTimeline(ABILITY_CATALOG?.catalog, classId, selected, nex) || []) {
            const milestone = document.createElement("li");
            milestone.dataset.unlocked = String(item.unlocked);
            const level = document.createElement("strong");
            level.textContent = `NEX ${item.minNex}%`;
            const name = document.createElement("span");
            name.textContent = item.name;
            milestone.append(level, name);
            timeline.append(milestone);
        }
        $("classPowerProgress").textContent = `${registeredPowers} / ${choices.powerSlots}`;
        $("attributeIncreaseProgress").textContent = `${choices.attributeIncreases} ${choices.attributeIncreases === 1 ? "liberado" : "liberados"}`;
        $("trainingProgress").textContent = NEX_RULES.trainingMaximum(classId, nex) === 15 ? "Expert +15" : NEX_RULES.trainingMaximum(classId, nex) === 10 ? "Veterano +10" : "Treinado +5";
        $("versatilitySelect").value = progression.versatility;
        $("versatilitySelect").disabled = !choices.versatilityAvailable;
        $("versatilityField").hidden = !available.length;
        const nextChoice = PROGRESSION_RULES.nextChoiceMilestone(nex);
        const notices = [];
        if (registeredPowers < choices.powerSlots) notices.push(`Falta registrar ${choices.powerSlots - registeredPowers} poder(es) de classe liberado(s).`);
        if (registeredPowers > choices.powerSlots) notices.push(`${registeredPowers - choices.powerSlots} poder(es) excedem as escolhas básicas; confira fontes adicionais.`);
        if (choices.versatilityAvailable && !progression.versatility) notices.push("Defina como Versatilidade foi usada.");
        if (nextChoice) notices.push(`Próxima escolha: ${nextChoice.label}, em NEX ${nextChoice.nex}%.`);
        else if (classId !== "mundano") notices.push("Todos os marcos básicos de escolha foram liberados.");
        $("choiceProgressionMessage").textContent = notices.join(" ");
    }

    selector.addEventListener("change", () => {
        const next = PROGRESSION_RULES.normalizeTrail(ABILITY_CATALOG.catalog, classId, selector.value);
        const previous = progression.trail;
        progression.trail = next;
        if (!persistSheet()) {
            progression.trail = previous;
            render();
            message.textContent = "Não foi possível salvar a trilha. Tente liberar espaço neste navegador.";
            return;
        }
        render();
        renderEntries("habilidades");
        refreshPassiveEffects();
        message.textContent = next ? `${next} foi definida como a trilha principal desta ficha.` : "A trilha principal foi removida.";
    });
    $("versatilitySelect").addEventListener("change", () => {
        const next = ["power", "trail"].includes($("versatilitySelect").value) ? $("versatilitySelect").value : "";
        const previous = progression.versatility;
        progression.versatility = next;
        if (!persistSheet()) {
            progression.versatility = previous;
            render();
            return;
        }
        render();
        $("trailMessage").textContent = next === "power" ? "Versatilidade reservou uma escolha adicional de poder de classe." : next === "trail" ? "Adicione manualmente pelo catálogo a habilidade de NEX 10% da outra trilha." : "Versatilidade ainda não foi definida.";
    });
    render();
    return render;
}

const SKILLS = [
    { id: "acrobacia", name: "Acrobacia", attribute: "agilidade", loadPenalty: true },
    { id: "adestramento", name: "Adestramento", attribute: "presenca", trainingMark: true },
    { id: "artes", name: "Artes", attribute: "presenca", trainingMark: true },
    { id: "atletismo", name: "Atletismo", attribute: "forca" },
    { id: "atualidades", name: "Atualidades", attribute: "intelecto" },
    { id: "ciencias", name: "Ciências", attribute: "intelecto", trainingMark: true },
    { id: "crime", name: "Crime", attribute: "agilidade", trainingMark: true, loadPenalty: true },
    { id: "diplomacia", name: "Diplomacia", attribute: "presenca" },
    { id: "enganacao", name: "Enganação", attribute: "presenca" },
    { id: "fortitude", name: "Fortitude", attribute: "vigor" },
    { id: "furtividade", name: "Furtividade", attribute: "agilidade", loadPenalty: true },
    { id: "iniciativa", name: "Iniciativa", attribute: "agilidade" },
    { id: "intimidacao", name: "Intimidação", attribute: "presenca" },
    { id: "intuicao", name: "Intuição", attribute: "presenca" },
    { id: "investigacao", name: "Investigação", attribute: "intelecto" },
    { id: "luta", name: "Luta", attribute: "forca" },
    { id: "medicina", name: "Medicina", attribute: "intelecto" },
    { id: "ocultismo", name: "Ocultismo", attribute: "intelecto", trainingMark: true },
    { id: "percepcao", name: "Percepção", attribute: "presenca" },
    { id: "pilotagem", name: "Pilotagem", attribute: "agilidade", trainingMark: true },
    { id: "pontaria", name: "Pontaria", attribute: "agilidade" },
    { id: "profissao", name: "Profissão", attribute: "intelecto", trainingMark: true },
    { id: "reflexos", name: "Reflexos", attribute: "agilidade" },
    { id: "religiao", name: "Religião", attribute: "presenca", trainingMark: true },
    { id: "sobrevivencia", name: "Sobrevivência", attribute: "intelecto" },
    { id: "tatica", name: "Tática", attribute: "intelecto", trainingMark: true },
    { id: "tecnologia", name: "Tecnologia", attribute: "intelecto", trainingMark: true },
    { id: "vontade", name: "Vontade", attribute: "presenca" }
];
const TRAINING_VALUES = [0, 5, 10, 15];
const characterOrigin = character && ORIGINS.find((origin) => [character.origin, character.originName].some((value) => [origin.id, origin.name.toLocaleLowerCase("pt-BR")].includes(String(value || "").toLocaleLowerCase("pt-BR"))));
let inventoryFilter = "todos";
let entryKind = null;
let saveTimer = null;

function sheetData() {
    if (!character.sheet || typeof character.sheet !== "object" || Array.isArray(character.sheet)) character.sheet = {};
    return character.sheet;
}

function progressionData() {
    const data = sheetData();
    if (!data.progression || typeof data.progression !== "object" || Array.isArray(data.progression)) data.progression = {};
    return data.progression;
}

function inventoryRulesData() {
    const data = sheetData();
    if (!data.inventoryRules || typeof data.inventoryRules !== "object" || Array.isArray(data.inventoryRules)) data.inventoryRules = {};
    const settings = data.inventoryRules;
    settings.prestige = INVENTORY_RULES.clampPrestige(settings.prestige);
    if (!settings.categoryBonuses || typeof settings.categoryBonuses !== "object" || Array.isArray(settings.categoryBonuses)) settings.categoryBonuses = {};
    for (const category of [1, 2, 3, 4]) {
        const value = settings.categoryBonuses[category];
        settings.categoryBonuses[category] = Number.isInteger(value) ? Math.max(0, Math.min(99, value)) : 0;
    }
    settings.loadBonus = Number.isInteger(settings.loadBonus) ? Math.max(-99, Math.min(99, settings.loadBonus)) : 0;
    return settings;
}

function setupInventoryLimits() {
    const settings = inventoryRulesData();
    const patentSelect = $("patentSelect");
    const prestigeInput = $("prestigeInput");
    for (const patent of INVENTORY_RULES.PATENTS) {
        const option = document.createElement("option");
        option.value = patent.id;
        option.textContent = `${patent.name} · ${patent.prestige} PP`;
        patentSelect.append(option);
    }

    function render() {
        const result = INVENTORY_RULES.calculate({
            items: sheetData().inventario,
            prestige: settings.prestige,
            strength: character.attributes?.forca,
            categoryBonuses: settings.categoryBonuses,
            loadBonus: settings.loadBonus
        });
        prestigeInput.value = String(settings.prestige);
        patentSelect.value = result.patent.id;
        $("creditLimit").textContent = result.patent.credit;
        $("inventoryLoad").textContent = `${result.used} / ${result.capacity} espaços`;
        $("inventoryLoad").dataset.exceeded = String(result.overloaded);
        for (const category of [1, 2, 3, 4]) {
            const counter = $(`inventoryCategory${category}`);
            counter.textContent = `${result.counts[category]} / ${result.limits[category]}`;
            counter.dataset.exceeded = String(result.excess[category] > 0);
            $(`categoryBonus${category}`).value = String(settings.categoryBonuses[category]);
        }
        $("loadBonus").value = String(settings.loadBonus);
        const notices = [];
        for (const category of [1, 2, 3, 4]) {
            if (result.excess[category]) notices.push(`Categoria ${bookCategoryLabel(category)} excedida em ${result.excess[category]}.`);
        }
        if (result.immobile) notices.push("A carga passa do dobro do limite; o personagem fica imóvel até aliviar o peso.");
        else if (result.overloaded) notices.push(`Sobrecarga de ${result.used - result.capacity} espaço(s).`);
        if (result.unknownCategory || result.unknownSpace) {
            const details = [];
            if (result.unknownCategory) details.push(`${result.unknownCategory} sem categoria`);
            if (result.unknownSpace) details.push(`${result.unknownSpace} sem espaços`);
            notices.push(`Há ${details.join(" e ")} no inventário; complete esses dados pelo catálogo ou use os ajustes.`);
        }
        $("inventoryLimitMessage").textContent = notices.length ? notices.join(" ") : `Inventário dentro dos limites de ${result.patent.name}.`;
        return result;
    }

    prestigeInput.addEventListener("change", () => {
        const raw = prestigeInput.value.trim();
        if (!/^\d+$/.test(raw)) { render(); return; }
        const previous = settings.prestige;
        settings.prestige = INVENTORY_RULES.clampPrestige(Number(raw));
        if (!persistSheet()) settings.prestige = previous;
        render();
    });
    patentSelect.addEventListener("change", () => {
        const previous = settings.prestige;
        settings.prestige = INVENTORY_RULES.patent(patentSelect.value).prestige;
        if (!persistSheet()) settings.prestige = previous;
        render();
    });
    for (const category of [1, 2, 3, 4]) {
        $(`categoryBonus${category}`).addEventListener("change", () => {
            const input = $(`categoryBonus${category}`);
            const raw = input.value.trim();
            const previous = settings.categoryBonuses[category];
            settings.categoryBonuses[category] = /^\d+$/.test(raw) ? Math.max(0, Math.min(99, Number(raw))) : previous;
            if (!persistSheet()) settings.categoryBonuses[category] = previous;
            render();
        });
    }
    $("loadBonus").addEventListener("change", () => {
        const raw = $("loadBonus").value.trim();
        const previous = settings.loadBonus;
        settings.loadBonus = /^[-+]?\d+$/.test(raw) ? Math.max(-99, Math.min(99, Number(raw))) : previous;
        if (!persistSheet()) settings.loadBonus = previous;
        render();
    });
    render();
    return render;
}

function automaticProgressionAbilities() {
    if (!PROGRESSION_RULES || !ABILITY_CATALOG) return [];
    const classId = classTheme(character);
    const progression = progressionData();
    return PROGRESSION_RULES.automaticAbilities({
        catalog: ABILITY_CATALOG.catalog,
        classId,
        trail: progression.trail,
        nex: Number.isFinite(character.nex) ? character.nex : NEX_RULES.normalizeNex(classId, character.nex) || 0
    }).map((item) => ({
        ...item,
        abilityCatalogId: item.id,
        abilityKind: item.kind,
        automaticSource: item.progressionSource,
        category: item.category,
        description: item.description
    }));
}

function automaticAbilityEntries() {
    const entries = [];
    if (characterOrigin?.ability) entries.push({
        name: characterOrigin.ability,
        description: characterOrigin.effect,
        automaticSource: "origin",
        automaticLabel: `Habilidade de origem · ${characterOrigin.name}`
    });
    entries.push(...automaticProgressionAbilities());
    return entries;
}

function setupRitualProgression() {
    function render() {
        const classId = classTheme(character);
        const nex = Number.isFinite(character.nex) ? character.nex : 0;
        const rituals = Array.isArray(sheetData().rituais) ? sheetData().rituais.length : 0;
        const learnedChoices = (Array.isArray(sheetData().habilidades) ? sheetData().habilidades : []).filter((entry) => {
            const source = ABILITY_CATALOG.catalog.find((item) => item.id === entry?.abilityCatalogId);
            return source?.name === "Aprender Ritual" || ABILITY_CATALOG.normalize(entry?.name) === ABILITY_CATALOG.normalize("Aprender Ritual");
        }).length;
        const circle = PROGRESSION_RULES.ritualCircle(classId, nex, learnedChoices);
        if (classId === "ocultista") {
            const expected = PROGRESSION_RULES.occultistRitualsKnown(nex);
            $("ritualProgressionSummary").textContent = `Progressão básica de Ocultista: acesso até o ${circle}º círculo · ${rituals} ritual(is) registrado(s) · ${expected} aprendizado(s) de classe até este NEX. Extras de trilha e poderes são contados separadamente.`;
        } else if (learnedChoices) {
            $("ritualProgressionSummary").textContent = `Aprender Ritual registrado ${learnedChoices} vez(es): acesso até o ${circle}º círculo neste NEX · ${rituals} ritual(is) na ficha. Confira o limite por Intelecto e outras fontes com o mestre.`;
        } else {
            $("ritualProgressionSummary").textContent = `${rituals} ritual(is) registrado(s). Esta classe não recebe círculos automaticamente; Aprender Ritual ou outra fonte deve justificar o acesso.`;
        }
    }
    render();
    return render;
}

function persistSheet() {
    try {
        const latest = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        const current = latest?.characters?.find((entry) => entry && String(entry.id) === String(character.id));
        if (!current) throw new Error("Ficha não encontrada no armazenamento");
        current.sheet = sheetData();
        if (attributesDirty) current.attributes = { ...character.attributes };
        if (NEX_RULES.allowedNex(classTheme(character)).includes(character.nex)) current.nex = character.nex;
        window.REAL_ACCOUNT?.markLibraryDirty(latest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
        window.REAL_ACCOUNT?.libraryChanged();
        attributesDirty = false;
        $("storageNote").textContent = window.REAL_ACCOUNT?.isSignedIn() ? "Sincronizando esta ficha com sua conta…" : "Esta ficha está salva neste navegador.";
        return true;
    } catch {
        $("storageNote").textContent = "Não foi possível salvar. Verifique o espaço disponível neste navegador.";
        return false;
    }
}

function scheduleSheetSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistSheet, 350);
}

function setupNexResources() {
    const classId = classTheme(character);
    const allowed = NEX_RULES.allowedNex(classId);
    const selector = $("nexSelect");
    const status = $("resourceMessage");
    const systemDialog = $("resourceSystemDialog");
    const data = sheetData();
    const resourceIds = [...NEX_RULES.RESOURCES, "determinacao"];
    data.resourceSystem = data.resourceSystem === "determinacao" ? "determinacao" : "esforco-sanidade";
    function renderSystem() {
        const determination = data.resourceSystem === "determinacao";
        $("resourceSystemName").textContent = determination ? "Determinação" : "Esforço e Sanidade";
        $("effortLimitLabel").textContent = determination ? "PD / turno" : "PE / turno";
        $("esforcoResource").hidden = determination;
        $("sanidadeResource").hidden = determination;
        $("determinacaoResource").hidden = !determination;
        $("useEffortSanity").setAttribute("aria-pressed", String(!determination));
        $("useDetermination").setAttribute("aria-pressed", String(determination));
    }
    $("chooseResourceSystem").addEventListener("click", () => systemDialog.showModal());
    $("cancelResourceSystem").addEventListener("click", () => systemDialog.close());
    for (const [button, system] of [["useEffortSanity", "esforco-sanidade"], ["useDetermination", "determinacao"]]) {
        $(button).addEventListener("click", () => {
            const previousSystem = data.resourceSystem;
            data.resourceSystem = system;
            if (!persistSheet()) { data.resourceSystem = previousSystem; return; }
            renderSystem();
            if (allowed.length) render();
            systemDialog.close();
            status.textContent = `Sistema: ${system === "determinacao" ? "Determinação" : "Esforço e Sanidade"}. Os valores anteriores continuam guardados.`;
        });
    }
    renderSystem();
    if (!allowed.length) {
        $("characterNex").textContent = "NEX não definido";
        const option = document.createElement("option");
        option.textContent = "Indisponível";
        selector.append(option);
        selector.disabled = true;
        $("nexExplanation").textContent = "Esta ficha não possui uma classe reconhecida. Edite a criação para calcular os recursos.";
        for (const id of NEX_RULES.RESOURCES) {
            $(`${id}Current`).disabled = true;
            $(`${id}Bonus`).disabled = true;
            $(`${id}Decrease`).disabled = true;
            $(`${id}Increase`).disabled = true;
        }
        $("determinacaoMaxInput").disabled = true;
        $("determinacaoTurnInput").disabled = true;
        $("determinacaoCurrent").disabled = true;
        $("determinacaoDecrease").disabled = true;
        $("determinacaoIncrease").disabled = true;
        return () => {};
    }

    for (const value of allowed) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `${value}%`;
        selector.append(option);
    }
    character.nex = NEX_RULES.normalizeNex(classId, character.nex);
    const previous = data.resources && typeof data.resources === "object" && !Array.isArray(data.resources) ? data.resources : {};
    const resources = {};
    for (const id of resourceIds) {
        const stored = previous[id] && typeof previous[id] === "object" ? previous[id] : {};
        resources[id] = { current: stored.current, max: stored.max, bonus: NEX_RULES.clampBonus(stored.bonus) };
        if (id === "determinacao") {
            resources[id].max = Number.isInteger(stored.max) ? Math.max(0, Math.min(99999, stored.max)) : 0;
            resources[id].current = Number.isInteger(stored.current) ? Math.max(0, Math.min(resources[id].max, stored.current)) : resources[id].max;
        }
    }
    data.resources = resources;
    let totals;

    function recalculate() {
        const bonuses = Object.fromEntries(NEX_RULES.RESOURCES.map((id) => [id, resources[id].bonus]));
        totals = NEX_RULES.calculate({ classId, nex: character.nex, attributes: character.attributes, origin: characterOrigin?.id, bonuses, automaticBonuses: passiveEffects().resources });
        for (const id of NEX_RULES.RESOURCES) {
            const item = resources[id];
            const nextMax = totals.maxima[id];
            const previousMax = Number.isInteger(item.max) && item.max >= 0 ? item.max : nextMax;
            const previousCurrent = Number.isInteger(item.current) ? item.current : previousMax;
            item.current = Math.max(0, Math.min(nextMax, previousCurrent + nextMax - previousMax));
            item.max = nextMax;
        }
    }

    function render() {
        selector.value = String(character.nex);
        $("characterNex").textContent = `NEX ${character.nex}%`;
        $("pePerTurn").textContent = data.resourceSystem === "determinacao" ? (Number.isInteger(data.determinationPerTurn) ? String(data.determinationPerTurn) : "—") : String(totals.pePerTurn + passiveEffects().perTurn);
        const presence = Number.isInteger(character.attributes?.presenca) ? character.attributes.presenca : 0;
        $("ritualDifficulty").textContent = String(10 + totals.pePerTurn + presence);
        $("nexExplanation").textContent = classId === "mundano"
            ? "Mundano: NEX 0%. Os recursos não progridem até escolher uma classe na criação."
            : `NEX ${character.nex}% · nível ${totals.level}. ${data.resourceSystem === "determinacao" ? "Vida acompanha a classe e o Vigor; máximo e limite de PD são manuais." : "Os máximos acompanham a classe, Vigor e Presença."}${characterOrigin?.id === "cultista-arrependido" && data.resourceSystem !== "determinacao" ? " A origem reduz pela metade apenas a Sanidade inicial." : ""}`;
        for (const id of resourceIds) {
            const item = resources[id];
            $(`${id}Value`).textContent = String(item.current);
            $(`${id}Maximum`).textContent = String(item.max);
            $(`${id}Current`).value = String(item.current);
            $(`${id}Current`).max = String(item.max);
            if (id !== "determinacao") $(`${id}Bonus`).value = String(item.bonus);
            $(`${id}Decrease`).disabled = item.current <= 0;
            $(`${id}Increase`).disabled = item.current >= item.max;
            const progress = $(`${id}Progress`);
            progress.max = Math.max(1, item.max);
            progress.value = item.current;
            progress.setAttribute("aria-valuetext", `${item.current} de ${item.max}`);
        }
        $("determinacaoMaxInput").value = String(resources.determinacao.max);
        $("determinacaoTurnInput").value = Number.isInteger(data.determinationPerTurn) ? String(data.determinationPerTurn) : "";
    }

    function save(message) {
        status.textContent = message;
        render();
        if (!persistSheet()) status.textContent = "Não foi possível salvar a mudança. Os valores desta sessão ainda não foram guardados; confira o aviso de armazenamento.";
    }

    recalculate();
    render();
    selector.addEventListener("change", () => {
        const next = Number(selector.value);
        if (!allowed.includes(next)) { render(); return; }
        if (next === character.nex) return;
        character.nex = next;
        recalculate();
        save(`NEX atualizado para ${next}%. Os máximos foram recalculados sem apagar o dano já sofrido.`);
        refreshProgressionForNex();
        renderEntries("habilidades");
        refreshRitualProgression();
        refreshPassiveEffects();
    });
    for (const id of resourceIds) {
        const name = { vida: "Vida", esforco: "Esforço", sanidade: "Sanidade", determinacao: "Determinação" }[id];
        const item = resources[id];
        const input = $(`${id}Current`);
        const bonus = id === "determinacao" ? null : $(`${id}Bonus`);
        const changeBy = (delta) => {
            const next = Math.max(0, Math.min(item.max, item.current + delta));
            if (next === item.current) return;
            item.current = next;
            save(`${name}: ${next} de ${item.max}.`);
        };
        $(`${id}Decrease`).addEventListener("click", () => changeBy(-1));
        $(`${id}Increase`).addEventListener("click", () => changeBy(1));
        input.addEventListener("change", () => {
            const next = Number(input.value);
            if (input.value.trim() === "" || !Number.isInteger(next) || next < 0 || next > item.max) {
                status.textContent = `Informe um valor de ${name} entre 0 e ${item.max}.`;
                render();
                return;
            }
            if (next === item.current) return;
            item.current = next;
            save(`${name}: ${next} de ${item.max}.`);
        });
        bonus?.addEventListener("change", () => {
            const next = Number(bonus.value);
            if (bonus.value.trim() === "" || !Number.isInteger(next) || next < -999 || next > 999) {
                status.textContent = `O ajuste de ${name} deve ser um inteiro entre −999 e 999.`;
                render();
                return;
            }
            if (next === item.bonus) return;
            item.bonus = next;
            recalculate();
            save(`Máximo de ${name} ajustado para ${item.max}.`);
        });
    }
    $("determinacaoMaxInput").addEventListener("change", () => {
        const input = $("determinacaoMaxInput");
        const next = Number(input.value);
        if (!input.value.trim() || !Number.isInteger(next) || next < 0 || next > 99999) {
            status.textContent = "Informe um máximo de Determinação entre 0 e 99999.";
            render(); return;
        }
        const item = resources.determinacao;
        item.current = Math.max(0, Math.min(next, item.current + next - item.max));
        item.max = next;
        save(`Máximo de Determinação ajustado para ${next}.`);
    });
    $("determinacaoTurnInput").addEventListener("change", () => {
        const input = $("determinacaoTurnInput");
        const next = Number(input.value);
        if (!input.value.trim() || !Number.isInteger(next) || next < 0 || next > 99999) {
            status.textContent = "Informe um limite de PD por turno entre 0 e 99999.";
            render(); return;
        }
        data.determinationPerTurn = next;
        save(`Limite de PD por turno: ${next}.`);
    });
    return () => { recalculate(); render(); };
}

function equippedItem(slot) {
    const data = sheetData();
    if (typeof data[slot] !== "string" || !data[slot]) return null;
    const inventory = Array.isArray(data.inventario) ? data.inventario : [];
    return inventory.find((item) => item && EQUIPMENT_RULES.slot(item) === slot && item.id === data[slot]) || null;
}
function equippedWeapon() { return equippedItem("equippedWeaponId"); }
function handsConflict() {
    const luta = skillSettings(SKILLS.find((skill) => skill.id === "luta"));
    return Boolean(equippedItem("equippedShieldId") && EQUIPMENT_RULES.twoHands(equippedWeapon(), effectiveTraining("luta", luta)));
}
function passiveEffects() {
    const classId = classTheme(character);
    const allowed = NEX_RULES.allowedNex(classId);
    const level = classId === "mundano" || !allowed.length ? 0 : allowed.indexOf(NEX_RULES.normalizeNex(classId, character.nex)) + 1;
    return SHEET_MECHANICS.effects({ entries: [...(Array.isArray(sheetData().habilidades) ? sheetData().habilidades : []), ...automaticProgressionAbilities()],
        catalog: ABILITY_CATALOG.catalog, originAbility: characterOrigin?.ability, level,
        enabled: sheetData().automaticEffects !== false });
}
function refreshPassiveEffects() {
    refreshResourcesForAttributes();
    refreshSkillsForAttributes();
    refreshCombatForAttributes();
    const effects = passiveEffects();
    $("automaticEffectsSummary").textContent = sheetData().automaticEffects === false ? "Bônus automáticos desativados. Use os ajustes manuais."
        : `Bônus calculados: ${effects.applied.join(" · ") || "nenhum poder permanente suportado nesta ficha"}. Condições e imunidades não são automatizadas.`;
}
function skillBonus(skill, settings) {
    return effectiveTraining(skill.id, settings) + settings.other + (passiveEffects().skills[skill.id] || 0) - (skill.loadPenalty && EQUIPMENT_RULES.isHeavy(equippedItem("equippedArmorId")) ? 5 : 0);
}
function combatNumber(value) { return Number.isFinite(value) ? Math.max(-1000, Math.min(1000, value)) : 0; }
function defenseSettings() {
    const saved = sheetData().defenses;
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}
function renderDefenses() {
    const armor = equippedItem("equippedArmorId"), shield = equippedItem("equippedShieldId");
    const adjustment = defenseSettings();
    const agi = character.attributes?.agilidade;
    const conflict = handsConflict();
    const equipment = [armor, conflict ? null : shield].reduce((sum, item) => sum + (Number.isFinite(item?.defense) ? item.defense : 0), 0);
    const powerDefense = passiveEffects().defense;
    const defense = validAttribute(agi) ? 10 + agi + equipment + combatNumber(adjustment.defense) + powerDefense : null;
    const fortitude = skillSettings(SKILLS.find((skill) => skill.id === "fortitude"));
    const reflexos = skillSettings(SKILLS.find((skill) => skill.id === "reflexos"));
    const trainedBlock = effectiveTraining("fortitude", fortitude) > 0;
    const trainedDodge = effectiveTraining("reflexos", reflexos) > 0;
    $("defenseValue").textContent = defense === null ? "—" : String(defense);
    $("blockValue").textContent = trainedBlock ? String(Math.max(0, skillBonus(SKILLS.find(skill => skill.id === "fortitude"), fortitude) + combatNumber(adjustment.block))) : "Sem treino";
    $("dodgeValue").textContent = trainedDodge && defense !== null ? String(defense + skillBonus(SKILLS.find(skill => skill.id === "reflexos"), reflexos) + combatNumber(adjustment.dodge)) : "Sem treino / atributo";
    $("protectionValue").textContent = [armor?.name, shield?.name].filter(Boolean).join(" + ") || "Nenhuma";
    $("resistanceValue").textContent = [EQUIPMENT_RULES.isHeavy(armor) ? "Balístico, corte, impacto e perfuração 2" : "", typeof adjustment.resistance === "string" ? adjustment.resistance : ""].filter(Boolean).join(" · ") || "Nenhuma registrada";
    $("proficiencyValue").textContent = typeof adjustment.proficiency === "string" && adjustment.proficiency ? adjustment.proficiency : "Registrar nos ajustes";
    $("defenseExplanation").textContent = `Defesa = 10 + AGI ${validAttribute(agi) ? agi : "—"} + equipamento ${equipment} + poderes ${powerDefense} + outros ${formatBonus(combatNumber(adjustment.defense))}. Bloqueio usa o bônus de Fortitude; Esquiva soma o bônus de Reflexos à Defesa. Ambos exigem treino.${EQUIPMENT_RULES.isHeavy(armor) ? " Proteção pesada: −5 nas perícias marcadas com +." : ""}${conflict ? " Escudo sem bônus: há uma arma de duas mãos equipada. Corrija o equipamento ou a empunhadura." : ""}`;
}
function setupDefenseAdjustments() {
    for (const [id, key, numeric] of [["defenseBonus", "defense", true], ["blockBonus", "block", true], ["dodgeBonus", "dodge", true], ["resistanceNotes", "resistance", false], ["proficiencyNotes", "proficiency", false]]) {
        const field = $(id);
        field.value = numeric ? String(combatNumber(defenseSettings()[key])) : String(defenseSettings()[key] || "");
        field.addEventListener("change", () => {
            const previous = sheetData().defenses;
            sheetData().defenses = { ...defenseSettings(), [key]: numeric ? combatNumber(Number(field.value)) : field.value.trim().slice(0, 200) };
            if (!persistSheet()) {
                sheetData().defenses = previous;
                field.value = numeric ? String(combatNumber(defenseSettings()[key])) : String(defenseSettings()[key] || "");
            }
            renderDefenses();
        });
    }
}
function weaponSettings(weapon) {
    const saved = weapon.combat && typeof weapon.combat === "object" && !Array.isArray(weapon.combat) ? weapon.combat : {};
    const settings = { ...EQUIPMENT_RULES.defaults(weapon), ...saved };
    if (!["luta", "pontaria"].includes(settings.skill)) settings.skill = EQUIPMENT_RULES.defaults(weapon).skill;
    if (settings.attribute !== "skill" && !ATTRIBUTES.some((item) => item.id === settings.attribute)) settings.attribute = "skill";
    if (settings.damageAttribute !== "none" && !ATTRIBUTES.some((item) => item.id === settings.damageAttribute)) settings.damageAttribute = "none";
    settings.attackBonus = combatNumber(settings.attackBonus);
    settings.damageBonus = combatNumber(settings.damageBonus);
    return settings;
}
function attackProfile(weapon) {
    const settings = weaponSettings(weapon);
    const skill = SKILLS.find((item) => item.id === settings.skill);
    const training = skillSettings(skill);
    const attribute = settings.attribute === "skill" ? training.attribute : settings.attribute;
    return { settings, skill, attribute, bonus: skillBonus(skill, training) + settings.attackBonus };
}
function effectiveCritical(value) {
    const critical = EQUIPMENT_RULES.parseCritical(value);
    if (!critical) return null;
    const effects = passiveEffects();
    return { threshold: Math.max(1, critical.threshold - effects.criticalMargin), multiplier: critical.multiplier + effects.criticalMultiplier };
}
function rollWeaponAttack(weapon) {
    if (handsConflict()) return showRollError("Há um escudo e uma arma de duas mãos equipados. Corrija o equipamento ou a empunhadura antes de atacar.");
    const profile = attackProfile(weapon);
    const roll = EQUIPMENT_RULES.rollTest(character.attributes?.[profile.attribute]);
    if (!roll) return showRollError("Preencha o atributo usado no ataque na roda da ficha.");
    showDiceResult({ name: `Ataque · ${weapon.name}` }, roll.dice, roll.chosenIndex, profile.bonus, roll.useLowest);
    const critical = effectiveCritical(profile.settings.critical);
    const natural = roll.dice[roll.chosenIndex];
    const note = document.createElement("p");
    note.className = "roll-result__error";
    note.textContent = critical && natural >= critical.threshold ? `Ameaça de crítico (${critical.threshold}+ no d20). Confirme o acerto com o mestre antes de rolar dano crítico.` : "Compare o total do ataque com a Defesa do alvo.";
    $("skillRollResult").append(note);
    $("skillRollResult").setAttribute("aria-label", `${$("skillRollResult").getAttribute("aria-label")} ${note.textContent}`);
}
function rollWeaponDamage(weapon, isCritical) {
    const settings = weaponSettings(weapon);
    let base = EQUIPMENT_RULES.parseDamage(settings.damage);
    const extra = settings.extraDamage ? EQUIPMENT_RULES.parseDamage(settings.extraDamage) : null;
    const critical = effectiveCritical(settings.critical);
    if (!base || (settings.extraDamage && !extra)) return showRollError("Configure o dano com uma expressão como 1d6 ou 2d8+2. Dano extra usa o mesmo formato.");
    if (isCritical && !critical) return showRollError("Configure o crítico como 20, 19, x3 ou 19/x3.");
    const attribute = settings.damageAttribute === "none" ? 0 : character.attributes?.[settings.damageAttribute];
    if (!validAttribute(attribute)) return showRollError("Preencha o atributo somado ao dano na roda da ficha.");
    const effects = passiveEffects();
    const melee = weapon.weaponStyle === "Corpo a Corpo";
    if (melee && effects.meleeDie) base = { ...base, count: base.count + effects.meleeDie };
    let powerDamage = melee && settings.skill === "luta" ? effects.meleeDamage : weapon.weaponStyle === "Arma de Fogo" ? effects.firearmDamage : 0;
    if (weapon.weaponStyle === "Arma de Disparo" && effects.rangedAgility) {
        if (!validAttribute(character.attributes?.agilidade)) return showRollError("Preencha Agilidade para aplicar Tiro Certeiro.");
        powerDamage += character.attributes.agilidade;
    }
    const multiplier = isCritical ? critical.multiplier : 1;
    const roll = EQUIPMENT_RULES.rollDamage(base, extra, multiplier, settings.damageBonus + attribute + powerDamage);
    const result = $("skillRollResult");
    result.replaceChildren();
    result.textContent = "";
    result.hidden = false;
    const titleText = `Dano${isCritical ? " crítico" : ""} · ${weapon.name}`;
    const header = document.createElement("div");
    header.className = "roll-result__header";
    const title = document.createElement("strong");
    title.textContent = titleText;
    header.append(title, rollCloseButton(result));
    const total = document.createElement("output");
    total.className = "combat-damage-total";
    total.textContent = String(roll.total);
    const detail = document.createElement("p");
    detail.className = "roll-result__error";
    detail.textContent = `${base.count * multiplier}d${base.sides}: ${roll.dice.join(", ")}${extra ? ` · extra ${extra.count}d${extra.sides}: ${roll.extraDice.join(", ")}` : ""} · bônus fixo ${formatBonus(roll.fixed)}${weapon.damageType ? ` · ${weapon.damageType}` : ""}. Total: ${roll.total}.`;
    result.append(header, total, detail);
    result.setAttribute("aria-label", `${titleText}. ${detail.textContent}`);
}

function renderEquippedWeapon(keepSettingsOpen = false) {
    const container = $("equippedWeapon");
    container.replaceChildren();
    const weapon = equippedWeapon();
    if (!weapon) {
        const empty = document.createElement("p");
        empty.textContent = "Nenhuma arma equipada. Marque uma arma no Inventário para equipá-la.";
        container.append(empty);
        return;
    }
    const name = document.createElement("strong");
    name.textContent = weapon.name;
    container.append(name);
    const stats = weaponStatsText(weapon);
    if (stats) {
        const details = document.createElement("p");
        details.className = "combat-equipped__stats";
        details.textContent = `${weapon.group ? `${weapon.group} · ` : ""}${stats}`;
        container.append(details);
    }
    if (weapon.description) {
        const description = document.createElement("p");
        description.textContent = weapon.description;
        container.append(description);
    }
    const profile = attackProfile(weapon);
    const summary = document.createElement("p");
    summary.className = "combat-equipped__stats";
    function updateSummary() {
        const current = attackProfile(weapon);
        const value = character.attributes?.[current.attribute];
        const count = validAttribute(value) ? `${value > 0 ? value : value === 0 ? 2 : 1 - value}d20${value <= 0 ? " (menor)" : " (maior)"}` : "Atributo não preenchido";
        summary.textContent = `${current.skill.name} · ${count} · bônus ${formatBonus(current.bonus)} · dano ${current.settings.damage || "não configurado"} · crítico ${current.settings.critical}${handsConflict() ? " · Conflito: escudo e arma de duas mãos" : ""}`;
        const effects = passiveEffects();
        const automatic = [];
        if (weapon.weaponStyle === "Corpo a Corpo" && effects.meleeDie) automatic.push("+1 dado base (também multiplica no crítico)");
        if (weapon.weaponStyle === "Corpo a Corpo" && current.settings.skill === "luta" && effects.meleeDamage) automatic.push(`+${effects.meleeDamage} dano fixo`);
        if (weapon.weaponStyle === "Arma de Fogo" && effects.firearmDamage) automatic.push(`+${effects.firearmDamage} dano fixo`);
        if (weapon.weaponStyle === "Arma de Disparo" && effects.rangedAgility) automatic.push("+AGI no dano");
        const critical = effectiveCritical(current.settings.critical);
        if (critical && (effects.criticalMargin || effects.criticalMultiplier)) automatic.push(`crítico efetivo ${critical.threshold}/x${critical.multiplier}`);
        if (automatic.length) summary.textContent += ` · Automático: ${automatic.join(" · ")}`;
    }
    updateSummary();
    const actions = document.createElement("div");
    actions.className = "combat-actions";
    for (const [label, action, callback] of [["Rolar ataque", "attack", () => rollWeaponAttack(weapon)], ["Rolar dano", "damage", () => rollWeaponDamage(weapon, false)], ["Dano crítico", "critical", () => rollWeaponDamage(weapon, true)]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button--primary";
        button.textContent = label;
        button.dataset.combatAction = action;
        button.addEventListener("click", callback);
        actions.append(button);
    }
    const adjustments = document.createElement("details");
    adjustments.className = "resource-adjustments";
    adjustments.open = keepSettingsOpen;
    const heading = document.createElement("summary");
    heading.textContent = "Configurar ataque, dano e empunhadura";
    const fields = document.createElement("div");
    fields.className = "combat-settings";
    const attributeOptions = ATTRIBUTES.map((item) => [item.id, item.name]);
    const specifications = [
        ["Perícia do ataque", "skill", [["luta", "Luta"], ["pontaria", "Pontaria / arremesso"]]],
        ["Atributo do ataque", "attribute", [["skill", "O da perícia"], ...attributeOptions]],
        ["Dano base (ex.: 1d6+2)", "damage", "text"],
        ["Crítico (ex.: 19/x3)", "critical", "text"],
        ["Atributo somado ao dano", "damageAttribute", [["none", "Nenhum"], ...attributeOptions]],
        ["Outros no ataque", "attackBonus", "number"],
        ["Outros no dano", "damageBonus", "number"],
        ["Dano extra (não multiplica)", "extraDamage", "text"],
        ["Empunhadura", "hands", [["auto", "Conforme a arma"], ["one", "Uma mão"], ["two", "Duas mãos"]]]
    ];
    specifications.forEach(([labelText, key, type]) => {
        const label = document.createElement("label");
        label.textContent = labelText;
        const field = document.createElement(Array.isArray(type) ? "select" : "input");
        field.dataset.combatSetting = key;
        field.setAttribute("aria-label", `${labelText} de ${weapon.name}`);
        if (Array.isArray(type)) {
            type.forEach(([optionValue, text]) => {
                const option = document.createElement("option");
                option.value = optionValue;
                option.textContent = text;
                field.append(option);
            });
        } else {
            field.type = type;
            field.maxLength = 40;
            if (type === "number") { field.min = "-1000"; field.max = "1000"; field.step = "1"; }
        }
        field.value = String(profile.settings[key]);
        field.addEventListener("change", () => {
            const previous = weapon.combat;
            const next = type === "number" ? combatNumber(Number(field.value)) : field.value.trim();
            weapon.combat = { ...(previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {}), [key]: next };
            if (equippedItem("equippedShieldId") && EQUIPMENT_RULES.twoHands(weapon, effectiveTraining("luta", skillSettings(SKILLS.find((skill) => skill.id === "luta"))))) {
                weapon.combat = previous;
                field.value = String(weaponSettings(weapon)[key]);
                showRollError("Desequipe o escudo antes de empunhar a arma com duas mãos.");
                return;
            }
            if (!persistSheet()) {
                weapon.combat = previous;
                field.value = String(weaponSettings(weapon)[key]);
                return;
            }
            updateSummary();
            if (key === "hands") {
                const damageField = Array.from(fields.children, (item) => item.children[0]).find((item) => item.dataset.combatSetting === "damage");
                damageField.value = String(weaponSettings(weapon).damage);
            }
            renderDefenses();
        });
        label.append(field);
        fields.append(label);
    });
    const note = document.createElement("small");
    note.textContent = "Armas ágeis podem usar Agilidade: ajuste ataque e dano. Para arremessar, escolha Pontaria. Use dano base para variações de empunhadura. Regras especiais da descrição e falta de proficiência exigem ajuste manual.";
    adjustments.append(heading, fields, note);
    container.append(summary, actions, adjustments);
}

function renderEntries(kind, expandedId = null) {
    const list = $(ENTRY_TYPES[kind].list);
    list.replaceChildren();
    const items = Array.isArray(sheetData()[kind]) ? sheetData()[kind].filter((item) => item && typeof item.name === "string") : [];
    const visible = kind === "inventario" && inventoryFilter !== "todos"
        ? items.filter((item) => item.category === inventoryFilter) : items;
    // Origem, classe e trilha são derivadas da ficha e não entram no array editável.
    // Cópias manuais antigas continuam salvas, mas deixam de aparecer em duplicidade.
    const automatic = kind === "habilidades" ? automaticAbilityEntries() : [];
    const automaticNames = new Set(automatic.map((entry) => ABILITY_CATALOG.normalize(entry.name)));
    const displayItems = kind === "habilidades"
        ? [...automatic, ...visible.filter((item) => !automaticNames.has(ABILITY_CATALOG.normalize(item.name)))]
        : visible;
    if (!displayItems.length) {
        const empty = document.createElement("p");
        empty.className = "entry-list__empty";
        empty.textContent = kind === "inventario" ? "Nada nesta categoria ainda." : `Nenhum${kind === "habilidades" ? "a" : ""} ${ENTRY_TYPES[kind].singular} registrado${kind === "habilidades" ? "a" : ""} ainda.`;
        list.append(empty);
        return;
    }
    let openToggle = null;
    let openPanel = null;
    displayItems.forEach((entry, index) => {
        const fromProgression = Boolean(entry.automaticSource);
        const row = document.createElement("article");
        row.className = fromProgression ? "entry-list__origin entry-item" : "entry-item";
        const toggle = document.createElement("button");
        const panel = document.createElement("div");
        const panelId = `entry-details-${kind}-${index}`;
        const toggleId = `entry-toggle-${kind}-${index}`;
        toggle.type = "button";
        toggle.className = "entry-item__toggle";
        toggle.textContent = entry.name;
        toggle.id = toggleId;
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-controls", panelId);
        panel.id = panelId;
        panel.className = "entry-item__details";
        panel.hidden = true;
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-labelledby", toggleId);
        toggle.addEventListener("click", () => {
            const wasOpen = toggle.getAttribute("aria-expanded") === "true";
            if (openToggle && openToggle !== toggle) {
                openToggle.setAttribute("aria-expanded", "false");
                openPanel.hidden = true;
            }
            toggle.setAttribute("aria-expanded", String(!wasOpen));
            panel.hidden = wasOpen;
            openToggle = wasOpen ? null : toggle;
            openPanel = wasOpen ? null : panel;
        });
        const category = document.createElement("span");
        category.textContent = entry.automaticLabel || (fromProgression && entry.automaticSource === "class"
            ? `Habilidade de classe · ${THEMES[entry.category]?.label?.replace("Classe: ", "") || entry.category} · NEX ${entry.minNex}%`
            : fromProgression && entry.automaticSource === "trail"
                ? `Habilidade de trilha · ${entry.subgroup} · NEX ${entry.minNex}%`
                : kind === "inventario" ? `${INVENTORY_CATEGORIES[entry.category] || "Geral"}${entry.group ? ` · ${entry.group}` : ""}` : kind === "habilidades" ? entry.abilityCatalogId && ABILITY_CATALOG ? ABILITY_CATALOG.classification({ ...entry, kind: entry.abilityKind }) : "Habilidade criada" : entry.ritualCatalogId && RITUAL_CATALOG ? RITUAL_CATALOG.classification(entry) : "Ritual");
        panel.append(category);
        if (kind === "rituais" && entry.ritualCatalogId) {
            const parameters = document.createElement("p"); parameters.className = "entry-item__catalog-stats";
            parameters.textContent = `Normal · Execução: ${entry.execution} · Alcance: ${entry.range} · Alvo/área/efeito: ${entry.target} · Duração: ${entry.duration} · Resistência: ${entry.resistance}`;
            panel.append(parameters);
        }
        if (kind === "habilidades" && entry.requirements) {
            const requirements = document.createElement("p");
            requirements.textContent = `Pré-requisitos: ${entry.requirements}`;
            panel.append(requirements);
        }
        const catalogStats = kind !== "inventario" ? "" : entry.category === "armas" ? weaponStatsText(entry)
            : entry.category === "municoes" ? ammunitionStatsText(entry)
                : entry.category === "protecao" ? protectionStatsText(entry)
                    : (entry.category === "geral" || entry.category === "amaldicoados") ? generalItemStatsText(entry) : "";
        if (catalogStats) {
            const stats = document.createElement("p");
            stats.className = "entry-item__catalog-stats";
            stats.textContent = catalogStats;
            panel.append(stats);
        }
        if (entry.description) {
            const description = document.createElement("p");
            description.textContent = entry.description;
            panel.append(description);
        }
        if (kind === "rituais" && entry.ritualCatalogId) appendRitualRolls(panel, entry);
        let equipCheckbox = null;
        if (kind === "inventario" && EQUIPMENT_RULES.slot(entry)) {
            const slot = EQUIPMENT_RULES.slot(entry);
            const selected = equippedItem(slot) === entry;
            row.dataset.equipped = String(selected);
            toggle.className += " entry-item__toggle--weapon";
            equipCheckbox = document.createElement("input");
            equipCheckbox.type = "checkbox";
            equipCheckbox.className = "entry-item__equip-check";
            equipCheckbox.checked = selected;
            equipCheckbox.setAttribute("aria-label", `${selected ? "Desequipar" : "Equipar"} ${entry.name}`);
            equipCheckbox.setAttribute("title", `${selected ? "Desequipar" : "Equipar"} ${entry.name}`);
            equipCheckbox.addEventListener("change", () => {
                const data = sheetData();
                const previous = data[slot];
                const weapon = slot === "equippedWeaponId" ? entry : equippedWeapon();
                const shield = slot === "equippedShieldId" ? entry : equippedItem("equippedShieldId");
                const luta = skillSettings(SKILLS.find((skill) => skill.id === "luta"));
                if (slot !== "equippedArmorId" && equipCheckbox.checked && weapon && shield && EQUIPMENT_RULES.twoHands(weapon, effectiveTraining("luta", luta))) {
                    equipCheckbox.checked = selected;
                    $("equipmentMessage").textContent = "Arma de duas mãos e escudo não podem ser equipados juntos. Desequipe um deles primeiro ou ajuste uma empunhadura permitida em Combate.";
                    return;
                }
                const hadId = Boolean(entry.id);
                if (!entry.id) entry.id = crypto.randomUUID();
                data[slot] = equipCheckbox.checked ? entry.id : null;
                if (!persistSheet()) {
                    data[slot] = previous;
                    if (!hadId) delete entry.id;
                    equipCheckbox.checked = selected;
                    return;
                }
                $("equipmentMessage").textContent = `${entry.name} ${equipCheckbox.checked ? "equipado" : "desequipado"}.`;
                renderEntries("inventario", toggle.getAttribute("aria-expanded") === "true" ? entry.id : null);
                renderEquippedWeapon();
                setupSkills();
                renderDefenses();
            });
        }
        if (!fromProgression) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "entry-item__remove";
            remove.textContent = `Remover ${ENTRY_TYPES[kind].singular}`;
            remove.setAttribute("aria-label", `Remover ${entry.name}`);
            remove.addEventListener("click", () => {
                if (!window.confirm(`Remover ${entry.name} da ficha?`)) return;
                const data = sheetData();
                const previousItems = data[kind];
                const slot = kind === "inventario" ? EQUIPMENT_RULES.slot(entry) : null;
                const previousEquipped = slot ? data[slot] : null;
                data[kind] = items.filter((item) => item !== entry);
                if (slot && entry.id && data[slot] === entry.id) data[slot] = null;
                if (persistSheet()) {
                    renderEntries(kind);
                    if (kind === "inventario") { renderEquippedWeapon(); setupSkills(); renderDefenses(); refreshInventoryLimits(); }
                    if (kind === "habilidades") { refreshProgressionForNex(); refreshPassiveEffects(); refreshRitualProgression(); persistSheet(); }
                    if (kind === "rituais") refreshRitualProgression();
                } else {
                    data[kind] = previousItems;
                    if (slot) data[slot] = previousEquipped;
                }
            });
            panel.append(remove);
        }
        row.append(toggle);
        if (equipCheckbox) row.append(equipCheckbox);
        row.append(panel);
        list.append(row);
        if (expandedId !== null && entry.id === expandedId) toggle.click();
    });
}

function setupSheetEntries() {
    Object.keys(ENTRY_TYPES).forEach(renderEntries);
    renderEquippedWeapon();
    const dialog = $("entryDialog");
    const catalogDialog = $("catalogDialog");
    function addCatalogItem(item) {
        const category = INVENTORY_CATEGORIES[item.inventoryCategory] ? item.inventoryCategory : "itens";
        const entry = {
            id: crypto.randomUUID(),
            name: item.name,
            description: item.description,
            category,
            catalogId: item.id,
            group: item.group
        };
        if (category === "armas") Object.assign(entry, {
            weaponCategory: item.category,
            damage: item.damage,
            damageType: item.damageType,
            critical: item.critical,
            space: item.space
        });
        if (category === "armas") {
            for (const field of ["range", "weaponClass", "weaponStyle", "hands", "weaponTraits", "ammunition"]) {
                if (item[field]) entry[field] = item[field];
            }
        }
        if (category === "municoes") {
            entry.itemCategory = item.category;
            entry.space = item.space;
        }
        if (category === "protecao") {
            entry.defense = item.defense;
            entry.itemCategory = item.category;
            entry.space = item.space;
        }
        if (category === "geral" || category === "amaldicoados") {
            if (item.itemType) entry.itemType = item.itemType;
            if (item.element) entry.element = item.element;
            entry.itemCategory = item.category;
            entry.space = item.space;
        }
        const entries = sheetData();
        const previous = entries.inventario;
        entries.inventario = [...(Array.isArray(previous) ? previous : []), entry];
        if (!persistSheet()) {
            entries.inventario = previous;
            return;
        }
        catalogDialog.close();
        if (inventoryFilter !== "todos") inventoryFilter = category;
        updateInventoryFilters();
        renderEntries("inventario", entry.id);
        refreshInventoryLimits();
    }
    function renderCatalog(selectedGroup = null, selectedCategory = "armas") {
        const collections = $("catalogCollections");
        const categories = $("catalogCategories");
        const list = $("catalogList");
        collections.replaceChildren();
        categories.replaceChildren();
        list.replaceChildren();
        const groups = new Map(EQUIPMENT_COLLECTIONS.map((collection) => [collection.name, []]));
        EQUIPMENT_CATALOG.forEach((item) => {
            if (!groups.has(item.group)) groups.set(item.group, []);
            groups.get(item.group).push(item);
        });
        if (!groups.size) {
            $("catalogGroupTitle").textContent = "";
            const empty = document.createElement("p");
            empty.className = "catalog-list__empty";
            empty.textContent = "Nenhum item disponível no catálogo ainda.";
            list.append(empty);
            return;
        }
        const activeGroup = groups.has(selectedGroup) ? selectedGroup : groups.keys().next().value;
        const activeCategory = CATALOG_CATEGORIES.includes(selectedCategory) ? selectedCategory : "armas";
        $("catalogGroupTitle").textContent = `${INVENTORY_CATEGORIES[activeCategory]} · ${activeGroup}`;
        groups.forEach((items, groupName) => {
            const collection = EQUIPMENT_COLLECTIONS.find((entry) => entry.name === groupName);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "catalog-collection";
            button.setAttribute("aria-label", `Selecionar catálogo ${groupName}`);
            button.setAttribute("aria-pressed", String(groupName === activeGroup));
            const cover = document.createElement("span");
            cover.className = "catalog-collection__cover";
            if (collection?.cover) {
                const image = document.createElement("img");
                image.src = collection.cover;
                image.alt = "";
                cover.append(image);
            } else {
                cover.textContent = "Capa em breve";
            }
            const name = document.createElement("strong");
            name.textContent = groupName;
            button.append(cover, name);
            button.addEventListener("click", () => renderCatalog(groupName, activeCategory));
            collections.append(button);
        });
        CATALOG_CATEGORIES.forEach((categoryId) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = INVENTORY_CATEGORIES[categoryId];
            button.setAttribute("aria-pressed", String(categoryId === activeCategory));
            button.addEventListener("click", () => renderCatalog(activeGroup, categoryId));
            categories.append(button);
        });
        const visibleItems = groups.get(activeGroup).filter((item) => item.inventoryCategory === activeCategory);
        if (!visibleItems.length) {
            const empty = document.createElement("p");
            empty.className = "catalog-list__empty";
            empty.textContent = "Nenhum item nesta categoria ainda.";
            list.append(empty);
            return;
        }
        let openToggle = null;
        let openPanel = null;
        visibleItems.forEach((item, index) => {
            const row = document.createElement("article");
            row.className = "catalog-item";
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "catalog-item__toggle";
            toggle.id = `catalog-item-toggle-${index}`;
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-controls", `catalog-item-details-${index}`);
            const name = document.createElement("strong");
            name.textContent = item.name;
            const summary = document.createElement("small");
            summary.textContent = item.inventoryCategory === "armas" && item.damage && item.critical
                ? `Dano: ${item.damage}   ·   Crítico: ${item.critical}`
                : ["municoes", "geral", "amaldicoados"].includes(item.inventoryCategory) && Number.isInteger(item.category) && Number.isInteger(item.space)
                    ? `Categoria: ${bookCategoryLabel(item.category)}   ·   Espaços: ${item.space}`
                : item.inventoryCategory === "protecao" && Number.isInteger(item.defense)
                    ? `Defesa: +${item.defense}`
                : INVENTORY_CATEGORIES[item.inventoryCategory] || "Itens";
            toggle.append(name, summary);
            const panel = document.createElement("div");
            panel.id = `catalog-item-details-${index}`;
            panel.className = "catalog-item__details";
            panel.hidden = true;
            panel.setAttribute("role", "region");
            panel.setAttribute("aria-labelledby", toggle.id);
            toggle.addEventListener("click", () => {
                const wasOpen = toggle.getAttribute("aria-expanded") === "true";
                if (openToggle && openToggle !== toggle) {
                    openToggle.setAttribute("aria-expanded", "false");
                    openPanel.hidden = true;
                }
                toggle.setAttribute("aria-expanded", String(!wasOpen));
                panel.hidden = wasOpen;
                openToggle = wasOpen ? null : toggle;
                openPanel = wasOpen ? null : panel;
            });
            if (item.weaponClass) {
                const classification = document.createElement("p");
                classification.className = "catalog-item__classification";
                classification.textContent = [item.weaponClass, item.weaponStyle, item.hands, item.weaponTraits].filter(Boolean).join(" · ");
                panel.append(classification);
            } else if (["municoes", "geral", "amaldicoados"].includes(item.inventoryCategory)) {
                const classification = document.createElement("p");
                classification.className = "catalog-item__classification";
                classification.textContent = item.element || item.itemType || INVENTORY_CATEGORIES[item.inventoryCategory];
                panel.append(classification);
            }
            if (item.inventoryCategory === "armas" || item.inventoryCategory === "protecao") {
                const facts = document.createElement("dl");
                facts.className = "catalog-item__facts";
                const addFact = (label, value) => {
                    if (value === undefined || value === null || value === "") return;
                    const pair = document.createElement("div");
                    const term = document.createElement("dt");
                    const definition = document.createElement("dd");
                    term.textContent = label;
                    definition.textContent = String(value);
                    pair.append(term, definition);
                    facts.append(pair);
                };
                addFact("Categoria", bookCategoryLabel(item.category));
                if (item.inventoryCategory === "armas") {
                    addFact("Alcance", item.range);
                    addFact("Tipo", item.damageType);
                }
                addFact("Espaços", item.space);
                if (item.inventoryCategory === "armas") addFact("Munição", item.ammunition);
                panel.append(facts);
            }
            if (item.description) {
                const description = document.createElement("p");
                description.className = "catalog-item__description";
                description.textContent = item.description;
                panel.append(description);
            }
            const add = document.createElement("button");
            add.type = "button";
            add.className = "button button--primary";
            add.textContent = "Adicionar ao inventário";
            add.setAttribute("aria-label", `Adicionar ${item.name} ao inventário`);
            add.addEventListener("click", () => addCatalogItem(item));
            panel.append(add);
            row.append(toggle, panel);
            list.append(row);
        });
    }
    $("openCatalog").addEventListener("click", () => {
        renderCatalog();
        catalogDialog.showModal();
    });
    $("closeCatalog").addEventListener("click", () => catalogDialog.close());
    document.querySelectorAll("[data-add-entry]").forEach((button) => {
        button.addEventListener("click", () => {
            entryKind = button.dataset.addEntry;
            const action = "Criar";
            $("entryDialogTitle").textContent = `${action} ${ENTRY_TYPES[entryKind].singular}`;
            $("entrySubmit").textContent = `${action} ${ENTRY_TYPES[entryKind].singular}`;
            $("entryCategoryField").hidden = entryKind !== "inventario";
            $("entryForm").reset();
            if (entryKind === "inventario") $("entryCategory").value = inventoryFilter === "todos" ? "itens" : inventoryFilter;
            dialog.showModal();
            $("entryName").focus();
        });
    });
    $("cancelEntry").addEventListener("click", () => dialog.close());
    $("entryForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("entryName").value.trim();
        if (!name || !entryKind) return;
        const entry = {
            id: crypto.randomUUID(),
            name,
            description: $("entryDescription").value.trim()
        };
        if (entryKind === "inventario") entry.category = $("entryCategory").value;
        const entries = sheetData();
        if (!Array.isArray(entries[entryKind])) entries[entryKind] = [];
        entries[entryKind].push(entry);
        if (persistSheet()) {
            dialog.close();
            renderEntries(entryKind);
            if (entryKind === "inventario") refreshInventoryLimits();
            if (entryKind === "habilidades") refreshProgressionForNex();
            if (entryKind === "habilidades" || entryKind === "rituais") refreshRitualProgression();
        }
    });
    document.querySelectorAll("[data-inventory-filter]").forEach((button) => {
        button.addEventListener("click", () => {
            inventoryFilter = button.dataset.inventoryFilter;
            updateInventoryFilters();
            renderEntries("inventario");
        });
    });
    updateInventoryFilters();
}

function setupAbilityCatalog() {
    const dialog = $("abilityCatalogDialog");
    const search = $("abilityCatalogSearch");
    const message = $("abilityCatalogMessage");
    let activeCategory = "combatente";
    let activeSubgroup = "";
    const catalog = ABILITY_CATALOG?.catalog || [];
    const categories = ABILITY_CATALOG?.categories || {};
    const known = () => Array.isArray(sheetData().habilidades) ? sheetData().habilidades : [];
    const alreadyKnown = (item) => ABILITY_CATALOG.duplicate(item, [...known(), ...automaticProgressionAbilities()], characterOrigin?.ability);
    function render() {
        const categoryNav = $("abilityCatalogCategories");
        const subgroupNav = $("abilityCatalogSubgroups");
        const list = $("abilityCatalogList");
        categoryNav.replaceChildren(); subgroupNav.replaceChildren(); list.replaceChildren();
        for (const [key, label] of Object.entries(categories)) {
            const button = document.createElement("button");
            button.type = "button"; button.textContent = label;
            button.setAttribute("aria-pressed", String(key === activeCategory));
            button.addEventListener("click", () => { activeCategory = key; activeSubgroup = ""; search.value = ""; message.textContent = ""; render(); });
            categoryNav.append(button);
        }
        const subgroups = [...new Set(catalog.filter(item => item.category === activeCategory).map(item => item.subgroup))];
        if (!subgroups.includes(activeSubgroup)) activeSubgroup = subgroups[0] || "";
        for (const subgroup of subgroups) {
            const button = document.createElement("button");
            button.type = "button"; button.textContent = subgroup;
            button.setAttribute("aria-pressed", String(subgroup === activeSubgroup));
            button.addEventListener("click", () => { activeSubgroup = subgroup; search.value = ""; message.textContent = ""; render(); });
            subgroupNav.append(button);
        }
        const query = ABILITY_CATALOG?.normalize(search.value.trim()) || "";
        const visible = catalog.filter(item => query
            ? ABILITY_CATALOG.normalize([item.name, item.subgroup, categories[item.category], item.origin, item.requirements].join(" ")).includes(query)
            : item.category === activeCategory && item.subgroup === activeSubgroup);
        $("abilityCatalogGroupTitle").textContent = query ? `Busca no livro · ${visible.length} resultado(s)` : `${categories[activeCategory] || "Habilidades"} · ${activeSubgroup} · ${visible.length}`;
        if (!visible.length) {
            const empty = document.createElement("p"); empty.className = "catalog-list__empty";
            empty.textContent = query ? "Nenhuma habilidade encontrada. Tente outro nome ou crie uma habilidade própria." : "Nenhuma habilidade nesta categoria.";
            list.append(empty); return;
        }
        let openPanel = null; let openToggle = null;
        visible.forEach(item => {
            const row = document.createElement("article"); row.className = "catalog-item";
            const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "catalog-item__toggle";
            toggle.id = `ability-toggle-${item.id}`;
            toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-controls", `ability-details-${item.id}`);
            const name = document.createElement("strong"); name.textContent = item.name;
            const classification = document.createElement("small"); classification.textContent = ABILITY_CATALOG.classification(item);
            toggle.append(name, classification);
            const panel = document.createElement("div"); panel.id = `ability-details-${item.id}`;
            panel.className = "catalog-item__details"; panel.hidden = true;
            panel.setAttribute("role", "region"); panel.setAttribute("aria-labelledby", toggle.id);
            toggle.addEventListener("click", () => {
                const wasOpen = toggle.getAttribute("aria-expanded") === "true";
                if (openPanel && openPanel !== panel) { openPanel.hidden = true; openToggle.setAttribute("aria-expanded", "false"); }
                panel.hidden = wasOpen; toggle.setAttribute("aria-expanded", String(!wasOpen));
                openPanel = wasOpen ? null : panel; openToggle = wasOpen ? null : toggle;
            });
            const description = document.createElement("p"); description.className = "catalog-item__description";
            description.textContent = item.description; panel.append(description);
            if (item.minNex || item.requirements || item.origin) {
                const requirements = document.createElement("p"); requirements.className = "catalog-item__classification";
                requirements.textContent = `Pré-requisitos: ${[item.minNex ? `NEX ${item.minNex}%` : "", item.requirements, item.origin ? `Origem: ${item.origin}` : ""].filter(Boolean).join(" · ")}`;
                panel.append(requirements);
            }
            let affinity = null;
            if (item.affinity) {
                const text = document.createElement("p"); text.textContent = `Afinidade: ${item.affinity}`; panel.append(text);
                const label = document.createElement("label"); label.className = "ability-catalog__affinity";
                affinity = document.createElement("input"); affinity.type = "checkbox";
                affinity.setAttribute("aria-label", `Registrar afinidade de ${item.name}`);
                const caption = document.createElement("span"); caption.textContent = "Registrar versão com afinidade (requer afinidade com o elemento e nova escolha do poder)";
                label.append(affinity, caption); panel.append(label);
            }
            const label = document.createElement("label"); label.className = "ability-catalog__notes";
            label.textContent = "Escolhas/anotações (opcional)";
            const notes = document.createElement("input"); notes.type = "text"; notes.maxLength = 300;
            notes.placeholder = "Perícias escolhidas, arma favorita, elemento, ritual…";
            notes.setAttribute("aria-label", `Escolhas de ${item.name}`); label.append(notes); panel.append(label);
            const advisory = document.createElement("small"); advisory.className = "ability-catalog__advisory";
            advisory.textContent = "Confira classe, trilha, NEX, requisitos e escolhas com o mestre. Registrar não gasta recursos. Apenas bônus permanentes suportados são calculados, se a opção estiver ligada.";
            panel.append(advisory);
            const add = document.createElement("button"); add.type = "button"; add.className = "button button--primary";
            add.textContent = alreadyKnown(item) ? "Já está na ficha" : "Adicionar à ficha";
            add.disabled = alreadyKnown(item); add.setAttribute("aria-label", `Adicionar ${item.name} à ficha`);
            add.addEventListener("click", () => {
                if (alreadyKnown(item)) { message.textContent = "Esta habilidade já está na ficha."; return; }
                const data = sheetData(); const previous = data.habilidades;
                const entry = ABILITY_CATALOG.entry(item, crypto.randomUUID(), affinity?.checked, notes.value.trim());
                data.habilidades = [...known(), entry];
                if (!persistSheet()) { data.habilidades = previous; message.textContent = "Não foi possível salvar. A habilidade não foi adicionada; tente liberar espaço no navegador."; return; }
                refreshPassiveEffects(); persistSheet();
                refreshProgressionForNex();
                refreshRitualProgression();
                renderEntries("habilidades", entry.id); dialog.close(); $("openAbilityCatalog").focus();
            });
            panel.append(add); row.append(toggle, panel); list.append(row);
        });
    }
    $("openAbilityCatalog").addEventListener("click", () => {
        const classKey = classTheme(character);
        activeCategory = categories[classKey] ? classKey : "combatente";
        activeSubgroup = ""; search.value = ""; message.textContent = "";
        render(); dialog.showModal();
    });
    $("closeAbilityCatalog").addEventListener("click", () => { dialog.close(); $("openAbilityCatalog").focus(); });
    search.addEventListener("input", () => { message.textContent = ""; render(); });
}

function setupRitualCatalog() {
    const dialog = $("ritualCatalogDialog");
    const search = $("ritualCatalogSearch");
    const message = $("ritualCatalogMessage");
    const catalog = RITUAL_CATALOG?.catalog || [];
    let activeElement = "Todos"; let activeCircle = 0;
    const known = () => Array.isArray(sheetData().rituais) ? sheetData().rituais : [];
    function render() {
        const elementNav = $("ritualCatalogElements"); const circleNav = $("ritualCatalogCircles");
        const list = $("ritualCatalogList"); elementNav.replaceChildren(); circleNav.replaceChildren(); list.replaceChildren();
        ["Todos", ...(RITUAL_CATALOG?.elements || [])].forEach(element => {
            const button = document.createElement("button"); button.type = "button"; button.textContent = element;
            button.setAttribute("aria-pressed", String(element === activeElement));
            button.addEventListener("click", () => { activeElement = element; message.textContent = ""; render(); }); elementNav.append(button);
        });
        [0, 1, 2, 3, 4].forEach(circle => {
            const button = document.createElement("button"); button.type = "button"; button.textContent = circle ? `${circle}º círculo` : "Todos";
            button.setAttribute("aria-pressed", String(circle === activeCircle));
            button.addEventListener("click", () => { activeCircle = circle; message.textContent = ""; render(); }); circleNav.append(button);
        });
        const query = RITUAL_CATALOG?.normalize(search.value.trim()) || "";
        const visible = catalog.filter(item => (activeElement === "Todos" || item.element === activeElement) && (!activeCircle || item.circle === activeCircle)
            && (!query || RITUAL_CATALOG.normalize(`${item.name} ${item.element} ${item.circle}º círculo`).includes(query)));
        $("ritualCatalogGroupTitle").textContent = `${activeElement === "Todos" ? "Todos os elementos" : activeElement} · ${activeCircle ? `${activeCircle}º círculo` : "Todos os círculos"} · ${visible.length} ritual(is)`;
        if (!visible.length) {
            const empty = document.createElement("p"); empty.className = "catalog-list__empty";
            empty.textContent = "Nenhum ritual com esta busca e filtros. Tente Todos ou crie um ritual próprio."; list.append(empty); return;
        }
        let openPanel = null; let openToggle = null;
        visible.forEach(item => {
            const row = document.createElement("article"); row.className = "catalog-item"; row.dataset.element = item.element;
            const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "catalog-item__toggle";
            toggle.id = `ritual-toggle-${item.id}`; toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-controls", `ritual-details-${item.id}`);
            const name = document.createElement("strong"); name.textContent = item.name;
            const classification = document.createElement("small"); classification.textContent = RITUAL_CATALOG.classification(item); toggle.append(name, classification);
            const panel = document.createElement("div"); panel.id = `ritual-details-${item.id}`; panel.className = "catalog-item__details"; panel.hidden = true;
            panel.setAttribute("role", "region"); panel.setAttribute("aria-labelledby", toggle.id);
            toggle.addEventListener("click", () => {
                const wasOpen = toggle.getAttribute("aria-expanded") === "true";
                if (openPanel && openPanel !== panel) { openPanel.hidden = true; openToggle.setAttribute("aria-expanded", "false"); }
                panel.hidden = wasOpen; toggle.setAttribute("aria-expanded", String(!wasOpen)); openPanel = wasOpen ? null : panel; openToggle = wasOpen ? null : toggle;
            });
            const facts = document.createElement("p"); facts.className = "ritual-catalog__parameters";
            facts.textContent = `Parâmetros da versão normal\nExecução: ${item.execution} · Alcance: ${item.range}\nAlvo/área/efeito: ${item.target}\nDuração: ${item.duration} · Resistência: ${item.resistance}`; panel.append(facts);
            const versions = document.createElement("div"); versions.className = "catalog-categories ritual-catalog__versions";
            versions.setAttribute("role", "group"); versions.setAttribute("aria-label", `Formas de ${item.name}`);
            const versionText = document.createElement("p"); versionText.className = "catalog-item__description";
            const requirementText = document.createElement("p"); requirementText.className = "catalog-item__classification";
            let selectedElement = item.element === "Varia" ? RITUAL_CATALOG.choices[0] : item.element;
            let activeVersion = "normal";
            function showVersion() {
                const version = item.versions[activeVersion];
                versions.children && Array.from(versions.children).forEach(button => button.setAttribute("aria-pressed", String(button.dataset.version === activeVersion)));
                versionText.textContent = `${activeVersion === "normal" ? "Normal" : activeVersion === "discente" ? "Discente" : "Verdadeiro"} · ${item.cost + version.extraCost} PE${version.extraCost ? ` (${item.cost} + ${version.extraCost})` : ""}\n${activeVersion === "normal" ? version.description : `Efeito básico: ${item.description}\n\nAlterações desta forma: ${version.description}`}`;
                requirementText.textContent = `Requisitos: ${RITUAL_CATALOG.versionRequirements({ ...item, element: selectedElement }, version)}`;
            }
            Object.keys(item.versions).forEach(key => {
                const button = document.createElement("button"); button.type = "button"; button.dataset.version = key;
                button.textContent = key === "normal" ? "Normal" : key === "discente" ? "Discente" : "Verdadeiro";
                button.addEventListener("click", () => { activeVersion = key; showVersion(); }); versions.append(button);
            });
            showVersion(); panel.append(versions, versionText, requirementText);
            let elementSelect = null;
            if (item.element === "Varia") {
                const label = document.createElement("label"); label.className = "ability-catalog__notes"; label.textContent = "Elemento escolhido ao aprender";
                elementSelect = document.createElement("select"); elementSelect.setAttribute("aria-label", `Elemento de ${item.name}`);
                RITUAL_CATALOG.choices.forEach(element => { const option = document.createElement("option"); option.value = element; option.textContent = element; elementSelect.append(option); });
                elementSelect.value = selectedElement;
                elementSelect.addEventListener("change", () => { selectedElement = elementSelect.value; showVersion(); updateAdd(); });
                label.append(elementSelect); panel.append(label);
            }
            const label = document.createElement("label"); label.className = "ability-catalog__notes"; label.textContent = "Anotações (opcional)";
            const notes = document.createElement("input"); notes.type = "text"; notes.maxLength = 300; notes.setAttribute("aria-label", `Anotações de ${item.name}`);
            label.append(notes); panel.append(label);
            const advisory = document.createElement("small"); advisory.className = "ability-catalog__advisory";
            advisory.textContent = "Adicionar guarda o ritual e seus aprimoramentos, sem conjurar. Consulte acesso ao círculo, afinidade e requisitos especiais; a versão exibida não é liberada automaticamente."; panel.append(advisory);
            const add = document.createElement("button"); add.type = "button"; add.className = "button button--primary"; add.setAttribute("aria-label", `Adicionar ${item.name} à ficha`);
            function updateAdd() { add.disabled = RITUAL_CATALOG.duplicate(item, known(), selectedElement); add.textContent = add.disabled ? "Já está na ficha" : "Adicionar à ficha"; }
            updateAdd();
            add.addEventListener("click", () => {
                if (RITUAL_CATALOG.duplicate(item, known(), selectedElement)) { message.textContent = "Este ritual já está na ficha."; return; }
                const data = sheetData(); const previous = data.rituais;
                const entry = RITUAL_CATALOG.entry(item, crypto.randomUUID(), selectedElement, notes.value.trim());
                data.rituais = [...known(), entry];
                if (!persistSheet()) { data.rituais = previous; message.textContent = "Não foi possível salvar. O ritual não foi adicionado; tente liberar espaço no navegador."; return; }
                refreshRitualProgression();
                renderEntries("rituais", entry.id); dialog.close(); $("openRitualCatalog").focus();
            });
            panel.append(add); row.append(toggle, panel); list.append(row);
        });
    }
    $("openRitualCatalog").addEventListener("click", () => { activeElement = "Todos"; activeCircle = 0; search.value = ""; message.textContent = ""; render(); dialog.showModal(); });
    $("closeRitualCatalog").addEventListener("click", () => { dialog.close(); $("openRitualCatalog").focus(); });
    search.addEventListener("input", () => { message.textContent = ""; render(); });
}

function updateInventoryFilters() {
    document.querySelectorAll("[data-inventory-filter]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.inventoryFilter === inventoryFilter));
    });
}

function skillSettings(skill) {
    const data = sheetData();
    if (!data.skills || typeof data.skills !== "object" || Array.isArray(data.skills)) data.skills = {};
    const saved = data.skills[skill.id] && typeof data.skills[skill.id] === "object" && !Array.isArray(data.skills[skill.id]) ? data.skills[skill.id] : {};
    const attribute = ATTRIBUTES.some((item) => item.id === saved.attribute) ? saved.attribute : skill.attribute;
    const training = TRAINING_VALUES.includes(saved.training) ? saved.training : 0;
    const other = Number.isFinite(saved.other) ? Math.max(-1000, Math.min(1000, saved.other)) : 0;
    data.skills[skill.id] = Object.assign(saved, { attribute, training, other });
    return data.skills[skill.id];
}

function chosenOriginSkills() {
    const saved = sheetData().originSkillChoices;
    const valid = new Set(SKILLS.map((skill) => skill.id));
    const seen = new Set();
    return Array.from({ length: characterOrigin?.choiceCount || 0 }, (_, index) => {
        const id = Array.isArray(saved) ? saved[index] : null;
        if (!valid.has(id) || seen.has(id)) return "";
        seen.add(id);
        return id;
    });
}

function originGrantsSkill(skillId) {
    return Boolean(characterOrigin?.trainedSkills.includes(skillId) || (characterOrigin?.choiceCount && chosenOriginSkills().includes(skillId)));
}

function effectiveTraining(skillId, settings) {
    return Math.max(settings.training, originGrantsSkill(skillId) ? 5 : 0);
}

function setupOriginTraining() {
    const summary = $("originTrainingSummary");
    const choices = $("originTrainingChoices");
    if (!characterOrigin) {
        summary.textContent = "Nenhuma origem reconhecida para conceder perícias treinadas.";
        return;
    }
    if (!characterOrigin.choiceCount) {
        summary.textContent = `${characterOrigin.name} concede +5 de treino em ${characterOrigin.skills}.`;
        return;
    }
    summary.textContent = `${characterOrigin.name}: duas perícias à escolha do mestre recebem +5 de treino.`;
    choices.hidden = false;
    const selects = [$("originSkillChoice1"), $("originSkillChoice2")];
    const saved = chosenOriginSkills();
    selects.forEach((select, index) => {
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Escolha uma perícia";
        select.append(placeholder);
        SKILLS.forEach((skill) => {
            const option = document.createElement("option");
            option.value = skill.id;
            option.textContent = skill.name;
            select.append(option);
        });
        select.value = saved[index] || "";
        select.addEventListener("change", () => {
            const selected = selects.map((field) => field.value).filter(Boolean);
            if (new Set(selected).size !== selected.length) {
                select.value = "";
                $("originTrainingMessage").textContent = "Escolha duas perícias diferentes.";
                return;
            }
            sheetData().originSkillChoices = selects.map((field) => field.value);
            $("originTrainingMessage").textContent = selected.length === 2 ? "As duas perícias da origem estão treinadas." : "Falta escolher uma perícia da origem.";
            setupSkills();
            refreshCombatForAttributes();
            persistSheet();
        });
    });
    if (saved.filter(Boolean).length < 2) $("originTrainingMessage").textContent = "Escolha as perícias com o mestre para aplicar o treino.";
}

function formatBonus(value) {
    return value > 0 ? `+${value}` : String(value);
}

function rollCloseButton(result) {
    const close = document.createElement("button");
    close.type = "button";
    close.className = "roll-result__close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Fechar resultado da rolagem");
    close.addEventListener("click", () => { result.hidden = true; });
    return close;
}

function showRollError(message) {
    const result = $("skillRollResult");
    result.replaceChildren();
    result.textContent = "";
    result.setAttribute("aria-label", message);
    result.hidden = false;
    const header = document.createElement("div");
    header.className = "roll-result__header";
    const title = document.createElement("strong");
    title.textContent = "Rolagem indisponível";
    header.append(title, rollCloseButton(result));
    const detail = document.createElement("p");
    detail.className = "roll-result__error";
    detail.textContent = message;
    result.append(header, detail);
}

function showDiceResult(skill, dice, chosenIndex, bonus, useLowest) {
    const result = $("skillRollResult");
    const chosen = dice[chosenIndex];
    const otherDice = dice.filter((_, index) => index !== chosenIndex);
    const total = chosen + bonus;
    result.replaceChildren();
    result.textContent = "";
    result.hidden = false;
    result.setAttribute("aria-label", `${skill.name}: ${dice.length}d20: ${dice.join(", ")}. ${useLowest ? "Menor" : "Maior"} dado: ${chosen}. Bônus: ${formatBonus(bonus)}. Total: ${total}.`);

    const header = document.createElement("div");
    header.className = "roll-result__header";
    const title = document.createElement("strong");
    title.textContent = `${skill.name} · ${dice.length}d20`;
    header.append(title, rollCloseButton(result));

    const body = document.createElement("div");
    body.className = "roll-result__body";
    const others = document.createElement("div");
    others.className = "roll-result__others";
    const othersLabel = document.createElement("span");
    othersLabel.textContent = "Outros dados";
    const preview = document.createElement("div");
    preview.className = "roll-result__preview";
    otherDice.slice(0, 3).forEach((die) => {
        const chip = document.createElement("span");
        chip.className = "roll-result__die";
        chip.textContent = `[${die}]`;
        preview.append(chip);
    });
    if (!otherDice.length) {
        const empty = document.createElement("span");
        empty.textContent = "—";
        preview.append(empty);
    }
    const overflow = otherDice.slice(3);
    if (overflow.length) {
        const more = document.createElement("span");
        more.className = "roll-result__more";
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.textContent = `+${overflow.length}`;
        trigger.setAttribute("aria-label", `Ver mais ${overflow.length} ${overflow.length === 1 ? "dado" : "dados"}`);
        trigger.setAttribute("aria-describedby", "rollResultOverflow");
        const tooltip = document.createElement("span");
        tooltip.id = "rollResultOverflow";
        tooltip.className = "roll-result__tooltip";
        tooltip.setAttribute("role", "tooltip");
        tooltip.textContent = overflow.map((die) => `[${die}]`).join(" ");
        more.append(trigger, tooltip);
        preview.append(more);
    }
    others.append(othersLabel, preview);

    const primary = document.createElement("div");
    primary.className = "roll-result__primary";
    const value = document.createElement("output");
    value.textContent = String(total);
    value.setAttribute("aria-label", `Resultado final: ${total}`);
    const explanation = document.createElement("small");
    explanation.textContent = `${useLowest ? "Menor" : "Maior"} d20: ${chosen} · bônus ${formatBonus(bonus)}`;
    primary.append(value, explanation);
    body.append(others, primary);
    result.append(header, body);
}

function showSumResult(name, roll, note = "") {
    const result = $("skillRollResult");
    result.replaceChildren(); result.textContent = ""; result.hidden = false;
    const header = document.createElement("div"); header.className = "roll-result__header";
    const title = document.createElement("strong"); title.textContent = name;
    header.append(title, rollCloseButton(result));
    const total = document.createElement("output"); total.className = "combat-damage-total";
    total.textContent = String(roll.total);
    const detail = document.createElement("p"); detail.className = "roll-result__error";
    detail.textContent = `${roll.expression}: ${roll.details}${roll.bonus ? ` · bônus automático ${formatBonus(roll.bonus)}` : ""}. Total: ${roll.total}. ${note}`;
    result.append(header, total, detail);
    result.setAttribute("aria-label", `${name}. ${detail.textContent}`);
}

function appendRitualRolls(panel, entry) {
    const source = RITUAL_CATALOG.catalog.find(item => item.id === entry.ritualCatalogId);
    const profile = source && SHEET_MECHANICS.ritualDice[source.name];
    const controls = document.createElement("div"); controls.className = "ritual-rolls";
    if (profile) {
        for (const [form, label] of [["normal", "Normal"], ["discente", "Discente"], ["verdadeiro", "Verdadeiro"]]) {
            if (!profile[form] || !source.versions[form]) continue;
            const button = document.createElement("button"); button.type = "button"; button.className = "button button--ghost";
            button.textContent = `${label} · ${profile[form]}`;
            button.setAttribute("aria-label", `Rolar ${source.name} ${label}, ${profile[form]}`);
            button.addEventListener("click", () => {
                const potent = passiveEffects().ritualIntellect;
                const bonus = potent ? character.attributes?.intelecto : 0;
                if (!validAttribute(bonus)) return showRollError("Preencha Intelecto para aplicar Ritual Potente.");
                const roll = SHEET_MECHANICS.rollExpression(profile[form], bonus);
                showSumResult(`${profile.kind} · ${source.name} · ${label}`, roll,
                    "Confira requisitos e resistência. Recursos e PV não foram alterados.");
            });
            controls.append(button);
        }
    }
    const note = document.createElement("p"); note.className = "pending-note";
    note.textContent = profile ? "Somente os dados indicados são rolados. Dano da arma, efeitos recorrentes, resistências e aplicação ao alvo são separados."
        : "Este ritual não tem uma rolagem automática conferida. Use a rolagem livre para os dados indicados na descrição, se houver.";
    panel.append(controls, note);
}

function rollSkill(skill, settings) {
    const attributeValue = character.attributes?.[settings.attribute];
    if (!validAttribute(attributeValue)) {
        showRollError(`O atributo de ${skill.name} ainda não tem um valor válido. Edite a roda de atributos da ficha.`);
        return;
    }
    const { dice, useLowest, chosenIndex } = EQUIPMENT_RULES.rollTest(attributeValue);
    const bonus = skillBonus(skill, settings);
    showDiceResult(skill, dice, chosenIndex, bonus, useLowest);
}

function setupSkills() {
    const body = $("skillsBody");
    body.replaceChildren();
    const classId = classTheme(character);
    const trainingMaximum = NEX_RULES.trainingMaximum(classId, character.nex);
    const nextTrainingMilestone = NEX_RULES.nextTrainingMilestone(classId, character.nex);
    let aboveNex = 0;
    SKILLS.forEach((skill) => {
        const settings = skillSettings(skill);
        const grantedByOrigin = originGrantsSkill(skill.id);
        const row = document.createElement("tr");
        row.dataset.trained = String(effectiveTraining(skill.id, settings) > 0);
        const nameCell = document.createElement("td");
        const nameGroup = document.createElement("div");
        nameGroup.className = "skill-name";
        const roll = document.createElement("button");
        roll.type = "button";
        roll.className = "skill-roll";
        roll.textContent = "20";
        roll.setAttribute("aria-label", `Rolar ${skill.name}`);
        roll.addEventListener("click", () => rollSkill(skill, settings));
        const name = document.createElement("span");
        name.textContent = skill.name;
        nameGroup.append(roll, name);
        if (skill.trainingMark || skill.loadPenalty) {
            const mark = document.createElement("span");
            mark.className = "skill-mark";
            mark.textContent = `${skill.trainingMark ? "*" : ""}${skill.loadPenalty ? "+" : ""}`;
            nameGroup.append(mark);
        }
        if (grantedByOrigin) {
            const originTag = document.createElement("span");
            originTag.className = "skill-origin-tag";
            originTag.textContent = "Origem +5";
            nameGroup.append(originTag);
        }
        nameCell.append(nameGroup);

        const dataCell = document.createElement("td");
        dataCell.dataset.label = "Dados";
        const dataGroup = document.createElement("div");
        dataGroup.className = "skill-data";
        const attribute = document.createElement("select");
        attribute.setAttribute("aria-label", `Atributo usado em ${skill.name}`);
        ATTRIBUTES.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = ({ agilidade: "AGI", forca: "FOR", intelecto: "INT", presenca: "PRE", vigor: "VIG" })[item.id];
            attribute.append(option);
        });
        attribute.value = settings.attribute;
        const count = document.createElement("small");
        function updateCount() {
            const value = character.attributes?.[settings.attribute];
            count.textContent = validAttribute(value) ? `${value > 0 ? value : value === 0 ? 2 : 1 - value}d20${value <= 0 ? " ↓" : ""}` : "—";
        }
        updateCount();
        attribute.addEventListener("change", () => {
            if (!ATTRIBUTES.some((item) => item.id === attribute.value)) return;
            settings.attribute = attribute.value;
            updateCount();
            refreshCombatForAttributes();
            persistSheet();
        });
        dataGroup.append(attribute, count);
        dataCell.append(dataGroup);

        const bonusCell = document.createElement("td");
        bonusCell.dataset.label = "Bônus";
        const bonus = document.createElement("output");
        bonus.className = "skill-bonus";
        function updateBonus(refreshCombat = false) {
            bonus.textContent = formatBonus(skillBonus(skill, settings));
            if (refreshCombat) refreshCombatForAttributes();
        }
        updateBonus();
        bonusCell.append(bonus);

        const trainingCell = document.createElement("td");
        trainingCell.dataset.label = "Treino";
        const training = document.createElement("select");
        training.className = "skill-training";
        training.setAttribute("aria-label", `Treino em ${skill.name}`);
        TRAINING_VALUES.forEach((value) => {
            const option = document.createElement("option");
            option.value = String(value);
            option.textContent = String(value);
            if (grantedByOrigin && value === 0) option.disabled = true;
            if (value > trainingMaximum && value !== effectiveTraining(skill.id, settings)) option.disabled = true;
            training.append(option);
        });
        training.value = String(effectiveTraining(skill.id, settings));
        const trainingAboveNex = effectiveTraining(skill.id, settings) > trainingMaximum;
        row.dataset.trainingAboveNex = String(trainingAboveNex);
        if (trainingAboveNex) aboveNex++;
        training.addEventListener("change", () => {
            const next = Number(training.value);
            if (!TRAINING_VALUES.includes(next) || next > trainingMaximum || (grantedByOrigin && next < 5)) {
                training.value = String(effectiveTraining(skill.id, settings));
                $("skillProgressionSummary").textContent = `O grau máximo neste NEX é +${trainingMaximum}. ${nextTrainingMilestone ? `O próximo grau é liberado em NEX ${nextTrainingMilestone}%.` : ""}`.trim();
                return;
            }
            settings.training = next;
            row.dataset.trained = String(effectiveTraining(skill.id, settings) > 0);
            row.dataset.trainingAboveNex = "false";
            updateBonus(true);
            persistSheet();
        });
        trainingCell.append(training);

        const otherCell = document.createElement("td");
        otherCell.dataset.label = "Outros";
        const other = document.createElement("input");
        other.className = "skill-others";
        other.type = "number";
        other.min = "-1000";
        other.max = "1000";
        other.step = "any";
        other.value = String(settings.other);
        other.setAttribute("aria-label", `Outros bônus em ${skill.name}`);
        other.addEventListener("input", () => {
            if (!other.value.trim() || !Number.isFinite(Number(other.value))) return;
            settings.other = Math.max(-1000, Math.min(1000, Number(other.value)));
            updateBonus(true);
            scheduleSheetSave();
        });
        other.addEventListener("change", () => {
            settings.other = other.value.trim() && Number.isFinite(Number(other.value)) ? Math.max(-1000, Math.min(1000, Number(other.value))) : 0;
            other.value = String(settings.other);
            updateBonus(true);
            persistSheet();
        });
        otherCell.append(other);
        row.append(nameCell, dataCell, bonusCell, trainingCell, otherCell);
        body.append(row);
    });
    const degree = trainingMaximum === 15 ? "expert" : trainingMaximum === 10 ? "veterano" : "treinado";
    $("skillProgressionSummary").textContent = classId === "neutral"
        ? "Classe não reconhecida: os graus de treino permanecem livres para ajuste manual."
        : `Grau máximo no NEX atual: ${degree} (+${trainingMaximum}).${nextTrainingMilestone ? ` Próximo avanço em NEX ${nextTrainingMilestone}%.` : " Grau máximo alcançado."}${aboveNex ? ` ${aboveNex} perícia(s) antiga(s) acima deste limite foram preservadas e estão destacadas.` : ""}`;
}

const SHAPES = MIND_MAP_RULES.SHAPES;
let noteBoardController = null;

function setupNoteBoard() {
    const data = sheetData();
    if (!Array.isArray(data.notes)) data.notes = [];
    data.notes = data.notes.filter((note) => note && SHAPES[note.shape]);
    data.notes.forEach((note) => {
        if (typeof note.id !== "string" || !note.id) note.id = crypto.randomUUID();
        note.color = MIND_MAP_RULES.COLORS.includes(note.color) ? note.color : "violet";
        note.kind = MIND_MAP_RULES.KINDS[note.kind] ? note.kind : "idea";
    });
    data.noteConnections = MIND_MAP_RULES.normalizeConnections(data.noteConnections, data.notes);
    if (!data.mindMapView || typeof data.mindMapView !== "object" || Array.isArray(data.mindMapView)) data.mindMapView = {};
    data.mindMapView.zoom = Number.isFinite(data.mindMapView.zoom) ? Math.max(.5, Math.min(1.5, data.mindMapView.zoom)) : 1;
    const layer = $("noteConnectionLayer");
    const list = $("noteConnectionList");
    const status = $("noteMapStatus");
    const connectButton = $("connectNotes");
    const undoButton = $("undoNoteConnection");
    const color = $("noteColor");
    const kind = $("noteKind");
    const relation = $("noteRelation");
    const duplicate = $("duplicateNote");
    const search = $("noteSearch");
    const canvas = $("noteCanvas");
    const scroll = $("noteCanvasScroll");
    const nodes = new Map();
    let selectedId = null;
    let pendingConnectionId = null;
    let connecting = false;
    let searchQuery = "";

    function setStatus(message = "") {
        status.textContent = message || `${data.notes.length} ideia(s) · ${data.noteConnections.length} ligação(ões).`;
    }

    function connectionMode(active) {
        connecting = active;
        if (!active) pendingConnectionId = null;
        connectButton.setAttribute("aria-pressed", String(active));
        connectButton.textContent = active ? "Cancelar conexão" : "Conectar ideias";
        nodes.forEach((node, id) => { node.dataset.connectionSource = String(active && id === pendingConnectionId); });
    }

    function selectNote(id) {
        selectedId = nodes.has(id) ? id : null;
        nodes.forEach((node, nodeId) => { node.dataset.selected = String(nodeId === selectedId); });
        const note = data.notes.find((item) => item.id === selectedId);
        color.disabled = !note;
        kind.disabled = !note;
        duplicate.disabled = !note;
        if (note) {
            color.value = note.color;
            kind.value = note.kind;
        }
    }

    function matching(note) {
        return MIND_MAP_RULES.matches(note, searchQuery);
    }

    function applySearch() {
        const matches = data.notes.filter(matching).length;
        nodes.forEach((node, id) => {
            node.dataset.searchHidden = String(!matching(data.notes.find((note) => note.id === id)));
        });
        renderConnections();
        setStatus(searchQuery ? `${matches} de ${data.notes.length} ideia(s) correspondem à busca.` : "");
    }

    function renderConnections(rebuildList = true) {
        data.noteConnections = MIND_MAP_RULES.normalizeConnections(data.noteConnections, data.notes);
        layer.replaceChildren();
        if (rebuildList) list.replaceChildren();
        for (const connection of data.noteConnections) {
            const from = data.notes.find((note) => note.id === connection.from);
            const to = data.notes.find((note) => note.id === connection.to);
            const start = MIND_MAP_RULES.center(from);
            const end = MIND_MAP_RULES.center(to);
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.setAttribute("class", "note-connection-group");
            group.setAttribute("data-relation", connection.relation);
            group.setAttribute("data-search-hidden", String(Boolean(searchQuery) && !matching(from) && !matching(to)));
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "note-connection-line");
            line.setAttribute("x1", String(start.x));
            line.setAttribute("y1", String(start.y));
            line.setAttribute("x2", String(end.x));
            line.setAttribute("y2", String(end.y));
            const lineLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            lineLabel.setAttribute("class", "note-connection-label");
            lineLabel.setAttribute("x", String((start.x + end.x) / 2));
            lineLabel.setAttribute("y", String((start.y + end.y) / 2));
            lineLabel.textContent = MIND_MAP_RULES.RELATIONS[connection.relation];
            group.append(line, lineLabel);
            layer.append(group);

            if (!rebuildList) continue;

            const chip = document.createElement("div");
            chip.className = "note-connection-chip";
            const label = document.createElement("span");
            label.textContent = `${MIND_MAP_RULES.title(from)} ↔ ${MIND_MAP_RULES.title(to)}`;
            const relationField = document.createElement("select");
            relationField.setAttribute("aria-label", `Relação entre ${MIND_MAP_RULES.title(from)} e ${MIND_MAP_RULES.title(to)}`);
            for (const [value, relationLabel] of Object.entries(MIND_MAP_RULES.RELATIONS)) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = relationLabel;
                relationField.append(option);
            }
            relationField.value = connection.relation;
            relationField.addEventListener("change", () => {
                connection.relation = MIND_MAP_RULES.RELATIONS[relationField.value] ? relationField.value : "related";
                persistSheet();
                renderConnections();
                setStatus("Tipo da relação atualizado.");
            });
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "×";
            remove.setAttribute("aria-label", `Remover ligação entre ${MIND_MAP_RULES.title(from)} e ${MIND_MAP_RULES.title(to)}`);
            remove.addEventListener("click", () => {
                data.noteConnections = data.noteConnections.filter((item) => item.id !== connection.id);
                persistSheet();
                renderConnections();
                setStatus("Ligação removida.");
            });
            chip.append(label, relationField, remove);
            list.append(chip);
        }
        if (rebuildList && !data.noteConnections.length) {
            const empty = document.createElement("p");
            empty.className = "note-connection-list__empty";
            empty.textContent = "Nenhuma ligação criada ainda.";
            list.append(empty);
        }
        if (rebuildList) undoButton.disabled = !data.noteConnections.length;
        if (!status.textContent) setStatus();
    }

    function beginConnection(noteId) {
        if (!nodes.has(noteId)) return;
        selectNote(noteId);
        if (!connecting || !pendingConnectionId) {
            connecting = true;
            pendingConnectionId = noteId;
            connectionMode(true);
            setStatus(`“${MIND_MAP_RULES.title(data.notes.find((note) => note.id === noteId))}” selecionada. Escolha a segunda ideia.`);
            return;
        }
        if (pendingConnectionId === noteId) {
            connectionMode(false);
            setStatus("Conexão cancelada.");
            return;
        }
        const result = MIND_MAP_RULES.addConnection(data.noteConnections, data.notes, pendingConnectionId, noteId, crypto.randomUUID(), relation.value);
        data.noteConnections = result.connections;
        connectionMode(false);
        if (result.added) {
            persistSheet();
            renderConnections();
            setStatus("Ideias conectadas.");
        } else setStatus("Essas ideias já estão conectadas.");
    }

    function removeNote(noteId, node) {
        if (!window.confirm("Remover esta ideia e todas as ligações dela?")) return;
        const previousNotes = data.notes;
        const previousConnections = data.noteConnections;
        data.notes = data.notes.filter((item) => item.id !== noteId);
        data.noteConnections = data.noteConnections.filter((item) => item.from !== noteId && item.to !== noteId);
        if (!persistSheet()) {
            data.notes = previousNotes;
            data.noteConnections = previousConnections;
            return;
        }
        nodes.delete(noteId);
        node.remove();
        if (selectedId === noteId) selectNote(null);
        if (pendingConnectionId === noteId) connectionMode(false);
        renderConnections();
        setStatus("Ideia removida.");
    }

    function renderAllNotes() {
        nodes.forEach((node) => node.remove());
        nodes.clear();
        data.notes.forEach(renderNote);
        selectNote(null);
        renderConnections();
        applySearch();
    }

    function applyZoom(value, save = true) {
        data.mindMapView.zoom = Math.round(Math.max(.5, Math.min(1.5, value)) * 10) / 10;
        canvas.style.setProperty("--map-zoom", String(data.mindMapView.zoom));
        $("noteZoomValue").textContent = `${Math.round(data.mindMapView.zoom * 100)}%`;
        $("noteZoomOut").disabled = data.mindMapView.zoom <= .5;
        $("noteZoomIn").disabled = data.mindMapView.zoom >= 1.5;
        if (save) persistSheet();
    }

    noteBoardController = { nodes, selectNote, beginConnection, removeNote, renderConnections, zoom: () => data.mindMapView.zoom };
    data.notes.forEach(renderNote);
    renderConnections();
    applyZoom(data.mindMapView.zoom, false);
    document.querySelectorAll("[data-add-shape]").forEach((button) => {
        button.addEventListener("click", () => {
            const shape = button.dataset.addShape;
            const index = data.notes.length;
            const note = { id: crypto.randomUUID(), shape, color: "violet", kind: "idea", x: 35 + (index % 5) * 245, y: 35 + Math.floor(index / 5) * 205, text: "" };
            data.notes.push(note);
            renderNote(note);
            persistSheet();
            selectNote(note.id);
            setStatus("Nova ideia criada. Escreva nela e use o botão de ligação para conectá-la.");
        });
    });
    connectButton.addEventListener("click", () => {
        connectionMode(!connecting);
        setStatus(connecting ? "Modo de conexão ativo. Clique no botão de ligação de uma ideia e depois no de outra." : "Conexão cancelada.");
    });
    undoButton.addEventListener("click", () => {
        if (!data.noteConnections.length) return;
        data.noteConnections = data.noteConnections.slice(0, -1);
        persistSheet();
        renderConnections();
        setStatus("Última ligação desfeita.");
    });
    color.addEventListener("change", () => {
        const note = data.notes.find((item) => item.id === selectedId);
        if (!note || !MIND_MAP_RULES.COLORS.includes(color.value)) return;
        note.color = color.value;
        nodes.get(note.id).dataset.color = note.color;
        persistSheet();
        setStatus(`Cor de “${MIND_MAP_RULES.title(note)}” atualizada.`);
    });
    kind.addEventListener("change", () => {
        const note = data.notes.find((item) => item.id === selectedId);
        if (!note || !MIND_MAP_RULES.KINDS[kind.value]) return;
        note.kind = kind.value;
        const node = nodes.get(note.id);
        node.dataset.kind = note.kind;
        node.kindLabel.textContent = MIND_MAP_RULES.KINDS[note.kind];
        persistSheet();
        applySearch();
        setStatus(`“${MIND_MAP_RULES.title(note)}” classificada como ${MIND_MAP_RULES.KINDS[note.kind]}.`);
    });
    duplicate.addEventListener("click", () => {
        const source = data.notes.find((item) => item.id === selectedId);
        if (!source) return;
        const copy = { ...source, id: crypto.randomUUID(), x: source.x + 45, y: source.y + 45, text: source.text ? `${source.text}\n(cópia)` : "Cópia" };
        data.notes.push(copy);
        renderNote(copy);
        persistSheet();
        selectNote(copy.id);
        renderConnections();
        setStatus("Ideia duplicada.");
    });
    $("organizeNoteMap").addEventListener("click", () => {
        const positions = MIND_MAP_RULES.layout(data.notes, data.noteConnections, selectedId);
        for (const note of data.notes) {
            const position = positions[note.id];
            if (!position) continue;
            note.x = position.x;
            note.y = position.y;
            const node = nodes.get(note.id);
            node.style.left = `${note.x}px`;
            node.style.top = `${note.y}px`;
        }
        persistSheet();
        renderConnections();
        setStatus(selectedId ? "Mapa organizado a partir da ideia selecionada." : "Mapa organizado pelas conexões mais importantes.");
    });
    search.addEventListener("input", () => {
        searchQuery = search.value.trim();
        applySearch();
    });
    $("noteZoomOut").addEventListener("click", () => applyZoom(data.mindMapView.zoom - .1));
    $("noteZoomIn").addEventListener("click", () => applyZoom(data.mindMapView.zoom + .1));
    $("fitNoteMap").addEventListener("click", () => {
        const bounds = MIND_MAP_RULES.bounds(data.notes);
        if (!bounds.width || !bounds.height) { applyZoom(1); return; }
        const availableWidth = Number.isFinite(scroll.clientWidth) && scroll.clientWidth > 0 ? scroll.clientWidth : 850;
        const availableHeight = Number.isFinite(scroll.clientHeight) && scroll.clientHeight > 0 ? scroll.clientHeight : 520;
        applyZoom(Math.min(1.5, availableWidth / bounds.width, availableHeight / bounds.height));
        scroll.scrollTo?.({ left: bounds.x * data.mindMapView.zoom, top: bounds.y * data.mindMapView.zoom, behavior: "smooth" });
        setStatus("Mapa enquadrado na área visível.");
    });
    $("exportNoteMap").addEventListener("click", () => {
        const content = JSON.stringify({ version: 1, name: character.name, notes: data.notes, connections: data.noteConnections }, null, 2);
        const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${String(character.name || "personagem").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLocaleLowerCase("pt-BR") || "personagem"}-mapa-mental.json`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        setStatus("Cópia do mapa exportada.");
    });
    $("importNoteMap").addEventListener("click", () => $("importNoteMapFile").click());
    $("importNoteMapFile").addEventListener("change", async () => {
        const file = $("importNoteMapFile").files?.[0];
        if (!file) return;
        try {
            if (Number.isFinite(file.size) && file.size > 2_000_000) throw new Error("map too large");
            const imported = JSON.parse(await file.text());
            if (!Array.isArray(imported.notes) || imported.notes.length > 500 || !Array.isArray(imported.connections) || imported.connections.length > 1500) throw new Error("invalid map");
            const importedIds = new Set();
            const importedNotes = imported.notes.filter((note) => note && SHAPES[note.shape]).map((note) => {
                let id = typeof note.id === "string" && note.id ? note.id : crypto.randomUUID();
                if (importedIds.has(id)) id = crypto.randomUUID();
                importedIds.add(id);
                return {
                    id,
                    shape: note.shape,
                    color: MIND_MAP_RULES.COLORS.includes(note.color) ? note.color : "violet",
                    kind: MIND_MAP_RULES.KINDS[note.kind] ? note.kind : "idea",
                    x: Number.isFinite(note.x) ? Math.max(0, note.x) : 35,
                    y: Number.isFinite(note.y) ? Math.max(0, note.y) : 35,
                    text: String(note.text || "").slice(0, 1200)
                };
            });
            if (!importedNotes.length && imported.notes.length) throw new Error("invalid notes");
            if (!window.confirm(`Substituir o mapa atual por ${importedNotes.length} ideia(s) importada(s)?`)) return;
            data.notes = importedNotes;
            data.noteConnections = MIND_MAP_RULES.normalizeConnections(imported.connections, data.notes);
            persistSheet();
            renderAllNotes();
            setStatus("Mapa importado com sucesso.");
        } catch {
            setStatus("Não foi possível importar: escolha um arquivo de mapa mental exportado pelo R.E.A.L.");
        } finally {
            $("importNoteMapFile").value = "";
        }
    });
    let pan = null;
    scroll.addEventListener("pointerdown", (event) => {
        if (event.target?.closest?.(".note-node") || event.button !== 0) return;
        pan = { x: event.clientX, y: event.clientY, left: scroll.scrollLeft, top: scroll.scrollTop };
        scroll.dataset.panning = "true";
        scroll.setPointerCapture?.(event.pointerId);
    });
    scroll.addEventListener("pointermove", (event) => {
        if (!pan) return;
        scroll.scrollLeft = pan.left - (event.clientX - pan.x);
        scroll.scrollTop = pan.top - (event.clientY - pan.y);
    });
    const stopPan = () => { pan = null; scroll.dataset.panning = "false"; };
    scroll.addEventListener("pointerup", stopPan);
    scroll.addEventListener("pointercancel", stopPan);
    $("clearNoteMap").addEventListener("click", () => {
        if (!data.notes.length || !window.confirm("Limpar todas as ideias e ligações deste mapa mental?")) return;
        data.notes = [];
        data.noteConnections = [];
        nodes.forEach((node) => node.remove());
        nodes.clear();
        selectNote(null);
        connectionMode(false);
        persistSheet();
        renderConnections();
        setStatus("Mapa mental limpo.");
    });
    const workspace = $("noteWorkspace");
    const fullscreen = $("toggleNotesFullscreen");
    fullscreen.addEventListener("click", async () => {
        if (document.fullscreenElement === workspace) await document.exitFullscreen();
        else if (workspace.requestFullscreen) {
            try { await workspace.requestFullscreen(); }
            catch { workspace.classList.toggle("is-expanded"); }
        } else workspace.classList.toggle("is-expanded");
        fullscreen.textContent = document.fullscreenElement === workspace || workspace.classList.contains("is-expanded") ? "Sair da tela cheia" : "Tela cheia";
    });
    document.addEventListener("fullscreenchange", () => {
        fullscreen.textContent = document.fullscreenElement === workspace || workspace.classList.contains("is-expanded") ? "Sair da tela cheia" : "Tela cheia";
    });
}

function renderNote(note) {
    if (!note || !SHAPES[note.shape]) return;
    const canvas = $("noteCanvas");
    const node = document.createElement("div");
    node.className = "note-node";
    node.dataset.shape = note.shape;
    node.dataset.color = MIND_MAP_RULES.COLORS.includes(note.color) ? note.color : "violet";
    node.dataset.kind = MIND_MAP_RULES.KINDS[note.kind] ? note.kind : "idea";
    node.dataset.selected = "false";
    node.dataset.connectionSource = "false";
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-label", `Ideia do mapa mental: ${MIND_MAP_RULES.title(note)}`);
    const [width, height] = SHAPES[note.shape];
    note.x = Number.isFinite(note.x) ? Math.max(0, note.x) : 35;
    note.y = Number.isFinite(note.y) ? Math.max(0, note.y) : 35;
    node.style.setProperty("--note-width", `${width}px`);
    node.style.setProperty("--note-height", `${height}px`);
    function position() {
        node.style.left = `${note.x}px`;
        node.style.top = `${note.y}px`;
        noteBoardController?.renderConnections(false);
    }
    position();
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "note-node__handle";
    handle.textContent = "⠿";
    handle.setAttribute("aria-label", "Mover anotação; use as setas do teclado");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "note-node__delete";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Remover anotação");
    const text = document.createElement("textarea");
    text.value = note.text || "";
    text.maxLength = 1200;
    text.setAttribute("aria-label", "Texto da anotação");
    text.addEventListener("input", () => {
        note.text = text.value;
        node.setAttribute("aria-label", `Ideia do mapa mental: ${MIND_MAP_RULES.title(note)}`);
        noteBoardController?.selectNote(note.id);
        noteBoardController?.renderConnections();
        scheduleSheetSave();
    });
    remove.addEventListener("click", () => {
        noteBoardController?.removeNote(note.id, node);
    });
    const connect = document.createElement("button");
    connect.type = "button";
    connect.className = "note-node__connect";
    connect.textContent = "↗";
    connect.setAttribute("aria-label", "Conectar esta ideia a outra");
    connect.addEventListener("click", () => noteBoardController?.beginConnection(note.id));
    const kindLabel = document.createElement("span");
    kindLabel.className = "note-node__kind";
    kindLabel.textContent = MIND_MAP_RULES.KINDS[note.kind] || MIND_MAP_RULES.KINDS.idea;
    node.kindLabel = kindLabel;
    node.addEventListener("click", () => noteBoardController?.selectNote(note.id));
    handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        const zoom = noteBoardController?.zoom() || 1;
        const startX = event.clientX / zoom - note.x;
        const startY = event.clientY / zoom - note.y;
        function move(pointer) {
            note.x = Math.max(0, Math.min(canvas.scrollWidth - width, pointer.clientX / zoom - startX));
            note.y = Math.max(0, Math.min(canvas.scrollHeight - height, pointer.clientY / zoom - startY));
            position();
        }
        function stop() {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", stop);
            handle.removeEventListener("pointercancel", stop);
            persistSheet();
        }
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", stop);
        handle.addEventListener("pointercancel", stop);
    });
    handle.addEventListener("keydown", (event) => {
        const delta = event.shiftKey ? 1 : 10;
        if (event.key === "ArrowLeft") note.x = Math.max(0, note.x - delta);
        else if (event.key === "ArrowRight") note.x = Math.min(canvas.scrollWidth - width, note.x + delta);
        else if (event.key === "ArrowUp") note.y = Math.max(0, note.y - delta);
        else if (event.key === "ArrowDown") note.y = Math.min(canvas.scrollHeight - height, note.y + delta);
        else return;
        event.preventDefault();
        position();
        scheduleSheetSave();
    });
    node.append(handle, remove, text, connect, kindLabel);
    canvas.append(node);
    noteBoardController?.nodes.set(note.id, node);
}

if (character) {
    setupSheetTabs();
    refreshResourcesForAttributes = setupNexResources();
    setupTabs("[data-description-tab]", "descriptionTab", "textos");
    setupSheetEntries();
    refreshInventoryLimits = setupInventoryLimits();
    refreshProgressionForNex = setupProgression();
    setupAbilityCatalog();
    setupRitualCatalog();
    refreshRitualProgression = setupRitualProgression();
    setupNoteBoard();
    setupOriginTraining();
    setupSkills();
    refreshSkillsForAttributes = setupSkills;
    refreshCombatForAttributes = () => { renderEquippedWeapon(); renderDefenses(); refreshInventoryLimits(); };
    setupDefenseAdjustments();
    refreshCombatForAttributes();
    setupAttributeEditing();
    $("freeRollForm").addEventListener("submit", event => {
        event.preventDefault();
        const roll = SHEET_MECHANICS.rollExpression($("freeRollExpression").value);
        if (!roll) return showRollError("Use uma expressão como 2d6+3 ou 2d8+1d6+2. Até 500 dados de 2 a 1000 faces.");
        showSumResult("Rolagem livre", roll, "Todos os dados são somados. Para testes, use o atributo ou a perícia.");
    });
    $("automaticEffects").checked = sheetData().automaticEffects !== false;
    $("automaticEffects").addEventListener("change", () => {
        const previous = sheetData().automaticEffects;
        sheetData().automaticEffects = $("automaticEffects").checked;
        if (!persistSheet()) { sheetData().automaticEffects = previous; $("automaticEffects").checked = previous !== false; return; }
        refreshPassiveEffects(); persistSheet();
    });
    refreshPassiveEffects();
}
