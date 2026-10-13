const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
let now = 10000;
const timers = new Map(); let nextTimer = 0;
class Element {
    constructor() { this.children = []; this.handlers = {}; this.hidden = false; this.style = { setProperty() {} }; this.attributes = {}; this.classList = { toggle() {} }; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); }
    addEventListener(type, run) { this.handlers[type] = run; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getBoundingClientRect() { return { left: 100, top: 80, width: 800, height: 450 }; }
}
const scope = { crypto: webcrypto, addEventListener() {} };
const context = { window: scope, document: { createElement: () => new Element() }, TextEncoder, Uint8Array, btoa, atob,
    Date: class extends Date { static now() { return now; } }, setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: (id) => timers.delete(id), console };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/shared/tabletop-pointers.js'), 'utf8'), context);
const pointers = scope.REAL_POINTERS;
const plain = (value) => JSON.parse(JSON.stringify(value));

(async () => {
    const outside = pointers.relativePoint({ left: 0, top: 0, width: 800, height: 800 }, 16 / 9, 400, 40);
    assert.equal(outside, null, 'cliques nas faixas vazias não criam pontos');
    assert.equal(pointers.relativePoint({ left: 0, top: 0, width: 0, height: 10 }, 16 / 9, 0, 0), null);
    const center = pointers.relativePoint({ left: 100, top: 80, width: 800, height: 450 }, 16 / 9, 500, 305);
    assert.equal(center.x, .5); assert.equal(center.y, .5);
    const alice = await pointers.identity(), mallory = await pointers.identity();
    const key = await pointers.importKey(alice.publicKey);
    const envelope = await pointers.sign({ message: 'original' }, alice.privateKey);
    assert.deepEqual(plain(await pointers.verify(envelope, key)), { message: 'original' });
    assert.equal(await pointers.verify({ ...envelope, body: '{"message":"alterado"}' }, key), null);
    assert.equal(await pointers.verify(await pointers.sign({ message: 'original' }, mallory.privateKey), key), null);
    assert.equal(pointers.publicKey({ ...alice.publicKey, d: 'privada' }), null);

    const guests = [], ownerRoot = new Element(); let view = { x: -600, y: -337.5, width: 1200, height: 675, sceneId: 'scene-1' };
    const writes = [], outgoing = [], requests = [];
    let paused=false;
    const owner = pointers.createMaster({ root: ownerRoot, master: { isTransmissionPaused:()=>paused, pointerView: () => ({ ...view }), pointOnScreen: (point) => ({ x: point.x + 480, y: point.y + 270 }) } });
    const client = { from(table) { assert.equal(table, 'tabletop_rooms'); return {
        update(data) { writes.push(data); return this; }, eq(column, value) { writes.push({ column, value }); return this; },
        select() { return this; }, single: async () => ({ data: { id: 'room-1' }, error: null })
    }; } };
    await owner.start({ client, roomId: 'room-1', ownerId: 'master-1', connected: true,
        send: async (event, payload) => { if (event === 'pointer-state') { outgoing.push(payload); await Promise.all(guests.map((guest) => guest.controller.receive(payload))); } } });
    assert.ok(writes.some((value) => value.column === 'owner_id' && value.value === 'master-1'));
    assert.equal('privateKey' in writes[0].pointer_authority, false, 'a chave privada nunca sai do navegador do mestre');

    async function spectator(viewerId, name) {
        const button = new Element(), root = new Element(), stage = new Element(), source = new Element();
        const controller = pointers.createGuest({ viewerId, button, root, stage, status: new Element(), source: () => source,
            send: async (event, payload) => { assert.equal(event, 'pointer-request'); requests.push(payload); return owner.receive(payload); } });
        const pointerKey = await controller.identityReady;
        const raw = { role: 'viewer', viewerId, name, pointerKey };
        const guest = { controller, button, root, stage, raw }; guests.push(guest);
        owner.present(guests.map((entry) => entry.raw));
        controller.setDisplay({ live: true, ready: true, video: false, stamp: 'frame-1' });
        await controller.setAuthority(owner.authority()); await owner.settled();
        return guest;
    }
    const first = await spectator('11111111-2222-4333-8444-555555555555', 'Ana');
    const second = await spectator('22222222-2222-4333-8444-555555555555', 'Beto');
    assert.equal(first.button.hidden, true, 'a autorização começa desligada');
    assert.equal(await first.controller.point(500, 305), false, 'sem permissão não envia pedido');
    owner.published(owner.frameContext(), 'frame-1'); await owner.settled();
    assert.equal(await owner.setAllowed(first.raw, true), true);
    assert.equal(first.button.hidden, false); assert.equal(first.controller.canPoint(), true);
    assert.equal(second.button.hidden, true, 'a permissão é individual');
    const ghost = pointers.createGuest({ viewerId: first.raw.viewerId, button: new Element(), root: new Element(),
        stage: new Element(), status: new Element(), source: () => new Element(), send: async () => {} });
    await ghost.identityReady; ghost.setDisplay({ live: true, ready: true, video: true });
    await ghost.setAuthority(owner.authority());
    const pastHello = outgoing.find((packet) => JSON.parse(packet.body).challenge?.viewerId === first.raw.viewerId);
    assert.equal(await ghost.receive(pastHello), false, 'uma resposta antiga não comprova uma nova conexão');
    assert.equal(await ghost.receive(outgoing.at(-1)), false, 'permissão antiga não substitui a confirmação fresca do mestre');
    first.button.handlers.click();
    assert.equal(await first.controller.point(500, 305), true);
    const request = requests.at(-1);
    assert.equal(ownerRoot.children.length, 1); assert.equal(first.root.children.length, 1); assert.equal(second.root.children.length, 1);
    assert.equal(ownerRoot.children[0].children[0].textContent, 'Ana');
    assert.equal(ownerRoot.children[0].style.left, '480px');
    assert.equal(first.root.children[0].style.left, '500px');
    assert.equal(await owner.receive(request), false, 'pedidos repetidos são rejeitados');
    first.button.handlers.click();
    assert.equal(await first.controller.point(550, 310), false, 'intervalo impede spam');
    assert.equal(await second.controller.receive({ body: JSON.stringify({ kind: 'point' }), signature: 'a'.repeat(86) + '==' }), false);
    assert.equal(second.root.children.length, 1, 'um broadcast falso não desenha outro ponto');
    assert.equal(await second.controller.receive(outgoing.at(-1)), false, 'broadcast assinado antigo não é reproduzido');

    now += 1300;
    const forged = await pointers.sign(JSON.parse(request.body), mallory.privateKey);
    assert.equal(await owner.receive(forged), false, 'outro jogador não pode se passar pelo autorizado');
    await owner.setAllowed(first.raw, false);
    assert.equal(first.button.hidden, true); assert.equal(ownerRoot.children.length, 0); assert.equal(second.root.children.length, 0);
    assert.equal(await owner.receive(request), false, 'revogar impede pedidos que estavam em trânsito');

    await owner.setAllowed(first.raw, true);
    view = { ...view, x: -400 }; owner.changed(); await owner.settled();
    assert.equal(first.controller.canPoint(), false, 'imagem antiga não pode apontar no enquadramento novo');
    assert.equal(await owner.receive(request), false, 'pedido para o enquadramento antigo é rejeitado');
    owner.published(owner.frameContext(), 'frame-2'); await owner.settled();
    first.controller.setDisplay({ stamp: 'frame-2' }); assert.equal(first.controller.canPoint(), true);
    first.button.handlers.click();
    assert.equal(await first.controller.point(500, 305), true);
    assert.equal(ownerRoot.children[0].style.left, '680px', 'posição usa o mundo da cena, não a câmera do mestre');
    for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
    assert.equal(ownerRoot.children.length, 0); assert.equal(first.root.children.length, 0); assert.equal(second.root.children.length, 0);

    first.button.handlers.click();
    first.controller.setDisplay({ ready: false });
    assert.equal(first.button.hidden, true); assert.equal(await first.controller.point(500, 305), false);
    first.controller.setDisplay({ ready: true });
    assert.equal(await first.controller.receive(outgoing.at(-1)), false, 'reconectar exige um novo desafio, não o estado antigo');
    now += 1500; await first.controller.hello();
    assert.equal(first.controller.canPoint(), true, 'a confirmação do mestre recupera uma reconexão da mesma visita');
    now+=1500;
    second.controller.setDisplay({stamp:'frame-2'});
    assert.equal(await owner.pointMaster(-300,0),true);
    assert.equal(second.root.children.at(-1).children[0].textContent,'Mestre','mestre aponta sem conceder permissão de jogador');
    assert.equal(await owner.pointMaster(9999,0),false,'ponto privado fora da área nunca é transmitido');
    paused=true;owner.changed();await owner.settled();
    assert.equal(first.controller.canPoint(),false);assert.equal(second.root.children.length,0);
    now+=1500;assert.equal(await owner.pointMaster(-300,0),false);
    paused=false;owner.changed();await owner.settled();assert.equal(first.controller.canPoint(),true);
    owner.present([second.raw]); await owner.settled();
    assert.equal(owner.permission(first.raw), null, 'quem sai perde a permissão');
    owner.stop(); assert.equal(owner.ready(), false);
    assert.equal(owner.authority(), null, 'encerrar descarta a autorização da sessão');
    console.log('Apontadores: assinaturas, permissão individual, revogação, coordenadas, modo econômico, spam e expiração: OK');
})().catch((error) => { console.error(error); process.exitCode = 1; });
