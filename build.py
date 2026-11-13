#!/usr/bin/env python3
"""Build Jungle King from editable sources using Python's standard library.

The 3D branch additionally uses Node.js to check the bundled scene's syntax.
No dependency installation, network requests, deployment, or publication occurs.
"""
from pathlib import Path
import base64
import hashlib
import json
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean_js(text):
    return text.replace('</script', '<\\/script')


def main():
    game = ROOT / 'game' / 'src'
    realtime = (ROOT / 'scene' / 'src').is_dir()
    if OUT.is_symlink():
        raise SystemExit('Refusing to replace a symlink at dist/.')
    OUT.mkdir(exist_ok=True)
    # Remove only known, generated 3D outputs when switching back to master.
    for name in ['battle.html', 'runtime-check.html', 'SCENE-CREDITS.txt', 'GAME-CREDITS.txt']:
        (OUT / name).unlink(missing_ok=True)
    tokens = [('CSS','style.css'),('ASSETS','assets.js'),('RULES','rules.js'),
              ('AI','ai.js'),('AUDIO_ASSETS','audio-assets.js'),('AUDIO','audio.js'),
              ('COMBAT','combat.js'),('PAINTED','painted.js'),('RENDERER','renderer.js')]
    if realtime:
        tokens += [('CAPTURE_CONTRACT','capture-contract.js'),
                   ('CAPTURE_PRESENTER','capture-presenter.js'),('CAPTURE_FOLEY','capture-foley.js')]
    tokens += [('APP','app.js')]
    html = (game / 'index.html').read_text(encoding='utf-8')
    for token, name in tokens:
        marker = '/*__' + token + '__*/'
        if html.count(marker) != 1:
            raise ValueError('Missing or repeated build marker: ' + marker)
        text = (game / name).read_text(encoding='utf-8')
        html = html.replace(marker, clean_js(text) if name.endswith('.js') else text)
    if '/*__' in html:
        raise ValueError('Unresolved board build marker.')
    (OUT / 'index.html').write_text(html, encoding='utf-8')
    entry_files = ['index.html']
    manifest = {'project':'Jungle King', 'build':'jungle-king-3d-preview' if realtime else 'jungle-king-2d-baseline',
                'entry':'index.html', 'mode':'3d-preview' if realtime else '2d-painted'}
    if realtime:
        scene = ROOT / 'scene' / 'src'
        assets = ROOT / 'scene' / 'assets'
        def uri(name, mime):
            return 'data:' + mime + ';base64,' + base64.b64encode((assets/name).read_bytes()).decode('ascii')
        order = ['mechanics.mjs','cinematography.mjs','presence.mjs','acting.mjs',
                 'performance.mjs','signature.mjs','ear-motion.mjs','rig.mjs','candidate-pose.mjs',
                 'transition.mjs','candidate-asset.mjs','lookdev.mjs','animals.mjs','simulation.mjs',
                 'directed.mjs','signature-simulation.mjs','audio.mjs','presence-audio.mjs',
                 'diagnostics.mjs','embedded-bridge.mjs','app.mjs']
        code = '\n\n'.join((scene/name).read_text(encoding='utf-8') for name in order)
        code = re.sub(r'^import .*? from [\'\"].*?[\'\"];?\s*$', '', code, flags=re.M)
        code = re.sub(r'\bexport (?=(?:async function|function|class|const|let)\b)', '', code)
        if not shutil.which('node'):
            raise SystemExit('Node.js is needed to validate the 3D scene bundle before release.')
        subprocess.run(['node','--input-type=module','--check'], input=code, text=True, check=True)
        data = {'models':{'tiger':json.loads((assets/'tiger-mesh.json').read_text())},
                'assets':{'candidateGLB':uri('candidate-runtime.glb','model/gltf-binary'),
                          'brush':uri('capture-brush.webp','image/webp'),
                          'skinRelief':uri('skin-relief.png','image/png'),
                          'groundRelief':uri('ground-relief.png','image/png'),
                          'landscape':uri('landscape-wide.webp','image/webp'),'reference':''},
                'candidateRig':json.loads((assets/'candidate-rig.json').read_text())}
        page = (scene/'index.html').read_text(encoding='utf-8')
        page = page.replace('/*STYLE*/',(scene/'style.css').read_text(encoding='utf-8'))
        page = page.replace('/*APP*/',clean_js(code))
        page = page.replace('/*ASSETS*/',json.dumps(data,separators=(',',':')))
        if any(x in page for x in ['/*STYLE*/','/*APP*/','/*ASSETS*/']):
            raise ValueError('Unresolved scene build marker.')
        (OUT/'battle.html').write_text(page,encoding='utf-8')
        entry_files.append('battle.html')
        manifest.update({'scene':'battle.html',
                         'embeddedModelSHA256':digest(assets/'candidate-runtime.glb'),
                         'sourceModelSHA256':digest(assets/'candidate-original.glb'),
                         'scope':'Only elephant attacking tiger uses real-time 3D; all other captures retain painted presentation. Engine dependencies remain pinned external downloads.'})
    else:
        manifest['scope'] = 'Painted game with approved lion/elephant sequences, computer opponent and embedded media. No runtime network dependency.'
    manifest['files'] = {name:{'bytes':(OUT/name).stat().st_size,'sha256':digest(OUT/name)} for name in entry_files}
    (OUT/'build-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    for name in ['README.txt','QA.txt','CREDITS.txt','GAME-CREDITS.txt','SCENE-CREDITS.txt','launch.py','runtime-check.html']:
        if (ROOT/name).exists():
            shutil.copy2(ROOT/name,OUT/name)
    shutil.copytree(ROOT/'licenses',OUT/'licenses',dirs_exist_ok=True)
    print(json.dumps(manifest,indent=2))


if __name__ == '__main__':
    main()
