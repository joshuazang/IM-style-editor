"""A shared-core change always builds both separately installable interfaces."""
import json
import subprocess
import sys
from pathlib import Path
from shared_core import release_config, core_digest, ui_digest

ROOT=Path(__file__).resolve().parents[1]
config=release_config()
for script in ['package-next.py','package-mosaic.py']:
    subprocess.run([sys.executable,str(ROOT/'tools'/script)],cwd=ROOT,check=True)
release={**config,'shared_core_sha256':core_digest(),'shared_ui_sha256':ui_digest(),
         'im_manifest':'im-style-editor-next.ext.json','mosaic_manifest':'mosaic.ext.json'}
(ROOT/'editors-release.json').write_text(json.dumps(release,indent=2)+'\n')
print('Both editors built from one shared core.')
