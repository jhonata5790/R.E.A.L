const STORAGE_KEY = "cronicas-biblioteca-v2";
const ATTRIBUTES = [
    { id: "agilidade", name: "Agilidade", hint: "Movimento e reflexos" },
    { id: "forca", name: "Força", hint: "Potência física" },
    { id: "intelecto", name: "Intelecto", hint: "Raciocínio e conhecimento" },
    { id: "presenca", name: "Presença", hint: "Influência e percepção" },
    { id: "vigor", name: "Vigor", hint: "Resistência e fôlego" }
];
const ATTRIBUTE_TOTAL = 9;
const ORIGINS = [
    {
        id: "criminoso", name: "Criminoso",
        description: "Você viveu fora da lei e acabou envolvido com a Ordem. Seu passado pode ser um recurso — ou um problema.",
        skills: "Crime e Furtividade",
        ability: "O Crime Compensa",
        effect: "Ao fim de uma missão, escolha um item encontrado. Na próxima missão, ele pode entrar no inventário sem contar no limite de itens por patente."
    },
    {
        id: "amnesico", name: "Amnésico",
        description: "Você perdeu a maior parte das lembranças. A Ordem é a família que conhece agora, mas cada missão pode revelar um pedaço do passado.",
        skills: "Duas perícias à escolha do mestre",
        ability: "Vislumbres do Passado",
        effect: "Uma vez por sessão, faça um teste de Intelecto (DT 10) ao encontrar alguém ou algum lugar familiar. Se passar, receba 1d4 PE temporários e uma informação útil, a critério do mestre."
    },
    {
        id: "cultista-arrependido", name: "Cultista Arrependido",
        description: "Você fez parte de um culto paranormal, mas decidiu lutar do outro lado. Conquistar a confiança da Ordem ainda é um desafio.",
        skills: "Ocultismo e Religião",
        ability: "Traços do Outro Lado",
        effect: "Escolha um poder paranormal. Você começa o jogo com metade da Sanidade normal para a sua classe."
    }
];
const CLASSES = [
    { id: "combatente", name: "Combatente", description: "Enfrenta o perigo diretamente e protege o grupo em combate." },
    { id: "especialista", name: "Especialista", description: "Resolve problemas com técnica, investigação e perícias." },
    { id: "ocultista", name: "Ocultista", description: "Estuda e utiliza o paranormal, com todos os riscos que isso traz." },
    { id: "mundano", name: "Mundano", description: "Ainda não escolheu uma das três classes da Ordem." }
];
const $ = (id) => document.getElementById(id);
const stepSections = [...document.querySelectorAll(".sheet-step")];
const stepButtons = [...document.querySelectorAll("[data-step-button]")];
const errorIds = ["attributesError", "originError", "classError", "finalError"];

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
let origin = normalizedChoice(existing?.origin, ORIGINS);
let characterClass = normalizedChoice(existing?.class || existing?.role, CLASSES);
let currentStep = 0;
let furthestStep = existing ? 3 : 0;
const attributeControls = new Map();

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

function pointsRemaining() {
    return ATTRIBUTE_TOTAL - Object.values(attributes).reduce((total, value) => total + value, 0);
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
    const list = $("attributeList");
    ATTRIBUTES.forEach(({ id, name, hint }) => {
        const row = make("div", "attribute-row");
        const label = make("div", "attribute-row__label");
        label.append(make("strong", "", name), make("small", "", hint));
        const controls = make("div", "attribute-row__controls");
        const minus = make("button", "", "−");
        minus.type = "button";
        minus.setAttribute("aria-label", "Diminuir " + name);
        const value = make("output", "", String(attributes[id]));
        value.setAttribute("aria-label", name);
        const plus = make("button", "", "+");
        plus.type = "button";
        plus.setAttribute("aria-label", "Aumentar " + name);
        minus.addEventListener("click", () => changeAttribute(id, -1));
        plus.addEventListener("click", () => changeAttribute(id, 1));
        controls.append(minus, value, plus);
        row.append(label, controls);
        list.append(row);
        attributeControls.set(id, { minus, plus, value });
    });
    updateAttributeControls();
}

