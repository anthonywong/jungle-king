/* Painted sequences: authored frames from the user-approved animation.
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
 function variant(a,d){return Math.abs(a)===8?(Math.abs(d)===6?'elephant-tiger':'elephant-charge'):Math.abs(a)===7?(Math.abs(d)===5?'lion-leopard':'lion-pounce'):'comic-panels';}
 function elephantFrame(t,reduced=false){
  if(reduced)return{index:t<.42?0:t<.95?9:12,phase:t<.42?'蓄勢':t<.95?'撼地':'落定',hit:.42,progress:Math.min(1,t/1.3)};
  let index=12;for(let i=0;i<elephantHolds.length;i++)if(t<elephantStarts[i]+elephantHolds[i]){index=i;break;}
  return{index,phase:index<2?'蓄勢':index<4?'踏進':index<7?'重壓':index<10?'撼地':'落定',hit:elephantHit,progress:Math.min(1,t/elephantTotal)};
 }
 function length(a,d,reduced=false){return reduced?1.30:Math.abs(a)===8?elephantTotal:variant(a,d).startsWith('lion-')?total:3.30;}
 function frame(t,reduced=false){
  if(reduced)return{index:t<.42?0:t<.95?11:15,phase:t<.42?'對峙':t<.95?'破陣':'落定',hit:.42,progress:Math.min(1,t/1.3)};
  let index=15;for(let i=0;i<holds.length;i++)if(t<starts[i]+holds[i]){index=i;break;}
  return{index,phase:index<2?'伏勢':index<4?'蹬地':index<7?'騰身':index<10?'交鋒':index<13?'破陣':'落定',hit,progress:Math.min(1,t/total)};
 }
 function events(a,d,reduced=false){
  if(reduced)return[{at:.42,name:'impact'}];
  if(Math.abs(a)===8)return[{at:.12,name:'rumble'},{at:elephantStarts[1],name:'step'},{at:elephantStarts[2],name:'call'},{at:elephantStarts[3],name:'step'},{at:elephantStarts[4],name:'dash'},{at:elephantStarts[6],name:'charge'},{at:elephantHit,name:'impact'},{at:elephantStarts[10],name:'land'}];
  if(variant(a,d).startsWith('lion-'))return[{at:.12,name:'call'},{at:starts[1],name:'charge'},{at:starts[3],name:'step'},{at:starts[4],name:'dash'},{at:starts[6],name:'claw'},{at:hit,name:'impact'},{at:starts[13],name:'land'}];
  return[{at:.12,name:'call'},{at:.70,name:'charge'},{at:1.24,name:'dash'},{at:1.68,name:'claw'},{at:1.83,name:'impact'},{at:2.45,name:'land'}];
 }
 function info(b,t){
  if(b.variant.startsWith('elephant-'))return elephantFrame(t,b.reduced);
  if(b.variant.startsWith('lion-'))return frame(t,b.reduced);
  const impact=b.reduced?.42:1.83;
  return{index:-1,phase:t<impact*.45?'對峙':t<impact?'交鋒':t<impact+.7?'破陣':'落定',hit:impact,progress:Math.min(1,t/b.length)};
 }
 return{variant,length,frame,events,info,holds,starts,total,hit,elephantHolds,elephantStarts,elephantTotal,elephantHit,elephantFrame};
})();
if(typeof module!=='undefined')module.exports=PaintedSequence;
