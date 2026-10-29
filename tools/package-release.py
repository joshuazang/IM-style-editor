"""Package the static extension with fresh runtime URLs and content-hashed assets.

Usage: python3 tools/package-release.py 2.6.9
Older published files are retained so cached installation links keep working.
"""
import hashlib
import json
import re
import sys
import subprocess
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
VERSION = sys.argv[1]
if not re.fullmatch(r'\d+\.\d+\.\d+', VERSION):
    raise SystemExit('Expected a version such as 2.6.9')
BASE = 'https://joshuazang.github.io/IM-style-editor/'
index = (ROOT / 'index.html').read_text()
for path in re.findall(r'(?:src|href)="\./(assets/[^"?#]+\.(?:js|css))"', index):
    data = (ROOT / path).read_bytes()
    if Path(path).suffix == '.js' and (ROOT / 'src/note-format.js').exists():
        text = data.decode()
        text = re.sub(r'/\* IM_NOTE_HELPERS_START \*/.*?/\* IM_NOTE_HELPERS_END \*/\n?', '', text, flags=re.S)
        helpers = '\n'.join((ROOT / ('src/' + name)).read_text() for name in ['note-format.js', 'note-storage.js', 'message-spacing.js', 'menu-layout.js', 'message-transfer.js', 'transfer-ui.js', 'editor-interactions.js', 'reply-ui.js'])
        data = ('/* IM_NOTE_HELPERS_START */\n' + helpers + '\n/* IM_NOTE_HELPERS_END */\n' + text).encode()
    suffix = Path(path).suffix
    name = 'assets/index-' + hashlib.sha256(data).hexdigest()[:12] + suffix
    (ROOT / name).write_bytes(data)
    # Edits are now retained in the new hashed asset. Restore any already-published
    # asset so existing installation URLs remain immutable and usable.
    if name != path:
        original = subprocess.run(['git', 'show', 'HEAD:' + path], cwd=ROOT, capture_output=True)
        if original.returncode == 0:
            (ROOT / path).write_bytes(original.stdout)
    index = index.replace('./' + path, './' + name)
version_meta = f'<meta name="im-style-editor-version" content="{VERSION}" />'
if 'name="im-style-editor-version"' in index:
    index = re.sub(r'<meta name="im-style-editor-version"[^>]+>', version_meta, index)
else:
    index = index.replace('<title>', version_meta + '\n    <title>', 1)
(ROOT / 'index.html').write_text(index)
metadata = json.loads((ROOT / 'im-style-editor.ext.json').read_text())
metadata.update(version=VERSION, url=BASE + 'index.html?v=' + VERSION,
                download_url=BASE + f'IM-style-editor-{VERSION}.zip',
                latest_url=BASE + 'im-style-editor.ext.json')
serialized = json.dumps(metadata, indent=2) + '\n'
(ROOT / 'im-style-editor.ext.json').write_text(serialized)
(ROOT / f'im-style-editor-{VERSION}.ext.json').write_text(serialized)
files = ['index.html', 'icon.png', 'im-style-editor.ext.json']
files += sorted(set(re.findall(r'(?:src|href)="\./(assets/[^"?#]+\.(?:js|css))"', index)) | {
    str(path.relative_to(ROOT)) for path in (ROOT / 'assets').iterdir()
    if path.is_file() and path.suffix not in ['.js', '.css']
})
archive = ROOT / f'IM-style-editor-{VERSION}.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED) as output:
    entries = {f'IM-style-editor-{VERSION}/dist/{path}': (ROOT / path).read_bytes() for path in files}
    entries[f'IM-style-editor-{VERSION}/icon.png'] = (ROOT / 'icon.png').read_bytes()
    entries[f'IM-style-editor-{VERSION}/package.json'] = (json.dumps({
        'name': 'IM-style-editor', 'version': VERSION, 'sn': {'main': 'dist/index.html'}
    }, indent=2) + '\n').encode()
    for name, data in sorted(entries.items()):
        info = ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        output.writestr(info, data)
with ZipFile(archive) as result:
    assert result.testzip() is None
    for path in files:
        assert result.read(f'IM-style-editor-{VERSION}/dist/{path}') == (ROOT / path).read_bytes()
print(f'Packaged {VERSION}: versioned install link, fresh runtime URL, hashed assets, verified ZIP')
