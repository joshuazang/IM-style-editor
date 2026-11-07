"""One canonical core, compiled locally into each independently installed editor."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_FILES = ['note-format.js', 'host-bridge.js', 'note-storage.js', 'message-transfer.js',
              'privacy.js', 'clipboard.js', 'reply-record.js']

def release_config():
    return json.loads((ROOT / 'shared/release.json').read_text())

def core_digest():
    data = b''.join(name.encode() + b'\0' + (ROOT / 'shared/core' / name).read_bytes() for name in CORE_FILES)
    return hashlib.sha256(data).hexdigest()

def core_source():
    return ('/* IM_SHARED_CORE_BEGIN ' + core_digest() + ' */\n' +
            '\n'.join((ROOT / 'shared/core' / name).read_text() for name in CORE_FILES) +
            '\n/* IM_SHARED_CORE_END */\n')
