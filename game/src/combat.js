/* One deterministic timeline shared by animation, UI and audio.
   Species-specific movement, with short contact hold (hit stop), then recoil.
   Rendered as deformable 2D illustration, not a fully rigged 3D model. */
const InkCombat=(()=>{
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t),out=t=>1-Math.pow(1-t,3);
 const profiles=[null,
  {name:'貼地穿陣',wind:1.0,hit:1.9,arc:.015,recoil:.08,zoom:.07,gait:29,hold:.10,heavy:false,feint:1.44},
  {name:'伏身疾撲',wind:1.06,hit:2.12,arc:.19,recoil:.13,zoom:.09,gait:22,hold:.12,heavy:false,feint:1.67},
  {name:'踏地突襲',wind:1.04,hit:2.08,arc:.06,recoil:.13,zoom:.08,gait:25,hold:.12,heavy:false,feint:1.67},
  {name:'側身追獵',wind:1.04,hit:2.15,arc:.07,recoil:.16,zoom:.09,gait:23,hold:.13,heavy:false,feint:1.68},
  {name:'豹影連擊',wind:1.0,hit:2.16,arc:.095,recoil:.20,zoom:.12,gait:28,hold:.14,heavy:false,feint:1.57},
  {name:'騰空撲殺',wind:1.08,hit:2.28,arc:.25,recoil:.17,zoom:.11,gait:20,hold:.17,heavy:false,feint:1.82},
  {name:'雄獅裂陣',wind:1.12,hit:2.30,arc:.18,recoil:.18,zoom:.12,gait:18,hold:.18,heavy:false,feint:1.83},
  {name:'重踏山河',wind:1.16,hit:2.52,arc:.035,recoil:.20,zoom:.10,gait:12,hold:.22,heavy:true,feint:1.88}
 ];
 function profile(rank){return profiles[Math.max(1,Math.min(8,Math.abs(rank)))];}
 function duration(rank,reduced=false){return reduced?1.45:profile(rank).hit+1.90;}
 function frame(rank,realT,reduced=false){
  const p=profile(rank);let t=Math.max(0,realT);
  if(reduced)return{t,phase:t<.72?'蓄勢':'擊破',ax:.34,ay:0,ar:0,sx:1,sy:1,gait:0,lean:0,paw:0,head:0,tail:0,dx:.74,dy:0,dr:0,da:t<.72?1:.24,defRecoil:0,impact:t<.72?-1:t-.72,charge:0,flight:0,camera:1,shake:0,hit:.72,hold:0,done:t>=1.45};
  // Freeze only the actual moving animals at contact; dust and ink keep travelling.
  const contact=t>=p.hit&&t<p.hit+p.hold;
  const anim=t>=p.hit?Math.max(p.hit,t-p.hold):t;
  const a=clamp((anim-p.wind)/(p.hit-p.wind)),q=clamp((anim-p.hit)/.82),impact=t-p.hit;
  const crouch=t<p.wind?smooth(clamp((t-.25)/.65)):Math.max(0,1-a*4);
  const fly=Math.sin(Math.PI*a),run=Math.sin(anim*p.gait),lunge=out(a);
  let ax=mix(.20,.61,lunge),ay=-fly*p.arc,ar=-fly*(rank===8?.06:.25),sx=1+crouch*.07+fly*.07,sy=1-crouch*.12-fly*.035;
  let paw=fly*.16,lean=fly*.055,head=-crouch*.028+fly*.035;
  if(rank===1){ax+=Math.sin(a*Math.PI*4)*.015;ay-=Math.abs(run)*.009*(a>0&&a<1);sx+=fly*.14;sy-=fly*.10;}
  if(rank===5){const slash=Math.sin(clamp((anim-p.feint)/.25)*Math.PI);ax+=slash*.026;ar-=slash*.13;paw+=slash*.18;}
  if(rank===8){const rise=clamp((anim-1.72)/.5);ay-=Math.sin(rise*Math.PI/2)*.045*(1-smooth(clamp((anim-2.25)/.27)));ar=-Math.sin(rise*Math.PI)*.10;paw=fly*.035;}
  if(a>=1){ax-=out(q)*.055;ay=-Math.sin(q*Math.PI)*.045;ar=mix(.06,0,smooth(q));sx=1+Math.sin(q*Math.PI)*.04;sy=1-Math.sin(q*Math.PI)*.06;paw=(1-q)*.13;head=(1-q)*.035;}
  const dq=clamp((anim-p.hit)/1.1),kick=out(clamp(dq*2));
  const dx=.77+kick*p.recoil,dy=-Math.sin(clamp(dq*1.4)*Math.PI)*.085+dq*dq*.15,dr=kick*(rank===8?.36:.24);
  const da=1-smooth(clamp((dq-.32)/.65));
  const camera=1+smooth(clamp((t-.85)/1.15))*p.zoom*(1-smooth(clamp((t-p.hit-.65)/1.05)));
  const shake=impact>=0&&impact<.48?(1-impact/.48)*(rank===8?9:5):0;
  return{t:anim,phase:t<p.wind?'蓄勢':t<p.hit?'突進':contact?'一擊':'擊破',ax,ay,ar,sx,sy,gait:a>0&&a<1?run:0,lean,paw,head,tail:Math.sin(anim*7)*.04,dx,dy,dr,da,defRecoil:kick,impact,charge:crouch,flight:fly,camera,shake,hit:p.hit,hold:p.hold,contact,done:t>=duration(rank)};
 }
 function events(rank,reduced=false){const p=profile(rank);if(reduced)return[{at:.15,name:'call'},{at:.72,name:'impact'}];
  return[{at:.15,name:'call'},{at:.55,name:'charge'},{at:p.wind,name:'step'},{at:p.wind+.18,name:'dash'},
   {at:p.feint,name:rank===8?'step':'claw'},{at:p.hit,name:'impact'},{at:p.hit+p.hold+.40,name:'land'}];}
 return {profile,duration,frame,events};
})();
if(typeof module!=='undefined')module.exports=InkCombat;
