/** Directed performance, in seconds/metres/radians. Original editable key poses.
 * This is choreography, not a biomechanical simulation or a physics result.
 * Contact is discovered by Rapier; the reaction's local clock begins there.
 */
export const PERFORMANCE_VERSION='0.2.0';
export const HIT_HOLD=0.075;
export const ANTICIPATION=0.38;
export const REACTION_LENGTH=1.30;
export const sat=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=sat(x);return x*x*(3-2*x);};
export function sampleKeys(keys,t){
 if(t<=keys[0][0])return keys[0][1];
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
  const a=keys[i-1],b=keys[i];return a[1]+(b[1]-a[1])*ease((t-a[0])/(b[0]-a[0]));
 }
 return keys.at(-1)[1];
}
// One attack style. The body contacts first; this is not a trunk whip or a leap.
export const POSES={
 elephant:{
  prepare:{bodyY:[[0,0],[.6,-.12],[1,-.17]],bodyZ:[[0,0],[1,-.045]],headZ:[[0,0],[.65,-.10],[1,-.17]],headY:[[0,0],[1,-.03]],curl:[[0,0],[.6,.085],[1,.12]],ears:[[0,0],[.55,.15],[1,.23]],tail:[[0,0],[1,-.08]],jaw:[[0,0],[.3,-.09],[.8,-.10],[1,-.02]]},
  drive:{bodyY:[[0,-.17],[.3,-.19],[.72,-.12],[1,-.16]],bodyZ:[[0,-.045],[.45,-.07],[1,-.10]],headZ:[[0,-.17],[.4,-.22],[1,-.26]],headY:[[0,-.03],[1,.015]],curl:[[0,.12],[.5,.15],[1,.18]],ears:[[0,.23],[.35,-.11],[1,-.17]],tail:[[0,-.08],[1,-.19]],jaw:[[0,-.02],[1,0]]},
  react:{bodyY:[[0,-.16],[.10,-.24],[.28,-.17],[.58,-.075],[1.05,0],[1.3,0]],bodyZ:[[0,-.1],[.10,-.12],[.28,-.025],[.6,.018],[1.15,0]],headZ:[[0,-.26],[.09,-.30],[.25,-.12],[.52,.045],[.95,0],[1.3,0]],headY:[[0,.015],[.2,-.035],[.8,0]],curl:[[0,.18],[.14,.23],[.38,.13],[.85,.035],[1.3,0]],ears:[[0,-.17],[.10,.19],[.28,-.075],[.52,.065],[.9,0]],tail:[[0,-.19],[.2,-.1],[.6,.04],[1.2,0]],jaw:[[0,0],[.15,-.045],[.55,0]]}
 },
 tiger:{
  prepare:{bodyY:[[0,0],[.4,-.07],[1,-.13]],bodyZ:[[0,0],[1,.065]],headZ:[[0,0],[1,-.03]],headY:[[0,0],[1,.02]],tail:[[0,0],[1,.15]],ears:[[0,0],[1,-.13]],jaw:[[0,0],[.55,-.26],[1,-.36]]},
  drive:{bodyY:[[0,-.13],[.6,-.18],[1,-.24]],bodyZ:[[0,.065],[1,.1]],headZ:[[0,-.03],[.5,.02],[1,.045]],headY:[[0,.02],[1,0]],tail:[[0,.15],[1,.22]],ears:[[0,-.13],[1,-.22]],jaw:[[0,-.36],[.7,-.42],[1,-.38]]},
  react:{bodyY:[[0,-.24],[.07,-.33],[.19,-.10],[.36,-.22],[.55,-.48],[.72,-.59],[.95,-.44],[1.3,-.28]],bodyZ:[[0,.10],[.09,.25],[.25,.32],[.43,.13],[.64,-.045],[1.3,.02]],bodyX:[[0,0],[.17,.09],[.48,.34],[.7,.40],[1.05,.18],[1.3,.08]],headZ:[[0,.045],[.08,.34],[.22,.14],[.42,-.12],[.75,.10],[1.3,.04]],headY:[[0,0],[.14,-.14],[.42,-.24],[.78,-.07],[1.3,0]],tail:[[0,.22],[.16,-.32],[.40,-.53],[.7,-.18],[1.3,.08]],ears:[[0,-.22],[.12,-.32],[.55,-.16],[1.3,-.06]],jaw:[[0,-.38],[.10,-.58],[.36,-.24],[.7,-.14],[1.3,-.04]]}
 }
};
export function poseParameters(kind,stage,t){
 const p=POSES[kind][stage],out={bodyY:0,bodyZ:0,bodyX:0,headZ:0,headY:0,curl:0,ears:0,tail:0,jaw:0};
 for(const [key,keys] of Object.entries(p))out[key]=sampleKeys(keys,t);
 return out;
}
export function directedPlan(s){
 const travel=Math.max(.5,s.distance-3.65),duration=Math.max(.48,Math.min(1.45,travel/(s.speed*1.55)));
 return {windup:ANTICIPATION,drive:duration,travel,hitHold:HIT_HOLD,recovery:REACTION_LENGTH,missEnd:ANTICIPATION+duration+.65};
}
// Nonuniform velocity, continuous position and velocity at beginning/end.
export function driveFraction(u){u=sat(u);return u*u*(3-2*u);}
export function directedTravel(t,plan){
 if(t<=0)return 0;
 if(t<plan.windup)return -.10*ease(t/plan.windup);
 return -.10+(plan.travel+.10)*driveFraction((t-plan.windup)/plan.drive);
}
export function directedPhase(time,hitT,plan){
 if(hitT>=0){const a=time-hitT;return a<.12?'impact':a<.76?'recoil':'recovery';}
 return time<plan.windup?'prepare':time<plan.windup+plan.drive?'approach':'miss';
}
export function recoilDistance(age,energy=1){return sampleKeys([[0,0],[.09,.075],[.24,.37],[.46,.70],[.73,.85],[1.3,.85]],age)*energy;}
export function attackerAfterContact(age){return sampleKeys([[0,0],[.08,.025],[.22,-.055],[.55,-.20],[1.3,-.20]],age);}
// An actual foot's contact point is held in world space during stance.
// No lerping of planted feet. Release only at the planned lift event.
export function footGoal(distance,index,kind='elephant'){
 const stride=kind==='elephant'?1.40:.68,duty=kind==='elephant'?.66:.61;
 const phases=kind==='elephant'?[0,.5,.25,.63]:[0,.45,.23,.59];
 const unit=distance/stride+phases[index],cycle=Math.floor(unit),phase=unit-cycle;
 if(phase<duty)return {x:(.5-phase/duty)*stride*duty,lift:0,stance:true,phase,cycle};
 const u=(phase-duty)/(1-duty);return {x:(-.5+ease(u))*stride*duty,lift:Math.sin(Math.PI*u)**1.3*(kind==='elephant'?.22:.20),stance:false,phase,cycle};
}
export function reactionFoot(age,index,kind){
 if(kind==='elephant')return {x:sampleKeys([[0,0],[.24,index<2?.16:-.08],[.55,0],[1.3,0]],age),lift:sampleKeys([[0,0],[.17,index<2?.09:0],[.38,0]],age)};
 const delay=[.04,.12,.24,.32][index],u=Math.max(0,age-delay);
 return {x:sampleKeys([[0,0],[.13,-.28],[.28,-.43],[.46,.13],[.76,.04],[1.3,.04]],u),lift:sampleKeys([[0,0],[.11,.25],[.25,.14],[.36,0]],u)};
}
export function cameraCue(time,hitT,plan){
 const age=hitT<0?-1:time-hitT,p=hitT<0?sat((time-plan.windup)/plan.drive):1;
 return {push:age<0?ease(p)*.10:sampleKeys([[0,.10],[.10,.15],[.4,.13],[1.3,.03]],age),
 shake:age<0?0:Math.exp(-age*15),focus:age<0?ease(p):1};
}

