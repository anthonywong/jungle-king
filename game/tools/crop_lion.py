"""Precisely matte the lion from approved frame 0; no redraw or new anatomy."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import json,base64
R=Path(__file__).resolve().parents[1]
im=Image.open(R/'assets/lion-vs-leopard/lion-vs-leopard-frame-00.webp').convert('RGBA')
outer=[(0,136),(17,126),(41,111),(53,106),(45,100),(56,91),(41,91),(57,84),(48,81),(64,75),(55,73),(73,64),(68,63),(77,62),(72,58),(88,50),(80,50),(86,46),(80,45),(102,37),(95,34),(112,32),(107,30),(120,31),(125,30),(131,35),(132,29),(141,34),(145,41),(150,38),(158,49),(160,56),(165,58),(169,60),(174,67),(171,75),(173,79),(172,84),(177,86),(177,91),(173,96),(171,99),(169,103),(169,106),(165,112),(157,116),(153,115),(156,123),(153,134),(149,135),(147,138),(143,144),(142,154),(139,160),(138,177),(139,188),(143,200),(148,204),(151,211),(151,216),(145,216),(137,214),(132,214),(124,213),(122,208),(119,202),(116,193),(115,175),(110,170),(106,165),(99,166),(99,179),(101,193),(107,201),(110,207),(111,213),(104,216),(96,214),(88,213),(81,213),(78,209),(77,205),(74,191),(70,180),(64,177),(60,179),(59,187),(60,195),(62,199),(65,201),(66,207),(61,210),(55,210),(49,209),(43,207),(41,204),(40,195),(40,184),(42,177),(38,170),(36,166),(31,168),(26,178),(21,187),(18,195),(17,201),(20,205),(20,210),(13,211),(2,211),(0,208)]
mask=Image.new('L',im.size,0);d=ImageDraw.Draw(mask);d.polygon(outer,fill=255)
for points in [[(24,169),(38,164),(41,181),(39,193),(41,201),(33,205),(21,202)],[(59,176),(65,174),(70,187),(74,201),(77,209),(65,207),(63,199),(59,194)],[(101,168),(111,164),(116,180),(116,198),(121,209),(111,210),(109,200),(103,194)]]:
 d.polygon(points,fill=0)
mask=mask.filter(ImageFilter.GaussianBlur(.35));im.putalpha(mask);out=im.crop((0,27,180,218));out.save(R/'assets/lion-board-painted.webp',lossless=True,method=6)
bg=Image.new('RGBA',(230,250),'#e5dcc9');bg.alpha_composite(out,(20,20));bg.convert('RGB').save(R/'lion-board-review.png')
p=R/'src/assets.js';s=p.read_text();a=json.loads(s[s.index('const ART=')+10:].strip().rstrip(';'));a['lion']='data:image/webp;base64,'+base64.b64encode((R/'assets/lion-board-painted.webp').read_bytes()).decode();p.write_text('/* Embedded approved artwork; no runtime network requests. */\nconst ART='+json.dumps(a,separators=(',',':'))+';\n')
