"""Test the exact offline bundle in isolated Chromium.
This managed test browser blocks file:// navigation. The byte-identical HTML is
loaded with set_content. The storage adapter is explicit; these tests do NOT
verify Safari, physical mobile devices, or file-origin storage persistence.
"""
from pathlib import Path
import json,shutil,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];HTML=(ROOT.parent/'dist/index.html').read_text()
checks=[];errors=[];requests=[]
def check(name,ok=True):
    if not ok:raise AssertionError(name)
    checks.append(name);print('PASS',name,flush=True)
def setup(browser,viewport=None,mobile=False,store=None,denied=False,worker=True):
    p=browser.new_page(viewport=viewport or {'width':1440,'height':1000},device_scale_factor=1,is_mobile=mobile,has_touch=mobile)
    p.set_default_timeout(8000);p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
    p.evaluate("""cfg=>{location.hash='test';window.__store=cfg.store||{};Object.defineProperty(window,'localStorage',{value:{getItem:k=>{if(cfg.denied)throw Error('denied');return __store[k]??null},setItem:(k,v)=>{if(cfg.denied)throw Error('denied');__store[k]=String(v)}}});if(!cfg.worker)window.Worker=function(){throw Error('worker unavailable')};}""",{'store':store,'denied':denied,'worker':worker})
    p.set_content(HTML,wait_until='load');p.wait_for_function('window.BeastGame?.renderer?.assetsReady')
    return p

def clickcell(p,i):
    q=p.evaluate('i=>BeastGame.projectCell(i)',i);r=p.locator('#scene').bounding_box()
    if p.evaluate('matchMedia("(pointer: coarse)").matches'):p.touchscreen.tap(r['x']+q['x'],r['y']+q['y'])
    else:p.mouse.click(r['x']+q['x'],r['y']+q['y'])

