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
helpers = []
for name in ['message-spacing.js', 'context-menu.js',
             'transfer-ui.js', 'editor-interactions.js',
             'reply-ui.js', 'emoji-management.js', 'virtual-messages.js', 'status-clear.js', 'message-merge.js', 'selection-memory.js', 'silent-timer.js', 'note-sessions.js', 'selection-touch.js', 'search-filters.js']:
    path = TARGET / 'src' / name
    helpers.append((path if path.exists() else ROOT / 'src' / name).read_text())
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
prefix = prefix.replace('onReady:()=>pf.streamContextItem(Md)', 'onReady:()=>{imInitializeSelectionPreferences(pf);imInitializeSilentTimer(pf);pf.streamContextItem(Md)}')
def private_fields(source):
    return re.sub(r'''x\.(jsx|jsxs)\((["'])(textarea|input)\2\s*,''',
                  lambda match:'x.'+match[1]+'('+( 'ImPrivateTextarea' if match[3]=='textarea' else 'ImPrivateInput')+',',source)
script = (core_source() + ui_script() + private_fields('\n'.join(helpers)) + '\n' + prefix +
          (TARGET / 'src/private-fields.js').read_text() + '\n' +
          private_fields((TARGET / 'src/editor-runtime.js').read_text()))
old_html = (ROOT / 'index.html').read_text()
css_path = re.search(r'href="\./(assets/[^"?]+\.css)', old_html)[1]
styles = ':root{color-scheme:light}\n' + (ROOT / css_path).read_text() + '''
/* Windowed rows retain full scroll space; anchoring is handled with measured offsets. */
.selection-actions{display:flex;justify-content:space-between;grid-template-columns:repeat(5,1fr)}
.status-clear-options{display:flex;flex-direction:column;gap:14px;margin:20px 0}
.status-clear-options label{display:flex;align-items:center;gap:12px}
.status-clear-options input{width:20px;height:20px;margin:0}
.silent-timer-row{display:flex;justify-content:flex-end;width:100%}
.silent-timer-badge{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:4px 11px;border-radius:20px;color:var(--ink,#172033);font-size:13px}
.silent-timer-countdown{font-variant-numeric:tabular-nums;white-space:nowrap}
.editor-shell .silent-timer-badge.is-finished{color:#326d32;border-color:#75a275}
.silent-timer-presets{display:flex;gap:12px;margin:18px 0}
.silent-timer-presets button{flex:1;padding:12px;border-radius:20px}
.editor-shell .silent-timer-presets button[aria-pressed=true]{outline:2px solid #548b3b}
.timer-finished-backdrop{z-index:1000}
.timer-finish-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
.timer-finish-actions button{display:flex;align-items:center;gap:10px;min-height:60px;padding:10px;text-align:left;border-radius:18px}
.timer-finish-actions kbd{font:inherit;font-weight:750;min-width:24px;text-align:center}
.editor-shell .timer-finish-actions button:focus{outline:3px solid #548b3b;outline-offset:2px}
.timer-key-help{font-size:13px}
.clipboard-import-actions{flex-wrap:wrap}
.clipboard-import-actions button{min-width:0;white-space:normal}
.silent-timer-announcement{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.messages{overflow-anchor:none;touch-action:pan-y pinch-zoom}
.editor-shell .message-row,.editor-shell .message-wrap,.editor-shell .message-bubble{-webkit-tap-highlight-color:transparent}
@media(hover:none),(pointer:coarse){.editor-shell .message-reactions button:hover{transform:none;box-shadow:none}}
.message-row{min-height:44px}
.selection-touch-row{touch-action:pan-y}
.editor-shell .message-row.selection-touch-row>.selection-check,.editor-shell .message-row.selection-touch-row>.selection-check.checked{display:grid;place-items:center;left:-10px;top:50%;transform:translateY(-50%);margin:0;width:44px;height:44px;padding:0;border:0!important;box-shadow:none!important;background:transparent!important;font-size:13px;line-height:1}
.editor-shell .selection-touch-row>.selection-check:before{content:"";position:absolute;inset:auto;left:50%;top:50%;transform:translate(-50%,-50%);width:20px;height:20px;border:3px solid #52606d;border-radius:50%;box-sizing:border-box;background:var(--surface);box-shadow:none!important;pointer-events:none}
.editor-shell .selection-touch-row>.selection-check.checked:before{border-color:#2f6415;background:#3c801b}
.selection-mark{position:relative;z-index:1}
.virtual-message{width:100%;min-width:0;flex-shrink:0;overflow-anchor:none}
.virtual-spacer{flex:0 0 auto;pointer-events:none;overflow-anchor:none}
.day-divider{font-size:17px;font-weight:750;color:#334155}
.day-divider:before,.day-divider:after{border-top-color:#9aa7b7}
.day-divider.day-break{margin-top:20px;margin-bottom:6px}
.day-divider .day-select{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:5px 12px;border:1px solid #64748b55;border-radius:22px;font:inherit;line-height:28px;color:inherit;background:var(--surface)}
.day-divider .day-select span{padding:0}
.day-select svg{width:22px;height:22px;opacity:.85;pointer-events:none}
.day-select[aria-pressed=true]{color:var(--accent);box-shadow:0 0 0 1px currentColor}
.selection-more-menu{position:absolute;right:0;top:50px;width:230px;max-width:100%;padding:6px;border:1px solid #b7c2d2;border-radius:16px;background:var(--surface);color:#172033;box-shadow:0 6px 20px #17203322}
.selection-more-menu button{display:block;width:100%;padding:12px;text-align:left;border:0;border-radius:10px;background:transparent;font:inherit;color:inherit}
.selection-more-menu button:hover{background:#17203310}
.selection-more-menu button:disabled{opacity:.45;cursor:default}
.merge-preview{max-height:35dvh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border:1px solid #b7c2d2;border-radius:12px;background:var(--surface);color:#172033}
.chat-wallpaper.artwork-journal .messages{background-image:url(./occult-field-journal-v2.svg);background-size:660px 990px;background-position:17px 29px}
.jump-to-bottom .new-message-count{position:absolute;right:-3px;top:-7px;min-width:20px;height:20px;padding:1px 5px;border:2px solid var(--surface);border-radius:12px;background:#21653d;color:white;font-size:11px;font-weight:750;line-height:14px;text-align:center;pointer-events:none}
@supports(backdrop-filter:blur(1px)){
 .selection-more-menu,.day-divider .day-select{background:color-mix(in srgb,var(--surface) var(--frost-tint),transparent);backdrop-filter:blur(var(--frost-blur));-webkit-backdrop-filter:blur(var(--frost-blur))}
}
'''
styles += '\n' + ui_styles()
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
# New artwork belongs to the independent editor; Archive's assets remain immutable.
for name in ['occult-field-journal-v2.svg']:
    files['assets/' + name] = (ASSETS / name).read_bytes()
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
