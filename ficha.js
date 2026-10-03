const STORAGE_KEY = "cronicas-biblioteca-v2";
const ATTRIBUTES = [
    { id: "agilidade", name: "Agilidade", hint: "Movimento e reflexos" },
    { id: "forca", name: "Força", hint: "Potência física" },
    { id: "intelecto", name: "Intelecto", hint: "Raciocínio e conhecimento" },
    { id: "presenca", name: "Presença", hint: "Influência e percepção" },
    { id: "vigor", name: "Vigor", hint: "Resistência e fôlego" }
];
const ATTRIBUTE_MAX_INITIAL = 3;
const ORIGINS = window.REAL_ORIGINS;
const CLASSES = [
    { id: "combatente", name: "Combatente", description: "Enfrenta o perigo diretamente e protege o grupo em combate." },
    { id: "especialista", name: "Especialista", description: "Resolve problemas com técnica, investigação e perícias." },
    { id: "ocultista", name: "Ocultista", description: "Estuda e utiliza o paranormal, com todos os riscos que isso traz." },
    { id: "mundano", name: "Mundano", description: "Ainda não escolheu uma das três classes da Ordem." }
];
const ATTRIBUTE_THEMES = window.REAL_ATTRIBUTE_THEMES;
const $ = (id) => document.getElementById(id);
const stepSections = [...document.querySelectorAll(".sheet-step")];
const stepButtons = [...document.querySelectorAll("[data-step-button]")];
const errorIds = ["classError", "attributesError", "originError", "finalError"];

function readState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved && Array.isArray(saved.campaigns)) return saved;
    } catch { /* A ficha continua disponível mesmo sem dados salvos. */ }
    return {
        campaigns: [{ id: "campanha-inicial", name: "Minha campanha", description: "Sua próxima aventura começa aqui.", notes: "", characters: [] }],
        characters: [], homebrew: []
    };
}

const state = readState();
state.characters = Array.isArray(state.characters) ? state.characters : [];
state.homebrew = Array.isArray(state.homebrew) ? state.homebrew : [];
const editingId = new URLSearchParams(location.search).get("id");
const existing = editingId ? state.characters.find((character) => character.id === editingId) : null;
if (editingId && !existing) location.replace("index.html#personagens");

function normalizedChoice(value, choices) {
    const text = String(value || "").toLocaleLowerCase("pt-BR");
    return choices.find((choice) => choice.id === text || choice.name.toLocaleLowerCase("pt-BR") === text)?.id || "";
}

const attributes = Object.fromEntries(ATTRIBUTES.map(({ id }) => {
    const stored = existing?.attributes?.[id];
    return [id, Number.isInteger(stored) && stored >= 0 && stored <= 5 ? stored : 1];
}));
let origin = normalizedChoice(existing?.origin, ORIGINS) || normalizedChoice(existing?.originName, ORIGINS);
let characterClass = normalizedChoice(existing?.class || existing?.role, CLASSES);
const originalClass = characterClass;
const originalAttributes = { ...attributes };
let currentStep = 0;
let furthestStep = existing ? 3 : 0;
let selectedAttributeId = ATTRIBUTES[0].id;
let themeImageRequest = 0;
const attributeControls = new Map();
const themeImageCache = new Map();
const originItems = new Map();
const classControls = new Map();
let openOriginId = null;
let originCloseTimer = null;

function persistState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch {
        $("storageNote").textContent = "Não foi possível salvar. Verifique o espaço disponível neste navegador.";
        return false;
    }
}

function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function attributeBudget() {
    return characterClass === "mundano" ? 3 : characterClass ? 4 : 0;
}

function pointsRemaining() {
    return ATTRIBUTES.length + attributeBudget() - Object.values(attributes).reduce((total, value) => total + value, 0);
}

function unchangedSavedAllocation() {
    return Boolean(existing && characterClass === originalClass
        && ATTRIBUTES.every(({ id }) => attributes[id] === originalAttributes[id]));
}

function clearError(index) {
    const error = $(errorIds[index]);
    error.hidden = true;
    error.textContent = "";
}

function showError(index, message) {
    const error = $(errorIds[index]);
    error.textContent = message;
    error.hidden = false;
}

