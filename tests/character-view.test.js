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
        ...["vida", "esforco", "sanidade"].flatMap((id) => [`${id}Value`, `${id}Maximum`, `${id}Current`, `${id}Progress`, `${id}Bonus`, `${id}Decrease`, `${id}Increase`]),
        "characterOrigin", "characterClass", "characterPlayer", "characterCampaign",
        "editCharacter", "characterAppearance", "characterPersonality",
        "characterHistory", "characterObjective", "attributeWheelImage",
        "attributeWheelValues", "attributeList", "storageNote", "noteWorkspace", "noteCanvas",
        "skillsBody", "skillRollResult", "originTrainingSummary", "originTrainingChoices",
        "originSkillChoice1", "originSkillChoice2", "originTrainingMessage",
        "toggleNotesFullscreen", "entryDialog", "entryDialogTitle", "entryCategoryField",
        "entryCategory", "entryForm", "entryName", "entryDescription", "cancelEntry",
        "inventoryList", "abilitiesList", "ritualsList", "equippedWeapon",
        ...["informacoes", "descricoes", "atributos", "pericias", "combate", "inventario", "habilidades", "rituais"].map((id) => `panel-${id}`),
        "subpanel-textos", "subpanel-anotacoes"
    ].map((id) => [id, new Element()]));
    const sheetTabs = ["informacoes", "descricoes", "atributos", "pericias", "combate", "inventario", "habilidades", "rituais"].map((id) => {
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
    const inventoryFilters = ["todos", "itens", "armas", "protecao", "geral", "amaldicoados"].map((id) => {
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
        localStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value; } },
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
const cultistResources = openCharacter({ ...character, class: "ocultista", role: "Ocultista", origin: "cultista-arrependido", originName: "Cultista Arrependido" });
assert.equal(cultistResources.ids.sanidadeMaximum.textContent, "10", "Cultista Arrependido perde metade da Sanidade inicial");
cultistResources.ids.nexSelect.value = "10";
cultistResources.ids.nexSelect.handlers.change();
assert.equal(cultistResources.ids.sanidadeMaximum.textContent, "15", "avanços posteriores concedem Sanidade integral");
const mundaneResources = openCharacter({ ...character, class: "mundano", role: "Mundano" });
assert.equal(mundaneResources.ids.nexSelect.value, "0");
assert.equal(mundaneResources.ids.vidaMaximum.textContent, "9");
assert.equal(mundaneResources.ids.esforcoMaximum.textContent, "1");
assert.equal(mundaneResources.ids.sanidadeMaximum.textContent, "8");
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
assert.equal(ids.attributeList.children.length, 5);
assert.deepEqual(ids.attributeWheelValues.children.map((marker) => marker.children[0].textContent), ["4", "1", "3", "0", "1"]);
assert.equal(ids.attributeWheelValues.children[0].style["--wheel-x"], "50%");
assert.equal(ids.attributeList.children[3].children[0].textContent, "Presença");
assert.equal(ids.attributeList.children[3].children[1].textContent, "0");
assert.equal(ids.characterHistory.textContent, "Busca pistas do passado.");
assert.equal(ids.characterObjective.textContent, "Encontrar a verdade.");
assert.match(ids.equippedWeapon.children[0].textContent, /Nenhuma arma equipada/);
assert.equal(ids.abilitiesList.children.length, 1, "a habilidade da origem aparece mesmo sem habilidades manuais");
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
assert.equal(originDetails.children[1].textContent, "Uma vez por sessão, faça um teste de Intelecto (DT 10) ao encontrar alguém ou algum lugar familiar. Se passar, receba 1d4 PE temporários e uma informação útil, a critério do mestre.");
assert.equal(originDetails.children.some((child) => child.tag === "button"), false, "a habilidade da origem não pode ser removida");
originToggle.click();
assert.equal(originDetails.hidden, true, "clicar novamente fecha a habilidade");
assert.equal(saved().characters[0].sheet, undefined, "mostrar a habilidade não altera o formato da ficha salva");
assert.equal(sheetTabs.length, 8);
assert.equal(sheetTabs[0].getAttribute("aria-selected"), "true");
assert.equal(ids["panel-atributos"].hidden, true);
sheetTabs[1].click();
assert.equal(ids["panel-informacoes"].hidden, true);
assert.equal(ids["panel-descricoes"].hidden, false);
sheetTabs[1].handlers.keydown({ key: "ArrowRight", preventDefault() {} });
assert.equal(sheetTabs[2].getAttribute("aria-selected"), "true", "setas navegam pelas abas");
assert.equal(sheetTabs[2].focused, true);
assert.equal(ids["panel-atributos"].hidden, false);
const desktopView = openCharacter(character, { desktopViewport: true });
assert.equal(desktopView.ids.sheetTabs.getAttribute("role"), "navigation");
for (const id of ["informacoes", "atributos", "pericias", "combate"]) {
    assert.equal(desktopView.ids[`panel-${id}`].hidden, false, `${id} aparece no painel desktop`);
    assert.equal(desktopView.ids[`panel-${id}`].getAttribute("role"), "region");
}
assert.equal(desktopView.ids["panel-inventario"].hidden, true);
desktopView.sheetTabs[5].click();
assert.equal(desktopView.ids["panel-inventario"].hidden, false);
assert.equal(desktopView.ids["panel-combate"].hidden, true);
assert.equal(desktopView.ids["panel-pericias"].hidden, false, "trocar a seção complementar não esconde as perícias");
assert.equal(desktopView.sheetTabs[5].getAttribute("aria-pressed"), "true");
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
assert.equal(saved().characters[0].sheet.notes[0].text, "Ligação com o culto");
assert.equal(saved().characters[0].sheet.notes[0].x, 45);
ids.toggleNotesFullscreen.click();
assert.equal(ids.noteWorkspace.classList.contains("is-expanded"), true);

addEntryButtons[1].click();
assert.equal(ids.entryDialog.open, true);
ids.entryName.value = "Instinto de sobrevivência";
ids.entryDescription.value = "Uma habilidade anotada pelo jogador.";
ids.entryForm.handlers.submit({ preventDefault() {} });
assert.equal(ids.entryDialog.open, false);
assert.equal(saved().characters[0].sheet.habilidades[0].name, "Instinto de sobrevivência");
assert.equal(ids.abilitiesList.children.length, 2, "habilidade manual aparece junto da habilidade de origem");
assert.equal(ids.abilitiesList.children[1].children[0].textContent, "Instinto de sobrevivência");
const refreshedOrigin = ids.abilitiesList.children[0];
const manualAbility = ids.abilitiesList.children[1];
refreshedOrigin.children[0].click();
manualAbility.children[0].click();
assert.equal(refreshedOrigin.children[1].hidden, true, "abrir outra habilidade fecha a anterior");
assert.equal(refreshedOrigin.children[0].getAttribute("aria-expanded"), "false");
assert.equal(manualAbility.children[1].hidden, false);
assert.equal(manualAbility.children[1].children[0].textContent, "Habilidade adicionada");
assert.equal(manualAbility.children[1].children[1].textContent, "Uma habilidade anotada pelo jogador.");

inventoryFilters[2].click();
assert.equal(inventoryFilters[2].getAttribute("aria-pressed"), "true");
addEntryButtons[0].click();
ids.entryName.value = "Revólver";
ids.entryCategory.value = "armas";
ids.entryDescription.value = "Ainda sem dano definido.";
ids.entryForm.handlers.submit({ preventDefault() {} });
assert.equal(saved().characters[0].sheet.inventario[0].category, "armas");
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
inventoryFilters[3].click();
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
assert.equal(reloaded.ids.abilitiesList.children.length, 2, "habilidade de origem e manual reaparecem sem duplicação");
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
    ["cultista-arrependido", "Cultista Arrependido", "Traços do Outro Lado", "Escolha um poder paranormal. Você começa o jogo com metade da Sanidade normal para a sua classe."]
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
assert.equal(changedAbilityOrigin.ids.abilitiesList.children.length, 2);
assert.equal(changedAbilityOrigin.ids.abilitiesList.children[0].children[0].textContent, "O Crime Compensa", "trocar a origem troca a habilidade automática");
assert.equal(changedAbilityOrigin.ids.abilitiesList.children[1].children[0].textContent, "Instinto de sobrevivência", "habilidade manual é preservada");
changedAbilityOrigin.ids.abilitiesList.children[1].children[1].children[2].click();
assert.equal(changedAbilityOrigin.saved().characters[0].sheet.habilidades.length, 0, "remover habilidade manual não altera a origem");
assert.equal(changedAbilityOrigin.ids.abilitiesList.children.length, 1);
assert.equal(changedAbilityOrigin.ids.abilitiesList.children[0].children[0].textContent, "O Crime Compensa");
const manualDuplicate = openCharacter({
    ...character,
    origin: "criminoso",
    originName: "Criminoso",
    sheet: { habilidades: [{ id: "antiga", name: "O Crime Compensa", description: "Ao fim de uma missão, escolha um item encontrado. Na próxima missão, ele pode entrar no inventário sem contar no limite de itens por patente." }] }
});
assert.equal(manualDuplicate.ids.abilitiesList.children.length, 1, "uma cópia manual idêntica não duplica a habilidade na tela");
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
assert.equal(criminal.ids.skillsBody.children[6].children[2].children[0].textContent, "+10", "treino manual superior prevalece");
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
assert.equal(legacy.ids.attributeList.children[0].children[1].textContent, "—", "valores desconhecidos não são inventados");
assert.equal(legacy.ids.characterAppearance.classes["is-empty"], true);
legacy.ids.skillsBody.children[6].children[0].children[0].children[0].click();
assert.match(legacy.ids.skillRollResult.getAttribute("aria-label"), /atributo de Crime ainda não tem um valor salvo/, "valor de atributo ausente continua gerando uma mensagem útil");

const missing = openCharacter(null);
assert.equal(missing.ids.missingCharacter.hidden, false);
assert.equal(missing.ids.characterContent.hidden, true);

assert.match(fs.readFileSync(path.join(root, "campaign.js"), "utf8"), /personagem\.html\?id=/);
assert.match(fs.readFileSync(path.join(root, "ficha.js"), "utf8"), /if \(persistState\(\)\) location\.href = "personagem\.html\?id="/);
const css = fs.readFileSync(path.join(root, "personagem.css"), "utf8");
const html = fs.readFileSync(path.join(root, "personagem.html"), "utf8");
assert.equal((html.match(/data-sheet-tab=/g) || []).length, 8);
assert.match(html, /id="sheetTabs" class="sheet-tabs"/);
assert.match(html, /data-description-tab="anotacoes"/);
assert.match(html, /data-add-shape="triangle"/);
assert.match(html, /<tbody id="skillsBody"><\/tbody>/);
assert.match(html, /id="equippedWeapon" aria-live="polite"/);
assert.match(html, /id="nexSelect"/);
assert.match(html, /id="vidaCurrent"/);
assert.match(html, /id="esforcoCurrent"/);
assert.match(html, /id="sanidadeCurrent"/);
assert.match(html, /id="ritualDifficulty"/);
assert.match(html, /<script src="nex-rules\.js\?v=[^"]+"><\/script>/);
assert.ok(html.indexOf('id="skillRollResult"') > html.indexOf("</main>"), "resultado flutuante fica fora da aba que pode ser escondida");
assert.match(html, /id="skillRollResult"[^>]*hidden/);
assert.match(html, /Marcador de treino \(não bloqueia rolagens\)/);
for (const id of ["inventoryList", "abilitiesList", "ritualsList"]) assert.match(html, new RegExp(`id="${id}" class="entry-list entry-list--accordion"`));
assert.match(html, /<script src="origins\.js\?v=[^"]+"><\/script>/);
assert.match(css, /\.entry-list article\.entry-item \{[^}]*background:[^;]*#2d2d32/);
assert.match(css, /\.entry-list article\.entry-item\.entry-list__origin \{ border-left: 3px solid var\(--accent\)/);
assert.match(css, /\.entry-item__equip-check \{[^}]*width: 44px; height: 44px/);
assert.match(css, /\.skill-roll-result \{ position: fixed; right:/);
assert.match(css, /\.roll-result__more:hover \.roll-result__tooltip, \.roll-result__more:focus-within \.roll-result__tooltip/);
assert.match(css, /\.entry-item__toggle--weapon::after \{[^}]*right: 21px/);
assert.match(css, /\.entry-item__equip-check \{[^}]*right: 51px/);
assert.match(css, /@media \(max-width: 850px\)/);
assert.match(css, /@media \(min-width: 1100px\)/);
assert.match(css, /@media \(min-width: 1500px\)/);
assert.match(css, /#panel-pericias \{ grid-column: 2; grid-row: 2 \/ span 2;/);
assert.match(css, /@media \(max-width: 620px\)/);
assert.match(css, /overflow-x: clip/);
console.log("Ficha desktop e celular: NEX, recursos, perícias, atributos, equipamento e salvamento: OK");
