import {poseCandidateAnimal,setCandidateClay,attachCandidateTracker} from './candidate-asset.mjs';
import {lookdevMaterial,addLookdevDetails} from './lookdev.mjs';
import {flexibleEarRotations} from './ear-motion.mjs';
import {solveSignatureRig} from './rig.mjs';
import {signaturePose,signatureFoot,trunkDirections} from './signature.mjs';
import {poseParameters,POSES,footGoal,reactionFoot,sat,directedFootPlacement} from './performance.mjs';
/* Continuous skinned meshes: the visible animal is one deforming surface,
   rather than a collection of rigid body parts. Physics uses simpler colliders. */
export function createAnimal(THREE,data,kind,lookdevAssets=null){
 const group=new THREE.Group();group.name=kind;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));
 geometry.setAttribute('sculptSurface',new THREE.Float32BufferAttribute(data.surfaceIds||new Array(data.positions.length/3).fill(0),1));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.skinIndices,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.skinWeights,4));geometry.setIndex(data.indices);
 const bones=data.bones.map(d=>{const b=new THREE.Bone();b.name=d.name;return b;});
 data.bones.forEach((d,i)=>{const p=d.parent<0?[0,0,0]:data.bones[d.parent].p;bones[i].position.set(d.p[0]-p[0],d.p[1]-p[1],d.p[2]-p[2]);if(d.parent>=0)bones[d.parent].add(bones[i]);});
 const material=lookdevAssets?lookdevMaterial(THREE,kind,lookdevAssets.skinRelief):new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88});
 const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=kind+' continuous skin';mesh.add(bones[0]);
 const skeleton=new THREE.Skeleton(bones);mesh.bind(skeleton);mesh.normalizeSkinWeights();mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);
 // Restrained silhouette, not an exaggerated cartoon contour.
 const inkMat=new THREE.MeshBasicMaterial({color:0x2a2822,side:THREE.BackSide});
 inkMat.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','vec3 transformed = position + normal * 0.0015;');};
 const ink=new THREE.SkinnedMesh(geometry,inkMat);ink.bind(skeleton,mesh.bindMatrix);ink.frustumCulled=false;group.add(ink);
 const helper=new THREE.SkeletonHelper(mesh);helper.visible=false;helper.material.depthTest=false;helper.renderOrder=10;
 const detailMaterials=[];
 function sphere(pos,scale,color,boneIndex=data.head){
  const mat=new THREE.MeshStandardMaterial({color,roughness:.72});detailMaterials.push(mat);
  const o=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),mat);const bp=data.bones[boneIndex].p;
  o.position.set(pos[0]-bp[0],pos[1]-bp[1],pos[2]-bp[2]);o.scale.set(...scale);o.castShadow=true;bones[boneIndex].add(o);return o;
 }
 function taperedCurve(points,radius,color,boneIndex=data.head){
  const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),geo=new THREE.TubeGeometry(c,28,radius,10,false);
  const p=geo.attributes.position;const bp=data.bones[boneIndex].p;
  for(let i=0;i<p.count;i++){const t=Math.floor(i/11)/28;const q=c.getPointAt(t),v=new THREE.Vector3().fromBufferAttribute(p,i);v.sub(q).multiplyScalar(Math.max(.015,1-t*.98)).add(q);p.setXYZ(i,v.x-bp[0],v.y-bp[1],v.z-bp[2]);}geo.computeVertexNormals();
  const o=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.8}));o.castShadow=true;bones[boneIndex].add(o);
 }
 if(!(data.anatomyVersion>=7)&&!(kind==='elephant'&&data.anatomyVersion>=3))for(const side of [1,-1]){
  if(kind==='elephant'){
   taperedCurve([[1.9,2.25,side*.39],[2.25,1.97,side*.46],[2.68,1.94,side*.48],[2.95,2.14,side*.44]],.135,0xe5ddbc);
   sphere([1.88,2.91,side*.48],[.095,.071,.055],0x302b23);
   sphere([1.90,2.915,side*.516],[.048,.040,.023],0xb3a078);
   sphere([1.913,2.918,side*.533],[.021,.027,.011],0x0c0b09);
   sphere([1.925,2.936,side*.538],[.008,.009,.006],0xf9f4d6);
   for(const leg of data.legs){if(leg.side!==side)continue;const [x,,z]=leg.foot;
    for(let k=-1;k<=1;k++)sphere([x+.325,.17,z+k*.105],[.045,.065,.05],0x8c8775,leg.bones[2]);}
  }else{
   sphere([1.43,1.465,side*.266],[.092,.057,.042],0x30291c);
   sphere([1.45,1.467,side*.293],[.050,.035,.022],0xc7ab55);
   sphere([1.458,1.467,side*.310],[.014,.029,.009],0x11130e);
   sphere([1.469,1.481,side*.316],[.007,.007,.004],0xfff4ca);
   sphere([1.04,1.75,side*.345],[.063,.088,.012],0x393029,data.ears[side===1?0:1]);
   for(let i=0;i<4;i++){
    const start=new THREE.Vector3(1.59,1.18+i*.035,side*.235),end=new THREE.Vector3(1.65+i*.015,1.08+i*.09,side*(.50+i*.025));
    const bp=new THREE.Vector3(...data.bones[data.head].p);const g=new THREE.BufferGeometry().setFromPoints([start.sub(bp),end.sub(bp)]);
    const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xe3dcc9,transparent:true,opacity:.75}));bones[data.head].add(line);
   }
  }
 }
 if(kind==='tiger'&&data.anatomyVersion<7){sphere([1.665,1.375,0],[.042,.048,.11],0x34251e);sphere([1.47,1.207,0],[.18,.019,.18],0x251a18,data.jaw??data.head);}

 if(kind==='tiger'&&data.anatomyVersion<7&&data.jaw!==undefined){
  for(const side of [-1,1]){
   taperedCurve([[1.51,1.28,side*.17],[1.53,1.19,side*.17],[1.535,1.14,side*.16]],.032,0xeadbbb);
   taperedCurve([[1.48,1.19,side*.14],[1.49,1.25,side*.14]],.022,0xe1d3b3,data.jaw);
  }
 }
 const animal={group,mesh,bones,data,kind,helper,ink,distance:0,lastPosition:null,
  rest:bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),
  material,clayMaterial:new THREE.MeshStandardMaterial({color:0x928679,roughness:1}),footLocks:[],stage:null};
 if(lookdevAssets)addLookdevDetails(THREE,animal);
 createPerformanceClips(THREE,animal);
 return animal;

}

