import {sampleKeys} from './performance.mjs';
/** Asset-specific adapter. Canonical controls reuse the accepted game stomp;
 * source geometry, skin weights and inverse bind matrices remain untouched.
 * Source animations are NOT silently substituted for the game choreography.
 */
import {solveSignatureRig,qmul,qinverse,qrotate,vsub,vadd,qEuler} from './rig.mjs';
export const CANDIDATE_ALIGNMENT=[0,Math.SQRT1_2,0,Math.SQRT1_2];
export function halfRotation(q){
 const sign=q[3]<0?-1:1,r=[q[0]*sign,q[1]*sign,q[2]*sign,1+q[3]*sign];
 const len=Math.hypot(...r)||1;return r.map(v=>v/len);
}
export function adaptCandidateFoot(index,leg,foot,sim){
 if(index!==0||sim.attack!=='stomp')return foot;
 const age=sim.time-sim.plan.windup-sim.plan.drive;if(age<0)return foot;
 // Source upper limb is shorter than V08. Retain the beat times and the
 // contact endpoint, but lower/extend the windup instead of overfolding the elbow.
 const xCorrection=sampleKeys([[0,0],[.16,.35],[.24,.43],[.29,.32],[.35,0],[.58,0]],age);
 const yReduction=sampleKeys([[0,0],[.16,.20],[.24,.58],[.29,.50],[.35,0],[.58,0]],age);
 return {...foot,local:{...foot.local,x:foot.local.x+xCorrection,y:foot.local.y-yReduction}};
}
export function candidatePose(data,sim,root,rootQ){
 const rig=solveSignatureRig(data,sim,root,rootQ,'elephant',adaptCandidateFoot);
 // Helper joints are siblings of the deforming joints, not extra leg segments.
 for(const [helper,joint] of data.correctivePairs)rig.localRotations[helper]=halfRotation(rig.localRotations[joint]);
 for(const e of data.earRigs)for(const name of ['upper','middle','lower']){
  rig.localRotations[e[name][2]]=halfRotation(rig.localRotations[e[name][1]]);
 }
 // The imported trunk is longer than the prototype. Keep its tip clear of
 // the ground during deep shoulder compression without changing stomp timing.
 const boost=Math.min(.38,Math.max(0,-rig.pose.bodyY)*1.7);
 const trunkRoot=data.trunk[0];rig.localRotations[trunkRoot]=qmul(qEuler(0,0,boost),rig.localRotations[trunkRoot]);
 const Q=Array.isArray(rootQ)?rootQ:[rootQ.x,rootQ.y,rootQ.z,rootQ.w];
 for(let i=0;i<data.bones.length;i++){
  const parent=data.bones[i].parent,p=parent<0?[root.x,root.y,root.z]:rig.worldPositions[parent],q=parent<0?Q:rig.worldRotations[parent];
  rig.worldPositions[i]=vadd(p,qrotate(q,rig.localPositions[i]));rig.worldRotations[i]=qmul(q,rig.localRotations[i]);
 }
 return rig;
}
/** Local target transforms for the native, non-world-aligned imported skeleton. */
export function nativeCandidatePose(data,rig){
 const C=CANDIDATE_ALIGNMENT,I=qinverse(C);
 return data.bones.map((b,i)=>{
  const parentQ=b.parent<0?[0,0,0,1]:data.nativeReferenceWorldRotations[b.parent];
  const invParent=qinverse(parentQ),basis=data.nativeReferenceWorldRotations[i];
  return {position:qrotate(invParent,qrotate(I,rig.localPositions[i])),
   quaternion:qmul(qmul(qmul(qmul(invParent,I),rig.localRotations[i]),C),basis),
   scale:data.nativeReferenceScales[i].slice()};
 });
}
export function neutralCandidateRig(data){
 return {localPositions:data.bones.map(b=>b.parent<0?b.p.slice():vsub(b.p,data.bones[b.parent].p)),localRotations:data.bones.map(()=>[0,0,0,1])};
}
