// Biblioteca local: os dados antigos são copiados para o novo formato, sem apagar a versão anterior.
const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "cronicas-biblioteca-v2";
const LEGACY_KEY = "cronicas-campanha-v1";
const INITIAL_CAMPAIGN_ID = "campanha-inicial";
const OFFICIAL_THREATS = [];

const CHARACTER_FIELDS = [
    { name: "name", label: "Nome", required: true, max: 80 },
    { name: "role", label: "Tipo ou papel", max: 60, placeholder: "Ex.: Investigador, NPC" },
    { name: "player", label: "Jogador(a)", max: 60 },
    { name: "health", label: "Vida", max: 40, placeholder: "Ex.: 12/20" },
    { name: "defense", label: "Defesa", max: 40 },
    { name: "description", label: "História, habilidades e anotações", multiline: true, max: 4000 }
];
const HOMEBREW_TYPES = {
    item: { label: "Item", fields: [
        { name: "category", label: "Categoria", max: 60 },
        { name: "quantity", label: "Quantidade", max: 40 },
        { name: "owner", label: "Quem possui", max: 80 },
        { name: "description", label: "Descrição e efeito", multiline: true, max: 4000 }
    ] },
    ritual: { label: "Ritual", fields: [
        { name: "element", label: "Elemento", max: 60 },
        { name: "circle", label: "Círculo", max: 40 },
        { name: "cost", label: "Custo", max: 60 },
        { name: "execution", label: "Execução e alcance", max: 120 },
        { name: "description", label: "Efeito e regras", multiline: true, max: 4000 }
    ] },
    trilha: { label: "Trilha", fields: [
        { name: "class", label: "Classe", max: 60 },
        { name: "powers", label: "Poderes por nível", multiline: true, max: 4000 },
        { name: "description", label: "Conceito e regras", multiline: true, max: 4000 }
    ] },
    origem: { label: "Origem", fields: [
        { name: "ability", label: "Habilidade de origem", max: 120 },
        { name: "description", label: "História e regras", multiline: true, max: 4000 }
    ] },
    ameaca: { label: "Ameaça", fields: [
        { name: "element", label: "Elemento ou tipo", max: 60 },
        { name: "challenge", label: "Nível de desafio", max: 40 },
        { name: "health", label: "Vida", max: 40 },
        { name: "defense", label: "Defesa", max: 40 },
        { name: "attacks", label: "Ataques e ações", multiline: true, max: 4000 },
        { name: "description", label: "Descrição e habilidades", multiline: true, max: 4000 }
    ] },
    outro: { label: "Outro", fields: [
        { name: "category", label: "Categoria", max: 60 },
        { name: "description", label: "Descrição e regras", multiline: true, max: 4000 }
    ] }
};

function newId() {
    return crypto.randomUUID();
}

function starterCampaign() {
    return { id: INITIAL_CAMPAIGN_ID, name: "Minha campanha", description: "Sua próxima aventura começa aqui.", notes: "", characters: [] };
}

function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
}

function loadState() {
    const saved = readJson(STORAGE_KEY);
    if (saved && Array.isArray(saved.campaigns)) {
        return {
            campaigns: saved.campaigns.map((campaign) => ({
                ...campaign,
                characters: Array.isArray(campaign.characters) ? campaign.characters : []
            })),
            characters: Array.isArray(saved.characters) ? saved.characters : [],
            homebrew: Array.isArray(saved.homebrew) ? saved.homebrew : []
        };
    }
    const legacy = readJson(LEGACY_KEY);
    const campaign = starterCampaign();
    if (legacy?.campaign) {
        campaign.name = legacy.campaign.name || campaign.name;
        campaign.description = legacy.campaign.description || campaign.description;
        campaign.notes = legacy.notes || "";
    }
    return {
        campaigns: [campaign],
        characters: (Array.isArray(legacy?.fichas) ? legacy.fichas : []).map((entry) => ({ ...entry, id: entry.id || newId() })),
        homebrew: [
            ...(Array.isArray(legacy?.rituais) ? legacy.rituais : []).map((entry) => ({ ...entry, id: entry.id || newId(), type: "ritual" })),
            ...(Array.isArray(legacy?.itens) ? legacy.itens : []).map((entry) => ({ ...entry, id: entry.id || newId(), type: "item" }))
        ]
    };
}

