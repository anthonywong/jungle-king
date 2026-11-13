from pathlib import Path
import re,json,hashlib,base64,struct,subprocess
P=Path(__file__).resolve().parents[1];checks=[]
def check(name,ok):
 checks.append({'name':name,'passed':bool(ok)})
 if not ok:raise AssertionError(name)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
main=(P/'dist/index.html').read_text();scene=(P/'dist/battle.html').read_text()
check('Both entry files exist and contain no build markers','/*__' not in main and '/*APP*/' not in scene and '/*ASSETS*/' not in scene)
check('Relative scene filename is included',"this.frame.src='battle.html#embedded'" in main)
for name,text in [('index',main),('battle',scene)]:
 ids=re.findall(r'\bid="([^"]+)"',text)
 check(name+' has unique HTML ids',len(ids)==len(set(ids)))
 scripts=re.findall(r'<script\b([^>]*)>([\s\S]*?)</script>',text)
 for n,(attrs,code) in enumerate(scripts):
  if 'application/json' in attrs or 'importmap' in attrs:json.loads(code);continue
  if not code.strip():continue
  f=P/'tests'/f'{name}-script-{n}.mjs';f.write_text(code);subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
 check(name+' embedded JavaScript parses',True)
 parsed={m[0]:json.loads(m[1]) for m in re.findall(r'<script type="application/json" id="([^"]+)">([\s\S]*?)</script>',text)}
 if name=='battle':data=parsed['lab-data']
check('Only the supporting tiger procedural mesh is embedded',list(data['models'])==['tiger'])
uri=data['assets']['candidateGLB'];bin=base64.b64decode(uri.split(',',1)[1]);runtime=P/'scene/assets/candidate-runtime.glb'
check('Embedded candidate matches approved runtime asset byte-for-byte',hashlib.sha256(bin).hexdigest()==digest(runtime))
check('Original source GLB is the uploaded official file',digest(P/'scene/assets/candidate-original.glb')=='6737c6504a6e3bde75410981f3309e8af42da0fe06fef55a1ccc2fe5ce0c8f60')
magic,version,total=struct.unpack_from('<III',bin,0);size,typ=struct.unpack_from('<II',bin,12);doc=json.loads(bin[20:20+size]);check('Runtime GLB header is valid',magic==0x46546c67 and version==2 and total==len(bin))
check('Runtime skeleton retains 107 joints',len(doc['skins'][0]['joints'])==107)
check('Runtime animation clips retain five named clips',len(doc['animations'])==5)
for f,sha in json.loads((P/'tests/protected-source-hashes.json').read_text()).items():
 check(f+' retains the approved baseline hash',digest(P/f)==sha)
check('Parent supports both reduced-motion and disabled-3D fallback',"!settings.reduced" in main and "settings.real3d!==false" in main)
check('Capture hosts communicate without writing arbitrary code',"e.source!==this.frame.contentWindow" in main and "event.source!==parent" in scene)
check('Actual runtime diagnostic page ships', (P/'dist/runtime-check.html').is_file())
check('License and modification notices ship', (P/'dist/CREDITS.txt').is_file() and 'CC BY 4.0' in (P/'dist/CREDITS.txt').read_text())
check('No font or soundfont binaries included',not any(f.suffix.lower() in ['.ttf','.otf','.woff','.woff2','.sf2'] for f in (P/'dist').rglob('*')))
(P/'tests/package-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks},indent=2))
print(f'{len(checks)} package/asset/source checks passed.')
