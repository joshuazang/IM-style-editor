"""Build the independent format-3 editor. Root index/identifier remain Archive."""
import hashlib
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from shared_core import core_source, core_digest, release_config, ui_script, ui_styles, ui_digest

ROOT = Path(__file__).resolve().parents[1]
VERSION = sys.argv[1] if len(sys.argv)>1 else release_config()['im_version']
if not re.fullmatch(r'\d+\.\d+\.\d+', VERSION):
    raise SystemExit('Expected a release version')
BASE = 'https://joshuazang.github.io/IM-style-editor/'
TARGET = ROOT / 'next'
ASSETS = TARGET / 'assets'
ASSETS.mkdir(exist_ok=True)
# The measurement helper is also used by Archive. All other UI source
# belongs to the current IM editor and must be present at build time.
HELPERS = [
    'context-menu.js', 'transfer-ui.js', 'editor-interactions.js',
    'reply-ui.js', 'emoji-management.js', 'virtual-messages.js',
    'status-clear.js', 'message-merge.js', 'selection-memory.js',
    'silent-timer.js', 'note-sessions.js', 'selection-touch.js',
    'search-filters.js',
]
helper_paths = [ROOT / 'src/message-spacing.js', *(TARGET / 'src' / name for name in HELPERS)]
# Reuse the immutable React/SDK build prefix; only the application runtime is forked.
# This source file is packaged in full, so the installed editor has no dependency on Archive.
seed = (ROOT / 'assets/index-ca276a0e4a5e.js').read_text().split('/* IM_NOTE_HELPERS_END */', 1)[1].lstrip()
prefix = seed[:seed.index('function lv(')]
# Keep the immutable Archive SDK untouched. The new editor only retains lean
# reply callbacks instead of a deep copy of every outgoing note and keystroke.
history = '},E=JSON.parse(JSON.stringify(o));let N;E.callback=U,this.sentMessages.push(E),N='
assert prefix.count(history) == 1, 'SDK message-history patch no longer matches'
prefix = prefix.replace(history, '};let N;imTrackHostReply(this,o,U),N=')
receiver = 'registerMessageHandler(){this.messageHandler=b=>{'
assert prefix.count(receiver) == 1, 'SDK receiver guard anchor changed'
prefix = prefix.replace(receiver, receiver+'if(!imAcceptHostMessage(this,b))return;')
appearance = 'options:{coallesedSaving:!1}'
assert prefix.count(appearance) == 1, 'SDK options anchor changed'
prefix = prefix.replace(appearance,'options:{coallesedSaving:!1,acceptsThemes:!1}')
context = 'Md=M=>{if(!M)return;const Z='
assert prefix.count(context) == 1, 'SDK context-stream patch no longer matches'
prefix = prefix.replace(context, 'Md=M=>{if(!M)return;if(M.isMetadataUpdate===true){if(yf?.uuid!==M.uuid)return;imApplyNoteMetadata(yf,M);for(const q of gf)q(M);return}const Z=')
ready = 'onReady:()=>pf.streamContextItem(Md)'
assert prefix.count(ready) == 1, 'SDK ready hook anchor changed'
prefix = prefix.replace(ready, 'onReady:()=>{imInitializeSelectionPreferences(pf);imInitializeSilentTimer(pf);pf.streamContextItem(Md)}')
app_paths = [TARGET / 'src' / name for name in ['private-fields.js', 'note-presentation.js', 'editor-runtime.js']]
script = core_source() + ui_script() + '\n'.join(p.read_text() for p in helper_paths)
script += '\n' + prefix + '\n'.join(p.read_text() for p in app_paths)
old_html = (ROOT / 'index.html').read_text()
css_path = re.search(r'href="\./(assets/[^"?]+\.css)', old_html)[1]
styles = ':root{color-scheme:light}\n' + (ROOT / css_path).read_text() + (TARGET / 'src/styles.css').read_text()
styles += '\n' + ui_styles()
styles += '\n.editor-shell .composer .im-rich-input{pointer-events:auto}\n'
files = {}
for data, suffix in [(script.encode(), '.js'), (styles.encode(), '.css')]:
    name = 'assets/index-' + hashlib.sha256(data).hexdigest()[:12] + suffix
    (TARGET / name).write_bytes(data)
    files[name] = data
    if suffix == '.js':
        js_name = name
    else:
        css_name = name
for path in (ROOT / 'assets').iterdir():
    if path.is_file() and path.suffix not in ['.js', '.css']:
        data = path.read_bytes()
        files['assets/' + path.name] = data
        (ASSETS / path.name).write_bytes(data)
html = re.sub(r'src="\./assets/[^"?]+\.js"', f'src="./{js_name}"', old_html)
html = re.sub(r'href="\./assets/[^"?]+\.css"', f'href="./{css_name}"', html)
html = re.sub(r'name="im-style-editor-version" content="[^"]+"', f'name="im-style-editor-version" content="{VERSION}"', html)
html = html.replace('</head>', '<meta name="color-scheme" content="light">\n</head>')
html = html.replace('</head>', f'<meta name="im-shared-core" content="{core_digest()}">\n<meta name="im-shared-ui" content="{ui_digest()}">\n  </head>')
html = html.replace('<title>IM-style-editor Archive</title>', '<title>IM-style-editor</title>')
(TARGET / 'index.html').write_text(html)
files['index.html'] = html.encode()
files['icon.png'] = (ROOT / 'icon.png').read_bytes()
metadata = json.loads((ROOT / 'im-style-editor.ext.json').read_text())
metadata.update(identifier='com.im-style-editor.next', name='IM-style-editor', version=VERSION,
                description='A private IM-style editor with format-3 notes, efficient draft saving and windowed message rendering. Import message exports from Archive into a new note.',
                url=BASE + 'next/index.html?v=' + VERSION,
                download_url=BASE + f'IM-style-editor-{VERSION}.zip',
                latest_url=BASE + 'im-style-editor-next.ext.json')
serialized = json.dumps(metadata, indent=2) + '\n'
(ROOT / 'im-style-editor-next.ext.json').write_text(serialized)
(ROOT / f'im-style-editor-{VERSION}.ext.json').write_text(serialized)
files['im-style-editor.ext.json'] = serialized.encode()
files['THIRD-PARTY-NOTICES.md'] = (ROOT / 'shared/vendor/THIRD-PARTY-NOTICES.md').read_bytes()
entries = {f'IM-style-editor-{VERSION}/dist/{name}': data for name, data in files.items()}
entries[f'IM-style-editor-{VERSION}/icon.png'] = files['icon.png']
entries[f'IM-style-editor-{VERSION}/package.json'] = (json.dumps({
    'name': 'IM-style-editor-next', 'version': VERSION, 'sn': {'main': 'dist/index.html'}
}, indent=2) + '\n').encode()
with ZipFile(ROOT / f'IM-style-editor-{VERSION}.zip', 'w', ZIP_DEFLATED) as output:
    for name, data in sorted(entries.items()):
        info = ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        output.writestr(info, data)
with ZipFile(ROOT / f'IM-style-editor-{VERSION}.zip') as result:
    assert result.testzip() is None
    for name, data in entries.items():
        assert result.read(name) == data
print(f'Packaged independent editor {VERSION}; Archive paths and identity retained')
