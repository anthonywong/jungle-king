/** V04 flexible pinnae. Deterministic, animation-driven secondary motion.
 * Seven skinning joints per ear: supported root plus upper/mid/lower cartilage
 * and rims. This is not cloth, FEM, or a biological ear simulation.
 * Every sample is a pure function of simulation time, so pause/seek/hit-stop
 * cannot accumulate a different result at different render frame rates.
 */
export const EAR_RIG_VERSION='0.4.0';
const earClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function idleEarDriver(t,side=1){
 // Short, unevenly spaced outward flap and gentler return; not continuous
 // mirror-symmetric metronome motion. Initial pose begins at rest.
 t=Math.max(0,t);const phase=(t+(side>0?0:.21))%5.2;
 let flap=0;
 if(phase>.8&&phase<1.55)flap=.13*Math.sin(Math.PI*(phase-.8)/.75)**2;
 if(phase>=1.55&&phase<2.5)flap=-.032*Math.sin(Math.PI*(phase-1.55)/.95)**2;
 return {ears:flap,headY:0,headZ:0};
}
function earResponse(sample,time){
 // Exact critically-damped spring updates on an absolute 120 Hz grid.
 // Resampling between grid points makes seeking/render frequency independent.
 // A finite history is sufficient: the omitted tail decays below 1e-7.
 const dt=1/120,omega=30,finish=Math.ceil(Math.max(0,time)/dt),start=Math.max(0,finish-132);
 const keys=['ears','headY','headZ'],initial=sample(start*dt),x=keys.map(k=>initial[k]||0),v=[0,0,0],values=[x.slice()];
 const decay=Math.exp(-omega*dt);
 for(let tick=start;tick<finish;tick++){
  const target=sample(tick*dt);
  for(let k=0;k<3;k++){
   const goal=target[keys[k]]||0,e=x[k]-goal,j=(v[k]+omega*e)*dt;
   x[k]=goal+(e+j)*decay;v[k]=(v[k]-omega*j)*decay;
  }
  values.push(x.slice());
 }
 return t=>{
  const f=earClamp(t/dt-start,0,values.length-1),i=Math.floor(f),a=values[i],b=values[Math.min(i+1,values.length-1)],u=f-i;
  return Object.fromEntries(keys.map((k,j)=>[k,a[j]+(b[j]-a[j])*u]));
 };
}
function weightedEarSample(filtered,t,lag){return filtered(Math.max(0,t-lag));}
export function flexibleEarRotations(data,time,sample,hitT=-1){
 if(!data.earRigs?.length)return [];
 const out=[];
 for(const rig of data.earRigs){
  const side=rig.side,asym=side<0?.014:0;
  const source=earResponse(t=>sample?sample(t):idleEarDriver(t,side),time);
  const base=weightedEarSample(source,time,asym);
  const prev=weightedEarSample(source,time,.055+asym);
  const turn=earClamp((base.headY-prev.headY)*2,-.10,.10);
  const nod=earClamp((base.headZ-prev.headZ)*1.3,-.075,.075);
  out.push({id:rig.root,x:side*nod*.16,y:side*.64*base.ears-turn*.30,z:0});
  for(const [name,lag,flex] of [['upper',.030,.66],['middle',.060,.88],['lower',.100,1.0]]){
   const mid=weightedEarSample(source,time,lag+asym),tip=weightedEarSample(source,time,lag+.060+asym);
   const age=hitT>=0?time-hitT-lag:-1;
   const recoil=age>0?.035*Math.exp(-age*7.8)*Math.sin(age*17):0;
   const bend=(mid.ears-base.ears)*.65;
   const rim=(tip.ears-mid.ears)*.85;
   // Upper margin is supported. Lower lobe is softer, with delayed curling and
   // a small, damped follow-through instead of every vertex rotating together.
   out.push({id:rig[name][0],x:side*(bend*.55+nod*.24)*flex,
    y:side*(mid.ears*.39+bend+recoil)*flex-turn*.20*flex,
    z:(mid.ears-base.ears)*.22*flex});
   out.push({id:rig[name][1],x:side*(rim*.80+recoil*.45)*flex,
    y:side*(tip.ears*.25+rim-recoil*.60)*flex,
    z:(tip.ears-mid.ears)*.40*flex});
  }
 }
 return out;
}
