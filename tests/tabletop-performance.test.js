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
assert.equal(rules.quality('injected'), 'auto');
assert.equal(rules.profile('high').fps, 15);
assert.equal(rules.profile('balanced').bitrate, 420000);
assert.equal(rules.profile('auto',0).scale, 2);
let adaptive = rules.adapt({level:2}, {loss:.1,rtt:.1});
assert.equal(adaptive.level, 1);
adaptive=rules.adapt(adaptive,{loss:0,rtt:.8});assert.equal(adaptive.level,0);
for(let i=0;i<4;i++)adaptive=rules.adapt(adaptive,{loss:.001,rtt:.1});
assert.equal(adaptive.level,1,'aumenta só após quatro amostras boas');
assert.equal(rules.adapt({level:1,good:2},{}).good,0,'não inventa qualidade sem medidas');
assert.equal(rules.adapt({level:1},{limited:'bandwidth'}).level,0);
assert.equal(rules.retryDelay(0),2000);assert.equal(rules.retryDelay(4),30000);
assert.deepEqual(rules.viewport({scale:9,x:9999,y:-9999},100,50),{scale:4,x:150,y:-75});
assert.deepEqual(rules.viewport({scale:1,x:100,y:50},100,50),{scale:1,x:0,y:0});
const previous={frames:3,bytes:30,at:1000,stale:15000};
assert.equal(rules.receiverHealth(previous,{frames:3,bytes:30,at:3000}).frozen,true);
assert.equal(rules.receiverHealth(previous,{frames:3,bytes:30,at:3000},true).frozen,false);
assert.equal(rules.receiverHealth(previous,{frames:4,bytes:60,at:3000}).stale,0);
console.log('Transmissão: perfis, adaptação com histerese, espera progressiva, pausa e zoom limitado: OK');