const state = loadState();
let selectedCampaignId = null;
let editingCampaignId = null;
let editingEntry = null;
let homebrewFilter = "todos";

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        $("storageStatus").textContent = "Salvo neste navegador";
        return true;
    } catch {
        $("storageStatus").textContent = "Não foi possível salvar: verifique o espaço do navegador";
        return false;
    }
}

function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function campaignById(id) {
    return state.campaigns.find((campaign) => campaign.id === id) || null;
}

function currentRoute() {
    const route = decodeURIComponent(location.hash.slice(1));
    if (route.startsWith("campanha/")) return { view: "campanha", id: route.slice(9) };
    if (["campanhas", "personagens", "ameacas", "homebrew"].includes(route)) return { view: route };
    return { view: "campanhas" };
}

function navigate(view, id = null, fromHistory = false) {
    if (view === "campanha" && !campaignById(id)) view = "campanhas";
    selectedCampaignId = view === "campanha" ? id : null;
    document.querySelectorAll(".view").forEach((section) => {
        section.hidden = section.id !== "view-" + view;
    });
    document.querySelectorAll(".nav-link[data-view]").forEach((button) => {
        const active = button.dataset.view === (view === "campanha" ? "campanhas" : view);
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });
    if (view === "campanha") renderCampaignDetail();
    const hash = view === "campanha" ? "#campanha/" + encodeURIComponent(id) : "#" + view;
    if (!fromHistory && location.hash !== hash) history.pushState(null, "", hash);
    document.title = (view === "campanha" ? campaignById(id)?.name : ({ campanhas: "Campanhas", personagens: "Personagens", ameacas: "Ameaças", homebrew: "Homebrew" })[view]) + " | Crônicas";
    scrollTo(0, 0);
}

document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.view));
});
window.addEventListener("hashchange", () => {
    const route = currentRoute();
    navigate(route.view, route.id, true);
});
$("backToCampaigns").addEventListener("click", () => navigate("campanhas"));

function renderCampaigns() {
    const list = $("campaignList");
    list.replaceChildren();
    const count = state.campaigns.length;
    $("campaignCount").textContent = count + (count === 1 ? " campanha" : " campanhas");
    if (!count) {
        const empty = make("div", "empty-state");
        empty.append(make("span", "empty-state__icon", "✦"), make("strong", "", "Sua primeira campanha começa aqui"));
        empty.append(make("p", "", "Crie uma campanha para abrir uma mesa e preparar as sessões."));
        const add = make("button", "button button--primary", "+ Nova campanha");
        add.type = "button";
        add.addEventListener("click", () => openCampaignEditor());
        empty.append(add);
        list.append(empty);
        return;
    }
    state.campaigns.forEach((campaign) => {
        const card = make("button", "campaign-card");
        card.type = "button";
        card.append(make("span", "eyebrow", "CAMPANHA"));
        card.append(make("strong", "", campaign.name || "Sem nome"));
        card.append(make("p", "", campaign.description || "A história ainda está por ser escrita."));
        card.append(make("span", "campaign-card__action", "Abrir campanha →"));
        card.addEventListener("click", () => navigate("campanha", campaign.id));
        list.append(card);
    });
}

function renderCampaignDetail() {
    const campaign = campaignById(selectedCampaignId);
    if (!campaign) return;
    $("detailTitle").textContent = campaign.name;
    $("detailDescription").textContent = campaign.description || "Sua história começa aqui.";
    const tabletopHref = "mesa.html?campaign=" + encodeURIComponent(campaign.id);
    $("openTabletop").href = tabletopHref;
    $("openTabletopSecondary").href = tabletopHref;
    renderCampaignCharacters(campaign);
    renderTabletopSummary(campaign.id);
}

