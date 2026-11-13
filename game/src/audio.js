/* Original procedural score and foley. No samples, tracks, or network requests.
   Independent music/effect buses; user-gesture AudioContext; look-ahead scheduling.
   All frequencies and melodies below are an original pentatonic arrangement. */
class ProceduralAudio {
 constructor({context=null,offline=false}={}) {
  this.ctx=context;this.offline=offline;this._enabled=true;this.music=false;
  this.musicVolume=.48;this.sfxVolume=.72;this.timer=null;this.step=0;this.next=0;
  this.battle=false;this.rank=7;this.hidden=false;this.ready=false;this.failed=false;
  this.voices=new Set();this.battleVoices=new Set();this.voiceGains=new WeakMap();this.metrics={notes:0,effects:0,impacts:0};
  if(context)this.build();
 }
 get enabled(){return this._enabled;}
 set enabled(v){this._enabled=!!v;this.updateGains();}
 build(){
  if(this.ready)return;const c=this.ctx;
  this.master=c.createGain();this.master.gain.value=.68;
  this.compressor=c.createDynamicsCompressor();Object.assign(this.compressor.threshold,{value:-17});
  this.compressor.knee.value=18;this.compressor.ratio.value=3.5;this.compressor.attack.value=.004;this.compressor.release.value=.22;
  this.compressor.connect(this.master);this.master.connect(c.destination);
  this.musicIn=c.createGain();this.musicGain=c.createGain();this.sfxIn=c.createGain();this.sfxGain=c.createGain();
  this.musicIn.connect(this.musicGain);this.sfxIn.connect(this.sfxGain);
  this.musicGain.connect(this.compressor);this.sfxGain.connect(this.compressor);
  // Short acoustic-room tail, kept upstream of the corresponding mute/volume fader.
  const impulse=c.createBuffer(2,Math.floor(c.sampleRate*1.3),c.sampleRate);
  for(let ch=0;ch<2;ch++){const a=impulse.getChannelData(ch);let prev=0;for(let i=0;i<a.length;i++){prev=prev*.65+(Math.random()*2-1)*.35;a[i]=prev*Math.pow(1-i/a.length,3)*.42;}}
  for(const [input,out,level] of [[this.musicIn,this.musicGain,.18],[this.sfxIn,this.sfxGain,.065]]){
   const conv=c.createConvolver(),g=c.createGain();conv.buffer=impulse;g.gain.value=level;input.connect(conv);conv.connect(g);g.connect(out);
  }
  this.noiseBuffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const a=this.noiseBuffer.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
  this.ready=true;this.updateGains();
 }
 unlock(){
  try{if(this.offline)return Promise.resolve(true);if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C){this.failed=true;return Promise.resolve(false);}this.ctx=new C();this.build();}
   if(this.ctx.state==='suspended'||this.ctx.state==='interrupted'){const p=this.ctx.resume();return Promise.resolve(p).then(()=>true).catch(()=>{this.failed=true;return false;});}
   return Promise.resolve(true);
  }catch{this.failed=true;return Promise.resolve(false);}
 }
 ramp(param,value,seconds=.045){if(!this.ctx)return;const t=this.ctx.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(value,t,seconds);}
 updateGains(){if(!this.ready)return;this.ramp(this.musicGain.gain,this.music&&!this.hidden?this.musicVolume*(this.battle?.67:1):0);this.ramp(this.sfxGain.gain,this._enabled&&!this.hidden?this.sfxVolume:0,.012);}
 configure(cfg){if(typeof cfg.sound==='boolean')this._enabled=cfg.sound;for(const k of ['musicVolume','sfxVolume'])if(Number.isFinite(cfg[k]))this[k]=Math.max(0,Math.min(1,cfg[k]));this.updateGains();}
 track(source,nodes=[],battle=false){this.voices.add(source);const envelope=nodes.find(n=>n.gain);if(envelope)this.voiceGains.set(source,envelope.gain);if(battle)this.battleVoices.add(source);source.onended=()=>{this.voices.delete(source);this.battleVoices.delete(source);for(const n of [source,...nodes])try{n.disconnect();}catch{}};}
 route(g,bus='sfx',pan=0){const input=bus==='music'?this.musicIn:this.sfxIn;if(this.ctx.createStereoPanner){const p=this.ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));g.connect(p);p.connect(input);return p;}g.connect(input);return null;}
 tone(freq,duration=.2,type='sine',gain=.06,to=null,when=null,bus='sfx',pan=0,attack=.009){
  if(!this.ready||this.voices.size>180)return;const c=this.ctx,t=Math.max(c.currentTime,when??c.currentTime),o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(Math.max(15,freq),t);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(15,to),t+duration);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+Math.min(attack,duration*.35));g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);const p=this.route(g,bus,pan);this.track(o,p?[g,p]:[g],bus==='sfx'&&this.battle);o.start(t);o.stop(t+duration+.035);return o;
 }
 noise(duration=.2,gain=.06,filter=1400,when=null,bus='sfx',pan=0,type='lowpass',endFilter=null){
  if(!this.ready||this.voices.size>180)return;const c=this.ctx,t=Math.max(c.currentTime,when??c.currentTime),s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noiseBuffer;s.loop=true;f.type=type;f.frequency.setValueAtTime(filter,t);f.Q.value=.7;if(endFilter)f.frequency.exponentialRampToValueAtTime(endFilter,t+duration);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+Math.min(.035,duration*.3));g.gain.exponentialRampToValueAtTime(.0001,t+duration);s.connect(f);f.connect(g);const p=this.route(g,bus,pan);this.track(s,p?[f,g,p]:[f,g],bus==='sfx'&&this.battle);s.start(t);s.stop(t+duration+.04);return s;
 }
 pluck(freq,t,amp=.08,pan=0,bus='music'){
  // Inharmonic, decaying partials suggest a wooden plucked string, not an electronic lead.
  this.tone(freq,1.35,'sine',amp,null,t,bus,pan,.003);
  this.tone(freq*2.003,.56,'sine',amp*.42,null,t,bus,pan,.003);
  this.tone(freq*3.012,.27,'sine',amp*.18,null,t,bus,pan,.002);
  this.tone(freq*4.021,.14,'sine',amp*.07,null,t,bus,pan,.002);
 }
 flute(freq,t,duration=.65,amp=.035){this.tone(freq,duration,'sine',amp,null,t,'music',.22,.1);this.tone(freq*2,duration*.9,'sine',amp*.12,null,t,'music',.22,.11);this.noise(duration,amp*.14,2300,t,'music',.2,'bandpass');}
 drum(t,amp=.12,large=false,bus='music',pan=0){this.tone(large?92:175,large?.65:.23,'sine',amp,large?39:85,t,bus,pan,.003);this.tone(large?151:290,.19,'sine',amp*.3,large?85:170,t,bus,pan);this.noise(.11,amp*.26,large?950:2100,t,bus,pan);}
 scheduleStep(t,k){
  const bar=Math.floor(k/16)%8,slot=k%16,roots=[146.832,146.832,130.813,130.813,110,110,130.813,146.832],root=roots[bar];
  const melody=[[12,7,0,7,12,14,19,14],[12,7,14,12,7,0,7,12],[12,7,0,5,7,12,17,12],[7,5,0,7,12,7,5,0],[12,7,0,7,12,15,19,15],[12,7,15,12,7,0,7,12],[12,7,0,5,7,12,17,12],[14,12,7,0,7,12,14,12]][bar];
  if(slot%2===0){const n=melody[slot/2];this.pluck(root*2**(n/12),t,.068,slot%4===0?-.32:.28);this.metrics.notes++;}
  if(slot===0||slot===8){this.pluck(root*.5,t,.055,-.15);this.drum(t,this.battle?.15:.075,true);}
  if(slot===6||slot===14)this.drum(t,this.battle?.08:.035,false,'music',.28);
  if(!this.battle&&bar%2===1&&slot%4===0)this.flute(root*2**([19,17,14,12][slot/4]/12),t,.88,.026);
  if(this.battle){if(slot%2===1)this.drum(t,.045,false,'music',slot%4===1?-.4:.4);if(slot%4===2)this.pluck(root*2,t,.045,.35);}
 }
 pump(){if(!this.ready||!this.music||this.hidden)return;const t=this.ctx.currentTime;if(this.next<t-.2)this.next=t+.03;while(this.next<t+.14){this.scheduleStep(this.next,this.step++);this.next+=60/92/4;}}
 setMusic(on){this.music=!!on;if(on)this.unlock();this.updateGains();clearInterval(this.timer);this.timer=null;if(!on||!this.ready||this.offline||this.hidden)return;this.next=this.ctx.currentTime+.035;this.pump();this.timer=setInterval(()=>this.pump(),45);}
 setBattle(on,rank=7){this.battle=!!on;this.rank=rank;this.updateGains();if(!on){for(const s of this.battleVoices)try{const g=this.voiceGains.get(s);if(g)this.ramp(g,0,.007);s.stop(this.ctx.currentTime+.04);}catch{}this.battleVoices.clear();}}
 strike(rank=7,final=true,pan=.3){if(!this.enabled)return;this.unlock();if(!this.ready)return;const t=this.ctx.currentTime,weight=rank===8?1.25:rank<=2?.65:1;
  this.metrics.impacts++;this.drum(t,.30*weight,true,'sfx',pan);this.noise(.15,.19*weight,2000,t,'sfx',pan,'lowpass',400);this.noise(.38,.105*weight,600,t+.045,'sfx',pan);this.tone(185,.12,'triangle',.045,55,t,'sfx',pan);
  if(final){this.noise(.28,.065,3400,t+.055,'sfx',-.12,'highpass',850);this.tone(63,.68,'sine',.12*weight,27,t+.02,'sfx',0);this.pluck(293.664,t+.14,.055,-.2,'sfx');}
 }
 sfx(name,rank=7,when=null){if(!this.enabled)return;this.unlock();if(!this.ready)return;this.metrics.effects++;const t=Math.max(this.ctx.currentTime,when??this.ctx.currentTime);
  if(name==='select'){this.pluck(587.33,t,.045,0,'sfx');this.noise(.035,.025,800);}
  else if(name==='move'){this.drum(t,.075,false,'sfx',-.15);this.noise(.15,.045,650,t+.05);}
  else if(name==='jump'||name==='dash'){this.noise(.29,.13,380,t,'sfx',-.3,'bandpass',2100);this.noise(.21,.07,1900,t+.07,'sfx',.25);}
  else if(name==='water'){for(let i=0;i<4;i++){this.tone(500+i*160,.12,'sine',.025,120+i*80,t+i*.04,'sfx',i%2?.3:-.3);}this.noise(.3,.085,2600);}
  else if(name==='charge'){this.noise(.5,.055,350,t);this.drum(t,.13,true,'sfx',-.2);}
  else if(name==='step'){this.drum(t,rank===8?.16:.07,rank===8,'sfx',-.1);this.noise(.08,.03,800);}
  else if(name==='claw'){this.noise(.15,.14,3300,t,'sfx',.2,'bandpass',850);this.tone(145,.1,'triangle',.04,45,t);}
  else if(name==='call'){
   if(rank===1){this.tone(1300,.09,'sine',.035,780,t);this.tone(1580,.1,'sine',.028,950,t+.12);}
   else if(rank===8){this.tone(185,.45,'sawtooth',.018,280,t);this.tone(370,.42,'sine',.035,500,t);this.noise(.4,.035,900);}
   else{const f=rank>=6?71:rank>=3?125:260;for(let i=0;i<4;i++)this.tone(f*(1+i*.035),.54-i*.07,'sawtooth',.009,Math.max(38,f*.56),t+i*.045,'sfx',-.3);this.noise(.55,.075,rank>=6?430:920,t,'sfx',-.3,'bandpass');}
  }
  else if(name==='hit')this.strike(rank,true);
  else if(name==='land'){this.drum(t,rank===8?.21:.12,true,'sfx');this.noise(.3,.06,480);}
  else if(name==='win'){[293.664,391.995,440,587.33,783.99].forEach((n,i)=>this.pluck(n,t+i*.18,.10,0,'sfx'));this.drum(t+.72,.16,true,'sfx');}
  else if(name==='error')this.tone(125,.12,'triangle',.035,90);
 }
 visibility(hidden){this.hidden=!!hidden;clearInterval(this.timer);this.timer=null;this.updateGains();if(hidden){if(this.ctx&&!this.offline)this.ctx.suspend().catch(()=>{});}else if(this.ctx){this.unlock();if(this.music)this.setMusic(true);}}
 status(){return {context:this.ctx?.state||'locked',music:this.music,enabled:this.enabled,musicVolume:this.musicVolume,sfxVolume:this.sfxVolume,battle:this.battle,activeVoices:this.voices.size,failed:this.failed,...this.metrics};}
}


