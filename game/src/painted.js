/* Painted sequences: retained approved films plus a dedicated lion/tiger atlas.
 * The lion/leopard film is used ONLY for that exact matchup. Other pairs retain
 * their correct species. Do not turn it into a generic mislabeled battle clip.
 */
const PaintedSequence=(()=>{
 'use strict';
 const holds=[.40,.28,.22,.14,.14,.14,.18,.24,.14,.18,.25,.42,.24,.24,.20,.46];
 const starts=[];let total=0;for(const h of holds){starts.push(total);total+=h;}
 const hit=starts[7];
 const elephantHolds=[.40,.26,.24,.20,.18,.18,.18,.30,.24,.65,.30,.26,.51];
 const elephantStarts=[];let elephantTotal=0;for(const h of elephantHolds){elephantStarts.push(elephantTotal);elephantTotal+=h;}
 const elephantHit=elephantStarts[7];
 // Keep the approved leap/contact; use one consistently framed landing shot.
 const lionTigerKeys={13:0,16:1};
 const lionTigerSources=Array.from({length:44},(_,i)=>({shot:i<16?'leap':i<28?'contact':'fall',cell:i<16?i:i<28?i-12:i-28}));
 const lionTigerHolds=Array(44).fill(1/16);lionTigerHolds[0]=.22;lionTigerHolds[16]=.16;lionTigerHolds[43]=.70;
 const lionTigerStarts=[];let lionTigerTotal=0;for(const h of lionTigerHolds){lionTigerStarts.push(lionTigerTotal);lionTigerTotal+=h;}
 const lionTigerHit=lionTigerStarts[16];
 function lionTigerFrame(t,reduced=false){
  if(reduced)return{index:t<.42?0:t<.95?16:43,phase:t<.42?'伏勢':t<.95?'交鋒':'落定',hit:.42,progress:Math.min(1,t/1.3)};
  let index=43;for(let i=0;i<lionTigerHolds.length;i++)if(t<lionTigerStarts[i]+lionTigerHolds[i]){index=i;break;}
  return{index,phase:index<6?'伏勢':index<10?'蹬地':index<16?'騰身':index<28?'交鋒':index<34?'擊退':index<43?'負傷':'落定',hit:lionTigerHit,progress:Math.min(1,t/lionTigerTotal)};
 }
 function variant(a,d){return Math.abs(a)===8?(Math.abs(d)===6?'elephant-tiger':'elephant-charge'):Math.abs(a)===7?(Math.abs(d)===5?'lion-leopard':Math.abs(d)===6?'lion-tiger':'lion-pounce'):'comic-panels';}
 function elephantFrame(t,reduced=false){
  if(reduced)return{index:t<.42?0:t<.95?9:12,phase:t<.42?'蓄勢':t<.95?'撼地':'落定',hit:.42,progress:Math.min(1,t/1.3)};
  let index=12;for(let i=0;i<elephantHolds.length;i++)if(t<elephantStarts[i]+elephantHolds[i]){index=i;break;}
  return{index,phase:index<2?'蓄勢':index<4?'踏進':index<7?'重壓':index<10?'撼地':'落定',hit:elephantHit,progress:Math.min(1,t/elephantTotal)};
 }
 function length(a,d,reduced=false){return reduced?1.30:variant(a,d)==='lion-tiger'?lionTigerTotal:Math.abs(a)===8?elephantTotal:variant(a,d).startsWith('lion-')?total:3.30;}
 function frame(t,reduced=false){
  if(reduced)return{index:t<.42?0:t<.95?11:15,phase:t<.42?'對峙':t<.95?'破陣':'落定',hit:.42,progress:Math.min(1,t/1.3)};
  let index=15;for(let i=0;i<holds.length;i++)if(t<starts[i]+holds[i]){index=i;break;}
  return{index,phase:index<2?'伏勢':index<4?'蹬地':index<7?'騰身':index<10?'交鋒':index<13?'破陣':'落定',hit,progress:Math.min(1,t/total)};
 }
 function events(a,d,reduced=false){
  if(reduced)return[{at:.42,name:'impact'}];
  if(variant(a,d)==='lion-tiger')return[{at:.12,name:'call'},{at:lionTigerStarts[4],name:'charge'},{at:lionTigerStarts[7],name:'step'},{at:lionTigerStarts[9],name:'dash'},{at:lionTigerStarts[15],name:'claw'},{at:lionTigerHit,name:'impact'},{at:lionTigerStarts[33],name:'land'}];
  if(Math.abs(a)===8)return[{at:.12,name:'rumble'},{at:elephantStarts[1],name:'step'},{at:elephantStarts[2],name:'call'},{at:elephantStarts[3],name:'step'},{at:elephantStarts[4],name:'dash'},{at:elephantStarts[6],name:'charge'},{at:elephantHit,name:'impact'},{at:elephantStarts[10],name:'land'}];
  if(variant(a,d).startsWith('lion-'))return[{at:.12,name:'call'},{at:starts[1],name:'charge'},{at:starts[3],name:'step'},{at:starts[4],name:'dash'},{at:starts[6],name:'claw'},{at:hit,name:'impact'},{at:starts[13],name:'land'}];
  return[{at:.12,name:'call'},{at:.70,name:'charge'},{at:1.24,name:'dash'},{at:1.68,name:'claw'},{at:1.83,name:'impact'},{at:2.45,name:'land'}];
 }
 function info(b,t){
  if(b.variant==='lion-tiger')return lionTigerFrame(t,b.reduced);
  if(b.variant.startsWith('elephant-'))return elephantFrame(t,b.reduced);
  if(b.variant.startsWith('lion-'))return frame(t,b.reduced);
  const impact=b.reduced?.42:1.83;
  return{index:-1,phase:t<impact*.45?'對峙':t<impact?'交鋒':t<impact+.7?'破陣':'落定',hit:impact,progress:Math.min(1,t/b.length)};
 }
 return{variant,length,frame,events,info,holds,starts,total,hit,elephantHolds,elephantStarts,elephantTotal,elephantHit,elephantFrame,lionTigerHolds,lionTigerStarts,lionTigerTotal,lionTigerHit,lionTigerFrame,lionTigerKeys,lionTigerSources};
})();
if(typeof module!=='undefined')module.exports=PaintedSequence;
