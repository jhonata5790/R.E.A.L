const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const rules=require('../assets/js/tabletop/tabletop-performance.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/tabletop/tabletop-guest-viewport.js'),'utf8');
class Node {
    constructor(){this.handlers={};this.style={};this.classes=new Set();this.clientWidth=400;this.clientHeight=225;
        this.classList={contains:value=>this.classes.has(value),add:value=>this.classes.add(value),remove:value=>this.classes.delete(value),toggle:(value,enabled)=>{const next=enabled??!this.classes.has(value);next?this.classes.add(value):this.classes.delete(value)}};}
    addEventListener(name,fn){(this.handlers[name]||=[]).push(fn)}
    emit(name,event={}){return Promise.all((this.handlers[name]||[]).map(fn=>fn(event)))}
    getBoundingClientRect(){return{left:0,top:0,width:400,height:225}}
    setPointerCapture(){}
}
const root=new Node(),stage=new Node(),viewport=new Node(),ids={guestViewport:viewport};
for(const id of ['guestFullscreen','guestZoomIn','guestZoomOut','guestResetView'])ids[id]=new Node();
let reflows=0,canceled=0,armed=false;
vm.runInNewContext(source,{document:{querySelector:selector=>selector==='.guest-tabletop'?root:stage,getElementById:id=>ids[id],addEventListener(){}},
    window:{REAL_TABLETOP_PERFORMANCE:rules,REAL_GUEST_VIEW:{pointing:()=>armed,cancelGesture:()=>canceled++,reflow:()=>reflows++},addEventListener(){}},ResizeObserver:class{observe(){}}});
const event=(id,x,y)=>({button:0,pointerId:id,clientX:x,clientY:y,target:{closest:()=>null}});
(async()=>{
    await ids.guestZoomIn.emit('click');assert.match(viewport.style.transform,/scale\(1.3\)/);
    await stage.emit('pointerdown',event(1,200,100));await stage.emit('pointermove',event(1,250,100));
    assert.match(viewport.style.transform,/translate\(50px/);await stage.emit('pointerup',event(1,250,100));
    await ids.guestResetView.emit('click');assert.equal(viewport.style.transform,'translate(0px, 0px) scale(1)');
    armed=true;await stage.emit('pointerdown',event(1,150,100));await stage.emit('pointermove',event(1,155,100));
    assert.equal(viewport.style.transform,'translate(0px, 0px) scale(1)','um toque do apontador não move a câmera');
    await stage.emit('pointerdown',event(2,250,100));await stage.emit('pointermove',event(2,350,100));
    assert.ok(canceled>0,'pinça cancela envio acidental do apontador');
    assert.ok(Number(viewport.style.transform.match(/scale\(([^)]+)\)/)[1])>2,'distância entre os dois dedos amplia a imagem');
    await ids.guestFullscreen.emit('click');assert.equal(root.classList.contains('is-immersive'),true);
    await ids.guestFullscreen.emit('click');assert.equal(root.classList.contains('is-immersive'),false);
    assert.ok(reflows>4,'os pontos são reposicionados junto com o zoom');
    console.log('Celular: pinça, arraste limitado, apontador sem conflito, recentralização e fullscreen alternativo: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
