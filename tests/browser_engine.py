"""Use the local Chromium when available, or Playwright's installed browser in CI."""
import os
from pathlib import Path

def chromium_options():
    candidate=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium')
    return {'headless':True,**({'executable_path':candidate} if candidate and Path(candidate).is_file() else {})}

def fill_field(locator,value,**kwargs):
    """Replace a visual field through its real Markdown paste path.

    Playwright's native contenteditable fill inserts browser-specific divs,
    which describes a different document from the source strings in fixtures.
    Native input/textarea fields keep Playwright's ordinary fill behavior.
    Separate keyboard suites exercise actual character/Enter/composition input.
    """
    from playwright.sync_api import expect
    expect(locator).to_be_editable()
    if locator.evaluate('n=>!!n.imRich'):
        locator.evaluate('''(n,text)=>{n.focus();n.select();if(n.imRich.plain||!text){n.imRich.insertText(text);return;}const data=new DataTransfer();data.setData('text/plain',text);n.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));}''',value)
    else:locator.fill(value,**kwargs)
