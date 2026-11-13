/** V05 shot design. All coordinates are in metres; angles in radians.
 * Pure functions: pausing, seeking and different render rates give the same view.
 * This module never changes physics, contact results, or the outcome of a capture.
 */
export const CAMERA_VERSION='0.5.0';
const cutClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const cutEase=x=>{x=cutClamp(x,0,1);return x*x*x*(10+x*(-15+6*x));};
const cutMix=(a,b,t)=>a+(b-a)*t;
const cadd=(a,b)=>a.map((v,i)=>v+b[i]);
const csub=(a,b)=>a.map((v,i)=>v-b[i]);
const cmul=(a,n)=>a.map(v=>v*n);
const cdot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cnorm=a=>cmul(a,1/(Math.hypot(...a)||1));
const ccross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const asArray=v=>Array.isArray(v)?v:[v.x,v.y,v.z];
export function cameraBasis(back){
 const b=cnorm(back),right=cnorm(ccross([0,1,0],b));
 return {back:b,right,up:cnorm(ccross(b,right))};
}
/** Minimum perspective distance enclosing the supplied silhouette samples.
 * Includes headroom / footroom for letterboxing and leaves impact unobstructed.
 */
export function fitShot(points,target,back,fov,aspect,minDistance=7.3,marginX=.87,marginY=.78){
 const basis=cameraBasis(back),tv=Math.tan(fov*Math.PI/360),th=tv*Math.max(.22,aspect);
 let distance=minDistance;
 for(const point of points){const d=csub(asArray(point),target),depth=cdot(d,basis.back);
  distance=Math.max(distance,depth+Math.abs(cdot(d,basis.right))/(th*marginX),depth+Math.abs(cdot(d,basis.up))/(tv*marginY),depth+.35);
 }
 return {position:cadd(target,cmul(basis.back,distance)),target:target.slice(),distance,fov,...basis};
}
export function projectShot(point,shot,aspect){
 const d=csub(asArray(point),shot.position),z=-cdot(d,shot.back),t=Math.tan(shot.fov*Math.PI/360);
 return {x:cdot(d,shot.right)/(z*t*aspect),y:cdot(d,shot.up)/(z*t),depth:z};
}
/** Guard envelopes for both actors, including flexible trunk/ear silhouettes.
 * Actual deformed silhouette samples, if supplied, supplement these envelopes.
 */
export function actorEnvelope(root,dir,kind){
 root=asArray(root);const f=cnorm([dir.x,0,dir.z]),s=[-f[2],0,f[0]];
 const ranges=kind==='elephant'?[[-2.15,3.25],[.00,3.88],[-1.35,1.35]]:[[-1.78,2.08],[.00,1.9],[-.62,.62]];
 const points=[];
 for(const x of ranges[0])for(const y of ranges[1])for(const z of ranges[2])points.push(cadd(root,cadd(cmul(f,x),[s[0]*z,y,s[2]*z])));
 return points;
}
/** A small camera jolt, derived from simulation time rather than wall time.
 * It starts at zero, so the contact pose has no discontinuity and hit-stop holds.
 */
