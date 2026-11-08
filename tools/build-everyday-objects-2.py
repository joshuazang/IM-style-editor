"""Pack directly authored SVG drawings into a continuous repeating field.

Optional development dependencies: Playwright/Chromium, Pillow, NumPy, SciPy.
The plugin ships only the resulting SVG; no raster image or layout code runs in it.
"""
import hashlib,json,math,random,re,subprocess,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.fft import rfft2,irfft2
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tests'))
from browser_engine import chromium_options
subprocess.run(['node',str(ROOT/'tools/draw-everyday-objects-2.mjs')],check=True)
temp=Path('/tmp/everyday-objects-2');source=json.loads((temp/'source.json').read_text());cell=source['cell']
with sync_playwright() as pw:
 browser=pw.chromium.launch(**chromium_options());page=browser.new_page(viewport={'width':source['columns']*cell,'height':math.ceil(len(source['motifs'])/source['columns'])*cell},device_scale_factor=1)
 page.set_content('<html><body style="margin:0;background:white">'+(temp/'atlas.svg').read_text()+'</body></html>');page.screenshot(path=str(temp/'atlas.png'));browser.close()
atlas=np.asarray(Image.open(temp/'atlas.png').convert('L'))<160
motifs=[]
for i,info in enumerate(source['motifs']):
 x=i%source['columns']*cell;y=i//source['columns']*cell;ink=atlas[y:y+cell,x:x+cell];yy,xx=np.nonzero(ink)
 assert len(xx)>15,info['id']
 left,right,top,bottom=xx.min(),xx.max()+1,yy.min(),yy.max()+1
 mask=np.pad(ink[top:bottom,left:right],4);mask=ndimage.binary_fill_holes(ndimage.binary_closing(mask,iterations=1))
 motifs.append({**info,'mask':mask,'cx':(left+right)/2-(cell-info['w'])/2,'cy':(top+bottom)/2-(cell-info['h'])/2})
