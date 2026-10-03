const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const origins = require("../origins.js");
const abilities = require("../ability-catalog.js").catalog.filter((item) => item.category === "origens");

// Mapeamento conferido nos cartões de criação do CRIS, não gerado pelo catálogo.
const expected = [
    ["Acadêmico", "ciencias investigacao", "Saber é Poder"],
    ["Agente de Saúde", "intuicao medicina", "Técnica Medicinal"],
    ["Amnésico", "", "Vislumbres do Passado"],
    ["Artista", "artes enganacao", "Magnum Opus"],
    ["Atleta", "acrobacia atletismo", "110%"],
    ["Chef", "fortitude profissao", "Ingrediente Secreto"],
    ["Criminoso", "crime furtividade", "O Crime Compensa"],
    ["Cultista Arrependido", "ocultismo religiao", "Traços do Outro Lado"],
    ["Desgarrado", "fortitude sobrevivencia", "Calejado"],
    ["Engenheiro", "profissao tecnologia", "Ferramentas Favoritas"],
    ["Executivo", "diplomacia profissao", "Processo Otimizado"],
    ["Investigador", "investigacao percepcao", "Faro para Pistas"],
    ["Lutador", "luta reflexos", "Mão Pesada"],
    ["Magnata", "diplomacia pilotagem", "Patrocinador da Ordem"],
    ["Mercenário", "iniciativa intimidacao", "Posição de Combate"],
    ["Militar", "pontaria tatica", "Para Bellum"],
    ["Operário", "fortitude profissao", "Ferramenta de Trabalho"],
    ["Policial", "percepcao pontaria", "Patrulha"],
    ["Religioso", "religiao vontade", "Acalentar"],
    ["Servidor Público", "intuicao vontade", "Espírito Cívico"],
    ["Teórico da Conspiração", "investigacao ocultismo", "Eu Já Sabia"],
    ["T.I.", "investigacao tecnologia", "Motor de Busca"],
    ["Trabalhador Rural", "adestramento sobrevivencia", "Desbravador"],
    ["Trambiqueiro", "crime enganacao", "Impostor"],
    ["Universitário", "atualidades investigacao", "Dedicação"],
    ["Vítima", "reflexos vontade", "Cicatrizes Psicológicas"]
];
assert.equal(origins.length, 26);
assert.equal(new Set(origins.map((item) => item.id)).size, 26);
assert.equal(new Set(origins.map((item) => item.name)).size, 26);
assert.ok(Object.isFrozen(origins));
const skillSource = fs.readFileSync(path.join(__dirname, "../personagem.js"), "utf8");
for (const [index, [name, skills, ability]] of expected.entries()) {
    const item = origins[index];
    assert.equal(item.name, name);
    assert.deepEqual(item.trainedSkills, skills ? skills.split(" ") : []);
    assert.equal(item.ability, ability);
    assert.equal(abilities.find((entry) => entry.origin === name)?.name, ability, `${name}: catálogo de habilidades consistente`);
    assert.ok(Object.isFrozen(item) && Object.isFrozen(item.trainedSkills));
    assert.match(item.book, /Livro de Regras/);
    assert.equal(item.source, "https://crisordemparanormal.com/novo-agente");
    assert.ok(item.description.length > 30 && item.effect.length >= 10, `${name}: descrição e efeito presentes`);
    for (const skill of item.trainedSkills) assert.ok(skillSource.includes(`id: "${skill}"`), `${name}: perícia válida ${skill}`);
}
assert.equal(origins.find((item) => item.id === "amnesico").choiceCount, 2);
assert.equal(origins.find((item) => item.id === "chef").professionSpecialty, "cozinheiro");
assert.match(origins.find((item) => item.id === "atleta").effect, /exceto Luta e Pontaria/);
assert.match(origins.find((item) => item.id === "engenheiro").effect, /exceto arma/);
assert.match(origins.find((item) => item.id === "operario").effect, /aprovação do mestre/);
assert.match(origins.find((item) => item.id === "universitario").effect, /sem alterar a DT/);
assert.ok(origins.every((item) => !["Dublê", "Professor", "Jornalista", "Revoltado", "Ginasta", "Gaudério Abutre", "Cientista Forense", "Escritor"].includes(item.name)), "materiais adicionais não entram na lista básica");
console.log("Origens: 26 entradas, classificação, perícias, habilidades, fontes e escolhas especiais: OK");
