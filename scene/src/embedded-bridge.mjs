/* Host protocol. Only presentation evidence crosses this boundary; no board state writes. */
const CAPTURE_CHANNEL='jungle-king.capture.v1';
let bridgeTicket=null,bridgeLive=false,bridgeBooted=false,bridgeStartedId=null,bridgeSettling=-1;
let bridgeFrames=0,bridgeSeconds=0,bridgeStartWall=0;
function bridgePost(type,extra={}){
 if(!bridgeTicket)return;
 parent.postMessage({channel:CAPTURE_CHANNEL,version:1,id:bridgeTicket.id,token:bridgeTicket.token,type,...extra},'*');
}
class CaptureRemoteAudio{
 constructor(){this.ctx={};this.enabled=true;this.presenceMode=true;this.music=null;this.lastMix=-1;}
 async unlock(){return true;}start(){}pause(){}mute(){}
 call(kind){if(bridgeLive)bridgePost('sound',{action:'call',value:kind});}
 thump(power){if(bridgeLive)bridgePost('sound',{action:'thump',value:power});}
 impact(attack){if(bridgeLive)bridgePost('sound',{action:'impact',value:attack});}
 whoosh(attack){if(bridgeLive)bridgePost('sound',{action:'whoosh',value:attack});}
 sync(sim){const value=presenceAudioMix(sim);if(bridgeLive&&Math.abs(value-this.lastMix)>.015){this.lastMix=value;bridgePost('mix',{value});}}
}
function bridgeReady(){bridgeBooted=true;bridgePost('ready');}
function bridgeFail(reason){bridgeLive=false;bridgePost('error',{reason:String(reason)});}
function bridgeControl(event){
 if(event.source!==parent)return;const m=event.data;
 if(!m||m.channel!==CAPTURE_CHANNEL||m.version!==1||typeof m.token!=='string'||m.token.length>200||!Number.isSafeInteger(m.id))return;
 if(m.type==='init'){
  if(bridgeLive)return;
  bridgeTicket={id:m.id,token:m.token};bridgeStartedId=null;
  if(bridgeBooted)bridgePost('ready');return;
 }
 if(!bridgeTicket||m.id!==bridgeTicket.id||m.token!==bridgeTicket.token)return;
 if(m.type==='start'&&ready&&bridgeStartedId!==m.id){
  bridgeStartedId=m.id;bridgeLive=true;bridgeSettling=-1;bridgeFrames=0;bridgeSeconds=0;bridgeStartWall=performance.now();
  // Use the accepted encounter settings; gameplay does not expose laboratory offsets.
  $('distance').value='6.4';$('angle').value='0';$('offset').value='0';$('speed').value='3.6';
  mode='directed';attack='stomp';presence=true;actingRefined=true;dramaticPacing=true;
  inspectElephant=false;studioLight=false;cameraPreset='director';rate=1;
  rebuild();setPresentation('cinematic');cinemaView(true);begin();
  if(m.paused){paused=true;accumulator=0;}
  lastFrame=performance.now();bridgePost('started');
 }else if(m.type==='pause'&&bridgeLive){paused=!!m.paused;lastFrame=performance.now();accumulator=0;}
 else if(m.type==='stop'){bridgeLive=false;bridgeSettling=-1;paused=true;if(simulation)simulation.running=false;accumulator=0;}
}
window.addEventListener('message',bridgeControl);
window.addEventListener('error',e=>{if(bridgeTicket)bridgeFail(e.message||'scene-exception');});
window.addEventListener('unhandledrejection',e=>{if(bridgeTicket)bridgeFail(e.reason?.message||'scene-promise-rejection');});
document.addEventListener('keydown',e=>{
 if(!bridgeLive)return;
 if(e.code==='Escape'||e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();bridgePost('request-skip');}
 if(e.code==='KeyP'){e.preventDefault();e.stopImmediatePropagation();bridgePost('request-pause');}
},true);
parent.postMessage({channel:CAPTURE_CHANNEL,version:1,type:'hello'},'*');
