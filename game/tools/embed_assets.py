#!/usr/bin/env python3
"""Refresh the offline asset map after editing assets. Python standard library only."""
from pathlib import Path
import base64,json
ROOT=Path(__file__).resolve().parents[1]
ASSET_FILES={k:k+'.webp' for k in ['rat','cat','dog','wolf','leopard','tiger','elephant','earth','water','painted-lion-portrait','painted-leopard-portrait','capture-brush','painted-mountains']}
ASSET_FILES.update({'lion':'lion-board-painted.webp','lion-face':'painted-lion-card.webp'})
ASSET_FILES.update({f'painted-{i:02}':f'painted-{i:02}.webp' for i in range(16)})
ASSET_FILES.update({f'elephant-film-{i:02}':f'elephant-film-{i:02}.webp' for i in range(13)})
ASSET_FILES['painted-elephant-portrait']='painted-elephant-portrait.webp'
if __name__=='__main__':
    assets={k:'data:image/webp;base64,'+base64.b64encode((ROOT/'assets'/file).read_bytes()).decode('ascii') for k,file in ASSET_FILES.items()}
    text='/* User-approved painted assets, embedded for offline use. */\nconst ART='+json.dumps(assets,separators=(',',':'))+';\n'
    text+="ART['painted-cover']=ART['painted-15'];\nART['capture-impact']=ART['capture-brush'];\n"
    (ROOT/'src/assets.js').write_text(text,encoding='utf-8')
    print(f'Embedded {len(assets)} images and 2 aliases.')