function renderAttributes() {
    const targets = $("attributeWheelTargets");
    $("attributeWheelImage").addEventListener("error", (event) => {
        const fallback = ATTRIBUTE_THEMES.neutral.image;
        if (event.currentTarget.getAttribute("src") !== fallback) event.currentTarget.src = fallback;
    });
    ATTRIBUTES.forEach(({ id, name }) => {
        const button = make("button", "attribute-wheel__target");
        button.type = "button";
        button.dataset.attribute = id;
        button.setAttribute("aria-pressed", "false");
        const value = make("span", "attribute-wheel__value", String(attributes[id]));
        value.setAttribute("aria-hidden", "true");
        button.append(value);
        button.addEventListener("click", () => selectAttribute(id));
        targets.append(button);
        attributeControls.set(id, { button, value, name });
    });
    $("decreaseAttribute").addEventListener("click", () => changeAttribute(selectedAttributeId, -1));
    $("increaseAttribute").addEventListener("click", () => changeAttribute(selectedAttributeId, 1));
    selectAttribute(selectedAttributeId);
    updateAttributeControls();
}

function selectAttribute(id) {
    selectedAttributeId = id;
    const selected = ATTRIBUTES.find((attribute) => attribute.id === id);
    $("selectedAttributeName").textContent = selected.name;
    $("selectedAttributeDescription").textContent = selected.hint;
    $("selectedAttributeValue").setAttribute("aria-label", "Valor de " + selected.name);
    $("decreaseAttribute").setAttribute("aria-label", "Diminuir " + selected.name);
    $("increaseAttribute").setAttribute("aria-label", "Aumentar " + selected.name);
    updateAttributeControls();
}

function updateAttributeControls() {
    const remaining = pointsRemaining();
    const budget = attributeBudget();
    $("attributeRules").textContent = `Todo atributo começa em 1. ${characterClass === "mundano" ? "Mundano tem 3 pontos" : "Esta classe tem 4 pontos"} para distribuir. Você pode reduzir quantos atributos quiser a 0 para ganhar pontos. O máximo inicial de cada um é 3.`;
    $("pointsRemaining").textContent = remaining;
    $("attributeBudgetHint").textContent = unchangedSavedAllocation() && (remaining !== 0 || Object.values(attributes).some((value) => value > ATTRIBUTE_MAX_INITIAL))
        ? "Distribuição antiga preservada. Para redistribuir, siga o limite inicial de 3 por atributo."
        : remaining < 0
            ? `Você gastou ${-remaining} ${remaining === -1 ? "ponto a mais" : "pontos a mais"}. Reduza atributos antes de continuar.`
            : "";
    $("selectedAttributeValue").textContent = attributes[selectedAttributeId];
    $("decreaseAttribute").disabled = attributes[selectedAttributeId] === 0;
    $("increaseAttribute").disabled = attributes[selectedAttributeId] >= ATTRIBUTE_MAX_INITIAL || remaining <= 0;
    ATTRIBUTES.forEach(({ id, name }) => {
        const control = attributeControls.get(id);
        control.value.textContent = attributes[id];
        control.button.setAttribute("aria-label", `Selecionar ${name}, valor ${attributes[id]}`);
        control.button.setAttribute("aria-pressed", String(id === selectedAttributeId));
    });
}

function changeAttribute(id, delta) {
    const next = attributes[id] + delta;
    if (next < 0 || (delta > 0 && (next > ATTRIBUTE_MAX_INITIAL || pointsRemaining() <= 0))) return;
    attributes[id] = next;
    clearError(1);
    updateAttributeControls();
}

function resolveThemeImage(path) {
    if (themeImageCache.has(path)) return Promise.resolve(themeImageCache.get(path));
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => { themeImageCache.set(path, path); resolve(path); };
        image.onerror = () => {
            const fallback = ATTRIBUTE_THEMES.neutral.image;
            themeImageCache.set(path, fallback);
            resolve(fallback);
        };
        image.src = path;
    });
}