W,H,G=source['width'],source['height'],3;gw,gh=W//G,H//G;rng=random.Random(0xE0B2);occupied=np.zeros((gh,gw),bool);placements=[]
# Familiar small motifs recur sparingly, as they do in the original wallpaper.
order=motifs+[dict(m,scale=m['scale']*.76) for m in motifs[:12]]
for m in order:m['preferred']=m['scale']*(1.1+rng.random()*.18)
order.sort(key=lambda m:m['mask'].sum()*m['preferred']**2,reverse=True)
for i,m in enumerate(order):
 placed=None
 for factor in [1,.93,.86,.79,.72,.65,.58]:
  scale=m['preferred']*factor
  for angle in [rng.uniform(-22,22),rng.uniform(-15,15),0]:
   mask=ndimage.zoom(m['mask'].astype(np.uint8),scale,order=0)>0;mask=ndimage.rotate(mask,-angle,reshape=True,order=0)>0;mask=ndimage.binary_dilation(mask,iterations=2)
   hh,ww=mask.shape;pad=np.pad(mask,((0,(-hh)%G),(0,(-ww)%G)));coarse=pad.reshape(pad.shape[0]//G,G,pad.shape[1]//G,G).max(axis=(1,3))
   kernel=np.zeros((gh,gw));kernel[:coarse.shape[0],:coarse.shape[1]]=coarse
   overlap=irfft2(rfft2(occupied)*np.conj(rfft2(kernel)),s=occupied.shape);valid=np.flatnonzero(overlap<.1)
   if not len(valid):continue
   if i==0:y=int(.22*gh);x=(gw-coarse.shape[1]//2)%gw
   elif i==1:y=(gh-coarse.shape[0]//2)%gh;x=int(.47*gw)
   else:y,x=divmod(int(valid[rng.randrange(len(valid))]),gw)
   # The two initial crossing placements are also collision checked.
   if overlap[y,x]>=.1:continue
   placed=(x,y,scale,angle,mask,coarse);break
  if placed:break
 if not placed:raise RuntimeError('Could not place '+m['id'])
 x,y,scale,angle,mask,coarse=placed;ys,xs=np.nonzero(coarse);occupied[(ys+y)%gh,(xs+x)%gw]=True
 placements.append({'id':m['id'],'x':x*G+mask.shape[1]/2,'y':y*G+mask.shape[0]/2,'scale':scale,'angle':angle,'cx':m['cx'],'cy':m['cy'],'rx':mask.shape[1]/2+5,'ry':mask.shape[0]/2+5})
fillers=[
 ('spark','M0-9Q2-2 9 0Q2 2 0 9Q-2 2-9 0Q-2-2 0-9Z',11),
 ('heart','M0 8C-22-5-8-16 0-8C8-16 22-5 0 8Z',15),
 ('leaf','M-8 10C-15-5-3-16 10-11C12 1 3 13-8 10ZM-8 10L7-8',17),
 ('curl','M-12 8C-19-11 10-20 14-5C18 7-5 13-5 1C-5-5 5-8 7-2',18),
 ('note','M-2-11V8C-2 16-14 16-14 8C-14 1-2 2-2 8M-2-11L11-7',16),
 ('bubble','M4 0A4 4 0 1 1-4 0A4 4 0 1 1 4 0',5),
 ('dash','M-8 0Q0-5 8 0',10)
]
pad=50;distance=ndimage.distance_transform_edt(~np.pad(occupied,pad,mode='wrap'))[pad:pad+gh,pad:pad+gw]*G
for i in range(190):
 maximum=distance.max()
 if maximum<10:break
 valid=np.flatnonzero(distance>maximum-.4);y,x=divmod(int(valid[rng.randrange(len(valid))]),gw);name,path,r=fillers[i%len(fillers)];radius=min(maximum-4,r*1.05);scale=radius/r
 placements.append({'id':'detail-'+name,'x':x*G,'y':y*G,'scale':scale,'angle':rng.uniform(-22,22),'cx':0,'cy':0,'rx':radius+3,'ry':radius+3})
 reserve=radius+4
 for dx in [-gw,0,gw]:
  for dy in [-gh,0,gh]:
   cx,cy=x+dx,y+dy;reach=int((reserve+maximum+4)/G);lo=max(0,cx-reach);hi=min(gw,cx+reach+1);top=max(0,cy-reach);bottom=min(gh,cy+reach+1)
   if lo>=hi or top>=bottom:continue
   yy,xx=np.ogrid[top:bottom,lo:hi];d=np.maximum(0,np.hypot(xx-cx,yy-cy)*G-reserve);distance[top:bottom,lo:hi]=np.minimum(distance[top:bottom,lo:hi],d)
uses=[]
for item in placements:
 x,y=item['x']%W,item['y']%H
 for dx in [-W,0,W]:
  for dy in [-H,0,H]:
   px,py=x+dx,y+dy
   if px+item['rx']<0 or px-item['rx']>W or py+item['ry']<0 or py-item['ry']>H:continue
   uses.append(f'<use href="#{item["id"]}" transform="translate({px:.1f} {py:.1f}) rotate({item["angle"]:.1f}) scale({item["scale"]:.4f}) translate({-item["cx"]:.1f} {-item["cy"]:.1f})"/>')
details=''.join(f'<path id="detail-{name}" d="{path}"/>' for name,path,r in fillers)
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" fill="none" stroke="#4f746a" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><title>Everyday Objects 2</title><desc>The original thirteen familiar drawings with twenty-eight directly authored additions. Varied long, tall, broad and curved silhouettes arranged on one wrapping field. Edge continuations use exact translations, never mirrored or inverted drawings. Static SVG vectors only.</desc><defs>{source['defs']}{details}</defs><g opacity=".145">{''.join(uses)}</g></svg>\n'''
target=ROOT/'next/assets/everyday-objects-2.svg';target.write_text(svg)
metadata={'asset':'next/assets/everyday-objects-2.svg','canvas':[W,H],'display_tile_css_pixels':[540,756],'original_illustrations':13,'new_illustrations':28,'main_placements':len(order),'small_details':len(placements)-len(order),'svg_bytes':len(svg.encode()),'svg_sha256':hashlib.sha256(svg.encode()).hexdigest(),'original_sha256':hashlib.sha256((ROOT/'assets/chat-wallpaper-CalFkYM7.svg').read_bytes()).hexdigest(),'construction':'Direct SVG curves. Actual-silhouette periodic packing; exact translated continuations on all edges. No bitmap, fonts, scripts, filters or external resources in the installed artwork.'}
(ROOT/'artwork/everyday-objects-2.json').write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps(metadata),flush=True)
