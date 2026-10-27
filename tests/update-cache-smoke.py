"""Reproduce a cached old installation, then load the new release without clearing cache."""
import hashlib
import json
import re
import threading
from collections import Counter
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZipFile
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'im-style-editor.ext.json').read_text())
version = manifest['version']
index = (ROOT / 'index.html').read_text()
assets = re.findall(r'(?:src|href)="\./(assets/[^"?#]+\.(?:js|css))"', index)
assert manifest['latest_url'] == 'https://joshuazang.github.io/IM-style-editor/im-style-editor.ext.json'
assert urlsplit(manifest['url']).query == 'v=' + version
assert len(assets) == 2
for path in assets:
    digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:12]
    assert Path(path).stem == 'index-' + digest
    assert Path(path).name not in ['index-uqKQEy1u.js', 'index-9CmuCJ4r.css']
assert json.loads((ROOT / f'im-style-editor-{version}.ext.json').read_text()) == manifest
with ZipFile(ROOT / f'IM-style-editor-{version}.zip') as z:
    assert z.testzip() is None
    prefix = f'IM-style-editor-{version}/dist/'
    for path in ['index.html', 'im-style-editor.ext.json'] + assets:
        assert z.read(prefix + path) == (ROOT / path).read_bytes()
    assert '☺' not in z.read(prefix + next(p for p in assets if p.endswith('.js'))).decode()

state = {'old': True}
requests = Counter()
HOST = (ROOT / 'tests/standard-notes-host.html').read_text()
LEGACY_JS = 'document.getElementById("root").innerHTML = \'<button class="bubble-category">☺</button>\';'
LEGACY_INDEX = '<!doctype html><div id="root"></div><script src="/assets/index-uqKQEy1u.js"></script>'


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        requests[self.path] += 1
        path = urlsplit(self.path).path
        body, mime = None, 'text/html'
        if path == '/__host':
            body = HOST.encode()
        elif state['old'] and path == '/index.html':
            body = LEGACY_INDEX.encode()
        elif state['old'] and path == '/assets/index-uqKQEy1u.js':
            body, mime = LEGACY_JS.encode(), 'text/javascript'
        elif state['old'] and path == '/im-style-editor.ext.json':
            body, mime = json.dumps(dict(manifest, version='2.6.7')).encode(), 'application/json'
        if body is None:
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'public,max-age=31536000')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        page = browser.new_page()
        # Use real HTTP caching; Playwright routing would disable the browser cache.
        page.goto(base + '/__host', wait_until='networkidle')
        editor = page.frame_locator('#editor')
        expect(editor.locator('.bubble-category')).to_be_visible()
        old = page.evaluate("async () => (await fetch('/im-style-editor.ext.json')).json()")
        assert old['version'] == '2.6.7'
        state['old'] = False
        fresh = page.evaluate('(path) => fetch(path).then(r => r.json())',
                              f'/im-style-editor-{version}.ext.json')
        assert fresh['version'] == version
        runtime = urlsplit(fresh['url'])
        local_runtime = base + '/index.html?' + runtime.query
        page.locator('#editor').evaluate('(frame,url) => frame.src=url', local_runtime)
        expect(editor.get_by_role('textbox', name='Message', exact=True)).to_be_enabled()
        expect(editor.locator('.bubble-category')).to_have_count(0)
        expect(editor.get_by_text('Existing smoke message', exact=True)).to_be_visible()
        assert requests['/assets/index-uqKQEy1u.js'] == 1, requests
        for path in assets:
            assert requests['/' + path] == 1, requests
        # The old manifest really remains cached, so success did not rely on clearing it.
        old = page.evaluate("async () => (await fetch('/im-style-editor.ext.json')).json()")
        assert old['version'] == '2.6.7'
        assert requests['/im-style-editor.ext.json'] == 1, requests
        browser.close()
    print(f'PASS: cached 2.6.7 metadata and smiley UI replaced by {version} without clearing cache')
    print('PASS: runtime asset fingerprints, update URL, versioned metadata and ZIP contents agree')
finally:
    server.shutdown()
    server.server_close()