async function updateTheme({ instant = false } = {}) {
    const key = ATTRIBUTE_THEMES[characterClass] ? characterClass : "neutral";
    const theme = ATTRIBUTE_THEMES[key];
    document.body.dataset.characterTheme = key;
    document.body.style.setProperty("--accent", theme.accent);
    document.body.style.setProperty("--accent-light", theme.accentLight);
    document.body.style.setProperty("--accent-ink", theme.accentInk);
    document.body.style.setProperty("--accent-rgb", theme.accentRgb);
    document.body.style.setProperty("--border", theme.border);
    document.body.style.setProperty("--theme-glow", theme.glow);
    $("attributeThemeLabel").textContent = theme.label;
    ATTRIBUTES.forEach(({ id }) => {
        const [x, y] = theme.centers[id];
        const button = attributeControls.get(id).button;
        button.style.setProperty("--wheel-x", `${x}%`);
        button.style.setProperty("--wheel-y", `${y}%`);
        button.style.setProperty("--wheel-value-top", `${theme.valueTop[id] ?? (id === "presenca" || id === "vigor" ? 17 : 22)}%`);
    });

    const wheel = $("attributeWheelImage");
    const frame = wheel.closest(".attribute-wheel");
    frame.classList.remove("is-switching");
    const request = ++themeImageRequest;
    const source = await resolveThemeImage(theme.image);
    if (request !== themeImageRequest) return;
    if (wheel.getAttribute("src") === source) return;
    if (instant || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        wheel.src = source;
        return;
    }
    frame.classList.add("is-switching");
    window.setTimeout(() => {
        if (request !== themeImageRequest) return;
        wheel.src = source;
        frame.classList.remove("is-switching");
    }, 120);
}

function renderOrigins() {
    ORIGINS.forEach((option) => {
        const item = make("article", "origin-item");
        const header = make("button", "origin-item__header");
        header.type = "button";
        header.id = `origin-heading-${option.id}`;
        header.setAttribute("aria-controls", `origin-panel-${option.id}`);
        header.setAttribute("aria-expanded", "false");
        const badge = make("span", "origin-item__badge", "Escolhida");
        const chevron = make("span", "origin-item__chevron");
        chevron.setAttribute("aria-hidden", "true");
        header.append(make("strong", "origin-item__name", option.name), badge, chevron);

        const panel = make("div", "origin-item__panel");
        panel.id = `origin-panel-${option.id}`;
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-labelledby", header.id);
        panel.setAttribute("aria-hidden", "true");
        panel.inert = true;
        const content = make("div", "origin-item__panel-inner");
        const skills = make("div", "origin-item__detail");
        skills.append(make("span", "origin-item__detail-label", "Perícias treinadas:"), make("p", "", option.skills));
        const ability = make("div", "origin-item__detail origin-item__detail--ability");
        ability.append(make("h3", "", option.ability), make("p", "", option.effect));
        const choose = make("button", "button button--primary origin-item__choose", "Escolher esta origem");
        choose.type = "button";
        content.append(make("p", "origin-item__description", option.description), skills, ability, choose);
        panel.append(content);
        item.append(header, panel);
        originItems.set(option.id, { item, header, panel, badge, choose, name: option.name });
        header.addEventListener("click", () => setOpenOrigin(openOriginId === option.id ? null : option.id));
        choose.addEventListener("click", () => {
            origin = option.id;
            clearError(2);
            updateOriginSelection();
            header.focus({ preventScroll: true });
            const close = () => { if (openOriginId === option.id) setOpenOrigin(null); };
            if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) close();
            else originCloseTimer = window.setTimeout(close, 180);
        });
        $("originList").append(item);
    });
    updateOriginSelection();
    if (existing && origin) setOpenOrigin(origin);
    $("originSearch").addEventListener("input", filterOrigins);
    filterOrigins();
}

function filterOrigins() {
    const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const query = normalize($("originSearch").value.trim());
    let count = 0;
    for (const option of ORIGINS) {
        const visible = normalize([option.name, option.skills, option.ability, option.description, option.effect].join(" ")).includes(query);
        originItems.get(option.id).item.hidden = !visible;
        if (visible) count++;
        else if (openOriginId === option.id) setOpenOrigin(null);
    }
    $("originSearchResult").textContent = count ? `${count} de ${ORIGINS.length} origens${query ? " encontradas" : " do Livro de Regras"}.` : "Nenhuma origem encontrada. Tente outro nome, perícia ou habilidade.";
}