def wait_idle(p,ply=None):
    condition='!BeastGame.getUI().busy&&!BeastGame.getUI().battle'
    if ply is not None:condition+=f'&&BeastGame.getState().ply==={ply}'
    p.wait_for_function(condition,timeout=15000)

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    p=setup(b)
    check('Title screen, approved cover and all embedded images load',p.locator('#intro').is_visible() and p.evaluate('Object.values(BeastGame.renderer.images).every(x=>x.naturalWidth>0)'))
    check('No external network requests are required',not requests)
    check('No desktop horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    check('Music remains locked before the first user gesture',p.evaluate('BeastGame.sound.status().context')=='locked')
    check('Rejected articulated renderer is not bundled','drawRig(' not in HTML and 'const BeastRig' not in HTML)
    check('Capture lettering is an image, not a substituted font or vector glyph',p.locator('#impactWord img').count()==1 and p.locator('#impactWord svg').count()==0)
    p.screenshot(path=str(ROOT/'screen-title.png'))
    before=p.evaluate('BeastGame.getState()');p.locator('#introDemo').click();p.wait_for_function('BeastGame.getUI().battle')
    check('Title preview uses the approved lion/leopard animation',p.evaluate('BeastGame.getBattle().variant')=='lion-leopard')
    p.locator('#pauseBattle').click();t=p.evaluate('BeastGame.getBattle().t');p.wait_for_timeout(220)
    check('Pause freezes the artwork clock',abs(p.evaluate('BeastGame.getBattle().t')-t)<.01)
    p.evaluate('BeastGame.seekBattle(2.46)');p.wait_for_timeout(80)
    check('Native brush-mark impact frame is rendered',p.evaluate('BeastGame.getBattle().frame')==11)
    p.screenshot(path=str(ROOT/'screen-capture.png'))
    p.locator('#speedBattle').click();check('Half-speed selection changes the actual timeline rate',p.evaluate('BeastGame.getBattle().rate')==.5)
    p.locator('#pauseBattle').click();t=p.evaluate('BeastGame.getBattle().t');p.wait_for_timeout(220);delta=p.evaluate('BeastGame.getBattle().t')-t
    check('Half-speed playback progresses at half elapsed time',.06<delta<.18)
    p.locator('#filmSeek').fill('350');p.locator('#filmSeek').dispatch_event('input')
    check('Preview scrubbing pauses at the selected frame',p.evaluate('BeastGame.getBattle().paused') and abs(p.evaluate('BeastGame.getBattle().t/BeastGame.getBattle().length')-.35)<.02)
    p.keyboard.press('Space');p.wait_for_function('!BeastGame.getUI().battle')
    check('Skipping a preview returns to title without modifying the match',p.locator('#intro').is_visible() and p.evaluate('BeastGame.getState()')==before)
    p.locator('#startBtn').click();p.locator('#musicBtn').click();p.locator('#cinematic').uncheck()
    check('New game has sixteen pieces and the correct side to move',p.evaluate('BeastGame.getState().board.filter(Boolean).length===16&&BeastGame.getState().turn===1'))
    check('All sixty-three board cells have consistent projection and picking',p.evaluate('Array.from({length:63},(_,i)=>{let q=BeastGame.projectCell(i);return BeastGame.renderer.pick(q.x,q.y)===i}).every(Boolean)'))
    clickcell(p,44);check('Pointer selection produces legal moves',p.evaluate('BeastGame.getUI().selected')==44 and len(p.evaluate('BeastGame.getUI().legal'))>0)
    clickcell(p,45);wait_idle(p,2)
    check('A real human move receives a legal computer reply',p.evaluate('BeastGame.getState().turn')==1 and p.locator('#log li').count()==2)
    saved_store=p.evaluate('__store');before=p.evaluate('BeastGame.getState()')
    p.locator('#scenarioBtn').click();p.locator('#cinematic').check();check('Playable encounter is explicitly separate from the saved match',p.evaluate('BeastGame.getUI().scenario') and p.evaluate('JSON.parse(__store["beast-ink.save.v2"]).state')==before)
    p.screenshot(path=str(ROOT/'screen-scenario.png'))
    clickcell(p,24);p.wait_for_function('BeastGame.getUI().battle')
    check('Clicking the leopard triggers an actual lion capture, not a demo',p.evaluate('BeastGame.getBattle().variant')=='lion-leopard' and p.locator('#filmSeek').is_disabled())
    check('The board is not prematurely changed during the capture',p.evaluate('BeastGame.getState().board[24]===-5&&BeastGame.getState().board[31]===7'))
    p.keyboard.press('p');check('Keyboard pause works during an actual capture',p.evaluate('BeastGame.getBattle().paused'))
    p.keyboard.press('Space');wait_idle(p,2)
    check('Skipping a paused capture commits the move exactly once',p.evaluate('BeastGame.getState().board[24]===7&&BeastGame.getState().board[31]===0&&!BeastGame.getState().board.includes(-5)') and p.locator('#log li .kill').count()==1)
    check('The AI replies after the animated capture',p.evaluate('BeastGame.getState().turn')==1)
    p.locator('#exitScenario').click();check('Returning from the encounter restores the exact original match',p.evaluate('BeastGame.getState()')==before and not p.evaluate('BeastGame.getUI().scenario'))
    check('Showcase play has not overwritten the normal saved match',p.evaluate('JSON.parse(__store["beast-ink.save.v2"]).state')==before)
    p.locator('#undoBtn').click();wait_idle(p,0);check('Full-round undo is retained',p.evaluate('BeastGame.getState().ply')==0)
    p.locator('#hintBtn').click();p.wait_for_function('!BeastGame.getUI().busy&&BeastGame.getUI().hint!==null',timeout=15000)
    check('AI hints are legal and do not alter the board',p.evaluate('BeastGame.getState().ply===0&&BeastGame.rules.moves(BeastGame.getState()).some(x=>x.from===BeastGame.getUI().hint.from&&x.to===BeastGame.getUI().hint.to)'))
    for rank in range(1,9):
        before=p.evaluate('BeastGame.getState()');p.locator('#demoAnimal').select_option(str(rank));p.locator('#demoBtn').click();p.wait_for_function('BeastGame.getUI().battle');got=p.evaluate('BeastGame.getBattle()')
        check(f'Animal {rank} preview retains the correct species',got['rank']==rank and got['variant']==('lion-leopard' if rank==7 else 'elephant-tiger' if rank==8 else 'comic-panels'))
        if rank==6:p.locator('#pauseBattle').click();p.evaluate('BeastGame.seekBattle(2.04)');p.wait_for_timeout(100);p.screenshot(path=str(ROOT/'screen-other-capture.png'))
        p.keyboard.press('Space');wait_idle(p);check(f'Animal {rank} preview does not mutate gameplay',p.evaluate('BeastGame.getState()')==before)
    p.evaluate('()=>{BeastGame.playBattle(7,-6,true)}');p.wait_for_function('BeastGame.getUI().battle');p.locator('#pauseBattle').click();p.evaluate('BeastGame.seekBattle(1.2)');p.wait_for_timeout(100)
    check('Lion versus tiger uses lion-only frames and the correct opponent',p.evaluate('BeastGame.getBattle().variant')=='lion-pounce' and p.locator('#targetName').inner_text()=='伏山猛虎')
    p.screenshot(path=str(ROOT/'screen-lion-tiger.png'));p.keyboard.press('Space');wait_idle(p)
    p.locator('#reduced').check();p.locator('#demoAnimal').select_option('7');p.locator('#demoBtn').click();p.wait_for_function('BeastGame.getUI().battle')
    check('Reduced-motion capture uses the short static-pose sequence',p.evaluate('BeastGame.getBattle().length')==1.3);p.keyboard.press('Space');wait_idle(p)
    p.locator('#reduced').uncheck();p.locator('#audioBtn').click();p.locator('#musicVolume').fill('21');p.locator('#musicVolume').dispatch_event('input');p.locator('#sfxVolume').fill('37');p.locator('#sfxVolume').dispatch_event('input')
    check('Music and effects have independent working volume controls',p.evaluate('BeastGame.sound.status().musicVolume===.21&&BeastGame.sound.status().sfxVolume===.37'))
    old=p.evaluate('BeastGame.sound.status().impacts');p.locator('#testSound').click();p.wait_for_timeout(100);check('Impact test creates a new audible-effect event',p.evaluate('BeastGame.sound.status().impacts')==old+1)
    p.locator('#audioDialog [data-close]').click();p.locator('#helpBtn').click();check('Rules explain the frame-animated and comic-panel scope', '其餘六種動物' in p.locator('#helpDialog').inner_text());p.locator('#helpDialog [data-close]').first.click()
    p.locator('#cinematic').uncheck();p.locator('#trainingBtn').click()
    for lesson,(src,dst) in enumerate([(31,24),(21,24),(10,3)]):
        clickcell(p,src);clickcell(p,dst);p.wait_for_selector('#nextTraining');check(f'Interactive rules lesson {lesson+1} still completes');p.locator('#nextTraining').click()
    wait_idle(p);check('Interactive lessons return to the normal match',p.evaluate('BeastGame.getUI().training===null&&BeastGame.getState().ply===0'))
    # Existing save compatibility, disabled storage, and worker fallback.
    restored=setup(b,store=saved_store);restored.locator('#resumeBtn').click();wait_idle(restored,2)
    check('Existing saved games can be resumed',restored.evaluate('BeastGame.getState().ply')==2);restored.close()
    no_storage=setup(b,denied=True,worker=False);no_storage.locator('#startBtn').click();no_storage.locator('#cinematic').uncheck();clickcell(no_storage,44);clickcell(no_storage,45);wait_idle(no_storage,2)
    check('Gameplay survives denied storage and unavailable Web Workers',no_storage.evaluate('BeastGame.getState().turn')==1);no_storage.close()
    # Small touch screen: no CSS overflow, clipped buttons, or invisible stage.
    mobile=setup(b,viewport={'width':390,'height':844},mobile=True)
    check('Phone layout has no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    mobile.screenshot(path=str(ROOT/'screen-phone-title.png'),full_page=True)
    mobile.locator('#scenarioIntro').click();mobile.locator('#cinematic').check();clickcell(mobile,24);mobile.wait_for_function('BeastGame.getUI().battle');mobile.locator('#pauseBattle').click();mobile.evaluate('BeastGame.seekBattle(2.46)');mobile.wait_for_timeout(100)
    check('Touch interaction launches the actual capture',mobile.evaluate('BeastGame.getBattle().variant')=='lion-leopard')
    check('Mobile playback controls remain inside the viewport',mobile.locator('#skipBattle').bounding_box()['x']+mobile.locator('#skipBattle').bounding_box()['width']<=390)
    mobile.screenshot(path=str(ROOT/'screen-phone-capture.png'),full_page=True)
    mobile.locator('#skipBattle').click();wait_idle(mobile,2);mobile.locator('#exitScenario').click()
    check('Touch capture and return complete without losing the title state',mobile.locator('#intro').is_visible());mobile.close()
    check('No unexpected external requests occurred',not requests)
    check('No uncaught browser errors occurred',not errors)
    (ROOT/'tests/painted-browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'externalRequests':requests,'scope':'Chromium set_content; explicit storage adapter; simulated phone; no Safari or native file-origin verification'},ensure_ascii=False,indent=2))
    print(f'{len(checks)} browser checks passed.',flush=True);b.close()
