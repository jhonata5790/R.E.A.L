const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function openCharacter(character, options = {}) {
    class Element {
        constructor(tag = "div") {
            this.tag = tag;
            this.children = [];
            this.dataset = {};
            this.attributes = {};
            this.handlers = {};
            this.hidden = false;
            this.textContent = "";
            this.value = "";
            this.scrollWidth = 850;
            this.scrollHeight = 520;
            this.style = { setProperty: (name, value) => { this.style[name] = value; } };
            this.classList = {
                toggle: (name, active) => { this.classes[name] = active === undefined ? !this.classes[name] : active; },
                contains: (name) => Boolean(this.classes[name])
            };
            this.classes = {};
        }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        remove() { this.removed = true; }
        focus() { this.focused = true; }
        click() { this.handlers.click?.({ currentTarget: this }); }
        reset() { this.resetCalled = true; }
        showModal() { this.open = true; }
        close() { this.open = false; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        removeAttribute(name) { delete this.attributes[name]; }
        getAttribute(name) { return this.attributes[name] ?? null; }
        addEventListener(name, handler) { this.handlers[name] = handler; }
        set src(value) {
            this.attributes.src = value;
            if (options.failedImages?.includes(value)) this.handlers.error?.();
        }
        get src() { return this.attributes.src; }
    }

    const ids = Object.fromEntries([
        "missingCharacter", "characterContent", "sheetTabs", "characterName", "infoCharacterName", "characterTheme", "characterNex",
        "nexSelect", "pePerTurn", "nexExplanation", "ritualDifficulty", "resourceMessage",
        ...["vida", "esforco", "sanidade", "determinacao"].flatMap((id) => [`${id}Value`, `${id}Maximum`, `${id}Current`, `${id}Progress`, `${id}Bonus`, `${id}Decrease`, `${id}Increase`]),
        "chooseResourceSystem", "resourceSystemName", "effortLimitLabel", "esforcoResource", "sanidadeResource", "determinacaoResource", "determinacaoMaxInput", "determinacaoTurnInput", "resourceSystemDialog", "useEffortSanity", "useDetermination", "cancelResourceSystem",
        "automaticEffects", "automaticEffectsSummary", "freeRollForm", "freeRollExpression", "progressionTitle", "progressionNex", "progressionSummary", "trailField", "trailSelect", "trailMessage", "trailTimeline", "classPowerProgress", "attributeIncreaseProgress", "trainingProgress", "versatilityField", "versatilitySelect", "choiceProgressionMessage", "ritualProgressionSummary",
        "characterOrigin", "characterClass", "characterPlayer", "characterCampaign",
        "editCharacter", "characterAppearance", "characterPersonality",
        "characterHistory", "characterObjective", "attributeWheelImage",
        "attributeWheelValues", "toggleAttributeEdit", "attributeEditHint", "storageNote", "noteWorkspace", "noteCanvas", "noteCanvasScroll", "noteConnectionLayer", "noteConnectionList", "noteMapStatus", "connectNotes", "undoNoteConnection", "noteColor", "noteKind", "noteRelation", "duplicateNote", "organizeNoteMap", "exportNoteMap", "importNoteMap", "importNoteMapFile", "noteSearch", "noteZoomOut", "noteZoomValue", "noteZoomIn", "fitNoteMap", "clearNoteMap",
        "skillsBody", "skillRollResult", "skillProgressionSummary", "originTrainingSummary", "originTrainingChoices",
        "originSkillChoice1", "originSkillChoice2", "originTrainingMessage",
        "toggleNotesFullscreen", "entryDialog", "entryDialogTitle", "entryCategoryField",
        "entryCategory", "entryForm", "entryName", "entryDescription", "cancelEntry", "entrySubmit",
        "openCatalog", "catalogDialog", "catalogDialogTitle", "catalogCollections", "catalogCategories", "catalogGroupTitle", "catalogList", "closeCatalog",
        "openAbilityCatalog", "abilityCatalogDialog", "closeAbilityCatalog", "abilityCatalogCategories", "abilityCatalogSubgroups", "abilityCatalogSearch", "abilityCatalogGroupTitle", "abilityCatalogMessage", "abilityCatalogList",
        "openRitualCatalog", "ritualCatalogDialog", "closeRitualCatalog", "ritualCatalogElements", "ritualCatalogCircles", "ritualCatalogSearch", "ritualCatalogGroupTitle", "ritualCatalogMessage", "ritualCatalogList",
        "inventoryList", "abilitiesList", "ritualsList", "equippedWeapon", "prestigeInput", "patentSelect", "creditLimit", "inventoryLoad", "inventoryCategory1", "inventoryCategory2", "inventoryCategory3", "inventoryCategory4", "categoryBonus1", "categoryBonus2", "categoryBonus3", "categoryBonus4", "loadBonus", "inventoryLimitMessage",
        "defenseValue", "blockValue", "dodgeValue", "protectionValue", "resistanceValue", "proficiencyValue", "defenseExplanation",
        "defenseBonus", "blockBonus", "dodgeBonus", "resistanceNotes", "proficiencyNotes", "equipmentMessage",
        ...["informacoes", "descricoes", "atributos", "pericias", "combate", "inventario", "habilidades", "rituais"].map((id) => `panel-${id}`),
        "subpanel-textos", "subpanel-anotacoes"
    ].map((id) => [id, new Element()]));
    const sheetTabs = ["informacoes", "atributos", "pericias", "combate", "inventario", "habilidades", "rituais", "descricoes"].map((id) => {
        const tab = new Element("button");
        tab.dataset.sheetTab = id;
        tab.textContent = id;
        tab.setAttribute("aria-controls", `panel-${id}`);
        return tab;
    });
    const descriptionTabs = ["textos", "anotacoes"].map((id) => {
        const tab = new Element("button");
        tab.dataset.descriptionTab = id;
        tab.setAttribute("aria-controls", `subpanel-${id}`);
        return tab;
    });
    const addEntryButtons = ["inventario", "habilidades", "rituais"].map((id) => {
        const button = new Element("button");
        button.dataset.addEntry = id;
        return button;
    });
    const inventoryFilters = ["todos", "itens", "armas", "municoes", "protecao", "geral", "amaldicoados"].map((id) => {
        const button = new Element("button");
        button.dataset.inventoryFilter = id;
        return button;
    });
    const shapeButtons = ["square", "rectangle", "triangle", "circle"].map((id) => {
        const button = new Element("button");
        button.dataset.addShape = id;
        return button;
    });
    ids.attributeWheelImage.src = "assets/atributos-indefinido.png";
    ids.characterContent.hidden = true;
    ids.missingCharacter.hidden = true;
    ids.skillRollResult.hidden = true;
    ids.originTrainingChoices.hidden = true;
    const saved = character ? {
        characters: [character],
        campaigns: [{ id: "campanha-1", name: "Noite na Ordem", characters: [character.id] }]
    } : { characters: [], campaigns: [] };
    let stored = JSON.stringify(saved);
    let nextId = 0;
    let nextDie = 0;
    const viewport = {
        matches: Boolean(options.desktopViewport),
        addEventListener(_name, handler) { this.onChange = handler; }
    };
    const testMath = Object.create(Math);
    if (options.dice) testMath.random = () => ((options.dice[nextDie++ % options.dice.length] - 1) / 20);
    const context = vm.createContext({
        document: {
            body: new Element("body"),
            title: "Ficha de personagem | R.E.A.L",
            getElementById: (id) => ids[id],
            createElement: (tag) => new Element(tag),
            createElementNS: (_namespace, tag) => new Element(tag),
            querySelectorAll: (selector) => ({
                "[data-sheet-tab]": sheetTabs,
                "[data-description-tab]": descriptionTabs,
                "[data-add-entry]": addEntryButtons,
                "[data-inventory-filter]": inventoryFilters,
                "[data-add-shape]": shapeButtons
            })[selector] || [],
            addEventListener() {}
        },
        window: { setTimeout: (callback) => callback(), clearTimeout() {}, confirm: () => true, matchMedia: () => viewport },
        localStorage: { getItem: () => stored, setItem: (_key, value) => { if (options.failStorage) throw new Error("Storage full"); stored = value; } },
        location: { search: options.search ?? (character ? `?id=${character.id}` : "") },
        URLSearchParams,
        crypto: { randomUUID: () => `item-${++nextId}` },
        Math: testMath,
        Object,
        Number,
        String
    });
    vm.runInContext(fs.readFileSync(path.join(root, "attribute-themes.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "nex-rules.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "origins.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "equipment-catalog.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "equipment-rules.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "inventory-rules.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "ability-catalog.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "progression-rules.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "ritual-catalog.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "sheet-mechanics.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "mind-map-rules.js"), "utf8"), context);
    if (options.catalogCollections) context.window.REAL_EQUIPMENT_COLLECTIONS = [...context.window.REAL_EQUIPMENT_COLLECTIONS, ...options.catalogCollections];
    if (options.catalogItems) context.window.REAL_EQUIPMENT_CATALOG = [...context.window.REAL_EQUIPMENT_CATALOG, ...options.catalogItems];
    vm.runInContext(fs.readFileSync(path.join(root, "personagem.js"), "utf8"), context);
    return { ids, context, sheetTabs, descriptionTabs, addEntryButtons, inventoryFilters, shapeButtons, viewport, saved: () => JSON.parse(stored) };
}

const character = {
    id: "personagem-1",
    name: "Lynn Cárter",
    player: "Jhonata",
    origin: "amnesico",
    originName: "Amnésico",
    class: "especialista",
    role: "Especialista",
    attributes: { agilidade: 4, forca: 1, intelecto: 3, presenca: 0, vigor: 1 },
    appearance: "Cabelos escuros.",
    personality: "Curiosa.",
    history: "Busca pistas do passado.",
    objective: "Encontrar a verdade."
};

function listedAbility(view, name) {
    return view.ids.abilitiesList.children.find((row) => row.children[0]?.textContent === name);
}

const { ids, context, sheetTabs, descriptionTabs, addEntryButtons, inventoryFilters, shapeButtons, saved } = openCharacter(character);
assert.equal(ids.missingCharacter.hidden, true);
assert.equal(ids.characterContent.hidden, false);
assert.equal(ids.characterName.textContent, "Lynn Cárter");
assert.equal(context.document.title, "Lynn Cárter | R.E.A.L");
const resourceView = openCharacter(character);
assert.equal(resourceView.ids.nexSelect.value, "5", "fichas antigas começam visualmente em NEX 5%");
assert.equal(resourceView.ids.characterNex.textContent, "NEX 5%");
assert.equal(resourceView.ids.vidaMaximum.textContent, "17");
assert.equal(resourceView.ids.esforcoMaximum.textContent, "3");
assert.equal(resourceView.ids.sanidadeMaximum.textContent, "16");
assert.equal(resourceView.ids.pePerTurn.textContent, "1");
assert.equal(resourceView.ids.ritualDifficulty.textContent, "11");
assert.equal(resourceView.saved().characters[0].sheet, undefined, "abrir ficha antiga não força migração do armazenamento");
resourceView.ids.nexSelect.value = "10";
resourceView.ids.nexSelect.handlers.change();
assert.equal(resourceView.ids.vidaMaximum.textContent, "21");
assert.equal(resourceView.ids.esforcoMaximum.textContent, "6");
assert.equal(resourceView.ids.sanidadeMaximum.textContent, "20");
assert.equal(resourceView.ids.pePerTurn.textContent, "2");
assert.equal(resourceView.ids.characterNex.textContent, "NEX 10%");
assert.equal(resourceView.ids.ritualDifficulty.textContent, "12");
assert.equal(resourceView.saved().characters[0].nex, 10);
resourceView.ids.vidaDecrease.click();
assert.equal(resourceView.ids.vidaValue.textContent, "20");
assert.equal(resourceView.saved().characters[0].sheet.resources.vida.current, 20);
resourceView.ids.vidaBonus.value = "5";
resourceView.ids.vidaBonus.handlers.change();
assert.equal(resourceView.ids.vidaMaximum.textContent, "26");
assert.equal(resourceView.ids.vidaValue.textContent, "25", "mudar o máximo preserva o dano sofrido");
resourceView.ids.vidaCurrent.value = "-2";
resourceView.ids.vidaCurrent.handlers.change();
assert.equal(resourceView.ids.vidaCurrent.value, "25", "valor atual inválido é rejeitado");
resourceView.ids.nexSelect.value = "5";
resourceView.ids.nexSelect.handlers.change();
assert.equal(resourceView.ids.vidaMaximum.textContent, "22");
assert.equal(resourceView.ids.vidaValue.textContent, "21", "reduzir NEX também preserva o dano sofrido");
const resourceReload = openCharacter(resourceView.saved().characters[0]);
assert.equal(resourceReload.ids.nexSelect.value, "5");
assert.equal(resourceReload.ids.vidaValue.textContent, "21");
assert.equal(resourceReload.ids.vidaBonus.value, "5");
const progressionView = openCharacter({ ...character });
assert.equal(progressionView.ids.trailSelect.disabled, true, "a trilha ainda não é escolhida antes de NEX 10%");
assert.equal(progressionView.ids.classPowerProgress.textContent, "0 / 0");
assert.equal(progressionView.ids.attributeIncreaseProgress.textContent, "0 liberados");
assert.equal(progressionView.ids.trainingProgress.textContent, "Treinado +5");
assert.equal(progressionView.ids.versatilitySelect.disabled, true);
assert.equal(progressionView.ids.trailSelect.children.length, 5, "especialista oferece as cinco trilhas do livro");
assert.match(progressionView.ids.trailMessage.textContent, /NEX 10%/);
progressionView.ids.nexSelect.value = "10";
progressionView.ids.nexSelect.handlers.change();
assert.equal(progressionView.ids.trailSelect.disabled, false);
progressionView.ids.trailSelect.value = "Infiltrador";
progressionView.ids.trailSelect.handlers.change();
assert.equal(progressionView.saved().characters[0].sheet.progression.trail, "Infiltrador");
assert.equal(progressionView.ids.trailTimeline.children.length, 4);
assert.equal(progressionView.ids.trailTimeline.children[0].dataset.unlocked, "true");
assert.equal(progressionView.ids.trailTimeline.children[1].dataset.unlocked, "false");
assert.ok(listedAbility(progressionView, "Ataque Furtivo"), "o primeiro poder da trilha é liberado automaticamente");
progressionView.ids.nexSelect.value = "40";
progressionView.ids.nexSelect.handlers.change();
assert.ok(listedAbility(progressionView, "Engenhosidade"), "habilidade posterior da classe acompanha o NEX");
assert.ok(listedAbility(progressionView, "Gatuno"), "o segundo poder da trilha acompanha o NEX");
assert.equal(progressionView.ids.trailTimeline.children[1].dataset.unlocked, "true");
assert.equal(progressionView.ids.classPowerProgress.textContent, "0 / 2");
assert.equal(progressionView.ids.attributeIncreaseProgress.textContent, "1 liberado");
assert.equal(progressionView.ids.trainingProgress.textContent, "Veterano +10");
progressionView.ids.nexSelect.value = "50";
progressionView.ids.nexSelect.handlers.change();
assert.equal(progressionView.ids.versatilitySelect.disabled, false);
progressionView.ids.versatilitySelect.value = "power";
progressionView.ids.versatilitySelect.handlers.change();
assert.equal(progressionView.ids.classPowerProgress.textContent, "0 / 4", "Versatilidade pode abrir uma escolha adicional de poder");
assert.equal(progressionView.saved().characters[0].sheet.progression.versatility, "power");
const cultistResources = openCharacter({ ...character, class: "ocultista", role: "Ocultista", origin: "cultista-arrependido", originName: "Cultista Arrependido" });
assert.equal(cultistResources.ids.sanidadeMaximum.textContent, "10", "Cultista Arrependido perde metade da Sanidade inicial");
assert.match(cultistResources.ids.ritualProgressionSummary.textContent, /1º círculo.*3 aprendizado/);
cultistResources.ids.nexSelect.value = "10";
cultistResources.ids.nexSelect.handlers.change();
assert.equal(cultistResources.ids.sanidadeMaximum.textContent, "15", "avanços posteriores concedem Sanidade integral");
const learnedRitualView = openCharacter({ ...character, nex: 45, sheet: { habilidades: [{ id: "ritual-power", name: "Aprender Ritual" }], rituais: [{ id: "ritual", name: "Ritual de teste" }] } });
assert.match(learnedRitualView.ids.ritualProgressionSummary.textContent, /2º círculo.*1 ritual/);
const mundaneResources = openCharacter({ ...character, class: "mundano", role: "Mundano" });
assert.equal(mundaneResources.ids.nexSelect.value, "0");
assert.equal(mundaneResources.ids.vidaMaximum.textContent, "9");
assert.equal(mundaneResources.ids.esforcoMaximum.textContent, "1");
assert.equal(mundaneResources.ids.sanidadeMaximum.textContent, "8");
const inventoryLimitsView = openCharacter({
    ...character,
    sheet: { inventario: [
        { id: "a", name: "Item A", category: "geral", itemCategory: 1, space: 2 },
        { id: "b", name: "Item B", category: "geral", itemCategory: 1, space: 2 },
        { id: "c", name: "Item C", category: "geral", itemCategory: 1, space: 2 }
    ] }
});
assert.equal(inventoryLimitsView.ids.patentSelect.children.length, 5);
assert.equal(inventoryLimitsView.ids.patentSelect.value, "recruta");
assert.equal(inventoryLimitsView.ids.creditLimit.textContent, "Baixo");
assert.equal(inventoryLimitsView.ids.inventoryCategory1.textContent, "3 / 2");
assert.equal(inventoryLimitsView.ids.inventoryCategory1.dataset.exceeded, "true");
assert.equal(inventoryLimitsView.ids.inventoryLoad.textContent, "6 / 5 espaços");
assert.match(inventoryLimitsView.ids.inventoryLimitMessage.textContent, /Categoria I excedida.*Sobrecarga/);
inventoryLimitsView.ids.prestigeInput.value = "20";
inventoryLimitsView.ids.prestigeInput.handlers.change();
assert.equal(inventoryLimitsView.ids.patentSelect.value, "operador");
assert.equal(inventoryLimitsView.ids.creditLimit.textContent, "Médio");
assert.equal(inventoryLimitsView.ids.inventoryCategory1.textContent, "3 / 3");
inventoryLimitsView.ids.patentSelect.value = "agente-especial";
inventoryLimitsView.ids.patentSelect.handlers.change();
assert.equal(inventoryLimitsView.ids.prestigeInput.value, "50");
assert.equal(inventoryLimitsView.saved().characters[0].sheet.inventoryRules.prestige, 50);
inventoryLimitsView.ids.loadBonus.value = "2";
inventoryLimitsView.ids.loadBonus.handlers.change();
assert.equal(inventoryLimitsView.ids.inventoryLoad.textContent, "6 / 7 espaços");
assert.match(inventoryLimitsView.ids.inventoryLimitMessage.textContent, /Inventário dentro dos limites/);
for (const page of ["index.html", "ficha.html", "personagem.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.match(html, /<strong>R\.E\.A\.L<\/strong><small>RPG entre amigos loucos<\/small>/);
}
assert.equal(ids.characterOrigin.textContent, "Amnésico");
assert.equal(ids.characterClass.textContent, "Especialista");
assert.equal(ids.characterPlayer.textContent, "Jhonata");
assert.equal(ids.characterCampaign.textContent, "Noite na Ordem");
assert.equal(ids.editCharacter.href, "ficha.html?id=personagem-1");
assert.equal(ids.attributeWheelImage.src, "assets/atributos-especialista.png");
assert.equal(context.document.body.dataset?.characterTheme, "especialista");
assert.equal(ids.attributeWheelValues.children.length, 5);
assert.deepEqual(ids.attributeWheelValues.children.map((marker) => marker.children[0].textContent), ["4", "1", "3", "0", "1"]);
assert.equal(ids.attributeWheelValues.children[0].style["--wheel-x"], "50%");
assert.equal(ids.attributeWheelValues.children[3].getAttribute("aria-label"), "Presença: 0");
const attributeEdit = openCharacter(JSON.parse(JSON.stringify(character)), { dice: [15, 2, 18, 7] });
const editWheel = attributeEdit.ids.attributeWheelValues;
const editButton = attributeEdit.ids.toggleAttributeEdit;
assert.equal(editWheel.children[1].children[1].disabled, false, "a roda permite rolar fora do modo de edição");
editButton.click();
assert.equal(editButton.getAttribute("aria-pressed"), "true");
assert.equal(editWheel.dataset.editing, "true");
assert.equal(attributeEdit.ids.attributeEditHint.hidden, false);
const forceMarker = editWheel.children[1];
forceMarker.children[1].click();
assert.equal(forceMarker.children[2].hidden, false, "clicar no círculo abre a digitação");
assert.equal(forceMarker.children[2].focused, true);
forceMarker.children[2].value = "-3";
forceMarker.children[2].handlers.change();
assert.equal(forceMarker.children[0].textContent, "-3");
assert.equal(forceMarker.getAttribute("aria-label"), "Força: -3");
assert.equal(attributeEdit.saved().characters[0].attributes.forca, -3, "atributo editado é salvo no formato existente");
const editedLuta = attributeEdit.ids.skillsBody.children[15];
assert.equal(editedLuta.children[1].children[0].children[1].textContent, "4d20 ↓");
editedLuta.children[0].children[0].children[0].click();
assert.match(attributeEdit.ids.skillRollResult.getAttribute("aria-label"), /Luta: 4d20: 15, 2, 18, 7\. Menor dado: 2\. Bônus: 0\. Total: 2\./);
const vigorMarker = editWheel.children[4];
vigorMarker.children[1].click();
vigorMarker.children[2].value = "101";
vigorMarker.children[2].handlers.change();
assert.equal(vigorMarker.children[0].textContent, "100", "valor acima do máximo é limitado a 100");
assert.equal(attributeEdit.ids.vidaMaximum.textContent, "116", "Vida acompanha o Vigor editado");
vigorMarker.children[1].click();
vigorMarker.children[2].value = "-101";
vigorMarker.children[2].handlers.change();
assert.equal(vigorMarker.children[0].textContent, "-100", "valor abaixo do mínimo é limitado a −100");
assert.equal(attributeEdit.ids.vidaMaximum.textContent, "0", "máximos de recursos não ficam negativos");
assert.equal(attributeEdit.ids.skillsBody.children[9].children[1].children[0].children[1].textContent, "101d20 ↓", "−100 rola 101 dados e usa o pior");
const presenceMarker = editWheel.children[3];
presenceMarker.children[1].click();
presenceMarker.children[2].value = "100";
presenceMarker.children[2].handlers.change();
assert.equal(attributeEdit.ids.esforcoMaximum.textContent, "103");
assert.equal(attributeEdit.ids.ritualDifficulty.textContent, "111");
presenceMarker.children[1].click();
presenceMarker.children[2].value = "";
presenceMarker.children[2].handlers.change();
assert.equal(presenceMarker.children[0].textContent, "100", "campo vazio não apaga o atributo");
forceMarker.children[1].click();
forceMarker.children[2].value = "44";
forceMarker.children[2].handlers.keydown({ key: "Escape", preventDefault() {} });
assert.equal(forceMarker.children[0].textContent, "-3", "Escape cancela a digitação");
editButton.click();
assert.equal(editButton.getAttribute("aria-pressed"), "false");
assert.equal(forceMarker.children[1].disabled, false);
assert.equal(attributeEdit.ids.attributeEditHint.hidden, true);
const attributeReload = openCharacter(attributeEdit.saved().characters[0]);
assert.equal(attributeReload.ids.attributeWheelValues.children[1].children[0].textContent, "-3");
assert.equal(attributeReload.ids.attributeWheelValues.children[4].children[0].textContent, "-100");
assert.equal(ids.characterHistory.textContent, "Busca pistas do passado.");
assert.equal(ids.characterObjective.textContent, "Encontrar a verdade.");
assert.match(ids.equippedWeapon.children[0].textContent, /Nenhuma arma equipada/);
assert.equal(ids.abilitiesList.children.length, 3, "origem e habilidades iniciais da classe aparecem sem cadastro manual");
assert.deepEqual(ids.abilitiesList.children.map((row) => row.children[0].textContent), ["Vislumbres do Passado", "Eclético", "Perito"]);
const originAbilityRow = ids.abilitiesList.children[0];
const originToggle = originAbilityRow.children[0];
const originDetails = originAbilityRow.children[1];
assert.equal(originToggle.tag, "button");
assert.equal(originToggle.textContent, "Vislumbres do Passado", "a linha fechada mostra apenas o nome");
assert.equal(originToggle.getAttribute("aria-expanded"), "false");
assert.equal(originToggle.getAttribute("aria-controls"), originDetails.id);
assert.equal(originDetails.hidden, true);
originToggle.click();
assert.equal(originToggle.getAttribute("aria-expanded"), "true");
assert.equal(originDetails.hidden, false);
assert.equal(originDetails.children[0].textContent, "Habilidade de origem · Amnésico");
assert.equal(originDetails.children[1].textContent, require("../origins.js").find((origin) => origin.id === "amnesico").effect);
assert.equal(originDetails.children.some((child) => child.tag === "button"), false, "a habilidade da origem não pode ser removida");
originToggle.click();
assert.equal(originDetails.hidden, true, "clicar novamente fecha a habilidade");
assert.equal(saved().characters[0].sheet, undefined, "mostrar a habilidade não altera o formato da ficha salva");
assert.equal(sheetTabs.length, 8);
assert.equal(sheetTabs[0].getAttribute("aria-selected"), "true");
assert.equal(ids["panel-atributos"].hidden, true);
sheetTabs[7].click();
assert.equal(ids["panel-informacoes"].hidden, true);
assert.equal(ids["panel-descricoes"].hidden, false);
sheetTabs[7].handlers.keydown({ key: "ArrowRight", preventDefault() {} });
assert.equal(sheetTabs[0].getAttribute("aria-selected"), "true", "seta à direita volta da última aba à primeira");
sheetTabs[0].handlers.keydown({ key: "ArrowRight", preventDefault() {} });
assert.equal(sheetTabs[1].getAttribute("aria-selected"), "true", "setas seguem a ordem visual das abas");
assert.equal(sheetTabs[1].focused, true);
assert.equal(ids["panel-atributos"].hidden, false);
const desktopView = openCharacter(character, { desktopViewport: true });
assert.equal(desktopView.ids.sheetTabs.getAttribute("role"), "navigation");
for (const id of ["atributos", "pericias"]) {
    assert.equal(desktopView.ids[`panel-${id}`].hidden, false, `${id} aparece no painel desktop`);
    assert.equal(desktopView.ids[`panel-${id}`].getAttribute("role"), "region");
}
assert.equal(desktopView.ids["panel-informacoes"].hidden, true, "informações ficam em uma aba, não em mais um cartão fixo");
assert.equal(desktopView.ids["panel-combate"].hidden, true);
assert.equal(desktopView.ids["panel-inventario"].hidden, true);
desktopView.sheetTabs[4].click();
assert.equal(desktopView.ids["panel-inventario"].hidden, false);
assert.equal(desktopView.ids["panel-combate"].hidden, true);
assert.equal(desktopView.ids["panel-pericias"].hidden, true, "a área direita mostra uma seção por vez");
assert.equal(desktopView.ids["panel-atributos"].hidden, false, "a roda permanece visível ao trocar a seção direita");
assert.equal(desktopView.sheetTabs[4].getAttribute("aria-pressed"), "true");
desktopView.viewport.matches = false;
desktopView.viewport.onChange();
assert.equal(desktopView.ids.sheetTabs.getAttribute("role"), "tablist");
assert.equal(desktopView.ids["panel-informacoes"].hidden, false, "voltar ao celular restaura a aba inicial");
assert.equal(desktopView.ids["panel-pericias"].hidden, true);
assert.equal(desktopView.sheetTabs[0].getAttribute("aria-selected"), "true");
descriptionTabs[1].click();
assert.equal(ids["subpanel-textos"].hidden, true);
assert.equal(ids["subpanel-anotacoes"].hidden, false);

shapeButtons[0].click();
assert.equal(ids.noteCanvas.children.length, 1);
const note = ids.noteCanvas.children[0];
note.children[2].value = "Ligação com o culto";
note.children[2].handlers.input();
note.children[0].handlers.keydown({ key: "ArrowRight", shiftKey: false, preventDefault() {} });
assert.equal(note.style.left, "45px");
shapeButtons[2].click();
assert.equal(ids.noteCanvas.children[1].dataset.shape, "triangle");
const secondNote = ids.noteCanvas.children[1];
note.children[3].click();
assert.equal(ids.connectNotes.getAttribute("aria-pressed"), "true");
assert.equal(note.dataset.connectionSource, "true");
secondNote.children[3].click();
assert.equal(ids.noteConnectionLayer.children.length, 1, "duas ideias podem ser ligadas");
assert.equal(ids.noteConnectionList.children.length, 1);
assert.equal(ids.undoNoteConnection.disabled, false);
assert.equal(ids.noteConnectionLayer.children[0].children[1].textContent, "Relacionada");
const relationSelect = ids.noteConnectionList.children[0].children[1];
relationSelect.value = "contradicts";
relationSelect.handlers.change();
assert.equal(ids.noteConnectionLayer.children[0].getAttribute("data-relation"), "contradicts");
assert.equal(ids.noteConnectionLayer.children[0].children[1].textContent, "Contradiz");
ids.undoNoteConnection.click();
assert.equal(ids.noteConnectionLayer.children.length, 0, "a última ligação pode ser desfeita");
note.children[3].click();
secondNote.children[3].click();
ids.noteColor.value = "red";
ids.noteColor.handlers.change();
assert.equal(secondNote.dataset.color, "red", "a ideia selecionada pode receber outra cor");
ids.noteKind.value = "clue";
ids.noteKind.handlers.change();
assert.equal(secondNote.dataset.kind, "clue");
assert.equal(secondNote.children[4].textContent, "Pista");
ids.noteSearch.value = "culto";
ids.noteSearch.handlers.input();
assert.equal(note.dataset.searchHidden, "false");
assert.equal(secondNote.dataset.searchHidden, "true");
ids.noteSearch.value = "";
ids.noteSearch.handlers.input();
ids.noteZoomOut.click();
assert.equal(ids.noteZoomValue.textContent, "90%");
assert.equal(saved().characters[0].sheet.mindMapView.zoom, 0.9);
assert.equal(saved().characters[0].sheet.notes[0].text, "Ligação com o culto");
assert.equal(saved().characters[0].sheet.notes[0].x, 45);
assert.equal(saved().characters[0].sheet.noteConnections.length, 1);
ids.toggleNotesFullscreen.click();
assert.equal(ids.noteWorkspace.classList.contains("is-expanded"), true);

const catalogView = openCharacter(JSON.parse(JSON.stringify(character)));
const catalog = catalogView.context.window.REAL_EQUIPMENT_CATALOG;
const knife = catalog.find((item) => item.id === "faca");
const catalogRow = (view, name) => view.ids.catalogList.children.find((row) => row.children[0]?.children[0]?.textContent === name);
const catalogCategoryButton = (view, name) => view.ids.catalogCategories.children.find((button) => button.textContent === name);
const catalogFact = (details, label) => {
    const facts = details.children.find((child) => child.tag === "dl");
    return facts?.children.find((pair) => pair.children[0].textContent === label)?.children[1].textContent;
};
assert.equal(catalog.length, 106, "as 34 armas, seis munições, três proteções, 34 itens gerais e 29 itens amaldiçoados estão no catálogo");
assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length, "cada item tem um identificador único");
assert.equal(catalogView.context.window.REAL_WEAPON_CATALOG.length, 34, "a lista de armas não inclui munições");
assert.equal(catalogView.context.window.REAL_EQUIPMENT_COLLECTIONS[0].name, "Ordem Paranormal");
assert.equal(catalogView.context.window.REAL_EQUIPMENT_COLLECTIONS[0].cover, null, "a capa pode ser adicionada depois");
assert.equal(knife.group, "Ordem Paranormal");
assert.equal(knife.inventoryCategory, "armas");
assert.equal(knife.name, "Faca");
assert.equal(knife.weaponClass, "Armas Simples");
assert.equal(knife.weaponStyle, "Corpo a Corpo");
assert.equal(knife.weaponTraits, "Leve");
assert.equal(knife.category, 0);
assert.equal(knife.range, "curto");
assert.equal(knife.damage, "1d4");
assert.equal(knife.damageType, "corte");
assert.equal(knife.critical, 19);
assert.equal(knife.space, 1);
assert.equal(knife.description, "Uma lâmina longa e afiada, como uma navalha, uma faca de churrasco ou uma faca militar (facas de cozinha pequena causam apenas 1d3 pontos de dano). É uma arma ágil e pode ser arremessada.");
catalogView.addEntryButtons[0].click();
assert.equal(catalogView.ids.entryDialog.open, true, "Criar item abre o formulário manual");
assert.equal(catalogView.ids.entryDialogTitle.textContent, "Criar item");
assert.equal(catalogView.ids.entrySubmit.textContent, "Criar item");
assert.equal(catalogView.ids.catalogDialog.open, undefined, "o catálogo permanece separado");
catalogView.ids.cancelEntry.click();
catalogView.ids.openCatalog.click();
assert.equal(catalogView.ids.catalogDialog.open, true);
assert.equal(catalogView.ids.entryDialog.open, false);
assert.equal(catalogView.ids.catalogGroupTitle.textContent, "Armas · Ordem Paranormal");
assert.equal(catalogView.ids.catalogCollections.children.length, 1);
assert.equal(catalogView.ids.catalogCategories.children.length, 5);
assert.equal(catalogCategoryButton(catalogView, "Armas").getAttribute("aria-pressed"), "true");
assert.equal(catalogView.ids.catalogList.children.length, 34);
const collectionButton = catalogView.ids.catalogCollections.children[0];
assert.equal(collectionButton.tag, "button");
assert.equal(collectionButton.getAttribute("aria-label"), "Selecionar catálogo Ordem Paranormal");
assert.equal(collectionButton.getAttribute("aria-pressed"), "true");
assert.equal(collectionButton.children[0].textContent, "Capa em breve");
assert.equal(collectionButton.children[1].textContent, "Ordem Paranormal");
const knifeRow = catalogRow(catalogView, "Faca");
assert.equal(knifeRow.children[0].tag, "button");
assert.equal(knifeRow.children[0].children[0].textContent, "Faca");
assert.equal(knifeRow.children[0].children[1].textContent, "Dano: 1d4   ·   Crítico: 19");
assert.equal(knifeRow.children[0].getAttribute("aria-expanded"), "false");
assert.equal(knifeRow.children[1].hidden, true, "os detalhes começam fechados");
knifeRow.children[0].click();
assert.equal(knifeRow.children[0].getAttribute("aria-expanded"), "true");
assert.equal(knifeRow.children[1].hidden, false);
assert.equal(knifeRow.children[1].children[0].textContent, "Armas Simples · Corpo a Corpo · Leve");
assert.equal(catalogFact(knifeRow.children[1], "Categoria"), "0");
assert.equal(catalogFact(knifeRow.children[1], "Alcance"), "curto");
assert.equal(catalogFact(knifeRow.children[1], "Tipo"), "corte");
assert.equal(catalogFact(knifeRow.children[1], "Espaços"), "1");
assert.equal(knifeRow.children[1].children[2].textContent, knife.description);
assert.equal(knifeRow.children[1].children[3].getAttribute("aria-label"), "Adicionar Faca ao inventário");
knifeRow.children[0].click();
assert.equal(knifeRow.children[1].hidden, true, "o item pode ser fechado novamente");
catalogView.ids.closeCatalog.click();
assert.equal(catalogView.ids.catalogDialog.open, false);
catalogView.ids.openCatalog.click();
catalogRow(catalogView, "Faca").children[0].click();
catalogRow(catalogView, "Faca").children[1].children.at(-1).click();
assert.equal(catalogView.ids.catalogDialog.open, false);
const savedKnife = catalogView.saved().characters[0].sheet.inventario[0];
assert.equal(savedKnife.category, "armas");
assert.equal(savedKnife.catalogId, "faca");
assert.equal(savedKnife.group, "Ordem Paranormal");
assert.equal(savedKnife.weaponCategory, 0);
assert.equal(savedKnife.damage, "1d4");
assert.equal(savedKnife.damageType, "corte");
assert.equal(savedKnife.critical, 19);
assert.equal(savedKnife.space, 1);
assert.equal(savedKnife.weaponTraits, "Leve");
catalogView.ids.inventoryList.children[0].children[0].click();
const knifePanel = catalogView.ids.inventoryList.children[0].children[2];
assert.equal(knifePanel.children[0].textContent, "Armas · Ordem Paranormal");
assert.match(knifePanel.children[1].textContent, /Dano 1d4 de corte/);
assert.equal(knifePanel.children[2].textContent, knife.description);
catalogView.ids.inventoryList.children[0].children[1].checked = true;
catalogView.ids.inventoryList.children[0].children[1].handlers.change();
assert.equal(catalogView.ids.equippedWeapon.children[0].textContent, "Faca");
assert.match(catalogView.ids.equippedWeapon.children[1].textContent, /Ordem Paranormal · Armas Simples · Corpo a Corpo · Leve · Categoria 0/);
const catalogReload = openCharacter(catalogView.saved().characters[0]);
assert.equal(catalogReload.ids.equippedWeapon.children[0].textContent, "Faca", "a Faca equipada permanece após recarregar");
assert.equal(catalogReload.saved().characters[0].sheet.inventario[0].damage, "1d4");
const newWeapons = [
    { id: "acha", name: "Acha", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos", category: 1, damage: "1d12", damageType: "corte", critical: "x3", space: 2, description: /machado grande e pesado/ },
    { id: "arco", name: "Arco", weaponClass: "Armas Simples", weaponStyle: "Arma de Disparo", hands: "Duas Mãos", category: 0, range: "médio", damage: "1d6", damageType: "perfuração", critical: "x3", space: 2, ammunition: "Flechas", description: /próprio para tiro ao alvo/ },
    { id: "arco-composto", name: "Arco Composto", weaponClass: "Armas Táticas", weaponStyle: "Arma de Disparo", hands: "Duas Mãos", category: 1, range: "médio", damage: "1d10", damageType: "perfuração", critical: "x3", space: 2, ammunition: "Flechas", description: /aplique seu valor de Força às rolagens de dano/ },
    { id: "balestra", name: "Balestra", weaponClass: "Armas Táticas", weaponStyle: "Arma de Disparo", hands: "Duas Mãos", category: 1, range: "médio", damage: "1d12", damageType: "perfuração", critical: 19, space: 2, ammunition: "Flechas", description: /ação de movimento para ser recarregada/ },
    { id: "bastao", name: "Bastão", weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 0, damage: "1d6/1d8", damageType: "impacto", critical: "x2", space: 1, description: /com uma mão \(dano 1d6\) ou com as duas \(dano 1d8\)/ },
    { id: "bazuca", name: "Bazuca", weaponClass: "Armas Pesadas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos", category: 3, range: "médio", damage: "10d8", damageType: "impacto", critical: "x2", space: 2, ammunition: "Foguete", description: /raio de 3m; esses seres/ },
    { id: "besta", name: "Besta", weaponClass: "Armas Simples", weaponStyle: "Arma de Disparo", hands: "Duas Mãos", category: 0, range: "médio", damage: "1d8", damageType: "perfuração", critical: 19, space: 2, ammunition: "Flechas", description: /arma da antiguidade/ },
    { id: "cajado", name: "Cajado", weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos", category: 0, damage: "1d6/1d6", damageType: "impacto", critical: "x2", space: 2, description: /Combater com Duas Armas/ },
    { id: "corrente", name: "Corrente", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 0, damage: "1d8", damageType: "impacto", critical: "x2", space: 1, description: /fornece \+2 em testes para desarmar e derrubar/ },
    { id: "espada", name: "Espada", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 1, damage: "1d8/1d10", damageType: "corte", critical: 19, space: 1, description: /com uma mão \(dano 1d8\) ou com as duas \(dano 1d10\)/ },
    { id: "espingarda", name: "Espingarda", weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos", category: 1, range: "curto", damage: "4d6", damageType: "balístico", critical: "x3", space: 2, ammunition: "Cartuchos", description: /metade do dano em alcance médio ou maior/ },
    { id: "florete", name: "Florete", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 1, damage: "1d6", damageType: "corte", critical: 18, space: 1, description: /usada por esgrimistas/ },
    { id: "fuzil-de-assalto", name: "Fuzil de Assalto", weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos", category: 2, range: "médio", damage: "2d10", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas", description: /arma automática/ },
    { id: "fuzil-de-caca", name: "Fuzil de Caça", weaponClass: "Armas Simples", weaponStyle: "Arma de Fogo", hands: "Duas Mãos", category: 1, range: "médio", damage: "2d8", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas", description: /fazendeiros, caçadores e atiradores esportistas/ },
    { id: "fuzil-de-precisao", name: "Fuzil de Precisão", weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos", category: 3, range: "longo", damage: "2d10", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas", description: /\+5 na margem de ameaça/ },
    { id: "gadanho", name: "Gadanho", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos", category: 1, damage: "2d4", damageType: "corte", critical: "x4", space: 2, description: /também pode ceifar vidas/ },
    { id: "katana", name: "Katana", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos", category: 1, damage: "1d10", damageType: "corte", critical: 19, space: 2, description: /veterano em Luta pode usá-la como uma arma de uma mão/ },
    { id: "lanca", name: "Lança", weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 0, range: "curto", damage: "1d6", damageType: "perfuração", critical: "x2", space: 1, description: /Pode ser arremessada/ },
    { id: "lanca-chamas", name: "Lança-chamas", weaponClass: "Armas Pesadas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos", category: 3, range: "curto", damage: "6d6", damageType: "fogo", critical: "x2", space: 2, ammunition: "Combustível", description: /seres atingidos ficam em chamas/ },
    { id: "maca", name: "Maça", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 1, damage: "2d4", damageType: "impacto", critical: "x2", space: 1, description: /cabeça metálica cheia de protuberâncias/ },
    { id: "machadinha", name: "Machadinha", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve", category: 0, range: "curto", damage: "1d6", damageType: "corte", critical: "x3", space: 1, description: /canteiros de obras e fazendas.*Pode ser arremessada/ },
    { id: "machado", name: "Machado", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 1, damage: "1d8", damageType: "corte", critical: "x3", space: 1, description: /lenhadores e bombeiros/ },
    { id: "machete", name: "Machete", weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", hands: "Uma Mão", category: 0, damage: "1d6", damageType: "corte", critical: 19, space: 1, description: /ferramenta para abrir trilhas/ },
    { id: "marreta", name: "Marreta", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos", category: 1, damage: "3d4", damageType: "impacto", critical: "x2", space: 2, description: /outras ferramentas de construção civil, como picaretas/ },
    { id: "martelo", name: "Martelo", weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve", category: 0, damage: "1d6", damageType: "impacto", critical: "x2", space: 1, description: /na falta de opções melhores/ },
    { id: "metralhadora", name: "Metralhadora", weaponClass: "Armas Pesadas", weaponStyle: "Arma de Fogo", hands: "Duas Mãos", category: 2, range: "médio", damage: "2d12", damageType: "balístico", critical: "19/x3", space: 2, ammunition: "Balas Longas", description: /Força 4 ou maior.*sofre -5 em seus ataques.*arma automática/ },
    { id: "montante", name: "Montante", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos", category: 1, damage: "2d6", damageType: "corte", critical: 19, space: 2, description: /espada de 1,5m de comprimento/ },
    { id: "motosserra", name: "Motosserra", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", hands: "Duas Mãos", category: 1, damage: "3d6", damageType: "corte", critical: "x2", space: 2, description: /rolar um 6.*-1d20.*ação de movimento/ },
    { id: "nunchaku", name: "Nunchaku", weaponClass: "Armas Táticas", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve", category: 0, damage: "1d8", damageType: "impacto", critical: "x2", space: 1, description: /bastões curtos de madeira ligados por uma corrente/ },
    { id: "pistola", name: "Pistola", weaponClass: "Armas Simples", weaponStyle: "Arma de Fogo", weaponTraits: "Leve", category: 1, range: "curto", damage: "1d12", damageType: "balístico", critical: 18, space: 1, ammunition: "Balas Curtas", description: /facilmente recarregável/ },
    { id: "punhal", name: "Punhal", weaponClass: "Armas Simples", weaponStyle: "Corpo a Corpo", weaponTraits: "Leve", category: 0, damage: "1d4", damageType: "perfuração", critical: "x3", space: 1, description: /usada por cultistas em seus rituais/ },
    { id: "revolver", name: "Revólver", weaponClass: "Armas Simples", weaponStyle: "Arma de Fogo", weaponTraits: "Leve", category: 1, range: "curto", damage: "2d6", damageType: "balístico", critical: "19/x3", space: 1, ammunition: "Balas Curtas", description: /uma das mais confiáveis/ },
    { id: "submetralhadora", name: "Submetralhadora", weaponClass: "Armas Táticas", weaponStyle: "Arma de Fogo", hands: "Uma Mão", category: 1, range: "curto", damage: "2d6", damageType: "balístico", critical: "19/x3", space: 1, ammunition: "Balas Curtas", description: /empunhada com apenas uma mão/ }
];
const expandedCatalogView = openCharacter(JSON.parse(JSON.stringify(character)));
for (const expected of newWeapons) {
    const item = catalog.find((entry) => entry.id === expected.id);
    assert.ok(item, `${expected.name} existe no catálogo`);
    for (const field of ["name", "weaponClass", "weaponStyle", "hands", "weaponTraits", "category", "range", "damage", "damageType", "critical", "space", "ammunition"]) {
        assert.equal(item[field], expected[field], `${expected.name}: ${field}`);
    }
    assert.equal(item.group, "Ordem Paranormal");
    assert.match(item.description, expected.description);
    expandedCatalogView.ids.openCatalog.click();
    const row = catalogRow(expandedCatalogView, expected.name);
    assert.ok(row, `${expected.name} aparece na lista`);
    assert.equal(row.children[1].hidden, true);
    row.children[0].click();
    const details = row.children[1];
    assert.equal(details.hidden, false);
    assert.equal(row.children[0].children[1].textContent, `Dano: ${expected.damage}   ·   Crítico: ${expected.critical}`);
    assert.equal(details.children[0].textContent, [expected.weaponClass, expected.weaponStyle, expected.hands, expected.weaponTraits].filter(Boolean).join(" · "));
    assert.equal(catalogFact(details, "Categoria"), ["0", "I", "II", "III"][expected.category]);
    assert.equal(catalogFact(details, "Alcance"), expected.range);
    assert.equal(catalogFact(details, "Tipo"), expected.damageType);
    assert.equal(catalogFact(details, "Espaços"), String(expected.space));
    assert.equal(catalogFact(details, "Munição"), expected.ammunition);
    assert.equal(details.children[2].textContent, item.description);
    details.children.at(-1).click();
    assert.equal(expandedCatalogView.ids.catalogDialog.open, false);
    const savedWeapon = expandedCatalogView.saved().characters[0].sheet.inventario.find((entry) => entry.catalogId === expected.id);
    assert.ok(savedWeapon, `${expected.name} foi salvo`);
    for (const field of ["range", "weaponClass", "weaponStyle", "hands", "weaponTraits", "damage", "damageType", "critical", "space", "ammunition"]) {
        assert.equal(savedWeapon[field], expected[field], `${expected.name}: ${field} salvo`);
    }
    assert.equal(savedWeapon.weaponCategory, expected.category);
}
const assaultRow = expandedCatalogView.ids.inventoryList.children.find((row) => row.children[0]?.textContent === "Fuzil de Assalto");
assaultRow.children[1].checked = true;
assaultRow.children[1].handlers.change();
assert.match(expandedCatalogView.ids.equippedWeapon.children[1].textContent, /Crítico 19\/x3/);
const bazucaRow = expandedCatalogView.ids.inventoryList.children.find((row) => row.children[0]?.textContent === "Bazuca");
bazucaRow.children[1].checked = true;
bazucaRow.children[1].handlers.change();
assert.match(expandedCatalogView.ids.equippedWeapon.children[1].textContent, /Categoria III/);
assert.match(expandedCatalogView.ids.equippedWeapon.children[1].textContent, /Munição Foguete/);
assert.equal(openCharacter(expandedCatalogView.saved().characters[0]).ids.equippedWeapon.children[0].textContent, "Bazuca");
const ammunitionCases = [
    { id: "balas-curtas", name: "Balas Curtas", category: 0, description: "Munição básica, usada em pistolas, revólveres e submetralhadoras. Um pacote de balas curtas dura duas cenas." },
    { id: "balas-longas", name: "Balas Longas", category: 1, description: "Maior e mais potente, esta munição é usada em fuzis e metralhadoras. Um pacote de balas longas dura uma cena." },
    { id: "cartuchos", name: "Cartuchos", category: 1, description: "Usados em espingardas, esses cartuchos são carregados com esferas de chumbo. Um pacote de cartuchos dura uma cena." },
    { id: "combustivel", name: "Combustível", category: 1, description: "Um tanque de combustível para lança-chamas. Dura uma cena." },
    { id: "flechas", name: "Flechas", category: 0, description: "Usadas em arcos e bestas, flechas podem ser reaproveitadas após cada combate. Por isso, um pacote de flechas dura uma missão inteira." },
    { id: "foguete", name: "Foguete", category: 1, description: "Disparado por bazucas. Ao contrário de outras munições, cada foguete dura um único disparo, não uma cena. Para fazer vários ataques, você precisará carregar vários foguetes." }
];
const ammunitionView = openCharacter(JSON.parse(JSON.stringify(character)));
ammunitionView.ids.openCatalog.click();
catalogCategoryButton(ammunitionView, "Munições").click();
assert.equal(ammunitionView.ids.catalogGroupTitle.textContent, "Munições · Ordem Paranormal");
assert.equal(catalogCategoryButton(ammunitionView, "Munições").getAttribute("aria-pressed"), "true");
assert.equal(ammunitionView.ids.catalogList.children.length, 6);
assert.equal(catalogRow(ammunitionView, "Faca"), undefined, "armas não aparecem na aba de munições");
for (const expected of ammunitionCases) {
    const item = catalog.find((entry) => entry.id === expected.id);
    assert.ok(item, `${expected.name} existe no catálogo`);
    assert.equal(item.name, expected.name);
    assert.equal(item.group, "Ordem Paranormal");
    assert.equal(item.inventoryCategory, "municoes");
    assert.equal(item.category, expected.category);
    assert.equal(item.space, 1);
    assert.equal(item.description, expected.description);
    const row = catalogRow(ammunitionView, expected.name);
    assert.ok(row, `${expected.name} aparece na aba de munições`);
    assert.equal(row.children[0].children[1].textContent, `Categoria: ${expected.category === 0 ? "0" : "I"}   ·   Espaços: 1`);
    row.children[0].click();
    assert.equal(row.children[1].children[0].textContent, "Munições");
    assert.equal(row.children[1].children[1].textContent, expected.description);
    row.children[1].children.at(-1).click();
    assert.equal(ammunitionView.ids.catalogDialog.open, false);
    const savedAmmunition = ammunitionView.saved().characters[0].sheet.inventario.find((entry) => entry.catalogId === expected.id);
    assert.equal(savedAmmunition.category, "municoes");
    assert.equal(savedAmmunition.itemCategory, expected.category);
    assert.equal(savedAmmunition.space, 1);
    assert.equal(savedAmmunition.group, "Ordem Paranormal");
    assert.equal(savedAmmunition.description, expected.description);
    assert.equal(savedAmmunition.weaponCategory, undefined);
    assert.equal(savedAmmunition.damage, undefined);
    const inventoryRow = ammunitionView.ids.inventoryList.children.find((entry) => entry.children[0]?.textContent === expected.name);
    assert.equal(inventoryRow.children.length, 2, "munições não têm controle de equipar arma");
    inventoryRow.children[0].click();
    assert.equal(inventoryRow.children[1].children[0].textContent, "Munições · Ordem Paranormal");
    assert.equal(inventoryRow.children[1].children[1].textContent, `Categoria ${expected.category === 0 ? "0" : "I"} · Espaço 1`);
    assert.equal(inventoryRow.children[1].children[2].textContent, expected.description);
    ammunitionView.ids.openCatalog.click();
    catalogCategoryButton(ammunitionView, "Munições").click();
}
assert.equal(ammunitionView.ids.inventoryList.children.length, 6);
ammunitionView.inventoryFilters[2].click();
assert.equal(ammunitionView.ids.inventoryList.children[0].className, "entry-list__empty", "o filtro de armas não mostra munições");
ammunitionView.inventoryFilters[3].click();
assert.equal(ammunitionView.ids.inventoryList.children.length, 6, "o filtro de munições mostra os seis pacotes");
assert.equal(openCharacter(ammunitionView.saved().characters[0]).saved().characters[0].sheet.inventario.length, 6, "as munições permanecem após recarregar");
catalogCategoryButton(ammunitionView, "Itens amaldiçoados").click();
assert.equal(ammunitionView.ids.catalogList.children.length, 29);
catalogCategoryButton(ammunitionView, "Munições").click();
assert.equal(ammunitionView.ids.catalogList.children.length, 6);
const protectionCases = [
    { id: "escudo", name: "Escudo", defense: 2, category: 1, space: 2, description: "Um escudo medieval ou moderno, como aqueles usados por tropas de choque. Para efeitos de proficiência, conta como proteção pesada. Precisa ser empunhado em uma mão e fornece Defesa +2." },
    { id: "protecao-leve", name: "Proteção Leve", defense: 5, category: 1, space: 2, description: "Jaqueta de couro pesada ou um colete de kevlar. Essa proteção é tipicamente usada por seguranças e policiais." },
    { id: "protecao-pesada", name: "Proteção Pesada", defense: 10, category: 2, space: 5, description: "Equipamento usado por forças especiais da polícia e pelo exército. Consiste de capacete, ombreiras, joelheiras e caneleiras, além de um colete com várias camadas de kevlar. Fornece resistência a balístico, corte, impacto e perfuração 2. No entanto, por ser desconfortável e volumosa, impõe -5 em testes de perícias que sofrem penalidade de carga." }
];
const protectionView = openCharacter(JSON.parse(JSON.stringify(character)));
protectionView.ids.openCatalog.click();
catalogCategoryButton(protectionView, "Proteção").click();
assert.equal(protectionView.ids.catalogGroupTitle.textContent, "Proteção · Ordem Paranormal");
assert.equal(catalogCategoryButton(protectionView, "Proteção").getAttribute("aria-pressed"), "true");
assert.equal(protectionView.ids.catalogList.children.length, 3);
assert.equal(catalogRow(protectionView, "Faca"), undefined, "armas não aparecem na aba de proteção");
for (const expected of protectionCases) {
    const item = catalog.find((entry) => entry.id === expected.id);
    assert.ok(item, `${expected.name} existe no catálogo`);
    for (const field of ["name", "defense", "category", "space", "description"]) {
        assert.equal(item[field], expected[field], `${expected.name}: ${field}`);
    }
    assert.equal(item.group, "Ordem Paranormal");
    assert.equal(item.inventoryCategory, "protecao");
    const row = catalogRow(protectionView, expected.name);
    assert.ok(row, `${expected.name} aparece na aba de proteção`);
    assert.equal(row.children[0].children[1].textContent, `Defesa: +${expected.defense}`);
    row.children[0].click();
    assert.equal(catalogFact(row.children[1], "Categoria"), ["0", "I", "II"][expected.category]);
    assert.equal(catalogFact(row.children[1], "Espaços"), String(expected.space));
    assert.equal(row.children[1].children[1].textContent, expected.description);
    row.children[1].children.at(-1).click();
    assert.equal(protectionView.ids.catalogDialog.open, false);
    const savedProtection = protectionView.saved().characters[0].sheet.inventario.find((entry) => entry.catalogId === expected.id);
    assert.equal(savedProtection.category, "protecao");
    assert.equal(savedProtection.defense, expected.defense);
    assert.equal(savedProtection.itemCategory, expected.category);
    assert.equal(savedProtection.space, expected.space);
    assert.equal(savedProtection.group, "Ordem Paranormal");
    assert.equal(savedProtection.description, expected.description);
    assert.equal(savedProtection.weaponCategory, undefined);
    assert.equal(savedProtection.damage, undefined);
    const inventoryRow = protectionView.ids.inventoryList.children.find((entry) => entry.children[0]?.textContent === expected.name);
    assert.equal(inventoryRow.children.length, 3, "proteções têm seu próprio controle de equipamento");
    inventoryRow.children[0].click();
    assert.equal(inventoryRow.children[2].children[0].textContent, "Proteção · Ordem Paranormal");
    assert.equal(inventoryRow.children[2].children[1].textContent, `Defesa +${expected.defense} · Categoria ${["0", "I", "II"][expected.category]} · Espaços ${expected.space}`);
    assert.equal(inventoryRow.children[2].children[2].textContent, expected.description);
    protectionView.ids.openCatalog.click();
    catalogCategoryButton(protectionView, "Proteção").click();
}
assert.equal(protectionView.ids.inventoryList.children.length, 3);
protectionView.inventoryFilters[2].click();
assert.equal(protectionView.ids.inventoryList.children[0].className, "entry-list__empty", "o filtro de armas não mostra proteções");
protectionView.inventoryFilters[4].click();
assert.equal(protectionView.ids.inventoryList.children.length, 3, "o filtro de proteção mostra os três itens");
assert.equal(openCharacter(protectionView.saved().characters[0]).saved().characters[0].sheet.inventario.length, 3, "as proteções permanecem após recarregar");
const generalCases = [
    { id: "algemas", name: "Algemas", itemType: "Itens Operacionais", category: 0, space: 1, description: /Acrobacia contra DT 30/ },
    { id: "amarras-de-elemento", name: "Amarras de (Elemento)", itemType: "Itens Paranormais", category: 2, space: 1, description: /Armadilha\..*\n\nLaçar\./s },
    { id: "arpeu", name: "Arpéu", itemType: "Itens Operacionais", category: 0, space: 1, description: /Pontaria \(DT 15\).*Atletismo/ },
    { id: "bandoleira", name: "Bandoleira", itemType: "Itens Operacionais", category: 1, space: 1, description: /sacar ou guardar um item.*ação livre/ },
    { id: "binoculos", name: "Binóculos", itemType: "Itens Operacionais", category: 0, space: 1, description: /\+5 em testes de Percepção/ },
    { id: "bloqueador-de-sinal", name: "Bloqueador de Sinal", itemType: "Itens Operacionais", category: 1, space: 1, description: /alcance médio se conecte/ },
    { id: "camera-de-aura-paranormal", name: "Câmera de Aura Paranormal", itemType: "Itens Paranormais", category: 2, space: 1, description: /auras paranormais.*cor associada ao elemento/ },
    { id: "cicatrizante", name: "Cicatrizante", itemType: "Itens Operacionais", category: 1, space: 1, description: /curar 2d8\+2 PV/ },
    { id: "componentes-ritualisticos-de-elemento", name: "Componentes Ritualísticos de (Elemento)", itemType: "Itens Paranormais", category: 0, space: 1, description: /Energia:.*\n\nSangue:.*\n\nMorte:.*\n\nConhecimento:/s },
    { id: "corda", name: "Corda", itemType: "Itens Operacionais", category: 0, space: 1, description: /10 metros de corda resistente/ },
    { id: "emissor-de-pulsos-paranormais", name: "Emissor de Pulsos Paranormais", itemType: "Itens Paranormais", category: 2, space: 1, description: /atrai criaturas do mesmo elemento e afasta criaturas do elemento oposto/ },
    { id: "equipamento-de-sobrevivencia", name: "Equipamento de Sobrevivência", itemType: "Itens Operacionais", category: 0, space: 2, description: /testes de Sobrevivência.*sem treinamento/ },
    { id: "escuta-de-ruidos-paranormais", name: "Escuta de Ruídos Paranormais", itemType: "Itens Paranormais", category: 2, space: 1, description: /24 horas.*\+5 em testes de Ocultismo/ }
];
const generalView = openCharacter(JSON.parse(JSON.stringify(character)));
generalView.ids.openCatalog.click();
catalogCategoryButton(generalView, "Geral").click();
assert.equal(generalView.ids.catalogGroupTitle.textContent, "Geral · Ordem Paranormal");
assert.equal(catalogCategoryButton(generalView, "Geral").getAttribute("aria-pressed"), "true");
assert.equal(generalView.ids.catalogList.children.length, 34);
assert.equal(catalog.find((item) => item.id === "mochila-militar").space, -2, "a mochila preserva os espaços negativos da referência");
assert.equal(catalogRow(generalView, "Faca"), undefined, "armas não aparecem na aba geral");
for (const item of catalog.filter((entry) => entry.inventoryCategory === "geral")) {
    const expected = generalCases.find((entry) => entry.id === item.id) || item;
    assert.ok(item, `${expected.name} existe no catálogo`);
    for (const field of ["name", "itemType", "category", "space"]) {
        assert.equal(item[field], expected[field], `${expected.name}: ${field}`);
    }
    assert.equal(item.group, "Ordem Paranormal");
    assert.equal(item.inventoryCategory, "geral");
    if (expected.description instanceof RegExp) assert.match(item.description, expected.description);
    else assert.ok(item.description.trim(), `${item.name} tem uma descrição`);
    const row = catalogRow(generalView, expected.name);
    assert.ok(row, `${expected.name} aparece na aba geral`);
    assert.equal(row.children[0].children[1].textContent, `Categoria: ${["0", "I", "II"][expected.category]}   ·   Espaços: ${expected.space}`);
    row.children[0].click();
    assert.equal(row.children[1].children[0].textContent, expected.itemType);
    assert.equal(row.children[1].children[1].textContent, item.description);
    row.children[1].children.at(-1).click();
    assert.equal(generalView.ids.catalogDialog.open, false);
    const savedItem = generalView.saved().characters[0].sheet.inventario.find((entry) => entry.catalogId === expected.id);
    assert.equal(savedItem.category, "geral");
    assert.equal(savedItem.itemType, expected.itemType);
    assert.equal(savedItem.itemCategory, expected.category);
    assert.equal(savedItem.space, expected.space);
    assert.equal(savedItem.group, "Ordem Paranormal");
    assert.equal(savedItem.description, item.description);
    const inventoryRow = generalView.ids.inventoryList.children.find((entry) => entry.children[0]?.textContent === expected.name);
    assert.equal(inventoryRow.children.length, 2, "itens gerais não têm controle de equipar arma");
    inventoryRow.children[0].click();
    assert.equal(inventoryRow.children[1].children[0].textContent, "Geral · Ordem Paranormal");
    assert.equal(inventoryRow.children[1].children[1].textContent, `${expected.itemType} · Categoria ${["0", "I", "II"][expected.category]} · Espaços ${expected.space}`);
    assert.equal(inventoryRow.children[1].children[2].textContent, item.description);
    generalView.ids.openCatalog.click();
    catalogCategoryButton(generalView, "Geral").click();
}
assert.equal(generalView.ids.inventoryList.children.length, 34);
generalView.inventoryFilters[2].click();
assert.equal(generalView.ids.inventoryList.children[0].className, "entry-list__empty", "o filtro de armas não mostra itens gerais");
generalView.inventoryFilters[5].click();
assert.equal(generalView.ids.inventoryList.children.length, 34, "o filtro geral mostra os 34 itens");
const reloadedGeneralItems = openCharacter(generalView.saved().characters[0]).saved().characters[0].sheet.inventario;
assert.equal(reloadedGeneralItems.length, 34, "os itens gerais permanecem após recarregar");
assert.equal(reloadedGeneralItems.find((item) => item.catalogId === "mochila-militar").space, -2, "os espaços negativos permanecem após salvar e recarregar");
const cursedItems = catalog.filter((item) => item.inventoryCategory === "amaldicoados");
const cursedView = openCharacter(JSON.parse(JSON.stringify(character)));
cursedView.ids.openCatalog.click();
catalogCategoryButton(cursedView, "Itens amaldiçoados").click();
assert.equal(cursedView.ids.catalogGroupTitle.textContent, "Itens amaldiçoados · Ordem Paranormal");
assert.equal(catalogCategoryButton(cursedView, "Itens amaldiçoados").getAttribute("aria-pressed"), "true");
assert.equal(cursedView.ids.catalogList.children.length, 29);
assert.equal(cursedItems.find((item) => item.id === "jaqueta-de-verissimo").category, 4);
assert.equal(cursedItems.find((item) => item.id === "jaqueta-de-verissimo").element, "Medo");
assert.equal(cursedItems.find((item) => item.id === "dedo-decepado").element, "Varia");
for (const item of cursedItems) {
    const row = catalogRow(cursedView, item.name);
    assert.ok(row, `${item.name} aparece no catálogo de itens amaldiçoados`);
    assert.equal(row.children[0].children[1].textContent, `Categoria: ${["0", "I", "II", "III", "IV"][item.category]}   ·   Espaços: ${item.space}`);
    row.children[0].click();
    assert.equal(row.children[1].children[0].textContent, item.element);
    assert.equal(row.children[1].children[1].textContent, item.description);
    row.children[1].children.at(-1).click();
    assert.equal(cursedView.ids.catalogDialog.open, false);
    const savedItem = cursedView.saved().characters[0].sheet.inventario.find((entry) => entry.catalogId === item.id);
    assert.equal(savedItem.category, "amaldicoados");
    assert.equal(savedItem.element, item.element);
    assert.equal(savedItem.itemCategory, item.category);
    assert.equal(savedItem.space, item.space);
    assert.equal(savedItem.description, item.description);
    const inventoryRow = cursedView.ids.inventoryList.children.find((entry) => entry.children[0]?.textContent === item.name);
    assert.equal(inventoryRow.children.length, 2);
    assert.equal(inventoryRow.children[1].children[1].textContent, `${item.element} · Categoria ${["0", "I", "II", "III", "IV"][item.category]} · Espaços ${item.space}`);
    cursedView.ids.openCatalog.click();
    catalogCategoryButton(cursedView, "Itens amaldiçoados").click();
}
cursedView.inventoryFilters[2].click();
assert.equal(cursedView.ids.inventoryList.children[0].className, "entry-list__empty");
cursedView.inventoryFilters[6].click();
assert.equal(cursedView.ids.inventoryList.children.length, 29);
const cursedReload = openCharacter(cursedView.saved().characters[0]);
assert.equal(JSON.stringify(cursedReload.saved().characters[0].sheet.inventario), JSON.stringify(cursedView.saved().characters[0].sheet.inventario), "elementos e dados dos itens amaldiçoados permanecem após recarregar");
const multiCatalogView = openCharacter(JSON.parse(JSON.stringify(character)), {
    catalogCollections: [{ name: "Livro futuro", cover: null }],
    catalogItems: [
        { ...knife, id: "segunda-faca", name: "Segunda faca" },
        { ...knife, id: "outro-item", group: "Outro livro", name: "Outro item" }
    ]
});
multiCatalogView.ids.openCatalog.click();
assert.equal(multiCatalogView.ids.catalogCollections.children.length, 3, "novas coleções aparecem ao lado da primeira");
assert.equal(multiCatalogView.ids.catalogList.children.length, 35);
catalogRow(multiCatalogView, "Faca").children[0].click();
catalogRow(multiCatalogView, "Segunda faca").children[0].click();
assert.equal(catalogRow(multiCatalogView, "Faca").children[1].hidden, true, "abrir outro item fecha o anterior");
assert.equal(catalogRow(multiCatalogView, "Segunda faca").children[1].hidden, false);
multiCatalogView.ids.catalogCollections.children[1].click();
assert.equal(multiCatalogView.ids.catalogCollections.children[0].getAttribute("aria-pressed"), "false");
assert.equal(multiCatalogView.ids.catalogCollections.children[1].getAttribute("aria-pressed"), "true");
assert.equal(multiCatalogView.ids.catalogGroupTitle.textContent, "Armas · Livro futuro");
assert.equal(multiCatalogView.ids.catalogList.children[0].textContent, "Nenhum item nesta categoria ainda.");
multiCatalogView.ids.catalogCollections.children[2].click();
assert.equal(multiCatalogView.ids.catalogGroupTitle.textContent, "Armas · Outro livro");
assert.equal(multiCatalogView.ids.catalogList.children[0].children[0].children[0].textContent, "Outro item");

addEntryButtons[1].click();
assert.equal(ids.entryDialog.open, true);
ids.entryName.value = "Instinto de sobrevivência";
ids.entryDescription.value = "Uma habilidade anotada pelo jogador.";
ids.entryForm.handlers.submit({ preventDefault() {} });
assert.equal(ids.entryDialog.open, false);
assert.equal(saved().characters[0].sheet.habilidades[0].name, "Instinto de sobrevivência");
assert.equal(ids.abilitiesList.children.length, 4, "habilidade manual aparece junto da progressão automática");
assert.ok(listedAbility({ ids }, "Instinto de sobrevivência"));
const refreshedOrigin = ids.abilitiesList.children[0];
const manualAbility = listedAbility({ ids }, "Instinto de sobrevivência");
refreshedOrigin.children[0].click();
manualAbility.children[0].click();
assert.equal(refreshedOrigin.children[1].hidden, true, "abrir outra habilidade fecha a anterior");
assert.equal(refreshedOrigin.children[0].getAttribute("aria-expanded"), "false");
assert.equal(manualAbility.children[1].hidden, false);
assert.equal(manualAbility.children[1].children[0].textContent, "Habilidade criada");
assert.equal(manualAbility.children[1].children[1].textContent, "Uma habilidade anotada pelo jogador.");

inventoryFilters[2].click();
assert.equal(inventoryFilters[2].getAttribute("aria-pressed"), "true");
addEntryButtons[0].click();
ids.entryName.value = "Revólver";
ids.entryCategory.value = "armas";
ids.entryDescription.value = "Ainda sem dano definido.";
ids.entryForm.handlers.submit({ preventDefault() {} });
assert.equal(saved().characters[0].sheet.inventario[0].category, "armas");
assert.equal(saved().characters[0].sheet.inventario[0].catalogId, undefined, "item criado manualmente não herda dados do catálogo");
assert.equal(ids.inventoryList.children[0].tag, "article");
const weaponRow = ids.inventoryList.children[0];
assert.equal(weaponRow.children[0].textContent, "Revólver");
assert.equal(weaponRow.children[0].getAttribute("aria-expanded"), "false");
assert.equal(weaponRow.children[1].tag, "input");
assert.equal(weaponRow.children[1].type, "checkbox");
assert.equal(weaponRow.children[1].checked, false);
assert.equal(weaponRow.children[1].getAttribute("aria-label"), "Equipar Revólver");
assert.equal(weaponRow.children[2].hidden, true);
weaponRow.children[1].checked = true;
weaponRow.children[1].handlers.change();
assert.equal(saved().characters[0].sheet.equippedWeaponId, saved().characters[0].sheet.inventario[0].id);
assert.equal(ids.equippedWeapon.children[0].textContent, "Revólver");
assert.equal(ids.equippedWeapon.children[1].textContent, "Ainda sem dano definido.");
assert.equal(ids.inventoryList.children[0].children[2].hidden, true, "marcar a caixa não abre os detalhes");
assert.equal(ids.inventoryList.children[0].children[1].checked, true);
assert.equal(ids.inventoryList.children[0].children[1].getAttribute("aria-label"), "Desequipar Revólver");
ids.inventoryList.children[0].children[0].click();
assert.equal(ids.inventoryList.children[0].children[2].hidden, false);
assert.equal(ids.inventoryList.children[0].children[2].children[0].textContent, "Armas");
assert.equal(ids.inventoryList.children[0].children[2].children[1].textContent, "Ainda sem dano definido.");
assert.equal(ids.inventoryList.children[0].children[0].getAttribute("aria-controls"), ids.inventoryList.children[0].children[2].id);
assert.equal(ids.inventoryList.children[0].children[2].children.some((child) => child.className === "entry-item__equip"), false);
addEntryButtons[0].click();
ids.entryName.value = "Pistola";
ids.entryCategory.value = "armas";
ids.entryDescription.value = "Outra arma.";
ids.entryForm.handlers.submit({ preventDefault() {} });
const firstWeapon = ids.inventoryList.children[0];
const secondWeapon = ids.inventoryList.children[1];
firstWeapon.children[0].click();
secondWeapon.children[0].click();
assert.equal(firstWeapon.children[2].hidden, true, "abrir outro item fecha o anterior");
assert.equal(secondWeapon.children[2].hidden, false);
secondWeapon.children[1].checked = true;
secondWeapon.children[1].handlers.change();
assert.equal(ids.equippedWeapon.children[0].textContent, "Pistola", "equipar outra arma substitui a anterior");
assert.equal(saved().characters[0].sheet.equippedWeaponId, saved().characters[0].sheet.inventario[1].id);
assert.equal(ids.inventoryList.children[0].dataset.equipped, "false");
assert.equal(ids.inventoryList.children[1].dataset.equipped, "true");
assert.equal(ids.inventoryList.children[0].children[1].checked, false);
assert.equal(ids.inventoryList.children[1].children[1].checked, true);
inventoryFilters[4].click();
assert.equal(ids.inventoryList.children[0].className, "entry-list__empty");
inventoryFilters[2].click();
assert.equal(ids.inventoryList.children.length, 2, "o filtro de armas preserva os itens salvos");

addEntryButtons[2].click();
ids.entryName.value = "Ritual de teste";
ids.entryDescription.value = "Descrição do ritual.";
ids.entryForm.handlers.submit({ preventDefault() {} });
assert.equal(saved().characters[0].sheet.rituais[0].name, "Ritual de teste");
const ritualRow = ids.ritualsList.children[0];
assert.equal(ritualRow.children[0].textContent, "Ritual de teste");
assert.equal(ritualRow.children[1].hidden, true);
ritualRow.children[0].click();
assert.equal(ritualRow.children[1].children[0].textContent, "Ritual");
assert.equal(ritualRow.children[1].children[1].textContent, "Descrição do ritual.");
assert.equal(ritualRow.children[1].children[2].textContent, "Remover ritual");
assert.equal(saved().characters[0].attributes.agilidade, 4, "novos dados não alteram os atributos existentes");
const reloaded = openCharacter(saved().characters[0]);
assert.equal(reloaded.ids.noteCanvas.children.length, 2, "mapa mental é recuperado");
assert.equal(reloaded.ids.noteConnectionLayer.children.length, 1, "ligações do mapa mental são recuperadas");
assert.equal(reloaded.ids.noteCanvas.children[1].dataset.color, "red", "cores das ideias são recuperadas");
assert.equal(reloaded.ids.noteCanvas.children[1].dataset.kind, "clue", "tipos de ideia são recuperados");
assert.equal(reloaded.ids.noteZoomValue.textContent, "90%", "zoom do mapa é recuperado");
assert.equal(reloaded.ids.abilitiesList.children.length, 4, "origem, classe e habilidade manual reaparecem sem duplicação");
assert.equal(reloaded.saved().characters[0].sheet.habilidades.length, 1, "a habilidade automática não é gravada como habilidade manual");
assert.equal(reloaded.ids.equippedWeapon.children[0].textContent, "Pistola", "arma equipada reaparece ao recarregar a ficha");
const unequipView = openCharacter(reloaded.saved().characters[0]);
assert.equal(unequipView.ids.inventoryList.children[1].children[1].checked, true);
unequipView.ids.inventoryList.children[1].children[1].checked = false;
unequipView.ids.inventoryList.children[1].children[1].handlers.change();
assert.equal(unequipView.saved().characters[0].sheet.equippedWeaponId, null);
assert.match(unequipView.ids.equippedWeapon.children[0].textContent, /Nenhuma arma equipada/);
assert.equal(unequipView.saved().characters[0].sheet.inventario.length, 2, "desequipar não apaga a arma");
const removalView = openCharacter(reloaded.saved().characters[0]);
removalView.ids.inventoryList.children[0].children[2].children[2].click();
assert.equal(removalView.saved().characters[0].sheet.inventario.length, 1, "remover item continua salvando normalmente");
assert.equal(removalView.ids.inventoryList.children[0].children[0].textContent, "Pistola");
assert.equal(removalView.ids.equippedWeapon.children[0].textContent, "Pistola", "remover outra arma não altera a equipada");
removalView.ids.inventoryList.children[0].children[2].children[2].click();
assert.equal(removalView.saved().characters[0].sheet.equippedWeaponId, null, "remover a arma equipada limpa a seleção");
assert.match(removalView.ids.equippedWeapon.children[0].textContent, /Nenhuma arma equipada/);
assert.equal(removalView.ids.inventoryList.children[0].className, "entry-list__empty");
removalView.ids.ritualsList.children[0].children[1].children[2].click();
assert.equal(removalView.saved().characters[0].sheet.rituais.length, 0, "remover ritual continua salvando normalmente");
assert.equal(removalView.ids.ritualsList.children[0].className, "entry-list__empty");
assert.match(openCharacter(removalView.saved().characters[0]).ids.equippedWeapon.children[0].textContent, /Nenhuma arma equipada/, "a remoção da arma permanece após recarregar");
const ordinaryItem = openCharacter({ ...character, sheet: { inventario: [{ id: "item-normal", name: "Lanterna", category: "itens", description: "Ilumina o caminho." }] } });
assert.match(ordinaryItem.ids.equippedWeapon.children[0].textContent, /Nenhuma arma equipada/);
assert.equal(ordinaryItem.ids.inventoryList.children[0].children.length, 2, "itens que não são armas não mostram caixa de equipamento");
const legacyWeapon = openCharacter({ ...character, sheet: { inventario: [{ name: "Lâmina antiga", category: "armas", description: "Arma de uma ficha antiga." }] } });
assert.match(legacyWeapon.ids.equippedWeapon.children[0].textContent, /Nenhuma arma equipada/, "arma antiga sem ID não é equipada por engano");
legacyWeapon.ids.inventoryList.children[0].children[1].checked = true;
legacyWeapon.ids.inventoryList.children[0].children[1].handlers.change();
assert.equal(legacyWeapon.saved().characters[0].sheet.equippedWeaponId, legacyWeapon.saved().characters[0].sheet.inventario[0].id, "arma antiga recebe ID ao equipar");
assert.equal(openCharacter(legacyWeapon.saved().characters[0]).ids.equippedWeapon.children[0].textContent, "Lâmina antiga");
const legacyItems = openCharacter({ ...character, sheet: { inventario: [{ name: "Primeiro", category: "itens" }, { name: "Segundo", category: "itens" }] } });
legacyItems.ids.inventoryList.children[0].children[1].children[1].click();
assert.equal(legacyItems.saved().characters[0].sheet.inventario.length, 1, "remover item antigo sem ID não apaga os demais");
assert.equal(legacyItems.ids.inventoryList.children[0].children[0].textContent, "Segundo");

for (const [originId, originName, ability, description] of [
    ["criminoso", "Criminoso", "O Crime Compensa", "Ao fim de uma missão, escolha um item encontrado. Na próxima missão, ele pode entrar no inventário sem contar no limite de itens por patente."],
    ["cultista-arrependido", "Cultista Arrependido", "Traços do Outro Lado", require("../origins.js").find((origin) => origin.id === "cultista-arrependido").effect]
]) {
    const originView = openCharacter({ ...character, origin: originId, originName });
    const originRow = originView.ids.abilitiesList.children[0];
    assert.equal(originRow.children[0].textContent, ability);
    assert.equal(originRow.children[1].hidden, true);
    originRow.children[0].click();
    assert.equal(originRow.children[1].children[0].textContent, `Habilidade de origem · ${originName}`);
    assert.equal(originRow.children[1].children[1].textContent, description);
    assert.equal(originRow.children[1].children.some((child) => child.tag === "button"), false);
}
const changedAbilityOrigin = openCharacter({ ...reloaded.saved().characters[0], origin: "criminoso", originName: "Criminoso" });
assert.equal(changedAbilityOrigin.ids.abilitiesList.children.length, 4);
assert.equal(changedAbilityOrigin.ids.abilitiesList.children[0].children[0].textContent, "O Crime Compensa", "trocar a origem troca a habilidade automática");
const preservedManualAbility = listedAbility(changedAbilityOrigin, "Instinto de sobrevivência");
assert.ok(preservedManualAbility, "habilidade manual é preservada");
preservedManualAbility.children[1].children[2].click();
assert.equal(changedAbilityOrigin.saved().characters[0].sheet.habilidades.length, 0, "remover habilidade manual não altera a origem");
assert.equal(changedAbilityOrigin.ids.abilitiesList.children.length, 3);
assert.equal(changedAbilityOrigin.ids.abilitiesList.children[0].children[0].textContent, "O Crime Compensa");
const manualDuplicate = openCharacter({
    ...character,
    origin: "criminoso",
    originName: "Criminoso",
    sheet: { habilidades: [{ id: "antiga", name: "O Crime Compensa", description: "Ao fim de uma missão, escolha um item encontrado. Na próxima missão, ele pode entrar no inventário sem contar no limite de itens por patente." }] }
});
assert.equal(manualDuplicate.ids.abilitiesList.children.length, 3, "uma cópia manual idêntica não duplica a habilidade na tela");
assert.equal(manualDuplicate.saved().characters[0].sheet.habilidades.length, 1, "a cópia manual antiga não é apagada do armazenamento");

const skillView = openCharacter({
    ...character,
    attributes: { ...character.attributes, forca: 3, agilidade: 5 }
}, { dice: [2, 18, 6, 11, 15, 3, 20, 2, 18, 6] });
assert.equal(skillView.ids.skillsBody.children.length, 28);
const names = skillView.ids.skillsBody.children.map((row) => row.children[0].children[0].children[1].textContent);
assert.deepEqual(names, [
    "Acrobacia", "Adestramento", "Artes", "Atletismo", "Atualidades", "Ciências", "Crime",
    "Diplomacia", "Enganação", "Fortitude", "Furtividade", "Iniciativa", "Intimidação", "Intuição",
    "Investigação", "Luta", "Medicina", "Ocultismo", "Percepção", "Pilotagem", "Pontaria",
    "Profissão", "Reflexos", "Religião", "Sobrevivência", "Tática", "Tecnologia", "Vontade"
]);
const luta = skillView.ids.skillsBody.children[15];
const lutaRoll = luta.children[0].children[0].children[0];
const lutaAttribute = luta.children[1].children[0].children[0];
const lutaBonus = luta.children[2].children[0];
const lutaTraining = luta.children[3].children[0];
const lutaOther = luta.children[4].children[0];
assert.equal(lutaAttribute.value, "forca");
assert.equal(luta.children[1].children[0].children[1].textContent, "3d20");
assert.deepEqual(lutaTraining.children.map((option) => option.value), ["0", "5", "10", "15"]);
assert.equal(lutaTraining.children[2].disabled, true, "veterano fica bloqueado antes de NEX 35%");
assert.equal(lutaTraining.children[3].disabled, true, "expert fica bloqueado antes de NEX 70%");
assert.equal(lutaOther.min, "-1000");
assert.equal(lutaOther.max, "1000");
lutaRoll.click();
assert.equal(skillView.ids.skillRollResult.hidden, false, "resultado aparece após a rolagem");
assert.match(skillView.ids.skillRollResult.getAttribute("aria-label"), /3d20: 2, 18, 6\. Maior dado: 18\. Bônus: 0\. Total: 18/);
assert.equal(skillView.ids.skillRollResult.children[1].children[0].children[1].children[0].textContent, "[2]");
assert.equal(skillView.ids.skillRollResult.children[1].children[0].children[1].children[1].textContent, "[6]");
assert.equal(skillView.ids.skillRollResult.children[1].children[1].children[0].textContent, "18");
lutaTraining.value = "5";
lutaTraining.handlers.change();
lutaOther.value = "-3";
lutaOther.handlers.input();
lutaOther.handlers.change();
assert.equal(lutaBonus.textContent, "+2", "bônus soma treino e outros");
lutaOther.value = "-2.5";
lutaOther.handlers.change();
assert.equal(lutaBonus.textContent, "+2.5", "Outros aceita qualquer número no intervalo");
lutaOther.value = "-3";
lutaOther.handlers.change();
lutaAttribute.value = "agilidade";
lutaAttribute.handlers.change();
assert.equal(luta.children[1].children[0].children[1].textContent, "5d20");
lutaRoll.click();
assert.match(skillView.ids.skillRollResult.getAttribute("aria-label"), /5d20: 11, 15, 3, 20, 2\. Maior dado: 20\. Bônus: \+2\. Total: 22/);
const fiveDicePreview = skillView.ids.skillRollResult.children[1].children[0].children[1];
assert.deepEqual(fiveDicePreview.children.slice(0, 3).map((chip) => chip.textContent), ["[11]", "[15]", "[3]"], "apenas três dados secundários aparecem na caixa");
assert.equal(fiveDicePreview.children[3].children[0].textContent, "+1");
assert.equal(fiveDicePreview.children[3].children[1].textContent, "[2]", "dados restantes ficam no texto flutuante");
assert.equal(fiveDicePreview.children[3].children[0].getAttribute("aria-describedby"), "rollResultOverflow");
assert.equal(skillView.ids.skillRollResult.children[1].children[1].children[0].textContent, "22", "resultado final fica destacado à direita");
lutaAttribute.value = "presenca";
lutaAttribute.handlers.change();
assert.equal(luta.children[1].children[0].children[1].textContent, "2d20 ↓");
lutaRoll.click();
assert.match(skillView.ids.skillRollResult.getAttribute("aria-label"), /2d20: 18, 6\. Menor dado: 6\. Bônus: \+2\. Total: 8/);
assert.equal(skillView.ids.skillRollResult.children[1].children[0].children[1].children[0].textContent, "[18]");
assert.equal(skillView.ids.skillRollResult.children[1].children[1].children[0].textContent, "8");
skillView.ids.skillRollResult.children[0].children[1].click();
assert.equal(skillView.ids.skillRollResult.hidden, true, "resultado pode ser fechado");
lutaOther.value = "1500";
lutaOther.handlers.change();
assert.equal(lutaOther.value, "1000");
assert.equal(lutaBonus.textContent, "+1005");
lutaOther.value = "-1500";
lutaOther.handlers.change();
assert.equal(lutaOther.value, "-1000");
assert.equal(lutaBonus.textContent, "-995");
const crime = skillView.ids.skillsBody.children[6];
crime.children[0].children[0].children[0].click();
assert.match(skillView.ids.skillRollResult.getAttribute("aria-label"), /Crime: 5d20: .*Bônus: 0\. Total: 18\./, "Crime pode ser rolado com treino 0");
assert.equal(skillView.ids.skillRollResult.hidden, false);
assert.equal(skillView.ids.skillRollResult.children[1].children[1].children[0].textContent, "18");
assert.equal(crime.children[0].children[0].children[2].textContent, "*+");
const adestramento = skillView.ids.skillsBody.children[1];
adestramento.children[0].children[0].children[0].click();
assert.match(skillView.ids.skillRollResult.getAttribute("aria-label"), /Adestramento: 2d20: 3, 20\. Menor dado: 3\. Bônus: 0\. Total: 3\./, "perícia marcada com atributo 0 também pode ser rolada sem treino");
const savedSkills = skillView.saved().characters[0].sheet.skills;
assert.equal(savedSkills.luta.attribute, "presenca");
assert.equal(savedSkills.luta.training, 5);
assert.equal(savedSkills.luta.other, -1000);
const skillReload = openCharacter(skillView.saved().characters[0]);
assert.equal(skillReload.ids.skillsBody.children[15].children[2].children[0].textContent, "-995");
const singleDie = openCharacter({ ...character, attributes: { ...character.attributes, forca: 1 } }, { dice: [7] });
singleDie.ids.skillsBody.children[15].children[0].children[0].children[0].click();
assert.equal(singleDie.ids.skillRollResult.children[1].children[0].children[1].children[0].textContent, "—", "um único d20 não cria dados secundários");
assert.equal(singleDie.ids.skillRollResult.children[1].children[1].children[0].textContent, "7");
const tiedDice = openCharacter({ ...character, attributes: { ...character.attributes, agilidade: 5 } }, { dice: [20, 20, 5, 7, 8] });
tiedDice.ids.skillsBody.children[0].children[0].children[0].children[0].click();
const tiedPreview = tiedDice.ids.skillRollResult.children[1].children[0].children[1];
assert.deepEqual(tiedPreview.children.slice(0, 3).map((chip) => chip.textContent), ["[20]", "[5]", "[7]"], "um empate deixa só uma cópia do dado escolhido fora dos secundários");
assert.equal(tiedPreview.children[3].children[1].textContent, "[8]");
const freeSkillRolls = openCharacter({
    ...character,
    attributes: { agilidade: 1, forca: 1, intelecto: 1, presenca: 1, vigor: 1 },
    sheet: { skills: {} }
}, { dice: [10] });
for (const row of freeSkillRolls.ids.skillsBody.children) {
    row.children[0].children[0].children[0].click();
    assert.match(freeSkillRolls.ids.skillRollResult.getAttribute("aria-label"), /Bônus: 0\. Total: 10\./, "todas as 28 perícias rolam mesmo sem treino");
}

const criminal = openCharacter({ ...character, origin: "criminoso", originName: "Criminoso" }, { dice: [12] });
for (const origin of require("../origins.js")) {
    const view = openCharacter({ ...character, origin: origin.id, originName: origin.name });
    assert.equal(view.ids.characterOrigin.textContent, origin.name);
    assert.equal(view.ids.abilitiesList.children[0].children[0].textContent, origin.ability, `${origin.name}: habilidade automática`);
    assert.equal(view.ids.abilitiesList.children[0].children[1].children[1].textContent, origin.effect);
    const trained = view.ids.skillsBody.children.filter((row) => row.dataset.trained === "true");
    assert.equal(trained.length, origin.trainedSkills.length, `${origin.name}: quantidade de perícias treinadas`);
    for (const row of trained) assert.equal(row.children[3].children[0].value, "5", `${origin.name}: treino +5`);
    assert.equal(view.ids.originTrainingChoices.hidden, origin.id !== "amnesico");
}
for (const index of [6, 10]) {
    const row = criminal.ids.skillsBody.children[index];
    assert.equal(row.dataset.trained, "true", "a origem treina a perícia sem edição manual");
    assert.equal(row.children[2].children[0].textContent, "+5");
    assert.equal(row.children[3].children[0].value, "5");
    assert.equal(row.children[3].children[0].children[0].disabled, true, "o treino da origem não pode ser removido pelo seletor");
    assert.match(row.children[0].children[0].children.at(-1).textContent, /Origem \+5/);
}
assert.equal(criminal.ids.skillsBody.children[7].children[2].children[0].textContent, "0", "as demais perícias não ganham bônus");
criminal.ids.skillsBody.children[6].children[0].children[0].children[0].click();
assert.match(criminal.ids.skillRollResult.getAttribute("aria-label"), /Crime: 4d20: .*Bônus: \+5\./);
criminal.ids.skillsBody.children[6].children[4].children[0].handlers.change();
assert.equal(criminal.saved().characters[0].sheet.skills.crime.training, 0, "o treino concedido é derivado da origem, sem duplicar o valor salvo");
const crimeTraining = criminal.ids.skillsBody.children[6].children[3].children[0];
crimeTraining.value = "10";
crimeTraining.handlers.change();
assert.equal(criminal.ids.skillsBody.children[6].children[2].children[0].textContent, "+5", "veterano não pode ser escolhido antes de NEX 35%");
assert.match(criminal.ids.skillProgressionSummary.textContent, /máximo neste NEX é \+5/);
criminal.ids.nexSelect.value = "35";
criminal.ids.nexSelect.handlers.change();
const veteranCrimeTraining = criminal.ids.skillsBody.children[6].children[3].children[0];
assert.notEqual(veteranCrimeTraining.children[2].disabled, true);
veteranCrimeTraining.value = "10";
veteranCrimeTraining.handlers.change();
assert.equal(criminal.ids.skillsBody.children[6].children[2].children[0].textContent, "+10", "veterano é liberado em NEX 35%");
const changedOrigin = openCharacter({ ...criminal.saved().characters[0], origin: "cultista-arrependido", originName: "Cultista Arrependido" });
assert.equal(changedOrigin.ids.skillsBody.children[6].children[2].children[0].textContent, "+10", "treino manual permanece após mudar a origem");
assert.equal(changedOrigin.ids.skillsBody.children[10].children[2].children[0].textContent, "0", "bônus da origem anterior não fica preso na ficha");
for (const index of [17, 23]) assert.equal(changedOrigin.ids.skillsBody.children[index].children[2].children[0].textContent, "+5");
const cultistReload = openCharacter(changedOrigin.saved().characters[0]);
assert.equal(cultistReload.ids.skillsBody.children[17].children[3].children[0].value, "5", "o bônus da origem reaparece ao recarregar");
const occultOther = cultistReload.ids.skillsBody.children[17].children[4].children[0];
occultOther.value = "3";
occultOther.handlers.change();
assert.equal(cultistReload.ids.skillsBody.children[17].children[2].children[0].textContent, "+8", "o bônus da origem soma com Outros");
cultistReload.ids.skillsBody.children[17].children[0].children[0].children[0].click();
assert.match(cultistReload.ids.skillRollResult.getAttribute("aria-label"), /Ocultismo: .*Bônus: \+8\./, "treino da origem e Outros seguem somando na rolagem");

const amnesiac = openCharacter(character);
assert.equal(amnesiac.ids.originTrainingChoices.hidden, false);
const firstChoice = amnesiac.ids.originSkillChoice1;
const secondChoice = amnesiac.ids.originSkillChoice2;
assert.equal(firstChoice.value, "");
firstChoice.value = "crime";
firstChoice.handlers.change();
secondChoice.value = "crime";
secondChoice.handlers.change();
assert.equal(secondChoice.value, "", "a mesma perícia não pode ocupar as duas escolhas");
secondChoice.value = "furtividade";
secondChoice.handlers.change();
assert.equal(amnesiac.ids.skillsBody.children[6].children[2].children[0].textContent, "+5");
assert.equal(amnesiac.ids.skillsBody.children[10].children[2].children[0].textContent, "+5");
assert.deepEqual(amnesiac.saved().characters[0].sheet.originSkillChoices, ["crime", "furtividade"]);
const amnesiacReload = openCharacter(amnesiac.saved().characters[0]);
assert.equal(amnesiacReload.ids.originSkillChoice1.value, "crime");
assert.equal(amnesiacReload.ids.originSkillChoice2.value, "furtividade");
firstChoice.value = "";
firstChoice.handlers.change();
assert.equal(amnesiac.ids.skillsBody.children[6].children[2].children[0].textContent, "0", "remover uma escolha retira apenas o bônus correspondente");
assert.equal(amnesiac.ids.skillsBody.children[10].children[2].children[0].textContent, "+5");

for (const [classId, file] of [
    ["combatente", "atributos-combatente.png"],
    ["ocultista", "atributos-ocultista.png"],
    ["mundano", "atributos-mundano.png"]
]) {
    const view = openCharacter({ ...character, class: classId, role: classId });
    assert.equal(view.ids.attributeWheelImage.src, `assets/${file}`);
    assert.equal(view.context.document.body.dataset.characterTheme, classId);
}

const failed = openCharacter(character, { failedImages: ["assets/atributos-especialista.png"] });
assert.equal(failed.ids.attributeWheelImage.src, "assets/atributos-indefinido.png", "imagem ausente usa a roda neutra");

const legacy = openCharacter({ id: "antigo", name: "Antigo", role: "Investigador", origin: "criminoso" });
assert.equal(legacy.ids.characterOrigin.textContent, "Criminoso");
assert.equal(legacy.ids.abilitiesList.children[0].children[0].textContent, "O Crime Compensa", "fichas antigas também recebem a habilidade da origem");
assert.equal(legacy.ids.attributeWheelImage.src, "assets/atributos-indefinido.png");
assert.equal(legacy.ids.attributeWheelValues.children[0].children[0].textContent, "—", "valores desconhecidos não são inventados");
assert.equal(legacy.ids.attributeWheelValues.children[0].getAttribute("aria-label"), "Agilidade: não informado");
assert.equal(legacy.ids.characterAppearance.classes["is-empty"], true);
legacy.ids.skillsBody.children[6].children[0].children[0].children[0].click();
assert.match(legacy.ids.skillRollResult.getAttribute("aria-label"), /atributo de Crime ainda não tem um valor válido/, "valor de atributo ausente continua gerando uma mensagem útil");

const missing = openCharacter(null);
assert.equal(missing.ids.missingCharacter.hidden, false);
assert.equal(missing.ids.characterContent.hidden, true);

assert.match(fs.readFileSync(path.join(root, "campaign.js"), "utf8"), /personagem\.html\?id=/);
assert.match(fs.readFileSync(path.join(root, "ficha.js"), "utf8"), /if \(persistState\(\)\) location\.href = "personagem\.html\?id="/);
const css = fs.readFileSync(path.join(root, "personagem.css"), "utf8");
const html = fs.readFileSync(path.join(root, "personagem.html"), "utf8");
assert.equal((html.match(/data-sheet-tab=/g) || []).length, 8);
assert.deepEqual([...html.matchAll(/data-sheet-tab="([^"]+)"/g)].map((match) => match[1]), ["informacoes", "atributos", "pericias", "combate", "inventario", "habilidades", "rituais", "descricoes"]);
assert.match(html, /id="sheetTabs" class="sheet-tabs"/);
assert.match(html, /data-description-tab="anotacoes"/);
assert.match(html, /data-add-shape="triangle"/);
assert.match(html, /id="connectNotes"/);
assert.match(html, /id="noteConnectionLayer"/);
assert.match(html, /id="noteSearch"/);
assert.match(html, /id="exportNoteMap"/);
assert.match(html, /<tbody id="skillsBody"><\/tbody>/);
assert.match(html, /id="equippedWeapon" aria-live="polite"/);
assert.match(html, /id="nexSelect"/);
assert.match(html, /id="vidaCurrent"/);
assert.match(html, /id="esforcoCurrent"/);
assert.match(html, /id="sanidadeCurrent"/);
assert.match(html, /id="ritualDifficulty"/);
assert.match(html, /<details class="attribute-more">[\s\S]*?<summary>Defesa, proteção e ajustes<\/summary>/);
assert.match(html, /id="toggleAttributeEdit"[^>]*aria-label="Editar atributos"[^>]*aria-pressed="false"/);
assert.match(html, /id="attributeEditHint"[^>]*hidden/);
assert.doesNotMatch(html, /id="attributeList"/, "a lista duplicada de atributos foi removida");
assert.match(html, /<script src="nex-rules\.js\?v=[^"]+"><\/script>/);
assert.ok(html.indexOf('id="skillRollResult"') > html.indexOf("</main>"), "resultado flutuante fica fora da aba que pode ser escondida");
assert.match(html, /id="skillRollResult"[^>]*hidden/);
assert.match(html, /Marcador de treino \(não bloqueia rolagens\)/);
for (const id of ["inventoryList", "abilitiesList", "ritualsList"]) assert.match(html, new RegExp(`id="${id}" class="entry-list entry-list--accordion"`));
assert.match(html, /<script src="origins\.js\?v=[^"]+"><\/script>/);
assert.match(html, /<script src="equipment-catalog\.js\?v=[^"]+"><\/script>/);
assert.match(html, /data-add-entry="inventario">Criar item<\/button>/);
assert.match(html, /id="openCatalog"[^>]*>Adicionar item<\/button>/);
assert.match(html, /id="catalogDialog"[^>]*aria-labelledby="catalogDialogTitle"/);
assert.match(html, /id="catalogCollections" class="catalog-collections"/);
assert.match(html, /id="catalogCategories" class="catalog-categories"/);
assert.match(html, /data-inventory-filter="municoes">Munições<\/button>/);
assert.match(html, /<option value="municoes">Munições<\/option>/);
assert.ok(html.indexOf('id="catalogCollections"') < html.indexOf('id="catalogList"'), "as caixas ficam acima dos itens");
assert.doesNotMatch(html, /id="backCatalog"/, "não há segunda tela nem botão de voltar");
assert.doesNotMatch(html, /id="entryWeapon"/, "o catálogo não fica no formulário manual");
assert.match(css, /\.entry-list article\.entry-item \{[^}]*background:[^;]*#2d2d32/);
assert.match(css, /\.entry-list article\.entry-item\.entry-list__origin \{ border-left: 3px solid var\(--accent\)/);
assert.match(css, /\.entry-item__equip-check \{[^}]*width: 44px; height: 44px/);
assert.match(css, /\.skill-roll-result \{ position: fixed; right:/);
assert.match(css, /\.roll-result__more:hover \.roll-result__tooltip, \.roll-result__more:focus-within \.roll-result__tooltip/);
assert.match(css, /\.entry-item__toggle--weapon::after \{[^}]*right: 21px/);
assert.match(css, /\.entry-item__equip-check \{[^}]*right: 51px/);
assert.match(css, /@media \(max-width: 850px\)/);
assert.match(css, /\.attribute-wheel__value \{[^}]*width: max\(25%, 44px\); height: max\(25%, 44px\)/);
assert.match(css, /@media \(min-width: 900px\)/);
assert.match(css, /\.view-layout \{[^}]*height: calc\(100dvh - 56px\)/);
assert.match(css, /#panel-atributos \{ grid-column: 1; grid-row: 2 \/ span 2;/);
assert.match(css, /#panel-informacoes, #panel-descricoes, #panel-pericias, #panel-combate, #panel-inventario, #panel-habilidades, #panel-rituais \{ grid-column: 2; grid-row: 3;/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(css, /overflow-x: clip/);
function descendants(node) { return [node, ...node.children.flatMap(descendants)]; }
function combatControl(view, key, setting = false) {
    return descendants(view.ids.equippedWeapon).find((node) => node.dataset[setting ? "combatSetting" : "combatAction"] === key);
}
function inventoryEquipment(view, name, checked) {
    const row = view.ids.inventoryList.children.find((node) => node.children[0]?.textContent === name);
    row.children[1].checked = checked;
    row.children[1].handlers.change();
}
const combatCharacter = {
    ...character, attributes: { ...character.attributes, forca: 2 },
    sheet: {
        originSkillChoices: ["luta", "fortitude"],
        skills: { luta: { training: 0, other: 1 }, fortitude: { training: 0, other: 2 }, reflexos: { training: 10, other: 1 }, furtividade: { training: 5, other: 1 } },
        inventario: [
            { id: "knife", catalogId: "faca", category: "armas", name: "Faca", weaponStyle: "Corpo a Corpo", damage: "1d4", critical: 19 },
            { id: "axe", catalogId: "acha", category: "armas", name: "Acha", hands: "Duas Mãos", damage: "1d12", critical: "x3" },
            { id: "heavy", catalogId: "protecao-pesada", category: "protecao", name: "Proteção Pesada", defense: 10 },
            { id: "light", catalogId: "protecao-leve", category: "protecao", name: "Proteção Leve", defense: 5 },
            { id: "shield", catalogId: "escudo", category: "protecao", name: "Escudo", defense: 2 }
        ]
    }
};
const combatView = openCharacter(combatCharacter, { dice: [20] });
assert.equal(combatView.ids.defenseValue.textContent, "14");
assert.equal(combatView.ids.blockValue.textContent, "7", "bloqueio inclui treino da origem e outros bônus de Fortitude");
assert.equal(combatView.ids.dodgeValue.textContent, "25");
inventoryEquipment(combatView, "Faca", true);
combatControl(combatView, "attack").click();
assert.match(combatView.ids.skillRollResult.getAttribute("aria-label"), /2d20.*Bônus: \+6. Total: 26.*Ameaça de crítico/);
combatControl(combatView, "damage").click();
assert.match(combatView.ids.skillRollResult.getAttribute("aria-label"), /1d4: 4.*Total: 6/);
combatControl(combatView, "critical").click();
assert.match(combatView.ids.skillRollResult.getAttribute("aria-label"), /2d4: 4, 4.*Total: 10/);
function changeWeaponSetting(key, value) {
    const field = combatControl(combatView, key, true);
    field.value = value;
    field.handlers.change();
}
changeWeaponSetting("attribute", "agilidade");
changeWeaponSetting("damage", "1d4+2");
changeWeaponSetting("critical", "19/x3");
changeWeaponSetting("damageBonus", "3");
changeWeaponSetting("extraDamage", "1d6+1");
combatControl(combatView, "critical").click();
assert.match(combatView.ids.skillRollResult.getAttribute("aria-label"), /3d4: 4, 4, 4.*extra 1d6: 6.*bônus fixo \+8.*Total: 26/);
const lutaRow = combatView.ids.skillsBody.children.find((node) => node.children[0].children[0].children[1].textContent === "Luta");
lutaRow.children[4].children[0].value = "4";
lutaRow.children[4].children[0].handlers.change();
combatControl(combatView, "attack").click();
assert.match(combatView.ids.skillRollResult.getAttribute("aria-label"), /4d20.*Bônus: \+9. Total: 29/, "o ataque acompanha a perícia após ler os valores várias vezes");
inventoryEquipment(combatView, "Proteção Pesada", true);
inventoryEquipment(combatView, "Escudo", true);
assert.equal(combatView.ids.defenseValue.textContent, "26");
assert.equal(combatView.ids.dodgeValue.textContent, "37");
assert.match(combatView.ids.resistanceValue.textContent, /perfuração 2/);
const stealthRow = combatView.ids.skillsBody.children.find((node) => node.children[0].children[0].children[1].textContent === "Furtividade");
assert.equal(stealthRow.children[2].children[0].textContent, "+1");
stealthRow.children[0].children[0].children[0].click();
assert.match(combatView.ids.skillRollResult.getAttribute("aria-label"), /Bônus: \+1. Total: 21/);
inventoryEquipment(combatView, "Acha", true);
assert.equal(combatView.saved().characters[0].sheet.equippedWeaponId, "knife", "conflito de mãos não troca a arma");
assert.match(combatView.ids.equipmentMessage.textContent, /duas mãos e escudo/);
inventoryEquipment(combatView, "Proteção Leve", true);
assert.equal(combatView.ids.defenseValue.textContent, "21", "uma proteção substitui outra sem somar ambas");
assert.equal(combatView.ids.resistanceValue.textContent, "Nenhuma registrada");
combatView.ids.defenseBonus.value = "3";
combatView.ids.defenseBonus.handlers.change();
assert.equal(combatView.ids.defenseValue.textContent, "24");
const combatReload = openCharacter(combatView.saved().characters[0], { dice: [20] });
assert.equal(combatReload.ids.defenseValue.textContent, "24");
combatControl(combatReload, "critical").click();
assert.match(combatReload.ids.skillRollResult.getAttribute("aria-label"), /Total: 26/, "configuração de dano e crítico persiste");
const combatAttributes = openCharacter(combatView.saved().characters[0], { dice: [20, 1] });
combatAttributes.ids.toggleAttributeEdit.click();
const combatAgi = combatAttributes.ids.attributeWheelValues.children[0];
combatAgi.children[1].click();
combatAgi.children[2].value = "0";
combatAgi.children[2].handlers.change();
assert.equal(combatAttributes.ids.defenseValue.textContent, "20", "a Defesa acompanha a Agilidade editada");
combatControl(combatAttributes, "attack").click();
assert.match(combatAttributes.ids.skillRollResult.getAttribute("aria-label"), /2d20: 20, 1. Menor dado: 1.*Total: 10/);
const combatForce = combatAttributes.ids.attributeWheelValues.children[1];
combatForce.children[1].click();
combatForce.children[2].value = "3";
combatForce.children[2].handlers.change();
assert.equal(combatAttributes.saved().characters[0].attributes.forca, 3);
assert.equal(combatControl(combatAttributes, "damageAttribute", true).value, "forca");
const malformedDamage = combatControl(combatAttributes, "damage", true);
malformedDamage.value = "2d6+alert(1)";
malformedDamage.handlers.change();
combatControl(combatAttributes, "damage").click();
assert.match(combatAttributes.ids.skillRollResult.getAttribute("aria-label"), /Configure o dano/, "expressões inválidas não são executadas");
const lightRow = combatReload.ids.inventoryList.children.find((node) => node.children[0]?.textContent === "Proteção Leve");
lightRow.children[2].children.at(-1).click();
assert.equal(combatReload.ids.defenseValue.textContent, "19", "remover proteção recalcula Defesa e mantém o escudo");
assert.equal(combatReload.saved().characters[0].sheet.equippedArmorId, null);
inventoryEquipment(combatReload, "Escudo", false);
inventoryEquipment(combatReload, "Acha", true);
assert.equal(combatReload.saved().characters[0].sheet.equippedWeaponId, "axe");
inventoryEquipment(combatReload, "Escudo", true);
assert.equal(combatReload.saved().characters[0].sheet.equippedShieldId, null, "conflito também é validado ao equipar escudo");
const failingOptions = { failStorage: true };
const failingCombat = openCharacter({ ...character, sheet: { inventario: [{ category: "protecao", name: "Colete antigo", defense: 5 }] } }, failingOptions);
inventoryEquipment(failingCombat, "Colete antigo", true);
assert.equal(failingCombat.ids.defenseValue.textContent, "14");
assert.equal(failingCombat.saved().characters[0].sheet.inventario[0].id, undefined, "falha no salvamento desfaz o ID gerado");
failingOptions.failStorage = false;
inventoryEquipment(failingCombat, "Colete antigo", true);
assert.equal(failingCombat.ids.defenseValue.textContent, "19");
failingOptions.failStorage = true;
inventoryEquipment(failingCombat, "Colete antigo", false);
assert.equal(failingCombat.ids.defenseValue.textContent, "19", "falha ao desequipar preserva o equipamento");
failingCombat.ids.inventoryList.children[0].children[2].children.at(-1).click();
assert.equal(failingCombat.ids.defenseValue.textContent, "19");
assert.equal(failingCombat.saved().characters[0].sheet.inventario.length, 1, "falha na remoção preserva o item");
const variantView = openCharacter({ ...character, sheet: { equippedWeaponId: "staff", inventario: [{ id: "staff", catalogId: "bastao", name: "Bastão", category: "armas", hands: "Uma Mão", damage: "1d6/1d8", critical: "x2" }] } }, { dice: [20] });
combatControl(variantView, "damage").click();
assert.match(variantView.ids.skillRollResult.getAttribute("aria-label"), /1d6: 6.*Total: 7/);
const handsField = combatControl(variantView, "hands", true);
handsField.value = "two";
handsField.handlers.change();
assert.equal(combatControl(variantView, "damage", true).value, "1d8");
combatControl(variantView, "damage").click();
assert.match(variantView.ids.skillRollResult.getAttribute("aria-label"), /1d8: 8.*Total: 9/);
const conflictingKatana = openCharacter({ ...character, sheet: {
    equippedWeaponId: "katana", equippedShieldId: "shield", skills: { luta: { training: 10 } },
    inventario: [{ id: "katana", catalogId: "katana", category: "armas", name: "Katana", hands: "Duas Mãos", damage: "1d10" }, { id: "shield", catalogId: "escudo", name: "Escudo", category: "protecao", defense: 2 }]
} });
assert.equal(conflictingKatana.ids.defenseValue.textContent, "16", "Katana permite uma mão com treino veterano em Luta");
const katanaTraining = conflictingKatana.ids.skillsBody.children[15].children[3].children[0];
katanaTraining.value = "5";
katanaTraining.handlers.change();
assert.equal(conflictingKatana.ids.defenseValue.textContent, "14", "perder a condição de uma mão suspende o bônus do escudo");
combatControl(conflictingKatana, "attack").click();
assert.match(conflictingKatana.ids.skillRollResult.getAttribute("aria-label"), /Corrija o equipamento/);
function catalogAbility(view, name) {
    return view.ids.abilityCatalogList.children.find(row => row.children[0]?.children[0]?.textContent === name);
}
function queryAbility(view, query) {
    view.ids.abilityCatalogSearch.value = query;
    view.ids.abilityCatalogSearch.handlers.input();
}
const abilityView = openCharacter({ ...character, sheet: { habilidades: [{ id: "manual", name: "Talento da mesa", description: "Continua aqui" }] } });
abilityView.ids.openAbilityCatalog.click();
assert.equal(abilityView.ids.abilityCatalogDialog.open, true);
assert.equal(abilityView.ids.abilityCatalogList.children.length, 18, "abre inicialmente a classe da ficha");
abilityView.ids.abilityCatalogCategories.children.find(button => button.textContent === "Combatente").click();
abilityView.ids.abilityCatalogSubgroups.children.find(button => button.textContent === "Guerreiro").click();
assert.equal(abilityView.ids.abilityCatalogList.children.length, 4);
const lethalRow = catalogAbility(abilityView, "Técnica Letal");
lethalRow.children[0].click();
assert.equal(lethalRow.children[1].hidden, false);
assert.match(lethalRow.children[0].children[1].textContent, /Guerreiro.*NEX 10%/);
catalogAbility(abilityView, "Revidar").children[0].click();
assert.equal(lethalRow.children[1].hidden, true, "só um painel expandido por vez");
queryAbility(abilityView, "tÉcNiCa LeTaL");
assert.equal(abilityView.ids.abilityCatalogList.children.length, 1, "busca global ignora acentos e caixa");
queryAbility(abilityView, "habilidade-que-nao-existe");
assert.match(abilityView.ids.abilityCatalogList.children[0].textContent, /Nenhuma habilidade encontrada/);
queryAbility(abilityView, "sangue de ferro");
const bloodRow = catalogAbility(abilityView, "Sangue de Ferro");
bloodRow.children[0].click();
const bloodPanel = bloodRow.children[1];
bloodPanel.children.find(child => child.className === "ability-catalog__affinity").children[0].checked = true;
bloodPanel.children.find(child => child.className === "ability-catalog__notes").children[0].value = "<script>texto literal</script>";
const previousMaximum = abilityView.ids.vidaMaximum.textContent;
bloodPanel.children.find(child => child.getAttribute("aria-label") === "Adicionar Sangue de Ferro à ficha").click();
assert.equal(abilityView.ids.abilityCatalogDialog.open, false);
assert.equal(abilityView.ids.openAbilityCatalog.focused, true);
assert.equal(abilityView.saved().characters[0].sheet.habilidades.length, 2);
const addedBlood = abilityView.saved().characters[0].sheet.habilidades[1];
assert.equal(addedBlood.name, "Sangue de Ferro (Afinidade)");
assert.equal(addedBlood.affinity, true);
assert.match(addedBlood.description, /Afinidade:.*Fortitude/);
assert.match(addedBlood.description, /<script>texto literal<\/script>/);
assert.equal(Number(abilityView.ids.vidaMaximum.textContent), Number(previousMaximum) + 2, "Sangue de Ferro acrescenta dois PV por nível com automações ligadas");
const abilityReload = openCharacter(abilityView.saved().characters[0]);
assert.equal(abilityReload.ids.abilitiesList.children.length, 5, "origem, classe e habilidades manuais permanecem");
abilityReload.ids.openAbilityCatalog.click();
queryAbility(abilityReload, "sangue de ferro");
assert.equal(catalogAbility(abilityReload, "Sangue de Ferro").children[1].children.at(-1).disabled, true);
queryAbility(abilityReload, "vislumbres do passado");
assert.equal(catalogAbility(abilityReload, "Vislumbres do Passado").children[1].children.at(-1).disabled, true, "não duplica a origem automática");
for (let i = 0; i < 2; i++) {
    abilityReload.ids.openAbilityCatalog.click();
    queryAbility(abilityReload, "transcender");
    const transcendRow = catalogAbility(abilityReload, "Transcender");
    assert.equal(transcendRow.children[1].children.at(-1).disabled, false);
    transcendRow.children[1].children.at(-1).click();
}
assert.equal(abilityReload.saved().characters[0].sheet.habilidades.length, 4, "poderes repetíveis podem ser adicionados novamente");
const abilitySaveFailure = openCharacter({ ...character, sheet: { habilidades: [{ id: "old", name: "Não apagar" }] } }, { failStorage: true });
abilitySaveFailure.ids.openAbilityCatalog.click();
queryAbility(abilitySaveFailure, "golpe pesado");
catalogAbility(abilitySaveFailure, "Golpe Pesado").children[1].children.at(-1).click();
assert.equal(abilitySaveFailure.saved().characters[0].sheet.habilidades.length, 1);
assert.equal(vm.runInContext("character.sheet.habilidades.length", abilitySaveFailure.context), 1, "falha também reverte os dados em memória");
assert.equal(abilitySaveFailure.ids.abilityCatalogDialog.open, true);
assert.match(abilitySaveFailure.ids.abilityCatalogMessage.textContent, /não foi adicionada/);
abilitySaveFailure.ids.closeAbilityCatalog.click();
assert.equal(abilitySaveFailure.ids.abilityCatalogDialog.open, false);
function catalogRitual(view, name) { return view.ids.ritualCatalogList.children.find(row => row.children[0]?.children[0]?.textContent === name); }
function queryRitual(view, query) { view.ids.ritualCatalogSearch.value = query; view.ids.ritualCatalogSearch.handlers.input(); }
const ritualView = openCharacter({ ...character, sheet: { rituais: [{ id: "old-ritual", name: "Ritual da mesa", description: "Preservado" }] } });
ritualView.ids.openRitualCatalog.click();
assert.equal(ritualView.ids.ritualCatalogDialog.open, true);
assert.equal(ritualView.ids.ritualCatalogList.children.length, 83);
ritualView.ids.ritualCatalogElements.children.find(button => button.textContent === "Morte").click();
assert.equal(ritualView.ids.ritualCatalogList.children.length, 19);
ritualView.ids.ritualCatalogCircles.children.find(button => button.textContent === "1º círculo").click();
assert.equal(ritualView.ids.ritualCatalogList.children.length, 6);
queryRitual(ritualView, "cIcAtRiZaÇaO");
assert.equal(ritualView.ids.ritualCatalogList.children.length, 1);
const healingRow = catalogRitual(ritualView, "Cicatrização"); healingRow.children[0].click();
assert.equal(healingRow.children[1].hidden, false);
const healingPanel = healingRow.children[1];
const healingVersions = healingPanel.children.find(child => child.className.includes("ritual-catalog__versions"));
assert.equal(healingVersions.children.length, 3);
healingVersions.children.find(button => button.textContent === "Verdadeiro").click();
assert.match(healingPanel.children.find(child => child.className === "catalog-item__description").textContent, /Verdadeiro · 10 PE \(1 \+ 9\).*7d8\+7/s);
assert.match(healingPanel.children.find(child => child.className === "catalog-item__classification").textContent, /4º círculo.*Afinidade com Morte/);
healingPanel.children.find(child => child.className === "ability-catalog__notes").children[0].value = "<img>texto literal";
const ritualPe = ritualView.ids.esforcoCurrent.value; const ritualSan = ritualView.ids.sanidadeCurrent.value;
healingPanel.children.at(-1).click();
assert.equal(ritualView.ids.ritualCatalogDialog.open, false);
assert.equal(ritualView.ids.openRitualCatalog.focused, true);
assert.equal(ritualView.saved().characters[0].sheet.rituais.length, 2);
const storedHealing = ritualView.saved().characters[0].sheet.rituais[1];
assert.equal(storedHealing.name, "Cicatrização", "consultar verdadeiro não aprende um ritual separado");
assert.equal(storedHealing.cost, 1);
assert.equal(storedHealing.versions.verdadeiro.extraCost, 9);
assert.match(storedHealing.description, /Discente.*Verdadeiro/s);
assert.match(storedHealing.description, /<img>texto literal/);
assert.equal(ritualView.ids.esforcoCurrent.value, ritualPe, "registrar não gasta PE");
assert.equal(ritualView.ids.sanidadeCurrent.value, ritualSan, "registrar não gasta SAN");
const ritualReload = openCharacter(ritualView.saved().characters[0]);
assert.equal(ritualReload.ids.ritualsList.children.length, 2);
assert.equal(ritualReload.ids.ritualsList.children[0].children[1].children[0].textContent, "Ritual", "rituais personalizados antigos permanecem compatíveis");
assert.match(ritualReload.ids.ritualsList.children[1].children[1].children[0].textContent, /Morte · 1º círculo · 1 PE/);
assert.match(ritualReload.ids.ritualsList.children[1].children[1].children[1].textContent, /Alcance: toque/);
ritualReload.ids.openRitualCatalog.click(); queryRitual(ritualReload, "cicatrizacao");
assert.equal(catalogRitual(ritualReload, "Cicatrização").children[1].children.at(-1).disabled, true);
queryRitual(ritualReload, "nao-existe");
assert.match(ritualReload.ids.ritualCatalogList.children[0].textContent, /Nenhum ritual/);
queryRitual(ritualReload, "");
const firstRitualRow = ritualReload.ids.ritualCatalogList.children[0]; firstRitualRow.children[0].click();
ritualReload.ids.ritualCatalogList.children[1].children[0].click();
assert.equal(firstRitualRow.children[1].hidden, true, "um ritual expandido por vez");
for (const element of ["Sangue", "Energia"]) {
    ritualReload.ids.openRitualCatalog.click(); queryRitual(ritualReload, "amaldiçoar arma");
    const variablePanel = catalogRitual(ritualReload, "Amaldiçoar Arma").children[1];
    const select = variablePanel.children.find(child => child.children[0]?.tag === "select").children[0];
    select.value = element; select.handlers.change();
    assert.equal(variablePanel.children.at(-1).disabled, false); variablePanel.children.at(-1).click();
}
assert.equal(ritualReload.saved().characters[0].sheet.rituais.length, 4);
assert.equal(ritualReload.saved().characters[0].sheet.rituais[2].name, "Amaldiçoar Arma (Sangue)");
ritualReload.ids.openRitualCatalog.click(); queryRitual(ritualReload, "amaldiçoar arma");
const variablePanel = catalogRitual(ritualReload, "Amaldiçoar Arma").children[1];
const variableSelect = variablePanel.children.find(child => child.children[0]?.tag === "select").children[0];
variableSelect.value = "Sangue"; variableSelect.handlers.change();
assert.equal(variablePanel.children.at(-1).disabled, true);
variablePanel.children.at(-1).click();
assert.equal(ritualReload.saved().characters[0].sheet.rituais.length, 4, "proteção contra duplicata também existe no manipulador");
const ritualSaveFailure = openCharacter({ ...character, sheet: { rituais: [{ id: "keep", name: "Preservar" }] } }, { failStorage: true });
ritualSaveFailure.ids.openRitualCatalog.click(); queryRitual(ritualSaveFailure, "decadencia");
catalogRitual(ritualSaveFailure, "Decadência").children[1].children.at(-1).click();
assert.equal(ritualSaveFailure.saved().characters[0].sheet.rituais.length, 1);
assert.equal(vm.runInContext("character.sheet.rituais.length", ritualSaveFailure.context), 1);
assert.equal(ritualSaveFailure.ids.ritualCatalogDialog.open, true);
assert.match(ritualSaveFailure.ids.ritualCatalogMessage.textContent, /não foi adicionado/);
ritualSaveFailure.ids.closeRitualCatalog.click(); assert.equal(ritualSaveFailure.ids.ritualCatalogDialog.open, false);
const systemView = openCharacter({ ...character, nex: 40, sheet: { resources: {
    vida: { current: 39, max: 45, bonus: 0 }, esforco: { current: 17, max: 24, bonus: 0 },
    sanidade: { current: 37, max: 44, bonus: 0 }, determinacao: { current: 42, max: 69 }
} } });
assert.equal(systemView.ids.resourceSystemName.textContent, "Esforço e Sanidade");
assert.equal(systemView.ids.determinacaoResource.hidden, true);
const normalValues = [systemView.ids.vidaValue.textContent, systemView.ids.esforcoValue.textContent, systemView.ids.sanidadeValue.textContent];
systemView.ids.chooseResourceSystem.click(); assert.equal(systemView.ids.resourceSystemDialog.open, true);
systemView.ids.cancelResourceSystem.click(); assert.equal(systemView.ids.resourceSystemDialog.open, false);
assert.equal(systemView.saved().characters[0].sheet.resourceSystem, undefined, "cancelar não modifica os dados salvos");
systemView.ids.chooseResourceSystem.click(); systemView.ids.useDetermination.click();
assert.equal(systemView.ids.resourceSystemDialog.open, false);
assert.equal(systemView.ids.esforcoResource.hidden, true); assert.equal(systemView.ids.sanidadeResource.hidden, true);
assert.equal(systemView.ids.determinacaoResource.hidden, false);
assert.equal(systemView.ids.determinacaoValue.textContent, "42");
assert.equal(systemView.ids.determinacaoMaximum.textContent, "69");
assert.equal(systemView.ids.pePerTurn.textContent, "—", "não inventa limite de PD");
systemView.ids.determinacaoDecrease.click();
systemView.ids.determinacaoTurnInput.value = "9"; systemView.ids.determinacaoTurnInput.handlers.change();
assert.equal(systemView.ids.pePerTurn.textContent, "9");
assert.equal(systemView.ids.ritualDifficulty.textContent, "18", "limite manual de PD não altera DT");
systemView.ids.determinacaoMaxInput.value = "79"; systemView.ids.determinacaoMaxInput.handlers.change();
assert.equal(systemView.ids.determinacaoValue.textContent, "51", "mudar máximo preserva PD gastos");
systemView.ids.determinacaoMaxInput.value = "-1"; systemView.ids.determinacaoMaxInput.handlers.change();
assert.equal(systemView.ids.determinacaoMaxInput.value, "79");
systemView.ids.useEffortSanity.click();
assert.deepEqual([systemView.ids.vidaValue.textContent, systemView.ids.esforcoValue.textContent, systemView.ids.sanidadeValue.textContent], normalValues);
systemView.ids.useDetermination.click();
const systemReload = openCharacter(systemView.saved().characters[0]);
assert.equal(systemReload.ids.resourceSystemName.textContent, "Determinação");
assert.equal(systemReload.ids.determinacaoValue.textContent, "51");
assert.equal(systemReload.ids.pePerTurn.textContent, "9");
const systemFailure = openCharacter({ ...character, sheet: {} }, { failStorage: true });
systemFailure.ids.chooseResourceSystem.click(); systemFailure.ids.useDetermination.click();
assert.equal(systemFailure.ids.resourceSystemName.textContent, "Esforço e Sanidade");
assert.equal(systemFailure.ids.resourceSystemDialog.open, true, "troca não confirmada se falhou o salvamento");
const attributeRoll = openCharacter({ ...character, sheet: {} }, { dice: [4, 18, 3, 9] });
attributeRoll.ids.attributeWheelValues.children[0].children[1].click();
assert.match(attributeRoll.ids.skillRollResult.getAttribute("aria-label"), /Agilidade: 4d20.*Maior dado: 18.*Total: 18/);
attributeRoll.ids.attributeWheelValues.children[3].children[1].click();
assert.match(attributeRoll.ids.skillRollResult.getAttribute("aria-label"), /Presença: 2d20.*Menor dado: 4/);
assert.equal(attributeRoll.saved().characters[0].attributes.agilidade, 4, "rolar não edita atributos");
attributeRoll.ids.freeRollExpression.value = "2d6+3";
attributeRoll.ids.freeRollForm.handlers.submit({ preventDefault() {} });
assert.match(attributeRoll.ids.skillRollResult.getAttribute("aria-label"), /Rolagem livre.*Total: 7/);
const powerApi = require("../ability-catalog.js"); const ritualApi = require("../ritual-catalog.js");
const powerEntry = name => powerApi.entry(powerApi.catalog.find(item => item.name === name), name, false);
const healing = ritualApi.entry(ritualApi.catalog.find(item => item.name === "Cicatrização"), "healing", "", "");
const powerView = openCharacter({ ...character, nex: 40, sheet: {
    habilidades: [powerEntry("Sangue de Ferro"), powerEntry("Ritual Potente"), powerEntry("Sensitivo")], rituais: [healing]
} }, { dice: [1] });
assert.equal(powerView.ids.vidaMaximum.textContent, "61");
assert.match(powerView.ids.automaticEffectsSummary.textContent, /Sangue de Ferro/);
const healingControls = powerView.ids.ritualsList.children[0].children[1].children.find(child => child.className === "ritual-rolls");
assert.equal(healingControls.children.length, 3);
const resourcesBeforeRoll = JSON.stringify(vm.runInContext("character.sheet.resources", powerView.context));
healingControls.children[2].click();
assert.match(powerView.ids.skillRollResult.getAttribute("aria-label"), /Cicatrização · Verdadeiro.*bônus automático \+3.*Total: 17/);
assert.equal(JSON.stringify(vm.runInContext("character.sheet.resources", powerView.context)), resourcesBeforeRoll, "dados não gastam recurso nem curam");
powerView.ids.automaticEffects.checked = false; powerView.ids.automaticEffects.handlers.change();
assert.equal(powerView.ids.vidaMaximum.textContent, "45");
assert.equal(powerView.saved().characters[0].sheet.automaticEffects, false);
healingControls.children[0].click();
assert.match(powerView.ids.skillRollResult.getAttribute("aria-label"), /Total: 6/);
const meleeView = openCharacter({ ...character, sheet: { habilidades: [powerEntry("Golpe Pesado"), powerEntry("Mão Pesada"),
    powerApi.entry(powerApi.catalog.find(item => item.name === "Golpe de Sorte"), "luck", true)],
    inventario: [{ id: "blade", name: "Arma de teste", category: "armas", weaponStyle: "Corpo a Corpo", damage: "1d6", critical: "20", combat: { extraDamage: "1d8" } }],
    equippedWeaponId: "blade"
} }, { dice: [1] });
function damageAction(view, action) { return view.ids.equippedWeapon.children.find(child => child.className === "combat-actions").children.find(child => child.dataset.combatAction === action); }
damageAction(meleeView, "damage").click();
assert.match(meleeView.ids.skillRollResult.getAttribute("aria-label"), /2d6: 1, 1.*bônus fixo \+3.*Total: 6/);
damageAction(meleeView, "critical").click();
assert.match(meleeView.ids.skillRollResult.getAttribute("aria-label"), /6d6: 1, 1, 1, 1, 1, 1.*extra 1d8: 1.*Total: 10/);
assert.ok(meleeView.ids.equippedWeapon.children.some(child => child.textContent.includes("crítico efetivo 19/x3")));
const dynamicView = openCharacter(abilityView.saved().characters[0]);
dynamicView.ids.vidaDecrease.click();
const lossBefore = Number(dynamicView.ids.vidaMaximum.textContent) - Number(dynamicView.ids.vidaValue.textContent);
dynamicView.ids.nexSelect.value = "40"; dynamicView.ids.nexSelect.handlers.change();
assert.equal(Number(dynamicView.ids.vidaMaximum.textContent) - Number(dynamicView.ids.vidaValue.textContent), lossBefore);
const bloodEntryRow = dynamicView.ids.abilitiesList.children.find(row => row.children[0].textContent === "Sangue de Ferro (Afinidade)");
bloodEntryRow.children[1].children.at(-1).click();
assert.equal(dynamicView.ids.vidaMaximum.textContent, "45", "remover poder recalcula máximos");
assert.equal(Number(dynamicView.ids.vidaMaximum.textContent) - Number(dynamicView.ids.vidaValue.textContent), lossBefore);
assert.equal(openCharacter(dynamicView.saved().characters[0]).ids.vidaMaximum.textContent, "45");
console.log("Ficha desktop e celular: sistemas de recursos, atributos, poderes, combate e rituais: OK");
