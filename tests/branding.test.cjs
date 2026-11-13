/* Branding/namespace regression checks; no browser or network is involved. */
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
// Archived names are encoded only in this negative-test fixture, so the source
// and generated artifacts themselves use English identifiers throughout.
const oldNames=[[115,104,97,110,104,101],[115,104,111,117,121,105,110,103],
 [100,111,117,115,104,111,117,113,105],[99,97,112,116,117,114,101,45,112,111]].map(a=>String.fromCharCode(...a));
const firstParty=['game','tools','tests','docs'].flatMap(d=>fs.existsSync(path.join(root,d))?walk(path.join(root,d)):[])
 .concat(fs.existsSync(path.join(root,'scene'))?walk(path.join(root,'scene')):[])
 .filter(p=>/\.(?:js|mjs|cjs|css|html|py|json|txt|md)$/.test(p));
test('project-owned text and paths use English identifiers',()=>{
 for(const p of firstParty){
  if(path.basename(p).endsWith('-results.json') || path.basename(p).endsWith('-results.txt'))continue;
  const body=fs.readFileSync(p,'utf8').replace(/data:[^"'\s]+/g,'');
  for(const old of oldNames){
   assert(!p.toLowerCase().includes(old),path.relative(root,p));
   assert(!body.toLowerCase().includes(old),path.relative(root,p)+' contains an archived project name');
  }
 }
});
test('the retained calligraphy has an English asset key without changing its image',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'game/src/assets.js'),'utf8'),ctx);
 assert.equal(vm.runInContext("ART['capture-impact'] === ART['capture-brush']",ctx),true);
 assert.equal(vm.runInContext('Object.keys(ART)',ctx).includes(oldNames[3]),false);
});
test('the page title identifies Jungle King but keeps Traditional Chinese artwork text',()=>{
 const html=fs.readFileSync(path.join(root,'game/src/index.html'),'utf8');
 assert(/<title>Jungle King/.test(html));assert(html.includes('山河獸影'));
});
test('existing English local-save identifiers are retained',()=>{
 const app=fs.readFileSync(path.join(root,'game/src/app.js'),'utf8');
 assert(app.includes('beast-ink.settings.v2'));assert(app.includes('beast-ink.save.v2'));
});
if(fs.existsSync(path.join(root,'scene'))){
 test('the renamed host and scene channel agree and reject the old channel',()=>{
  const c=require('../game/src/capture-contract.js');
  assert.equal(c.CHANNEL,'jungle-king.capture.v1');
  const child=fs.readFileSync(path.join(root,'scene/src/embedded-bridge.mjs'),'utf8');
  assert(child.includes("CAPTURE_CHANNEL='"+c.CHANNEL+"'"));
  const session=new c.CaptureSession(2,'nonce');
  assert(session.accepts(c.message(2,'nonce','ready')));
  assert(!session.accepts({...c.message(2,'nonce','ready'),channel:oldNames[0]+'.capture.v1'}));
 });
}
