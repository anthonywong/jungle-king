import {createCandidateAnimal,beginCandidateBlend} from './candidate-asset.mjs';
import {lookdevStage} from './lookdev.mjs';
import {presenceShot,presenceRate,presenceDust} from './presence.mjs';
import {PresenceAudio} from './presence-audio.mjs';
import {directedShot,dramaticRate} from './cinematography.mjs';
import {SignatureBattleSimulation} from './signature-simulation.mjs';
import {ATTACKS,validAttack} from './signature.mjs';
import {DirectedBattleSimulation} from './directed.mjs';
import {directedPlan,cameraCue,POSES} from './performance.mjs';
import {STEP,clamp,lerp,smooth,legIK,gaitFoot,validateSettings,arrange} from './mechanics.mjs';
import {createAnimal,poseAnimal,resetAnimalPerformance,setAnimalClay,attachSignatureTracker} from './animals.mjs';
import {BattleSimulation} from './simulation.mjs';
import {LabAudio} from './audio.mjs';
import {runEngineDiagnostics} from './diagnostics.mjs';

const $=id=>document.getElementById(id);
const data=JSON.parse($('lab-data').textContent), assets=data.assets;
$('impactImg').src=assets.brush;$('referenceVideo').src=assets.reference;
const audio=new CaptureRemoteAudio();
let THREE,RAPIER,GLTFLoader,renderer,scene,camera,simulation,elephant,tiger,referenceElephant,debugLines,debrisGroup;
let modelVariant="candidate",inspectFocus="body",paintedBackdrop,reviewGround,preReviewStudio=false;
let ready=false,paused=false,rate=1,debug=false,rig=false,mode='directed',comparison=null,compareResults=null;
let presentation='cinematic',seeking=false,attack='stomp',inspectElephant=false;
let presence=true,dustGroup,cinemaLights,catchSound=false,visualStage,studioLight=false;
let cameraPreset='director',dramaticPacing=true,actingRefined=true,lastShot=null,spectator=false;
let idleTime=0,accumulator=0,lastFrame=0,frames=0,fpsStart=0,frameCount=0,dropped=0;
let view={yaw:.22,pitch:.26,radius:14},targetView={...view},cameraTarget=null,manualCamera=false;
let playbackWallSeconds=0;
let lastWhoosh=false;
let runLogs=[],lastModes={},projected,sharedStoneGeo,sharedStoneMat,footDistance=0;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const controls=['distance','angle','offset','speed','friction','mass'];
function settings(){return {...validateSettings({...Object.fromEntries(controls.map(k=>[k,Number($(k).value)])),mode}),mode,attack};}
function outSettings(){const s=settings();$('distanceOut').textContent=s.distance.toFixed(1)+' m';$('angleOut').textContent=s.angle+'°';$('offsetOut').textContent=s.offset.toFixed(1)+' m';$('speedOut').textContent=s.speed.toFixed(1)+' m/s';$('frictionOut').textContent=s.friction.toFixed(2);$('massOut').textContent=s.mass+' kg';}
function toast(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2400);}
function log(s){runLogs.unshift(s);runLogs=runLogs.slice(0,4);$('eventLog').replaceChildren(...runLogs.map(t=>{const d=document.createElement('div');d.textContent=t;return d;}));}
function saveJSON(obj,name){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function status(t){$('phase').textContent=t;}
const PHASES={ready:'待命',prepare:'蓄勢',approach:'推進',strike:'落勢出招',impact:'接觸',recoil:'受擊',recovery:'收勢',complete:'演武完成',miss:'未接觸'};
function progress(p,text){bridgePost('progress',{label:text||'正在準備場景'});$('loadProgress').style.width=p+'%';if(text)$('loadText').textContent=text;}
function errorScreen(e){
 bridgeFail(e?.message||e);console.error(e);$('loading').classList.remove('hidden');$('loadError').hidden=false;$('loadError').textContent=String(e?.stack||e);
 $('retryBtn').classList.remove('hidden');progress(100,'無法啟動 3D 試驗。請確認網路可連到 jsDelivr 或 unpkg，並使用支援 WebGL2 的瀏覽器。');
 $('loadHelp').textContent='這不是遊戲畫面。尚未載入成功時，沒有使用替代物理來假裝運行。模型、音樂與原畫已內嵌；仍須連網載入固定版本的 Three.js、GLTFLoader 與 Rapier。';status('載入失敗');
}
function decode64(s){return new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));}
async function imports(){
 const packed=JSON.parse($('vendor-data').textContent||'{}');
 const blob=s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}));
 if(packed.core&&packed.three&&packed.rapier){
  const core=blob(decode64(packed.core)),main=blob(decode64(packed.three).replaceAll("'./three.core.js'",JSON.stringify(core))),rapier=blob(decode64(packed.rapier));
  [THREE,RAPIER]=await Promise.all([import(main),import(rapier)]);RAPIER=RAPIER.default||RAPIER;return;
 }
 async function attempt(urls){let err;for(const url of urls){try{return await Promise.race([import(url),new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timed out loading '+url)),18000))]);}catch(e){err=e;}}throw err;}
 [THREE,RAPIER]=await Promise.all([
  attempt(['https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js','https://unpkg.com/three@0.180.0/build/three.module.js']),
  attempt(['https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js','https://unpkg.com/@dimforge/rapier3d-compat@0.17.3/rapier.es.js'])
 ]);RAPIER=RAPIER.default||RAPIER;
}

async function setupScene(){
 $('canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;bridgeFail('webgl-context-lost');});
 renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.debug.onShaderError=(gl,program,vs,fs)=>{
  ready=false;paused=true;audio.pause();window.__LAB_READY=false;
  const detail=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs)].filter(Boolean).join('\n');
  window.__LAB_ERROR='Material shader compilation failed: '+detail;errorScreen(new Error(window.__LAB_ERROR));
 };
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 scene=new THREE.Scene();scene.background=new THREE.Color(0xd9d7c9);scene.fog=new THREE.Fog(0xd9d7c9,19,56);
 camera=new THREE.PerspectiveCamera(43,1,.1,130);cameraTarget=new THREE.Vector3(-1,1.25,0);projected=new THREE.Vector3();
 const ambient=new THREE.HemisphereLight(0xf2eedb,0x514d39,1.7);scene.add(ambient);
 const sun=new THREE.DirectionalLight(0xffeed0,2.6);sun.position.set(-5,10,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-14;sun.shadow.camera.right=14;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xc8d3ce,1.2);fill.position.set(6,5,-9);scene.add(fill);cinemaLights={ambient,sun,fill};
 visualStage=lookdevStage(THREE,scene,renderer,assets);
 const landscape=new THREE.TextureLoader().load(assets.landscape);landscape.colorSpace=THREE.SRGBColorSpace;
 const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(78,37),new THREE.MeshBasicMaterial({map:landscape,color:0xd4d1c4,depthWrite:false}));
 backdrop.position.set(0,13,-25);scene.add(backdrop);paintedBackdrop=backdrop;
 reviewGround=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshStandardMaterial({color:0xb4b1a5,roughness:1,metalness:0}));reviewGround.rotation.x=-Math.PI/2;reviewGround.position.y=-.022;reviewGround.receiveShadow=true;reviewGround.visible=false;scene.add(reviewGround);
 elephant=await createCandidateAnimal(THREE,GLTFLoader,assets.candidateGLB,data.candidateRig);tiger=createAnimal(THREE,data.models.tiger,'tiger',assets);scene.add(elephant.group,tiger.group,elephant.helper,tiger.helper);
 referenceElephant=null;
 debrisGroup=new THREE.Group();scene.add(debrisGroup);sharedStoneGeo=new THREE.IcosahedronGeometry(1,0);sharedStoneMat=new THREE.MeshStandardMaterial({color:0x5e6556,roughness:1});
 debugLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,depthTest:false}));debugLines.renderOrder=30;debugLines.visible=false;scene.add(debugLines);
 const resize=()=>{const w=Math.max(1,$('stage').clientWidth),h=Math.max(1,$('stage').clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe($('stage'));resize();
 createDust();installCamera();
}
function createDust(){
 dustGroup=new THREE.Group();scene.add(dustGroup);
 const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),grad=g.createRadialGradient(32,32,1,32,32,32);
 grad.addColorStop(0,'rgba(173,154,122,0.78)');grad.addColorStop(.40,'rgba(173,154,122,0.35)');grad.addColorStop(1,'rgba(173,154,122,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 for(let i=0;i<38;i++){const m=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:0,toneMapped:true});const o=new THREE.Sprite(m);o.visible=false;dustGroup.add(o);}
}
function lighting(){
 if(!cinemaLights)return;const film=presence&&presentation==='cinematic'&&!studioLight;
 cinemaLights.ambient.intensity=film?1.12:1.65;
 cinemaLights.sun.intensity=film?3.3:2.4;cinemaLights.fill.intensity=film?1.9:1.3;
 cinemaLights.sun.color.set(film?0xffdec0:0xfff1db);cinemaLights.fill.color.set(0xc6deec);
 cinemaLights.sun.position.set(-3.5,7.0,5.0);cinemaLights.fill.position.set(5,6,-5.5);
 scene.fog.color.set(film?0xb7c0bd:0xd5d5ca);scene.background.set(film?0xb7c0bd:0xd5d5ca);
 scene.fog.near=film?17:20;scene.fog.far=film?51:65;
 renderer.toneMappingExposure=film?1.04:1.08;
}

function installCamera(){
 const canvas=$('canvas'),pts=new Map();let pinch=0;if(parent!==window)return;
 canvas.addEventListener('pointerdown',e=>{pts.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);manualCamera=true;});
 canvas.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const old=pts.get(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===1){targetView.yaw-=(e.clientX-old.x)*.007;targetView.pitch=clamp(targetView.pitch+(e.clientY-old.y)*.005,.10,1.15);}else{const p=[...pts.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch)targetView.radius=clamp(targetView.radius*pinch/d,inspectElephant?3:7,26);pinch=d;}
 });
 const end=e=>{pts.delete(e.pointerId);pinch=0;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();manualCamera=true;targetView.radius=clamp(targetView.radius*Math.exp(e.deltaY*.001),inspectElephant?3:7,26);},{passive:false});
}
function onSimulationEvent(e){
 if(seeking)return;if(e.type==='phase')bridgePost('phase',{label:PHASES[e.phase]||e.phase});
 if(e.type==='start'){
  log(mode==='directed'?'編排攻擊 · Rapier 確認接觸 · 配對受擊':mode==='physics'?'原版物理基線 · 推力前進':'時間曲線基線');
  if(presentation==='cinematic')audio.call('elephant');
 }
 // Whoosh is synchronized to the active part of the existing strike below.

 if(e.type==='contact'){bridgePost('contact',{time:e.time});
  log(`${e.time.toFixed(3)} s · ${e.source.startsWith('Rapier')?'Rapier 接觸成立':'預設動畫觸發'}`);
  if(presentation==='cinematic'){
   if(!reduce){$('flash').classList.remove('on');void $('flash').offsetWidth;$('flash').classList.add('on');}
   audio.impact(attack);
  }
 }
 if(e.type==='complete'){if(bridgeLive)bridgeSettling=0;
  lastModes[mode]=e.result;log(e.result.contact?'演出完成 · 可逐段檢視':'未接觸 · 不觸發受擊或「破」');
  $('startBtn').disabled=false;$('pauseBtn').disabled=true;$('stepBtn').disabled=true;
  if(comparison){
   comparison.results[mode]=e.result;
   if(mode==='directed')setTimeout(()=>{if(!comparison)return;mode='physics';updateMode();rebuild(false);begin(false);},500);
   else{compareResults=comparison.results;comparison=null;renderResults();$('resultsDialog').showModal();setConfigDisabled(false);}
  }else setConfigDisabled(false);
 }
}
function rebuild(cancel=true){
 if(!ready)return;if(cancel)comparison=null;audio.pause();simulation?.dispose();simulation=new (mode==='directed'?(attack==='drive'?DirectedBattleSimulation:SignatureBattleSimulation):BattleSimulation)(RAPIER,settings(),onSimulationEvent);if(simulation.signature)attachSignatureTracker(THREE,simulation,elephant,legIK,gaitFoot);simulation.actingRefined=actingRefined;simulation.presence=presence;audio.presenceMode=presence;resetAnimalPerformance(elephant);resetAnimalPerformance(tiger);if(referenceElephant)resetAnimalPerformance(referenceElephant);
 debrisGroup.clear();paused=false;accumulator=0;footDistance=0;catchSound=false;lastWhoosh=false;playbackWallSeconds=0;runLogs=[];$('impact').classList.remove('show');$('flash').classList.remove('on');
 $('pauseBtn').textContent='暫停';$('pauseBtn').disabled=true;$('stepBtn').disabled=true;$('startBtn').disabled=false;$('timeline').style.width='0%';status('待命');setConfigDisabled(false);
 log('外部模型接合 · 足部接觸追蹤使用匯入骨架；非原廠 Attack 動畫');if(comparison)setConfigDisabled(true);syncVisual(0);
}
function setConfigDisabled(v){for(const k of controls)$(k).disabled=v;$('directedMode').disabled=v;$('physicsMode').disabled=v;$('animationMode').disabled=v;$('compareBtn').disabled=true;$('physicsMode').disabled=true;$('animationMode').disabled=true;for(const a of Object.keys(ATTACKS))$('attack-'+a).disabled=v||a!=='stomp';$('modelView').disabled=v;$('actingToggle').disabled=v;$('presenceToggle').disabled=v;}
function begin(cancel=true){
 if(!ready)return;$('filmStart').classList.add('hidden');const wasInspecting=inspectElephant;inspectElephant=false;if(wasInspecting){studioLight=preReviewStudio;$('studioBtn').classList.toggle('active',studioLight);$('studioBtn').setAttribute('aria-pressed',String(studioLight));setPresentation('cinematic');}selectModelVariant('candidate');tiger.group.visible=true;$('modelView').classList.remove('active');if(cancel)comparison=null;if(simulation.running||simulation.done||simulation.time>0)rebuild(false);
 paused=false;accumulator=0;manualCamera=false;beginCandidateBlend(elephant);simulation.start();$('startBtn').disabled=true;$('pauseBtn').disabled=false;$('stepBtn').disabled=true;$('pauseBtn').textContent='暫停';setConfigDisabled(true);if(!seeking&&presentation==='cinematic'){if(!audio.ctx){audio.unlock().then(()=>{audio.start();if(presentation==='cinematic'&&simulation?.time<.4)audio.call('elephant');$('audioBtn').textContent='聲音：開';$('audioBtn').setAttribute('aria-pressed','true');}).catch(e=>toast('請按聲音開關啟用音訊'));}else audio.start();}
}
function pauseToggle(){if(!simulation?.running)return;paused=!paused;$('pauseBtn').textContent=paused?'繼續':'暫停';$('stepBtn').disabled=!paused;if(paused)audio.pause();else if(presentation==='cinematic')audio.start();}
function updateMode(){
 for(const k of ['directed','physics','animation']){$(k+'Mode').classList.toggle('active',mode===k);$(k+'Mode').setAttribute('aria-pressed',mode===k);}
 $('modeDesc').textContent=mode==='directed'?'關鍵姿態進攻；Rapier 確認接觸後，切換配對受擊。不是全身物理模擬。':mode==='physics'?'原版基線：由推力移動，碰撞計算推移。用來比較節奏，不是新編排。':'原時間曲線基線；沒有接觸力判定。';
}
function setPresentation(p){
 presentation=p;lighting();for(const k of ['cinematic','clay','debug'])$('view-'+k).classList.toggle('active',p===k);
 setAnimalClay(elephant,p==='clay');setAnimalClay(tiger,p==='clay');if(referenceElephant)setAnimalClay(referenceElephant,p==='clay');
 debug=p==='debug';$('debugBtn').classList.toggle('active',debug);$('debugBtn').setAttribute('aria-pressed',debug);
 targetView=inspectElephant?{yaw:.62,pitch:.12,radius:7}:p==='cinematic'?{yaw:.30,pitch:.22,radius:11.8}:{yaw:.03,pitch:.16,radius:13};manualCamera=false;
 $('impact').classList.remove('show');$('flash').classList.remove('on');
 document.body.classList.toggle('inspection',p!=='cinematic');
 if(p!=='cinematic')audio.pause();else if(simulation?.running&&!paused)audio.start();
}
function seekBeat(beat){
 if(!ready||comparison)return;seeking=true;rebuild();simulation.start();
 const target=beat==='prepare'?.29:beat==='drive'?(simulation.signature?simulation.plan.windup+simulation.plan.drive+.24:simulation.directed?simulation.plan.windup+simulation.plan.drive*.55:1.55):null;
 for(let i=0;i<1600&&simulation.running;i++){
  simulation.step();
  if(target!==null&&simulation.time>=target)break;
  if(beat==='impact'&&simulation.hitT>=0)break;
  if(beat==='recovery'&&simulation.hitT>=0&&simulation.time>=simulation.hitT+.60)break;
 }
 seeking=false;paused=true;accumulator=0;$('pauseBtn').textContent='繼續';$('pauseBtn').disabled=!simulation.running;$('stepBtn').disabled=!simulation.running;
 $('startBtn').disabled=false;setConfigDisabled(false);audio.pause();syncVisual(0);readouts();renderer.render(scene,camera);
 log(simulation.hitT<0&&['impact','recovery'].includes(beat)?'這組設定未接觸；沒有捏造命中姿態':'已定位動作節點 · 可逐幀或繼續');
}
function syncVisual(dt){
 if(!simulation)return;const sim=simulation;
 for(const a of [elephant,tiger,referenceElephant].filter(Boolean)){
  const b=sim[a.kind],p=b.translation(),q=b.rotation(),v=b.linvel();a.group.position.set(p.x,p.y,p.z);a.group.quaternion.set(q.x,q.y,q.z,q.w);
  const age=sim.hitT<0?100:sim.time-sim.hitT;
  poseAnimal(THREE,a,{time:sim.time+(!sim.running?idleTime*.3:0),earTime:sim.running||sim.done?sim.time:idleTime,distance:sim.signedTravel[a.kind],speed:sim.running?Math.hypot(v.x,v.z):0,preparation:sim.running&&sim.time<1.05?Math.sin(sim.time/1.05*Math.PI):0,reaction:sim.hitT<0?0:Math.exp(-age*(a.kind==='tiger'?1.5:4)),sim,freezeSourceIdle:inspectElephant},legIK,gaitFoot);
  a.helper.visible=rig&&(a===tiger?!inspectElephant:(modelVariant==="baseline"?a===referenceElephant:a===elephant));
 }
 for(let i=debrisGroup.children.length;i<sim.debris.length;i++){const m=new THREE.Mesh(sharedStoneGeo,sharedStoneMat);m.castShadow=true;debrisGroup.add(m);}
 sim.debris.forEach((d,i)=>{const m=debrisGroup.children[i],p=d.body.translation(),q=d.body.rotation();m.position.set(p.x,p.y,p.z);m.quaternion.set(q.x,q.y,q.z,q.w);m.scale.set(d.r*1.2,d.r*.8,d.r);});
 if(debug){
  const d=sim.world.debugRender(),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(d.vertices,3));g.setAttribute('color',new THREE.BufferAttribute(d.colors,4));debugLines.geometry.dispose();debugLines.geometry=g;
 }
 debugLines.visible=debug;
 elephant.group.visible=modelVariant==="candidate";if(referenceElephant)referenceElephant.group.visible=false;
 visualStage?.update(modelVariant==="baseline"?referenceElephant:elephant,tiger);
 // Every cinematic camera sample uses simulation time. No Date.now jitter,
 // per-render random shake, or camera motion during a paused hit frame.
 const ep=elephant.group.position,tp=tiger.group.position;
 tiger.group.visible=!inspectElephant;
 if(reviewGround){reviewGround.visible=inspectElephant;paintedBackdrop.visible=!inspectElephant;visualStage.group.visible=!inspectElephant;if(inspectElephant){scene.background.set(0xdeddd4);scene.fog.color.set(0xdeddd4);}else{const film=presence&&presentation==='cinematic'&&!studioLight;scene.background.set(film?0xb7c0bd:0xd5d5ca);scene.fog.color.copy(scene.background);}}
 const automatic=!inspectElephant&&sim.directed&&presentation==='cinematic'&&!manualCamera;
 if(automatic){
  lastShot=presenceShot({presence,hitPoint:sim.hitPoint,time:sim.time,hitT:sim.hitT,plan:sim.plan,elephant:ep,tiger:tp,
   dir:sim.layout.dir,attack,aspect:camera.aspect,preset:cameraPreset,
   active:sim.running||sim.done,reduced:reduce,start:sim.directedStart,defenderStart:sim.startTiger});
  cameraTarget.fromArray(lastShot.target);camera.position.fromArray(lastShot.position);
  camera.fov=lastShot.fov;camera.updateProjectionMatrix();camera.up.set(0,1,0);camera.lookAt(cameraTarget);camera.rotateZ(lastShot.roll);
  $('shotLabel').textContent=lastShot.label;
 }else{
  lastShot=null;
  const desired=inspectElephant?new THREE.Vector3(ep.x+(inspectFocus==='head'?1.42:.35),inspectFocus==='head'?2.91:1.82,ep.z):new THREE.Vector3((ep.x+tp.x)/2+.15,1.25,(ep.z+tp.z)/2);
  cameraTarget.lerp(desired,dt&&!paused?1-Math.exp(-dt*4):1);
  for(const k of ['yaw','pitch','radius'])view[k]=lerp(view[k],targetView[k],dt?1-Math.exp(-dt*8):1);
  const fit=Math.max(1,1.30/camera.aspect),r=view.radius*fit;
  camera.position.set(cameraTarget.x+Math.sin(view.yaw)*Math.cos(view.pitch)*r,cameraTarget.y+Math.sin(view.pitch)*r,cameraTarget.z+Math.cos(view.yaw)*Math.cos(view.pitch)*r);
  camera.fov=43;camera.updateProjectionMatrix();camera.up.set(0,1,0);camera.lookAt(cameraTarget);
  $('shotLabel').textContent=inspectElephant?(modelVariant==='candidate'?'AnimalAnimator · 實際匯入模型':'V08 · 原型參照'):manualCamera?'手動視角 · 按導演鏡頭復原':'固定檢視';
 }
 if(dustGroup){const enabled=presence&&presentation==='cinematic'&&!reduce&&sim.hitT>=0;
  dustGroup.children.forEach((o,i)=>{const q=enabled?presenceDust(sim.time-sim.hitT,i,sim.hitPoint,sim.layout.dir):{visible:false};o.visible=q.visible;
   if(q.visible){o.position.set(q.x,q.y,q.z);o.scale.set(q.size*1.9,q.size*.72,1);o.material.opacity=q.alpha;}
  });
 }
 document.body.classList.toggle('playing-film',sim.running&&!paused);
 document.body.classList.toggle('presence',presence);
 document.body.classList.toggle('directing',automatic&&!reduce&&cameraPreset!=='fixed'&&(sim.running||sim.done));
 const impactAge=sim.hitT<0?-1:sim.time-sim.hitT,stampStart=presence?.045:.085,stampEnd=presence?.58:.78,stamp=impactAge>=stampStart&&impactAge<stampEnd&&presentation==='cinematic';
 $('impact').style.opacity=stamp?Math.min(1,(impactAge-stampStart)/.045)*Math.min(1,(stampEnd-impactAge)/.16):0;
 $('impact').style.transform=`translate(0,-50%) scale(${stamp&&!reduce?1+.26*Math.exp(-(impactAge-stampStart)*24):1}) rotate(-5deg)`;
 if(sim.hitPoint){
  projected.set(sim.hitPoint.x,sim.hitPoint.y,sim.hitPoint.z).project(camera);const x=(projected.x*.5+.5)*$('stage').clientWidth,y=(-projected.y*.5+.5)*$('stage').clientHeight;
  $('contactDot').style.display=debug?'block':'none';$('contactDot').style.left=(x-4)+'px';$('contactDot').style.top=(y-4)+'px';
 }else $('contactDot').style.display='none';
 if(sim.running&&sim.signature&&!lastWhoosh&&sim.time>=sim.plan.windup+sim.plan.drive+sim.plan.activeFrom-.095){lastWhoosh=true;if(!seeking&&presentation==='cinematic'&&!paused)audio.whoosh(attack);}
 audio.sync(sim);
 if(sim.presence&&sim.hitT>=0&&impactAge>=.40&&!catchSound&&sim.running&&!paused&&!seeking){catchSound=true;if(presentation==='cinematic')audio.thump(.38);}
 if(sim.running&&!paused&&!seeking&&sim.traveled.elephant-footDistance>.68){footDistance=sim.traveled.elephant;if(!seeking&&presentation==='cinematic')audio.thump(.24);}
}
function readouts(){
 const s=simulation;if(!s)return;status(paused?'暫停 · '+PHASES[s.phase]:(s.holdRemaining>0?'命中停頓':PHASES[s.phase]||s.phase));
 $('contactValue').innerHTML=(s.hitT<0?'—':s.hitT.toFixed(2))+' <small>s</small>';
 $('velocityValue').innerHTML=s.peakTigerSpeed.toFixed(2)+' <small>m/s</small>';
 $('travelValue').innerHTML=s.peakDisplacement.toFixed(2)+' <small>m</small>';
 $('penetrationValue').innerHTML=(mode!=='animation'?(s.maxPenetration*1000).toFixed(1):'—')+' <small>mm</small>';
 $('contactSource').textContent=s.hitT<0?'尚未發生':mode==='animation'?'Authored timeline':mode==='directed'?(simulation.signature?'Rapier '+(attack==='stomp'?'足部':'長鼻')+'接觸 → 編排受擊':'Rapier contact → 編排受擊'):'Rapier contact';
 $('forceValue').textContent=mode==='directed'?'—（受擊由動畫控制）':mode==='physics'?(s.maxForce/1000).toFixed(2)+' kN':'—（沒有物理求解）';
 $('timeline').style.width=clamp((s.elapsed??s.time)/(s.directed?(s.hitT<0?s.plan.windup+s.plan.drive+(s.plan.strike||0)+s.plan.recovery+s.plan.hitHold:s.hitT+s.plan.recovery+s.plan.hitHold):(s.hitT<0?8.2:s.hitT+3.8))*100,0,100)+'%';
 const c=$('plot').getContext('2d'),w=c.canvas.width,h=c.canvas.height;c.clearRect(0,0,w,h);c.strokeStyle='#c3c5ad';c.lineWidth=1;c.beginPath();c.moveTo(0,h-9);c.lineTo(w,h-9);c.stroke();
 const points=s.samples;if(points.length){const vmax=Math.max(1,s.peakTigerSpeed*1.1),tmax=Math.max(5,s.time);c.strokeStyle=mode==='physics'?'#963c2d':'#70795b';c.lineWidth=2;c.beginPath();points.forEach((p,i)=>{const x=p.t/tmax*w,y=h-10-p.v/vmax*(h-20);if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();}
}
function renderResults(){
 const p=compareResults.directed,a=compareResults.physics;
 const num=(n,d=2)=>n===null||n===undefined?'—':n.toFixed(d);
 $('resultTable').innerHTML=`<table><thead><tr><th>同組設定</th><th>新版編排</th><th>原版物理</th></tr></thead><tbody><tr><td>Rapier 接觸</td><td>${p.contact?'是':'否'}</td><td>${a.contact?'是':'否'}</td></tr><tr><td>首次接觸 / s</td><td>${num(p.contactTime)}</td><td>${num(a.contactTime)}</td></tr><tr><td>模擬時長 / s</td><td>${num(p.presentationDuration)}</td><td>${num(a.steps*a.timestep)}</td></tr><tr><td>最遠推移 / m</td><td>${num(p.peakDefenderDisplacementM)}</td><td>${num(a.peakDefenderDisplacementM)}</td></tr><tr><td>受擊來源</td><td>接觸後編排</td><td>物理求解</td></tr><tr><td>命中停頓</td><td>${Math.round(p.hitHoldSeconds*1000)} ms</td><td>無</td></tr></tbody></table>`;
}
function animate(now){
 if(!ready)return;
 if(!bridgeLive){lastFrame=now;requestAnimationFrame(animate);return;}
 const wallDelta=lastFrame?Math.max(0,(now-lastFrame)/1000):0;const dt=Math.min(.08,wallDelta);lastFrame=now;
 if(!paused&&!document.hidden)bridgeSeconds+=wallDelta;
 if(!document.hidden){
  if(!paused)idleTime+=dt;
  if(simulation?.running&&!paused){
   playbackWallSeconds+=dt;
   accumulator+=dt*rate*(presence?presenceRate(simulation,dramaticPacing&&presentation==='cinematic'&&!reduce):dramaticRate(simulation,dramaticPacing&&presentation==='cinematic'&&!reduce));let n=0;
   try{while(accumulator>=STEP&&n<12){simulation.step();accumulator-=STEP;n++;if(!simulation.running){accumulator=0;break;}}}catch(e){simulation.running=false;bridgeFail('simulation-error: '+e.message);toast('物理運行錯誤：'+e.message);console.error(e);setConfigDisabled(false);$('startBtn').disabled=false;$('pauseBtn').disabled=true;$('stepBtn').disabled=true;}
   if(n===12&&accumulator>=STEP){dropped+=accumulator;accumulator=0;}
  }
  if(bridgeSettling>=0&&!paused){bridgeSettling+=dt;elephant.returnBlend=Math.min(1,bridgeSettling/.28);}
  syncVisual(dt);renderer.render(scene,camera);frameCount++;bridgeFrames++;
  if(bridgeSettling>=.28&&bridgeLive){
   const report={...simulation.report(),threeRevision:THREE.REVISION,rapierVersion:RAPIER.version(),renderFrames:bridgeFrames,visibleWallSeconds:bridgeSeconds,averageFPS:bridgeSeconds>0?bridgeFrames/bridgeSeconds:null,geometryTriangles:85704,transition:'native-idle / authored-stomp / native-idle'};
   bridgePost('complete',{report});bridgeLive=false;paused=true;bridgeSettling=-1;
  }
  if(frameCount%6===0)readouts();
  frames++;if(now-fpsStart>1000){$('fps').textContent=Math.round(frames*1000/(now-fpsStart))+' fps';fpsStart=now;frames=0;}
 }
 requestAnimationFrame(animate);
}
// UI is active even if dependency loading fails, so help/reference remain available.
$('aboutBtn').onclick=()=>$('aboutDialog').showModal();$('referenceBtn').onclick=()=>{audio.pause();if(simulation?.running&&!paused)pauseToggle();$('referenceDialog').showModal();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('referenceDialog').addEventListener('close',()=>$('referenceVideo').pause());
$('retryBtn').onclick=()=>location.reload();
$('audioBtn').onclick=async()=>{try{if(!audio.ctx){await audio.unlock();audio.start();}else audio.mute(audio.enabled);$('audioBtn').textContent=audio.enabled?'聲音：開':'聲音：關';$('audioBtn').setAttribute('aria-pressed',audio.enabled);}catch(e){toast('無法開啟聲音：'+e.message);}};
for(const k of controls)$(k).addEventListener('input',()=>{outSettings();if(ready)rebuild();});
$('directedMode').onclick=()=>{mode='directed';updateMode();rebuild();};
$('physicsMode').onclick=()=>{mode='physics';updateMode();rebuild();};$('animationMode').onclick=()=>{mode='animation';updateMode();rebuild();};
$('stageReplay').onclick=()=>begin();$('startBtn').onclick=()=>begin();$('resetBtn').onclick=()=>rebuild();$('pauseBtn').onclick=pauseToggle;
$('stepBtn').onclick=()=>{if(paused&&simulation?.running){simulation.step();syncVisual(0);readouts();renderer.render(scene,camera);}};
$('speedBtn').onclick=()=>{rate=rate===1?.5:rate===.5?.25:1;$('speedBtn').textContent=rate+'×';};
$('debugBtn').onclick=()=>{debug=!debug;$('debugBtn').classList.toggle('active',debug);$('debugBtn').setAttribute('aria-pressed',debug);};
$('rigBtn').onclick=()=>{rig=!rig;$('rigBtn').classList.toggle('active',rig);$('rigBtn').setAttribute('aria-pressed',rig);};
$('sideView').onclick=()=>{inspectFocus='body';targetView={yaw:.03,pitch:.13,radius:inspectElephant?7:14};manualCamera=true;};$('topView').onclick=()=>{inspectFocus='body';targetView={yaw:.0,pitch:1.02,radius:inspectElephant?7.5:16};manualCamera=true;};
$('compareBtn').onclick=()=>{comparison={results:{}};rate=1;$('speedBtn').textContent='1×';mode='directed';updateMode();rebuild(false);begin(false);};
$('exportBtn').onclick=()=>{if(simulation)saveJSON({...simulation.report(),renderFrames:frameCount,discardedCatchupSeconds:dropped,wallPlaybackSeconds:playbackWallSeconds,cameraPreset,dramaticPacing,actingRefined,presence},'jungle-king-3d-trial.json');};$('exportCompare').onclick=()=>saveJSON(compareResults,'jungle-king-3d-comparison.json');
document.addEventListener('keydown',e=>{if(parent!==window)return;if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='Space'||e.code==='KeyP'){e.preventDefault();pauseToggle();}if(e.code==='KeyR')rebuild();});
document.addEventListener('visibilitychange',()=>{if(parent!==window)return;lastFrame=performance.now();accumulator=0;if(document.hidden&&simulation?.running&&!paused){paused=true;$('pauseBtn').textContent='繼續';$('stepBtn').disabled=false;audio.pause();}});
window.addEventListener('pagehide',()=>{audio.pause();});
let lastDiagnostics=null;
$('diagnosticBtn').onclick=async()=>{
 if(!ready)return;if(simulation?.running&&!paused)pauseToggle();
 const b=$('diagnosticBtn');b.disabled=true;$('diagnosticResult').hidden=false;
 try{lastDiagnostics=await runEngineDiagnostics(THREE,RAPIER,BattleSimulation,message=>{$('diagnosticResult').textContent='Running: '+message;},data.models,async()=>createCandidateAnimal(THREE,GLTFLoader,assets.candidateGLB,data.candidateRig));$('diagnosticResult').textContent=JSON.stringify(lastDiagnostics,null,2);$('diagnosticExport').disabled=false;}
 catch(e){$('diagnosticResult').textContent=String(e?.stack||e);}finally{b.disabled=false;}
};
$('diagnosticExport').onclick=()=>{if(lastDiagnostics)saveJSON(lastDiagnostics,'jungle-king-real-engine-checks.json');};
for(const p of ['cinematic','clay','debug'])$('view-'+p).onclick=()=>{if(ready)setPresentation(p);};
for(const p of ['prepare','drive','impact','recovery'])$('beat-'+p).onclick=()=>seekBeat(p);

function chooseCamera(p){
 cameraPreset=['director','continuous','fixed'].includes(p)?p:'director';manualCamera=false;
 for(const k of ['director','continuous','fixed']){
  $('camera-'+k).classList.toggle('active',cameraPreset===k);$('camera-'+k).setAttribute('aria-pressed',cameraPreset===k);
 }
 if(ready){syncVisual(0);renderer.render(scene,camera);}
}
for(const k of ['director','continuous','fixed'])$('camera-'+k).onclick=()=>chooseCamera(k);
$('filmPlay').onclick=()=>begin();
$('filmInspect').onclick=()=>cinemaView(false);
$('presenceToggle').onchange=e=>{presence=e.target.checked;lighting();rebuild();};
$('pacingToggle').onchange=e=>{dramaticPacing=e.target.checked;};
$('actingToggle').onchange=e=>{actingRefined=e.target.checked;if(ready)rebuild();};
function cinemaView(value){spectator=value;document.body.classList.toggle('spectator',value);$('filmStart').classList.toggle('hidden',!value||simulation?.time>0);$('cinemaBtn').setAttribute('aria-pressed',value);(value?$('exitCinema'):$('cinemaBtn')).focus();}
$('cinemaBtn').onclick=()=>cinemaView(!spectator);$('exitCinema').onclick=()=>cinemaView(false);
document.addEventListener('keydown',e=>{if(parent!==window)return;if(e.code==='Escape'&&spectator)cinemaView(false);});


function selectAttack(a){if(a!=='stomp'){toast('本次只接合已確認的重踏；其他動作尚未移植。');return;}attack='stomp';for(const key of Object.keys(ATTACKS)){$('attack-'+key).classList.toggle('active',key===attack);$('attack-'+key).setAttribute('aria-pressed',key===attack);}document.querySelector('.scene-heading h1').textContent=ATTACKS[attack].label;$('attackNote').textContent=ATTACKS[attack].subtitle;mode='directed';updateMode();rebuild();}
for(const key of Object.keys(ATTACKS))$('attack-'+key).onclick=()=>selectAttack(key);
$('modelView').onclick=()=>{if(!ready)return;if(!inspectElephant){sculptReview('body');return;}inspectElephant=false;studioLight=preReviewStudio;$('studioBtn').classList.toggle('active',studioLight);$('studioBtn').setAttribute('aria-pressed',String(studioLight));setPresentation('cinematic');$('modelView').classList.remove('active');manualCamera=false;syncVisual(0);renderer.render(scene,camera);};
$('frontView').onclick=()=>{inspectFocus='body';targetView={yaw:1.57,pitch:.10,radius:inspectElephant?7:13};manualCamera=true;};
$('studioBtn').onclick=()=>{studioLight=!studioLight;$('studioBtn').classList.toggle('active',studioLight);$('studioBtn').setAttribute('aria-pressed',String(studioLight));lighting();};

function selectModelVariant(v){
 modelVariant='candidate';
 for(const [id,key] of [['model-v07','baseline'],['model-v08','candidate']]){$(id).classList.toggle('active',modelVariant===key);$(id).setAttribute('aria-pressed',String(modelVariant===key));}
 if(ready){syncVisual(0);renderer.render(scene,camera);}
}
function sculptReview(focus='body'){
 if(!ready)return;
 if(simulation?.running&&!paused)pauseToggle();
 cinemaView(false);if(!inspectElephant)preReviewStudio=studioLight;inspectElephant=true;inspectFocus=focus;studioLight=true;
 $('studioBtn').classList.add('active');$('studioBtn').setAttribute('aria-pressed','true');
 setPresentation('clay');$('modelView').classList.add('active');
 targetView=focus==='head'?{yaw:.73,pitch:.085,radius:4.5}:{yaw:.55,pitch:.14,radius:9.8};
 manualCamera=true;lighting();syncVisual(0);renderer.render(scene,camera);
}
$('model-v07').onclick=()=>selectModelVariant('baseline');$('model-v08').onclick=()=>selectModelVariant('candidate');
$('sourceMaterials').onclick=()=>{if(!ready)return;const oldTarget={...targetView},oldView={...view};setPresentation(presentation==='clay'?'cinematic':'clay');targetView=oldTarget;view=oldView;manualCamera=true;syncVisual(0);renderer.render(scene,camera);};
$('sculpt-body').onclick=()=>sculptReview('body');$('sculpt-head').onclick=()=>sculptReview('head');
$('sculpt-neutral').onclick=()=>{if(!ready)return;rebuild();sculptReview('body');};
$('sculpt-raised').onclick=()=>{if(!ready)return;sculptReview('body');seekBeat('drive');};
$('saveFrame').onclick=()=>{if(!ready)return;renderer.render(scene,camera);const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='jungle-king-'+modelVariant+'-'+inspectFocus+'.png';a.click();};

outSettings();updateMode();
try{
 await imports();progress(55,'正在初始化 Rapier WebAssembly 與連續蒙皮模型。');await RAPIER.init();progress(65,'正在載入標準 GLB 匯入器（模型已內嵌，毋須手動匯入）。');
 ({GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js'));
 progress(78,'正在解析隨包模型與貼圖。');await setupScene();ready=true;rebuild();
 for(const id of ['startBtn','stageReplay','resetBtn','exportBtn','diagnosticBtn'])$(id).disabled=false;
 selectAttack('stomp');setPresentation('cinematic');progress(100);$('loading').classList.add('hidden');status('待命');fpsStart=performance.now();requestAnimationFrame(animate);
 window.__LAB_READY=true;selectModelVariant('candidate');inspectElephant=false;studioLight=false;cinemaView(true);$('filmStart').classList.add('hidden');setPresentation('cinematic');syncVisual(0);renderer.render(scene,camera);bridgeReady();
 // A local diagnostic surface, no networking or account access.
 window.LAB={selectModel:selectModelVariant,sculptReview,lookdev:()=>({version:'candidate-integration-01',modelVariant,vertices:{elephant:elephant.data.vertexCount,tiger:tiger.data.positions.length/3},studio:studioLight}),presence:v=>{presence=!!v;$('presenceToggle').checked=presence;lighting();rebuild();},cameraState:()=>({preset:cameraPreset,manual:manualCamera,shot:lastShot,position:camera.position.toArray(),target:cameraTarget.toArray(),fov:camera.fov,aspect:camera.aspect}),chooseCamera,cinemaView,acting:v=>{actingRefined=!!v;$('actingToggle').checked=actingRefined;rebuild();},versions:()=>({three:THREE.REVISION,rapier:RAPIER.version()}),report:()=>simulation.report(),poseInfo:()=>({elephantStage:elephant.stage,tigerStage:tiger.stage,clips:Object.keys(elephant.clips),bones:[elephant.bones.length,tiger.bones.length]}),seek:seekBeat,presentation:setPresentation,start:()=>begin(),reset:()=>rebuild(),pause:()=>{if(!paused)pauseToggle();},step:n=>{for(let i=0;i<n;i++)simulation.step();syncVisual(0);readouts();renderer.render(scene,camera);return simulation.report();},setSettings:s=>{if(s.attack)selectAttack(s.attack);mode='directed';for(const k of controls)if(k in s)$(k).value=s[k];outSettings();updateMode();rebuild();},attack:selectAttack,inspect:()=>{$('modelView').click();},screenshot:()=>renderer.domElement.toDataURL('image/png')};
}catch(e){window.__LAB_ERROR=String(e);errorScreen(e);}
