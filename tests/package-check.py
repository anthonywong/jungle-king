"""Validate generated files and unchanged media. No browser execution implied."""
from pathlib import Path
import base64
import hashlib
import json
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
checks=[]

def check(name, ok):
    if not ok:
        raise AssertionError(name)
    checks.append(name)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

realtime=(ROOT/'scene').exists()
manifest=json.loads((ROOT/'dist/build-manifest.json').read_text())
check('Project name',manifest['project']=='Jungle King')
check('Correct branch mode',manifest['mode']==('3d-preview' if realtime else '2d-painted'))
check('Branch-appropriate scene output',(ROOT/'dist/battle.html').exists()==realtime)
for name,info in manifest['files'].items():
    p=ROOT/'dist'/name
    check(name+' checksum',sha(p)==info['sha256'])
    text=p.read_text()
    check(name+' title','<title>Jungle King' in text)
    check(name+' resolved templates',not any(s in text for s in ['/*__','/*APP*/','/*ASSETS*/','/*STYLE*/']))
    ids=re.findall(r'\bid="([^"]+)"',text)
    check(name+' unique ids',len(ids)==len(set(ids)))
    for n,(attrs,code) in enumerate(re.findall(r'<script\b([^>]*)>([\s\S]*?)</script>',text)):
        if 'application/json' in attrs or 'importmap' in attrs:
            json.loads(code);continue
        if code.strip():
            subprocess.run(['node','--input-type=module','--check'],input=code,text=True,check=True,capture_output=True)
    check(name+' embedded script syntax',True)
protected=json.loads((ROOT/'docs/content-hashes.json').read_text())
for name,want in protected['files'].items():
    check('Preserved '+name,sha(ROOT/name)==want)
check('Required credits',(ROOT/'dist/CREDITS.txt').is_file())
check('No font/soundfont distributions',not any(p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.sf2'} for p in ROOT.rglob('*') if '.git' not in p.parts))
for p in list((ROOT/'game/src').glob('*.js'))+list((ROOT/'scene/src').glob('*.mjs')):
    subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
check('All executable game/scene source parses',True)
# Source hashes for preserved algorithm/animation files are carried separately
# from the new identifier hashes in the original integration packaging checks.
result={'passed':len(checks),'checks':checks,'scope':'Static packaging, embedded script syntax and immutable asset hashes; no browser rendering.'}
(ROOT/'checks').mkdir(exist_ok=True)
(ROOT/'checks/package-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'{len(checks)} packaging, syntax and content-integrity checks passed.')
