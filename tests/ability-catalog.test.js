const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const api = require("../ability-catalog.js");

assert.equal(api.catalog.length, 163);
assert.equal(new Set(api.catalog.map(item => item.id)).size, 163);
assert.ok(Object.isFrozen(api.catalog));
for (const [category, expected] of Object.entries({ combatente: 40, especialista: 38, ocultista: 37, origens: 26, paranormal: 22 })) {
    assert.equal(api.catalog.filter(item => item.category === category).length, expected);
}
for (const category of ["combatente", "especialista", "ocultista"]) {
    const trails = api.catalog.filter(item => item.category === category && item.kind === "Habilidade de trilha");
    assert.equal(new Set(trails.map(item => item.subgroup)).size, 5);
    for (const trail of new Set(trails.map(item => item.subgroup))) assert.deepEqual(trails.filter(item => item.subgroup === trail).map(item => item.minNex), [10, 40, 65, 99]);
}
for (const item of api.catalog) {
    assert.ok(Object.isFrozen(item));
    assert.equal(item.book, "Ordem Paranormal");
    assert.equal(item.source, "https://crisordemparanormal.com/");
    assert.ok(item.name && item.description && item.subgroup && api.categories[item.category]);
    assert.ok(api.classification(item).includes(api.categories[item.category]));
}
assert.ok(!api.catalog.some(item => item.name === "Fraternidade Gaudéria"), "conteúdo extra não entra como livro básico");
assert.equal(api.normalize("LÂMINA Paranormal"), "lamina paranormal");
const blood = api.catalog.find(item => item.name === "Sangue de Ferro");
const plain = api.entry(blood, "normal", false, "");
const affinity = api.entry(blood, "afinidade", true, "Afinidade escolhida com Sangue");
assert.equal(plain.affinity, false);
assert.ok(!plain.description.includes("Afinidade:"));
assert.equal(affinity.affinity, true);
assert.match(affinity.description, /Afinidade:.*Fortitude/);
assert.match(affinity.description, /Escolhas\/anotações:/);
assert.equal(api.duplicate(blood, [plain]), true);
assert.equal(api.duplicate(blood, [affinity]), true);
assert.equal(api.duplicate(blood, [{ name: "SANGUE DE FERRO" }]), true);
assert.equal(api.duplicate(blood, []), false);
const memory = api.catalog.find(item => item.name === "Vislumbres do Passado");
assert.equal(api.duplicate(memory, [], "Vislumbres do Passado"), true);
for (const name of ["Transcender", "Treinamento em Perícia", "Aprender Ritual", "Resistir a <Elemento>"]) {
    const item = api.catalog.find(item => item.name === name);
    assert.equal(api.duplicate(item, [api.entry(item, "old", false, "")]), false);
}
const html = fs.readFileSync(path.join(__dirname, "..", "personagem.html"), "utf8");
assert.match(html, /id="openAbilityCatalog"/);
assert.match(html, /data-add-entry="habilidades">Criar habilidade/);
assert.match(html, /aria-label="Poderes, trilhas e elementos"/);
assert.match(html, /ability-catalog\.js\?v=20261002-abilities/);
assert.match(html, /id="automaticEffects"/);
assert.match(html, /Não repita nos ajustes manuais os bônus listados/);
console.log("Catálogo de habilidades: classificação, 15 trilhas, origens, elementos, afinidade e duplicatas: OK");
