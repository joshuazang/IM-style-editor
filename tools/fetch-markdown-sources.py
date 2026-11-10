"""Fetch pinned official sources through GitHub's API; verify before compilation.

Usage: python3 tools/fetch-markdown-sources.py /tmp/markdown-sources
Requires the GitHub CLI, with normal API access to the public upstream repos.
Normal editor packaging uses the checked-in verified bundle and skips this step.
"""
import base64,hashlib,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
target=Path(sys.argv[1]).resolve()
manifest=json.loads((ROOT/'shared/vendor/markdown-sources.json').read_text())
def api(path):
 return json.loads(subprocess.check_output(['gh','api',path],text=True))
for package in manifest['packages']:
 repo,commit=package['repository'],package['commit']
 tree=None
 for name,digest in package['files'].items():
  path=target/package['name']/name
  if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==digest:continue
  if tree is None:
   response=api(f'repos/{repo}/git/trees/{commit}?recursive=1')
   if response.get('truncated'):raise SystemExit('Upstream source tree is truncated')
   tree={item['path']:item for item in response['tree'] if item['type']=='blob'}
  blob=tree[name];response=api(f'repos/{repo}/git/blobs/'+blob['sha'])
  if response.get('encoding')!='base64':raise SystemExit('Expected a base64 Git blob')
  data=base64.b64decode(response['content'])
  git_hash=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
  if git_hash!=blob['sha'] or hashlib.sha256(data).hexdigest()!=digest:raise SystemExit('Source checksum mismatch: '+package['name']+'/'+name)
  path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 print('Verified',package['name'],package['tag'],flush=True)
target.mkdir(parents=True,exist_ok=True)
(target/'sources.json').write_text(json.dumps({'packages':manifest['packages']},indent=2)+'\n')
