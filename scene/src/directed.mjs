import {BattleSimulation} from './simulation.mjs';
import {STEP,contactPairKind} from './mechanics.mjs';
import {directedPlan,directedTravel,directedPhase,recoilDistance,attackerAfterContact,HIT_HOLD} from './performance.mjs';
/** Hybrid: a kinematic attacker; a dynamic defender until a real contact is
 * detected, then an explicitly authored kinematic reaction. It is not a claim
 * of physically emergent balance or a ragdoll. Dynamic debris remains Rapier.
 */
export class DirectedBattleSimulation extends BattleSimulation{
 constructor(R,settings,onEvent=()=>{}){
  super(R,{...settings,mode:'physics'},onEvent);
  this.directed=true;this.plan=directedPlan(this.settings);this.elapsed=0;this.holdRemaining=0;
  this.elephant.setBodyType(R.RigidBodyType.KinematicPositionBased,true);
  this.elephant.setLinvel({x:0,y:0,z:0},true);
  this.rootAtContact=null;this.defenderAtContact=null;this.clockHeldSteps=0;
  this.reactionScale=Math.max(.65,Math.min(1.15,Math.sqrt(250/this.settings.mass)));
  // Start coordinates retain the settled grounded position from the baseline.
  this.directedStart={...this.elephant.translation()};
  this.initialTigerRotation={...this.tiger.rotation()};
  this.contactCount=0;
 }
 hit(point,source){
  if(this.hitT>=0||!this.running)return;
  this.rootAtContact={...this.elephant.translation()};
  this.defenderAtContact={...this.tiger.translation()};
  this.contactVelocity={...this.tiger.linvel()};
  this.contactCount++;
  this.holdRemaining=HIT_HOLD;
  // Body ownership switches once, after the physics contact has been observed.
  this.tiger.setBodyType(this.R.RigidBodyType.KinematicPositionBased,true);
  this.tiger.setLinvel({x:0,y:0,z:0},true);
  super.hit(point,'Rapier contact');
 }
 step(){
  if(!this.running||this.done)return;
  this.elapsed+=STEP;this.frame++;
  if(this.holdRemaining>1e-8){this.holdRemaining=Math.max(0,this.holdRemaining-STEP);this.clockHeldSteps++;return;}
  this.previous=this.positions();this.time+=STEP;
  const {dir}=this.layout,p0=this.directedStart;
  if(this.hitT<0){
   const d=directedTravel(this.time,this.plan);
   this.elephant.setNextKinematicTranslation({x:p0.x+dir.x*d,y:p0.y,z:p0.z+dir.z*d});
  }else{
   const age=this.time-this.hitT,d=attackerAfterContact(age),r=recoilDistance(age,this.reactionScale);
   const a=this.rootAtContact,b=this.defenderAtContact;
   this.elephant.setNextKinematicTranslation({x:a.x+dir.x*d,y:a.y,z:a.z+dir.z*d});
   // A braced stagger in the direction of impact, not a sliding idle pose.
   this.tiger.setNextKinematicTranslation({x:b.x+dir.x*r,y:b.y,z:b.z+dir.z*r});
  }
  this.world.step(this.queue);
  let contact=null;
  this.queue.drainCollisionEvents((a,b,started)=>{
   if(!started||!contactPairKind(this.kinds.get(a),this.kinds.get(b)))return;
   const ca=this.world.getCollider(a),cb=this.world.getCollider(b);
   this.world.contactPair(ca,cb,m=>{if(m.numSolverContacts()>0)contact={...m.solverContactPoint(0)};});
  });
  // Querying an ongoing contact also handles contacts which begin between event boundaries.
  if(this.hitT<0)for(const a of this.animalColliders.elephant)for(const b of this.animalColliders.tiger){
   this.world.contactPair(a,b,m=>{if(m.numSolverContacts()>0){contact={...m.solverContactPoint(0)};}});
  }
  this.queue.drainContactForceEvents(e=>{
   if(contactPairKind(this.kinds.get(e.collider1()),this.kinds.get(e.collider2()))){
    const f=e.totalForceMagnitude();this.maxForce=Math.max(this.maxForce,f);this.totalImpulse+=f*STEP;
   }
  });
  if(contact&&this.hitT<0)this.hit(contact,'Rapier contact');
  if(this.pendingDebris){this.spawnDebris(this.pendingDebris);this.pendingDebris=null;}
  for(const a of this.animalColliders.elephant)for(const b of this.animalColliders.tiger)this.world.contactPair(a,b,m=>{for(let i=0;i<m.numContacts();i++)this.maxPenetration=Math.max(this.maxPenetration,-m.contactDist(i));});
  const p=this.positions();
  for(const k of ['elephant','tiger']){
   const dx=p[k].x-this.previous[k].x,dz=p[k].z-this.previous[k].z;
   this.traveled[k]+=Math.hypot(dx,dz);this.signedTravel[k]+=k==='elephant'?dx*dir.x+dz*dir.z:-dx;
  }
  const tv=this.tiger.linvel(),speed=Math.hypot(tv.x,tv.z),disp=Math.hypot(p.tiger.x-this.startTiger.x,p.tiger.z-this.startTiger.z);
  this.peakTigerSpeed=Math.max(this.peakTigerSpeed,speed);this.peakDisplacement=Math.max(this.peakDisplacement,disp);
  const phase=directedPhase(this.time,this.hitT,this.plan);
  if(phase!==this.phase){this.phase=phase;this.onEvent({type:'phase',phase,time:this.time});}
  if(this.frame%8===0)this.samples.push({t:this.elapsed,v:speed,dx:disp});
  if(![p.elephant.x,p.elephant.y,p.elephant.z,p.tiger.x,p.tiger.y,p.tiger.z].every(Number.isFinite))throw new Error('Non-finite directed state');
  if(this.hitT>=0?this.time>=this.hitT+this.plan.recovery:this.time>=this.plan.missEnd){
   this.running=false;this.done=true;this.phase=this.hitT>=0?'complete':'miss';
   this.onEvent({type:'complete',time:this.elapsed,result:this.report()});
  }
 }
 report(){
  return {...super.report(),mode:'directed',presentationDuration:this.elapsed,animationTime:this.time,
   hitHoldSeconds:HIT_HOLD,heldSteps:this.clockHeldSteps,contactCount:this.contactCount,
   defenderMotion:this.hitT>=0?'authored-kinematic-reaction':'dynamic-before-contact',
   peakContactForceN:null,integratedContactForceNs:null,
   notes:'Rapier confirms real contact. Kinematic authored attacker and post-contact paired reaction; not physically emergent knockback. No chess-rule change.'};
 }
}
