"""One canonical core, compiled locally into each independently installed editor."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_FILES = ['note-format.js', 'host-bridge.js', 'note-storage.js', 'message-transfer.js',
              'privacy.js', 'clipboard.js', 'reply-record.js', 'emoji-tags.js']
UI_FILES = ['icons.js', 'menu-position.js', 'menu.css', 'controls.css', 'selection.css', 'save-feedback.js', 'accessibility.css', 'search-filters.js', 'search-filters.css', 'composer.css']

def ui_digest():
    return hashlib.sha256(b''.join(name.encode()+b'\0'+(ROOT/'shared/ui'/name).read_bytes() for name in UI_FILES)).hexdigest()

def ui_script():
    return '/* IM_SHARED_UI_BEGIN '+ui_digest()+' */\n'+'\n'.join((ROOT/'shared/ui'/name).read_text() for name in UI_FILES if name.endswith('.js'))+'\n/* IM_SHARED_UI_END */\n'

def ui_styles(editor='im'):
    return '/* Shared UI '+ui_digest()+' */\n'+'\n'.join((ROOT/'shared/ui'/name).read_text() for name in UI_FILES if name.endswith('.css'))

def release_config():
    return json.loads((ROOT / 'shared/release.json').read_text())

def core_digest():
    data = b''.join(name.encode() + b'\0' + (ROOT / 'shared/core' / name).read_bytes() for name in CORE_FILES)
    return hashlib.sha256(data).hexdigest()

def core_source():
    return ('/* IM_SHARED_CORE_BEGIN ' + core_digest() + ' */\n' +
            '\n'.join((ROOT / 'shared/core' / name).read_text() for name in CORE_FILES) +
            '\n/* IM_SHARED_CORE_END */\n')
