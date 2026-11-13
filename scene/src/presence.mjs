/** PRESENCE 06 — one performance, with an explicit threat / release / consequence.
 * Not a new move, a geometry replacement, or a physical claim. All functions
 * sample the simulation clock. A miss can never produce success effects.
 */
import {directedShot,fitShot,cameraBasis} from './cinematography.mjs';
export const PRESENCE_VERSION='0.6.0';
const prsClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const prsEase=x=>{x=prsClamp(x,0,1);return x*x*(3-2*x);};
const prsMix=(a,b,u)=>a+(b-a)*u;
const prsVec=v=>Array.isArray(v)?v:[v.x,v.y,v.z];
const prsAdd=(a,b)=>a.map((v,i)=>v+b[i]);
const prsMul=(v,n)=>v.map(x=>x*n);
const prsNorm=v=>prsMul(v,1/(Math.hypot(...v)||1));
const prsDot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const prsBump=(t,a,b)=>{const u=prsClamp((t-a)/(b-a),0,1);return u<=0||u>=1?0:16*u*u*(1-u)*(1-u);};
function prsKeys(keys,t){if(t<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const a=keys[i-1],b=keys[i];return prsMix(a[1],b[1],prsEase((t-a[0])/(b[0]-a[0])));}return keys.at(-1)[1];}
/** Height/pressure are deliberately contrasted. Faster release, not a global
 * fast-forward. Each consumed physics tick remains exactly 1/120 second. */
export function presenceRate(sim,enabled=true){
 if(!enabled||!sim.presence||!sim.signature||!sim.running||sim.holdRemaining>0)return 1;
 if(sim.hitT>=0){const a=sim.time-sim.hitT;return a<.30?1.05:1;}
 const p=sim.plan,t=sim.time,a=t-p.windup-p.drive;
 if(t<p.windup)return prsKeys([[0,.68],[.18,.62],[p.windup-.04,.62],[p.windup,1.25]],t);
 if(a<0)return 1.25;
 if(sim.attack==='stomp')return prsKeys([[0,1.1],[.12,.78],[.20,.48],[.265,.48],[.295,1.60],[.40,1.60],[.54,1.0]],a);
 return prsKeys([[0,.95],[.12,.55],[.18,.55],[.215,1.65],[.34,1.65],[.45,1.0]],a);
}
/** Upper-body performance refinement. The stomp foot has a separate bounded
 * lift/drop accent below; both rendering and real strike proxies use it. */
export function presencePose(kind,sim,pose){
 if(!sim.presence||sim.actingRefined===false)return pose;
 const p={...pose},add=(k,x)=>p[k]=(p[k]||0)+x;
 if(sim.hitT<0){
  if(sim.time>=sim.plan.windup)return p;
  const u=sim.time/sim.plan.windup;
  if(kind==='elephant'){
   add('bodyY',-.075*prsBump(u,.05,1));add('bodyZ',.035*prsBump(u,.05,1));
   add('headZ',-.085*prsBump(u,.13,1));add('ears',.17*prsBump(u,.12,1));
   add('tail',-.10*prsBump(u,.1,1));
  }else{add('bodyY',-.07*prsBump(u,.18,1));add('headZ',.065*prsBump(u,.15,1));}
  return p;
 }
 const a=Math.max(0,sim.time-sim.hitT);
 if(kind==='elephant'){
  add('bodyY',-.075*prsBump(a,.01,.30));add('bodyZ',-.035*prsBump(a,.015,.25));
  add('headZ',-.075*prsBump(a,.045,.32)+.075*prsBump(a,.48,1.32));
  add('ears',.07*prsBump(a,.12,.61));add('tail',-.11*prsBump(a,.15,.75));
 }else{
  // The shoulder takes the blow first; head/hips follow. No airborne rigid toy.
  add('bodyY',-.045*prsBump(a,.015,.19)-.055*prsBump(a,.31,.70));
  add('bodyZ',.075*prsBump(a,.03,.28));
  add('bodyX',.11*prsBump(a,.12,.72));
  add('bodyYaw',-.10*prsBump(a,.09,.77));
  add('headZ',.16*prsBump(a,.06,.30));add('headY',-.10*prsBump(a,.10,.68));
  add('tail',-.18*prsBump(a,.12,.60));
 }
 return p;
}
/** Stronger but bounded authored stagger. It is not reported as a physical
 * impulse, is continuous at contact, and respects the existing mass scaling. */
