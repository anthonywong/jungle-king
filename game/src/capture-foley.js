class LabAudio {
 constructor(assets){this.assets=assets;this.ctx=null;this.buffers={};this.enabled=false;this.music=null;this.battle=null;this.active=[];this.musicVolume=.30;this.fxVolume=.65;}
 async unlock(){
  if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=.7;this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-13;this.compressor.ratio.value=6;this.master.connect(this.compressor);this.compressor.connect(this.ctx.destination);}
  await this.ctx.resume();
  this.enabled=true;
  if(!this.music){this.music=new Audio(this.assets.music);this.music.loop=true;this.music.volume=this.musicVolume;this.music.preload='auto';}
  for(const [name,key] of [['elephant','call8'],['tiger','call6']])if(!this.buffers[name]){
   const b64=this.assets[key].split(',')[1],raw=atob(b64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));this.buffers[name]=await this.ctx.decodeAudioData(bytes.buffer);
  }
 }
 async start(){if(!this.enabled)return;try{await this.ctx.resume();this.music.volume=this.musicVolume;await this.music.play();}catch(e){console.warn('Audio requires a user gesture.',e);}}
 call(kind){if(!this.ctx||!this.enabled||!this.buffers[kind])return;const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.buffers[kind];g.gain.value=this.fxVolume*.75;s.connect(g);g.connect(this.master);s.start();this.active.push(s);s.onended=()=>{s.disconnect();g.disconnect();this.active=this.active.filter(x=>x!==s);};if(this.music)this.music.volume=this.musicVolume*.45;setTimeout(()=>{if(this.music&&this.enabled)this.music.volume=this.musicVolume;},900);}
 thump(power=.4){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime,g=this.ctx.createGain(),o=this.ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(84,t);o.frequency.exponentialRampToValueAtTime(32,t+.23);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(Math.max(.002,power*this.fxVolume),t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.32);o.connect(g);g.connect(this.master);this.active.push(o);o.start();o.stop(t+.34);o.onended=()=>{o.disconnect();g.disconnect();this.active=this.active.filter(x=>x!==o);};}
 impact(attack='drive'){this.thump(attack==='stomp'?1.12:.9);if(!this.ctx||!this.enabled)return;const c=this.ctx,len=Math.floor(c.sampleRate*.33),b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);let seed=431;for(let i=0;i<len;i++){seed=(seed*1664525+1013904223)>>>0;d[i]=((seed/4294967296)*2-1)*Math.exp(-i/(len*.17));}const s=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();s.buffer=b;f.type='lowpass';f.frequency.value=1700;g.gain.value=this.fxVolume*.75;s.connect(f);f.connect(g);g.connect(this.master);this.active.push(s);s.start();s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();this.active=this.active.filter(x=>x!==s);};this.call('tiger');}
 whoosh(attack='sweep'){
  if(!this.ctx||!this.enabled)return;const c=this.ctx,t=c.currentTime,len=Math.floor(c.sampleRate*.34),b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);let seed=731;
  for(let i=0;i<len;i++){seed=(seed*1664525+1013904223)>>>0;d[i]=(seed/4294967296*2-1)*Math.sin(Math.PI*i/len)**2;}
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='bandpass';f.Q.value=.7;f.frequency.setValueAtTime(attack==='sweep'?700:280,t);f.frequency.exponentialRampToValueAtTime(attack==='sweep'?2100:800,t+.23);g.gain.value=this.fxVolume*(attack==='sweep'?.35:.23);s.connect(f);f.connect(g);g.connect(this.master);s.start();this.active.push(s);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();this.active=this.active.filter(x=>x!==s);};
 }
 mute(v){this.enabled=!v;if(v){this.music?.pause();if(this.ctx)this.ctx.suspend();}else{this.ctx?.resume();this.start();}}
 pause(){this.music?.pause();for(const a of [...this.active])try{a.stop();}catch{} }
}

/** Keeps the approved recording. Changes contrast and synchronization only. */
class PresenceAudio extends LabAudio{
 constructor(assets){super(assets);this.presenceMode=true;this.duckUntil=0;}
 call(kind){
  if(!this.presenceMode)return super.call(kind);
  if(!this.ctx||!this.enabled||!this.buffers[kind])return;
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers[kind];gain.gain.value=this.fxVolume*.75;
  source.connect(gain);gain.connect(this.master);source.start();this.active.push(source);this.duckUntil=this.ctx.currentTime+.65;
  source.onended=()=>{source.disconnect();gain.disconnect();this.active=this.active.filter(x=>x!==source);};
 }
 sync(sim){
  if(!this.music||!this.enabled)return;
  if(!this.presenceMode)return;
  const mix=presenceAudioMix(sim),voice=this.ctx&&this.ctx.currentTime<this.duckUntil?.55:1;
  this.music.volume=Math.max(0,Math.min(1,this.musicVolume*Math.min(mix,voice)));
 }
 impact(attack='stomp'){
  super.impact(attack);if(!this.presenceMode||!this.ctx||!this.enabled)return;
  // A short dry transient adds definition, without raising the music/master.
  const c=this.ctx,t=c.currentTime,n=Math.floor(c.sampleRate*.13),buffer=c.createBuffer(1,n,c.sampleRate),d=buffer.getChannelData(0);let seed=1867;
  for(let i=0;i<n;i++){seed=(seed*1664525+1013904223)>>>0;d[i]=(seed/4294967296*2-1)*Math.exp(-i/(c.sampleRate*.020));}
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1300;filter.Q.value=.6;g.gain.value=this.fxVolume*.40;
  source.connect(filter);filter.connect(g);g.connect(this.master);source.start(t);this.active.push(source);
  source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();this.active=this.active.filter(x=>x!==source);};
 }
}

class CaptureFoley extends PresenceAudio{
 constructor(sound){super({});this.sound=sound;}
 bind(){this.ctx=this.sound.ctx;this.master=this.sound.sfxIn;this.buffers={elephant:this.sound.buffers?.['call-8'],tiger:this.sound.buffers?.['call-6']};this.enabled=this.sound.enabled&&this.sound.ready;this.fxVolume=.65;}
 event(action,value){this.bind();if(!this.enabled)return;
  if(action==='call'&&['elephant','tiger'].includes(value))this.call(value);
  if(action==='impact'&&value==='stomp'){this.impact(value);this.sound.metrics.impacts++;}
  if(action==='whoosh'&&value==='stomp')this.whoosh(value);
  if(action==='thump'&&Number.isFinite(value))this.thump(Math.max(0,Math.min(1.2,value)));
 }
 mix(value){if(!this.sound.musicDuck||!this.sound.ctx)return;const voice=this.sound.ctx.currentTime<this.duckUntil?.55:1;this.sound.ramp(this.sound.musicDuck.gain,Math.min(value,voice),.012);}
}