function setOpenOrigin(id) {
    if (originCloseTimer !== null) window.clearTimeout(originCloseTimer);
    originCloseTimer = null;
    openOriginId = id;
    originItems.forEach(({ item, header, panel }, itemId) => {
        const expanded = itemId === id;
        item.dataset.open = String(expanded);
        header.setAttribute("aria-expanded", String(expanded));
        panel.setAttribute("aria-hidden", String(!expanded));
        panel.inert = !expanded;
    });
}

function updateOriginSelection() {
    originItems.forEach(({ item, header, badge, choose, name }, itemId) => {
        const selected = itemId === origin;
        item.dataset.selected = String(selected);
        header.setAttribute("aria-label", selected ? `${name}, escolhida` : name);
        badge.hidden = !selected;
        choose.disabled = selected;
        choose.textContent = selected ? "Origem escolhida" : "Escolher esta origem";
    });
    const selected = ORIGINS.find(option => option.id === origin);
    $("originSelectionSummary").textContent = selected ? `Origem escolhida: ${selected.name}. Perícias: ${selected.skills}. Habilidade: ${selected.ability}.` : "Nenhuma origem escolhida ainda. Abrir um cartão não o seleciona.";
}

function renderClasses() {
    const grid = make("div", "class-grid");
    const mundane = make("div", "mundane-choice");
    CLASSES.forEach((option) => {
        let item;
        let badge;
        let button;
        if (option.id === "mundano") {
            item = mundane;
            const description = make("span", "mundane-choice__description", option.description);
            description.id = "class-description-mundano";
            button = make("button", "mundane-choice__button", "Escolher Mundano");
            button.setAttribute("aria-describedby", description.id);
            item.append(description, button);
        } else {
            item = make("article", "class-card");
            const heading = make("div", "class-card__heading");
            const name = make("h3", "", option.name);
            name.id = `class-name-${option.id}`;
            badge = make("span", "class-card__tag", "Escolhida");
            heading.append(name, badge);
            const description = make("div", "class-card__description");
            description.id = `class-description-${option.id}`;
            description.tabIndex = 0;
            description.setAttribute("role", "region");
            description.setAttribute("aria-labelledby", name.id);
            description.append(make("p", "", option.description));
            button = make("button", "button button--primary class-card__choose", "Escolher esta classe");
            button.setAttribute("aria-describedby", description.id);
            item.append(heading, description, button);
            grid.append(item);
        }
        button.type = "button";
        classControls.set(option.id, { item, button, badge });
        button.addEventListener("click", () => {
            characterClass = option.id;
            clearError(0);
            updateTheme();
            updateClassSelection();
            updateAttributeControls();
        });
    });
    $("classList").append(grid, mundane);
    updateClassSelection();
}

function updateClassSelection() {
    classControls.forEach(({ item, button, badge }, id) => {
        const selected = id === characterClass;
        const name = CLASSES.find((option) => option.id === id).name;
        item.dataset.selected = String(selected);
        button.setAttribute("aria-pressed", String(selected));
        button.setAttribute("aria-label", selected ? (id === "mundano" ? "Mundano escolhido" : `Classe ${name} escolhida`) : `Escolher ${name}`);
        button.textContent = id === "mundano"
            ? (selected ? "Mundano escolhido" : "Escolher Mundano")
            : (selected ? "Classe escolhida" : "Escolher esta classe");
        if (badge) badge.hidden = !selected;
    });
}

function renderSummary() {
    const summary = $("sheetSummary");
    const attributeText = ATTRIBUTES.map(({ id, name }) => name + " " + attributes[id]).join(" · ");
    summary.replaceChildren(
        make("strong", "", "Resumo da ficha"),
        make("span", "", (ORIGINS.find((item) => item.id === origin)?.name || "Sem origem") + " · " + (CLASSES.find((item) => item.id === characterClass)?.name || "Sem classe") + " · " + attributeText)
    );
}