/** Deterministic planted-foot target for directed clips. The anchor is in world
 * space; offsets are in the actor's local facing frame. Safe for seeking. */
export function directedFootPlacement(kind,index,leg,sim,currentRoot){
 const f=leg.foot,plan=sim.plan;let anchor={...currentRoot},x=f[0],y=f[1],z=f[2];
 if(sim.hitT<0){
  if(sim.time<plan.windup||kind==='tiger')anchor={...(kind==='elephant'?sim.directedStart:sim.startTiger)};
  else{
   const D=Math.max(0,sim.signedTravel.elephant+.10),g=footGoal(D,index,kind),g0=footGoal(0,index,kind);
   x+=.10+g.x-g0.x;y+=g.lift;
  }
 }else{
  const age=Math.max(0,sim.time-sim.hitT),ep=sim.rootAtContact,tp=sim.defenderAtContact,dir=sim.layout.dir;
  let initial=0,initialLift=0;
  if(kind==='elephant'){
   const D=Math.max(0,(ep.x-sim.directedStart.x)*dir.x+(ep.z-sim.directedStart.z)*dir.z+.10);
   initial=.10+footGoal(D,index,kind).x-footGoal(0,index,kind).x;initialLift=footGoal(D,index,kind).lift;
  }
  const delay=kind==='tiger'?[.04,.12,.24,.32][index]:0;
  const land=kind==='tiger'?delay+.36:index<2?.38:.18;
  const r=reactionFoot(age,index,kind);
  const planted=r.lift+initialLift*(1-ease(age/.18))<.006;
  let sample=age;
  if(planted)sample=age<land?0:land;
  if(kind==='elephant'&&index>=2&&initialLift<.006)sample=0;
  const rr=reactionFoot(sample,index,kind),decay=1-ease(sample/.5);
  x+=initial*decay+rr.x;y+=rr.lift+initialLift*(1-ease(sample/.18));
  const base=kind==='elephant'?ep:tp;
  const distance=kind==='elephant'?attackerAfterContact(sample):recoilDistance(sample,sim.reactionScale);
  anchor={x:base.x+dir.x*distance,y:base.y,z:base.z+dir.z*distance};
 }
 // Foot height is absolute above the flat floor; actor root height is not added.
 return {anchor,local:{x,y,z}};
}
