"""Build the independent format-3 editor. Root index/identifier remain Archive."""
import hashlib
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
VERSION = sys.argv[1]
if not re.fullmatch(r'\d+\.\d+\.\d+', VERSION):
    raise SystemExit('Expected a release version')
BASE = 'https://joshuazang.github.io/IM-style-editor/'
TARGET = ROOT / 'next'
ASSETS = TARGET / 'assets'
ASSETS.mkdir(exist_ok=True)
helpers = []
for name in ['note-format.js', 'note-storage.js', 'message-spacing.js', 'menu-layout.js',
             'message-transfer.js', 'transfer-ui.js', 'editor-interactions.js',
             'reply-ui.js', 'emoji-management.js', 'virtual-messages.js', 'status-clear.js']:
    path = TARGET / 'src' / name
    helpers.append((path if path.exists() else ROOT / 'src' / name).read_text())
# Reuse the immutable React/SDK build prefix; only the application runtime is forked.
# This source file is packaged in full, so the installed editor has no dependency on Archive.
seed = (ROOT / 'assets/index-ca276a0e4a5e.js').read_text().split('/* IM_NOTE_HELPERS_END */', 1)[1].lstrip()
prefix = seed[:seed.index('function lv(')]
script = '\n'.join(helpers) + '\n' + prefix + (TARGET / 'src/editor-runtime.js').read_text()
old_html = (ROOT / 'index.html').read_text()
css_path = re.search(r'href="\./(assets/[^"?]+\.css)', old_html)[1]
styles = (ROOT / css_path).read_text() + '''
/* Windowed rows retain full scroll space; anchoring is handled with measured offsets. */
.selection-actions{display:flex;justify-content:space-between;grid-template-columns:repeat(5,1fr)}
.status-clear-options{display:flex;flex-direction:column;gap:14px;margin:20px 0}
.status-clear-options label{display:flex;align-items:center;gap:12px}
.status-clear-options input{width:20px;height:20px;margin:0}
.messages{overflow-anchor:none}
.virtual-message{width:100%;min-width:0;flex-shrink:0;overflow-anchor:none}
.virtual-spacer{flex:0 0 auto;pointer-events:none;overflow-anchor:none}
'''
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
