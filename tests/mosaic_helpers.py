"""Use the real top-right controls; search and tags are now a popover."""
from playwright.sync_api import expect
from browser_engine import fill_field

def open_search(editor):
    if not editor.locator('#search').is_visible():
        control=editor.get_by_role('button',name='Change filters',exact=True)
        if not control.is_visible():control=editor.get_by_role('button',name='Search and tags',exact=True)
        control.click()
    expect(editor.locator('#search')).to_be_visible()

def fill_search(editor,text):
    open_search(editor)
    fill_field(editor.locator('#search'),text)
    editor.locator('#search').press('Escape')

def click_outside_capture(editor):
    # Search/date controls are navigation and deliberately preserve the draft.
    # Click the actual blank board gutter to exercise click-away submission.
    editor.locator('#viewport').click(position={'x':2,'y':120})

def choose_tag(editor,name):
    open_search(editor)
    editor.get_by_role('button',name=name,exact=True).click()

def open_more(editor):
    button=editor.get_by_role('button',name='More options',exact=True)
    if not button.is_visible():editor.get_by_role('button',name='Clear all filters',exact=True).click()
    button.click()
