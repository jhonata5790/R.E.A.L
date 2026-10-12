const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("../assets/js/portal/table-portal.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const code = fs.readFileSync(path.join(root, "assets/js/portal/portal.js"), "utf8");
const account = fs.readFileSync(path.join(root, "assets/js/shared/account.js"), "utf8");
const tabletop = fs.readFileSync(path.join(root, "mesa.html"), "utf8");

for (const id of ["createTable", "accessTable", "view-home", "view-table", "tableDialog", "accessDialog",
    "inviteInput", "openTabletop", "tableList"]) assert.match(html, new RegExp(`id="${id}"`));
assert.ok(html.indexOf("assets/js/portal/table-portal.js") < html.indexOf("assets/js/portal/portal.js"));
assert.doesNotMatch(html, /data-view="(?:personagens|ameacas|homebrew)"|href="ficha\.html"|href="personagem\.html"/);
assert.doesNotMatch(tabletop, /hudShield|hudCharacterList|Fichas da campanha/);
assert.match(code, /markLibraryDirty/);
assert.match(code, /libraryChanged/);
assert.match(code, /PORTAL\.tabletopUrl/);
assert.match(code, /PORTAL\.guestUrl/);
assert.match(account, /Suas mesas, em qualquer lugar/);

const codeId = "11111111-2222-4333-8444-555555555555";
assert.equal(rules.extractInvite(codeId), codeId);
assert.equal(rules.extractInvite(`https://example.test/mesa-jogador.html#convite=${codeId}`), codeId);
assert.equal(rules.extractInvite(`?convite=${codeId}`, "https://example.test/"), codeId);
assert.equal(rules.extractInvite("convite quebrado"), null);
assert.equal(rules.tableHash("mesa com espaço"), "#mesa/mesa%20com%20espa%C3%A7o");
assert.equal(rules.tabletopUrl("mesa-1"), "mesa.html?table=mesa-1");
assert.equal(rules.guestUrl(codeId), `mesa-jogador.html#convite=${codeId}`);

console.log("Portal isolado: criação de mesa, acesso por convite e entrada no tabletop: OK");