export function presenceRecoil(sim,age){
 const gain=sim.reactionScale??1;
 return {forward:prsKeys([[0,0],[.045,.04],[.12,.26],[.24,.79],[.43,1.33],[.65,1.47],[1.32,1.47]],age)*gain,
  side:prsKeys([[0,0],[.10,.035],[.26,.24],[.52,sim.attack==='sweep'?.72:.20],[1.32,sim.attack==='sweep'?.72:.20]],age)*gain};
}
/** Defender feet catch the stagger rather than being anchored to V02's shorter
 * displacement curve. Each landing is a world-space point and stays planted.
 * Two catch steps; no whole-animal jump or free-running ragdoll. */
export function presenceFoot(kind,index,leg,sim,root){
 if(!sim.presence||kind!=='tiger'||sim.hitT<0)return null;
 const age=Math.max(0,sim.time-sim.hitT),base=sim.defenderAtContact,dir=sim.layout.dir,f=leg.foot;
 const first=[[.045,.28],[.085,.33],[.14,.41],[.185,.46]][index];
 const second=[[.48,.73],[.53,.79],[.57,.85],[.61,.90]][index];
 const basePoint=t=>{const r=presenceRecoil(sim,t);return {x:base.x+dir.x*r.forward-dir.z*r.side,z:base.z+dir.z*r.forward+dir.x*r.side};};
 const start={x:base.x,z:base.z},end1=basePoint(first[1]),end2=basePoint(second[1]);
 let anchor=start,lift=0;
 for(const [i,[a,b]] of [first,second].entries()){
  const from=i?end1:start,to=i?end2:end1;
  if(age<a)break;
  const u=prsClamp((age-a)/(b-a),0,1),q=prsEase(u);
  anchor={x:prsMix(from.x,to.x,q),z:prsMix(from.z,to.z,q)};
  lift=Math.sin(Math.PI*u)*(i?.10:.19)*(index<2?1:.85);
 }
 return {anchor:{...anchor,y:base.y},local:{x:f[0],y:f[1]+Math.max(0,lift),z:f[2]}};
}
/** Camera envelopes are shot-specific. The full elephant's rear/tail need not
 * be visible in a head insert. The striking region and defender are protected
 * throughout contact. Screen direction is unchanged at every edit. */
