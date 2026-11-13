/* Continuous skinned meshes: the visible animal is one deforming surface,
   rather than a collection of rigid body parts. Physics uses simpler colliders. */
export function createAnimal(THREE,data,kind){
 const group=new THREE.Group();group.name=kind;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
 geometry.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.skinIndices,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.skinWeights,4));geometry.setIndex(data.indices);
 const bones=data.bones.map(d=>{const b=new THREE.Bone();b.name=d.name;return b;});
 data.bones.forEach((d,i)=>{const p=d.parent<0?[0,0,0]:data.bones[d.parent].p;bones[i].position.set(d.p[0]-p[0],d.p[1]-p[1],d.p[2]-p[2]);if(d.parent>=0)bones[d.parent].add(bones[i]);});
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vClayPosition;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvClayPosition = position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vClayPosition;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 p=vClayPosition;
    float grain=sin(p.x*151.0+p.y*123.0)*sin(p.z*183.0-p.y*71.0);
    float wrinkle=pow(abs(sin(p.y*56.0+sin(p.x*21.0+p.z*31.0)*1.8)),16.0);
    diffuseColor.rgb*= ${kind==='elephant'?'(0.95+grain*0.018-wrinkle*0.12)':'(0.98+grain*0.035)'};
  `);
 };
 const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=kind+' continuous skin';mesh.add(bones[0]);
 const skeleton=new THREE.Skeleton(bones);mesh.bind(skeleton);mesh.normalizeSkinWeights();mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);
 // Restrained silhouette, not an exaggerated cartoon contour.
 const inkMat=new THREE.MeshBasicMaterial({color:0x2a2822,side:THREE.BackSide});
 inkMat.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','vec3 transformed = position + normal * 0.008;');};
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
 for(const side of [1,-1]){
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
   sphere([1.04,1.70,side*.36],[.075,.10,.018],0x393029);
   for(let i=0;i<4;i++){
    const start=new THREE.Vector3(1.59,1.18+i*.035,side*.235),end=new THREE.Vector3(1.65+i*.015,1.08+i*.09,side*(.50+i*.025));
    const bp=new THREE.Vector3(...data.bones[data.head].p);const g=new THREE.BufferGeometry().setFromPoints([start.sub(bp),end.sub(bp)]);
    const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xe3dcc9,transparent:true,opacity:.75}));bones[data.head].add(line);
   }
  }
 }
 if(kind==='tiger'){sphere([1.755,1.255,0],[.075,.071,.143],0x463126);sphere([1.59,1.096,0],[.12,.025,.205],0x30221c);}
 return {group,mesh,bones,data,kind,helper,ink,distance:0,lastPosition:null,rest:bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}))};
}

export function poseAnimal(THREE,animal,opts,legIK,gaitFoot){
 const {bones,data,kind,rest,group}=animal;const t=opts.time,elephant=kind==='elephant';
 for(let i=0;i<bones.length;i++){bones[i].position.copy(rest[i].p);bones[i].quaternion.copy(rest[i].q);bones[i].scale.set(1,1,1);}
 const moving=Math.min(1,Math.abs(opts.speed)/.7),prep=opts.preparation||0,react=opts.reaction||0;
 const body=bones[data.body],head=bones[data.head];
 body.position.y+=Math.sin(t*2.15)*.012-(elephant?.035:.07)*moving-(elephant?.025:.085)*react;
 body.rotation.z=(elephant?.012:.022)*Math.sin(opts.distance*6)+(elephant?-.015:.07)*react;
 head.rotation.z=(elephant?.04:.025)*Math.sin(t*1.8)+prep*.07-react*.14;
 head.rotation.y=Math.sin(t*1.1)*.018;
 const hipLocal=new THREE.Vector3(), footY=elephant?.26:.16;
 group.updateMatrixWorld(true);
 data.legs.forEach((leg,i)=>{
  const g=gaitFoot(opts.distance,i,kind),x=leg.foot[0]+g.x*moving;
  bones[leg.bones[0]].getWorldPosition(hipLocal);group.worldToLocal(hipLocal);
  const ik=legIK(x-hipLocal.x,footY+g.lift*moving-group.position.y-hipLocal.y,leg.lengths[0],leg.lengths[1],leg.front?1:-1);
  bones[leg.bones[0]].rotation.z=ik.upper-body.rotation.z;
  bones[leg.bones[1]].rotation.z=ik.lower;
  bones[leg.bones[2]].rotation.z=-ik.upper-ik.lower+(g.stance?0:-.1*moving*Math.sin(g.phase*Math.PI));
 });
 data.ears.forEach((idx,i)=>{bones[idx].rotation.y=(i===0?1:-1)*(.05*Math.sin(t*2.5+i)+prep*.24-react*.09);});
 if(elephant)data.trunk.forEach((idx,i)=>{bones[idx].rotation.z=.035*Math.sin(t*1.8-i*.32)+prep*.11+moving*(i<2?-.10:.065);bones[idx].rotation.x=.018*Math.sin(t*1.3-i*.4);});
 data.tail.forEach((idx,i)=>{bones[idx].rotation.y=.10*Math.sin(t*1.7-i*.48)+(elephant?0:.06)*react;});
 group.updateMatrixWorld(true);animal.mesh.skeleton.update();
}
