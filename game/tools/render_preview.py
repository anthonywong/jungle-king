"""Create a preview from the actual game renderer and its Web Audio engine.
The art is advanced frame-by-frame for capture; this is not a screen/audio device recording.
"""
from pathlib import Path
import shutil,base64,wave,subprocess,json,math
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];frames=R/'preview-frames';frames.mkdir(exist_ok=True)
(R.parent/'checks').mkdir(exist_ok=True)
FPS=20
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
 p.evaluate("""()=>{location.hash='test';window.__store={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__store[k]??null,setItem:(k,v)=>__store[k]=String(v)}})}""")
 p.set_content((R.parent/'dist/index.html').read_text(),wait_until='load');p.wait_for_function('window.BeastGame?.renderer?.assetsReady');p.locator('#introElephantDemo').click();p.wait_for_function('BeastGame.getUI().battle');p.locator('#pauseBattle').click();length=p.evaluate('BeastGame.getBattle().length')
 for i in range(math.ceil((length+.5)*FPS)):
  t=min(length-.002,i/FPS)
  data=p.evaluate('''async t=>{BeastGame.seekBattle(t);await new Promise(r=>setTimeout(r,38));return document.querySelector('#scene').toDataURL('image/png').split(',')[1]}''',t)
  (frames/f'{i:04}.png').write_bytes(base64.b64decode(data))
 audio=p.evaluate('''async length=>{
  const c=new OfflineAudioContext(2,Math.ceil(32000*length),32000),s=new InkAudio({context:c,offline:true});await s.assetsPromise;
  s.configure({sound:true,musicVolume:.48,sfxVolume:.72});s.music=true;s.updateGains();s.startScore(0);s.setBattle(true,8);
  for(const e of PaintedSequence.events(8,-6))if(e.name==='impact')s.strike(8,true,.22,e.at);else s.sfx(e.name,8,e.at);
  const o=await c.startRendering(),pcm=new Int16Array(o.length*2);for(let i=0;i<o.length;i++)for(let ch=0;ch<2;ch++)pcm[i*2+ch]=Math.round(Math.max(-1,Math.min(1,o.getChannelData(ch)[i]))*32767);
  const bytes=new Uint8Array(pcm.buffer);let str='';for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(str);
 }''',length+.5)
 with wave.open(str(R/'audio/elephant-video-mix.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(32000);w.writeframes(base64.b64decode(audio))
 b.close()
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate',str(FPS),'-i',str(frames/'%04d.png'),'-i',str(R/'audio/elephant-video-mix.wav'),'-vf','scale=976:728:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',str(R.parent/'checks/jungle-king-elephant-preview.mp4')],check=True)
print('Created game-engine preview with synchronized audio.')
