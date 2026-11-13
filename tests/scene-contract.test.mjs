import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {transitionWeight} from '../scene/src/transition.mjs';
const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base),'utf8');
function child(){const posts=[],events={},controls=new Map();let calls=[];
 const element=id=>{if(!controls.has(id))controls.set(id,{value:'',classList:{add(){}}});return controls.get(id)};
 const parent={postMessage:m=>posts.push(m)};
 const ctx={parent,window:null,document:{addEventListener:(t,f)=>events[t]=f},performance:{now:()=>1234},Number,String,Math,
  $:element,ready:true,mode:'directed',attack:'stomp',presence:true,actingRefined:true,dramaticPacing:true,inspectElephant:false,studioLight:false,cameraPreset:'director',rate:1,paused:false,accumulator:0,lastFrame:0,
  simulation:{running:false,time:0},rebuild:()=>calls.push('rebuild'),setPresentation:()=>calls.push('cinematic'),cinemaView:()=>calls.push('clean'),begin:()=>{calls.push('begin');ctx.simulation.running=true},addEventListener:(t,f)=>events[t]=f,presenceAudioMix:()=>.5};ctx.window=ctx;
 const c=vm.createContext(ctx);vm.runInContext(read('scene/src/embedded-bridge.mjs'),c);
 const run=code=>vm.runInContext(code,c);const send=(type,extra={},wrong=false)=>events.message({source:wrong?{}:parent,data:{channel:'jungle-king.capture.v1',version:1,id:9,token:'session-token',type,...extra}});
 return {posts,events,calls,c,run,send};}
test('entry/exit blending stays bounded and has zero endpoint slope',()=>{assert.equal(transitionWeight(0,.16),0);assert.equal(transitionWeight(.16,.16),1);assert.equal(transitionWeight(-1,.16),0);assert.equal(transitionWeight(2,.16),1);assert(transitionWeight(1e-5,1)<4e-10);for(let i=0;i<=100;i++)assert(transitionWeight(i/100,1)>=0&&transitionWeight(i/100,1)<=1)});
test('embedded boot advertises readiness only after renderer calls bridgeReady',()=>{const h=child();assert.equal(h.posts[0].type,'hello');h.send('init');assert.equal(h.posts.length,1);h.run('bridgeReady()');assert.equal(h.posts.at(-1).type,'ready')});
test('embedded scene begins one time even if START is duplicated',()=>{const h=child();h.send('init');h.run('bridgeReady()');h.send('start');h.send('start');assert.equal(h.calls.filter(x=>x==='begin').length,1);assert.equal(h.c.$('speed').value,'3.6');assert.equal(h.posts.at(-1).type,'started')});
test('wrong source cannot initialise the scene or start it',()=>{const h=child();h.send('init',{},true);h.send('start');assert.equal(h.calls.length,0)});
test('child pause and stop prevent continuing or late audio effects',()=>{const h=child();h.send('init');h.run('bridgeReady()');h.send('start');h.send('pause',{paused:true});assert(h.c.paused);h.send('stop');assert(!h.c.simulation.running);const n=h.posts.length;h.run("new CaptureRemoteAudio().impact('stomp')");assert.equal(h.posts.length,n)});
test('reinitialisation accepts a subsequent capture after stop',()=>{const h=child();h.send('init');h.run('bridgeReady()');h.send('start');h.send('stop');h.send('init');h.send('start');assert.equal(h.calls.filter(x=>x==='begin').length,2)});
test('out-of-date commands cannot pause a new capture',()=>{const h=child();h.send('init');h.run('bridgeReady()');h.send('start');h.send('pause',{id:8,paused:true});assert.equal(h.c.paused,false)});
test('scene fails explicitly on exceptions instead of sending a fake success',()=>{const h=child();h.send('init');h.run("bridgeFail('WebGL lost')");assert.equal(h.posts.at(-1).type,'error');assert.equal(h.posts.filter(p=>p.type==='complete').length,0)});
test('source preserves hit-stop and uses native idles only outside contact window',()=>{const s=read('scene/src/candidate-asset.mjs');assert(s.includes('s.time<.16'));assert(s.includes('s.done&&a.returnBlend>0'));assert(s.includes("rigStrikePoints(a.data,a.lastRig,'stomp')"));assert(read('scene/src/app.mjs').includes('bridgeSettling>=.28'))});
test('controls live in the host, no user cloud data or executable postMessage payloads',()=>{const s=read('game/src/capture-presenter.js');assert(s.includes('e.source!==this.frame.contentWindow'));assert(s.includes('s.accepts(m)'));assert(!s.includes('eval('));assert(read('scene/src/embedded-bridge.mjs').includes('event.source!==parent'))});
