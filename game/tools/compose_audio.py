#!/usr/bin/env python3
"""Original 32-bar score and designed animal-call effects. Offline build tool.
Requires numpy, scipy, ffmpeg, libfluidsynth and a local General MIDI bank.
No bank is distributed. Default TimGM6mb instrument credit: licenses/TimGM6mb.txt.
All melodies, arrangements, foley and animal imitations are authored for this game.
The animal imitations are procedural sound design, NOT wildlife recordings.
"""
from pathlib import Path
import ctypes as C, ctypes.util, math, json, subprocess, wave, os
import numpy as np
from scipy.signal import butter,sosfilt, iirpeak, lfilter
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'audio';OUT.mkdir(exist_ok=True)
SR=32000; BPM=132; BEAT=60/BPM; BARS=32; SECONDS=BARS*4*BEAT
rng=np.random.default_rng(6128)
# A coherent, independently composed D-minor / pentatonic theme.
chords=[(50,[62,65,69]),(46,[62,65,70]),(53,[60,65,69]),(48,[60,64,67]),
        (50,[62,65,69]),(43,[62,67,70]),(46,[62,65,70]),(45,[61,64,69])]
melodies=[[(0,74,.7),(.75,77,.25),(1,81,.8),(2,79,.45),(2.5,77,.45),(3,74,.85)],
 [(0,77,.7),(1,74,.45),(1.5,72,.45),(2,74,1.3),(3.5,77,.4)],
 [(0,81,.9),(1,84,.7),(2,81,.45),(2.5,79,.45),(3,77,.85)],
 [(0,79,.7),(1,76,.7),(2,74,.45),(2.5,72,.45),(3,72,.85)],
 [(0,74,.4),(.5,77,.4),(1,81,1.3),(2.5,84,.4),(3,81,.85)],
 [(0,79,.7),(1,82,.4),(1.5,81,.4),(2,79,.45),(2.5,77,.45),(3,74,.85)],
 [(0,77,.9),(1,74,.7),(2,77,.45),(2.5,79,.45),(3,81,.85)],
 [(0,81,.65),(1,79,.35),(1.5,76,.35),(2,73,.8),(3,76,.4),(3.5,73,.4)]]
# channel: GM program, volume, pan; instrument presets are not redistributed.
programs={0:(48,75,38),1:(45,85,72),2:(77,88,79),3:(107,78,47),4:(60,66,55),5:(42,82,60),6:(47,83,64),7:(116,100,64),8:(48,50,91),10:(61,76,62)}
events={'score':[],'battle':[]}
def note(track,ch,key,b,dur,vel):
 b=float(b);dur=max(.035,float(dur));vel=int(np.clip(vel,1,122))
 events[track].append((b*BEAT,True,ch,int(key),vel));events[track].append(((b+dur)*BEAT,False,ch,int(key),0))
for bar in range(BARS):
 root,chord=chords[bar%8];b=bar*4;lift=bar>=8;quiet=16<=bar<20
 # Bowed bass grounds the harmonic rhythm, no pumping electronic bass.
 for beat in [0,2]: note('score',5,root-12,b+beat,1.75,65 if quiet else 78)
 # Staccato strings: 3+3+2 accents across eight eighth notes.
 arp=[chord[0],chord[2],chord[1],chord[0]+12,chord[2],chord[1],chord[2],chord[1]]
 for j,n in enumerate(arp):
  note('score',1,n-12 if quiet else n,b+j*.5,.27,45 if quiet else (79 if j in [0,3,6] else 57))
  if bar%4 in [1,3]:note('score',3,n+12,b+j*.5+.012,.45,41 if quiet else 53)
 # Sustained string voicing and a small stereo response.
 for n in chord:
  note('score',0,n,b,3.82,43 if quiet else 53)
  if lift and not quiet:note('score',8,n+12,b+.04,3.76,35)
 # Theme has rests and an answering phrase, rather than random endless arpeggios.
 lead=2 if bar<8 or quiet else 4
 for beat,key,dur in melodies[bar%8]:
  note('score',lead,key if lead==2 else key-12,b+beat,dur,73 if lead==2 else 83)
  if lift and not quiet:note('score',2,key,b+beat+.012,dur*.92,47)
 # Taiko/timpani main pulse: lighter during thinking; extra layers fade in for combat.
 for beat,vel in [(0,85),(1.5,55),(2,72),(3.5,57)]:
  if not quiet or beat in [0,2]:note('score',7,45 if beat in [0,2] else 52,b+beat,.42,vel-15)
 if bar%4==0:note('score',9,49,b,.7,48)
 for beat in [0,2]:note('score',6,root-12,b+beat,.7,55)
 # A synchronized percussion/brass stem; does not restart at every capture.
 for j in range(8):
  note('battle',7,43 if j in [0,4] else 52,b+j*.5,.3,111 if j in [0,4] else 75)
  note('battle',9,41 if j%2==0 else 45,b+j*.5,.25,88 if j%2==0 else 61)
 for beat in [1,3]:
  note('battle',9,38,b+beat,.18,86);note('battle',9,40,b+beat+.045,.12,47)
 for n in [root,root+7,root+12]:
  note('battle',10,n,b,.5,65);note('battle',10,n,b+2.5,.42,61)
 if bar%4==3:
  for j in range(4):note('battle',9,[47,45,43,41][j],b+3+j*.25,.18,74+j*6)
 if bar%4==0:note('battle',9,52,b,.8,87)
 for j in [1,3,5,7]:note('battle',9,42,b+j*.5,.10,37)

