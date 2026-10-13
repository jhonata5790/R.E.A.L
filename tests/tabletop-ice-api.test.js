const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), {webcrypto,createHmac} = require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../supabase/functions/tabletop-ice-config/index.ts'),'utf8');
let handler,calls=[],active=true;
const env={SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'public-test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'server-secret'}),SUPABASE_URL:'https://example.invalid'};
vm.runInNewContext(source,{URL,Response,TextEncoder,crypto:webcrypto,btoa,Date,JSON,Deno:{env:{get:key=>env[key]},serve:fn=>handler=fn},
    fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{is_live:active,owner_id:'private-owner'}]))}});
const inviteCode='11111111-2222-4333-8444-555555555555';
const request=(data={inviteCode},key='public-test')=>new Request('https://example.invalid',{method:'POST',headers:{apikey:key},body:JSON.stringify(data)});
(async()=>{
    assert.equal((await handler(request({},'wrong'))).status,401);assert.equal(calls.length,0);
    assert.equal((await handler(request({inviteCode:'bad'}))).status,400);
    assert.equal((await handler(request({inviteCode,extra:'x'.repeat(1100)}))).status,400);
    active=false;assert.equal((await handler(request())).status,404);active=true;
    const initial=await(await handler(request())).json();assert.equal(initial.relayAvailable,false);assert.equal(initial.iceServers.length,1);
    env.REAL_TURN_SHARED_SECRET='only-on-server';env.REAL_TURN_URLS=JSON.stringify(['turn:relay.example.test:3478?transport=udp','turns:relay.example.test:5349?transport=tcp']);
    const configured=await(await handler(request())).json();assert.equal(configured.relayAvailable,true);
    const relay=configured.iceServers[1];assert.equal(relay.credential,createHmac('sha1',env.REAL_TURN_SHARED_SECRET).update(relay.username).digest('base64'));
    assert.ok(configured.expiresAt>Date.now()/1000+590&&configured.expiresAt<Date.now()/1000+901);
    for(const secret of ['only-on-server','server-secret','private-owner',inviteCode])assert.equal(JSON.stringify(configured).includes(secret),false);
    assert.equal(calls.at(-1).url.searchParams.get('select'),'is_live');
    env.REAL_TURN_URLS=JSON.stringify(['https://unsafe.example.test']);assert.equal((await(await handler(request())).json()).relayAvailable,false);
    console.log('TURN: convite ativo, chave válida, credenciais temporárias, HMAC e segredos só no servidor: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
