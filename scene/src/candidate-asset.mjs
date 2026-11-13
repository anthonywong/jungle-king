import {candidatePose,nativeCandidatePose,neutralCandidateRig,CANDIDATE_ALIGNMENT} from './candidate-pose.mjs';
import {transitionWeight} from './transition.mjs';
import {rigStrikePoints} from './rig.mjs';

export async function createCandidateAnimal(THREE,GLTFLoader,uri,data){
 if(!uri.startsWith('data:model/gltf-binary;base64,'))throw new Error('Bundled candidate missing; no baseline substitution is allowed.');
 const raw=atob(uri.slice(uri.indexOf(',')+1)),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
 const group=new THREE.Group();group.name='elephant';
 const alignment=new THREE.Group();alignment.quaternion.fromArray(CANDIDATE_ALIGNMENT);alignment.add(gltf.scene);group.add(alignment);
 const byNode=new Map();gltf.scene.traverse(o=>{const info=gltf.parser.associations.get(o);if(info?.nodes!==undefined)byNode.set(info.nodes,o);});
 const bones=data.bones.map(b=>{
  const node=byNode.get(b.sourceNodeIndex);if(!node?.isBone)throw new Error('Candidate bone mapping failed: '+b.name);return node;
 });
 const meshes=[];gltf.scene.traverse(o=>{
  if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;
  const original=o.material,create=m=>new THREE.MeshStandardMaterial({color:0x928679,roughness:1,metalness:0,side:m.side});
  o.userData.original=original;o.userData.clay=Array.isArray(original)?original.map(create):create(original);meshes.push(o);
 });
 const mesh=meshes.find(m=>m.isSkinnedMesh&&m.geometry.attributes.position.count>10000);
 if(!mesh||bones.length!==107)throw new Error('Unexpected candidate topology; not loading as a valid replacement.');
 const helper=new THREE.SkeletonHelper(gltf.scene);helper.visible=false;helper.material.depthTest=false;helper.renderOrder=10;
 const mixer=new THREE.AnimationMixer(gltf.scene),clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
 if(!clips['01_Idle'])throw new Error('Source idle animation missing');
 const idle=mixer.clipAction(clips['01_Idle']);idle.play();idle.paused=true;
 const a={imported:true,group,alignment,gltf,meshes,mesh,bones,data,kind:'elephant',helper,mixer,sourceIdle:idle,
  clips,actions:{},rest:bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()})),
  material:mesh.material,clayMaterial:mesh.userData.clay,ink:{visible:false},footLocks:[],stage:null};
 setNativePose(a,nativeCandidatePose(data,neutralCandidateRig(data)));return a;
}
export function beginCandidateBlend(a){
 a.entryPose=a.bones.map(b=>({position:b.position.toArray(),quaternion:b.quaternion.toArray(),scale:b.scale.toArray()}));a.returnBlend=0;
}
function setNativePose(a,native){
 native.forEach((t,i)=>{const b=a.bones[i];b.position.fromArray(t.position);b.quaternion.fromArray(t.quaternion);b.scale.fromArray(t.scale);});
 a.group.updateMatrixWorld(true);for(const m of a.meshes)if(m.isSkinnedMesh)m.skeleton.update();
}
export function poseCandidateAnimal(THREE,a,opts){
 const s=opts.sim,active=s&&(s.running||s.done);
 if(active){
  if(!s.signature||s.attack!=='stomp')throw new Error('This integration is validated only for the existing heavy stomp. Other attacks are not retargeted.');
  a.sourceIdle.enabled=false;
  const q=a.group.quaternion,p=a.group.position,rig=candidatePose(a.data,s,{x:p.x,y:p.y,z:p.z},[q.x,q.y,q.z,q.w]);
  const native=nativeCandidatePose(a.data,rig);
  setNativePose(a,native);a.lastRig=rig;a.rigReport=rig.feet;
  // Blend only outside the active contact interval. Tracker and render are exact
  // throughout the committed strike; no change to the accepted stomp or hit time.
  if(a.entryPose&&s.time<.16){
   const w=transitionWeight(s.time,.16);
   a.bones.forEach((b,i)=>{b.position.fromArray(a.entryPose[i].position).lerp(new THREE.Vector3().fromArray(native[i].position),w);b.quaternion.fromArray(a.entryPose[i].quaternion).slerp(new THREE.Quaternion().fromArray(native[i].quaternion),w);b.scale.fromArray(a.entryPose[i].scale).lerp(new THREE.Vector3().fromArray(native[i].scale),w);});
  }else if(s.done&&a.returnBlend>0){
   a.sourceIdle.enabled=true;a.sourceIdle.time=0;a.mixer.update(0);
   const goals=a.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
   const w=transitionWeight(a.returnBlend,1);setNativePose(a,native);
   a.bones.forEach((b,i)=>{b.position.lerp(goals[i].p,w);b.quaternion.slerp(goals[i].q,w);b.scale.lerp(goals[i].s,w);});
  }
  a.group.updateMatrixWorld(true);for(const mesh of a.meshes)if(mesh.isSkinnedMesh)mesh.skeleton.update();
  a.stage=s.hitT>=0?'react':s.time<s.plan.windup?'prepare':s.time<s.plan.windup+s.plan.drive?'drive':'strike';
 }else{
  // Neutral comparison is source idle frame 0; non-inspection idle remains a native clip.
  a.sourceIdle.enabled=true;a.sourceIdle.paused=true;a.sourceIdle.time=opts.freezeSourceIdle?0:(opts.earTime??opts.time)%a.clips['01_Idle'].duration;
  a.mixer.update(0);a.group.updateMatrixWorld(true);for(const m of a.meshes)if(m.isSkinnedMesh)m.skeleton.update();a.stage='source-idle';
 }
 a.lastPoseTime=opts.time;
}
export function setCandidateClay(a,on){for(const mesh of a.meshes)mesh.material=on?mesh.userData.clay:mesh.userData.original;}
export function attachCandidateTracker(THREE,sim,a){
 sim.setPoseSampler((root,s)=>{
  a.group.position.set(root.x,root.y,root.z);const q=s.elephant.rotation();a.group.quaternion.set(q.x,q.y,q.z,q.w);
  poseCandidateAnimal(THREE,a,{time:s.time,sim:s});
  // Same evaluated pose feeds the rendered skin and the contact proxy.
  return rigStrikePoints(a.data,a.lastRig,'stomp');
 });
}