def bind(lib,name,restype,args):
 f=getattr(lib,name);f.restype=restype;f.argtypes=args;return f
lib=C.CDLL(ctypes.util.find_library('fluidsynth'))
ptr=C.c_void_p;I=C.c_int;D=C.c_double;S=C.c_char_p
new_settings=bind(lib,'new_fluid_settings',ptr,[])
setnum=bind(lib,'fluid_settings_setnum',I,[ptr,S,D]);setint=bind(lib,'fluid_settings_setint',I,[ptr,S,I])
new_synth=bind(lib,'new_fluid_synth',ptr,[ptr]);load=bind(lib,'fluid_synth_sfload',I,[ptr,S,I])
program=bind(lib,'fluid_synth_program_change',I,[ptr,I,I]);cc=bind(lib,'fluid_synth_cc',I,[ptr,I,I,I])
on=bind(lib,'fluid_synth_noteon',I,[ptr,I,I,I]);off=bind(lib,'fluid_synth_noteoff',I,[ptr,I,I])
write=bind(lib,'fluid_synth_write_float',I,[ptr,I,ptr,I,I,ptr,I,I])
delsyn=bind(lib,'delete_fluid_synth',None,[ptr]);delset=bind(lib,'delete_fluid_settings',None,[ptr])
def render_score(track):
 s=new_settings();setnum(s,b'synth.sample-rate',SR);setnum(s,b'synth.gain',.48);setnum(s,b'synth.reverb.room-size',.72);setnum(s,b'synth.reverb.damp',.42);setnum(s,b'synth.reverb.level',.20);setnum(s,b'synth.chorus.level',.32);setint(s,b'synth.polyphony',256)
 sy=new_synth(s);sf=os.environ.get('SOUNDFONT','/usr/share/sounds/sf2/TimGM6mb.sf2')
 assert load(sy,sf.encode(),1)>=0
 for ch,(pr,vol,pan) in programs.items():
  program(sy,ch,pr);cc(sy,ch,7,vol);cc(sy,ch,10,pan);cc(sy,ch,91,42)
 cc(sy,9,7,90)
 n=round(SECONDS*SR);ev=[]
 for rep in range(2):
  for t,is_on,ch,key,vel in events[track]:ev.append((round(t*SR)+rep*n,is_on,ch,key,vel))
 ev.sort(key=lambda x:(x[0],x[1]));output=np.zeros((n*2,2),np.float32);pos=0
 def generate(end):
  nonlocal pos
  while pos<end:
   count=min(end-pos,8192);l=np.empty(count,np.float32);r=np.empty(count,np.float32)
   write(sy,count,l.ctypes.data,0,1,r.ctypes.data,0,1)
   output[pos:pos+count,0]=l;output[pos:pos+count,1]=r;pos+=count
 for sample,is_on,ch,key,vel in ev:
  if sample>=len(output):break
  generate(sample)
  (on(sy,ch,key,vel) if is_on else off(sy,ch,key))
 generate(len(output));delsyn(sy);delset(s)
 # Second cycle contains the preceding reverberation at the loop boundary.
 return output[n:]
def savewav(name,x,sr=SR,peak=.88):
 x=np.asarray(x,dtype=np.float64);x=np.nan_to_num(x);m=np.max(np.abs(x))
 if m:x=x/m*peak
 data=np.clip(x,-.999,.999)
 with wave.open(str(OUT/(name+'.wav')),'wb') as w:
  w.setnchannels(1 if data.ndim==1 else data.shape[1]);w.setsampwidth(2);w.setframerate(sr);w.writeframes((data*32767).astype('<i2').tobytes())
 return data
for tr in ['score','battle']:
 x=render_score(tr)
 savewav('mountain-'+tr,x,peak=.70 if tr=='score' else .60)
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(OUT/f'mountain-{tr}.wav'),'-codec:a','libmp3lame','-b:a','128k',str(OUT/f'mountain-{tr}.mp3')],check=True)
 print('Rendered',tr,len(x)/SR,flush=True)
