/* 山河獸影 — offline ink-comic Jungle game. 3D terrain, 2.5D painted animals. */
(()=>{
'use strict';
const R=createRules(),$=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const UNITS=[null,
 {name:'岩溪靈鼠',code:'八獸圖譜 · 鼠',type:'一階 · 水陸奇兵',attack:'靈鼠穿陣',quote:'一寸身軀，亦能撼動巨象。',desc:'唯一能進入河流的動物。陸地上可吃象；河中的鼠會阻擋獅虎跳躍。'},
 {name:'月影山貓',code:'八獸圖譜 · 貓',type:'二階 · 輕巧靈動',attack:'靈貓疾撲',quote:'伏於無聲，動若疾風。',desc:'可以吃貓、鼠。適合追捕敵鼠，或利用獸穴周邊的陷阱防守。'},
 {name:'護林獵犬',code:'八獸圖譜 · 狗',type:'三階 · 守土追獵',attack:'獵犬突襲',quote:'寸土不讓，寸步不退！',desc:'可以吃狗、貓、鼠。以陷阱為屏障，等待對手走入反擊範圍。'},
 {name:'疾風蒼狼',code:'八獸圖譜 · 狼',type:'四階 · 側翼追擊',attack:'蒼狼追獵',quote:'山風一起，獵影已至。',desc:'強於狗。沿中央陸路或兩側推進，牽制敵方較低階的動物。'},
 {name:'追影花豹',code:'八獸圖譜 · 豹',type:'五階 · 林間突襲',attack:'豹影閃擊',quote:'林影未動，利爪先至。',desc:'可以吃狼及以下等級。不能跳河，須循中央或兩側陸路進攻。'},
 {name:'伏山猛虎',code:'八獸圖譜 · 虎',type:'六階 · 越澗猛攻',attack:'猛虎躍澗',quote:'一躍過澗，虎嘯山河！',desc:'可橫向或直向跳河。跳躍路線若有任何一隻鼠，便不能跳過。'},
 {name:'金鬃雄獅',code:'八獸圖譜 · 獅',type:'七階 · 百獸爭鋒',attack:'猛獅撲擊',quote:'鬃動風生，獅威四野！',desc:'能跳河、能吃虎及以下等級。仍須避開巨象，以及敵方的陷阱。'},
 {name:'撼地巨象',code:'八獸圖譜 · 象',type:'八階 · 厚重壓陣',attack:'巨象撼地',quote:'踏步如雷，山河為震！',desc:'等級最高，卻不能吃鼠，並會被陸地上的鼠吃掉。不能入水或跳河。'}
];
const animalKeys=['','rat','cat','dog','wolf','leopard','tiger','lion','elephant'];
function portrait(rank=7,side=1){
 const key=rank===7?'lion-face':rank===8?'painted-elephant-portrait':animalKeys[rank];
 return `<img class="painted-animal painted-${rank}" src="${ART[key]}" alt="${UNITS[rank].name}" draggable="false">`;
}
const sound=new InkAudio();
const captureFoley=new CaptureFoley(sound);
let settings={difficulty:'normal',real3d:true,cinematic:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,sound:true,music:true,musicVolume:.48,sfxVolume:.72};
function loadJSON(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
const savedSettings=loadJSON('beast-ink.settings.v2');if(savedSettings&&typeof savedSettings==='object'){for(const k of ['cinematic','real3d','reduced','sound','music'])if(typeof savedSettings[k]==='boolean')settings[k]=savedSettings[k];if(['easy','normal','hard'].includes(savedSettings.difficulty))settings.difficulty=savedSettings.difficulty;}
for(const k of ['musicVolume','sfxVolume'])if(Number.isFinite(savedSettings?.[k]))settings[k]=clamp(savedSettings[k],0,1);
sound.configure(settings);
let saved=loadJSON('beast-ink.save.v2');if(saved&&(!R.validSaved(saved.state)||!Array.isArray(saved.logs)||!Array.isArray(saved.snapshots)))saved=null;
let state=R.initial(),selected=null,legal=[],hint=null,last=null,logs=[],snapshots=[],started=false,busy=false,motion=null,battle=null,training=null,epoch=0,worker=null,workerToken=0,workerPending=null,toastTimer=null,messageTimer=null,kbCursor=56,captureFX=null,hiddenAt=null;
let renderer;
let scenarioReturn=null,scenarioKind=7,lastCapture=null,pendingMove=null;
const capture=new CapturePresenter({
 begin:()=>{busy=true;sound.setBattle(true,8);updateHUD();},
 sound:(action,value)=>captureFoley.event(action,value),mix:value=>captureFoley.mix(value),
 pause:value=>{captureFoley.pause();sound.visibility(document.hidden||value);},
 end:()=>{captureFoley.pause();sound.visibility(document.hidden);sound.setBattle(false);},
 toggleSound:()=>{settings.sound=!settings.sound;updateSettings();captureFoley.bind();if(!settings.sound)captureFoley.pause();}
});
function saveCaptureReport(){
 const report={...capture.report(),chess:{ply:state.ply,turn:state.turn,key:R.key(state),pending:!!pendingMove},note:'Runtime capture reports are recorded only on this device. No upload.'};
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='jungle-king-capture-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function replayLastCapture(){if(!lastCapture||busy||battle||capture.active)return;const before=R.key(state),ply=state.ply;busy=true;updateHUD();try{await playBattle(lastCapture.attacker,lastCapture.defender,true);}finally{busy=false;updateHUD();}if(R.key(state)!==before||state.ply!==ply)throw Error('Replay must never change the board');}

try{renderer=new Beast3D.Renderer($('scene'),R);}catch(e){$('fatalText').textContent=String(e.message||e);$('fatal').classList.remove('hidden');return;}
$('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();$('fatalText').textContent='圖形處理器的連線中斷。棋局已自動儲存；重新載入本檔即可繼續。';$('fatal').classList.remove('hidden');});
function updateSettings(){
 $('real3d').checked=settings.real3d;capture.updateSound(settings.sound);$('difficulty').value=settings.difficulty;$('cinematic').checked=settings.cinematic;$('reduced').checked=settings.reduced;document.body.classList.toggle('reduced',settings.reduced);
 $('soundBtn').setAttribute('aria-pressed',String(settings.sound));$('soundBtn').innerHTML=`音效 <b>${settings.sound?'開':'關'}</b>`;
 $('musicBtn').setAttribute('aria-pressed',String(settings.music));$('musicBtn').innerHTML=`音樂 <b>${settings.music?'開':'關'}</b>`;$('audioMusicToggle').textContent=settings.music?'暫停配樂':'播放配樂';
 sound.configure(settings);
 for(const [id,key] of [['musicVolume','musicVolume'],['sfxVolume','sfxVolume']]){$(id).value=Math.round(settings[key]*100);$(id+'Value').textContent=Math.round(settings[key]*100)+'%';}
 store('beast-ink.settings.v2',settings);
}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2900);}
function floatMessage(text,duration=1200){$('floatingMessage').textContent=text;$('floatingMessage').classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('floatingMessage').classList.remove('show'),duration);}
function save(){if(!started||training||scenarioReturn||motion||battle||capture.active||pendingMove)return;store('beast-ink.save.v2',{version:1,state,logs:logs.slice(-120),snapshots:snapshots.slice(-32),last});}
function count(side){return state.board.filter(p=>p*side>0).length;}
function roster(side){return [8,7,6,5,4,3,2,1].map(r=>`<span class="${state.board.includes(side*r)?'':'lost'}">${R.NAMES[r]}</span>`).join('');}
function updateCard(p=selected!==null?state.board[selected]:7,inspect=false){
 const rank=Math.abs(p)||7,unit=UNITS[rank];$('unitPortrait').innerHTML=portrait(rank,Math.sign(p)||1);$('unitCode').textContent=selected===null&&!inspect?'八獸待命':unit.code;$('unitRank').textContent=['','一','二','三','四','五','六','七','八'][rank];
 $('unitClass').textContent=selected===null&&!inspect?'點選我方動物':`${p<0?'敵方動物':'我方動物'} / ${unit.type}`;
 $('unitName').textContent=selected===null&&!inspect?'八獸待命':unit.name;
 $('unitDesc').textContent=selected===null&&!inspect?'點選藍方動物，高亮格會顯示合法的移動與攻擊位置。':unit.desc;
 $('rankBars').innerHTML=Array.from({length:8},(_,i)=>`<i class="${i<rank?'active':''}"></i>`).join('');
}
function renderLogs(){
 $('log').innerHTML=logs.length?logs.slice(-30).reverse().map(e=>`<li><span class="log-turn">${String(e.ply).padStart(2,'0')}</span><span class="${e.side>0?'blue':'red'}">${e.side>0?'藍':'紅'}・${R.NAMES[e.rank]}</span><span>${R.coord(e.from)} → ${R.coord(e.to)}</span>${e.capture?`<span class="kill">擊破 ${R.NAMES[Math.abs(e.capture)]}</span>`:e.jump?'<span class="kill">躍河</span>':''}</li>`).join(''):'<li class="log-empty">對弈紀錄將顯示在這裡。</li>';
}
function updateHUD(){
 const turn=$('turnIndicator');turn.classList.toggle('enemy-turn',state.turn<0);
 turn.querySelector('span').textContent=!started?'靜候開局':training?training.complete?'訓練完成':'戰術訓練':state.result?'本局結束':(battle||capture.active)?'戰鬥演出':state.turn<0?'敵方 AI 思考中':'你的回合 · 藍方';
 $('roundLabel').textContent=`回合 ${String(Math.floor(state.ply/2)+1).padStart(2,'0')}`;
 $('enemyRoster').innerHTML=roster(-1);$('playerRoster').innerHTML=roster(1);$('enemyCount').textContent=`0${count(-1)} / 08`;$('playerCount').textContent=`0${count(1)} / 08`;
 $('hintBtn').disabled=!started||busy||!!state.result||state.turn!==1||training?.complete;
 $('undoBtn').disabled=!started||!snapshots.length||!!battle||capture.active||!!motion||!!training;
 $('demoBtn').disabled=busy||!!battle||capture.active||!!training;$('trainingBtn').disabled=busy||!!battle||capture.active||!!training;
 $('newBtn').disabled=!!battle||!!motion||!!training;$('scenarioBtn').disabled=busy||!!training||!!scenarioReturn;
 if(!state.result&&!training){
  $('tacticalStatus').querySelector('p').textContent=selected!==null?`${R.NAMES[Math.abs(state.board[selected])]}位於 ${R.coord(selected)}。${legal.length} 個合法落點${legal.some(m=>m.capture)?'，包含可擊破目標。':'。'}`:state.turn<0?'電腦正在比較走法與後續回應；你可以悔棋撤回上一手。':'獅虎跨越河流；鼠潛入水域。留意獸穴外的敵方陷阱。';
 }
 if(scenarioReturn){const elephant=scenarioKind===8;$('scenarioTitle').textContent=elephant?'巨象撼虎':'獅豹對決';$('scenarioInstruction').textContent=logs.some(e=>e.rank===scenarioKind&&Math.abs(e.capture)===(elephant?6:5))?'已破敵陣。繼續與電腦對弈，或返回原局。':elephant?'點選 D5 的藍象，再點 D6 的紅虎。':'點選 D5 的藍獅，再點 D6 的紅豹。';}
 $('elephantScenarioBtn').disabled=busy||!!training||!!scenarioReturn;
 $('replayCapture').disabled=!lastCapture||busy||!!battle||capture.active;
 $('captureReport').disabled=capture.active;
 $('real3d').disabled=busy;
 renderLogs();
}
function select(i){
 if(busy||state.result||state.turn!==1||!started||training?.complete)return;
 const p=state.board[i];
 if(p>0){selected=i;legal=R.movesFrom(state,i);hint=null;updateCard(p);updateHUD();sound.sfx('select');}
 else if(p<0){updateCard(p,true);toast(`敵方${UNITS[-p].name} · 等級 ${-p}`);}
 else {selected=null;legal=[];updateCard();updateHUD();}
}
function chooseCell(i){
 if(i<0||busy||!started||state.result||state.turn!==1||training?.complete)return;
 const m=legal.find(m=>m.to===i);
 if(m){if(training&&(m.from!==TRAINING[training.lesson].move.from||m.to!==TRAINING[training.lesson].move.to)){sound.sfx('error');toast(TRAINING[training.lesson].nudge);return;}doMove(m);}
 else if(state.board[i]>0)select(i);
 else if(state.board[i]<0&&selected!==null){updateCard(state.board[i],true);sound.sfx('error');toast('這個目標不能被所選動物捕獲。請檢查等級、岸線或陷阱。');}
 else select(i);
}
function cancelWorker(){workerToken++;if(worker){worker.terminate();worker=null;}const pending=workerPending;workerPending=null;if(pending)pending({move:null,cancelled:true});}
function getAnalysis(s,level){
 cancelWorker();const token=workerToken;
 return new Promise(resolve=>{
  workerPending=resolve;
  const done=data=>{if(token!==workerToken)return;workerPending=null;resolve(data);};
  try{
   const source=`const R=(${createRules.toString()})();const A=(${createAI.toString()})(R);self.onmessage=e=>{try{self.postMessage(A.choose(e.data.state,e.data.level,e.data.state.ply));}catch(error){self.postMessage({error:String(error)});}};`;
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);
   worker.onmessage=e=>{if(e.data.error){fallback();return;}done(e.data);};worker.onerror=e=>{e.preventDefault();fallback();};
   worker.postMessage({state:s,level});
  }catch{fallback();}
  function fallback(){if(token!==workerToken)return;setTimeout(()=>{if(token!==workerToken)return;try{const ai=createAI(R);done(ai.choose(s,'easy',s.ply));}catch(e){done({move:R.moves(s)[0]||null,error:String(e)});}},10);}
 });
}
async function computerTurn(){
 if(!started||training||state.result||state.turn!==-1||busy)return;
 const myEpoch=epoch,key=R.key(state);busy=true;updateHUD();
 const result=await getAnalysis(state,settings.difficulty);
 if(myEpoch!==epoch||key!==R.key(state))return;
 busy=false;$('aiStats').textContent=`搜尋 ${result.depth||0} 層 · ${(result.nodes||0).toLocaleString()} 節點`;
 if(result.move){await new Promise(r=>setTimeout(r,settings.reduced?40:250));if(myEpoch===epoch&&R.key(state)===key)doMove(result.move);}
 else {state={...state,result:{winner:1,reason:'immobile'}};updateHUD();showResult();}
}
async function getHint(){
 if(busy||state.turn!==1||state.result)return;
 if(training){hint=TRAINING[training.lesson].move;select(hint.from);hint=TRAINING[training.lesson].move;toast(TRAINING[training.lesson].nudge);return;}
 const myEpoch=epoch,k=R.key(state);busy=true;updateHUD();toast('正在計算戰術建議…');
 const result=await getAnalysis(state,'hint');if(myEpoch!==epoch||k!==R.key(state))return;busy=false;
 if(result.move){selected=result.move.from;legal=R.movesFrom(state,selected);hint=result.move;updateCard(state.board[selected]);toast(`建議：${R.NAMES[Math.abs(state.board[selected])]} ${R.coord(result.move.from)} → ${R.coord(result.move.to)}${result.move.capture?'，擊破'+R.NAMES[Math.abs(result.move.capture)]:''}`);}
 updateHUD();if(innerWidth<=800)$('arena').scrollIntoView({block:'start',behavior:'instant'});
}
function animateMove(m){
 return new Promise(resolve=>{motion={...m,start:performance.now()/1000,duration:settings.reduced?.13:m.jump?.70:m.capture?.65:.43,resolve};sound.sfx(m.jump?'jump':R.water(m.to)?'water':'move',Math.abs(state.board[m.from]));});
}
async function doMove(move){
 if(busy||pendingMove||state.result)return;
 const m=R.movesFrom(state,move.from).find(x=>x.to===move.to);if(!m)return;
 const myEpoch=epoch,before=state,p=state.board[m.from],captured=state.board[m.to];
 const snapshot={state:before,logs:logs.slice(),last};
 const ticket={epoch:myEpoch,before,move:m,committed:false};pendingMove=ticket;
 selected=null;legal=[];hint=null;busy=true;updateHUD();
 try{
  if(captured&&settings.cinematic)await playBattle(p,captured,false);
  else await animateMove(m);
 }catch(e){
  // Presentation exceptions cannot strand a legal chess move.
  capture.cancel();if(battle)endBattle();toast('演出未能完成，棋局繼續。');
 }
 if(myEpoch!==epoch||pendingMove!==ticket||state!==before||ticket.committed)return;
 ticket.committed=true;pendingMove=null;
 if(!training){snapshots.push(snapshot);if(snapshots.length>32)snapshots.shift();}
 state=R.apply(before,m);last=m;logs.push({ply:state.ply,side:Math.sign(p),rank:Math.abs(p),from:m.from,to:m.to,capture:captured,jump:m.jump});busy=false;
 if(captured)lastCapture={attacker:p,defender:captured};
 if(captured&&!settings.cinematic){sound.strike(Math.abs(p),true);captureFX={i:m.to,start:performance.now()/1000};}updateCard();updateHUD();
 if(training){training.complete=true;finishTrainingStep();return;}
 save();if(state.result){showResult();return;}
 if(state.turn===-1)computerTurn();else floatMessage('你的回合',850);
}
function advanceBattleClock(now=performance.now()/1000){
 if(!battle)return;const b=battle;if(!b.paused)b.elapsed+=Math.max(0,now-b.lastTick)*b.rate;b.lastTick=now;
}
function updatePlaybackControls(){
 if(!battle)return;$('pauseBattle').textContent=battle.paused?'繼續':'暫停';$('pauseBattle').setAttribute('aria-pressed',String(battle.paused));$('speedBattle').textContent=battle.rate===1?'1×':'0.5×';
}
function toggleBattlePause(){
 if(!battle)return;advanceBattleClock();battle.paused=!battle.paused;sound.setBattle(!battle.paused,Math.abs(battle.attacker));updatePlaybackControls();
}
function changeBattleSpeed(){
 if(!battle)return;advanceBattleClock();battle.rate=battle.rate===1?.5:1;updatePlaybackControls();
}
function seekPainting(seconds){
 if(!battle||!Number.isFinite(seconds))return;const b=battle;b.elapsed=clamp(seconds,0,b.length-.001);b.lastTick=performance.now()/1000;
 b.eventIndex=b.events.filter(e=>e.at<=b.elapsed).length;sound.setBattle(false);if(!b.paused)sound.setBattle(true,Math.abs(b.attacker));
}
async function playBattle(attacker,defender,demo=false){
 const captureEpoch=epoch;busy=true;
 if(CaptureContract.eligible(attacker,defender,settings)){
  await sound.unlock();
  // Do not let a denied audio context or decode failure block the chess action.
  if(sound.assetsPromise)await Promise.race([sound.assetsPromise.catch(()=>{}),new Promise(r=>setTimeout(r,1800))]);
  if(captureEpoch!==epoch)return;
  const result=await capture.play(attacker,defender,settings,demo);
  if(captureEpoch!==epoch||result.kind==='cancelled')return;
  if(result.kind!=='fallback'){busy=false;updateCard();updateHUD();return;}
  toast('即時 3D 未能完成，改用原畫演出；棋局不受影響。');busy=true;
 }
 return playPaintedBattle(attacker,defender,demo);
}
async function playPaintedBattle(attacker,defender,demo=false){
 const requestEpoch=epoch;busy=true;await sound.unlock();if(sound.assetsPromise)await Promise.race([sound.assetsPromise.catch(()=>{}),new Promise(r=>setTimeout(r,1800))]);if(epoch!==requestEpoch)return;
 return new Promise(resolve=>{
  busy=true;const rank=Math.abs(attacker),u=UNITS[rank],now=performance.now()/1000;
  battle={attacker,defender,start:now,lastTick:now,elapsed:0,rate:1,paused:false,resolve,demo,reduced:settings.reduced,
   variant:PaintedSequence.variant(attacker,defender),events:PaintedSequence.events(attacker,defender,settings.reduced),eventIndex:0,length:PaintedSequence.length(attacker,defender,settings.reduced)};
  sound.unlock();sound.setBattle(true,rank);
  updateCard(attacker,true);$('battlePortrait').innerHTML=portrait(rank,Math.sign(attacker));$('battleUnitCode').textContent=u.code;$('battleQuote').textContent=u.quote;$('attackName').textContent=u.attack+'！';
  $('impactWord').classList.remove('show');$('battleUI').classList.remove('charging');$('targetName').textContent=UNITS[Math.abs(defender)].name;
  $('battleWho').textContent=`${attacker>0?'藍方':'紅方'}・${R.NAMES[rank]}　對　${defender>0?'藍方':'紅方'}・${R.NAMES[Math.abs(defender)]}`;
  $('filmKind').textContent=battle.variant==='elephant-tiger'?'象・逐格原畫':battle.variant==='elephant-charge'?'象・逐格分鏡':battle.variant==='lion-leopard'?'逐格原畫':battle.variant==='lion-pounce'?'獅・逐格分鏡':'漫畫分鏡';
  $('battleUI').classList.toggle('painted-film',['lion-leopard','elephant-tiger'].includes(battle.variant));$('battleUI').classList.toggle('film-demo',demo);
  $('filmSeek').value=0;$('filmSeek').disabled=!demo;updatePlaybackControls();
  $('battleUI').classList.remove('hidden');document.body.classList.add('in-battle');if(innerWidth<=800)$('arena').scrollIntoView({block:'start',behavior:'instant'});updateHUD();
 });
}
function endBattle(){
 if(!battle)return;const b=battle;battle=null;sound.setBattle(false);$('battleUI').classList.add('hidden');$('battleUI').classList.remove('charging');document.body.classList.remove('in-battle');$('scene').style.transform='';$('impactFlash').style.opacity='0';$('impactWord').classList.remove('show');$('battleCutin').classList.remove('show');$('attackTitle').classList.remove('show');busy=false;b.resolve();updateCard();updateHUD();
}
async function demoBattle(fromIntro=false,chosenRank=null){
 if(busy||battle)return;sound.unlock();if(settings.music)sound.setMusic(true);const originalIntro=!$('intro').classList.contains('hidden');if(originalIntro)$('intro').classList.add('hidden');
 const rank=chosenRank||(fromIntro?7:Number($('demoAnimal').value)||7);const foe=[0,8,1,2,3,4,5,5,6][rank];await playBattle(rank,-foe,true);if(originalIntro)$('intro').classList.remove('hidden');updateHUD();
}
function startScenario(kind=7){
 kind=kind===8?8:7;scenarioKind=kind;
 if(busy||battle||training)return;save();scenarioReturn={state,logs:logs.slice(),snapshots:snapshots.slice(),last,started,showIntro:!$('intro').classList.contains('hidden')};resetTransient();
 state=R.initial();state.board=Array(63).fill(0);
 for(const [i,p]of [[31,7],[56,6],[42,8],[44,4],[46,5],[50,3],[54,2],[48,1],[24,-5],[0,-7],[6,-6],[8,-3],[12,-2],[14,-1],[18,-4],[20,-8]])state.board[i]=p;
 if(kind===8){state.board[31]=8;state.board[42]=6;state.board[56]=7;state.board[24]=-6;state.board[6]=-5;}
 state.history=[R.key(state)];logs=[];snapshots=[];last=null;started=true;$('intro').classList.add('hidden');$('scenarioBanner').classList.remove('hidden');
 renderer.yaw=0;renderer.elevation=1.08;renderer.zoom=1;sound.unlock();if(settings.music)sound.setMusic(true);selected=31;legal=R.movesFrom(state,31);hint={from:31,to:24};updateCard(kind);updateHUD();
 if(innerWidth<=800)$('arena').scrollIntoView({block:'start',behavior:'instant'});
}
function exitScenario(){
 if(!scenarioReturn)return;const back=scenarioReturn;resetTransient();scenarioReturn=null;state=back.state;logs=back.logs;snapshots=back.snapshots;last=back.last;started=back.started;
 $('scenarioBanner').classList.add('hidden');if(back.showIntro)$('intro').classList.remove('hidden');renderer.yaw=-.055;renderer.elevation=.90;renderer.zoom=1;updateCard();updateHUD();
 if(started&&!state.result&&state.turn===-1)computerTurn();
}
function showResult(){
 const r=state.result;if(!r)return;const win=r.winner===1,draw=r.winner===0;
 $('resultCode').textContent=draw?'山河一局 · 和':win?'山河一局 · 勝':'山河一局 · 敗';$('resultEmblem').textContent=draw?'和':win?'勝':'敗';$('resultEmblem').style.color=draw?'#a2c6d7':win?'#915032':'#754935';$('resultTitle').textContent=draw?'戰局平手':win?'攻勢得勝':'防線失守';
 const reasons={den:win?'你已攻入敵方獸穴，取得勝利。':'敵方已攻入你的獸穴。',elimination:win?'敵方動物全數被擊破。':'你的動物已全數被擊破。',immobile:win?'敵方已無合法走法。':'你已無合法走法。',repetition:'相同局面與輪次已出現三次。',quiet:'連續 100 手未發生捕獲，判定和局。'};
 $('resultReason').textContent=reasons[r.reason];$('resultSummary').textContent=`${state.ply} 手作戰 · 我方存活 ${count(1)} / 8 · 敵方存活 ${count(-1)} / 8`;
 $('tacticalStatus').querySelector('p').textContent=reasons[r.reason];
 if(!$('resultDialog').open)$('resultDialog').showModal();if(win)sound.sfx('win');save();
}
function resetTransient(){captureFX=null;epoch++;pendingMove=null;capture.cancel();cancelWorker();if(motion){const m=motion;motion=null;m.resolve();}if(battle)endBattle();busy=false;selected=null;legal=[];hint=null;for(const id of ['resultDialog','confirmDialog'])if($(id).open)$(id).close();}
function newGame(){
 lastCapture=null;
 scenarioReturn=null;$('scenarioBanner').classList.add('hidden');
 if(innerWidth<=800)window.scrollTo(0,0);resetTransient();training=null;$('trainingBanner').classList.add('hidden');state=R.initial();logs=[];snapshots=[];last=null;started=true;$('intro').classList.add('hidden');updateCard();updateHUD();save();floatMessage('入局對弈 · 藍方先行',1400);sound.unlock();sound.sfx('select');if(settings.music)sound.setMusic(true);$('scene').focus({preventScroll:true});
}
function resumeGame(){
 scenarioReturn=null;$('scenarioBanner').classList.add('hidden');
 if(!saved){newGame();return;}resetTransient();state=saved.state;logs=saved.logs.filter(e=>e&&Number.isInteger(e.ply)&&[1,-1].includes(e.side)&&Number.isInteger(e.rank)&&e.rank>=1&&e.rank<=8&&Number.isInteger(e.from)&&e.from>=0&&e.from<63&&Number.isInteger(e.to)&&e.to>=0&&e.to<63&&Number.isInteger(e.capture)&&Math.abs(e.capture)<=8).slice(-120);
 snapshots=saved.snapshots.filter(x=>x&&R.validSaved(x.state)&&Array.isArray(x.logs)).slice(-32);last=saved.last&&Number.isInteger(saved.last.from)&&Number.isInteger(saved.last.to)?saved.last:null;started=true;$('intro').classList.add('hidden');sound.unlock();if(settings.music)sound.setMusic(true);updateCard();updateHUD();if(state.result)showResult();else computerTurn();
}
function undo(){
 if(!snapshots.length||battle||motion||training)return;
 resetTransient();const n=state.turn===-1?1:Math.min(2,snapshots.length),idx=snapshots.length-n,snap=snapshots[idx];state=snap.state;logs=snap.logs.slice();last=snap.last;snapshots=snapshots.slice(0,idx);updateCard();updateHUD();save();toast(`已撤回 ${n} 手，輪到你重新部署。`);
}
const TRAINING=[
 {title:'01 / 最弱，擊破最強',desc:'點選藍方鼠，再點紅方象。陸地上的鼠可以吃象。',pieces:[[31,1],[24,-8],[56,7],[6,-6]],move:{from:31,to:24},nudge:'本課請用鼠從 D5 移至 D6，擊破巨象。'},
 {title:'02 / 躍過雙河防線',desc:'點選左側的虎，再點對岸的貓。獅虎能一次跨越河流。',pieces:[[21,6],[24,-2],[56,7],[6,-8]],move:{from:21,to:24},nudge:'本課請用虎從 A6 跳至 D6，擊破對岸的貓。'},
 {title:'03 / 一步決定勝負',desc:'點選獸穴前的貓，再點最上方的紅色獸穴。任何棋子都能攻陷獸穴。',pieces:[[10,2],[56,7],[20,-4]],move:{from:10,to:3},nudge:'本課請用貓從 D8 移至 D9，攻入敵方獸穴。'}
];
function startTraining(){
 if(busy||battle)return;if(innerWidth<=800)$('arena').scrollIntoView({block:'start',behavior:'instant'});const returnState={state,logs:logs.slice(),snapshots:snapshots.slice(),last,started};resetTransient();training={lesson:0,complete:false,returnState};started=true;$('intro').classList.add('hidden');sound.unlock();if(settings.music)sound.setMusic(true);loadTraining(0);
}
function loadTraining(index){
 resetTransient();training.lesson=index;training.complete=false;const b=Array(63).fill(0);TRAINING[index].pieces.forEach(([i,p])=>b[i]=p);state={board:b,turn:1,ply:0,quiet:0,history:[],result:null};state.history=[R.key(state)];last=null;logs=[];
 $('trainingTitle').textContent=TRAINING[index].title;$('trainingDesc').textContent=TRAINING[index].desc;$('trainingBanner').classList.remove('hidden');$('nextTraining')?.remove();$('exitTraining').textContent='離開訓練';
 $('tacticalStatus').querySelector('p').textContent=TRAINING[index].desc;updateCard();updateHUD();renderer.yaw=0;renderer.elevation=1.08;renderer.zoom=1;
}
function finishTrainingStep(){
 sound.sfx('win');$('trainingTitle').textContent='演練完成 · '+TRAINING[training.lesson].title.slice(5);$('trainingDesc').textContent=training.lesson<2?'已掌握這項規則。繼續下一個戰術演練。':'三項核心戰術已掌握。返回實戰，運用你的八獸陣法。';
 const b=document.createElement('button');b.id='nextTraining';b.className='small-btn training-next';b.textContent=training.lesson<2?'下一課 →':'返回實戰 →';b.onclick=()=>training.lesson<2?loadTraining(training.lesson+1):exitTraining();$('trainingBanner').appendChild(b);updateHUD();
}
function exitTraining(){
 if(busy||battle)return;const back=training.returnState;resetTransient();training=null;state=back.state;logs=back.logs;snapshots=back.snapshots;last=back.last;started=true;$('trainingBanner').classList.add('hidden');$('nextTraining')?.remove();renderer.yaw=-.12;renderer.elevation=.90;updateCard();updateHUD();save();if(state.result)showResult();else computerTurn();
}
// UI bindings; no host-account writes or external requests.
$('coverPainting').style.backgroundImage=`url("${ART['painted-cover']}")`;$('brushImpact').src=ART['capture-brush'];$('rankReference').innerHTML=[8,7,6,5,4,3,2,1].map(r=>`<div><b>${R.NAMES[r]}</b><small>${r} 階</small></div>`).join('');
$('startBtn').onclick=newGame;$('resumeBtn').onclick=resumeGame;if(saved){$('resumeBtn').classList.remove('hidden');$('startBtn').innerHTML='開始新棋局 <span>↗</span>';}
$('introDemo').onclick=()=>demoBattle(true);$('demoBtn').onclick=()=>demoBattle(false);$('introTraining').onclick=startTraining;$('trainingBtn').onclick=startTraining;$('exitTraining').onclick=exitTraining;
$('hintBtn').onclick=getHint;$('undoBtn').onclick=undo;
$('newBtn').onclick=()=>{if(!busy)$('confirmDialog').showModal();};$('confirmNew').onclick=newGame;
$('reviewBtn').onclick=()=>$('resultDialog').close();$('rematchBtn').onclick=newGame;
$('helpBtn').onclick=()=>{$('helpDialog').showModal();};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('replayCapture').onclick=replayLastCapture;$('captureReport').onclick=saveCaptureReport;
$('real3d').onchange=e=>{settings.real3d=e.target.checked;updateSettings();};
$('skipBattle').onclick=endBattle;$('pauseBattle').onclick=toggleBattlePause;$('speedBattle').onclick=changeBattleSpeed;
$('filmSeek').oninput=e=>{if(battle?.demo){seekPainting(Number(e.target.value)/1000*battle.length);if(!battle.paused)toggleBattlePause();}};
$('scenarioIntro').onclick=()=>startScenario(7);$('scenarioBtn').onclick=()=>startScenario(7);$('elephantIntro').onclick=()=>startScenario(8);$('elephantScenarioBtn').onclick=()=>startScenario(8);$('introElephantDemo').onclick=()=>demoBattle(true,8);$('exitScenario').onclick=exitScenario;
$('soundBtn').onclick=()=>{settings.sound=!settings.sound;sound.configure(settings);sound.unlock();sound.sfx('select');updateSettings();};
$('musicBtn').onclick=()=>{settings.music=!settings.music;sound.setMusic(settings.music);updateSettings();};
$('audioBtn').onclick=()=>{$('audioDialog').showModal();sound.unlock();};
for(const id of ['musicVolume','sfxVolume'])$(id).oninput=e=>{settings[id]=Number(e.target.value)/100;updateSettings();};
$('testSound').onclick=()=>{sound.unlock().then(()=>sound.strike(Number($('soundAnimal').value),true));};$('testAnimalCall').onclick=()=>{sound.unlock().then(()=>sound.sfx('call',Number($('soundAnimal').value)));};
$('audioMusicToggle').onclick=()=>{settings.music=!settings.music;sound.setMusic(settings.music);updateSettings();};
$('difficulty').onchange=e=>{settings.difficulty=e.target.value;updateSettings();toast('電腦戰力將於下一次搜尋生效。');};
$('cinematic').onchange=e=>{settings.cinematic=e.target.checked;updateSettings();};$('reduced').onchange=e=>{settings.reduced=e.target.checked;if(battle)endBattle();updateSettings();};
$('fullBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast('此瀏覽器不支援這個全螢幕操作。');}};
$('rotateLeft').onclick=()=>{renderer.yaw-=Math.PI/6;};$('rotateRight').onclick=()=>{renderer.yaw+=Math.PI/6;};$('viewBtn').onclick=()=>{const top=renderer.elevation<1.35;renderer.elevation=top?1.53:.90;renderer.yaw=top?0:-.12;$('viewBtn').textContent=top?'立體':'俯視';};$('resetCamera').onclick=()=>{renderer.yaw=-.12;renderer.elevation=.90;renderer.zoom=1;$('viewBtn').textContent='俯視';};
let drag=null;
$('scene').addEventListener('pointerdown',e=>{if(battle)return;drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};$('scene').setPointerCapture(e.pointerId);});
$('scene').addEventListener('pointermove',e=>{if(!drag||battle)return;const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)drag.moved=true;if(drag.moved){renderer.yaw-=dx*.009;renderer.elevation=clamp(renderer.elevation+dy*.006,.58,1.54);$('scene').classList.add('dragging');}drag.lastX=e.clientX;drag.lastY=e.clientY;});
$('scene').addEventListener('pointerup',e=>{if(!drag)return;const wasDrag=drag.moved;drag=null;$('scene').classList.remove('dragging');if(wasDrag||battle)return;const rect=$('scene').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const groundCell=renderer.pick(x,y);let picked=legal.some(m=>m.to===groundCell)?groundCell:(renderer.hitPiece?.(x,y)??-1),best=Infinity;
 // Hit-test the projected body as well as the ground tile, so tall heads are clickable.
 for(let i=0;i<63&&picked<0;i++)if(state.board[i]){const q=renderer.project([i%7-3,.66,(i/7|0)-4]),dist=Math.hypot(x-q.x,y-q.y),threshold=clamp(renderer.width/(renderer.halfW*2)*.34,10,30);if(dist<threshold&&dist<best){best=dist;picked=i;}}
 if(picked<0)picked=renderer.pick(x,y);kbCursor=picked<0?kbCursor:picked;chooseCell(picked);
});
$('scene').addEventListener('pointercancel',()=>{drag=null;$('scene').classList.remove('dragging');});
$('scene').addEventListener('wheel',e=>{e.preventDefault();renderer.zoom=clamp(renderer.zoom+e.deltaY*.0006,.73,1.48);},{passive:false});
$('scene').addEventListener('keydown',e=>{if(battle)return;const x=kbCursor%7,y=kbCursor/7|0;let n=kbCursor;if(e.key==='ArrowLeft')n=y*7+Math.max(0,x-1);else if(e.key==='ArrowRight')n=y*7+Math.min(6,x+1);else if(e.key==='ArrowUp')n=Math.max(0,y-1)*7+x;else if(e.key==='ArrowDown')n=Math.min(8,y+1)*7+x;else if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseCell(kbCursor);return;}else return;e.preventDefault();kbCursor=n;hint={from:n,to:n};toast(`游標 ${R.coord(n)}${state.board[n]?' · '+R.NAMES[Math.abs(state.board[n])]:R.water(n)?' · 水域':R.traps[n]?' · 陷阱':''}`);});
document.addEventListener('keydown',e=>{if(battle&&e.key.toLowerCase()==='p'){e.preventDefault();toggleBattlePause();}else if(battle&&(e.key===' '||e.key==='Escape')){e.preventDefault();endBattle();}else if(e.key==='Escape'&&!document.querySelector('dialog[open]')){selected=null;legal=[];hint=null;updateCard();updateHUD();}});
window.addEventListener('resize',()=>renderer.resize());new ResizeObserver(()=>renderer.resize()).observe($('arena'));
window.addEventListener('pagehide',()=>{save();sound.visibility(true);});
window.addEventListener('pageshow',()=>{if(!document.hidden)sound.visibility(capture.paused);});
document.addEventListener('visibilitychange',()=>{
 const now=performance.now()/1000;
 if(document.hidden){save();hiddenAt=now;}else if(hiddenAt!==null){const gap=now-hiddenAt;if(battle){battle.start+=gap;battle.lastTick=now;}if(motion)motion.start+=gap;if(captureFX)captureFX.start+=gap;hiddenAt=null;}
 sound.visibility(document.hidden||capture.paused);
});
// One reusable DOM label per physical piece; never use animal emoji as the 3D pieces.
const labels=new Map();for(const side of [1,-1])for(let r=1;r<=8;r++){const e=document.createElement('span');e.className='piece-label'+(side<0?' red':'');e.innerHTML=`${R.NAMES[r]}<small>${r}</small>`;$('pieceLabels').appendChild(e);labels.set(r*side,e);}
const coordinates=[];for(let x=0;x<7;x++){const e=document.createElement('span');e.className='coord-label';e.textContent='ABCDEFG'[x];$('boardCoords').appendChild(e);coordinates.push({e,p:[x-3,.02,4.65]});}for(let y=0;y<9;y++){const e=document.createElement('span');e.className='coord-label';e.textContent=9-y;$('boardCoords').appendChild(e);coordinates.push({e,p:[-3.62,.02,y-4]});}
let lastFrame=0,lastLabel=0;
function tick(ms){
 requestAnimationFrame(tick);if(document.hidden||capture.active||ms-lastFrame<23)return;lastFrame=ms;const time=ms/1000;
 if(motion&&time-motion.start>=motion.duration){const m=motion;motion=null;m.resolve();}
 if(battle){advanceBattleClock(time);const b=battle,t=b.elapsed,rank=Math.abs(b.attacker),f=PaintedSequence.info(b,t),age=t-f.hit;
  $('battleCutin').classList.remove('show');$('attackTitle').classList.toggle('show',!['lion-leopard','elephant-tiger'].includes(b.variant)&&t>.25);
  $('impactWord').classList.toggle('show',!['lion-leopard','elephant-tiger'].includes(b.variant)&&age>=.025&&age<(b.reduced?.70:1.25));
  $('battleUI').classList.remove('charging');$('impactFlash').style.opacity='0';
  while(!b.paused&&b.eventIndex<b.events.length&&t>=b.events[b.eventIndex].at){const e=b.events[b.eventIndex++];if(e.name==='impact')sound.strike(rank,true);else sound.sfx(e.name,rank);}
  $('combatTime').textContent=(b.paused?'暫停 · ':'')+f.phase;
  $('battleUI').querySelector('.energy-meter i').style.width=Math.min(100,t/b.length*100)+'%';$('filmSeek').value=Math.min(1000,Math.round(t/b.length*1000));
  if(t>=b.length)endBattle();
 }

 if(captureFX&&time-captureFX.start>1.1)captureFX=null;
 renderer.render(state,{time,selected,legal,last,hint,motion,battle,captureFX,reduced:battle?battle.reduced:settings.reduced});
 if(ms-lastLabel>33&&!battle){lastLabel=ms;for(const e of labels.values())e.style.display='none';for(let i=0;i<63;i++){const p=state.board[i];if(!p||motion?.from===i)continue;const e=labels.get(p),q=renderer.project([i%7-3,.10,(i/7|0)-4]);e.style.display='flex';e.style.left=q.x+'px';e.style.top=(q.y+12)+'px';e.classList.toggle('selected',selected===i);}for(const {e,p} of coordinates){const q=renderer.project(p);e.style.left=q.x+'px';e.style.top=(q.y+12)+'px';}}
}
updateSettings();updateCard();updateHUD();requestAnimationFrame(tick);
// Read-only inspection + narrowly scoped test hooks, enabled only with #test.
window.BeastGame={getState:()=>JSON.parse(JSON.stringify(state)),getUI:()=>({started,busy,selected,legal,hint,battle:!!battle,real3d:capture.active,pending:!!pendingMove,training:training?.lesson??null,scenario:!!scenarioReturn}),captureReport:()=>capture.report(),projectCell:i=>renderer.project([i%7-3,.02,(i/7|0)-4]),rules:R};
if(location.hash==='#test')Object.assign(window.BeastGame,{capture,replayLastCapture,newGame,undo,saveCaptureReport,setState:s=>{if(!R.validSaved(s))throw Error('Invalid test state');resetTransient();state=s;started=true;training=null;snapshots=[];logs=[];last=null;$('intro').classList.add('hidden');$('trainingBanner').classList.add('hidden');updateCard();updateHUD();},move:doMove,select,computerTurn,endBattle,settings,renderer,startTraining,exitTraining,loadTraining,sound,combat:InkCombat,
 getBattle:()=>battle?{rank:Math.abs(battle.attacker),defender:Math.abs(battle.defender),t:battle.elapsed,length:battle.length,eventIndex:battle.eventIndex,variant:battle.variant,paused:battle.paused,rate:battle.rate,frame:PaintedSequence.info(battle,battle.elapsed).index}:null,
 seekBattle:seekPainting,startScenario,exitScenario,playBattle,painted:PaintedSequence,
 testVisibility:hidden=>{capture.visibility(hidden);sound.visibility(hidden||capture.paused);}});
})();
