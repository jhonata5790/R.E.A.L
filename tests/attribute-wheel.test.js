const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function contrast(first, second) {
    const luminance = (hex) => {
        const channels = hex.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
        const [red, green, blue] = channels.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return .2126 * red + .7152 * green + .0722 * blue;
    };
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
}

function openSheet(saved, search = "", failedImages = []) {
    class Element {
        constructor(tag = "div") {
            this.tag = tag;
            this.children = [];
            this.dataset = {};
            this.attributes = {};
            this.handlers = {};
            this.hidden = false;
            this.disabled = false;
            this.value = "";
            this.textContent = "";
            this.style = { setProperty: (name, value) => { this.style[name] = value; } };
            this.classList = {
                add: (name) => { this.className = `${this.className || ""} ${name}`; },
                remove: (name) => { this.className = (this.className || "").replace(name, "").trim(); }
            };
        }
        append(...items) { this.children.push(...items); }
        replaceChildren(...items) { this.children = items; }
        setAttribute(name, value) { this.attributes[name] = String(value); }
        getAttribute(name) { return this.attributes[name] ?? null; }
        removeAttribute(name) { delete this.attributes[name]; }
        addEventListener(name, handler) { this.handlers[name] = handler; }
        click() { if (!this.disabled) this.handlers.click?.({ currentTarget: this }); }
        querySelector(selector) {
            const className = selector.slice(1);
            for (const child of this.children) {
                if (child.className === className) return child;
                const nested = child.querySelector?.(selector);
                if (nested) return nested;
            }
            return undefined;
        }
        closest() { return this.parentFrame; }
        focus() {}
        set src(value) { this.attributes.src = value; }
        get src() { return this.attributes.src; }
    }

    const ids = Object.fromEntries([
        "storageNote", "attributesError", "originError", "classError", "finalError",
        "attributeWheelTargets", "attributeWheelImage", "attributeThemeLabel", "attributeRules", "attributeBudgetHint",
        "pointsRemaining", "selectedAttributeName", "selectedAttributeDescription",
        "selectedAttributeValue", "decreaseAttribute", "increaseAttribute",
        "originList", "classList", "sheetSummary", "previousStep", "nextStep",
        "saveCharacter", "deleteCharacter", "pageTitle", "pageDescription",
        "characterName", "sheetForm"
    ].map((id) => [id, new Element()]));
    const sections = Array.from({ length: 4 }, () => new Element());
    const stepButtons = Array.from({ length: 4 }, () => new Element("button"));
    const fields = Object.fromEntries([
        "name", "player", "appearance", "personality", "history", "objective"
    ].map((name) => [name, new Element("input")]));
    ids.characterName = fields.name;
    ids.attributeWheelImage.src = "assets/atributos-indefinido.png";
    ids.attributeWheelImage.parentFrame = new Element("figure");
    const memory = new Map();
    if (saved) memory.set("cronicas-biblioteca-v2", JSON.stringify(saved));
    const context = vm.createContext({
        document: {
            body: new Element("body"),
            title: "Criar ficha",
            getElementById: (id) => ids[id],
            querySelectorAll: (selector) => selector === ".sheet-step" ? sections : stepButtons,
            querySelector: (selector) => fields[selector.match(/name="([^"]+)"/)?.[1]],
            createElement: (tag) => new Element(tag),
            createTextNode: (text) => new Element(`text:${text}`)
        },
        window: { scrollTo() {}, setTimeout: (callback) => callback(), clearTimeout() {} },
        localStorage: {
            getItem: (key) => memory.get(key) ?? null,
            setItem: (key, value) => memory.set(key, value)
        },
        location: { search, href: "", replace() {} },
        URLSearchParams,
        FormData: class { constructor() { this.values = fields; } entries() { return Object.entries(this.values).map(([name, field]) => [name, field.value]); } },
        Image: class {
            set src(value) {
                if (failedImages.includes(value) || !fs.existsSync(path.join(root, value))) this.onerror();
                else this.onload();
            }
        },
        crypto: { randomUUID: () => "nova-ficha" },
        confirm: () => false
    });
    vm.runInContext(fs.readFileSync(path.join(root, "attribute-themes.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "nex-rules.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "origins.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "ficha.js"), "utf8"), context);
    return { context, ids, sections, stepButtons, fields, memory };
}

function originAt(ids, index) {
    const item = ids.originList.children[index];
    const [header, panel] = item.children;
    return { item, header, panel, badge: header.children[1], choose: panel.children[0].children[3] };
}

async function main() {
    const sheet = openSheet();
    const { ids, sections, fields, memory, context } = sheet;
    assert.equal(ids.pointsRemaining.textContent, 0);
    assert.equal(sections[0].hidden, false, "Classe é a primeira etapa");
    assert.equal(ids.attributeWheelTargets.children.length, 5);
    assert.equal(ids.attributeThemeLabel.textContent, "Classe ainda não definida");
    assert.equal(ids.attributeWheelImage.src, "assets/atributos-indefinido.png");
    for (const target of ids.attributeWheelTargets.children) assert.equal(target.tag, "button");
    assert.equal(ids.originList.children.length, 3);
    for (const [index, name] of ["Criminoso", "Amnésico", "Cultista Arrependido"].entries()) {
        const { item, header, panel, badge, choose } = originAt(ids, index);
        assert.equal(item.tag, "article", "o item externo não é um botão");
        assert.equal(header.tag, "button");
        assert.equal(header.type, "button");
        assert.equal(header.getAttribute("aria-label"), name);
        assert.equal(header.getAttribute("aria-controls"), panel.id);
        assert.equal(panel.getAttribute("aria-labelledby"), header.id);
        assert.equal(header.getAttribute("aria-expanded"), "false", "origens novas começam fechadas");
        assert.equal(panel.getAttribute("aria-hidden"), "true");
        assert.equal(panel.inert, true);
        assert.equal(badge.hidden, true);
        assert.equal(choose.tag, "button");
        assert.equal(choose.textContent, "Escolher esta origem");
        assert.equal(panel.children[0].children[0].tag, "p", "a descrição fica no painel separado");
        assert.equal(panel.children[0].children[2].children[0].tag, "h3", "a habilidade fica no painel");
    }
    const classGrid = ids.classList.children[0];
    const mundaneChoice = ids.classList.children[1];
    assert.equal(classGrid.children.length, 3, "três classes principais na grade");
    assert.equal(mundaneChoice.className, "mundane-choice", "Mundano fica fora dos cartões");
    const classNames = ["Combatente", "Especialista", "Ocultista", "Mundano"];
    for (const [index, name] of classNames.slice(0, 3).entries()) {
        const card = classGrid.children[index];
        const [heading, description, button] = card.children;
        assert.equal(card.tag, "article", "cartão e botão de escolha são elementos separados");
        assert.equal(heading.children[0].textContent, name);
        assert.equal(description.getAttribute("role"), "region");
        assert.equal(description.getAttribute("aria-labelledby"), heading.children[0].id);
        assert.equal(description.tabIndex, 0, "a descrição com rolagem é acessível pelo teclado");
        assert.equal(button.tag, "button");
        assert.equal(button.getAttribute("aria-pressed"), "false");
        assert.equal(button.getAttribute("aria-label"), `Escolher ${name}`);
    }
    assert.equal(mundaneChoice.children[0].textContent, "Ainda não escolheu uma das três classes da Ordem.");
    const classButtons = [...classGrid.children.map((card) => card.children[2]), mundaneChoice.children[1]];
    ids.nextStep.click();
    assert.equal(sections[0].hidden, false, "não avança sem escolher classe");
    assert.equal(ids.classError.textContent, "Escolha uma classe ou Mundano para continuar.");
    const classImages = [
        ["combatente", "assets/atributos-combatente.png"],
        ["especialista", "assets/atributos-especialista.png"],
        ["ocultista", "assets/atributos-ocultista.png"],
        ["mundano", "assets/atributos-mundano.png"]
    ];
    for (const [index, [classId, image]] of classImages.entries()) {
        classButtons[index].click();
        await Promise.resolve();
        assert.equal(ids.classError.hidden, true, "a escolha limpa o erro");
        assert.equal(classButtons[index].getAttribute("aria-pressed"), "true");
        assert.equal(classButtons[index].getAttribute("aria-label"), index === 3 ? "Mundano escolhido" : `Classe ${classNames[index]} escolhida`);
        if (index > 0) assert.equal(classButtons[index - 1].getAttribute("aria-pressed"), "false", "seleção anterior é removida");
        assert.equal(context.document.body.dataset.characterTheme, classId);
        assert.equal(ids.attributeWheelImage.src, image, `${classId} usa a arte correta`);
        assert.equal(ids.attributeThemeLabel.textContent, `Classe: ${classNames[index]}`);
        assert.equal(ids.pointsRemaining.textContent, classId === "mundano" ? 3 : 4);
        assert.equal(context.document.body.style["--border"], context.window.REAL_ATTRIBUTE_THEMES[classId].border);
        for (const [targetIndex, attribute] of ["agilidade", "forca", "intelecto", "presenca", "vigor"].entries()) {
            const [x, y] = context.window.REAL_ATTRIBUTE_THEMES[classId].centers[attribute];
            const target = ids.attributeWheelTargets.children[targetIndex];
            assert.equal(target.style["--wheel-x"], `${x}%`);
            assert.equal(target.style["--wheel-y"], `${y}%`);
        }
    }
    assert.equal(mundaneChoice.children[1].textContent, "Mundano escolhido");
    classButtons[0].click();
    await Promise.resolve();
    assert.equal(classGrid.children[0].children[0].children[1].hidden, false, "classe escolhida mostra selo");
    assert.equal(mundaneChoice.dataset.selected, "false");

    ids.nextStep.click();
    assert.equal(sections[1].hidden, false, "Atributos é a segunda etapa");
    assert.equal(ids.pointsRemaining.textContent, 4);
    assert.match(ids.attributeRules.textContent, /4 pontos/);
    ids.nextStep.click();
    assert.equal(sections[1].hidden, false, "não avança com pontos pendentes");
    ids.increaseAttribute.click();
    ids.increaseAttribute.click();
    assert.equal(ids.selectedAttributeValue.textContent, 3);
    assert.equal(String(ids.attributeWheelTargets.children[0].children[0].textContent), "3");
    assert.equal(ids.increaseAttribute.disabled, true, "máximo inicial é 3");
    ids.attributeWheelTargets.children[1].click();
    ids.decreaseAttribute.click();
    ids.attributeWheelTargets.children[3].click();
    ids.decreaseAttribute.click();
    assert.equal(ids.selectedAttributeValue.textContent, 0, "mais de um atributo pode chegar a zero");
    assert.equal(ids.pointsRemaining.textContent, 4);
    ids.attributeWheelTargets.children[2].click();
    ids.increaseAttribute.click();
    ids.increaseAttribute.click();
    ids.attributeWheelTargets.children[4].click();
    ids.increaseAttribute.click();
    ids.increaseAttribute.click();
    assert.equal(ids.pointsRemaining.textContent, 0);
    ids.nextStep.click();
    assert.equal(sections[2].hidden, false, "Origem é a terceira etapa");
    ids.nextStep.click();
    assert.equal(sections[2].hidden, false, "não avança sem escolher origem");
    assert.equal(ids.originError.textContent, "Escolha uma origem para continuar.");
    const firstOrigin = originAt(ids, 0);
    const secondOrigin = originAt(ids, 1);
    firstOrigin.header.click();
    assert.equal(firstOrigin.header.getAttribute("aria-expanded"), "true");
    assert.equal(firstOrigin.panel.inert, false);
    assert.equal(firstOrigin.badge.hidden, true, "abrir não seleciona");
    assert.equal(ids.originError.hidden, false, "abrir não limpa o erro de seleção");
    secondOrigin.header.click();
    assert.equal(firstOrigin.header.getAttribute("aria-expanded"), "false", "apenas uma origem aberta");
    assert.equal(secondOrigin.header.getAttribute("aria-expanded"), "true");
    secondOrigin.header.click();
    assert.equal(secondOrigin.header.getAttribute("aria-expanded"), "false", "clicar novamente fecha");
    firstOrigin.header.click();
    firstOrigin.choose.click();
    assert.equal(firstOrigin.item.dataset.selected, "true");
    assert.equal(firstOrigin.badge.hidden, false);
    assert.equal(firstOrigin.choose.textContent, "Origem escolhida");
    assert.equal(firstOrigin.choose.disabled, true);
    assert.equal(firstOrigin.header.getAttribute("aria-expanded"), "false", "painel fecha após escolher");
    assert.equal(ids.originError.hidden, true, "escolher limpa o erro");
    firstOrigin.header.click();
    assert.equal(firstOrigin.header.getAttribute("aria-expanded"), "true", "origem escolhida pode ser consultada");
    secondOrigin.header.click();
    secondOrigin.choose.click();
    assert.equal(firstOrigin.item.dataset.selected, "false", "seleção anterior removida");
    assert.equal(firstOrigin.badge.hidden, true);
    assert.equal(firstOrigin.choose.disabled, false);
    assert.equal(secondOrigin.item.dataset.selected, "true");
    assert.equal(secondOrigin.header.getAttribute("aria-label"), "Amnésico, escolhida");
    ids.nextStep.click();
    assert.equal(sections[3].hidden, false);
    ids.previousStep.click();
    ids.previousStep.click();
    assert.equal(sections[1].hidden, false, "voltar chega à etapa de Atributos");
    assert.equal(ids.attributeThemeLabel.textContent, "Classe: Combatente");
    assert.equal(ids.attributeWheelImage.src, "assets/atributos-combatente.png");
    assert.equal(ids.pointsRemaining.textContent, 0);
    ids.attributeWheelTargets.children[1].click();
    assert.equal(ids.decreaseAttribute.getAttribute("aria-label"), "Diminuir Força");
    assert.equal(ids.attributeWheelTargets.children[1].getAttribute("aria-pressed"), "true");
    assert.equal(ids.attributeWheelTargets.children[1].getAttribute("aria-label"), "Selecionar Força, valor 0");
    assert.equal(ids.decreaseAttribute.disabled, true, "um atributo em zero não pode diminuir mais");
    ids.attributeWheelTargets.children[4].click();
    ids.decreaseAttribute.click();
    assert.equal(ids.pointsRemaining.textContent, 1);
    ids.increaseAttribute.click();
    assert.equal(ids.pointsRemaining.textContent, 0);
    ids.previousStep.click();
    assert.equal(sections[0].hidden, false, "é possível voltar à classe");
    classButtons[3].click();
    assert.equal(ids.pointsRemaining.textContent, -1, "Mundano tem um ponto a menos que agentes");
    ids.nextStep.click();
    assert.equal(sections[1].hidden, false);
    ids.nextStep.click();
    assert.equal(sections[1].hidden, false, "trocar para Mundano exige redistribuir os pontos");
    assert.match(ids.attributesError.textContent, /não exceder/);
    ids.previousStep.click();
    classButtons[0].click();
    assert.equal(ids.pointsRemaining.textContent, 0);

    sheet.stepButtons[3].click();
    fields.name.value = "Personagem de teste";
    ids.sheetForm.handlers.submit({ preventDefault() {}, currentTarget: ids.sheetForm });
    const saved = JSON.parse(memory.get("cronicas-biblioteca-v2"));
    assert.equal(context.location.href, "personagem.html?id=nova-ficha", "salvar abre a ficha concluída");
    assert.equal(saved.characters[0].class, "combatente");
    assert.equal(saved.characters[0].nex, 5, "classes da Ordem começam em 5% de NEX");
    assert.equal(saved.characters[0].origin, "amnesico");
    assert.equal(saved.characters[0].originName, "Amnésico");
    assert.equal(saved.characters[0].attributes.agilidade, 3);
    assert.equal(saved.characters[0].attributes.forca, 0);
    assert.equal(saved.characters[0].attributes.presenca, 0);
    assert.ok(Object.values(saved.characters[0].attributes).every((value) => value <= 3), "ficha nova respeita o máximo inicial");

    const edit = openSheet(saved, "?id=nova-ficha");
    await Promise.resolve();
    assert.equal(edit.ids.attributeThemeLabel.textContent, "Classe: Combatente");
    assert.equal(edit.ids.attributeWheelImage.src, "assets/atributos-combatente.png");
    assert.equal(edit.ids.selectedAttributeValue.textContent, 3);
    assert.equal(edit.ids.classList.children[0].children[0].dataset.selected, "true", "edição preserva classe selecionada");
    assert.equal(edit.ids.classList.children[0].children[0].children[2].getAttribute("aria-pressed"), "true");
    const editedOrigin = originAt(edit.ids, 1);
    assert.equal(editedOrigin.item.dataset.selected, "true");
    assert.equal(editedOrigin.badge.hidden, false);
    assert.equal(editedOrigin.header.getAttribute("aria-expanded"), "true", "edição abre origem salva");
    assert.equal(editedOrigin.panel.getAttribute("aria-hidden"), "false");
    assert.equal(editedOrigin.choose.textContent, "Origem escolhida");

    const advancedSaved = JSON.parse(JSON.stringify(saved));
    advancedSaved.characters[0].nex = 50;
    const advancedEdit = openSheet(advancedSaved, "?id=nova-ficha");
    advancedEdit.ids.sheetForm.handlers.submit({ preventDefault() {}, currentTarget: advancedEdit.ids.sheetForm });
    assert.equal(JSON.parse(advancedEdit.memory.get("cronicas-biblioteca-v2")).characters[0].nex, 50, "editar preserva o NEX existente");
    advancedEdit.ids.classList.children[1].children[1].click();
    advancedEdit.ids.sheetForm.handlers.submit({ preventDefault() {}, currentTarget: advancedEdit.ids.sheetForm });
    assert.equal(advancedEdit.sections[1].hidden, false, "salvar como Mundano exige adequar os atributos");
    assert.equal(JSON.parse(advancedEdit.memory.get("cronicas-biblioteca-v2")).characters[0].class, "combatente", "a ficha não muda antes de ser válida");
    advancedEdit.ids.attributeWheelTargets.children[4].click();
    advancedEdit.ids.decreaseAttribute.click();
    assert.equal(advancedEdit.ids.pointsRemaining.textContent, 0);
    advancedEdit.ids.sheetForm.handlers.submit({ preventDefault() {}, currentTarget: advancedEdit.ids.sheetForm });
    assert.equal(JSON.parse(advancedEdit.memory.get("cronicas-biblioteca-v2")).characters[0].nex, 0, "mudar para Mundano ajusta o NEX para 0%");

    const legacySaved = JSON.parse(JSON.stringify(saved));
    legacySaved.characters[0].attributes = { agilidade: 5, forca: 1, intelecto: 1, presenca: 1, vigor: 1 };
    const legacyEdit = openSheet(legacySaved, "?id=nova-ficha");
    assert.equal(legacyEdit.ids.selectedAttributeValue.textContent, 5, "fichas antigas mantêm os valores armazenados");
    assert.match(legacyEdit.ids.attributeBudgetHint.textContent, /Distribuição antiga preservada/);
    legacyEdit.ids.sheetForm.handlers.submit({ preventDefault() {}, currentTarget: legacyEdit.ids.sheetForm });
    assert.equal(JSON.parse(legacyEdit.memory.get("cronicas-biblioteca-v2")).characters[0].attributes.agilidade, 5, "salvar outros campos não altera atributos legados");

    const newMundane = openSheet();
    newMundane.ids.classList.children[1].children[1].click();
    newMundane.ids.nextStep.click();
    assert.equal(newMundane.ids.pointsRemaining.textContent, 3);
    newMundane.ids.increaseAttribute.click();
    newMundane.ids.increaseAttribute.click();
    newMundane.ids.attributeWheelTargets.children[1].click();
    newMundane.ids.decreaseAttribute.click();
    newMundane.ids.attributeWheelTargets.children[2].click();
    newMundane.ids.increaseAttribute.click();
    newMundane.ids.increaseAttribute.click();
    assert.equal(newMundane.ids.pointsRemaining.textContent, 0);
    newMundane.ids.nextStep.click();
    originAt(newMundane.ids, 0).choose.click();
    newMundane.ids.nextStep.click();
    newMundane.fields.name.value = "Mundano de teste";
    newMundane.ids.sheetForm.handlers.submit({ preventDefault() {}, currentTarget: newMundane.ids.sheetForm });
    const mundaneSaved = JSON.parse(newMundane.memory.get("cronicas-biblioteca-v2")).characters[0];
    assert.equal(mundaneSaved.class, "mundano");
    assert.equal(mundaneSaved.nex, 0);
    assert.equal(Object.values(mundaneSaved.attributes).reduce((total, value) => total + value, 0), 8, "Mundano distribui três pontos além dos valores iniciais");

    const allZero = openSheet();
    allZero.ids.classList.children[0].children[0].children[2].click();
    allZero.ids.nextStep.click();
    for (const target of allZero.ids.attributeWheelTargets.children) {
        target.click();
        allZero.ids.decreaseAttribute.click();
        assert.equal(allZero.ids.selectedAttributeValue.textContent, 0);
    }
    assert.equal(allZero.ids.pointsRemaining.textContent, 9, "qualquer quantidade de atributos pode ficar em zero e gerar pontos");

    const fallback = openSheet(saved, "?id=nova-ficha", ["assets/atributos-combatente.png"]);
    await Promise.resolve();
    assert.equal(fallback.ids.attributeWheelImage.src, "assets/atributos-indefinido.png", "falha de carregamento usa a roda indefinida");

    const themes = context.window.REAL_ATTRIBUTE_THEMES;
    for (const [themeId, theme] of Object.entries(themes)) {
        const image = fs.readFileSync(path.join(root, theme.image));
        assert.equal(image.toString("ascii", 1, 4), "PNG", `${themeId}: arquivo PNG`);
        assert.equal(image.readUInt32BE(16), 1254, `${themeId}: largura`);
        assert.equal(image.readUInt32BE(20), 1254, `${themeId}: altura`);
        for (const [attribute, [x, y]] of Object.entries(theme.centers)) {
            assert.ok(x >= 12.5 && x <= 87.5 && y >= 12.5 && y <= 87.5, `${themeId}/${attribute}: alvo dentro da roda`);
        }
        assert.ok(contrast(theme.accentInk, theme.accent) >= 4.5, `${themeId}: texto dos botões com contraste`);
        assert.ok(contrast(theme.accentLight, "#1c1c1e") >= 4.5, `${themeId}: destaque claro com contraste`);
    }
    const html = fs.readFileSync(path.join(root, "ficha.html"), "utf8");
    assert.match(html, /src="assets\/atributos-indefinido\.png"/);
    assert.deepEqual(
        [...html.matchAll(/<section class="sheet-step[^\"]*" data-step="(\d)" aria-labelledby="([^\"]+)"/g)].map((match) => [match[1], match[2]]),
        [["0", "classTitle"], ["1", "attributesTitle"], ["2", "originTitle"], ["3", "finalTitle"]],
        "a ordem real das seções acompanha Classe → Atributos → Origem → Toques finais"
    );
    assert.match(html, /data-step-button="0"[^>]*>[^<]*<span>01<\/span> Classe/);
    assert.match(html, /data-step-button="1"[^>]*>[^<]*<span>02<\/span> Atributos/);

    const css = fs.readFileSync(path.join(root, "ficha.css"), "utf8");
    assert.match(css, /@media \(max-width: 850px\)[\s\S]*?\.attributes-layout \{ grid-template-columns: 1fr/);
    assert.match(css, /\.attribute-wheel \{[^}]*width: min\(100%, 620px\); aspect-ratio: 1/);
    assert.match(css, /\.attribute-wheel__target \{[^}]*width: max\(25%, 44px\); height: max\(25%, 44px\)/);
    assert.match(css, /@media \(max-width: 380px\)[\s\S]*?\.attribute-selection__controls button \{ width: 48px; height: 48px/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /\.class-grid \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.class-card__description \{[^}]*overflow-y: auto/);
    assert.match(css, /\.mundane-choice \{[^}]*justify-content: flex-end/);
    assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.class-grid, \.final-grid \{ grid-template-columns: 1fr/);
    assert.match(css, /\.origin-item__header \{[^}]*min-height: 64px/);
    assert.match(css, /\.origin-item__panel \{[^}]*grid-template-rows: 0fr/);
    assert.match(css, /\.origin-item\[data-open="true"\] \.origin-item__panel \{ grid-template-rows: 1fr/);
    assert.match(css, /\.origin-item__choose \{ min-height: 44px/);
    assert.match(css, /@media \(max-width: 680px\)[\s\S]*?\.origin-item__choose \{ width: 100%/);
    assert.match(css, /overflow-x: clip/);
    for (const width of [240, 320, 390, 620]) assert.ok(Math.max((width - 50) * .25, 44) >= 44);
    console.log("Atributos, Origem e Classe: layout, seleção, validação, edição, salvamento, temas e responsividade: OK");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
