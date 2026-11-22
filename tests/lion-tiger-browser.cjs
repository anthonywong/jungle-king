/* Run after build.py with Playwright installed and Chrome available.
 * CHROME_CHANNEL defaults to chrome; outputs go to ignored checks/.
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'checks');
const checks=[],errors=[],requests=[];
function check(name,ok){assert(ok,name);checks.push(name);console.log('PASS',name);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||'chrome'});
 try{
  async function page(viewport={width:1440,height:1000}){
   const p=await browser.newPage({viewport});p.on('pageerror',e=>errors.push(String(e)));
   p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
   await p.goto(pathToFileURL(path.join(root,'dist/index.html')).href+'#test');
   await p.waitForFunction(()=>window.BeastGame?.renderer?.assetsReady);return p;
  }
  const p=await page();await p.locator('#startBtn').click();
  const before=await p.evaluate(()=>BeastGame.getState());
  await p.locator('#demoAnimal').selectOption('lion-tiger');await p.locator('#demoBtn').click();
  await p.waitForFunction(()=>BeastGame.getUI().battle);await p.locator('#pauseBattle').click();
  check('Preview selector launches dedicated lion/tiger film',await p.evaluate(()=>BeastGame.getBattle().variant==='lion-tiger'));
  const paused=await p.evaluate(()=>BeastGame.getBattle().t);await p.waitForTimeout(150);
  check('Pause freezes animation time',await p.evaluate(t=>BeastGame.getBattle().t===t,paused));
  await p.locator('#speedBattle').click();check('Half-speed control applies',await p.evaluate(()=>BeastGame.getBattle().rate===.5));
  const starts=await p.evaluate(()=>BeastGame.painted.lionTigerStarts),poses=new Set();
  for(let i=0;i<44;i++){
   await p.evaluate(t=>BeastGame.seekBattle(t+.01),starts[i]);await p.waitForTimeout(40);
   check(`Atlas pose ${i+1} renders at the scheduled time`,await p.evaluate(i=>BeastGame.renderer.lastCombatFrame.index===i,i));
   poses.add(await p.evaluate(i=>BeastGame.renderer.lionTigerFrame(i).toDataURL(),i));
  }
  check('All 44 displayed drawings are distinct',poses.size===44);
  // Pixel-based continuity check on the settled lion, independent of source IDs.
  const landingScale=await p.evaluate(()=>{
   const samples=[];
   for(let i=38;i<44;i++){
    const c=document.createElement('canvas');c.width=384;c.height=256;const ctx=c.getContext('2d');ctx.drawImage(BeastGame.renderer.lionTigerFrame(i),0,0,384,256);
    const rgba=ctx.getImageData(0,0,384,256).data,ys=[];
    for(let y=4;y<250;y++)for(let x=10;x<190;x++){const n=(y*384+x)*4,r=rgba[n],g=rgba[n+1],b=rgba[n+2];if(r-b>65&&r>g*1.12&&g>b*1.15)ys.push(y);}
    ys.sort((a,b)=>a-b);const top=ys[Math.floor((ys.length-1)*.005)],bottom=ys[Math.floor((ys.length-1)*.995)];samples.push({index:i,height:bottom-top,center:(top+bottom)/2});
   }
   return samples;
  });
  fs.writeFileSync(path.join(out,'lion-tiger-scale-results.json'),JSON.stringify(landingScale,null,2)+'\n');
  // Warm-fur pixels exclude the black mane, paw outlines and pale highlights;
  // their absolute height is not anatomical height. Compare adjacent extents.
  check('Settled lion has no abrupt change in size or vertical framing',landingScale.every((s,i)=>Number.isFinite(s.height)&&s.height>0&&(!i||(Math.abs(s.height-landingScale[i-1].height)/landingScale[i-1].height<.10&&Math.abs(s.center-landingScale[i-1].center)<16))));
  check('Planted forepaw stays on the same rock through the final hold',await p.evaluate(()=>{
   const patch=document.createElement('canvas');patch.width=48;patch.height=30;
   const ctx=patch.getContext('2d');
   function paw(i){ctx.drawImage(BeastGame.renderer.lionTigerFrame(i),105,215,48,30,0,0,48,30);return patch.toDataURL();}
   const plant=paw(32);
   return Array.from({length:11},(_,i)=>paw(33+i)).every(value=>value===plant);
  }));
  const approvedImage=fs.readFileSync(path.join(root,'docs/artwork/lion-tiger-action-study-v3.png')).toString('base64');
  check('Approved leap and contact artwork remain pixel-identical',await p.evaluate(async data=>{
   const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();
   return Object.entries(BeastGame.painted.lionTigerKeys).every(([index,cell])=>{
    const w=im.naturalWidth/2,h=im.naturalHeight/2,c=document.createElement('canvas');c.width=w-4;c.height=h-4;
    c.getContext('2d').drawImage(im,(cell%2)*w+2,Math.floor(cell/2)*h+2,w-4,h-4,0,0,w-4,h-4);
    return c.toDataURL()===BeastGame.renderer.lionTigerFrame(Number(index)).toDataURL();
   });
  },approvedImage));
  await p.locator('#filmSeek').fill('0');await p.locator('#filmSeek').dispatchEvent('input');
  check('Preview can scrub back to the opening pose',await p.evaluate(()=>BeastGame.getBattle().frame===0));
  await p.evaluate(()=>BeastGame.seekBattle(BeastGame.painted.lionTigerHit+.03));await p.waitForTimeout(60);
  await p.screenshot({path:path.join(out,'lion-tiger-desktop.png')});
  await p.evaluate(()=>BeastGame.seekBattle(BeastGame.painted.lionTigerStarts[43]+.01));await p.waitForTimeout(60);
  await p.screenshot({path:path.join(out,'lion-tiger-injured.png')});
  await p.locator('#skipBattle').click();assert.deepEqual(await p.evaluate(()=>BeastGame.getState()),before);
  check('Preview controls leave the match unchanged',true);

  // Save a silent recording of the actual canvas animation for visual review.
  await p.locator('#demoBtn').click();await p.waitForFunction(()=>BeastGame.getUI().battle);
  await p.locator('#pauseBattle').click();await p.evaluate(()=>BeastGame.seekBattle(0));
  await p.evaluate(()=>{
   const stream=document.querySelector('#scene').captureStream(30),chunks=[];
   window.previewRecorder=new MediaRecorder(stream,{mimeType:'video/webm'});
   window.previewVideo=new Promise(resolve=>{previewRecorder.ondataavailable=e=>chunks.push(e.data);previewRecorder.onstop=async()=>{
    const data=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
    stream.getTracks().forEach(t=>t.stop());resolve(btoa(binary));
   };});previewRecorder.start();
  });
  await p.locator('#pauseBattle').click();await p.waitForFunction(()=>!BeastGame.getUI().battle);
  const video=await p.evaluate(async()=>{previewRecorder.stop();return await previewVideo;});
  fs.writeFileSync(path.join(out,'lion-tiger-preview.webm'),Buffer.from(video,'base64'));
  assert.deepEqual(await p.evaluate(()=>BeastGame.getState()),before);
  check('Replaying the revised film leaves the match unchanged',true);

  // Compare every retained film pose against the approved renderer, pixel for pixel.
  const original=execFileSync('git',['show','02408e8:game/src/renderer.js'],{cwd:root,encoding:'utf8'});
  const preserved=await p.evaluate(async source=>{
   const Old=new Function(source+';return Beast3D;')().Renderer;
   const canvases=[0,1].map(()=>{const c=document.createElement('canvas');c.style.cssText='width:800px;height:600px;position:absolute;left:-10000px';document.body.append(c);return c;});
   const old=new Old(canvases[0],BeastGame.rules),current=new Beast3D.Renderer(canvases[1],BeastGame.rules);
   await Promise.all([old.ready,current.ready]);let same=true;
   for(const [variant,times] of [['lion-leopard',PaintedSequence.starts],['elephant-tiger',PaintedSequence.elephantStarts]]){
    for(const start of times){const b={variant,elapsed:start+.01,reduced:false};old.renderBattle(b,0,false);current.renderBattle(b,0,false);same&&=canvases[0].toDataURL()===canvases[1].toDataURL();}
   }
   canvases.forEach(c=>c.remove());return same;
  },original);
  check('All 29 original film poses are pixel-identical to approved renderer',preserved);

  async function capture(side,skip,reduced=false,missing=false){
   const q=await page();await q.evaluate(({side,reduced,missing})=>{
    const s=BeastGame.rules.initial();s.board=Array(63).fill(0);s.board[31]=side*7;s.board[24]=-side*6;s.turn=side;s.history=[BeastGame.rules.key(s)];
    BeastGame.setState(s);BeastGame.settings.reduced=reduced;
    if(missing)delete BeastGame.renderer.images['lion-tiger-fall'];
    window.observedPoses=[];
    const observe=()=>{const f=BeastGame.renderer.lastCombatFrame;if(f&&window.observedPoses.at(-1)!==f.index)window.observedPoses.push(f.index);if(!BeastGame.getState().result)requestAnimationFrame(observe);};
    requestAnimationFrame(observe);void BeastGame.move({from:31,to:24});
   },{side,reduced,missing});
   await q.waitForFunction(()=>BeastGame.getUI().battle);
   check(`Capture selects lion/tiger (${side}, skip=${skip}, reduced=${reduced}, fallback=${missing})`,await q.evaluate(()=>BeastGame.getBattle().variant==='lion-tiger'));
   check('Actual capture disables preview seeking',await q.locator('#filmSeek').isDisabled());
   if(skip){await q.locator('#pauseBattle').click();await q.locator('#skipBattle').click();}
   await q.waitForFunction(()=>!BeastGame.getUI().busy&&!BeastGame.getUI().battle&&BeastGame.getState().ply===1);
   await q.evaluate(()=>{BeastGame.endBattle();BeastGame.endBattle();});
   check('Capture commits exactly once with the correct winner',await q.evaluate(side=>{const s=BeastGame.getState();return s.ply===1&&s.board[24]===side*7&&s.board[31]===0&&s.result.winner===side&&document.querySelectorAll('#log .kill').length===1;},side));
   if(!skip&&!reduced&&!missing)check('Normal playback displays all 44 drawings in order',await q.evaluate(()=>observedPoses.length===44&&observedPoses.every((x,i)=>x===i)));
   if(reduced)check('Reduced motion displays only opening, wounded and ending poses',await q.evaluate(()=>JSON.stringify(observedPoses)==='[0,16,43]'));
   await q.close();
  }
  await capture(1,false);await capture(-1,true);await capture(1,false,true);await capture(1,false,false,true);

  const mobile=await page({width:390,height:844});await mobile.locator('#startBtn').click();
  await mobile.locator('#demoAnimal').selectOption('lion-tiger');await mobile.locator('#demoBtn').click();
  await mobile.waitForFunction(()=>BeastGame.getUI().battle);await mobile.locator('#pauseBattle').click();
  await mobile.evaluate(()=>BeastGame.seekBattle(BeastGame.painted.lionTigerHit+.03));await mobile.waitForTimeout(60);
  await mobile.screenshot({path:path.join(out,'lion-tiger-phone.png'),fullPage:true});
  check('Phone layout stays within viewport',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const skipBox=await mobile.locator('#skipBattle').boundingBox();check('Phone skip control is reachable',skipBox.x>=0&&skipBox.x+skipBox.width<=390);
  await mobile.locator('#skipBattle').click();await mobile.close();
  check('No uncaught browser errors',errors.length===0);check('Offline page makes no external requests',requests.length===0);
  fs.writeFileSync(path.join(out,'lion-tiger-browser-results.json'),JSON.stringify({passed:checks.length,checks,errors,requests,scope:'Chrome headless, real file origin; desktop and simulated phone viewport.'},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
