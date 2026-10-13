const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Este arquivo não tem generics executáveis: removemos apenas suas quatro anotações para o mock de Deno.
const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/tabletop-guest-view/index.ts'), 'utf8')
    .replace(/: Record<string, string>/g, '').replace(/body: unknown/g, 'body')
    .replace(/\): Response/g, ')').replace(/request: Request/g, 'request');
let handler, calls = [], room = {is_live:true,published_frame:'data:image/jpeg;base64,demo',published_at:'stamp',
    pointer_authority:{sessionId:'owner-session',publicKey:{kty:'EC'}},owner_id:'private-owner',tokens:['private-token'],notes:'private-notes'};
vm.runInNewContext(source, {URL,Response,JSON,Deno:{env:{get(name){return {SUPABASE_PUBLISHABLE_KEYS:'{"default":"public-demo"}',SUPABASE_SECRET_KEYS:'{"default":"server-only"}',SUPABASE_URL:'https://example.invalid'}[name]}},serve(run){handler=run}},
    fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([room]))}});
function request(body, key='public-demo') {return new Request('https://example.invalid/',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});}
(async()=>{
    const inviteCode='11111111-2222-4333-8444-555555555555';
    assert.equal((await handler(request({inviteCode},'wrong-key'))).status,401);
    assert.equal(calls.length,0);
    assert.equal((await handler(request({inviteCode:'invalid'}))).status,400);
    const normal=await (await handler(request({inviteCode}))).json();
    assert.deepEqual(normal.pointerAuthority,room.pointer_authority);
    for(const key of ['owner_id','tokens','notes','privateKey'])assert.equal(key in normal,false);
    assert.equal(calls[0].url.searchParams.get('select'),'is_live,published_frame,published_at,pointer_authority,transmission_paused');
    room.transmission_paused=true;
    const paused=await(await handler(request({inviteCode,knownPublishedAt:'stamp'}))).json();
    assert.equal(paused.paused,true);assert.equal(paused.unchanged,true);
    const unchanged=await(await handler(request({inviteCode,knownPublishedAt:'stamp'}))).json();
    assert.equal(unchanged.unchanged,true);assert.equal(unchanged.frame,null);
    assert.deepEqual(unchanged.pointerAuthority,room.pointer_authority,'a chave também chega quando o quadro não mudou');
    room.is_live=false;
    const ended=await(await handler(request({inviteCode}))).json();
    assert.equal(ended.pointerAuthority,null);assert.equal(ended.frame,null);
    console.log('Convite: chave pública autenticada, quadro incremental e nenhuma informação privada: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
