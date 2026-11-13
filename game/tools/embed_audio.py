#!/usr/bin/env python3
from pathlib import Path
import base64,json
R=Path(__file__).resolve().parents[1]
a={}
for p in sorted((R/'audio').glob('*')):
 if p.name.startswith('call-') and p.suffix=='.wav':a[p.stem]='data:audio/wav;base64,'+base64.b64encode(p.read_bytes()).decode()
 if p.suffix=='.mp3' and p.stem in ['mountain-score','mountain-battle']:a[p.stem]='data:audio/mpeg;base64,'+base64.b64encode(p.read_bytes()).decode()
assert len(a)==10,'Expected two music stems and eight calls'
(R/'src/audio-assets.js').write_text('const AUDIO_ART='+json.dumps(a,separators=(',',':'))+';\nconst SCORE_SECONDS=58.1818125;\n')
print('Embedded',len(a),'audio assets')