export function presenceShot(input){
 if(!input.presence||input.reduced||input.preset==='fixed'||!input.active||input.attack==='drive')return directedShot(input);
 if(input.preset==='continuous')return directedShot(input);
 const {time,hitT,plan,attack='stomp',aspect=16/9,dir={x:1,z:0}}=input;
 const E=prsVec(input.elephant),T=prsVec(input.tiger),F=prsNorm([dir.x,0,dir.z]),S=[-F[2],0,F[0]];
 const age=hitT<0?-1:Math.max(0,time-hitT),u=prsClamp((time-plan.windup)/plan.drive,0,1);
 const a=time-plan.windup-plan.drive,world=(r,x,y,z)=>prsAdd(r,prsAdd(prsMul(F,x),[S[0]*z,y,S[2]*z]));
 let shot,label,target,along,slope,fov,min,points=[];
 if(time<plan.windup){
  shot='threat';label='一 · 山嶽壓境';
  target=world(E,1.75,2.79,0);along=.82;slope=-.34;fov=42;min=3.10-.12*prsEase(time/plan.windup);
  // Deliberate head/shoulders insert, not an auto-framed whole-body view.
  for(const x of [1.00,3.00])for(const y of [2.05,3.73])for(const z of [-.70,.70])points.push(world(E,x,y,z));
 }else{
  const consequence=age>=.33;
  shot=consequence?'consequence':'release';label=consequence?'三 · 餘威未息':'二 · 一擊千鈞';
  target=[E[0]*.37+T[0]*.63,consequence?1.52:1.78,E[2]*.37+T[2]*.63];
  along=consequence?.34:prsMix(.08,.42,prsEase(u));
  slope=consequence?-.14:-.23;fov=consequence?46:prsMix(52,49,prsEase(u));min=consequence?5.8:5.15;
  // Attacking forequarter + the entire defender; hindquarters can leave frame.
  for(const x of [prsMix(.02,.40,prsEase(u)),3.0])for(const y of [.08,3.78])for(const z of [-.95,.95])points.push(world(E,x,y,z));
  for(const x of [-1.70,consequence?1.55:.72])for(const y of [.03,1.90])for(const z of [-.65,.65])points.push(prsAdd(T,[x,y,z]));
  if(attack==='sweep')for(const z of [-2.0,2.0])points.push(world(E,3.15,1.35,z));
  if(input.hitPoint)points.push(prsVec(input.hitPoint));
 }
 const B=prsNorm(prsAdd(prsAdd(prsMul(F,along),S),[0,slope,0]));
 let camera=fitShot(points,target,B,fov,aspect,min,.91,.88);
 // Never go under the stage, even when a narrow portrait view requires more distance.
 if(camera.position[1]<.34){
  const horizontal=Math.hypot(camera.position[0]-target[0],camera.position[2]-target[2]);
  const safeSlope=(.34-target[1])/Math.max(.1,horizontal);
  const flat=prsNorm([B[0],0,B[2]]),safe=prsNorm([flat[0],safeSlope,flat[2]]);
  camera=fitShot(points,target,safe,fov,aspect,min,.91,.88);
  if(camera.position[1]<.28){camera.position[1]=.28;const bas=cameraBasis(camera.position.map((v,i)=>v-target[i]));Object.assign(camera,bas);}
 }
 // A single directional recoil — not continuous random shaking. The contact
 // view holds until 0.33 s after hit. Impact itself has zero discontinuity.
 let roll=0;
 if(age>0&&age<.30){
  const pulse=Math.sin(Math.PI*prsClamp(age/.16,0,1))*Math.exp(-age*7);
  const x=(attack==='sweep'?.09:.025)*pulse,y=(attack==='stomp'?-.085:-.018)*pulse;
  const offset=prsAdd(prsMul(camera.right,x),prsMul(camera.up,y));
  camera.position=prsAdd(camera.position,offset);camera.target=prsAdd(camera.target,offset);
  roll=(attack==='sweep'?-.010:.004)*pulse;
 }
 return {...camera,shot,label,age,roll,points,aspect,attack,strikeAge:a,
  sameSide:prsDot(camera.position.map((v,i)=>v-target[i]),S)>0,cutAllowed:shot==='threat'||shot==='consequence'};
}
/** Audio volume is controlled in one place, not with competing timers. */
export function presenceAudioMix(sim){
 if(!sim?.presence||!sim.signature||!sim.running)return 1;
 if(sim.hitT>=0)return prsKeys([[0,.28],[.09,.22],[.30,.65],[.58,1]],sim.time-sim.hitT);
 const a=sim.time-sim.plan.windup-sim.plan.drive;
 return prsKeys([[-10,1],[.06,1],[.19,.18],[.29,.18],[.52,.65],[.74,1]],a);
}
/** Low, sparse dust — position and opacity sample simulation time. No flashes
 * or victory effects when a striker misses. */
export function presenceDust(age,index,point,dir={x:1,z:0}){
 if(age<0||age>1.05)return {visible:false,alpha:0,x:0,y:0,z:0,size:0};
 const seed=((index*73+19)%97)/97,theta=index*2.399963229728653;
 const u=Math.max(0,age-(index%4)*.012),r=(.20+u*(2.0+seed*2.5));
 const x=point.x+Math.cos(theta)*r+dir.x*u*.5,z=point.z+Math.sin(theta)*r+dir.z*u*.5;
 return {visible:u>0,alpha:.19*Math.sin(Math.PI*prsClamp(u/.95,0,1))*(.65+seed*.35),x,y:.06+Math.sin(Math.PI*prsClamp(u/1.05,0,1))*(.15+seed*.20),z,size:.18+u*(.7+seed*.5)};
}

/** Same stomp, stronger lift/drop contrast. A pose change, not a new move.
 * The active proxy is still sampled from the resulting real visible skeleton. */
export function presenceStrikeFoot(sim,a,index,foot){
 if(!sim.presence||sim.attack!=='stomp'||index!==0)return foot;
 return {...foot,x:foot.x+prsKeys([[0,0],[.20,-.18],[.27,-.08],[.35,0],[.58,0]],a),
  y:foot.y+prsKeys([[0,0],[.16,.18],[.24,.55],[.29,.48],[.34,-.12],[.42,-.18],[.56,0]],a)};
}