# Formant-shaped, irregular vocal sources, distinct for each species.
def filt(x,hz,kind='lowpass',order=2):return sosfilt(butter(order,hz,btype=kind,fs=SR,output='sos'),x)
def contour(t,points):return np.interp(t,[p[0] for p in points],[p[1] for p in points])
def resonances(x,freqs):
 out=np.zeros_like(x)
 for f,q,a in freqs:
  b,c=iirpeak(f,q,fs=SR);out+=lfilter(b,c,x)*a
 return out
for rank in range(1,9):
 dur={1:.5,2:.85,3:.72,4:1.45,5:1.05,6:1.35,7:1.6,8:1.55}[rank];t=np.arange(round(dur*SR))/SR;u=t/dur
 no=rng.normal(size=len(t));jitter=filt(no,35);jitter/=max(.001,jitter.std())
 if rank==8:
  hz=contour(u,[(0,165),(.13,285),(.28,430),(.65,400),(.86,310),(1,190)])
  hz*=1+.009*jitter+.018*np.sin(2*np.pi*18*t)
  phase=2*np.pi*np.cumsum(hz)/SR
  source=sum(np.sin(phase*k+.11*np.sin(2*np.pi*31*t))/k**.85 for k in range(1,24))
  x=resonances(source,[(650,.9,2.3),(1250,1.4,2.2),(2300,1.3,1.5),(3400,1.2,.6)])
  breath=filt(no,[450,2400],'bandpass')*.35
  env=np.sin(np.pi*np.clip(u,0,1))**.55*(.80+.20*np.sin(2*np.pi*23*t)**2)
  x=(np.tanh(x*1.8)+breath)*env
  x+=np.sin(2*np.pi*47*t)*np.sin(np.pi*u)**2*.23
 elif rank==1:
  hz=contour(u,[(0,2300),(.2,3450),(.42,2400),(.55,3100),(1,1700)])
  phase=2*np.pi*np.cumsum(hz)/SR;env=(np.exp(-((u-.22)/.14)**2)+.7*np.exp(-((u-.67)/.11)**2))
  x=(np.sin(phase)+.2*np.sin(phase*2))*env
 else:
  f={2:240,3:115,4:175,5:90,6:69,7:57}[rank]
  hz=f*contour(u,[(0,.78),(.15,1.45),(.45,1.04),(.78,.82),(1,.60)])
  hz*=1+.03*jitter+.022*np.sin(2*np.pi*25*t)
  phase=2*np.pi*np.cumsum(hz)/SR
  source=sum(np.sin(phase*k+.06*k*np.sin(2*np.pi*41*t))/k**1.0 for k in range(1,31))
  if rank>=5:
   form=[(280,1.3,2),(560,1.0,2.5),(1100,1.0,1.0),(2200,1.0,.5)]
   rough=(.55+.45*np.sin(2*np.pi*(31 if rank==7 else 39)*t)**2)
   breath=filt(no,[85,1450],'bandpass')*.50
   env=contour(u,[(0,0),(.07,.95),(.2,1),(.38,.63),(.47,.95),(.7,.55),(.84,.65),(1,0)])
  elif rank==4:
   form=[(500,1.8,2),(1050,1.5,1.4),(1900,1.3,.6)];rough=.9+.1*np.sin(2*np.pi*5*t);breath=filt(no,[500,2200],'bandpass')*.13;env=np.sin(np.pi*u)**.6
  elif rank==3:
   form=[(420,1.1,2),(1050,1.2,1.5),(2400,1,.8)];rough=.6+.4*np.sin(2*np.pi*44*t)**2;breath=filt(no,[250,2300],'bandpass')*.35;env=np.exp(-((u-.14)/.12)**2)+.85*np.exp(-((u-.65)/.13)**2)
  else:
   form=[(820,1.4,2),(1500,1.2,1.1),(2600,1.1,.6)];rough=.86+.14*np.sin(2*np.pi*23*t);breath=filt(no,[1700,4800],'bandpass')*.25;env=np.sin(np.pi*u)**.65
  x=(np.tanh(resonances(source,form)*1.8)*rough+breath)*env
  if rank>=5:x+=np.sin(phase*.5)*env*.36
 # Silence-safe, short fade at both ends; tiny room tail baked in.
 x=filt(x,6500);x[:160]*=np.linspace(0,1,160);x[-640:]*=np.linspace(1,0,640)
 savewav('call-'+str(rank),x,peak=.78)
print('Rendered eight designed animal voices.',flush=True)
(OUT/'score-info.json').write_text(json.dumps({'title':'踏嶽行軍','bpm':BPM,'bars':BARS,'duration':SECONDS,'sampleRate':SR,'description':'Original D-minor theme; strings, shakuhachi-like melody, koto, low brass, taiko and timpani. Synchronized adaptive battle stem. Animal calls are synthesized imitations, not field recordings.'},ensure_ascii=False,indent=2))
