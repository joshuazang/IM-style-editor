"""Prepare the former Mosaic repository as a compatibility distribution.

No GitHub mutation is performed. Existing historical releases/assets are kept.
The caller reviews, commits and publishes the resulting local changes.
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path
from shared_core import ROOT, core_digest, release_config

parser = argparse.ArgumentParser()
parser.add_argument('destination', type=Path)
args = parser.parse_args()
target = args.destination.resolve()
assert target != ROOT and (target / '.git').exists(), 'Expected the separate Mosaic checkout'
remote = subprocess.check_output(['git', 'remote', 'get-url', 'origin'], cwd=target, text=True).strip()
assert remote.rstrip('/').removesuffix('.git').endswith('joshuazang/Mosaic'), 'Wrong distribution repository'
assert not subprocess.check_output(['git', 'status', '--porcelain'], cwd=target).strip(), 'Review existing changes first'
subprocess.run(['python3', 'tools/verify-editors.py'], cwd=ROOT, check=True)
version = release_config()['mosaic_version']
# Remove the retired duplicate source tree, retaining its tagged Git history.
for directory in ['src', 'tests', 'tools', 'docs']:
    if (target / directory).exists():
        shutil.rmtree(target / directory)
(target / 'index.template.html').unlink(missing_ok=True)
for name in ['index.html', 'icon.svg', 'NOTICE.md']:
    shutil.copy2(ROOT / 'mosaic' / name, target / name)
shutil.copytree(ROOT / 'mosaic/assets', target / 'assets', dirs_exist_ok=True)
for name in ['mosaic.ext.json', 'mosaic-' + version + '.ext.json', 'Mosaic-' + version + '.zip']:
    shutil.copy2(ROOT / name, target / name)
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
(target / 'source.json').write_text(json.dumps({
    'repository': 'https://github.com/joshuazang/IM-style-editor',
    'commit': commit, 'mosaic_version': version, 'shared_core_sha256': core_digest(),
}, indent=2) + '\n')
(target / 'README.md').write_text('''# Mosaic

Mosaic's source and development now live in
**[IM-style-editor](https://github.com/joshuazang/IM-style-editor/tree/main/mosaic)**,
alongside the common format-3 parser and saving core. It remains a separate
Standard Notes plugin with the same identifier and interchangeable notes.

This repository preserves the original install/preview links and historical
releases. It contains generated compatibility files; do not edit another copy
of the parser here. `source.json` identifies the reviewed source commit.

- [Install](https://joshuazang.github.io/Mosaic/mosaic.ext.json)
- [Preview](https://joshuazang.github.io/Mosaic/?preview=1)
- [Guide](https://github.com/joshuazang/IM-style-editor/blob/main/mosaic/README.md)
- [Security boundaries](https://github.com/joshuazang/IM-style-editor/blob/main/docs/editor-security.md)
- [Shared maintenance](https://github.com/joshuazang/IM-style-editor/blob/main/docs/shared-editors.md)

The manifest points to the canonical release. The preview bundles the same
fixed app without an iframe redirect. Old release tags and downloads remain.
''')
print('Prepared Mosaic ' + version + ' compatibility distribution; review before committing.')