export function impactJolt(age,attack,reduced=false){
 if(reduced||age<0||age>.42)return {x:0,y:0,roll:0};
 const envelope=(1-Math.exp(-age*70))*Math.exp(-age*11);
 return {x:(attack==='sweep'?.075:.024)*Math.sin(age*45)*envelope,
  y:(attack==='stomp'?.065:.025)*Math.sin(age*38)*envelope,
  roll:(attack==='sweep'?.0045:.0020)*Math.sin(age*32)*envelope};
}
export function directedShot(input){
 const {time=0,hitT=-1,plan,elephant,tiger,dir={x:1,z:0},attack='stomp',aspect=1.6,preset='director',active=true,reduced=false}=input;
 const E=asArray(elephant),T=asArray(tiger),forward=cnorm([dir.x,0,dir.z]),side=[-forward[2],0,forward[0]];
 const age=hitT<0?-1:Math.max(0,time-hitT),u=cutClamp((time-plan.windup)/plan.drive,0,1);
 const strikeAge=time-plan.windup-plan.drive;
 const allPoints=[...actorEnvelope(E,dir,'elephant'),...actorEnvelope(T,{x:-1,z:0},'tiger'),...(input.silhouette||[])];
 let label='全景',shot='establish',fov=43,along=.23,elevation=.18,min=8.6;
 let target=[(E[0]+T[0])*.5+.10,1.68,(E[2]+T[2])*.5],points=allPoints;
 const still=reduced||preset==='fixed'||!active;
 if(still){
  // Fixed means a fixed world-space camera for the complete encounter, not a
  // camera continually chasing the midpoint under a "fixed" label.
  const start=input.start?asArray(input.start):E,def=input.defenderStart?asArray(input.defenderStart):T;
  target=[(start[0]+def[0])*.5+.35,1.65,(start[2]+def[2])*.5];
  const finish=cadd(start,cmul(forward,plan.travel||0));
  points=[...actorEnvelope(start,dir,'elephant'),...actorEnvelope(finish,dir,'elephant'),...actorEnvelope(def,{x:-1,z:0},'tiger'),...actorEnvelope(cadd(def,cmul(forward,2.1)),{x:-1,z:0},'tiger')];
  shot='fixed';label=reduced?'穩定鏡頭':'固定全景';along=.20;elevation=.24;min=10;
 }else if(preset==='director'&&time<plan.windup){
  // One medium anticipation shot; the tiger may be outside this opening shot.
  // Both animals are always framed from the start of the approach through hit.
  const p=cutEase(time/plan.windup);shot='anticipation';label='01 · 凝視蓄勢';
  target=cadd(E,cadd(cmul(forward,1.32),[0,2.57,0]));
  along=cutMix(.68,.59,p);elevation=.055;fov=39;min=cutMix(5.7,5.45,p);
  // Deliberate head/shoulder insert, not a failed attempt to fit the whole body.
  points=[];for(const x of [.05,3.05])for(const y of [1.35,3.95])for(const z of [-1.25,1.25])points.push(cadd(E,cadd(cmul(forward,x),[side[0]*z,y,side[2]*z])));
 }else if(preset==='director'&&age>=.58){
  shot='resolve';label='03 · 受擊與落定';const q=cutEase((age-.58)/Math.max(.4,plan.recovery-.58));
  target=[E[0]*.40+T[0]*.60,1.54,E[2]*.40+T[2]*.60];
  along=cutMix(.42,.52,q);elevation=cutMix(.14,.18,q);fov=43;min=cutMix(8.3,8.9,q);
 }else{
  // The camera stays on this side of the fight line and DOES NOT cut at contact.
  // Stomp: low, unobscured three-quarter side. Sweep: slightly elevated to read
  // the horizontal arc without rotating behind the elephant's body.
  shot='action';label=attack==='sweep'?'02 · 橫掃弧線':attack==='drive'?'02 · 追隨衝勢':'02 · 踏落接觸';
  const close=cutEase(u),release=age<0?0:cutEase(age/1.0);
  along=attack==='sweep'?cutMix(.28,.14,close):cutMix(.12,-.06,close);
  elevation=attack==='sweep'?.23:.12;fov=cutMix(44,40,close)+release*2;
  min=attack==='sweep'?9.4:8.5;
  target=[E[0]*.44+T[0]*.56,attack==='sweep'?1.65:1.50,E[2]*.44+T[2]*.56];
  if(preset==='continuous'){
   label='連續低角跟拍';shot='continuous';along=attack==='sweep'?.22:.10;elevation=attack==='sweep'?.22:.16;
   fov=43;min=8.9;
  }
 }
 const back=cnorm(cadd(cadd(cmul(forward,along),side),[0,elevation,0]));
 const camera=fitShot(points,target,back,fov,aspect,min,.89,.81);
 const j=still?{x:0,y:0,roll:0}:impactJolt(age,attack,reduced);
 // Translate eye and aim together: directional impulse without an artificial
 // zoom, disorientation, or the contact point disappearing behind a whip pan.
 const displacement=cadd(cmul(camera.right,j.x),cmul(camera.up,j.y));
 camera.position=cadd(camera.position,displacement);camera.target=cadd(camera.target,displacement);
 return {...camera,shot,label,roll:j.roll,age,cutAllowed:shot==='anticipation'||shot==='resolve',points,
  sameSide:cdot(csub(camera.position,target),side)>0,aspect,attack,strikeAge};
}
/** Presentation pacing changes ONLY the rate at which fixed 120-Hz steps are
 * consumed. It never changes physics dt or animal clip times. Hit-stop is not
 * slowed again; a miss receives no success slow-motion or impact accent.
 */
export function dramaticRate(sim,enabled=true){
 if(!enabled||!sim.directed||!sim.running||sim.holdRemaining>0)return 1;
 if(sim.hitT<0)return 1;
 const a=sim.time-sim.hitT;
 if(a<.025)return cutClamp(1-.32*cutEase(a/.025),.68,1);
 if(a<.15)return .68;
 if(a<.30)return cutClamp(.68+.32*cutEase((a-.15)/.15),.68,1);
 return 1;
}
