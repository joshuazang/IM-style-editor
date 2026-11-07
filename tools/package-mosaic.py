"""Build Mosaic from its interface and the same canonical core as the IM editor."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from shared_core import core_source, core_digest, release_config, ui_script, ui_styles, ui_digest

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'mosaic'
VERSION = release_config()['mosaic_version']
BASE = 'https://joshuazang.github.io/IM-style-editor/'
script = ('"use strict";\nconst MOSAIC_VERSION=' + json.dumps(VERSION) + ';\n' + core_source() + ui_script() + '\n' +
          '\n'.join((TARGET / 'src' / name).read_text() for name in ['relay.js','model.js','icons.js','app.js'])).encode()
style = ((TARGET / 'src/styles.css').read_text()+'\n'+ui_styles('mosaic')).encode()
files = {}
for data, suffix in [(script,'.js'),(style,'.css')]:
    name = 'assets/mosaic-' + hashlib.sha256(data).hexdigest()[:12] + suffix
    (TARGET / name).write_bytes(data);files[name]=data
    if suffix == '.js': js_path=name
    else: css_path=name
# Retain published fingerprinted assets for cached pages. The install ZIP below
# contains only this release's assets, so installed size does not grow.
html = (TARGET/'index.template.html').read_text().replace('__JS__','./'+js_path).replace('__CSS__','./'+css_path).replace('__VERSION__',VERSION)
html = html.replace('</head>',f'<meta name="im-shared-core" content="{core_digest()}">\n<meta name="im-shared-ui" content="{ui_digest()}">\n</head>')
(TARGET/'index.html').write_text(html);files['index.html']=html.encode()
files['icon.svg']=(TARGET/'icon.svg').read_bytes()
metadata={'identifier':'com.joshuazang.mosaic','name':'Mosaic','content_type':'SN|Component','area':'editor-editor','version':VERSION,
          'description':'A private plain-text card board sharing the same format-3 core as IM-style-editor.',
          'url':BASE+'mosaic/index.html?v='+VERSION,'download_url':BASE+'Mosaic-'+VERSION+'.zip',
          'latest_url':BASE+'mosaic.ext.json','marketing_url':'https://github.com/joshuazang/IM-style-editor/tree/main/mosaic','thumbnail_url':BASE+'mosaic/icon.svg'}
encoded=(json.dumps(metadata,indent=2)+'\n').encode()
for name in ['mosaic.ext.json','mosaic-'+VERSION+'.ext.json']:(ROOT/name).write_bytes(encoded)
# Also retain the relative install link on the standalone preview page.
(TARGET/'mosaic.ext.json').write_bytes(encoded);files['mosaic.ext.json']=encoded
files['NOTICE.md']=(TARGET/'NOTICE.md').read_bytes()
entries={'Mosaic-'+VERSION+'/dist/'+name:data for name,data in files.items()}
entries['Mosaic-'+VERSION+'/package.json']=(json.dumps({'name':'mosaic-standard-notes','version':VERSION,'private':True,'sn':{'main':'dist/index.html'}},indent=2)+'\n').encode()
with ZipFile(ROOT/('Mosaic-'+VERSION+'.zip'),'w',ZIP_DEFLATED) as archive:
    for name,data in sorted(entries.items()):
        info=ZipInfo(name,date_time=(2020,1,1,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o644<<16;archive.writestr(info,data)
with ZipFile(ROOT/('Mosaic-'+VERSION+'.zip')) as archive:
    assert archive.testzip() is None
    for name,data in entries.items():assert archive.read(name)==data
print('Packaged Mosaic '+VERSION+' with shared core '+core_digest()[:12])
