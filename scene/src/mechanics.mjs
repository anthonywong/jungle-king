/* Pure, engine-independent animation mathematics. Metres / seconds / kilograms. */
export const STEP = 1 / 120;
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const lerp = (a,b,t) => a+(b-a)*t;
export const smooth = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
export function legIK(dx,dy,l1,l2,bend=1){
  const d=clamp(Math.hypot(dx,dy),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);
  const alpha=Math.atan2(dx,-dy);
  const beta=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
  const knee=Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*l1*l2),-1,1));
  return {upper:alpha+bend*beta,lower:-bend*knee,reach:d};
}
export function forwardLeg(a,b,l1,l2){return {x:l1*Math.sin(a)+l2*Math.sin(a+b),y:-l1*Math.cos(a)-l2*Math.cos(a+b)};}
export function gaitFoot(distance,index,kind='elephant'){
  const elephant=kind==='elephant', stride=elephant?.78:.40, duty=elephant?.74:.64;
  const offsets=elephant?[.22,.72,0,.5]:[0,.5,.28,.78];
  const phase=((distance/(stride/duty)+offsets[index])%1+1)%1;
  if(phase<duty) return {x:stride/2-phase/duty*stride,lift:0,stance:true,phase};
  const s=(phase-duty)/(1-duty);
  return {x:-stride/2+smooth(s)*stride,lift:Math.sin(Math.PI*s)**2*(elephant?.16:.14),stance:false,phase};
}
export function validateSettings(s={}){
  const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  return {distance:clamp(finite(s.distance,8),6.2,11),angle:clamp(finite(s.angle,0),-30,30),offset:clamp(finite(s.offset,0),-2.7,2.7),speed:clamp(finite(s.speed,3),1.3,4.6),friction:clamp(finite(s.friction,.65),.1,1.2),mass:clamp(finite(s.mass,250),120,700),mode:s.mode==='animation'?'animation':'physics'};
}
export function arrange(s){
 s=validateSettings(s);const theta=s.angle*Math.PI/180,dir={x:Math.cos(theta),z:Math.sin(theta)};
 const target={x:2.6,y:.02,z:s.offset};
 return {theta,dir,target,start:{x:2.6-dir.x*s.distance,y:.02,z:-dir.z*s.distance},yaw:-theta};
}
export function stageAt(t,hitT=-1){
 if(hitT>=0){const age=t-hitT;return age<.22?'impact':age<1.5?'recoil':'recovery';}
 return t<1.05?'prepare':t<7.8?'approach':'miss';
}
export function motorForce(v,target,mass,dt=.14,maxAccel=18){return mass*clamp((target-v)/dt,-maxAccel,maxAccel);}
export function contactPairKind(a,b){return (a==='elephant'&&b==='tiger')||(a==='tiger'&&b==='elephant');}
export function baselineTravel(t,s){return Math.min(Math.max(0,t-1.05)*s.speed,Math.max(0,s.distance-4.0));}
