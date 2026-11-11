"""Verify organized history and old public URLs without changing editor releases."""
import functools,hashlib,http.server,json,re,runpy,subprocess,tempfile,threading,urllib.request
from pathlib import Path
from shared_core import ROOT

subprocess.run(['python3',str(ROOT/'tools/organize-releases.py'),'--check'],check=True)
prepare=runpy.run_path(str(ROOT/'tools/prepare-pages.py'))
aliases=json.loads((ROOT/'releases/paths.json').read_text())
assert aliases,'Expected the retained release history'
for invalid in ['../outside','/absolute','folder/../../outside']:
    try:prepare['safe_path'](invalid)
    except ValueError:pass
    else:raise AssertionError(invalid)
with tempfile.TemporaryDirectory(prefix='editor-pages-') as temporary:
    site=Path(temporary)/'site';prepare['build'](site)
    for old,new in aliases.items():
        assert (ROOT/new).is_file(),new
        assert hashlib.sha256((site/old).read_bytes()).digest()==hashlib.sha256((ROOT/new).read_bytes()).digest(),old
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(site)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    def fetch(path):
        with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/'+path,timeout=10) as response:
            assert response.status==200,path
            return response.read()
    try:
        # The real files, rather than redirect pages, must load at their old URLs.
        for category in ['.zip','.ext.json','.js','.css']:
            path=next(p for p in aliases if p.endswith(category))
            assert fetch(path)==(ROOT/aliases[path]).read_bytes(),path
        for directory in ['', 'next/', 'mosaic/']:
            html=fetch(directory+'index.html').decode()
            for asset in re.findall(r'(?:src|href)="\./(assets/[^"?]+)"',html):
                assert fetch(directory+asset)==(ROOT/directory/asset).read_bytes()
        for manifest in ['im-style-editor.ext.json','im-style-editor-next.ext.json','mosaic.ext.json']:
            assert fetch(manifest)==(ROOT/manifest).read_bytes(),manifest
    finally:server.shutdown();server.server_close()
print(f'PASS: {len(aliases)} archived paths, original download/asset HTTP URLs, current apps/manifests and safe path validation.')
