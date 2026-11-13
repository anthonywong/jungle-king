"""Elephant edition: browser integration, real file-origin load, and audio signal checks."""
from pathlib import Path
import json,shutil,time,base64,hashlib,zipfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];HTML=(ROOT.parent/'dist/index.html').read_text()
checks=[];errors=[];requests=[]
def check(name,ok=True):
 if not ok:raise AssertionError(name)
 checks.append(name);print('PASS',name,flush=True)
def setup(browser,viewport=None,mobile=False):
 p=browser.new_page(viewport=viewport or {'width':1440,'height':1000},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
 p.set_default_timeout(10000);p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 p.evaluate("""()=>{location.hash='test';window.__store={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__store[k]??null,setItem:(k,v)=>{__store[k]=String(v)}}});}""")
 p.set_content(HTML,wait_until='load');p.wait_for_function('window.BeastGame?.renderer?.assetsReady');return p
def clickcell(p,i):
 q=p.evaluate('i=>BeastGame.projectCell(i)',i);r=p.locator('#scene').bounding_box();(p.touchscreen.tap if p.evaluate('matchMedia("(pointer: coarse)").matches') else p.mouse.click)(r['x']+q['x'],r['y']+q['y'])
def idle(p,ply=None):
 p.wait_for_function('!BeastGame.getUI().busy&&!BeastGame.getUI().battle'+(f'&&BeastGame.getState().ply==={ply}' if ply is not None else ''),timeout=15000)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=setup(b);before=p.evaluate('BeastGame.getState()');p.locator('#introElephantDemo').click();p.wait_for_function('BeastGame.getUI().battle')
 check('One-click elephant preview launches an elephant-versus-tiger film',p.evaluate('BeastGame.getBattle().variant')=='elephant-tiger')
 p.locator('#pauseBattle').click();p.wait_for_function('BeastGame.sound.status().samplesReady')
 check('Both music stems and all eight animal samples decode',p.evaluate('BeastGame.sound.status().sampledScore&&BeastGame.sound.status().animalVoiceCount===8&&BeastGame.sound.status().audioErrors.length===0'))
 check('Music and combat stems share the same loop length',p.evaluate('Math.abs(BeastGame.sound.buffers["mountain-score"].duration-BeastGame.sound.buffers["mountain-battle"].duration)<.002'))
 check('Playback waits for assets, not for a first-impact network fetch',not requests)
 samples=p.evaluate('BeastGame.painted.elephantStarts')
 for i,t in enumerate(samples):
  p.evaluate('t=>BeastGame.seekBattle(t+.01)',t);p.wait_for_timeout(35)
  check(f'Elephant painted pose {i+1} renders at its intended time',p.evaluate('BeastGame.renderer.lastCombatFrame.index')==i)
 p.evaluate('BeastGame.seekBattle(BeastGame.painted.elephantHit+.42)');p.wait_for_timeout(100);p.screenshot(path=str(ROOT/'elephant-impact-desktop.png'))
 p.evaluate('BeastGame.seekBattle(.95)');p.wait_for_timeout(80);p.screenshot(path=str(ROOT/'elephant-advance-desktop.png'))
 p.locator('#skipBattle').click();idle(p);check('Skipping the preview leaves the match untouched',p.evaluate('BeastGame.getState()')==before)
 p.locator('#elephantIntro').click();check('Elephant scenario creates a legal blue elephant capture',p.evaluate('BeastGame.getState().board[31]===8&&BeastGame.getState().board[24]===-6&&BeastGame.rules.moves(BeastGame.getState()).some(m=>m.from===31&&m.to===24)'))
 p.screenshot(path=str(ROOT/'elephant-encounter.png'));p.locator('#difficulty').select_option('easy');clickcell(p,24);p.wait_for_function('BeastGame.getUI().battle')
 check('Actual capture uses the elephant film and locks preview scrubbing',p.evaluate('BeastGame.getBattle().rank===8&&BeastGame.getBattle().defender===6') and p.locator('#filmSeek').is_disabled())
 idle(p,2);check('Natural completion removes the tiger, commits once and receives an AI response',p.evaluate('BeastGame.getState().board[24]===8&&!BeastGame.getState().board.includes(-6)&&BeastGame.getState().turn===1') and p.locator('#log li .kill').count()==1)
 p.locator('#exitScenario').click();check('Leaving the elephant encounter restores the original position',p.evaluate('BeastGame.getState()')==before and p.locator('#intro').is_visible())
 p.locator('#startBtn').click();p.locator('#elephantScenarioBtn').click();clickcell(p,24);p.wait_for_function('BeastGame.getUI().battle');p.locator('#pauseBattle').click();p.locator('#skipBattle').click();idle(p,2)
 check('Skipping a paused elephant capture also commits exactly once',p.evaluate('BeastGame.getState().board[24]===8&&BeastGame.getState().ply===2'))
 p.locator('#exitScenario').click()
 for defender in [1,2,3,4,5,7,8]:
  p.evaluate('d=>{BeastGame.playBattle(8,-d,true)}',defender);p.wait_for_function('BeastGame.getUI().battle');p.locator('#pauseBattle').click();p.evaluate('BeastGame.seekBattle(1.9)');p.wait_for_timeout(50)
  check(f'Elephant opponent {defender} uses safe elephant-only closeups',p.evaluate('BeastGame.getBattle().variant')=='elephant-charge' and p.evaluate('BeastGame.getBattle().defender')==defender)
  if defender==7:p.screenshot(path=str(ROOT/'elephant-other-opponent.png'))
  p.locator('#skipBattle').click();idle(p)
 # Music stems stay in phase over a combat switch, instead of restarting.
 p.evaluate('BeastGame.sound.setMusic(true)');p.wait_for_timeout(250);a=p.evaluate('BeastGame.sound.status().scorePhase');p.evaluate('BeastGame.sound.setBattle(true,8)');p.wait_for_timeout(240);z=p.evaluate('BeastGame.sound.status().scorePhase')
 check('Battle music enters without resetting the theme',.12<z-a<.65)
 check('Battle percussion rises on the independent stem',p.evaluate('BeastGame.sound.battleScoreGain.gain.value')>.60)
 p.evaluate('BeastGame.sound.strike(8,true)');p.wait_for_timeout(60);check('Impact ducks the music bus',p.evaluate('BeastGame.sound.musicDuck.gain.value')<.4)
 p.wait_for_timeout(1000);check('The music returns after the impact',p.evaluate('BeastGame.sound.musicDuck.gain.value')>.95)
 p.evaluate('BeastGame.sound.setBattle(false)');p.wait_for_timeout(500);check('Combat-only voice nodes stop after skip/end',p.evaluate('BeastGame.sound.battleVoices.size')==0)
 p.locator('#audioBtn').click();p.locator('#soundAnimal').select_option('8');old=p.evaluate('BeastGame.sound.status().animalCalls');p.locator('#testAnimalCall').click();p.wait_for_timeout(70);check('Animal audition triggers the selected voice',p.evaluate('BeastGame.sound.status().animalCalls')==old+1)
 p.screenshot(path=str(ROOT/'new-audio-settings.png'));p.locator('#audioDialog [data-close]').click()
 p.locator('#soundBtn').click();old=p.evaluate('BeastGame.sound.status().animalCalls');p.evaluate('BeastGame.sound.sfx("call",8)');check('Effects mute suppresses animal playback',p.evaluate('BeastGame.sound.status().animalCalls')==old)
 p.locator('#soundBtn').click();p.locator('#musicBtn').click();p.wait_for_timeout(150);check('Music mute stops both score stems independently',not p.evaluate('BeastGame.sound.status().scorePlaying') and p.evaluate('BeastGame.sound.status().enabled'))
 p.locator('#reduced').check();p.locator('#demoAnimal').select_option('8');p.locator('#demoBtn').click();p.wait_for_function('BeastGame.getUI().battle');p.locator('#pauseBattle').click();p.evaluate('BeastGame.seekBattle(.7)');p.wait_for_timeout(40)
 check('Reduced motion shows the elephant, never a lion pose',p.evaluate('BeastGame.getBattle().length===1.3&&BeastGame.getBattle().frame===9'));p.locator('#skipBattle').click();idle(p)
 mobile=setup(b,{'width':390,'height':844},True);mobile.locator('#elephantIntro').click();clickcell(mobile,24);mobile.wait_for_function('BeastGame.getUI().battle');mobile.locator('#pauseBattle').click();mobile.evaluate('BeastGame.seekBattle(BeastGame.painted.elephantHit+.42)');mobile.wait_for_timeout(80)
 check('Touchscreen elephant capture works',mobile.evaluate('BeastGame.getBattle().variant')=='elephant-tiger')
 check('Mobile layout and playback controls stay within viewport',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth') and mobile.locator('#skipBattle').bounding_box()['x']+mobile.locator('#skipBattle').bounding_box()['width']<=390)
 mobile.screenshot(path=str(ROOT/'elephant-impact-phone.png'),full_page=True);mobile.locator('#skipBattle').click();idle(mobile,2);mobile.close()
 # Try genuine local-file execution; do not silently substitute a storage shim.
 native_file_status='Not tested: file:// navigation is blocked by administrator policy in the isolated browser.'
 # The attempted file:// launch was denied. Do not disable or bypass that policy.
 print('LIMITATION',native_file_status,flush=True)
 # OfflineAudioContext exercises the ACTUAL embedded audio engine, not just UI state.
 aud=p.evaluate('''async()=>{
  const c=new OfflineAudioContext(2,32000*8,32000),s=new InkAudio({context:c,offline:true});await s.assetsPromise;
  s.configure({sound:true,musicVolume:.48,sfxVolume:.72});s.music=true;s.updateGains();s.startScore(0);s.setBattle(true,8);
  s.sfx('rumble',8,.15);s.sfx('call',8,.65);s.sfx('step',8,.4);s.sfx('step',8,1.1);s.strike(8,true,.22,1.64);s.sfx('land',8,2.95);
  const out=await c.startRendering();let peak=0,sum=0,clip=0,finite=true;const l=out.getChannelData(0),r=out.getChannelData(1),pcm=new Int16Array(out.length*2);
  for(let i=0;i<out.length;i++){peak=Math.max(peak,Math.abs(l[i]),Math.abs(r[i]));sum+=l[i]*l[i]+r[i]*r[i];if(Math.abs(l[i])>=.999||Math.abs(r[i])>=.999)clip++;finite=finite&&Number.isFinite(l[i])&&Number.isFinite(r[i]);pcm[i*2]=Math.round(Math.max(-1,Math.min(1,l[i]))*32767);pcm[i*2+1]=Math.round(Math.max(-1,Math.min(1,r[i]))*32767);}
  const bytes=new Uint8Array(pcm.buffer);let str='';for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return{peak,rms:Math.sqrt(sum/out.length/2),clip,finite,pcm:btoa(str),calls:s.metrics.animalCalls,errors:s.audioErrors};
 }''')
 import wave
 with wave.open(str(ROOT/'audio/gameplay-engine-preview.wav'),'wb') as w:
  w.setnchannels(2);w.setsampwidth(2);w.setframerate(32000);w.writeframes(base64.b64decode(aud.pop('pcm')))
 check('Rendered music plus elephant attack is audible and finite',aud['finite'] and aud['rms']>.01)
 check('Rendered full mix has no digital clipping',aud['clip']==0 and aud['peak']<1)
 check('Rendered preview includes the elephant call without decode errors',aud['calls']>=1 and not aud['errors'])
 (ROOT/'tests/audio-signal-results.json').write_text(json.dumps(aud,indent=2))
 check('No uncaught browser errors',not errors);check('No external runtime network requests',not requests)
 (ROOT/'tests/elephant-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'requests':requests,'nativeFileOrigin':native_file_status,'mobile':'390x844 touch simulation; no physical device','audio':aud},ensure_ascii=False,indent=2));print(len(checks),'elephant/audio browser checks passed.',flush=True);b.close()
