import {BattleSimulation} from './simulation.mjs';
import {STEP} from './mechanics.mjs';
import {validAttack,signaturePlan,finalizePlan,signatureTravel,signaturePhase,strikeAge,signatureRecoil} from './signature.mjs';
/** Exact visible-pose tracking is provided by attachSignatureTracker().
 * Rapier contact belongs to a tracked foot/trunk proxy, never a timer.
 * Actor bodies remain a deliberately constrained hybrid, not full biomechanics.
 */
export class SignatureBattleSimulation extends BattleSimulation{
 constructor(R,settings,onEvent=()=>{}){
  super(R,{...settings,mode:'physics'},onEvent);this.attack=validAttack(settings.attack);this.directed=true;this.signature=true;
  this.plan=finalizePlan(signaturePlan(this.settings,this.attack));this.elapsed=0;this.holdRemaining=0;this.clockHeldSteps=0;this.contactCount=0;
  this.directedStart={...this.elephant.translation()};this.initialTigerRotation={...this.tiger.rotation()};this.rootAtContact=null;this.defenderAtContact=null;
  this.reactionScale=Math.max(.65,Math.min(1.15,Math.sqrt(250/this.settings.mass)));
  this.elephant.setBodyType(R.RigidBodyType.KinematicPositionBased,true);this.elephant.setLinvel({x:0,y:0,z:0},true);
  this.world.forEachCollider(c=>{if(!c.parent())c.setCollisionGroups(0x00010006);});
  for(const c of this.animalColliders.elephant)c.setCollisionGroups(0x00020001);
  for(const c of this.animalColliders.tiger)c.setCollisionGroups(0x00020005);
  this.strikers=[];this.strikeHandles=new Set();this.poseSampler=null;this.proxySamples=[];
  for(let i=0;i<(this.attack==='stomp'?1:4);i++){
   const body=this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,-50,0).setCcdEnabled(true));
   const collider=this.world.createCollider(R.ColliderDesc.ball(this.attack==='stomp'?.205:.13).setCollisionGroups(0).setRestitution(0).setFriction(.3).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS),body);
   this.strikers.push({body,collider});this.strikeHandles.add(collider.handle);
  }
 }
 setPoseSampler(fn){if(typeof fn!=='function')throw new TypeError('Visible skeleton pose sampler required');this.poseSampler=fn;}
 hit(point,source='Rapier tracked limb contact'){
  if(this.hitT>=0||!this.running)return;
  this.rootAtContact={...this.elephant.translation()};this.defenderAtContact={...this.tiger.translation()};this.contactVelocity={...this.tiger.linvel()};this.contactCount++;
  this.holdRemaining=this.plan.hitHold;this.tiger.setBodyType(this.R.RigidBodyType.KinematicPositionBased,true);this.tiger.setLinvel({x:0,y:0,z:0},true);
  for(const s of this.strikers)s.collider.setCollisionGroups(0);
  super.hit(point,source);
 }
 step(){
  if(!this.running||this.done)return;
  if(!this.poseSampler)throw new Error('Cannot run a signature attack without the visible-skeleton tracker. No timed fallback.');
  this.elapsed+=STEP;this.frame++;
  if(this.holdRemaining>1e-8){this.holdRemaining=Math.max(0,this.holdRemaining-STEP);this.clockHeldSteps++;return;}
  this.previous=this.positions();this.time+=STEP;const {dir}=this.layout;let next;
  if(this.hitT<0){const d=signatureTravel(this.time,this.plan);next={x:this.directedStart.x+dir.x*d,y:this.directedStart.y,z:this.directedStart.z+dir.z*d};}
  else{
   const age=this.time-this.hitT,back=-.14*Math.min(1,age/.8),r=signatureRecoil(this,age),a=this.rootAtContact,b=this.defenderAtContact;
   next={x:a.x+dir.x*back,y:a.y,z:a.z+dir.z*back};
   this.tiger.setNextKinematicTranslation({x:b.x+dir.x*r.forward-dir.z*r.side,y:b.y,z:b.z+dir.z*r.forward+dir.x*r.side});
  }
  this.elephant.setNextKinematicTranslation(next);
  const poses=this.poseSampler(next,this),a=strikeAge(this),active=this.hitT<0&&a>=this.plan.activeFrom&&a<=this.plan.activeTo;
  if(poses.length!==this.strikers.length)throw new Error('Strike proxy count does not match the rig');
  poses.forEach((p,i)=>{
   if(![p.x,p.y,p.z].every(Number.isFinite))throw new Error('Invalid striking-limb pose');
   this.strikers[i].body.setNextKinematicTranslation(p);this.strikers[i].collider.setCollisionGroups(active?0x00040002:0);
  });
  this.proxySamples=poses.map(p=>({...p}));this.world.step(this.queue);let hit=null;
  this.queue.drainCollisionEvents(()=>{});this.queue.drainContactForceEvents(()=>{});
  if(active)for(const s of this.strikers)for(const c of this.animalColliders.tiger){
   this.world.contactPair(s.collider,c,m=>{
    if(m.numSolverContacts()>0)hit={...m.solverContactPoint(0)};
    for(let i=0;i<m.numContacts();i++)this.maxPenetration=Math.max(this.maxPenetration,-m.contactDist(i));
   });
  }
  if(hit)this.hit(hit);
  if(this.pendingDebris){this.spawnDebris(this.pendingDebris);this.pendingDebris=null;}
  const pos=this.positions();
  for(const k of ['elephant','tiger']){const dx=pos[k].x-this.previous[k].x,dz=pos[k].z-this.previous[k].z;this.traveled[k]+=Math.hypot(dx,dz);this.signedTravel[k]+=k==='elephant'?dx*dir.x+dz*dir.z:-dx;}
  const tv=this.tiger.linvel(),v=Math.hypot(tv.x,tv.z),d=Math.hypot(pos.tiger.x-this.startTiger.x,pos.tiger.z-this.startTiger.z);
  this.peakTigerSpeed=Math.max(this.peakTigerSpeed,v);this.peakDisplacement=Math.max(this.peakDisplacement,d);
  const phase=signaturePhase(this);if(phase!==this.phase){this.phase=phase;this.onEvent({type:'phase',phase,time:this.time});}
  if(this.frame%8===0)this.samples.push({t:this.elapsed,v,dx:d});
  if(![pos.elephant.x,pos.elephant.y,pos.elephant.z,pos.tiger.x,pos.tiger.y,pos.tiger.z].every(Number.isFinite))throw new Error('Non-finite signature state');
  if(this.hitT>=0?this.time>=this.hitT+this.plan.recovery:this.time>=this.plan.missEnd){this.running=false;this.done=true;this.phase=this.hitT>=0?'complete':'miss';this.onEvent({type:'complete',time:this.elapsed,result:this.report()});}
 }
 report(){return {...super.report(),mode:'directed',attack:this.attack,presentationDuration:this.elapsed,animationTime:this.time,hitHoldSeconds:this.plan.hitHold,heldSteps:this.clockHeldSteps,contactCount:this.contactCount,
  contactSource:this.hitT<0?null:'Rapier contact on visible-pose tracked '+(this.attack==='stomp'?'forefoot':'trunk'),strikeProxySamples:this.proxySamples,
  defenderMotion:this.hitT>=0?'authored-kinematic-reaction':'dynamic-before-contact',peakContactForceN:null,integratedContactForceNs:null,
  notes:'Exact visible-bone world positions drive simplified strike proxies. Contact gates authored recoil; not physically simulated animal muscles, balance, or realistic trunk aggression.'};}
}
