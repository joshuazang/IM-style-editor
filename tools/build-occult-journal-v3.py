"""Build one genuinely periodic SVG field from original, complete illustrations.

Development only: Pillow, NumPy, SciPy, node-potrace 2.1.8. The installed plugin
ships only static vector paths. No source images or conversion code run there.
"""
import argparse,hashlib,json,math,random,re,subprocess,tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.fft import rfft2,irfft2
p=argparse.ArgumentParser();p.add_argument('sheets',nargs=2,type=Path);p.add_argument('--heroes',required=True,type=Path);p.add_argument('--potrace',required=True,type=Path);p.add_argument('--output',type=Path,default=Path('next/assets/occult-field-journal-v3.svg'));a=p.parse_args()
W,H,G=1254,1881,3;gw,gh=W//G,H//G;rng=random.Random(0xC7A1F13);motifs=[]
def cuts(ink,axis,n):
 length=ink.shape[axis];projection=ink.sum(axis=1-axis);result=[0]
 for i in range(1,n):
  center=length*i/n;radius=length/n*.17;lo=int(center-radius);hi=int(center+radius)
  values=projection[lo:hi];best=np.flatnonzero(values==values.min());result.append(lo+int(best[len(best)//2]))
 return result+[length]
for sheetIndex,source in enumerate(a.sheets):
 rgba=np.asarray(Image.open(source).convert('RGBA'),dtype=float);alpha=rgba[:,:,3]/255
 gray=rgba[:,:,:3].mean(axis=2)*alpha+255*(1-alpha);ink=gray<160
 rows,cols=cuts(ink,0,5),cuts(ink,1,6)
 for row in range(5):
  for col in range(6):
   part=ink[rows[row]:rows[row+1],cols[col]:cols[col+1]].copy();labels,n=ndimage.label(part);sizes=np.bincount(labels.ravel());part&=sizes[labels]>=6
   yy,xx=np.nonzero(part);assert len(xx)>40,(sheetIndex,row,col)
   part=part[yy.min():yy.max()+1,xx.min():xx.max()+1];part=np.pad(part,3)
   silhouette=ndimage.binary_fill_holes(ndimage.binary_closing(part,iterations=2))
   # Fill enclosed interiors but leave real space between tentacles/branches.
   motifs.append({'id':f'illustration-{sheetIndex*30+row*6+col:02d}','ink':part,'mask':silhouette,'w':part.shape[1],'h':part.shape[0]})
# Sweeping primary forms have genuinely different proportions: long horizontal
# creatures, a trailing jellyfish, a narrow botanical stem and a slender key.
rgba=np.asarray(Image.open(a.heroes).convert('RGBA'),dtype=float);alpha=rgba[:,:,3]/255
heroInk=(rgba[:,:,:3].mean(axis=2)*alpha+255*(1-alpha))<160
heroNames=['squid','frond','whale','jellyfish','serpent','key']
heroTargets=[570,520,490,520,520,390]
heroPositions=[(.36,.18),(.08,.49),(.72,.48),(.86,.85),(.30,.82),(.68,.06)]
heroAngles=[11,-9,-13,5,15,11];heroes=[]
for row,(top,bottom) in enumerate([(0,387),(387,865),(865,1254)]):
 for col,(left,right) in enumerate([(0,865),(865,1254)]):
  i=row*2+col;part=heroInk[top:bottom,left:right].copy();labels,n=ndimage.label(part);sizes=np.bincount(labels.ravel());part&=sizes[labels]>=5
  yy,xx=np.nonzero(part);part=np.pad(part[yy.min():yy.max()+1,xx.min():xx.max()+1],3)
  ax,ay=(.63,1.15) if i==1 else (.72,1.15) if i==5 else (1,1)
  scale=heroTargets[i]/(part.shape[0]*ay if i in [1,3,5] else part.shape[1]*ax)
  hero={'id':'hero-'+heroNames[i],'ink':part,'mask':ndimage.binary_fill_holes(ndimage.binary_closing(part,iterations=2)),'w':part.shape[1],'h':part.shape[0],'ax':ax,'ay':ay,'preferred':scale,'position':heroPositions[i],'angle':heroAngles[i]}
  heroes.append(hero)
for m in motifs:
 # Deliberately broad size hierarchy, not a field of equally sized icons.
 target=rng.choices([90,115,145,180,215],[12,30,34,18,6])[0]
 m['preferred']=target/max(m['w'],m['h']);m['ax']=m['ay']=1
bank=motifs;motifs=heroes+bank
# Vectorize every complete drawing independently; there is no panel join.
script=r'''const fs=require('fs'),path=require('path');const P=require(process.argv[1]),B=require(path.join(path.dirname(process.argv[1]),'types/Bitmap'));const list=JSON.parse(fs.readFileSync(process.argv[2]));const out=[];for(const item of list){const p=new P({threshold:128,turdSize:4,optTolerance:.4,alphaMax:1.1,optCurve:true});p._luminanceData=new B(item.w,item.h);p._luminanceData.data.set(fs.readFileSync(item.file));p._imageLoaded=true;out.push(p.getPathTag('currentColor'));}process.stdout.write(JSON.stringify(out));'''
with tempfile.TemporaryDirectory() as temp:
 jobs=[]
 for i,m in enumerate(motifs):
  path=Path(temp)/f'{i}.bin';path.write_bytes(np.where(m['ink'],0,255).astype(np.uint8).tobytes());jobs.append({'w':m['w'],'h':m['h'],'file':str(path)})
 spec=Path(temp)/'jobs.json';spec.write_text(json.dumps(jobs));vectors=json.loads(subprocess.check_output(['node','-e',script,str(a.potrace.resolve()),str(spec)],text=True))
def compact_path(vector):
 match=re.search(r'd="([^"]+)"',vector);tokens=re.findall(r'[MCL]|-?\d+(?:\.\d+)?',match[1]);parts=[];cursor=0;point=(0.,0.);previous=''
 def number(value):
  text=f'{value:.1f}'.rstrip('0').rstrip('.');text=text.replace('-0.','-.');return text[1:] if text.startswith('0.') else ('0' if text=='-0' else text)
 while cursor<len(tokens):
  command=tokens[cursor];cursor+=1;count={'M':2,'C':6,'L':4}[command];values=list(map(float,tokens[cursor:cursor+count]));cursor+=count
  if command=='C':relative=[values[j]-point[j%2] for j in range(6)]
  elif command=='M':relative=[values[0]-point[0],values[1]-point[1]]
  else:relative=[values[0]-point[0],values[1]-point[1],values[2]-values[0],values[3]-values[1]]
  point=tuple(values[-2:]);letter=command.lower();body=''
  for value in relative:
   text=number(value)
   if body and not text.startswith('-'):body+=' '
   body+=text
  parts.append((' ' if letter==previous and letter!='m' else letter)+body);previous=letter
 return vector[:match.start(1)]+''.join(parts)+vector[match.end(1):]
for m,vector in zip(motifs,vectors):
 m['vector']=re.sub(r'\d+\.\d+',lambda value:str(round(float(value[0]),1)).removesuffix('.0'),vector)
 m['vector']=compact_path(m['vector'])
 if m['id'].startswith('hero-'):m['vector']=m['vector'].replace('stroke="none"','stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"')
occupied=np.zeros((gh,gw),dtype=bool);placements=[]
def candidates(m,scale,angle):
 mask=ndimage.zoom(m['mask'].astype(np.uint8),(scale*m['ay'],scale*m['ax']),order=0)>0;mask=ndimage.rotate(mask,-angle,reshape=True,order=0)>0
 # Conservative grid occupancy keeps the vector contours separated.
 mask=ndimage.binary_dilation(mask,iterations=3);hh,ww=mask.shape
 pad=np.pad(mask,((0,(-hh)%G),(0,(-ww)%G)));coarse=pad.reshape(pad.shape[0]//G,G,pad.shape[1]//G,G).max(axis=(1,3))
 kernel=np.zeros((gh,gw));kernel[:coarse.shape[0],:coarse.shape[1]]=coarse
 overlap=irfft2(rfft2(occupied)*np.conj(rfft2(kernel)),s=occupied.shape)
 valid=np.flatnonzero(overlap<.1)
 return mask,coarse,valid
order=list(bank);rng.shuffle(order);order.sort(key=lambda m:m['mask'].sum()*m['preferred']**2,reverse=True);order=heroes+order
for index,m in enumerate(order):
 preferred=m['preferred'];found=None
 for factor in [1,.92,.84,.76,.68,.6,.52,.44,.36]:
  scale=preferred*factor
  for angle in ([m['angle']] if 'angle' in m else [rng.uniform(-21,21),rng.uniform(-14,14),0]):
   mask,coarse,valid=candidates(m,scale,angle)
   if len(valid):
    if 'position' in m:
     vy,vx=np.divmod(valid,gw);tx=m['position'][0]*gw-mask.shape[1]/G/2;ty=m['position'][1]*gh-mask.shape[0]/G/2
     dx=np.abs(vx-tx);dy=np.abs(vy-ty);score=np.minimum(dx,gw-dx)**2+np.minimum(dy,gh-dy)**2;chosen=int(valid[int(np.argmin(score))]);y,x=divmod(chosen,gw)
    else:y,x=divmod(int(valid[rng.randrange(len(valid))]),gw)
    found=(x,y,scale,angle,mask,coarse);break
  if found:break
 if not found:raise RuntimeError('Cannot place complete illustration '+m['id'])
 x,y,scale,angle,mask,coarse=found
 ys,xs=np.nonzero(coarse);occupied[(ys+y)%gh,(xs+x)%gw]=True
 placements.append({'id':m['id'],'x':x*G+mask.shape[1]/2,'y':y*G+mask.shape[0]/2,'scale':scale,'angle':angle,'w':m['w'],'h':m['h'],'ax':m['ax'],'ay':m['ay'],'rx':mask.shape[1]/2+5,'ry':mask.shape[0]/2+5})
 print('Placed',index+1,m['id'],round(scale,2),flush=True)
# Draw little original details directly as vectors, in the remaining irregular gaps.
small=[
 ('sprig','M0 22C-6 7-2-7 4-24M-1 11C-20 13-24 2-21-4C-12-6-5 0-1 11M0 0C17 1 24-9 18-17C8-17 3-11 0 0M3-12C-8-11-13-20-9-26C-1-26 4-20 3-12',33),
 ('coral','M1 25C-4 8 5-7 0-26M0 11C-14 11-23 1-20-9M-12 8C-11 0-9-7-13-13M1 0C15-1 24-10 20-20M11-4C12-14 8-17 10-24M0-13C-9-15-13-22-9-28',33),
 ('shell','M22 18C-4 32-30 10-23-13C-15-35 21-31 27-10C32 7 7 20-6 8C-17-3-3-18 8-10C17-4 6 7 1 0M20 19L26 28M-25 1L-15-1M-20-17L-11-10M-4-29L-2-17M15-25L10-15M27-8L17-5',36),
 ('curl','M-24 12C-13 16-10-7 2-7C18-7 22 10 10 15C0 19-6 2 4 2M-14 24C0 20 10 25 22 21',30),
 ('moon','M11-27C-24-26-31 17-1 28C-14 12-7-8 11-27ZM17-7Q19 1 27 3Q19 5 17 13Q15 5 7 3Q15 1 17-7Z',33),
 ('star','M0-16Q3-3 16 0Q3 3 0 16Q-3 3-16 0Q-3-3 0-16Z',18),
 ('leaf','M-12 14C-20-9-3-23 14-16C18 2 6 17-12 14ZM-12 14Q-2 1 9-12',24),
 ('bubble','M8 0A8 8 0 1 1-8 0A8 8 0 1 1 8 0M-2-3Q0-6 3-3',10),
]
pad=60;distance=ndimage.distance_transform_edt(~np.pad(occupied,pad,mode='wrap'))[pad:pad+gh,pad:pad+gw]*G
for index in range(450):
 maximum=distance.max()
 if maximum<9:break
 valid=np.flatnonzero(distance>=maximum-.3);y,x=divmod(int(valid[rng.randrange(len(valid))]),gw)
 name,path,r=small[index%len(small)];radius=min(37,maximum-4,r*1.25);scale=radius/r
 placements.append({'id':'detail-'+name,'x':x*G,'y':y*G,'scale':scale,'angle':rng.uniform(-24,24),'w':0,'h':0,'rx':radius+4,'ry':radius+4})
 reserve=radius+4
 for dx in [-gw,0,gw]:
  for dy in [-gh,0,gh]:
   cx,cy=x+dx,y+dy;reach=int((reserve+maximum+10)/G);lo=max(0,cx-reach);hi=min(gw,cx+reach+1);top=max(0,cy-reach);bottom=min(gh,cy+reach+1)
   if lo>=hi or top>=bottom:continue
   yy,xx=np.ogrid[top:bottom,lo:hi];d=np.maximum(0,np.hypot(xx-cx,yy-cy)*G-reserve);distance[top:bottom,lo:hi]=np.minimum(distance[top:bottom,lo:hi],d)
uses=[];crossX=crossY=0
for item in placements:
 # Normalize centers before emitting translated continuations on all edges.
 x,y=item['x']%W,item['y']%H
 if item['id'].startswith(('illustration','hero-')):
  crossX+=x-item['rx']<0 or x+item['rx']>W;crossY+=y-item['ry']<0 or y+item['ry']>H
 for dx in [-W,0,W]:
  for dy in [-H,0,H]:
   px,py=x+dx,y+dy
   if px+item['rx']<0 or px-item['rx']>W or py+item['ry']<0 or py-item['ry']>H:continue
   transform=f'translate({px:.1f} {py:.1f}) rotate({item["angle"]:.1f}) scale({item["scale"]*item.get("ax",1):.4f} {item["scale"]*item.get("ay",1):.4f}) translate({-item["w"]/2:.1f} {-item["h"]/2:.1f})'
   uses.append(f'<use href="#{item["id"]}" transform="{transform}"/>')
assert crossX>=3 and crossY>=3,(crossX,crossY)
defs=''.join(f'<g id="{m["id"]}">{m["vector"]}</g>' for m in motifs)
defs+=''.join(f'<path id="detail-{name}" d="{path}" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>' for name,path,r in small)
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" color="#746b60" shape-rendering="geometricPrecision"><title>Occult Field Journal — a continuous field of curiosities</title><desc>Sweeping sea creatures, trailing plants and sixty smaller curiosities interlock on one periodic field. Whole drawings continue across every edge by exact translation; no image panels, border strips, mirrored motifs or inverted artwork. Static Bezier vectors only.</desc><defs>{defs}</defs><g fill="currentColor" opacity=".18">{''.join(uses)}</g></svg>\n'''
a.output.write_text(svg)
metadata={'canvas':[W,H],'major_illustrations':len(motifs),'detail_placements':len(placements)-len(motifs),'edge_crossing_major_illustrations':{'horizontal':int(crossX),'vertical':int(crossY)},'bytes':len(svg.encode()),'sha256':hashlib.sha256(svg.encode()).hexdigest(),'source_sha256':[hashlib.sha256(s.read_bytes()).hexdigest() for s in [*a.sheets,a.heroes]]}
Path('/tmp/occult-packing.json').write_text(json.dumps(metadata,indent=2));print(json.dumps(metadata),flush=True)
