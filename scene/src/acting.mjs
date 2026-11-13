import {presencePose} from './presence.mjs';
/** V05 acting polish. No new attacks, no geometry changes, no root teleportation.
 * Small counterweight and delayed follow-through on top of the approved V04
 * clips. The entire approach/active strike window is bit-identical to V04.
 */
export const ACTING_VERSION='0.5.0';
const actSat=x=>Math.max(0,Math.min(1,x));
function bump(t,start,end){const u=actSat((t-start)/(end-start));return u<=0||u>=1?0:16*u*u*(1-u)*(1-u);}
export function refineActing(kind,sim,pose){
 const p={...pose};if(sim.actingRefined===false)return p;
 const add=(key,v)=>{p[key]=(p[key]||0)+v;};
 if(sim.hitT<0){
  // Gather body weight before the existing attack. The envelope and its
  // derivative vanish at each end; all strike collider positions stay intact.
  const u=sim.time/sim.plan.windup;
  if(kind==='elephant'){
   const gather=bump(u,.06,.94);add('bodyY',-.038*gather);
   add('bodyZ',.017*gather);add('headZ',.024*bump(u,.16,.98));
   add('bodyX',-.015*gather);add('tail',-.045*bump(u,.24,1));
  }else{
   add('bodyY',-.035*bump(u,.10,.96));add('headZ',.034*bump(u,.28,1));
   add('tail',.045*bump(u,.16,.96));
  }
  return presencePose(kind,sim,p);
 }
 const a=sim.time-sim.hitT;
 if(kind==='elephant'){
  // Torso absorbs impact first, head a few frames later, then tail / ear rig.
  add('bodyY',-.028*bump(a,.015,.26));
  add('bodyZ',-.020*bump(a,.025,.28)+.014*bump(a,.30,.83));
  add('headZ',-.032*bump(a,.07,.36)+.026*bump(a,.36,.92));
  add('bodyX',(sim.attack==='sweep'?.014:-.012)*bump(a,.08,.42));
  add('tail',-.065*bump(a,.16,.63)+.027*bump(a,.60,1.16));
  add('ears',.025*bump(a,.12,.58));
 }else{
  // Stagger is read through compression -> shoulder lag -> planted recovery,
  // rather than just moving the complete animal back in space.
  add('bodyY',-.032*bump(a,.02,.19));
  add('headZ',.055*bump(a,.06,.29)-.025*bump(a,.35,.71));
  add('headY',(sim.attack==='sweep'?.07:.03)*bump(a,.12,.46));
  add('tail',-.11*bump(a,.16,.54)+.055*bump(a,.50,1.08));
 }
 return presencePose(kind,sim,p);
}
