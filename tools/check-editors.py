"""Run both interfaces' regressions using synthetic notes and a local host."""
import argparse
import functools
import http.server
import os
import subprocess
import sys
import threading
from shared_core import ROOT

parser = argparse.ArgumentParser()
parser.add_argument('--data-only', action='store_true', help='Skip browser tests')
args = parser.parse_args()

def run(*command, env=None):
    subprocess.run(command, cwd=ROOT, env=env, check=True)

run(sys.executable, 'tools/verify-editors.py')
tests = sorted((ROOT / 'tests').glob('*.test.cjs'))
for test in tests:
    run('node', str(test))
print(f'All {len(tests)} data suites passed.', flush=True)
if args.data_only:
    raise SystemExit(0)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
env = {**os.environ, 'IM_STYLE_EDITOR_BASE_URL': 'http://127.0.0.1:' + str(server.server_port), 'IM_EDITOR_ROOT': str(ROOT)}
try:
    for name in ['next-editor-smoke.py', 'im-session-safety-smoke.py', 'clipboard-clear-smoke.py', 'mosaic-browser.py', 'mosaic-safety-smoke.py', 'mosaic-capture-ui.py', 'card-editor-menu-smoke.py', 'mosaic-touch-overlay-smoke.py', 'mosaic-appearance-smoke.py']:
        run(sys.executable, 'tests/' + name, env=env)
finally:
    server.shutdown()
print('Both editors passed the coordinated browser and data checks.')
