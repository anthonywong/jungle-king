import {flexibleEarRotations} from './ear-motion.mjs';
/** Engine-independent rig evaluation used by BOTH the WebGL model and tests.
 * No substitute renderer or substitute physics engine; this only poses bones.
 * Quaternions are [x,y,z,w], vectors are [x,y,z]. */
import {signaturePose,signatureFoot,trunkDirections} from './signature.mjs';
import {directedFootPlacement} from './performance.mjs';
export const vadd=(a,b)=>a.map((x,i)=>x+b[i]);
export const vsub=(a,b)=>a.map((x,i)=>x-b[i]);
export const vmul=(a,s)=>a.map(x=>x*s);
export const vdot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const vnorm=a=>vmul(a,1/(Math.hypot(...a)||1));
export const qinverse=q=>[-q[0],-q[1],-q[2],q[3]];
export function qmul(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
export function qrotate(q,v){const t=vmul(vcross(q.slice(0,3),v),2);return vadd(v,vadd(vmul(t,q[3]),vcross(q.slice(0,3),t)));}
export function qEuler(x,y,z){const cx=Math.cos(x/2),sx=Math.sin(x/2),cy=Math.cos(y/2),sy=Math.sin(y/2),cz=Math.cos(z/2),sz=Math.sin(z/2);return [sx*cy*cz+cx*sy*sz,cx*sy*cz-sx*cy*sz,cx*cy*sz+sx*sy*cz,cx*cy*cz-sx*sy*sz];}
export function qbetween(a,b){a=vnorm(a);b=vnorm(b);let r=1+vdot(a,b),q;if(r<1e-7){q=Math.abs(a[0])>Math.abs(a[2])?[-a[1],a[0],0,0]:[0,-a[2],a[1],0];}else q=[...vcross(a,b),r];const l=Math.hypot(...q);return q.map(x=>x/l);}
export function solveSignatureRig(data,sim,root,rootQ,kind='elephant',footAdapter=null){
 const pose=signaturePose(kind,sim),localPositions=data.bones.map(b=>b.parent<0?b.p.slice():vsub(b.p,data.bones[b.parent].p)),localRotations=data.bones.map(()=>[0,0,0,1]);
 localPositions[data.body][1]+=pose.bodyY;localRotations[data.body]=qEuler(pose.bodyX,pose.bodyYaw,pose.bodyZ);localRotations[data.head]=qEuler(0,pose.headY,pose.headZ);
 if(kind==='elephant'&&data.earRigs?.length){
  const earSample=t=>signaturePose(kind,{...sim,time:t,hitT:sim.hitT>=0&&t>=sim.hitT?sim.hitT:-1});
  for(const e of flexibleEarRotations(data,sim.time,earSample,sim.hitT))localRotations[e.id]=qEuler(e.x,e.y,e.z);
 }else data.ears.forEach((id,i)=>localRotations[id]=qEuler(0,(i===0?1:-1)*pose.ears,0));
 data.tail.forEach((id,i)=>localRotations[id]=qEuler(0,pose.tail*(.45+i*.09),0));if(data.jaw!==undefined)localRotations[data.jaw]=qEuler(0,0,pose.jaw);
 const R=[root.x,root.y,root.z],Q=Array.isArray(rootQ)?rootQ:[rootQ.x,rootQ.y,rootQ.z,rootQ.w];let wp=[],wq=[];
 const evaluate=()=>{wp=[];wq=[];for(let i=0;i<data.bones.length;i++){const parent=data.bones[i].parent,pp=parent<0?R:wp[parent],pq=parent<0?Q:wq[parent];wp.push(vadd(pp,qrotate(pq,localPositions[i])));wq.push(qmul(pq,localRotations[i]));}};
 const aim=(id,child,worldTarget)=>{const parent=data.bones[id].parent,pq=parent<0?Q:wq[parent];const want=qrotate(qinverse(pq),vsub(worldTarget,wp[id]));localRotations[id]=qbetween(localPositions[child],want);evaluate();};
 evaluate();
 if(kind==='elephant'){
  const dirs=trunkDirections(data,pose),hq=wq[data.head].slice();let cursor=wp[data.trunk[0]].slice();
  for(let i=0;i<dirs.length;i++){cursor=vadd(cursor,qrotate(hq,[dirs[i].x,dirs[i].y,dirs[i].z]));aim(data.trunk[i],data.trunk[i+1],cursor);}
 }
 const feet=[];
 for(let i=0;i<data.legs.length;i++){
  const leg=data.legs[i],ids=leg.bones,originalFoot=signatureFoot(kind,i,leg,sim,root)||directedFootPlacement(kind,i,leg,sim,root),f=footAdapter?footAdapter(i,leg,originalFoot,sim):originalFoot;
  let offset=qrotate(Q,[f.local.x,0,f.local.z]),target=[f.anchor.x+offset[0],f.local.y,f.anchor.z+offset[2]],ankleTarget=target.slice();
  if(ids.length===4)ankleTarget=vsub(ankleTarget,qrotate(Q,localPositions[ids[3]]));
  const H=wp[ids[0]],d=vsub(ankleTarget,H),L=Math.max(1e-8,Math.hypot(...d)),dir=vmul(d,1/L),[l1,l2]=leg.lengths,reach=Math.max(Math.abs(l1-l2)+1e-5,Math.min(l1+l2-1e-5,L));
  const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along));let pole=qrotate(Q,[leg.front?-1:1,0,0]);pole=vsub(pole,vmul(dir,vdot(pole,dir)));if(Math.hypot(...pole)<1e-6)pole=[0,0,1];pole=vnorm(pole);
  const K=vadd(H,vadd(vmul(dir,along),vmul(pole,height))),T=vadd(H,vmul(dir,reach));
  aim(ids[0],ids[1],K);aim(ids[1],ids[2],T);if(ids.length===4)aim(ids[2],ids[3],target);
  const paw=ids.at(-1);localRotations[paw]=qmul(qinverse(wq[data.bones[paw].parent]),Q);evaluate();
  feet.push({target,actual:wp[paw].slice(),error:Math.hypot(...vsub(wp[paw],target)),reachClamp:Math.max(0,L-reach)});
 }
 return {localPositions,localRotations,worldPositions:wp,worldRotations:wq,feet,pose};
}
export function rigStrikePoints(data,rig,attack){
 if(attack==='stomp'){const id=data.legs[0].bones.at(-1);const p=vadd(rig.worldPositions[id],qrotate(rig.worldRotations[id],[.07,-.055,0]));return [{x:p[0],y:p[1],z:p[2]}];}
 const ids=data.trunk;return [ids.length-2,ids.length-4,ids.length-6,ids.length-8].map(i=>{const p=rig.worldPositions[ids[Math.max(0,i)]];return {x:p[0],y:p[1],z:p[2]};});
}