function renderCampaignCharacters(campaign) {
    const assignedIds = new Set(campaign.characters || []);
    const picker = $("characterPicker");
    picker.replaceChildren(new Option("Selecione um personagem", ""));
    state.characters.filter((character) => !assignedIds.has(character.id)).forEach((character) => {
        picker.append(new Option(character.name || "Sem nome", character.id));
    });
    picker.disabled = picker.options.length === 1;
    $("assignCharacter").disabled = picker.disabled;
    const list = $("campaignCharacters");
    list.replaceChildren();
    const assigned = state.characters.filter((character) => assignedIds.has(character.id));
    if (!assigned.length) {
        list.append(make("p", "assigned-empty", state.characters.length
            ? "Nenhum personagem vinculado. Escolha um acima para adicioná-lo."
            : "Sua biblioteca ainda não tem personagens. Crie um na aba Personagens e depois volte aqui."));
        return;
    }
    assigned.forEach((character) => {
        const row = make("div", "assigned-character");
        row.append(make("strong", "", character.name || "Sem nome"));
        row.append(make("small", "", character.role || "Personagem"));
        const remove = make("button", "", "Remover");
        remove.type = "button";
        remove.setAttribute("aria-label", "Remover " + (character.name || "personagem") + " desta campanha");
        remove.addEventListener("click", () => {
            campaign.characters = campaign.characters.filter((id) => id !== character.id);
            saveState();
            renderCampaignCharacters(campaign);
        });
        row.append(remove);
        list.append(row);
    });
}

function isImportedImage(source) {
    return typeof source === "string" && source.startsWith("data:image/");
}

function readTabletopSession(campaignId) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("tabletop2d-storage", 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("sessions")) request.result.createObjectStore("sessions");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;
            const store = database.transaction("sessions", "readonly").objectStore("sessions");
            const current = store.get("campaign:" + campaignId);
            current.onerror = () => { database.close(); reject(current.error); };
            current.onsuccess = () => {
                if (current.result || campaignId !== INITIAL_CAMPAIGN_ID) {
                    database.close(); resolve(current.result || null); return;
                }
                const legacy = store.get("autosave");
                legacy.onerror = () => { database.close(); reject(legacy.error); };
                legacy.onsuccess = () => { database.close(); resolve(legacy.result || null); };
            };
        };
    });
}

async function renderTabletopSummary(campaignId) {
    const summary = $("tabletopSummary");
    summary.textContent = "Verificando mesa...";
    try {
        const session = await readTabletopSession(campaignId);
        if (selectedCampaignId !== campaignId) return;
        const map = isImportedImage(session?.map?.source) ? session.map : null;
        const tokenCount = (session?.tokens || []).filter((token) => isImportedImage(token.source)).length;
        summary.replaceChildren();
        if (!map) {
            summary.append(make("strong", "", "Nenhum mapa importado"));
            summary.append(make("span", "", "Abra a mesa para importar seu mapa PNG e os tokens dos personagens."));
        } else {
            summary.append(make("strong", "", "Mapa: " + (map.name || "PNG importado")));
            summary.append(make("span", "", tokenCount + (tokenCount === 1 ? " token importado" : " tokens importados")));
        }
    } catch {
        summary.textContent = "Não foi possível consultar o salvamento da mesa neste navegador.";
    }
}

function renderCards(listId, entries, emptyTitle, emptyBody, openEntry) {
    const list = $(listId);
    list.replaceChildren();
    if (!entries.length) {
        const empty = make("div", "empty-state");
        empty.append(make("span", "empty-state__icon", "✧"), make("strong", "", emptyTitle), make("p", "", emptyBody));
        list.append(empty);
        return;
    }
    entries.forEach((entry) => {
        const card = make("button", "entry-card");
        card.type = "button";
        const type = entry.type ? HOMEBREW_TYPES[entry.type]?.label || "Criação" : entry.role || "Personagem";
        card.append(make("span", "entry-card__type", type));
        card.append(make("strong", "", entry.name || "Sem nome"));
        const summary = entry.description || entry.element || entry.category || entry.player || "Clique para ver os detalhes.";
        card.append(make("p", "", summary));
        card.append(make("span", "entry-card__edit", "Abrir →"));
        card.addEventListener("click", () => openEntry(entry.id));
        list.append(card);
    });
}

