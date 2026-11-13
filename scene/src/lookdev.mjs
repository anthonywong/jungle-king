/** V07 art direction. Independent of attack/physics/camera modules.
 * Position-space relief stays attached to the skinned surface. Runtime textures
 * are original procedural assets, not scraped imagery or replacement animation.
 */
let ldTextureCache=new Map();
function ldTexture(THREE,uri){
 if(ldTextureCache.has(uri))return ldTextureCache.get(uri);
 const t=new THREE.TextureLoader().load(uri);t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;ldTextureCache.set(uri,t);return t;
}
export function lookdevMaterial(THREE,kind,source){
 const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0,envMapIntensity:.35});
 mat.name='Jungle King V07 '+kind+' | skin / ivory / eyes / keratin';
 mat.customProgramCacheKey=()=>`jungle-king-v07-${kind}-relief-3`;
 mat.onBeforeCompile=s=>{
  s.uniforms.ldRelief={value:ldTexture(THREE,source)};
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   attribute float sculptSurface;
   varying vec3 ldPosition; varying vec3 ldRestNormal; varying float ldSurface;`);
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   ldPosition=position; ldRestNormal=normal; ldSurface=sculptSurface;`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   uniform sampler2D ldRelief;
   varying vec3 ldPosition; varying vec3 ldRestNormal; varying float ldSurface;
   float ldTri(vec3 p,vec3 n){
    vec3 w=pow(abs(n),vec3(5.0));w/=max(dot(w,vec3(1.0)),0.0001);
    return texture2D(ldRelief,p.yz).r*w.x+texture2D(ldRelief,p.xz).r*w.y+texture2D(ldRelief,p.xy).r*w.z;
   }
   vec3 ldBump(vec3 positionVS,vec3 surfaceNormal,float height){
    vec3 qx=dFdx(positionVS),qy=dFdy(positionVS);
    vec3 r1=cross(qy,surfaceNormal),r2=cross(surfaceNormal,qx);
    float det=dot(qx,r1);
    vec3 grad=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);
    return normalize(max(abs(det),1e-10)*surfaceNormal-grad);
   }`);
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ldSkin=1.0-smoothstep(0.20,0.70,ldSurface);
   float ldDetail=ldTri(ldPosition*${kind==='elephant'?'1.25':'3.2'},normalize(ldRestNormal));
   diffuseColor.rgb*=mix(1.0,0.91+ldDetail*0.16,ldSkin);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=ldSurface<0.5?clamp(0.84+(1.0-ldDetail)*0.13,0.72,1.0):
    (ldSurface<1.5?0.32:(ldSurface<2.5?0.22:(ldSurface<3.5?0.59:0.43)));
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float ldHeight=ldDetail*${kind==='elephant'?'0.0024':'0.00065'}*ldSkin;
   ${kind==='elephant'?`float ldTrunk=smoothstep(1.73,2.05,ldPosition.x)*(1.0-smoothstep(.27,.44,abs(ldPosition.z)));
   ldHeight+=ldSkin*ldTrunk*.0008*sin(ldPosition.y*92.0+sin(ldPosition.x*31.0)*.6);`:''}
   normal=ldBump(-vViewPosition,normal,ldHeight);
  `);
 };
 return mat;
}
export function addLookdevDetails(THREE,a){
 const group=new THREE.Group();group.name='V07 restrained facial details';a.bones[a.data.head].add(group);
 const origin=new THREE.Vector3(...a.data.bones[a.data.head].p);
 const line=(pts,width,color)=>{
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p).sub(origin)));
  const geo=new THREE.TubeGeometry(curve,16,width,4,false);
  const obj=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.73}));group.add(obj);
 };
 if(a.kind==='tiger'){
  for(const side of [-1,1])for(let i=0;i<7;i++){
   const y=1.265+(i%4)*.022;
   line([[1.52,y,side*.192],[1.65,y-.012,side*.32],[1.72+i*.007,y+(i-3)*.018,side*(.49+(i%3)*.025)]],.0018,0xb8ae94);
  }
 }
 // Keep all additions attached to the authored head, never world-space floats.
 a.lookdevDetails=group;
}
export function lookdevStage(THREE,scene,renderer,assets){
 const group=new THREE.Group();group.name='V07 rocky riverbank';scene.add(group);
 const texture=ldTexture(THREE,assets.groundRelief);
 const mat=new THREE.MeshStandardMaterial({color:0x8b806a,roughness:.98,envMapIntensity:.16});
 mat.name='Layered limestone / original relief';mat.customProgramCacheKey=()=> 'jungle-king-v07-ground';
 mat.onBeforeCompile=s=>{
  s.uniforms.ldGround={value:texture};
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 ldGroundP;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nldGroundP=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   uniform sampler2D ldGround; varying vec3 ldGroundP;
   vec3 ldGroundNormal(vec3 p,vec3 n,float h){vec3 x=dFdx(p),y=dFdy(p),r1=cross(y,n),r2=cross(n,x);float d=dot(x,r1);return normalize(max(abs(d),1e-10)*n-sign(d)*(dFdx(h)*r1+dFdy(h)*r2));}`);
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ldRock=texture2D(ldGround,ldGroundP.xz*.21).r;
   float ldSand=texture2D(ldGround,ldGroundP.xz*1.45).r;
   float ldDamp=smoothstep(.25,.62,ldRock);
   diffuseColor.rgb*=.64+ldRock*.69+ldSand*.12;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.125,.145,.108),.13*(1.0-ldDamp));`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=ldGroundNormal(-vViewPosition,normal,ldRock*.025+ldSand*.003);`);
 };
 const geo=new THREE.PlaneGeometry(90,90,100,100);geo.rotateX(-Math.PI/2);
 const p=geo.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i);const edge=Math.max(0,Math.min(1,(Math.abs(z)-3)/5));
  p.setY(i,-.026+edge*(.17*Math.sin(x*.91+z*.71)+.13*Math.sin(x*1.73-z*.39)));
 }
 geo.computeVertexNormals();const ground=new THREE.Mesh(geo,mat);ground.receiveShadow=true;group.add(ground);
 let seed=6271;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const rockMat=new THREE.MeshStandardMaterial({color:0x716c5f,roughness:.97,vertexColors:true});
 const rockGeo=new THREE.IcosahedronGeometry(1,2),rp=rockGeo.attributes.position,col=[];
 for(let i=0;i<rp.count;i++){
  const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),f=1+.16*Math.sin(x*13+y*9+z*8)+.1*Math.sin(z*17);
  rp.setXYZ(i,x*f,y*f,z*f);const tint=.77+.20*Math.max(0,y);col.push(tint,tint*.96,tint*.86);
 }rockGeo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));rockGeo.computeVertexNormals();
 for(let i=0;i<125;i++){
  const x=(random()-.5)*34,z=(random()-.5)*26;
  if(Math.abs(z)<2.7&&Math.abs(x)<12)continue;
  const o=new THREE.Mesh(rockGeo,rockMat);const s=.11+Math.pow(random(),2)*.85;
  o.position.set(x,-.015+s*.24,z);o.scale.set(s*(1+random()),s*.48,s);o.rotation.set(random()*.25,random()*6.28,random()*.18);o.castShadow=true;o.receiveShadow=true;group.add(o);
 }
 // Soft contact accent supplements (does not replace) actual shadow maps.
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(24,20,15,0.30)');grad.addColorStop(.5,'rgba(24,20,15,0.12)');grad.addColorStop(1,'rgba(24,20,15,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 const shadows={};for(const k of ['elephant','tiger']){
  const o=new THREE.Mesh(new THREE.PlaneGeometry(k==='elephant'?4.9:3.4,k==='elephant'?2.3:1.35),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,opacity:1}));o.rotation.x=-Math.PI/2;o.position.y=.003;scene.add(o);shadows[k]=o;
 }
 // A bounded environment map gives ivory and eyes a reflection to respond to.
 // No external HDRI, no changes to physical lights in the simulation.
 const sky=document.createElement('canvas');sky.width=256;sky.height=128;const sx=sky.getContext('2d');const sg=sx.createLinearGradient(0,0,0,128);
 sg.addColorStop(0,'#adbfc5');sg.addColorStop(.45,'#d4cbb6');sg.addColorStop(.52,'#a59a7b');sg.addColorStop(1,'#32392e');sx.fillStyle=sg;sx.fillRect(0,0,256,128);
 const env=new THREE.CanvasTexture(sky);env.colorSpace=THREE.SRGBColorSpace;env.mapping=THREE.EquirectangularReflectionMapping;
 const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromEquirectangular(env);scene.environment=target.texture;pmrem.dispose();env.dispose();
 return {group,shadows,environmentTarget:target,update(e,t){for(const a of [e,t]){const o=shadows[a.kind];o.position.x=a.group.position.x;o.position.z=a.group.position.z;o.visible=a.group.visible;o.material.opacity=a.kind==='elephant'?.72:.55;}},setClay(on){group.visible=!on;for(const o of Object.values(shadows))o.material.opacity=on?.35:.7;}};
}
