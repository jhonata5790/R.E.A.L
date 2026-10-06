const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rules = require("../account-library.js");

const remote = {
    campaigns: [{ id: "c1", name: "Remota" }],
    characters: [{ id: "p1", name: "Agatha antiga" }, { id: "p2", name: "Dante" }],
    homebrew: [{ id: "h1", name: "Ritual remoto" }]
};
const local = {
    campaigns: [{ id: "c2", name: "Local" }],
    characters: [{ id: "p1", name: "Agatha atualizada" }],
    homebrew: [],
    _account: { userId: "u1" }
};
const merged = rules.merge(remote, local);
assert.deepEqual(merged.campaigns.map((entry) => entry.id), ["c1", "c2"]);
assert.deepEqual(merged.characters.map((entry) => entry.name), ["Agatha atualizada", "Dante"]);
assert.deepEqual(merged.homebrew, remote.homebrew);
assert.equal("_account" in rules.clean(local), false);

assert.equal(rules.decision({ ...local, _account: { userId: "u1", localUpdatedAt: "2026-10-05T10:00:00Z", lastSyncedAt: "2026-10-05T09:00:00Z" } }, "2026-10-05T09:00:00Z", "u1"), "upload");
assert.equal(rules.decision({ ...local, _account: { userId: "u1", localUpdatedAt: "2026-10-05T09:00:00Z", lastSyncedAt: "2026-10-05T09:00:00Z" } }, "2026-10-05T10:00:00Z", "u1"), "download");
assert.equal(rules.decision({ ...local, _account: { userId: "u1", localUpdatedAt: "2026-10-05T11:00:00Z", lastSyncedAt: "2026-10-05T09:00:00Z" } }, "2026-10-05T10:00:00Z", "u1"), "merge");
assert.equal(rules.decision(local, "2026-10-05T10:00:00Z", "outra-conta"), "download");

const root = path.join(__dirname, "..");
const account = fs.readFileSync(path.join(root, "account.js"), "utf8");
for (const page of ["index.html", "ficha.html", "personagem.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.match(html, /account\.css/);
    assert.ok(html.indexOf("account-library.js") < html.indexOf("account.js"));
}
assert.match(account, /auth\.signUp/);
assert.match(account, /auth\.signInWithPassword/);
assert.match(account, /auth\.resetPasswordForEmail/);
assert.match(account, /auth\.updateUser/);
assert.match(account, /from\("user_libraries"\)/);
assert.match(account, /\.eq\("owner_id", user\.id\)/);
for (const source of ["campaign.js", "ficha.js", "personagem.js"].map((file) => fs.readFileSync(path.join(root, file), "utf8"))) {
    assert.match(source, /markLibraryDirty/);
    assert.match(source, /libraryChanged/);
}

console.log("Conta: normalização, conflitos e decisões de sincronização: OK");
