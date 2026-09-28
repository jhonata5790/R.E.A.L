const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const view = require("../tabletop-view.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "mesa.html"), "utf8");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

assert.deepEqual(view.normalize(), { x: -600, y: -337.5, width: 1200, height: 675 });
assert.deepEqual(view.normalize({ x: 30, y: -20, width: 1600, height: 1 }), { x: 30, y: -20, width: 1600, height: 900 });
assert.deepEqual(view.normalize({ x: 0, y: 0, width: 0 }), view.normalize());
assert.equal(view.contains({ x: -10, y: -10, width: 20, height: 20 }, { x: 5, y: 5 }), true);
assert.equal(view.contains({ x: -10, y: -10, width: 20, height: 20 }, { x: 11, y: 5 }), false);
assert.deepEqual(view.publishedTokens([{ id: 1 }, { id: 2, visibleToPlayers: false }, { id: 3, visibleToPlayers: true }]).map((token) => token.id), [1, 3]);

for (const id of ["toolPlayerView", "playerViewPanel", "playerViewWidth", "openPlayerPreview", "playerPreviewCanvas", "tokenVisibleToPlayersInput"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} deve existir`);
}
assert.match(html, /<script src="tabletop-view\.js[^"\n]*"><\/script>/);
assert.match(script, /playerView: \{ \.\.\.playerView \}/);
assert.match(script, /Object\.assign\(playerView, VIEW_RULES\.normalize\(data\.playerView\)\)/);
assert.match(script, /VIEW_RULES\.publishedTokens\(tokens\)/);
assert.match(script, /visibleToPlayers: token\.visibleToPlayers/);
assert.match(script, /visibleToPlayers: selectedToken\.visibleToPlayers/);
assert.match(script, /if \(previewDialog\.open \|\| playerStream\) drawPlayerPreview\(\)/);
console.log("Tabletop: visão independente, filtro de tokens e persistência da área: OK");
