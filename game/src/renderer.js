/* Ink landscape renderer. Orthographic 3D terrain + illustrated billboard animals.
   Canvas 2D avoids WebGL-specific failures and runs offline. Animal illustrations
   are explicitly 2.5D; they are not claimed to be fully rigged 3D models. */
const Beast3D=(()=>{
'use strict';
const TAU=Math.PI*2,NAMES=['','rat','cat','dog','wolf','leopard','tiger','lion','elephant'];
const V={add:(a,b)=>a.map((x,i)=>x+b[i]),sub:(a,b)=>a.map((x,i)=>x-b[i]),mul:(a,n)=>a.map(x=>x*n),dot:(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let d=Math.hypot(...a)||1;return a.map(x=>x/d)}};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),ease=t=>t*t*(3-2*t);
function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
class Renderer{
 constructor(el,R){this.canvas=el;this.ctx=el.getContext('2d',{alpha:false});if(!this.ctx)throw Error('無法建立遊戲畫布。');this.R=R;this.software=true;this.yaw=-.055;this.elevation=.90;this.zoom=1;this.pan=[0,0,0];this.images={};this.assetsReady=false;this.waterFrame=-1;this.bgSeed=8;
  this.ready=Promise.all(Object.entries(ART).map(([key,src])=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve();im.onerror=()=>resolve();im.src=src;this.images[key]=im;}))).then(()=>{this.assetsReady=true;this.buildBoard();});
  this.buildBoard();this.resize();
 }
 resize(){const r=this.canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.canvas.width=Math.round(this.width*d);this.canvas.height=Math.round(this.height*d);this.dpr=d;this.ctx.setTransform(d,0,0,d,0,0);this.background=null;this.boardCache=null;}
 camera(){const aspect=this.width/this.height;this.halfH=Math.max(5.8,4.5/aspect)*this.zoom;this.halfW=this.halfH*aspect;this.target=[0,-.05,0];let e=this.elevation,y=this.yaw;this.eye=[Math.sin(y)*Math.cos(e)*20,Math.sin(e)*20,Math.cos(y)*Math.cos(e)*20];this.forward=V.norm(V.sub(this.target,this.eye));this.right=V.norm(V.cross(this.forward,[0,1,0]));this.up=V.cross(this.right,this.forward);this.scale=this.height/(2*this.halfH);}
 project(p){const d=V.sub(p,this.target);return{x:(V.dot(d,this.right)/this.halfW+1)*this.width/2,y:(1-V.dot(d,this.up)/this.halfH)*this.height/2+this.height*.025};}
 pick(px,py){const sx=(px/this.width*2-1)*this.halfW,sy=(1-(py-this.height*.025)/this.height*2)*this.halfH;const origin=V.add(this.eye,V.add(V.mul(this.right,sx),V.mul(this.up,sy)));const t=-origin[1]/this.forward[1],hit=V.add(origin,V.mul(this.forward,t));let x=Math.floor(hit[0]+3.5),y=Math.floor(hit[2]+4.5);return x>=0&&x<7&&y>=0&&y<9?y*7+x:-1;}
 polygon(points,fill,stroke=null,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>{const q=this.project(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y)});c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 line(points,color,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>{const q=this.project(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y)});c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 tile(i,fill,stroke=null,inset=.04,y=.013){let x=i%7-3,z=(i/7|0)-4,h=.5-inset;this.polygon([[x-h,y,z-h],[x+h,y,z-h],[x+h,y,z+h],[x-h,y,z+h]],fill,stroke,1.5);}
 plane(ctx){const a=this.project([-3.5,0,-4.5]),b=this.project([3.5,0,-4.5]),d=this.project([-3.5,0,4.5]);ctx.transform((b.x-a.x)/896,(b.y-a.y)/896,(d.x-a.x)/1152,(d.y-a.y)/1152,a.x,a.y);}
 buildBoard(){this.board=canvas(896,1152);const c=this.board.getContext('2d'),r=random(12345),R=this.R;c.fillStyle='#c4b79b';c.fillRect(0,0,896,1152);
  // Each tile is painted independently so the grid remains exact, unlike the concept illustration.
  for(let y=0;y<9;y++)for(let x=0;x<7;x++){let i=y*7+x,xx=x*128,yy=y*128;const v=r();c.fillStyle=`hsl(${37+v*8} ${15+v*9}% ${56+v*11}%)`;c.fillRect(xx,yy,128,128);
   if(this.images.earth?.complete&&this.images.earth.naturalWidth){c.save();c.globalAlpha=.23;c.translate(xx+64,yy+64);c.rotate(Math.PI/2*Math.floor(r()*4));c.drawImage(this.images.earth,-64,-64,128,128);c.restore();}
   for(let k=0;k<140;k++){let a=xx+r()*128,b=yy+r()*128;c.fillStyle=r()>.6?'#39422a16':'#e8ddaf25';c.fillRect(a,b,r()*17+1,r()*5+1);}
   c.strokeStyle='#3f47354a';c.lineWidth=2;c.strokeRect(xx+1,yy+1,126,126);c.strokeStyle='#eae0b63b';c.lineWidth=1;c.strokeRect(xx+3,yy+3,122,122);
   if(!R.water(i)&&!R.traps[i]&&i!==3&&i!==59){c.strokeStyle='#54543e56';c.beginPath();let a=xx+20+r()*60,b=yy+15+r()*80;c.moveTo(a,b);c.lineTo(a+5,b+7);c.lineTo(a+1,b+13);c.stroke();}
  }
  // Continuous two-by-three pools, divided into legal cells by faint ink lines.
  for(const x0 of [1,4]){let xx=x0*128,yy=3*128;const g=c.createLinearGradient(xx,yy,xx+256,yy+384);g.addColorStop(0,'#36575d');g.addColorStop(.4,'#6e9699');g.addColorStop(1,'#95b2b0');c.fillStyle=g;c.fillRect(xx,yy,256,384);
   if(this.images.water?.complete&&this.images.water.naturalWidth){c.save();c.globalAlpha=.22;for(let j=0;j<3;j++)for(let k=0;k<2;k++)c.drawImage(this.images.water,xx+k*128,yy+j*128,128,128);c.restore();}
   for(let j=0;j<80;j++){const y=yy+r()*384,x=xx+r()*216;c.strokeStyle=j%3?'#e0efcf45':'#dce7d184';c.lineWidth=r()*2+1;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+7,y-3,x+24,y+3,x+34,y);c.stroke();}
   c.strokeStyle='#1f3c3d72';c.lineWidth=2;for(let j=0;j<4;j++){c.beginPath();c.moveTo(xx,yy+j*128);c.lineTo(xx+256,yy+j*128);c.stroke();}c.beginPath();c.moveTo(xx+128,yy);c.lineTo(xx+128,yy+384);c.stroke();
   c.strokeStyle='#3c4438';c.lineWidth=7;c.strokeRect(xx,yy,256,384);c.strokeStyle='#e3dbab66';c.lineWidth=2;c.strokeRect(xx+4,yy+4,248,376);
   // Moss and reeds belong to the banks, not the playable water cells.
   for(let j=0;j<160;j++){const edge=j%4,a=r();let x=edge===0?xx-8:edge===1?xx+262:xx+a*256,y=edge===2?yy-6:edge===3?yy+389:yy+a*384;c.strokeStyle=j%3?'#4a5b32':'#a3ac62';c.lineWidth=1.3;c.beginPath();c.moveTo(x,y);c.lineTo(x+(r()-.5)*8,y-3-r()*12);c.stroke();}
  }
  for(let i=0;i<63;i++){let x=i%7*128,y=(i/7|0)*128;if(R.traps[i]){c.fillStyle='#cab48c';c.fillRect(x+9,y+9,110,110);c.strokeStyle='#6d543e';c.lineWidth=3;c.strokeRect(x+11,y+11,106,106);c.strokeStyle='#e5d6ab';c.lineWidth=2;c.strokeRect(x+15,y+15,98,98);c.fillStyle='#776045';c.beginPath();c.ellipse(x+64,y+77,23,17,0,0,TAU);c.fill();for(let k=0;k<4;k++){c.beginPath();c.ellipse(x+34+k*20,y+45+(k===0||k===3?8:0),8,11,(k-1.5)*.22,0,TAU);c.fill();}c.fillStyle=R.traps[i]===1?'#294f63':'#8e392b';for(const [a,b]of[[17,17],[111,17],[17,111],[111,111]]){c.fillRect(x+a-3,y+b-3,6,6);}}
   if(i===3||i===59){c.fillStyle='#4c5140';c.fillRect(x+4,y+4,120,120);c.strokeStyle='#d5c397';c.lineWidth=3;c.strokeRect(x+12,y+12,104,104);c.fillStyle=i===59?'#315971':'#8c3a2e';c.beginPath();c.arc(x+64,y+64,36,0,TAU);c.fill();c.fillStyle='#f3dfb2';c.font='bold 42px serif';c.textAlign='center';c.textBaseline='middle';c.fillText('穴',x+64,y+64);}
  }
  this.boardCache=null;
 }
 makeBackground(){
  const b=canvas(Math.round(this.width),Math.round(this.height)),c=b.getContext('2d'),w=b.width,h=b.height;
  c.fillStyle='#d5d5ce';c.fillRect(0,0,w,h);
  const im=this.images['painted-mountains'];
  if(im?.naturalWidth){
   // Two mirrored distant washes frame the board; no animals are embedded here.
   c.save();c.globalAlpha=.60;c.drawImage(im,0,0,w*.55,h);c.translate(w,0);c.scale(-1,1);c.drawImage(im,0,0,w*.55,h);c.restore();
  }
  const wash=c.createLinearGradient(0,0,0,h);wash.addColorStop(0,'#eae3d638');wash.addColorStop(.45,'#dce0da50');wash.addColorStop(1,'#525e5b99');c.fillStyle=wash;c.fillRect(0,0,w,h);
  const vig=c.createRadialGradient(w*.48,h*.42,30,w*.5,h*.5,w*.8);vig.addColorStop(0,'#e2dbc000');vig.addColorStop(1,'#1c292c66');c.fillStyle=vig;c.fillRect(0,0,w,h);this.background=b;
 }

 drawTerrain(){const c=this.ctx,r=random(25),depth=.63;let corners=[[-3.61,-.01,-4.61],[3.61,-.01,-4.61],[3.61,-.01,4.61],[-3.61,-.01,4.61]];
  const center=this.project([0,-.6,0]);c.save();c.fillStyle='#14291833';c.filter='blur(18px)';c.beginPath();c.ellipse(center.x,center.y+this.scale*.3,this.scale*4.3,this.scale*3.9,0,0,TAU);c.fill();c.restore();
  const faces=[];for(let j=0;j<4;j++){let a=corners[j],b=corners[(j+1)%4];faces.push({a,b,dist:V.dot(V.sub([(a[0]+b[0])/2,0,(a[2]+b[2])/2],this.eye),this.forward)});}faces.sort((a,b)=>b.dist-a.dist);
  for(const {a,b}of faces){this.polygon([a,b,[b[0],-depth,b[2]],[a[0],-depth,a[2]]],jColor(a,b),'#263b2d',1);for(let k=0;k<19;k++){let t=k/19,u=(k+1)/19;let p=[a[0]+(b[0]-a[0])*t,-.05,a[2]+(b[2]-a[2])*t],q=[a[0]+(b[0]-a[0])*u,-.05,a[2]+(b[2]-a[2])*u];this.polygon([p,q,[q[0],-.48-r()*.15,q[2]],[p[0],-.38-r()*.2,p[2]]],k%3?'#4f5647':'#777766','#313d2e88',.7);}}
  c.save();this.plane(c);c.drawImage(this.board,0,0);c.restore();
  // Weathered continuous kerb, with irregular stone seams, not a metal frame.
  for(let j=0;j<4;j++){let a=corners[j],b=corners[(j+1)%4],n=j%2?27:21;const normal=j===0?[0,0,-1]:j===1?[1,0,0]:j===2?[0,0,1]:[-1,0,0];
   for(let k=0;k<n;k++){let t=k/n,u=(k+1)/n,px=a[0]+(b[0]-a[0])*t,pz=a[2]+(b[2]-a[2])*t,qx=a[0]+(b[0]-a[0])*u,qz=a[2]+(b[2]-a[2])*u,o=.06,inn=-.13;
    this.polygon([[px+normal[0]*o,.015,pz+normal[2]*o],[qx+normal[0]*o,.02,qz+normal[2]*o],[qx+normal[0]*inn,.025,qz+normal[2]*inn],[px+normal[0]*inn,.03,pz+normal[2]*inn]],k%4?'#8a8a70':'#ada98a','#454e3a',.65);
   }}
  // A shallow waterfall spills off each outer riverbank; never part of the playable grid.
  for(let s of [-1,1]){let z=s<0?-.15:.15;this.polygon([[s*3.64,-.1,z-.30],[s*3.64,-.1,z+.30],[s*3.68,-.9,z+.23],[s*3.72,-.86,z-.23]],'#abc4ad66');}
  function jColor(a,b){return a[0]===b[0]?'#59624f':'#686e58';}
 }
 drawRipples(time,reduced){const c=this.ctx;c.save();this.plane(c);c.lineWidth=1.4;for(const x0 of [1,4]){c.save();c.beginPath();c.rect(x0*128+7,391,242,370);c.clip();for(let k=0;k<13;k++){let y=396+((k*32+(reduced?0:time*8))%360),x=x0*128+10+(k*39)%170;c.strokeStyle=k%2?'#f3efd057':'#b9e0d253';c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+10,y-4,x+33,y+3,x+50,y-1);c.stroke();}c.restore();}c.restore();}
 drawMark(i,color,time,fill=false){this.tile(i,fill?color+'35':null,color,.065,.026);if(fill){const p=this.project([i%7-3,.05,(i/7|0)-4]);this.ctx.fillStyle=color;this.ctx.beginPath();this.ctx.ellipse(p.x,p.y,this.scale*.09,this.scale*.06,0,0,TAU);this.ctx.fill();}}
 drawDen(i){let x=i%7-3,z=(i/7|0)-4,c=this.ctx; // Flat cloth with stone gate; height stays small enough not to hide adjacent pieces.
  for(const dx of [-.34,.34]){this.polygon([[x+dx-.08,0,z+.17],[x+dx+.08,0,z+.17],[x+dx+.08,.42,z+.17],[x+dx-.08,.43,z+.17]],'#9c987e','#454b3b',1);this.polygon([[x+dx+.08,0,z+.17],[x+dx+.08,0,z-.12],[x+dx+.08,.42,z-.12],[x+dx+.08,.42,z+.17]],'#5e6650','#454b3b',.7);}
  this.polygon([[x-.45,.43,z+.18],[x+.45,.43,z+.18],[x+.45,.57,z+.18],[x-.45,.59,z+.18]],'#adab8d','#46513e',1);this.polygon([[x-.45,.59,z+.18],[x+.45,.57,z+.18],[x+.45,.57,z-.13],[x-.45,.60,z-.13]],'#c1bb98','#5b6047',.6);
  const p=this.project([x,.29,z+.20]),h=this.scale*.38;c.fillStyle=i===59?'#2e5066':'#8d3729';c.fillRect(p.x-this.scale*.22,p.y-h*.48,this.scale*.44,h);c.fillStyle='#e9d5ac';c.font=`bold ${this.scale*.26}px serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('獸',p.x,p.y+h*.02);
 }
 sprite(rank,side,pos,time,selected=false,move=0,scale=1,flip=null,alpha=1,ctx=this.ctx){const image=this.images[NAMES[rank]],ground=this.project([pos[0],.05,pos[2]]),p=this.project(pos),s=this.scale*scale,height=s*[0,.55,.96,1.04,1.12,1.02,1.06,1.24,1.36][rank],w=height*((image?.naturalWidth||100)/(image?.naturalHeight||100));
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#14231849';ctx.beginPath();ctx.ellipse(ground.x,ground.y+2,s*.38,s*.16,0,0,TAU);ctx.fill();
  // Army marker is a brush-painted seal, not a neon glow.
  ctx.beginPath();ctx.ellipse(ground.x,ground.y,s*.37,s*.17,0,0,TAU);ctx.fillStyle=side>0?'#2f5e7888':'#963b2a88';ctx.fill();ctx.strokeStyle=side>0?'#bdd2c7':'#e4b98e';ctx.lineWidth=selected?2.4:1.4;ctx.stroke();
  if(selected){ctx.strokeStyle='#fff0b1';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(ground.x,ground.y,s*.44,s*.22,0,0,TAU);ctx.stroke();}
  if(image?.complete&&image.naturalWidth){ctx.translate(p.x,p.y+2);ctx.rotate(move*.12);let f=flip===null?(side<0?-1:1):flip;const breath=this.reduced?0:Math.sin(time*2.6+rank)*.008;ctx.scale(f*(1+Math.abs(move)*.08-breath*.25),1-Math.abs(move)*.025+breath);ctx.drawImage(image,-w/2,-height,w,height);}
  else{ctx.fillStyle='#e8d7b1';ctx.font=`bold ${s*.38}px serif`;ctx.textAlign='center';ctx.fillText(this.R.NAMES[rank],p.x,p.y-s*.3);}
  ctx.restore();return {left:p.x-w/2,top:p.y+2-height,width:w,height,image,flipped:(flip===null?side<0:flip<0)};
 }
 hitPiece(x,y){for(let n=(this.hits?.length||0)-1;n>=0;n--){const b=this.hits[n];if(x<b.left||x>b.left+b.width||y<b.top||y>b.top+b.height)continue; const key=b.image.src;if(!this.alphaMaps)this.alphaMaps=new Map();let data=this.alphaMaps.get(key);if(!data){const s=canvas(b.image.naturalWidth,b.image.naturalHeight),cx=s.getContext("2d",{willReadFrequently:true});cx.drawImage(b.image,0,0);data={w:s.width,h:s.height,p:cx.getImageData(0,0,s.width,s.height).data};this.alphaMaps.set(key,data);}let u=clamp((x-b.left)/b.width,0,.9999);if(b.flipped)u=1-u;let v=clamp((y-b.top)/b.height,0,.9999);let px=Math.min(data.w-1,Math.floor(u*data.w)),py=Math.min(data.h-1,Math.floor(v*data.h));if(data.p[(py*data.w+px)*4+3]>70)return b.i;}return -1;}
 render(s,o){this.reduced=o.reduced;this.camera();if(!this.background)this.makeBackground();const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.width,this.height);c.drawImage(this.background,0,0,this.width,this.height);
  if(o.battle){this.renderBattle(o.battle,o.time,o.reduced);return;}
  const cacheKey=[this.yaw,this.elevation,this.zoom,this.width,this.height,this.assetsReady].join(':');if(this.cacheKey!==cacheKey||!this.boardCache){const cache=canvas(this.canvas.width,this.canvas.height),target=this.ctx;this.ctx=cache.getContext('2d');this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.drawTerrain();this.ctx=target;this.boardCache=cache;this.cacheKey=cacheKey;}
  c.drawImage(this.boardCache,0,0,this.width,this.height);this.drawRipples(o.time,o.reduced);
  if(o.last){this.drawMark(o.last.from,'#a68c4f',o.time);this.drawMark(o.last.to,'#c5aa63',o.time);}
  if(o.selected!==null&&o.selected!==undefined)this.drawMark(o.selected,'#f3e1a1',o.time);
  for(const m of o.legal||[])this.drawMark(m.to,m.capture?'#aa3428':'#e9e0a7',o.time,true);
  if(o.hint){this.drawMark(o.hint.from,'#fff0a4',o.time);this.drawMark(o.hint.to,'#fff0a4',o.time,true);}
  const list=[{den:3,pos:[0,0,-4]},{den:59,pos:[0,0,4]}];
  for(let i=0;i<63;i++){let p=s.board[i];if(!p)continue;let x=i%7-3,z=(i/7|0)-4,y=.08,pose=0;if(o.motion&&i===o.motion.from){const t=clamp((o.time-o.motion.start)/o.motion.duration,0,1),e=ease(t);x+=(o.motion.to%7-i%7)*e;z+=((o.motion.to/7|0)-(i/7|0))*e;y+=Math.sin(t*Math.PI)*(o.motion.jump?1.3:.16);pose=Math.sin(t*TAU)*.4;}
   if(!o.reduced&&o.selected===i)y+=Math.sin(o.time*2.5)*.012;list.push({i,p,pos:[x,y,z],pose});}
  list.sort((a,b)=>V.dot(V.sub(b.pos,this.eye),this.forward)-V.dot(V.sub(a.pos,this.eye),this.forward));
  this.hits=[];for(const item of list){if(item.den!==undefined)this.drawDen(item.den);else{const b=this.sprite(Math.abs(item.p),Math.sign(item.p),item.pos,o.time,item.i===o.selected,item.pose);if(b.image?.naturalWidth)this.hits.push({...b,i:item.i});}}
  if(o.captureFX){const fx=o.captureFX,q=this.project([fx.i%7-3,.95,(fx.i/7|0)-4]),age=o.time-fx.start,im=this.images['capture-impact'];if(im?.naturalWidth&&age<1.1){c.save();c.globalAlpha=Math.min(1,Math.max(0,(1.1-age)*3));c.translate(q.x,q.y-(o.reduced?0:age*20));c.rotate(-.15);let size=Math.max(58,this.scale*1.35)*(o.reduced?1:1+Math.max(0,.16-age)*3);c.fillStyle='#f0e4cce8';c.beginPath();c.ellipse(0,0,size*.66,size*.53,-.12,0,TAU);c.fill();const hh=size*im.naturalHeight/im.naturalWidth;c.drawImage(im,-size/2,-hh/2,size,hh);c.restore();}}
 }

 drawDust(x,y,age,power=1,seed=88){
  if(age<0||age>1.8)return;const c=this.ctx,r=random(seed),fade=Math.max(0,1-age/1.8),s=this.width;
  c.save();
  for(let k=0;k<28;k++){const v=.035+r()*.13,dir=r()>.5?1:-1,px=x+dir*age*s*v*power,py=y-age*(18+r()*52)+age*age*48,rad=(3+r()*14)*(1+age*1.7)*power;c.fillStyle=k%3?`rgba(201,184,135,${fade*.23})`:`rgba(32,40,28,${fade*.21})`;c.beginPath();c.ellipse(px,py,rad*1.9,rad*.6,.1*dir,0,TAU);c.fill();}
  for(let k=0;k<22;k++){const dir=r()>.5?1:-1,px=x+dir*age*s*(.025+r()*.23)*power,py=y-age*(30+r()*160)+age*age*130;c.globalAlpha=fade;c.fillStyle=k%2?'#171f19':'#a79871';c.save();c.translate(px,py);c.rotate(age*(r()*8-4));c.fillRect(-2,-2,2+r()*5,2+r()*3);c.restore();}
  c.restore();
 }
 // Draw approved art as full frames. Lettering stays in its original direction.
 drawContain(im,x,y,w,h){
  if(!im?.naturalWidth)return;const k=Math.min(w/im.naturalWidth,h/im.naturalHeight),dw=im.naturalWidth*k,dh=im.naturalHeight*k;
  this.ctx.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
 }
 lionTigerFrame(index){
  if(!Number.isInteger(index)||index<0||index>=PaintedSequence.lionTigerSources.length)return null;
  const atlases=['lion-tiger-leap','lion-tiger-contact','lion-tiger-fall'].map(k=>this.images[k]),keys=this.images['lion-tiger-keys'];
  if(atlases.some(a=>!a?.naturalWidth)||!keys?.naturalWidth)return null;
  const key=PaintedSequence.lionTigerKeys[index],source=PaintedSequence.lionTigerSources[index],atlas=key===undefined?this.images['lion-tiger-'+source.shot]:keys,cell=key===undefined?source.cell:key,columns=key===undefined?4:2;
  // Crop once per pose: no atlas neighbours can bleed into the blurred margin.
  if(!this.lionTigerFrames)this.lionTigerFrames=[];
  if(!this.lionTigerFrames[index]){
   const w=atlas.naturalWidth/columns,h=atlas.naturalHeight/columns,inset=key===undefined?0:2,frame=canvas(w-2*inset,h-2*inset);
   frame.getContext('2d').drawImage(atlas,(cell%columns)*w+inset,Math.floor(cell/columns)*h+inset,w-2*inset,h-2*inset,0,0,frame.width,frame.height);
   // Once the lion takes its weight, hold its stance against the same rocks.
   // The moving tiger and dust continue on their own side of the shot.
   if(source.shot==='fall' && cell>4){
    if(!this.landingStance){
     const layer=canvas(w,h),ctx=layer.getContext('2d');
     ctx.drawImage(atlas,0,h,w,h,0,0,w,h);
     ctx.globalCompositeOperation='destination-in';
     ctx.filter='blur(3px)';
     ctx.beginPath();
     const boundary=[[-.05,-.05],[.64,-.05],[.60,.49],[.59,.58],[.55,.65],[.49,.72],[.48,.82],[.56,.97],[.57,1.05],[-.05,1.05]];
     boundary.forEach(([u,v],i)=>i?ctx.lineTo(u*w,v*h):ctx.moveTo(u*w,v*h));
     ctx.closePath();
     ctx.fill();
     this.landingStance=layer;
    }
    frame.getContext('2d').drawImage(this.landingStance,0,0);
   }
   this.lionTigerFrames[index]=frame;
  }
  return this.lionTigerFrames[index];
 }
 renderBattle(b,time,reduced){
  const c=this.ctx,w=this.width,h=this.height,t=b.elapsed||0,info=PaintedSequence.info(b,t);
  this.lastCombatFrame={...info,t,variant:b.variant};
  c.save();c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  const tigerFrame=b.variant==='lion-tiger'?this.lionTigerFrame(info.index):null;
  if(b.variant==='lion-leopard'||b.variant==='elephant-tiger'||tigerFrame){
   const image=tigerFrame||this.images[(b.variant==='elephant-tiger'?'elephant-film-':'painted-')+String(info.index).padStart(2,'0')];
   const iw=tigerFrame?image.width:image?.naturalWidth,ih=tigerFrame?image.height:image?.naturalHeight;
   c.fillStyle='#222722';c.fillRect(0,0,w,h);
   // A muted painted margin fills nonmatching screen shapes without stretching
   // animals or cropping the calligraphy. The central frame is always contained.
   if(iw){
    c.save();c.globalAlpha=.27;c.filter='blur(20px)';c.drawImage(image,-30,-30,w+60,h+60);c.restore();
    const area={x:10,y:53,w:w-20,h:h-106};
    const k=Math.min(area.w/iw,area.h/ih),dw=iw*k,dh=ih*k;
    const x=(w-dw)/2,y=53+(area.h-dh)/2;
    c.save();c.shadowColor='#090d0b99';c.shadowBlur=22;c.fillStyle='#e8ddc8';c.fillRect(x-2,y-2,dw+4,dh+4);c.restore();
    // The original films retain their motion. The new collision has a brief jolt.
    const age=t-info.hit,shake=!reduced&&age>=0?(b.variant==='elephant-tiger'&&age<.24?(1-age/.24)*3:b.variant==='lion-tiger'&&age<.18?Math.sin(Math.PI*age/.18)*(1-age/.18)*2:0):0;
    c.save();c.translate(Math.sin(age*81)*shake,Math.cos(age*73)*shake*.55);c.drawImage(image,x,y,dw,dh);c.restore();
    // Leave the close-up contact unobscured; the new film's brush lands afterward.
    const brushAge=b.variant==='lion-tiger'&&!reduced?t-PaintedSequence.lionTigerStarts[33]+.18:age;
    if((b.variant==='elephant-tiger'||b.variant==='lion-tiger')&&brushAge>=.18&&brushAge<1.17){
     const brush=this.images['capture-brush'];if(brush?.naturalWidth){
      const lionTiger=b.variant==='lion-tiger';
      const fade=Math.min(1,(brushAge-.18)/.075,(1.17-brushAge)/.14),size=dw*(lionTiger?.20:.30)*(reduced?1:1+Math.max(0,.30-brushAge)*1.2),bh=size*brush.naturalHeight/brush.naturalWidth;
      c.save();c.globalAlpha=Math.max(0,fade);c.translate(x+dw*(lionTiger?.55:.78),y+dh*(lionTiger?.18:.36));c.rotate(-.07);
      const g=c.createRadialGradient(0,0,size*.10,0,0,size*.72);g.addColorStop(0,'#f8eedeee');g.addColorStop(.65,'#f8eede99');g.addColorStop(1,'#f8eede00');c.fillStyle=g;c.fillRect(-size*.8,-bh*.8,size*1.6,bh*1.6);
      c.drawImage(brush,-size/2,-bh/2,size,bh);c.restore();
     }
    }
   }
  }else{
   this.renderComicDuel(b,t,reduced);if(b.variant==='lion-pounce'||b.variant==='lion-tiger')this.renderLionPounce(b,t,reduced);if(b.variant==='elephant-charge')this.renderElephantCharge(b,t,reduced);
  }
  c.restore();
 }
 renderLionPounce(b,t,reduced){
  // A different opponent must never be visually replaced by the leopard.
  // Safe crops contain ONLY the lion; the correct opposing animal remains
  // in the adjacent panel. These still use genuinely different painted poses.
  const f=b.variant==='lion-tiger'?PaintedSequence.frame(b.reduced?t:t/b.length*PaintedSequence.total,b.reduced):PaintedSequence.info(b,t),c=this.ctx,w=this.width,h=this.height;
  const rects=[[0,0,228,250],[0,0,232,250],[0,0,240,250],[0,0,254,250],[0,0,251,250],[0,0,282,151],[0,0,258,143],[0,0,245,153],[0,0,228,174],[0,0,217,169],[0,0,183,188],[0,0,183,188],[0,0,181,190],[0,0,183,214],[0,0,182,225],[0,0,182,225]];
  const im=this.images['painted-'+String(f.index).padStart(2,'0')],rect=rects[f.index];if(!im?.naturalWidth||!rect)return;
  const top=70,bottom=h-75,ph=bottom-top,split=reduced?.52:.51+Math.sin(Math.min(1,t/f.hit)*Math.PI)*.035;
  c.save();c.beginPath();c.moveTo(16,top+12);c.lineTo(w*split+36,top-5);c.lineTo(w*split-38,bottom+3);c.lineTo(16,bottom-10);c.closePath();c.clip();
  c.fillStyle='#e9e2d5';c.fillRect(0,top-8,w*split+40,ph+24);
  const [sx,sy,sw,sh]=rect,k=Math.max(w*split/sw,ph/sh),dw=sw*k,dh=sh*k;
  c.drawImage(im,sx,sy,sw,sh,(w*split-dw)/2,top+(ph-dh)/2,dw,dh);c.restore();
 }
 renderElephantCharge(b,t,reduced){
  // A tiger is never silently substituted for another actual defender.
  const f=PaintedSequence.info(b,t),c=this.ctx,w=this.width,h=this.height;
  const rects=[[0,0,209,241],[0,0,222,239],[0,0,237,220],[0,0,253,196],[0,0,245,191],[0,0,256,176],[0,0,277,163],[0,0,289,156],[0,0,278,158],[0,0,278,157],[0,0,206,204],[0,0,208,204],[0,0,209,204]];
  const im=this.images['elephant-film-'+String(f.index).padStart(2,'0')],rect=rects[f.index];if(!im?.naturalWidth||!rect)return;
  const top=70,bottom=h-75,ph=bottom-top,split=.52;
  c.save();c.beginPath();c.moveTo(16,top+12);c.lineTo(w*split+36,top-5);c.lineTo(w*split-38,bottom+3);c.lineTo(16,bottom-10);c.closePath();c.clip();
  const [sx,sy,sw,sh]=rect,k=Math.max(w*split/sw,ph/sh),dw=sw*k,dh=sh*k;
  c.drawImage(im,sx,sy,sw,sh,(w*split-dw)/2,top+(ph-dh)/2,dw,dh);c.restore();
 }
 renderComicDuel(b,t,reduced){
  // Intentional illustrated cut-ins for pairings without approved frame sets.
  // No manufactured anatomy, elastic body deformation, or false species labels.
  const c=this.ctx,w=this.width,h=this.height,r=Math.abs(b.attacker),d=Math.abs(b.defender),hit=PaintedSequence.info(b,t).hit;
  const q=Math.max(0,t-hit),ink=this.images['painted-mountains'];
  c.fillStyle='#e2d7c2';c.fillRect(0,0,w,h);
  if(ink?.naturalWidth){c.save();c.globalAlpha=.26;c.drawImage(ink,0,0,w,h);c.restore();}
  const top=70,bottom=h-75,ph=bottom-top;
  const split=reduced?.52:.51+Math.sin(Math.min(1,t/1.83)*Math.PI)*.035;
  const portray=(rank,left)=>{
   const im=this.images[rank===7?'painted-lion-portrait':rank===5?'painted-leopard-portrait':NAMES[rank]];
   if(!im?.naturalWidth)return;c.save();
   c.beginPath();if(left){c.moveTo(16,top+12);c.lineTo(w*split+36,top-5);c.lineTo(w*split-38,bottom+3);c.lineTo(16,bottom-10);}else{c.moveTo(w*split+49,top-8);c.lineTo(w-16,top+9);c.lineTo(w-16,bottom+12);c.lineTo(w*split-25,bottom+3);}c.closePath();
   c.fillStyle=left?'#d9c5a8':'#c9c9bf';c.fill();c.strokeStyle='#292b25';c.lineWidth=2;c.stroke();c.clip();
   const x=left?0:w*split,ww=left?w*split:w*(1-split);
   const wash=c.createLinearGradient(x,top,x+ww,bottom);wash.addColorStop(0,left?'#aa85583a':'#65776e38');wash.addColorStop(1,'#f6edda44');c.fillStyle=wash;c.fillRect(x,top,ww,ph);
   const zoom=reduced?1:1+Math.min(t,hit)*.045;
   const height=Math.min(ph*(rank<=2?.38:.52),rank<=2?175:270)*zoom,width=height*im.naturalWidth/im.naturalHeight;
   c.globalAlpha=left?1:Math.max(.18,1-q*1.5);
   const xcenter=x+ww*.50;const yy=top+ph*.51;
   if(rank===7||rank===5){const pw=Math.min(ww*.84,340),pheight=Math.min(ph*.48,270);this.drawContain(im,x+(ww-pw)/2,top+ph*.49-pheight/2,pw,pheight);}
   else{c.drawImage(im,xcenter-width/2,yy-height*.52,width,height);}
   c.restore();
   c.save();c.textAlign='center';c.fillStyle=left?'#785236':'#536359';c.font='600 '+Math.min(32,w*.032)+'px serif';c.fillText(['','靈鼠','山貓','獵犬','蒼狼','花豹','猛虎','雄獅','巨象'][rank],x+ww*.5,top+ph*.18);
   c.font='11px sans-serif';c.fillStyle='#807563';c.fillText((left?'進擊':'守勢')+'  ·  '+['','一','二','三','四','五','六','七','八'][rank]+'階',x+ww*.5,top+ph*.18+25);c.restore();
  };
  portray(r,true);portray(d,false);
  if(q>0&&!reduced)this.drawDust(w*.58,h*.70,q,.85,55);
 }

}
return{Renderer,V};
})();