function showStep(index) {
    currentStep = index;
    furthestStep = Math.max(furthestStep, index);
    stepSections.forEach((section, sectionIndex) => { section.hidden = sectionIndex !== index; });
    stepButtons.forEach((button, buttonIndex) => {
        button.disabled = buttonIndex > furthestStep;
        if (buttonIndex === index) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
    });
    $("previousStep").hidden = index === 0;
    $("nextStep").hidden = index === 3;
    $("saveCharacter").hidden = index !== 3;
    if (index === 3) renderSummary();
    window.scrollTo(0, 0);
}

function validateStep(index) {
    clearError(index);
    if (index === 0 && !characterClass) {
        showError(0, "Escolha uma classe ou Mundano para continuar.");
        return false;
    }
    if (index === 1 && !unchangedSavedAllocation()) {
        if (Object.values(attributes).some((value) => value > ATTRIBUTE_MAX_INITIAL)) {
            showError(1, "O máximo inicial é 3 em cada atributo.");
            return false;
        }
        if (pointsRemaining() !== 0) {
            showError(1, pointsRemaining() < 0
                ? "Reduza os atributos até não exceder os pontos disponíveis."
                : "Distribua todos os pontos antes de continuar.");
            return false;
        }
    }
    if (index === 2 && !origin) {
        showError(2, "Escolha uma origem para continuar.");
        return false;
    }
    if (index === 3 && !$("characterName").value.trim()) {
        showError(3, "Dê um nome ao personagem antes de salvar.");
        $("characterName").focus();
        return false;
    }
    return true;
}

function saveCharacter(event) {
    event.preventDefault();
    for (let index = 0; index < 4; index += 1) {
        if (!validateStep(index)) { showStep(index); return; }
    }
    const selectedOrigin = ORIGINS.find((item) => item.id === origin);
    const selectedClass = CLASSES.find((item) => item.id === characterClass);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    Object.keys(values).forEach((key) => { values[key] = values[key].trim(); });
    const character = {
        ...existing,
        id: existing?.id || crypto.randomUUID(),
        ...values,
        attributes: { ...attributes },
        origin,
        originName: selectedOrigin.name,
        class: characterClass,
        role: selectedClass.name,
        nex: window.REAL_NEX_RULES.normalizeNex(characterClass, existing?.nex),
        description: values.history
    };
    const index = existing ? state.characters.findIndex((entry) => entry.id === existing.id) : -1;
    if (index >= 0) state.characters[index] = character;
    else state.characters.unshift(character);
    if (persistState()) location.href = "personagem.html?id=" + encodeURIComponent(character.id);
}

function deleteCharacter() {
    if (!existing || !confirm("Excluir esta ficha da biblioteca? Ela também será removida das campanhas em que foi adicionada.")) return;
    state.characters = state.characters.filter((character) => character.id !== existing.id);
    state.campaigns.forEach((campaign) => {
        campaign.characters = (campaign.characters || []).filter((id) => id !== existing.id);
    });
    if (persistState()) location.href = "index.html#personagens";
}

if (existing) {
    $("pageTitle").textContent = "Editar " + (existing.name || "personagem");
    $("pageDescription").textContent = "Revise a classe, os atributos, a origem e os detalhes desta ficha.";
    $("deleteCharacter").hidden = false;
    document.title = (existing.name || "Editar ficha") + " | R.E.A.L";
}
for (const id of ["name", "player", "appearance", "personality", "history", "objective"]) {
    const field = document.querySelector(`[name="${id}"]`);
    field.value = id === "history" ? (existing?.history || existing?.description || "") : (existing?.[id] || "");
}
$("characterName").addEventListener("input", () => clearError(3));
renderAttributes();
renderOrigins();
renderClasses();
updateTheme({ instant: true });
showStep(0);
$("previousStep").addEventListener("click", () => showStep(Math.max(0, currentStep - 1)));
$("nextStep").addEventListener("click", () => { if (validateStep(currentStep)) showStep(currentStep + 1); });
stepButtons.forEach((button, index) => button.addEventListener("click", () => {
    if (existing || index <= currentStep || validateStep(currentStep)) showStep(index);
}));
$("sheetForm").addEventListener("submit", saveCharacter);
$("deleteCharacter").addEventListener("click", deleteCharacter);
