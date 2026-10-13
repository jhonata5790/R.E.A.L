const assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const core=fs.readFileSync(path.join(__dirname,'../assets/js/tabletop/tabletop.js'),'utf8');
// Exercise actual production functions in a minimal canvas environment, not copies of their logic.
const begin=core.indexOf('let publicationCanvas = null;'),end=core.indexOf('\nconst THEME');
function method(name){const start=core.indexOf(name),brace=core.indexOf('{',start);let depth=1,i=brace+1;for(;depth&&i<core.length;i++){if(core[i]==='{')depth++;if(core[i]==='}')depth--}return core.slice(brace+1,i-1)}
let draft='scene-before', requests=0,streamStopped=0,heartbeat;
function canvas(){const node={pixels:'blank',getContext:()=>({drawImage:source=>{node.pixels=source.pixels},fillRect:()=>{node.pixels='blank'}}),toDataURL:()=>node.pixels};
    node.captureStream=()=>({getTracks:()=>[{stop:()=>streamStopped++}],getVideoTracks:()=>[{requestFrame:()=>requests++}]});return node}
const preview=canvas();
const context=vm.createContext({document:{createElement:canvas},window:{dispatchEvent(){}},Event,previewCanvas:preview,playerView:{x:0,y:0,width:1200,height:675},currentSceneId:'first',
    drawPlayerPreview:()=>{preview.pixels=draft;vm.runInContext('updatePublication()',context)},requestPlayerStreamFrame:()=>requests++,playerStream:null,playerStreamTrack:null,
    playerFrameTimer:null,lastPlayerFrameAt:0,setInterval:fn=>{heartbeat=fn;return 1},clearInterval:()=>{heartbeat=null},clearTimeout(){},THEME:{background:'#070509'},
    Image:class {constructor(){this.width=0}set src(value){queueMicrotask(()=>this.onerror())}}});
vm.runInContext(core.slice(begin,end),context);
for(const name of ['setTransmissionPaused(paused)','capturePlayerFrame()','captureDraftFrame()','startPlayerStream()','stopPlayerStream()']){
    const key=name.split('(')[0],args=name.includes('paused')?'paused':'';
    vm.runInContext(`function ${key}(${args}) {${method(name)}}`,context);
}
assert.equal(vm.runInContext('capturePlayerFrame()',context),'scene-before');
vm.runInContext('startPlayerStream();setTransmissionPaused(true)',context);
draft='SECRET-DRAFT';vm.runInContext('drawPlayerPreview()',context);
assert.equal(preview.pixels,'SECRET-DRAFT','prévia local continua editável');
assert.equal(vm.runInContext('transmissionCanvas().pixels',context),'scene-before','canvas enviado permanece congelado');
assert.equal(vm.runInContext('capturePlayerFrame()',context),'scene-before','fallback não vaza rascunho');
assert.equal(vm.runInContext('captureDraftFrame()',context),'SECRET-DRAFT');
assert.equal(vm.runInContext('transmissionCanvas().pixels',context),'scene-before','preparar retomada não altera vídeo');
heartbeat();assert.ok(requests>0);
vm.runInContext('setTransmissionPaused(false)',context);assert.equal(vm.runInContext('transmissionCanvas().pixels',context),'SECRET-DRAFT');
vm.runInContext('stopPlayerStream()',context);assert.equal(heartbeat,null);assert.equal(streamStopped,1);
console.log('Pausa: rascunho privado, canvas separado, fallback congelado e retomada explícita: OK');
vm.runInContext(`async function restorePublishedFrame(source) {${method('restorePublishedFrame(source)')}};setTransmissionPaused(true)`,context);
vm.runInContext("restorePublishedFrame('data:image/jpeg;base64,corrupted')",context).then(()=>{
    assert.equal(vm.runInContext('transmissionCanvas().pixels',context),'blank','reabrir pausa com imagem inválida nunca envia rascunho privado');
    console.log('Pausa restaurada: erro na imagem publicada mantém um quadro neutro, sem vazar rascunho: OK');
}).catch(error=>{console.error(error);process.exitCode=1});
