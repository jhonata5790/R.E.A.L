const STORAGE_KEY = "cronicas-biblioteca-v2";
const THEMES = window.REAL_ATTRIBUTE_THEMES;
const NEX_RULES = window.REAL_NEX_RULES;
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
    const list = $("attributeList");
    ATTRIBUTES.forEach(({ id, name }) => {
        const stored = character.attributes?.[id];
        const value = Number.isInteger(stored) && stored >= 0 && stored <= 5 ? String(stored) : "—";
        const marker = document.createElement("div");
        marker.className = "attribute-wheel__value";
        const [x, y] = theme.centers[id];
        marker.style.setProperty("--wheel-x", `${x}%`);
        marker.style.setProperty("--wheel-y", `${y}%`);
        marker.style.setProperty("--wheel-value-top", `${theme.valueTop[id] ?? (id === "presenca" || id === "vigor" ? 17 : 22)}%`);
        const number = document.createElement("span");
        number.textContent = value;
        marker.append(number);
        values.append(marker);

        const pair = document.createElement("div");
        const label = document.createElement("dt");
        const amount = document.createElement("dd");
        label.textContent = name;
        amount.textContent = value;
        pair.append(label, amount);
        list.append(pair);
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
    const pinned = new Set(["informacoes", "atributos", "pericias"]);
    const desktop = window.matchMedia?.("(min-width: 1100px)");
    let mobileSection = "informacoes";
    let desktopSection = "combate";

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
    itens: "Itens", armas: "Armas", protecao: "Proteção", geral: "Geral", amaldicoados: "Itens amaldiçoados"
};
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

function persistSheet() {
    try {
        const latest = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        const current = latest?.characters?.find((entry) => entry && String(entry.id) === String(character.id));
        if (!current) throw new Error("Ficha não encontrada no armazenamento");
        current.sheet = sheetData();
        if (NEX_RULES.allowedNex(classTheme(character)).includes(character.nex)) current.nex = character.nex;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
        $("storageNote").textContent = "Esta ficha está salva neste navegador.";
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
        return;
    }

    for (const value of allowed) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `${value}%`;
        selector.append(option);
    }
    character.nex = NEX_RULES.normalizeNex(classId, character.nex);
    const data = sheetData();
    const previous = data.resources && typeof data.resources === "object" && !Array.isArray(data.resources) ? data.resources : {};
    const resources = {};
    for (const id of NEX_RULES.RESOURCES) {
        const stored = previous[id] && typeof previous[id] === "object" ? previous[id] : {};
        resources[id] = { current: stored.current, max: stored.max, bonus: NEX_RULES.clampBonus(stored.bonus) };
    }
    data.resources = resources;
    let totals;

    function recalculate() {
        const bonuses = Object.fromEntries(NEX_RULES.RESOURCES.map((id) => [id, resources[id].bonus]));
        totals = NEX_RULES.calculate({ classId, nex: character.nex, attributes: character.attributes, origin: characterOrigin?.id, bonuses });
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
        $("pePerTurn").textContent = String(totals.pePerTurn);
        const presence = Number.isInteger(character.attributes?.presenca) ? character.attributes.presenca : 0;
        $("ritualDifficulty").textContent = String(10 + totals.pePerTurn + presence);
        $("nexExplanation").textContent = classId === "mundano"
            ? "Mundano: NEX 0%. Os recursos não progridem até escolher uma classe na criação."
            : `NEX ${character.nex}% · nível ${totals.level}. Os máximos acompanham a classe, Vigor e Presença.${characterOrigin?.id === "cultista-arrependido" ? " A origem reduz pela metade apenas a Sanidade inicial." : ""}`;
        for (const id of NEX_RULES.RESOURCES) {
            const item = resources[id];
            $(`${id}Value`).textContent = String(item.current);
            $(`${id}Maximum`).textContent = String(item.max);
            $(`${id}Current`).value = String(item.current);
            $(`${id}Current`).max = String(item.max);
            $(`${id}Bonus`).value = String(item.bonus);
            $(`${id}Decrease`).disabled = item.current <= 0;
            $(`${id}Increase`).disabled = item.current >= item.max;
            const progress = $(`${id}Progress`);
            progress.max = Math.max(1, item.max);
            progress.value = item.current;
            progress.setAttribute("aria-valuetext", `${item.current} de ${item.max}`);
        }
    }

    function save(message) {
        status.textContent = message;
        render();
        scheduleSheetSave();
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
    });
    for (const id of NEX_RULES.RESOURCES) {
        const name = { vida: "Vida", esforco: "Esforço", sanidade: "Sanidade" }[id];
        const item = resources[id];
        const input = $(`${id}Current`);
        const bonus = $(`${id}Bonus`);
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
        bonus.addEventListener("change", () => {
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
}

function equippedWeapon() {
    const data = sheetData();
    if (typeof data.equippedWeaponId !== "string" || !data.equippedWeaponId) return null;
    const inventory = Array.isArray(data.inventario) ? data.inventario : [];
    return inventory.find((item) => item && item.category === "armas" && item.id === data.equippedWeaponId) || null;
}

function renderEquippedWeapon() {
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
    if (weapon.description) {
        const description = document.createElement("p");
        description.textContent = weapon.description;
        container.append(description);
    }
    const note = document.createElement("small");
    note.textContent = "Dano e rolagens serão configurados depois.";
    container.append(note);
}

function renderEntries(kind, expandedId = null) {
    const list = $(ENTRY_TYPES[kind].list);
    list.replaceChildren();
    const items = Array.isArray(sheetData()[kind]) ? sheetData()[kind].filter((item) => item && typeof item.name === "string") : [];
    const visible = kind === "inventario" && inventoryFilter !== "todos"
        ? items.filter((item) => item.category === inventoryFilter) : items;
    // A habilidade da origem é derivada da origem salva: não entra no array editável
    // e acompanha uma eventual troca de origem sem deixar cópias antigas.
    const originAbility = kind === "habilidades" && characterOrigin?.ability
        ? { name: characterOrigin.ability, description: characterOrigin.effect } : null;
    const displayItems = originAbility
        ? [originAbility, ...visible.filter((item) => item.name.trim().toLocaleLowerCase("pt-BR") !== originAbility.name.toLocaleLowerCase("pt-BR") || (typeof item.description === "string" ? item.description.trim() : "") !== originAbility.description)]
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
        const fromOrigin = entry === originAbility;
        const row = document.createElement("article");
        row.className = fromOrigin ? "entry-list__origin entry-item" : "entry-item";
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
        category.textContent = fromOrigin ? `Habilidade de origem · ${characterOrigin.name}` : kind === "inventario" ? (INVENTORY_CATEGORIES[entry.category] || "Geral") : kind === "habilidades" ? "Habilidade adicionada" : "Ritual";
        panel.append(category);
        if (entry.description) {
            const description = document.createElement("p");
            description.textContent = entry.description;
            panel.append(description);
        }
        let equipCheckbox = null;
        if (kind === "inventario" && entry.category === "armas") {
            const selected = equippedWeapon() === entry;
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
                const previous = data.equippedWeaponId;
                const hadId = Boolean(entry.id);
                if (!entry.id) entry.id = crypto.randomUUID();
                data.equippedWeaponId = equipCheckbox.checked ? entry.id : null;
                if (!persistSheet()) {
                    data.equippedWeaponId = previous;
                    if (!hadId) delete entry.id;
                    equipCheckbox.checked = selected;
                    return;
                }
                renderEntries("inventario", toggle.getAttribute("aria-expanded") === "true" ? entry.id : null);
                renderEquippedWeapon();
            });
        }
        if (!fromOrigin) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "entry-item__remove";
            remove.textContent = `Remover ${ENTRY_TYPES[kind].singular}`;
            remove.setAttribute("aria-label", `Remover ${entry.name}`);
            remove.addEventListener("click", () => {
                if (!window.confirm(`Remover ${entry.name} da ficha?`)) return;
                const data = sheetData();
                const previousItems = data[kind];
                const previousEquipped = data.equippedWeaponId;
                data[kind] = items.filter((item) => item !== entry);
                if (kind === "inventario" && entry.id && data.equippedWeaponId === entry.id) data.equippedWeaponId = null;
                if (persistSheet()) {
                    renderEntries(kind);
                    if (kind === "inventario") renderEquippedWeapon();
                } else {
                    data[kind] = previousItems;
                    data.equippedWeaponId = previousEquipped;
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
    document.querySelectorAll("[data-add-entry]").forEach((button) => {
        button.addEventListener("click", () => {
            entryKind = button.dataset.addEntry;
            $("entryDialogTitle").textContent = entryKind === "inventario" ? "Adicionar ao inventário" : `Adicionar ${ENTRY_TYPES[entryKind].singular}`;
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

function updateInventoryFilters() {
    document.querySelectorAll("[data-inventory-filter]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.inventoryFilter === inventoryFilter));
    });
}

function skillSettings(skill) {
    const data = sheetData();
    if (!data.skills || typeof data.skills !== "object" || Array.isArray(data.skills)) data.skills = {};
    const saved = data.skills[skill.id] || {};
    const attribute = ATTRIBUTES.some((item) => item.id === saved.attribute) ? saved.attribute : skill.attribute;
    const training = TRAINING_VALUES.includes(saved.training) ? saved.training : 0;
    const other = Number.isFinite(saved.other) ? Math.max(-1000, Math.min(1000, saved.other)) : 0;
    data.skills[skill.id] = { attribute, training, other };
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

function rollSkill(skill, settings) {
    const training = effectiveTraining(skill.id, settings);
    const attributeValue = character.attributes?.[settings.attribute];
    if (!Number.isInteger(attributeValue) || attributeValue < 0 || attributeValue > 5) {
        showRollError(`O atributo de ${skill.name} ainda não tem um valor salvo. Revise a criação da ficha.`);
        return;
    }
    const diceCount = attributeValue === 0 ? 2 : attributeValue;
    const dice = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 20) + 1);
    const useLowest = attributeValue === 0;
    const chosenIndex = dice.indexOf(useLowest ? Math.min(...dice) : Math.max(...dice));
    const bonus = training + settings.other;
    showDiceResult(skill, dice, chosenIndex, bonus, useLowest);
}

function setupSkills() {
    const body = $("skillsBody");
    body.replaceChildren();
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
            count.textContent = Number.isInteger(value) && value >= 0 && value <= 5 ? `${value === 0 ? 2 : value}d20${value === 0 ? " ↓" : ""}` : "—";
        }
        updateCount();
        attribute.addEventListener("change", () => {
            if (!ATTRIBUTES.some((item) => item.id === attribute.value)) return;
            settings.attribute = attribute.value;
            updateCount();
            persistSheet();
        });
        dataGroup.append(attribute, count);
        dataCell.append(dataGroup);

        const bonusCell = document.createElement("td");
        bonusCell.dataset.label = "Bônus";
        const bonus = document.createElement("output");
        bonus.className = "skill-bonus";
        function updateBonus() { bonus.textContent = formatBonus(effectiveTraining(skill.id, settings) + settings.other); }
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
            training.append(option);
        });
        training.value = String(effectiveTraining(skill.id, settings));
        training.addEventListener("change", () => {
            const next = Number(training.value);
            if (!TRAINING_VALUES.includes(next) || (grantedByOrigin && next < 5)) {
                training.value = String(effectiveTraining(skill.id, settings));
                return;
            }
            settings.training = next;
            row.dataset.trained = String(effectiveTraining(skill.id, settings) > 0);
            updateBonus();
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
            updateBonus();
            scheduleSheetSave();
        });
        other.addEventListener("change", () => {
            settings.other = other.value.trim() && Number.isFinite(Number(other.value)) ? Math.max(-1000, Math.min(1000, Number(other.value))) : 0;
            other.value = String(settings.other);
            updateBonus();
            persistSheet();
        });
        otherCell.append(other);
        row.append(nameCell, dataCell, bonusCell, trainingCell, otherCell);
        body.append(row);
    });
}

const SHAPES = {
    square: [160, 160], rectangle: [220, 150], triangle: [190, 175], circle: [170, 170]
};

function setupNoteBoard() {
    const notes = sheetData();
    if (!Array.isArray(notes.notes)) notes.notes = [];
    notes.notes = notes.notes.filter((note) => note && SHAPES[note.shape]);
    notes.notes.forEach(renderNote);
    document.querySelectorAll("[data-add-shape]").forEach((button) => {
        button.addEventListener("click", () => {
            const shape = button.dataset.addShape;
            const index = notes.notes.length;
            const note = { id: crypto.randomUUID(), shape, x: 35 + (index % 4) * 200, y: 35 + Math.floor(index / 4) * 185, text: "" };
            notes.notes.push(note);
            renderNote(note);
            persistSheet();
        });
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
    const [width, height] = SHAPES[note.shape];
    note.x = Number.isFinite(note.x) ? Math.max(0, note.x) : 35;
    note.y = Number.isFinite(note.y) ? Math.max(0, note.y) : 35;
    node.style.setProperty("--note-width", `${width}px`);
    node.style.setProperty("--note-height", `${height}px`);
    function position() {
        node.style.left = `${note.x}px`;
        node.style.top = `${note.y}px`;
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
    text.addEventListener("input", () => { note.text = text.value; scheduleSheetSave(); });
    remove.addEventListener("click", () => {
        if (!window.confirm("Remover esta anotação?")) return;
        sheetData().notes = sheetData().notes.filter((item) => item.id !== note.id);
        if (persistSheet()) node.remove();
    });
    handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        const startX = event.clientX - note.x;
        const startY = event.clientY - note.y;
        function move(pointer) {
            note.x = Math.max(0, Math.min(canvas.scrollWidth - width, pointer.clientX - startX));
            note.y = Math.max(0, Math.min(canvas.scrollHeight - height, pointer.clientY - startY));
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
    node.append(handle, remove, text);
    canvas.append(node);
}

if (character) {
    setupSheetTabs();
    setupNexResources();
    setupTabs("[data-description-tab]", "descriptionTab", "textos");
    setupSheetEntries();
    setupNoteBoard();
    setupOriginTraining();
    setupSkills();
}