function updateAttributeControls() {
    const remaining = pointsRemaining();
    const zeros = Object.values(attributes).filter((value) => value === 0).length;
    $("pointsRemaining").textContent = remaining;
    ATTRIBUTES.forEach(({ id }) => {
        const control = attributeControls.get(id);
        control.value.textContent = attributes[id];
        control.minus.disabled = attributes[id] === 0 || (attributes[id] === 1 && zeros > 0);
        control.plus.disabled = attributes[id] === 5 || remaining === 0;
    });
}

function changeAttribute(id, delta) {
    const next = attributes[id] + delta;
    if (next < 0 || next > 5 || (delta > 0 && pointsRemaining() === 0)) return;
    if (next === 0 && Object.values(attributes).includes(0)) return;
    attributes[id] = next;
    clearError(0);
    updateAttributeControls();
}

function renderOrigins() {
    ORIGINS.forEach((option) => {
        const card = make("button", "choice-card");
        card.type = "button";
        card.setAttribute("aria-pressed", String(origin === option.id));
        const top = make("span", "choice-card__top");
        top.append(make("strong", "", option.name), make("span", "choice-card__tag", origin === option.id ? "Escolhida" : "Escolher"));
        const skills = make("small");
        skills.append(make("b", "", "Perícias treinadas: "), document.createTextNode(option.skills));
        const ability = make("small");
        ability.append(make("b", "", option.ability + ": "), document.createTextNode(option.effect));
        card.append(top, make("p", "", option.description), skills, ability);
        card.addEventListener("click", () => {
            origin = option.id;
            clearError(1);
            [...$("originList").children].forEach((item) => {
                const selected = item === card;
                item.setAttribute("aria-pressed", String(selected));
                item.querySelector(".choice-card__tag").textContent = selected ? "Escolhida" : "Escolher";
            });
        });
        $("originList").append(card);
    });
}

function renderClasses() {
    CLASSES.forEach((option) => {
        const card = make("button", "class-card");
        card.type = "button";
        card.setAttribute("aria-pressed", String(characterClass === option.id));
        card.append(make("span", "class-card__tag", characterClass === option.id ? "Escolhida" : "Escolher"), make("strong", "", option.name), make("p", "", option.description));
        card.addEventListener("click", () => {
            characterClass = option.id;
            clearError(2);
            [...$("classList").children].forEach((item) => {
                const selected = item === card;
                item.setAttribute("aria-pressed", String(selected));
                item.querySelector(".class-card__tag").textContent = selected ? "Escolhida" : "Escolher";
            });
        });
        $("classList").append(card);
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
    if (index === 0 && pointsRemaining() !== 0) {
        showError(0, "Distribua todos os pontos antes de continuar.");
        return false;
    }
    if (index === 1 && !origin) {
        showError(1, "Escolha uma origem para continuar.");
        return false;
    }
    if (index === 2 && !characterClass) {
        showError(2, "Escolha uma classe ou Mundano para continuar.");
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
        description: values.history
    };
    const index = existing ? state.characters.findIndex((entry) => entry.id === existing.id) : -1;
    if (index >= 0) state.characters[index] = character;
    else state.characters.unshift(character);
    if (persistState()) location.href = "index.html#personagens";
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
    $("pageDescription").textContent = "Revise os atributos, a origem, a classe e os detalhes desta ficha.";
    $("deleteCharacter").hidden = false;
    document.title = (existing.name || "Editar ficha") + " | Crônicas";
}
for (const id of ["name", "player", "appearance", "personality", "history", "objective"]) {
    const field = document.querySelector(`[name="${id}"]`);
    field.value = id === "history" ? (existing?.history || existing?.description || "") : (existing?.[id] || "");
}
$("characterName").addEventListener("input", () => clearError(3));
renderAttributes();
renderOrigins();
renderClasses();
showStep(0);
$("previousStep").addEventListener("click", () => showStep(Math.max(0, currentStep - 1)));
$("nextStep").addEventListener("click", () => { if (validateStep(currentStep)) showStep(currentStep + 1); });
stepButtons.forEach((button, index) => button.addEventListener("click", () => {
    if (existing || index <= currentStep || validateStep(currentStep)) showStep(index);
}));
$("sheetForm").addEventListener("submit", saveCharacter);
$("deleteCharacter").addEventListener("click", deleteCharacter);
