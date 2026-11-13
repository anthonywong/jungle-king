import {LabAudio} from './audio.mjs';
import {presenceAudioMix} from './presence.mjs';
/** Keeps the approved recording. Changes contrast and synchronization only. */
export class PresenceAudio extends LabAudio{
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