function matchesQuery(entry, query) {
    return Object.values(entry).some((value) => String(value).toLocaleLowerCase("pt-BR").includes(query));
}

function renderCharacters() {
    const query = $("searchCharacters").value.trim().toLocaleLowerCase("pt-BR");
    $("characterCount").textContent = state.characters.length + (state.characters.length === 1 ? " personagem" : " personagens");
    renderCards("characterList", state.characters.filter((entry) => matchesQuery(entry, query)),
        query ? "Nenhum personagem encontrado" : "Nenhum personagem ainda",
        query ? "Tente outro termo de busca." : "Crie uma ficha na sua biblioteca de personagens.",
        (id) => openEntry("character", id));
}

function renderThreats() {
    const query = $("searchThreats").value.trim().toLocaleLowerCase("pt-BR");
    $("threatCount").textContent = OFFICIAL_THREATS.length + (OFFICIAL_THREATS.length === 1 ? " ameaça" : " ameaças");
    renderCards("threatList", OFFICIAL_THREATS.filter((entry) => matchesQuery(entry, query)),
        "Catálogo ainda vazio", "As criaturas oficiais aparecerão aqui quando definirmos a fonte do bestiário.", () => {});
}

function renderCategories() {
    const container = $("homebrewCategories");
    container.replaceChildren();
    const plural = { item: "Itens", ritual: "Rituais", trilha: "Trilhas", origem: "Origens", ameaca: "Ameaças", outro: "Outros" };
    const categories = [["todos", "Todos"], ...Object.keys(HOMEBREW_TYPES).map((id) => [id, plural[id]])];
    categories.forEach(([id, label]) => {
        const button = make("button", "category-tab" + (homebrewFilter === id ? " is-active" : ""), label);
        button.type = "button";
        button.setAttribute("aria-pressed", String(homebrewFilter === id));
        button.addEventListener("click", () => { homebrewFilter = id; renderCategories(); renderHomebrew(); });
        container.append(button);
    });
}

function renderHomebrew() {
    const query = $("searchHomebrew").value.trim().toLocaleLowerCase("pt-BR");
    const entries = state.homebrew.filter((entry) => (homebrewFilter === "todos" || entry.type === homebrewFilter) && matchesQuery(entry, query));
    $("homebrewCount").textContent = state.homebrew.length + (state.homebrew.length === 1 ? " criação" : " criações");
    renderCards("homebrewList", entries,
        query ? "Nenhuma criação encontrada" : "Nenhuma criação nesta categoria",
        query ? "Tente outro termo de busca." : "Crie itens, rituais, trilhas, origens, ameaças e outras ideias suas.",
        (id) => openEntry("homebrew", id));
}

function renderAll() {
    renderCampaigns();
    renderCharacters();
    renderThreats();
    renderCategories();
    renderHomebrew();
    if (selectedCampaignId) renderCampaignDetail();
}

function openCampaignEditor(id = null) {
    const campaign = id ? campaignById(id) : null;
    editingCampaignId = campaign?.id || null;
    $("campaignDialogTitle").textContent = campaign ? "Editar campanha" : "Nova campanha";
    $("campaignNameInput").value = campaign?.name || "";
    $("campaignDescriptionInput").value = campaign?.description || "";
    $("campaignDialog").showModal();
    $("campaignNameInput").focus();
}

$("newCampaignHero").addEventListener("click", () => openCampaignEditor());
$("editCampaign").addEventListener("click", () => openCampaignEditor(selectedCampaignId));
$("closeCampaignDialog").addEventListener("click", () => $("campaignDialog").close());
$("cancelCampaignDialog").addEventListener("click", () => $("campaignDialog").close());
$("campaignForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("campaignNameInput").value.trim();
    if (!name) return;
    let campaign = campaignById(editingCampaignId);
    if (!campaign) {
        campaign = { id: newId(), name, description: "", notes: "", characters: [] };
        state.campaigns.unshift(campaign);
    }
    campaign.name = name;
    campaign.description = $("campaignDescriptionInput").value.trim();
    saveState();
    $("campaignDialog").close();
    renderAll();
    navigate("campanha", campaign.id);
});

