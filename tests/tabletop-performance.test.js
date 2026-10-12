const assert = require("node:assert/strict");
const rules = require("../assets/js/tabletop/tabletop-performance.js");

assert.equal(rules.prefersEconomy({ stored: "on" }), true);
assert.equal(rules.prefersEconomy({ stored: "off", saveData: true, narrow: true }), false);
assert.equal(rules.prefersEconomy({ saveData: true }), true);
assert.equal(rules.prefersEconomy({ effectiveType: "2g" }), true);
assert.equal(rules.prefersEconomy({ narrow: true }), true);
assert.equal(rules.prefersEconomy({ coarse: true }), true);
assert.equal(rules.prefersEconomy({ effectiveType: "4g", narrow: false, coarse: false }), false);
assert.equal(rules.refreshDelay({ channelReady: true, knownLive: true }), 20000);
assert.equal(rules.refreshDelay({ channelReady: false, knownLive: true }), 7000);
assert.equal(rules.refreshDelay({ channelReady: false, knownLive: false }), 5000);
assert.equal(rules.refreshDelay({ channelReady: false, knownLive: false, failures: 3 }), 40000);
assert.deepEqual(rules.fallbackRequest("convite", null), { inviteCode: "convite" });
assert.deepEqual(rules.fallbackRequest("convite", "2026-10-08T12:00:00Z"), {
    inviteCode: "convite", knownPublishedAt: "2026-10-08T12:00:00Z"
});

console.log("Tabletop: modo econômico, polling adaptativo e quadro incremental: OK");
