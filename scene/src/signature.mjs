import {presenceRecoil,presenceFoot,presenceStrikeFoot} from './presence.mjs';
import {refineActing} from './acting.mjs';
/** V03 attacks. Authored cinematic exaggeration, not elephant biomechanics.
 * Pure envelopes are shared by pose sampling, collision tracking and tests.
 */
import {sampleKeys,sat,ease,directedPlan,poseParameters,directedFootPlacement} from './performance.mjs';
export const SIGNATURE_VERSION='0.3.0';
export const ATTACKS=Object.freeze({
 drive:{label:'衝撞',subtitle:'保留 02 版',hold:.075},
 stomp:{label:'震地重踏',subtitle:'抬足蓄勢 · 沉肩踏落',hold:.100},
 sweep:{label:'長鼻橫掃',subtitle:'轉身蓄力 · 寬弧甩擊',hold:10/120}
});
export const validAttack=s=>s==='sweep'||s==='drive'?s:'stomp';
export function signaturePlan(s,attack='stomp'){
 attack=validAttack(attack);if(attack==='drive')return {...directedPlan(s),attack};
 // Approach stops short of body contact. Only the tracked striking limb can hit.
 const separation=attack==='stomp'?3.52:4.70,travel=Math.max(.2,s.distance-separation);
 return {attack,windup:attack==='stomp'?.40:.44,drive:Math.max(.42,Math.min(1.14,travel/(s.speed*1.75))),travel,
  strike:attack==='stomp'?.58:.48,activeFrom:attack==='stomp'?.29:.205,activeTo:attack==='stomp'?.53:.42,
  hitHold:ATTACKS[attack].hold,recovery:attack==='stomp'?1.32:1.25,
  missEnd:0};
}
export function finalizePlan(p){return {...p,missEnd:p.windup+p.drive+p.strike+.75};}
export function strikeAge(sim){return sim.time-sim.plan.windup-sim.plan.drive;}
export function signatureTravel(t,p){
 if(t<=0)return 0;
 if(t<p.windup)return -.12*ease(t/p.windup);
 if(t<p.windup+p.drive)return -.12+(p.travel+.12)*ease((t-p.windup)/p.drive);
 return p.travel;
}
export function signaturePhase(sim){
 if(sim.hitT>=0){const a=sim.time-sim.hitT;return a<.11?'impact':a<.70?'recoil':'recovery';}
 const t=sim.time,p=sim.plan;return t<p.windup?'prepare':t<p.windup+p.drive?'approach':t<p.windup+p.drive+p.strike?'strike':'recovery';
}
const DEFAULT={bodyY:0,bodyX:0,bodyZ:0,bodyYaw:0,headZ:0,headY:0,curl:0,ears:0,tail:0,jaw:0,trunkLift:0,trunkSwing:0};
export function signaturePoseAt(kind,attack,time,plan){
 const p={...DEFAULT},prep=sat(time/plan.windup),u=sat((time-plan.windup)/plan.drive),a=time-plan.windup-plan.drive;
 if(kind==='tiger'){
  const b=poseParameters('tiger',time<plan.windup?'prepare':'drive',time<plan.windup?prep:u);return {...p,...b};
 }
 if(time<plan.windup){
  p.bodyY=-.12*ease(prep);p.headZ=-.12*ease(prep);p.ears=.18*ease(prep);p.trunkLift=.25*ease(prep);p.jaw=-.07*Math.sin(prep*Math.PI);return p;
 }
 if(a<0){
  p.bodyY=-.12+.06*ease(u);p.bodyZ=-.04;p.headZ=-.12+.10*ease(u);p.ears=-.12;p.trunkLift=.25+.18*ease(u);p.tail=-.17;
  // The lifted attacking limb is planted again before the signature strike.
  return p;
 }
 if(attack==='stomp'){
  p.bodyY=sampleKeys([[0,-.06],[.16,-.085],[.27,-.065],[.39,-.24],[.51,-.18],[.74,0],[1,0]],a);
  p.bodyZ=sampleKeys([[0,-.04],[.18,.035],[.28,.025],[.40,-.12],[.59,-.045],[.85,0]],a);
  p.bodyX=sampleKeys([[0,0],[.18,-.055],[.29,-.07],[.42,.03],[.74,0]],a);
  p.headZ=sampleKeys([[0,-.02],[.20,.20],[.28,.16],[.41,-.20],[.65,-.04],[1,0]],a);
  p.trunkLift=sampleKeys([[0,.43],[.22,.78],[.4,.63],[.65,.25],[1,0]],a);
  p.ears=sampleKeys([[0,-.12],[.19,.28],[.31,.14],[.42,-.19],[.57,.09],[1,0]],a);
 }else{
  p.bodyY=sampleKeys([[0,-.06],[.15,-.18],[.30,-.10],[.55,-.03],[.90,0]],a);
  p.bodyYaw=-sampleKeys([[0,0],[.12,-.10],[.24,.04],[.36,.15],[.68,0]],a);
  p.bodyX=sampleKeys([[0,0],[.12,-.055],[.32,.065],[.7,0]],a);
  p.headY=-sampleKeys([[0,0],[.12,-.27],[.23,.08],[.34,.29],[.62,-.04],[.90,0]],a);
  p.headZ=sampleKeys([[0,-.02],[.13,-.07],[.28,-.09],[.55,0]],a);
  p.trunkLift=sampleKeys([[0,.43],[.12,1.0],[.30,1.0],[.47,.86],[.85,0]],a);
  p.trunkSwing=sampleKeys([[0,0],[.12,-.91],[.18,-.86],[.265,.30],[.36,.98],[.48,.77],[.74,-.12],[1,0]],a);
  p.ears=sampleKeys([[0,-.12],[.13,.19],[.28,-.20],[.42,.12],[.75,0]],a);
 }
 p.tail=-.14;p.jaw=sampleKeys([[0,0],[.15,-.085],[.45,-.025],[.80,0]],a);return p;
}
export function signaturePose(kind,sim){
 const attack=sim.attack,p=sim.plan;
 if(sim.hitT<0)return refineActing(kind,sim,signaturePoseAt(kind,attack,sim.time,p));
 const age=sim.time-sim.hitT,base=signaturePoseAt(kind,attack,sim.hitT,p);
 if(kind==='tiger'){
  const b=poseParameters('tiger','react',age);b.bodyX*=(attack==='sweep'?1.6:1.1);b.bodyZ*=attack==='stomp'?1.18:1;b.headY+=attack==='sweep'?.18*Math.sin(Math.min(1,age/.7)*Math.PI):0;
  // Match the exact pre-contact pose at t=0, not an arbitrary canned entry pose.
  const blend=ease(age/.075);return refineActing(kind,sim,{...DEFAULT,...Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,(base[k]||0)*(1-blend)+(b[k]||0)*blend]))});
 }
 // Follow through the stroke for a few frames, then settle. No pose pop on contact.
 const cont=signaturePoseAt(kind,attack,sim.hitT+age,p),fade=1-ease((age-.22)/.85),out={...DEFAULT};
 for(const k of Object.keys(out))out[k]=cont[k]*fade;
 out.bodyY-=attack==='stomp'?.08*Math.sin(Math.min(1,age/.32)*Math.PI):0;
 return refineActing(kind,sim,out);
}
export function signatureFoot(kind,index,leg,sim,root){
 const presencePlacement=presenceFoot(kind,index,leg,sim,root);if(presencePlacement)return presencePlacement;
 if(kind!=='elephant')return null;
 const f=leg.foot.slice(),attack=sim.attack,age=sim.hitT<0?-1:sim.time-sim.hitT;
 const a=sim.hitT<0?strikeAge(sim):sim.hitT-sim.plan.windup-sim.plan.drive+age;
 if(a<0)return null;
 const anchor=sim.hitT<0?{...root}:{...sim.rootAtContact};
 const end={...sim,hitT:-1,time:sim.plan.windup+sim.plan.drive-1e-6,signedTravel:{...sim.signedTravel,elephant:sim.plan.travel}};
 const initial=directedFootPlacement(kind,index,leg,end,anchor).local;
 let x=initial.x+(f[0]-initial.x)*ease(a/.14),y=initial.y+(f[1]-initial.y)*ease(a/.14),z=f[2];
 if(index===0&&attack==='stomp'){
  x=sampleKeys([[0,initial.x],[.16,1.16],[.27,1.68],[.37,2.12],[.48,2.05],[.70,1.28],[1.12,f[0]]],a);
  y=sampleKeys([[0,initial.y],[.16,1.15],[.27,1.50],[.38,1.12],[.49,.92],[.70,.32],[1.12,f[1]]],a);
  z=f[2]-.20*ease(a/.20);
 }
 return {anchor,local:presenceStrikeFoot(sim,a,index,{x,y,z})};
}
// Trunk centreline is expressed in head-local WORLD-ALIGNED rest axes. Its
// segment lengths remain constant while the spine-like chain changes direction.
export function trunkDirections(data,pose){
 const lift=sat(pose.trunkLift),swing=pose.trunkSwing||0,points=data.trunk.map(i=>data.bones[i].p),result=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz),u=i/(points.length-2);
  const rest=Math.atan2(dx,-dy),theta=rest*(1-lift)+(.62+.70*u)*lift;
  const phi=swing*(.28+.72*u);
  result.push({x:L*Math.sin(theta)*Math.cos(phi),y:-L*Math.cos(theta),z:L*Math.sin(theta)*Math.sin(phi)});
 }
 return result;
}
export function signatureRecoil(sim,age){
 if(sim.presence)return presenceRecoil(sim,age);
 const gain=sim.reactionScale,r=sampleKeys([[0,0],[.09,.09],[.22,.38],[.44,.88],[.70,1.04],[1.32,1.04]],age)*gain;
 const side=sim.attack==='sweep'?sampleKeys([[0,0],[.14,.18],[.42,.57],[.75,.65],[1.25,.65]],age)*gain:0;
 return {forward:r,side};
}
