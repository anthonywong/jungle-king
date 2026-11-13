/* Presentation state only. This component never modifies the chess position. */
(function(root){
'use strict';
const VERSION=1, CHANNEL='jungle-king.capture.v1';
class CaptureSession{
 constructor(id,token,{loadLimit=45000,runLimit=18000}={}){
  this.id=id;this.token=token;this.state='loading';this.paused=false;this.hidden=false;
  this.loadAge=0;this.runAge=0;this.loadLimit=loadLimit;this.runLimit=runLimit;
  this.outcome=null;this.report=null;this.events=[];this.started=false;
 }
 record(type,data={}){this.events.push({type,...data});if(this.events.length>90)this.events.shift();}
 accepts(m){return !!m&&m.channel===CHANNEL&&m.version===VERSION&&m.id===this.id&&m.token===this.token&&!this.outcome;}
 ready(){if(this.outcome||this.started)return false;this.state='ready';this.record('ready');return true;}
 start(){if(this.outcome||this.state!=='ready'||this.started)return false;this.started=true;this.state='playing';this.record('start');return true;}
 setPaused(v,why='manual'){if(this.outcome)return false;this.paused=!!v;this.record(this.paused?'pause':'resume',{why});return true;}
 advance(ms){
  if(this.outcome||this.paused||this.hidden)return null;
  if(!Number.isFinite(ms)||ms<0)return null;
  if(!this.started){this.loadAge+=ms;if(this.loadAge>=this.loadLimit)return this.finish('fallback','load-timeout');}
  else{this.runAge+=ms;if(this.runAge>=this.runLimit)return this.finish('fallback','playback-timeout');}
  return null;
 }
 finish(kind,reason,report=null){
  if(this.outcome)return null;
  if(!['complete','skip','fallback','cancelled'].includes(kind))throw Error('Invalid presentation result');
  this.state='settled';this.report=report;this.outcome={kind,reason,report};this.record('settle',{kind,reason});return this.outcome;
 }
}
function eligible(attacker,defender,settings){return Math.abs(attacker)===8&&Math.abs(defender)===6&&Math.sign(attacker)!==Math.sign(defender)&&!!settings.cinematic&&settings.real3d!==false&&!settings.reduced;}
function message(id,token,type,data={}){return {channel:CHANNEL,version:VERSION,id,token,type,...data};}
const api={CaptureSession,eligible,message,CHANNEL,VERSION};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CaptureContract=api;
})(typeof globalThis!=='undefined'?globalThis:this);
