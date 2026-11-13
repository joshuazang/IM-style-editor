"""Run both interfaces' regressions using synthetic notes and a local host."""
import argparse
import functools
import http.server
import os
import subprocess
import sys
import threading
from collections import deque
from shared_core import ROOT

parser = argparse.ArgumentParser()
parser.add_argument('--data-only', action='store_true', help='Skip browser tests')
args = parser.parse_args()

def run(*command, env=None):
    tail = deque(maxlen=45)
    with subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True, errors='replace', bufsize=1) as process:
        for line in process.stdout:
            print(line, end='', flush=True)
            tail.append(line)
        code = process.wait()
    if code:
        if (env or os.environ).get('GITHUB_ACTIONS') == 'true':
            detail = ''.join(tail)[-6000:].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
            print('::error title=Editor validation failed::' + detail, flush=True)
        raise subprocess.CalledProcessError(code, command)

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
    for name in ['selection-format-browser.py', 'live-format-browser.py', 'enter-event-sequences.py', 'mosaic-phone-keyboard.py', 'mosaic-keyboard-caret.py', 'checklist-browser.py', 'markdown-field-browser.py', 'markdown-editors-browser.py', 'next-editor-smoke.py', 'im-session-safety-smoke.py', 'clipboard-clear-smoke.py', 'mosaic-browser.py', 'mosaic-safety-smoke.py', 'mosaic-capture-ui.py', 'mosaic-card-height.py', 'mosaic-card-scroll.py', 'mosaic-card-transition.py', 'mosaic-card-dismiss.py', 'mosaic-card-focus.py', 'mosaic-card-morph.py', 'mosaic-card-startup.py', 'mosaic-card-paint-start.py', 'mosaic-six-long-cards.py', 'mosaic-markdown-performance.py', 'mosaic-board-height.py', 'mosaic-body-budget.py', 'mosaic-pin-preview-caps.py', 'mosaic-tag-bottom-gap.py', 'mosaic-motion-browser.py', 'mosaic-drag-large.py', 'mosaic-drag-stability.py', 'card-editor-menu-smoke.py', 'mosaic-touch-overlay-smoke.py', 'mosaic-appearance-smoke.py', 'editor-ux-smoke.py', 'im-touch-scroll-smoke.py', 'im-momentum.py', 'artwork-options-browser.py', 'title-browser.py', 'mosaic-hanging-tags.py', 'selection-layout-smoke.py', 'shared-controls-smoke.py', 'composer-typography.py', 'date-navigation-browser.py', 'ui-layout-regressions.py']:
        run(sys.executable, 'tests/' + name, env=env)
finally:
    server.shutdown()
print('Both editors passed the coordinated browser and data checks.')
