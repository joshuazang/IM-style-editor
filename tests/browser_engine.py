"""Use the local Chromium when available, or Playwright's installed browser in CI."""
import os
from pathlib import Path

def chromium_options():
    candidate=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium')
    return {'headless':True,**({'executable_path':candidate} if candidate and Path(candidate).is_file() else {})}
