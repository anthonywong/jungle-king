/* No browser, WebGL or Rapier is mocked as passing here: this harness runs the
 * real chess application and capture host against a synthetic DOM/child frame.
 * Its scope is lifecycle, legal moves and UI locking only. */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
module.exports=function makeHost(){
 const root=path.join(__dirname,'../game/src');let time=0,nextTimer=1;const timeouts=new Map(),intervals=new Map();let raf=[];
 const eventMap=new Map(),docEvents=new Map();const sent=[];const storage=new Map();
 class Classes{constructor(){this.s=new Set()}add(...a){a.forEach(x=>this.s.add(x))}remove(...a){a.forEach(x=>this.s.delete(x))}contains(v){return this.s.has(v)}toggle(v,b){const on=b===undefined?!this.s.has(v):!!b;on?this.add(v):this.remove(v);return on}}
 const elements=new Map();
 class E{
  constructor(id='',tag='DIV'){this.id=id;this.tagName=tag;this.classList=new Classes();this.style={};this.dataset={};this.attrs={};this.children=[];this.listeners={};this.disabled=false;this.open=false;this.value='';this.checked=false;this.hidden=false;this.isConnected=true;this.sub=new Map();this.contentWindow={postMessage:m=>sent.push(m)};}
  set innerHTML(s){this.html=s}get innerHTML(){return this.html||''}
  set src(s){this.attrs.src=s}get src(){return this.attrs.src||''}
  setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}removeAttribute(k){delete this.attrs[k]}
  appendChild(e){this.children.push(e);if(e.id)elements.set(e.id,e);return e}append(...es){es.forEach(e=>this.appendChild(e))}replaceChildren(...es){this.children=es}remove(){elements.delete(this.id)}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}dispatchEvent(e){(this.listeners[e.type]||[]).forEach(fn=>fn(e))}
  querySelector(s){if(!this.sub.has(s))this.sub.set(s,new E());return this.sub.get(s)}
  querySelectorAll(s){if(this.id==='captureLayer'&&s==='button')return ['capturePause','captureSkip','captureFallback','captureSound'].map(x=>elements.get(x));return []}
  showModal(){this.open=true}close(){this.open=false;this.dispatchEvent({type:'close'})}focus(){document.activeElement=this}click(){this.onclick?.({target:this})}
  scrollIntoView(){}setPointerCapture(){}getBoundingClientRect(){return{x:0,y:0,left:0,top:0,width:1000,height:700}}get clientWidth(){return 1000}get clientHeight(){return 700}
 }
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const m of html.matchAll(/id="([^"]+)"/g))elements.set(m[1],new E(m[1]));
 elements.get('intro').classList.remove('hidden');elements.get('demoAnimal').value='8';elements.get('soundAnimal').value='8';
 const document={hidden:false,body:new E('body'),documentElement:new E('html'),activeElement:null,getElementById:id=>elements.get(id)||null,createElement:tag=>new E('',tag.toUpperCase()),querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(k,f)=>{(docEvents.get(k)||docEvents.set(k,[]).get(k)).push(f)}};
 class Audio{constructor(){this.enabled=true;this.ready=true;this.buffers={};this.assetsPromise=Promise.resolve();this.metrics={impacts:0};}configure(s){this.enabled=s.sound!==false}unlock(){return Promise.resolve(true)}setMusic(v){this.music=v}setBattle(v){this.battle=v}sfx(){}strike(){this.metrics.impacts++}visibility(v){this.hidden=v}status(){return {}}}
 class Foley{constructor(){this.events=[]}event(a,v){this.events.push([a,v])}pause(){this.pauses=(this.pauses||0)+1}bind(){}mix(){}}
 class Renderer{constructor(){this.yaw=0;this.elevation=1;this.zoom=1;this.width=1000;this.halfW=8;}project(p){return{x:500+p[0]*40,y:350+p[2]*40}}render(){}resize(){}pick(){return -1}}
 const context={console,document,performance:{now:()=>time},location:{hash:'#test',origin:'null'},matchMedia:()=>({matches:false}),innerWidth:1200,innerHeight:800,devicePixelRatio:1,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},ART:new Proxy({},{get:()=>''}),InkAudio:Audio,CaptureFoley:Foley,Beast3D:{Renderer},Blob,URL,Promise,Uint32Array,Math,JSON,Number,Map,Set,
  crypto:{getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=(time+17+i*71)>>>0;return a}},
  ResizeObserver:class{constructor(f){this.f=f}observe(){}},requestAnimationFrame:fn=>{raf.push(fn);return raf.length},
  setTimeout:(fn,ms=0)=>{const id=nextTimer++;timeouts.set(id,{fn,at:time+ms});return id},clearTimeout:id=>timeouts.delete(id),
  setInterval:(fn,ms)=>{const id=nextTimer++;intervals.set(id,{fn,ms,at:time+ms});return id},clearInterval:id=>intervals.delete(id),
  queueMicrotask,addEventListener:(k,f)=>{(eventMap.get(k)||eventMap.set(k,[]).get(k)).push(f)},scrollTo:()=>{}};
 context.window=context;context.globalThis=context;const c=vm.createContext(context);
 for(const file of ['rules.js','ai.js','combat.js','painted.js','capture-contract.js','capture-presenter.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
 const game=c.BeastGame;game.settings.difficulty='easy';
 async function drain(){for(let i=0;i<12;i++)await Promise.resolve()}
 async function step(ms=20){time+=ms;
  for(const [id,v] of [...timeouts])if(v.at<=time){timeouts.delete(id);v.fn()}
  for(const v of intervals.values())if(v.at<=time){v.at=time+v.ms;v.fn()}
  const jobs=raf;raf=[];jobs.forEach(f=>f(time));await drain();
 }
 async function advance(ms){for(let n=0;n<ms;n+=20)await step(Math.min(20,ms-n))}
 function message(type,data={}){const s=game.capture.session;game.capture.receive({source:elements.get('captureFrame').contentWindow,data:{channel:'jungle-king.capture.v1',version:1,id:s.id,token:s.token,type,...data}})}
 function emitDoc(type){for(const f of docEvents.get(type)||[])f({type})}
 return{game,c,document,elements,sent,storage,drain,step,advance,message,emitDoc,setTime:x=>time=x};
};
