'use strict';
const assert=require('assert');const P=require('../game/src/painted.js');let n=0;
function test(name,fn){fn();n++;console.log('PASS',name)}
test('Approved lion/leopard film is used only for the matching species',()=>{for(let a=1;a<=8;a++)for(let d=1;d<=8;d++)assert.equal(P.variant(a,-d)==='lion-leopard',a===7&&d===5)});
test('Other lion captures retain lion-only changing poses',()=>{for(let d=1;d<=8;d++)if(d!==5&&d!==6)assert.equal(P.variant(7,-d),'lion-pounce')});
test('Other species are never mislabeled with lion artwork',()=>{for(let a=1;a<=8;a++)if(a!==7&&a!==8)for(let d=1;d<=8;d++)assert.equal(P.variant(a,-d),'comic-panels')});
test('The exact-pair selection works for both player sides',()=>assert.equal(P.variant(-7,5),'lion-leopard'));
test('Lion/tiger film is restricted to that attacker and defender for both armies',()=>{
 for(const side of [1,-1])for(let a=1;a<=8;a++)for(let d=1;d<=8;d++)assert.equal(P.variant(side*a,-side*d)==='lion-tiger',a===7&&d===6);
});
test('Lion/tiger reaches every atlas pose and synchronizes contact',()=>{
 const b={variant:P.variant(7,-6),reduced:false,length:P.length(7,-6)};
 P.lionTigerStarts.forEach((t,i)=>assert.equal(P.info(b,t+.001).index,i));
 assert.equal(P.events(7,-6).find(e=>e.name==='impact').at,P.lionTigerStarts[16]);
 assert.equal(P.info(b,b.length-.001).index,43);
});
test('Lion/tiger reduced motion keeps three poses and a single impact',()=>{
 const b={variant:'lion-tiger',reduced:true,length:P.length(7,-6,true)};
 assert.deepEqual([.1,.6,1.1].map(t=>P.info(b,t).index),[0,16,43]);
 assert.deepEqual(P.events(7,-6,true),[{at:.42,name:'impact'}]);
});
test('Landing never splices in differently framed storyboard panels',()=>{
 for(let i=28;i<44;i++){
  assert.equal(P.lionTigerKeys[i],undefined);
  assert.deepEqual(P.lionTigerSources[i],{shot:'fall',cell:i-28});
 }
});
test('Lion/tiger uses 44 drawings with a 16 fps action cadence and impact hold',()=>{
 assert.equal(P.lionTigerHolds.length,44);
 assert.equal(P.lionTigerKeys[13],0);
 assert.equal(P.lionTigerKeys[16],1);
 assert(P.lionTigerHolds.every((h,i)=>[0,16,43].includes(i)||h===1/16));
 assert(P.lionTigerHolds[43]>=.6);
 assert.equal(P.events(7,-6).find(e=>e.name==='land').at,P.lionTigerStarts[33]);
 assert.equal(P.info({variant:'lion-tiger',reduced:false},P.lionTigerStarts[40]).phase,'負傷');
});
test('Sixteen source frames have strictly positive durations',()=>assert(P.holds.length===16&&P.holds.every(x=>x>0)));
test('Every source frame is reachable and is selected in order',()=>P.starts.forEach((t,i)=>assert.equal(P.frame(t+.001).index,i)));
test('The animation holds the last pose until completion',()=>assert.equal(P.frame(P.total-.001).index,15));
test('Frame indices never leave the sixteen-frame range',()=>{for(let t=0;t<10;t+=.017)assert(P.frame(t).index>=0&&P.frame(t).index<=15)});
test('There is exactly one capture impact per sequence',()=>{for(let a=1;a<=8;a++)for(let d=1;d<=8;d++)assert.equal(P.events(a,-d).filter(x=>x.name==='impact').length,1)});
test('Impact is synchronized with the first contact hold',()=>assert.equal(P.events(7,-5).find(x=>x.name==='impact').at,P.starts[7]));
test('No sound event is scheduled beyond the visual sequence',()=>{for(let a=1;a<=8;a++)for(let d=1;d<=8;d++)assert(P.events(a,-d).every(e=>e.at<P.length(a,-d)))});
test('Reduced-motion film has a shorter, static-pose timeline',()=>{assert.equal(P.length(7,-5,true),1.3);assert.equal(P.frame(.1,true).index,0);assert.equal(P.frame(.6,true).index,11);assert.equal(P.frame(1.1,true).index,15)});
test('Reduced-motion mode does not schedule running or leap sounds',()=>assert.deepEqual(P.events(7,-5,true).map(e=>e.name),['impact']));
test('Generic illustrations use a shorter, independent montage',()=>assert.equal(P.length(6,-5),3.3));
test('Elephant full film is only used for an actual tiger target',()=>{for(let d=1;d<=8;d++)assert.equal(P.variant(8,-d),d===6?'elephant-tiger':'elephant-charge')});
test('Both armies receive the elephant frame sequence',()=>assert.equal(P.variant(-8,6),'elephant-tiger'));
test('Thirteen distinct elephant poses are reachable',()=>{assert.equal(P.elephantHolds.length,13);P.elephantStarts.forEach((t,i)=>assert.equal(P.elephantFrame(t+.001).index,i))});
test('Elephant contact and its impact event align precisely',()=>assert.equal(P.events(8,-6).find(e=>e.name==='impact').at,P.elephantStarts[7]));
test('Elephant sound events are monotonic and finish within the film',()=>{const ev=P.events(8,-6);assert(ev.every((x,i)=>!i||x.at>=ev[i-1].at));assert(ev.every(x=>x.at<P.length(8,-6)))});
test('Elephant reduced motion retains an elephant impact pose',()=>{assert.equal(P.elephantFrame(.6,true).index,9);assert.equal(P.length(8,-6,true),1.3)});
console.log(n+' painted-timeline tests passed.');
