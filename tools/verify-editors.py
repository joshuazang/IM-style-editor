"""Verify the coordinated release, independently of the packaging step."""
import json
import re
import subprocess
from pathlib import Path
from zipfile import ZipFile
from shared_core import ROOT, core_digest, release_config, ui_digest

config = release_config()
release = json.loads((ROOT / 'editors-release.json').read_text())
assert release == {**config, 'shared_core_sha256': core_digest(), 'shared_ui_sha256': ui_digest(),
                   'im_manifest': 'im-style-editor-next.ext.json', 'mosaic_manifest': 'mosaic.ext.json'}
for directory, manifest, key, identifier, package in [
    ('next', 'im-style-editor-next.ext.json', 'im_version', 'com.im-style-editor.next', 'IM-style-editor'),
    ('mosaic', 'mosaic.ext.json', 'mosaic_version', 'com.joshuazang.mosaic', 'Mosaic'),
]:
    version = config[key]
    metadata = json.loads((ROOT / manifest).read_text())
    assert metadata['identifier'] == identifier and metadata['version'] == version
    assert metadata['url'] == f'https://joshuazang.github.io/IM-style-editor/{directory}/index.html?v={version}'
    html = (ROOT / directory / 'index.html').read_text()
    assets = re.findall(r'(?:src|href)="\./(assets/[^"?]+)"', html)
    assert len(assets) == 2
    assert f'content="{core_digest()}"' in html
    assert "connect-src 'none'" in html
    with ZipFile(ROOT / f'{package}-{version}.zip') as archive:
        assert archive.testzip() is None
        prefix = f'{package}-{version}/dist/'
        for name in ['index.html', *assets]:
            assert archive.read(prefix + name) == (ROOT / directory / name).read_bytes(), name
    for asset in assets:
        if asset.endswith('.js'):
            subprocess.run(['node', '--check', str(ROOT / directory / asset)], check=True)
subprocess.run(['node', 'tests/shared-core.test.cjs'], cwd=ROOT, check=True)
print('Verified both install manifests, shared core, application syntax and packaged assets.')