/* Mountain score: two pre-rendered, sample-aligned stems plus designed vocal
 * samples. Instrument metadata and the original composition live in /audio
 * and tools/compose_audio.py. No audio or art is fetched over the network.
 * The procedural engine above remains a graceful decode-failure fallback.
 */
class InkAudio extends ProceduralAudio {
 constructor(options={}){
  super(options);this.buffers=this.buffers||{};this.musicNodes=this.musicNodes||[];
  this.scoreOffset=this.scoreOffset||0;this.audioErrors=this.audioErrors||[];
 }
 build(){
  if(this.ready)return;super.build();
  this.musicDuck=this.ctx.createGain();this.musicDuck.gain.value=1;
  this.musicGain.disconnect();this.musicGain.connect(this.musicDuck);this.musicDuck.connect(this.compressor);
  this.prepareAssets();
 }
 prepareAssets(){
  if(this.assetsPromise)return this.assetsPromise;
  this.buffers={};this.musicNodes=[];this.audioErrors=[];this.scoreOffset=0;
  const data=typeof AUDIO_ART==='undefined'?{}:AUDIO_ART;
  this.assetsPromise=Promise.all(Object.entries(data).map(async([key,url])=>{
   try{const raw=atob(url.slice(url.indexOf(',')+1)),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    this.buffers[key]=await this.ctx.decodeAudioData(bytes.buffer);
   }catch(e){this.audioErrors.push(key+': '+String(e));}
  })).then(()=>{this.samplesReady=true;if(this.music&&!this.hidden)this.startScore();return this.audioErrors.length===0;});
  return this.assetsPromise;
 }
 updateGains(){
  super.updateGains();
  if(this.battleScoreGain)this.ramp(this.battleScoreGain.gain,this.battle?.90:.09,.15);
  if(this.baseScoreGain)this.ramp(this.baseScoreGain.gain,this.battle?.77:.95,.15);
 }
 startScore(when=null){
  if(!this.ready||!this.music||this.hidden||this.musicNodes?.length||!this.buffers?.['mountain-score'])return;
  const c=this.ctx,t=when===null?c.currentTime+.025:Math.max(c.currentTime,when);
  this.loopSeconds=Math.min(typeof SCORE_SECONDS==='number'?SCORE_SECONDS:58.1818125,this.buffers['mountain-score'].duration,this.buffers['mountain-battle']?.duration||Infinity);
  this.scoreOffset=(this.scoreOffset||0)%this.loopSeconds;this.scoreStartedAt=t-this.scoreOffset;
  for(const key of ['mountain-score','mountain-battle']){
   if(!this.buffers[key])continue;const s=c.createBufferSource(),g=c.createGain();s.buffer=this.buffers[key];s.loop=true;s.loopStart=0;s.loopEnd=this.loopSeconds;
   g.gain.value=key==='mountain-score'?(this.battle?.77:.95):(this.battle?.90:.09);
   s.connect(g);g.connect(this.musicIn);s.start(t,this.scoreOffset);
   s.onended=()=>{s.disconnect();g.disconnect();};this.musicNodes.push(s);
   if(key==='mountain-score')this.baseScoreGain=g;else this.battleScoreGain=g;
  }
 }
 stopScore(){
  if(this.musicNodes?.length){this.scoreOffset=Math.max(0,this.ctx.currentTime-this.scoreStartedAt)%this.loopSeconds;
   for(const s of this.musicNodes)try{s.stop(this.ctx.currentTime+.05);}catch{}this.musicNodes=[];
  }
 }
 pump(){
  if(this.samplesReady&&this.buffers?.['mountain-score']){this.startScore();return;}
  if(this.samplesReady)super.pump();
 }
 setMusic(on){
  this.music=!!on;this.updateGains();clearInterval(this.timer);this.timer=null;
  if(!on){this.stopScore();return;}
  this.unlock().then(()=>this.assetsPromise).then(()=>{
   if(!this.music||!this.ready||this.hidden)return;
   if(this.buffers['mountain-score'])this.startScore();else if(!this.offline){this.next=this.ctx.currentTime+.03;this.pump();this.timer=setInterval(()=>this.pump(),45);}
  }).catch(e=>{this.audioErrors?.push(String(e));});
 }
 duck(amount=.32,hold=.25,when=null){
  if(!this.musicDuck)return;const p=this.musicDuck.gain,t=Math.max(this.ctx.currentTime,when??this.ctx.currentTime);
  p.cancelScheduledValues(t);p.setValueAtTime(Math.max(.05,p.value),t);p.linearRampToValueAtTime(amount,t+.018);p.setValueAtTime(amount,t+hold);p.linearRampToValueAtTime(1,t+hold+.48);
 }
 setBattle(on,rank=7){
  super.setBattle(on,rank);
  if(!on&&this.musicDuck)this.ramp(this.musicDuck.gain,1,.045);
 }
 voice(rank,when=null,gain=.85,short=false,pan=-.16){
  const buffer=this.buffers?.['call-'+rank];if(!this.ready||!buffer)return false;
  const c=this.ctx,t=Math.max(c.currentTime,when??c.currentTime),s=c.createBufferSource(),g=c.createGain();s.buffer=buffer;
  const offset=short?buffer.duration*.27:0,length=short?Math.min(.50,buffer.duration*.65):buffer.duration;
  s.playbackRate.setValueAtTime(short?.91:1,t);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(gain,t+.025);g.gain.setValueAtTime(gain,t+Math.max(.03,length-.08));g.gain.linearRampToValueAtTime(.0001,t+length);
  s.connect(g);const p=this.route(g,'sfx',pan);this.track(s,p?[g,p]:[g],this.battle);s.start(t,offset,length);s.stop(t+length+.035);this.metrics.animalCalls=(this.metrics.animalCalls||0)+1;return true;
 }
 strike(rank=7,final=true,pan=.22,when=null){
  if(!this.enabled)return;this.unlock();if(!this.ready)return;const t=Math.max(this.ctx.currentTime,when??this.ctx.currentTime),heavy=rank===8,w=rank<=2?.65:heavy?1.22:1;
  this.metrics.impacts++;this.duck(.24,heavy?.36:.22,t);
  // Short contact crack + lower chest/ground impact + spreading debris.
  // Weight is in the low/mid transient, not a piercing electronic pitch sweep.
  this.noise(.055,.24*w,heavy?1850:2900,t,'sfx',pan,'lowpass',650);
  this.tone(heavy?88:127,heavy?.46:.25,'sine',.36*w,heavy?34:52,t,'sfx',pan,.002);
  this.tone(heavy?156:205,.15,'triangle',.10*w,75,t+.018,'sfx',pan,.003);
  this.noise(.32,.16*w,heavy?670:1100,t+.025,'sfx',pan,'lowpass',230);
  this.noise(.48,.08*w,2700,t+.065,'sfx',-.24,'bandpass',650);
  if(heavy){this.tone(43,.80,'sine',.18,25,t+.02,'sfx',0,.008);this.noise(.72,.09,130,t+.05,'sfx',0);}
  else this.voice(rank,t+.025,.34,true,.05);
  if(final){this.drum(t+.075,.13*w,true,'sfx',-.15);this.noise(.65,.035,750,t+.12,'sfx',.3);}
 }
 sfx(name,rank=7,when=null){
  if(!this.enabled)return;this.unlock();if(!this.ready)return;const t=Math.max(this.ctx.currentTime,when??this.ctx.currentTime);
  if(name==='call'){
   if(this.voice(rank,t,rank===8?.89:.78)){this.metrics.effects++;this.duck(.67,.32,t);return;}
  }
  if(name==='rumble'){
   this.metrics.effects++;this.tone(48,.62,'sine',.13,32,t,'sfx',-.17,.08);this.noise(.65,.09,145,t,'sfx',-.17,'bandpass');return;
  }
  if(name==='hit'){this.strike(rank,true,.22,t);return;}
  if(name==='step'&&rank===8){this.metrics.effects++;this.drum(t,.23,true,'sfx',-.20);this.noise(.18,.10,750,t+.025,'sfx',-.12);return;}
  if(name==='land'&&rank===8){this.metrics.effects++;this.drum(t,.22,true,'sfx',.12);this.noise(.45,.09,470,t+.04,'sfx',.15);return;}
  super.sfx(name,rank,when);
 }
 status(){return {...super.status(),sampledScore:!!this.buffers?.['mountain-score'],scorePlaying:!!this.musicNodes?.length,scorePhase:this.musicNodes?.length?Math.max(0,this.ctx.currentTime-this.scoreStartedAt)%this.loopSeconds:this.scoreOffset||0,samplesReady:!!this.samplesReady,animalVoiceCount:Object.keys(this.buffers||{}).filter(k=>k.startsWith('call-')).length,audioErrors:this.audioErrors||[]};}
}
if(typeof module!=='undefined')module.exports=InkAudio;
