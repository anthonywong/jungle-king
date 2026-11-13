/* Local trusted frame. postMessage is source- and per-session-token checked,
   including when index.html is opened via file:// (opaque origin). */
class CapturePresenter{
 constructor(hooks={}){
  this.hooks=hooks;this.serial=0;this.session=null;this.history=[];this.lastReport=null;
  this.frame=document.getElementById('captureFrame');this.shell=document.getElementById('captureLayer');
  this.clock=()=>performance.now();this.previous=this.clock();this.lastStatus='';this._resolve=null;
  window.addEventListener('message',e=>this.receive(e));
  document.getElementById('captureSkip').onclick=()=>this.finish('skip','user-skip');
  document.getElementById('captureFallback').onclick=()=>this.finish('fallback','requested-painted');
  document.getElementById('capturePause').onclick=()=>this.pause(!this.session?.paused,'manual');
  document.getElementById('captureSound').onclick=()=>this.hooks.toggleSound?.();
  this.timer=setInterval(()=>this.tick(),100);
  document.addEventListener('visibilitychange',()=>this.visibility(document.hidden));
  document.addEventListener('keydown',e=>{
   if(!this.active)return;
   if(e.code==='Escape'||e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();this.finish('skip','keyboard-skip');}
   else if(e.code==='KeyP'){e.preventDefault();e.stopImmediatePropagation();this.pause(!this.paused,'keyboard');}
   else if(e.code==='Tab'){const buttons=[...this.shell.querySelectorAll('button')].filter(b=>!b.disabled);if(!buttons.length)return;
    const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  },true);
 }
 get active(){return !!this.session&&!this.session.outcome;}
 get paused(){return this.active&&this.session.paused;}
 nonce(){const bytes=new Uint32Array(4);if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);else for(let i=0;i<4;i++)bytes[i]=Math.random()*0xffffffff;return [...bytes].map(n=>n.toString(16)).join('-');}
 send(type,data={}){const s=this.session;if(s&&this.frame.contentWindow)this.frame.contentWindow.postMessage(CaptureContract.message(s.id,s.token,type,data),'*');}
 play(attacker,defender,settings,demo=false){
  if(this.active)return Promise.reject(new Error('A capture presentation is already active'));
  const s=this.session=new CaptureContract.CaptureSession(++this.serial,this.nonce());
  this.args={attacker,defender,settings:{...settings},demo};this.previous=this.clock();this.lastStatus='';
  this.focusBefore=document.activeElement;this.shell.classList.add('active');this.shell.setAttribute('aria-hidden','false');this.shell.inert=false;
  document.getElementById('app').inert=true;document.body.classList.add('capture-3d-active');
  document.getElementById('captureWho').textContent=(demo?'演出重播 · ':attacker>0?'藍方 · ':'紅方 · ')+'巨象撼虎';
  document.getElementById('captureLoading').classList.remove('hidden');document.getElementById('capturePause').disabled=true;
  document.getElementById('capturePause').textContent='暫停 / P';document.getElementById('captureSkip').focus();
  this.status('載入即時戰鬥 · 棋局已鎖定，可隨時跳過');this.hooks.begin?.(this.args);this.updateSound(settings.sound);
  const p=new Promise(resolve=>this._resolve=resolve);
  try{
   if(this.testMode==='fail-load')queueMicrotask(()=>this.finish('fallback','test-forced-load-failure'));
   else if(!this.frame.getAttribute('src'))this.frame.src='battle.html#embedded';
   else this.send('init',{...this.args});
  }catch(e){this.finish('fallback','frame-start-error');}
  if(document.hidden)this.visibility(true);
  return p;
 }
 receive(e){
  if(e.source!==this.frame.contentWindow||!this.active)return;
  const m=e.data,s=this.session;if(!m||m.channel!==CaptureContract.CHANNEL||m.version!==CaptureContract.VERSION)return;
  if(m.type==='hello'){this.send('init',{...this.args});return;}
  if(!s.accepts(m))return;
  if(m.type==='ready'){
   if(s.ready()&&s.start()){
    this.send('start',{paused:s.paused||document.hidden});this.status(s.paused?'已暫停 · 按繼續播放':'巨象撼虎 · 即時演算');
    document.getElementById('capturePause').disabled=false;
   }
  }else if(m.type==='started'){
   document.getElementById('captureLoading').classList.add('hidden');s.record('started');this.hooks.started?.();
  }else if(m.type==='progress')this.status('載入中 · '+String(m.label||'').slice(0,100));
  else if(m.type==='phase'&&!s.paused)this.status(String(m.label||'巨象撼虎').slice(0,80));
  else if(m.type==='sound'&&s.started&&!s.paused&&!document.hidden)this.hooks.sound?.(m.action,m.value);
  else if(m.type==='mix'&&s.started&&!s.paused&&!document.hidden&&Number.isFinite(m.value))this.hooks.mix?.(Math.max(0,Math.min(1,m.value)));
  else if(m.type==='contact'){s.record('contact',{time:m.time});}
  else if(m.type==='complete'){
   // Physics is presentation only: a scene miss falls back instead of cancelling a legal chess move.
   if(m.report?.contact===true&&m.report?.contactCount===1)this.finish('complete','3d-complete',m.report);
   else this.finish('fallback','no-confirmed-contact',m.report);
  }else if(m.type==='error')this.finish('fallback',String(m.reason||'scene-error').slice(0,140));
  else if(m.type==='request-skip')this.finish('skip','frame-keyboard-skip');
  else if(m.type==='request-pause')this.pause(!s.paused,'frame-keyboard');
 }
 pause(v,why='manual'){
  if(!this.active)return;const s=this.session;s.setPaused(v,why);this.previous=this.clock();
  this.send('pause',{paused:s.paused});this.hooks.pause?.(s.paused);
  document.getElementById('capturePause').textContent=s.paused?'繼續 / P':'暫停 / P';
  this.status(s.paused?(why==='hidden'?'切換分頁後已暫停 · 按繼續播放':'演出暫停 · 按繼續播放'):'巨象撼虎 · 即時演算');
 }
 visibility(hidden){if(!this.active)return;this.session.hidden=!!hidden;this.previous=this.clock();if(hidden)this.pause(true,'hidden');}
 tick(){const now=this.clock(),dt=now-this.previous;this.previous=now;if(!this.active)return;const s=this.session;
  // Recover a timed-out or crashed child without a stuck game or a second commit.
  const outcome=s.advance(dt);if(outcome)this.finish(outcome.kind,outcome.reason,outcome.report,true);
 }
 status(text){if(text===this.lastStatus)return;this.lastStatus=text;document.getElementById('captureStatus').textContent=text;}
 updateSound(on){document.getElementById('captureSound').textContent=on?'獸鳴：開':'獸鳴：關';document.getElementById('captureSound').setAttribute('aria-pressed',String(!!on));}
 finish(kind,reason,report=null,alreadySettled=false){
  const s=this.session;if(!s||(!alreadySettled&&s.outcome))return;
  const result=alreadySettled?s.outcome:s.finish(kind,reason,report);if(!result||!this._resolve)return;
  this.send('stop');const resolve=this._resolve;this._resolve=null;
  if(kind==='fallback'||!s.started){this.frame.removeAttribute('src');this.frame.src='about:blank';this.frame.removeAttribute('src');}
  this.shell.classList.remove('active');this.shell.setAttribute('aria-hidden','true');this.shell.inert=true;
  document.getElementById('app').inert=false;document.body.classList.remove('capture-3d-active');
  this.lastReport={id:s.id,attacker:this.args.attacker,defender:this.args.defender,demo:this.args.demo,...result,events:s.events,loadMilliseconds:s.loadAge,playMilliseconds:s.runAge};
  this.history.push(this.lastReport);if(this.history.length>20)this.history.shift();
  this.hooks.end?.(result);if(this.focusBefore?.isConnected)this.focusBefore.focus({preventScroll:true});
  resolve(result);
 }
 cancel(){this.finish('cancelled','scene-reset');}
 report(){return {version:'capture-loop-01',active:this.active,paused:this.paused,history:JSON.parse(JSON.stringify(this.history))};}
}