/** The main poses are authored clips rather than a sine-wave walk cycle.
 * IK runs after clip evaluation to keep planted feet on the floor.
 */
function createPerformanceClips(THREE,a){
 a.mixer=new THREE.AnimationMixer(a.mesh);a.actions={};a.clips={};
 for(const stage of ['prepare','drive','react']){
  const params=POSES[a.kind][stage],times=[...new Set(Object.values(params).flatMap(keys=>keys.map(k=>k[0])))].sort((a,b)=>a-b);
  const tracks=[],rotations=new Map(),y=[];
  for(const t of times){
   const p=poseParameters(a.kind,stage,t);y.push(a.rest[a.data.body].p.y+p.bodyY);
   const values=new Map();values.set(a.data.body,[p.bodyX,0,p.bodyZ]);values.set(a.data.head,[0,p.headY,p.headZ]);
   a.data.ears.forEach((id,i)=>values.set(id,[0,(i===0?1:-1)*p.ears,0]));
   a.data.trunk.forEach((id,i)=>values.set(id,[0,0,p.curl*(.55+i*.11)*(7/Math.max(7,a.data.trunk.length-1))]));
   a.data.tail.forEach((id,i)=>values.set(id,[0,p.tail*(.45+i*.09),-.035*p.tail]));
   if(a.data.jaw!==undefined)values.set(a.data.jaw,[0,0,p.jaw]);
   for(const [id,euler] of values){
    if(!rotations.has(id))rotations.set(id,[]);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler));rotations.get(id).push(q.x,q.y,q.z,q.w);
   }
  }
  tracks.push(new THREE.NumberKeyframeTrack(a.bones[a.data.body].name+'.position[y]',times,y));
  for(const [id,values] of rotations)tracks.push(new THREE.QuaternionKeyframeTrack(a.bones[id].name+'.quaternion',times,values));
  const clip=new THREE.AnimationClip(a.kind+'_'+stage,-1,tracks);a.clips[stage]=clip;
  const action=a.mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;action.enabled=false;a.actions[stage]=action;
 }
}
function aimBone(THREE,bone,child,targetWorld,rest){
 // worldToLocal includes this bone's current rotation. Reset before obtaining
 // the parent-space target for a fresh shortest-arc rotation.
 bone.quaternion.identity();bone.updateWorldMatrix(true,false);
 const target=bone.worldToLocal(targetWorld.clone()).normalize();
 bone.quaternion.setFromUnitVectors(rest.clone().normalize(),target);bone.updateWorldMatrix(false,true);
}
function plantedIK(THREE,a,leg,target){
 const b=a.bones,ids=leg.bones,hip=b[ids[0]],knee=b[ids[1]],ankle=b[ids[2]];
 a.group.updateWorldMatrix(true,true);
 const H=hip.getWorldPosition(new THREE.Vector3());let T=target.clone();
 const rootQ=a.group.getWorldQuaternion(new THREE.Quaternion());
 if(ids.length===4){
  const terminal=a.rest[ids[3]].p.clone().applyQuaternion(rootQ);T.sub(terminal);
 }
 const d=T.clone().sub(H),length=Math.max(1e-7,d.length()),dir=d.clone().divideScalar(length),l1=leg.lengths[0],l2=leg.lengths[1];
 const reach=Math.max(Math.abs(l1-l2)+1e-5,Math.min(l1+l2-1e-5,length));
 const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const pole=new THREE.Vector3(leg.front?-1:1,0,0).applyQuaternion(rootQ);
 pole.addScaledVector(dir,-pole.dot(dir));if(pole.lengthSq()<1e-6)pole.set(0,0,1);pole.normalize();
 const K=H.clone().addScaledVector(dir,along).addScaledVector(pole,height);
 const ankleTarget=H.clone().addScaledVector(dir,reach);
 aimBone(THREE,hip,knee,K,a.rest[ids[1]].p);
 aimBone(THREE,knee,ankle,ankleTarget,a.rest[ids[2]].p);
 if(ids.length===4)aimBone(THREE,ankle,b[ids[3]],target,a.rest[ids[3]].p);
 const paw=b[ids.at(-1)],parentQ=paw.parent.getWorldQuaternion(new THREE.Quaternion());
 paw.quaternion.copy(parentQ.invert().multiply(rootQ));
 a.group.updateWorldMatrix(true,true);
}
export function resetAnimalPerformance(a){a.footLocks=[];a.stage=null;a.lastPoseTime=-1;}
export function poseAnimal(THREE,a,opts,legIK,gaitFoot){
 if(a.imported)return poseCandidateAnimal(THREE,a,opts);
 const {bones,data,kind,rest,group}=a,sim=opts.sim,active=sim?.running||sim?.done;
 if(active&&sim.signature){
  const q=group.quaternion,result=solveSignatureRig(data,sim,{x:group.position.x,y:group.position.y,z:group.position.z},[q.x,q.y,q.z,q.w],kind);
  for(const action of Object.values(a.actions))action.enabled=false;
  bones.forEach((bone,i)=>{bone.position.fromArray(result.localPositions[i]);bone.quaternion.fromArray(result.localRotations[i]);bone.scale.set(1,1,1);});
  a.stage=sim.hitT>=0?'react':sim.time<sim.plan.windup?'prepare':sim.time<sim.plan.windup+sim.plan.drive?'drive':'strike';
  a.rigReport=result.feet;group.updateMatrixWorld(true);a.mesh.skeleton.update();a.lastPoseTime=opts.time;return;
 }

 for(let i=0;i<bones.length;i++){bones[i].position.copy(rest[i].p);bones[i].quaternion.copy(rest[i].q);bones[i].scale.set(1,1,1);}
 for(const action of Object.values(a.actions))action.enabled=false;
 let stage=null,t=0,age=-1;
 if(active&&sim.directed){
  if(sim.hitT>=0){stage='react';t=sim.time-sim.hitT;age=t;}
  else if(sim.time<sim.plan.windup){stage='prepare';t=sat(sim.time/sim.plan.windup);}
  else{stage='drive';t=sat((sim.time-sim.plan.windup)/sim.plan.drive);}
  const action=a.actions[stage];action.enabled=true;action.paused=true;action.time=t;action.setEffectiveWeight(1);a.mixer.update(0);
 }else{
  // Legacy locomotion kept for comparison, not relabelled as the new choreography.
  bones[data.body].position.y+=Math.sin(opts.time*2.15)*.012-(kind==='elephant'?.035:.07)*Math.min(1,opts.speed/.7);
  bones[data.head].rotation.z=(kind==='elephant'?.04:.025)*Math.sin(opts.time*1.8)+(opts.preparation||0)*.07-(opts.reaction||0)*.14;
  data.ears.forEach((idx,i)=>bones[idx].rotation.y=(i===0?1:-1)*(.05*Math.sin(opts.time*2.5+i)+(opts.preparation||0)*.24));
  data.trunk.forEach((idx,i)=>bones[idx].rotation.z=.025*Math.sin(opts.time*1.8-i*.32));
 }
 if(!active){bones[data.head].rotation.z=.014*Math.sin(opts.time*1.4);data.tail.forEach((idx,i)=>bones[idx].rotation.y=.03*Math.sin(opts.time*1.7-i*.4));}
 // Shared flexible-ear path for idle, charge and the legacy comparison.
 // Signature attacks use the same pure helper inside solveSignatureRig.
 if(kind==='elephant'&&data.earRigs?.length){
  let sample=null,earTime=opts.earTime??opts.time;
  if(active&&sim.directed){
   earTime=sim.time;
   sample=tt=>{
    if(sim.hitT>=0&&tt>=sim.hitT)return poseParameters('elephant','react',tt-sim.hitT);
    if(tt<sim.plan.windup)return poseParameters('elephant','prepare',sat(tt/sim.plan.windup));
    return poseParameters('elephant','drive',sat((tt-sim.plan.windup)/sim.plan.drive));
   };
  }else if(active){
   earTime=sim.time;
   sample=tt=>({ears:.05*Math.sin(tt*2.5)+(tt<1.05?.24*Math.sin(Math.PI*tt/1.05):0),headY:0,headZ:.04*Math.sin(tt*1.8)});
  }
  for(const e of flexibleEarRotations(data,earTime,sample,active?sim.hitT:-1))bones[e.id].quaternion.setFromEuler(new THREE.Euler(e.x,e.y,e.z));
 }
 // Retain the planted point through anticipation and at the actual impact.
 if(a.stage!==stage){a.footLocks=[];a.stage=stage;}
 group.updateMatrixWorld(true);
 data.legs.forEach((leg,i)=>{
  let target;
  if(sim?.directed&&active){
   const f=(sim.signature?signatureFoot(kind,i,leg,sim,group.position):null)||directedFootPlacement(kind,i,leg,sim,group.position);
   target=new THREE.Vector3(f.local.x,0,f.local.z).applyQuaternion(group.quaternion);
   target.x+=f.anchor.x;target.z+=f.anchor.z;target.y=f.local.y;
  }else{
   let g={x:0,lift:0};
   if(Math.abs(opts.speed)>.05)g=footGoal(opts.distance,i,kind);
   target=group.localToWorld(new THREE.Vector3(leg.foot[0]+g.x,leg.foot[1]+g.lift,leg.foot[2]));
   target.y=leg.foot[1]+g.lift;
  }
  plantedIK(THREE,a,leg,target);
 });
 group.updateMatrixWorld(true);a.mesh.skeleton.update();a.lastPoseTime=opts.time;
}
export function setAnimalClay(a,enabled){if(a.imported)return setCandidateClay(a,enabled);a.mesh.material=enabled?a.clayMaterial:a.material;a.ink.visible=!enabled;if(a.lookdevDetails)a.lookdevDetails.visible=!enabled;}

/** No hard-coded strike coordinates: evaluate the same skeleton the user sees. */
export function attachSignatureTracker(THREE,sim,a,legIK,gaitFoot){
 if(a.imported)return attachCandidateTracker(THREE,sim,a);
 sim.setPoseSampler((root,s)=>{
  a.group.position.set(root.x,root.y,root.z);const q=s.elephant.rotation();a.group.quaternion.set(q.x,q.y,q.z,q.w);
  poseAnimal(THREE,a,{time:s.time,distance:s.signedTravel.elephant,speed:1,sim:s},legIK,gaitFoot);
  a.group.updateWorldMatrix(true,true);
  if(s.attack==='stomp'){
   const leg=a.data.legs[0],id=leg.bones.at(-1);const p=a.bones[id].localToWorld(new THREE.Vector3(.07,-.055,0));return [{x:p.x,y:p.y,z:p.z}];
  }
  const ids=a.data.trunk;return [ids.length-2,ids.length-4,ids.length-6,ids.length-8].map(i=>{const p=a.bones[ids[Math.max(0,i)]].getWorldPosition(new THREE.Vector3());return {x:p.x,y:p.y,z:p.z};});
 });
}
