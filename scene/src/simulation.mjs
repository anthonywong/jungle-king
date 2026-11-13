import {STEP,clamp,lerp,smooth,validateSettings,arrange,stageAt,motorForce,contactPairKind,baselineTravel} from './mechanics.mjs';

/** Rapier drives body translation, contact impulses and debris. The skin's
 *  skeleton is animation-controlled. This is NOT an active-ragdoll controller. */
export class BattleSimulation {
 constructor(RAPIER,settings,onEvent=()=>{}){
  this.R=RAPIER;this.settings=validateSettings(settings);this.layout=arrange(this.settings);this.onEvent=onEvent;
  this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=STEP;
  this.world.integrationParameters.numSolverIterations=8;this.world.integrationParameters.maxCcdSubsteps=4;
  this.queue=new RAPIER.EventQueue(true);this.kinds=new Map();this.animalColliders={elephant:[],tiger:[]};this.debris=[];
  this.time=0;this.running=false;this.done=false;this.hitT=-1;this.hitPoint=null;this.frame=0;
  this.maxForce=0;this.totalImpulse=0;this.maxPenetration=0;this.peakTigerSpeed=0;this.peakDisplacement=0;this.footDrops=0;
  this.traveled={elephant:0,tiger:0};this.signedTravel={elephant:0,tiger:0};this.samples=[];this.phase='ready';
  const ground=RAPIER.ColliderDesc.cuboid(30,.2,30).setTranslation(0,-.2,0).setFriction(this.settings.friction).setRestitution(.02);
  this.world.createCollider(ground);
  this.elephant=this.makeBody('elephant',this.layout.start,this.layout.yaw,3800);
  this.tiger=this.makeBody('tiger',this.layout.target,Math.PI,this.settings.mass);
  // Settle under gravity before starting the trial. Ignore all startup events.
  for(let i=0;i<36;i++)this.world.step(this.queue);
  this.queue.clear();this.previous=this.positions();this.startTiger={...this.tiger.translation()};
 }
 makeBody(kind,pos,yaw,mass){
  const R=this.R,physical=this.settings.mode==='physics';
  const d=(physical?R.RigidBodyDesc.dynamic():R.RigidBodyDesc.kinematicPositionBased()).setTranslation(pos.x,pos.y,pos.z).setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}).setCcdEnabled(true).setCanSleep(false).lockRotations().setLinearDamping(kind==='tiger'?.65:.25);
  const b=this.world.createRigidBody(d);
  const add=(desc,m=0)=>{desc.setMass(m).setFriction(this.settings.friction).setRestitution(.02).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS|R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(5);
   // Baseline actors deliberately do not physically collide with one another.
   if(!physical)desc.setCollisionGroups(0x00020001);
   const c=this.world.createCollider(desc,b);this.kinds.set(c.handle,kind);this.animalColliders[kind].push(c);return c;
  };
  const q={x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2};
  if(kind==='elephant'){
   add(R.ColliderDesc.capsule(.9,.7).setTranslation(-.05,2.14,0).setRotation(q),mass);
   add(R.ColliderDesc.ball(.58).setTranslation(1.55,2.68,0));
   // Low trunk/chest envelope; deliberately a proxy, not a skin collision mesh.
   add(R.ColliderDesc.capsule(.56,.29).setTranslation(2.12,1.45,0));
   for(const x of [-1.05,.95])for(const z of [-.55,.55])add(R.ColliderDesc.ball(.25).setTranslation(x,.25,z));
  }else{
   add(R.ColliderDesc.capsule(.69,.34).setTranslation(0,1.07,0).setRotation(q),mass);
   add(R.ColliderDesc.ball(.30).setTranslation(1.3,1.32,0));
   for(const x of [-.77,.73])for(const z of [-.27,.27])add(R.ColliderDesc.ball(.14).setTranslation(x,.14,z));
  }
  return b;
 }
 positions(){return {elephant:{...this.elephant.translation()},tiger:{...this.tiger.translation()}};}
 start(){this.running=true;this.done=false;this.phase='prepare';this.onEvent({type:'start',time:0,mode:this.settings.mode});}
 hit(point,source){
  if(this.hitT>=0||!this.running)return;
  this.hitT=this.time;this.hitPoint={...point};this.phase='impact';
  this.onEvent({type:'contact',point:{...point},time:this.time,source});
  this.pendingDebris={...point};
 }
 spawnDebris(p){
  const R=this.R;let seed=731;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<18;i++){
   const r=.035+rand()*.075;
   const b=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x+(rand()-.5)*.6,.12+rand()*.15,p.z+(rand()-.5)*.5).setCcdEnabled(true).setLinearDamping(.5));
   this.world.createCollider(R.ColliderDesc.ball(r).setDensity(1000).setFriction(.8).setRestitution(.25).setCollisionGroups(0x00040001),b);
   b.setLinvel({x:(rand()-.5)*4.8,y:1.1+rand()*3.1,z:(rand()-.5)*4.8},true);b.setAngvel({x:rand()*8,y:rand()*8,z:rand()*8},true);
   this.debris.push({body:b,r});
  }
 }
 step(){
  if(!this.running||this.done)return;this.previous=this.positions();this.time+=STEP;this.frame++;
  const s=this.settings,{dir,start,target}=this.layout;
  if(s.mode==='physics'){
   const v=this.elephant.linvel();let targetSpeed=0;
   if(this.time>=1.05&&this.hitT<0&&this.time<6.7)targetSpeed=s.speed;
   if(this.hitT>=0){const age=this.time-this.hitT;targetSpeed=age<.10?s.speed*.32:age>.62&&age<1.5?-.8:0;}
   this.elephant.resetForces(true);
   this.elephant.addForce({x:motorForce(v.x,dir.x*targetSpeed,3800),y:0,z:motorForce(v.z,dir.z*targetSpeed,3800)},true);
   // Defender is not pushed with a canned impulse. Its translation comes from Rapier.
  }else{
   const d=baselineTravel(this.time,s),back=this.hitT>=0?.45*smooth((this.time-this.hitT-.6)/.85):0;
   this.elephant.setNextKinematicTranslation({x:start.x+dir.x*(d-back),y:0,z:start.z+dir.z*(d-back)});
   if(this.hitT<0&&this.time>=1.05+(s.distance-4)/s.speed&&Math.abs(s.offset)<.80){
    this.hit({x:target.x-1.3,y:1.25,z:target.z},'authored timeline');
   }
   const r=this.hitT<0?0:1.25*smooth((this.time-this.hitT)/.75);
   this.tiger.setNextKinematicTranslation({x:target.x+dir.x*r,y:0,z:target.z+dir.z*r});
  }
  this.world.step(this.queue);
  this.queue.drainCollisionEvents((a,b,started)=>{
   if(!started||s.mode!=='physics'||!contactPairKind(this.kinds.get(a),this.kinds.get(b)))return;
   const c1=this.world.getCollider(a),c2=this.world.getCollider(b);
   this.world.contactPair(c1,c2,m=>{if(m.numSolverContacts()>0)this.hit(m.solverContactPoint(0),'Rapier contact');});
  });
  this.queue.drainContactForceEvents(e=>{
   if(contactPairKind(this.kinds.get(e.collider1()),this.kinds.get(e.collider2()))){
    const f=e.totalForceMagnitude();this.maxForce=Math.max(this.maxForce,f);this.totalImpulse+=f*STEP;
   }
  });
  if(this.pendingDebris){this.spawnDebris(this.pendingDebris);this.pendingDebris=null;}
  // Penetration is measured on collision proxies, not on every skin triangle.
  if(s.mode==='physics')for(const a of this.animalColliders.elephant)for(const b of this.animalColliders.tiger)this.world.contactPair(a,b,m=>{for(let i=0;i<m.numContacts();i++)this.maxPenetration=Math.max(this.maxPenetration,-m.contactDist(i));});
  const p=this.positions();for(const k of ['elephant','tiger']){const dx=p[k].x-this.previous[k].x,dz=p[k].z-this.previous[k].z;this.traveled[k]+=Math.hypot(dx,dz);this.signedTravel[k]+=k==='elephant'?dx*dir.x+dz*dir.z:-dx;}
  const tv=this.tiger.linvel(),speed=Math.hypot(tv.x,tv.z),disp=Math.hypot(p.tiger.x-this.startTiger.x,p.tiger.z-this.startTiger.z);
  this.peakTigerSpeed=Math.max(this.peakTigerSpeed,speed);this.peakDisplacement=Math.max(this.peakDisplacement,disp);
  const newPhase=stageAt(this.time,this.hitT);if(newPhase!==this.phase){this.phase=newPhase;this.onEvent({type:'phase',phase:newPhase,time:this.time});}
  if(this.frame%8===0)this.samples.push({t:this.time,v:speed,dx:disp});
  const finite=[p.elephant.x,p.elephant.y,p.elephant.z,p.tiger.x,p.tiger.y,p.tiger.z].every(Number.isFinite);
  if(!finite)throw new Error('Non-finite physics state. Reset the trial.');
  if(this.time>(this.hitT>=0?this.hitT+3.8:8.2)){
   this.running=false;this.done=true;this.phase=this.hitT>=0?'complete':'miss';this.onEvent({type:'complete',time:this.time,result:this.report()});
  }
 }
 report(){return {settings:{...this.settings},physicsVersion:this.R.version(),timestep:STEP,steps:this.frame,contact:this.hitT>=0,contactTime:this.hitT>=0?this.hitT:null,contactSource:this.hitT<0?null:this.settings.mode==='physics'?'Rapier collision manifold':'authored timeline',peakContactForceN:this.settings.mode==='physics'?this.maxForce:null,integratedContactForceNs:this.settings.mode==='physics'?this.totalImpulse:null,peakProxyPenetrationM:this.settings.mode==='physics'?this.maxPenetration:null,peakDefenderSpeedMps:this.peakTigerSpeed,peakDefenderDisplacementM:this.peakDisplacement,elephantMassKg:3800,defenderMassKg:this.settings.mass,notes:'Constrained dynamic roots; animation-driven skins and limbs. Not a full-body balance, muscle or ragdoll simulation.',samples:this.samples};}
 dispose(){this.queue.free();this.world.free();}
}