function fieldControl(field, value = "") {
    const label = make("label", "form-field", field.label);
    const control = document.createElement(field.multiline ? "textarea" : "input");
    control.name = field.name;
    control.value = value ?? "";
    control.maxLength = field.max;
    control.required = Boolean(field.required);
    control.placeholder = field.placeholder || "";
    if (field.multiline) control.rows = 4;
    else control.type = "text";
    label.append(control);
    return label;
}

function renderEntryFields(values = {}) {
    const container = $("entryFields");
    container.replaceChildren();
    if (editingEntry.kind === "homebrew") {
        const label = make("label", "form-field", "Tipo de criação");
        const select = document.createElement("select");
        select.name = "type";
        Object.entries(HOMEBREW_TYPES).forEach(([id, config]) => {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = config.label;
            select.append(option);
        });
        select.value = values.type || "item";
        select.addEventListener("change", () => {
            const current = Object.fromEntries(new FormData($("entryForm")).entries());
            renderEntryFields({ ...current, type: select.value });
        });
        label.append(select);
        container.append(label);
    }
    const fields = editingEntry.kind === "character"
        ? CHARACTER_FIELDS
        : [{ name: "name", label: "Nome", required: true, max: 80 }, ...HOMEBREW_TYPES[values.type || "item"].fields];
    fields.forEach((field) => container.append(fieldControl(field, values[field.name])));
}

function openEntry(kind, id = null) {
    const collection = kind === "character" ? state.characters : state.homebrew;
    const entry = id ? collection.find((item) => item.id === id) : null;
    editingEntry = { kind, id: entry?.id || null };
    $("entryDialogTitle").textContent = entry ? (kind === "character" ? "Editar personagem" : "Editar homebrew") : (kind === "character" ? "Novo personagem" : "Nova criação");
    $("deleteEntry").hidden = !entry;
    renderEntryFields(entry || { type: homebrewFilter === "todos" ? "item" : homebrewFilter });
    $("entryDialog").showModal();
    $("entryFields").querySelector("input")?.focus();
}

$("addCharacter").addEventListener("click", () => openEntry("character"));
$("addHomebrew").addEventListener("click", () => openEntry("homebrew"));
$("closeEntryDialog").addEventListener("click", () => $("entryDialog").close());
$("cancelEntryDialog").addEventListener("click", () => $("entryDialog").close());
$("entryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editingEntry) return;
    const { kind, id } = editingEntry;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    Object.keys(values).forEach((key) => { values[key] = values[key].trim(); });
    if (!values.name) return;
    const collection = kind === "character" ? state.characters : state.homebrew;
    const index = id ? collection.findIndex((entry) => entry.id === id) : -1;
    if (index >= 0) collection[index] = { id, ...values };
    else collection.unshift({ id: newId(), ...values });
    saveState();
    $("entryDialog").close();
    editingEntry = null;
    renderAll();
});
$("deleteEntry").addEventListener("click", () => {
    if (!editingEntry?.id) return;
    if (!confirm("Excluir esta criação da sua biblioteca?")) return;
    const collection = editingEntry.kind === "character" ? state.characters : state.homebrew;
    const index = collection.findIndex((entry) => entry.id === editingEntry.id);
    if (index >= 0) collection.splice(index, 1);
    if (editingEntry.kind === "character") {
        state.campaigns.forEach((campaign) => {
            campaign.characters = (campaign.characters || []).filter((id) => id !== editingEntry.id);
        });
    }
    saveState();
    $("entryDialog").close();
    editingEntry = null;
    renderAll();
});

$("searchCharacters").addEventListener("input", renderCharacters);
$("assignCharacter").addEventListener("click", () => {
    const campaign = campaignById(selectedCampaignId);
    const characterId = $("characterPicker").value;
    if (!campaign || !state.characters.some((character) => character.id === characterId)) return;
    if (!campaign.characters.includes(characterId)) campaign.characters.push(characterId);
    saveState();
    renderCampaignCharacters(campaign);
});
$("searchThreats").addEventListener("input", renderThreats);
$("searchHomebrew").addEventListener("input", renderHomebrew);
saveState();
renderAll();
const route = currentRoute();
navigate(route.view, route.id, true);
