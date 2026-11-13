import {SignatureBattleSimulation} from './signature-simulation.mjs';
import {attachCandidateTracker} from './candidate-asset.mjs';
/** Executed in the user's browser against real Three.js and Rapier.
 * Reports failures, including missed contacts, rather than manufacturing results.
 */
export async function runEngineDiagnostics(THREE,RAPIER,unused,onProgress=()=>{},models=null,factory=null){
 const checks=[],trials={},add=(name,pass,details)=>checks.push({name,passed:!!pass,details});let actor;
 const test=async(name,s)=>{
  onProgress(name);const sim=new SignatureBattleSimulation(RAPIER,{distance:6.4,speed:3.6,attack:'stomp',...s});sim.presence=true;sim.actingRefined=true;
  try{
   attachCandidateTracker(THREE,sim,actor);sim.start();let maxPadError=0,finite=true;
   for(let i=0;i<1200&&sim.running;i++){
    sim.step();actor.group.updateWorldMatrix(true,true);
    if(actor.lastRig){const id=actor.data.legs[0].bones.at(-1),p=actor.bones[id].getWorldPosition(new THREE.Vector3()),q=actor.lastRig.worldPositions[id];maxPadError=Math.max(maxPadError,p.distanceTo(new THREE.Vector3(...q)));}
    for(const mesh of actor.meshes)if(mesh.isSkinnedMesh){mesh.skeleton.update();if(!Array.from(mesh.skeleton.boneMatrices).every(Number.isFinite))finite=false;}
    if(i%160===0)await new Promise(r=>setTimeout(r,0));
   }
   const r=sim.report();trials[name]=r;add(name+' completes',sim.done,{steps:r.steps,contact:r.contact});add(name+' uses finite native skin matrices',finite,null);add(name+' pad follows the visible native skeleton',maxPadError<.0001,{maximumMetres:maxPadError});return r;
  }finally{sim.dispose();}
 };
 try{
  if(!factory)throw new Error('Candidate factory is missing; diagnostics must not test the old baseline instead.');
  actor=await factory();add('Imported skeleton has 107 mapped joints',actor.bones.length===107,actor.bones.length);
  add('Five original clips validate',Object.keys(actor.clips).length===5&&Object.values(actor.clips).every(c=>c.validate()),Object.keys(actor.clips));
  add('Pinned engines loaded',THREE.REVISION==='180'&&RAPIER.version()==='0.17.3',{three:THREE.REVISION,rapier:RAPIER.version()});
  const a=await test('Default stomp',{}),b=await test('Default replay',{}),miss=await test('Clear lateral miss',{offset:2.7});
  add('Default stomp hits exactly once through a tracked limb',a.contact&&a.contactCount===1&&a.contactSource?.includes('visible-pose tracked'),a.contactSource);
  add('Contact and replay are repeatable',a.contact&&b.contact&&a.steps===b.steps&&Math.abs(a.contactTime-b.contactTime)<1e-6,{a:a.contactTime,b:b.contactTime});
  add('Impact hold is 100 ms',a.contact&&a.heldSteps===12,{heldSteps:a.heldSteps});
  add('Lateral miss does not fabricate contact',!miss.contact&&miss.heldSteps===0,miss.contactSource);
  for(const angle of [-15,15]){const r=await test('Angle '+angle,{angle});add('Angle '+angle+' contact is checked, not assumed',r.contact,r.contactTime);}
 }catch(e){add('Diagnostic execution',false,String(e?.stack||e));}
 finally{
  if(actor){actor.mixer.stopAllAction();const mats=new Set(),geos=new Set(),tex=new Set();actor.group.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of [o.material,o.userData?.original,o.userData?.clay].flat())if(m)mats.add(m);});for(const m of mats){for(const value of Object.values(m))if(value?.isTexture)tex.add(value);m.dispose?.();}for(const t of tex){t.image?.close?.();t.dispose();}for(const g of geos)g.dispose();actor.helper.geometry.dispose();actor.helper.material.dispose();}
 }
 return {scope:'Real-engine checks executed on this browser; not artistic approval or biological validation',runAt:new Date().toISOString(),passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks,trials};
}
