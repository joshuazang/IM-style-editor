# Mosaic 1.0.2

Phone cards now form two compact masonry columns. Only nearby previews are
mounted. Those previews are measured once for their current width/selection
state, and their heights are reused to avoid clipped controls and excess space.

Enter sends a new card and brings it into view while preserving input focus.
Shift+Enter inserts a newline. These keys also save an existing-card edit or add
a body line; Shift+Enter in the title starts the body. A mobile `beforeinput`
line-break event supports keyboards that do not provide a useful keydown.
Composition keys do not send incomplete IME text. Click-outside capture remains;
touch movement cancels that gesture, and card-tool clicks are not swallowed by
the capture rerender.

Each card has a vector palette and a three-dot menu with **Add label**. Presets
include pastel colors and Iris blue (`#4e5cf0`) with white text. The selected
color has an outlined check indicator. Labels reuse the shared reaction/tag
array, so filtering and IM switching continue to use one representation.

Color is stored as optional `cardColor` extra message metadata, containing a
preset ID. Default removes it. Unknown values display the default surface rather
than becoming CSS. Color/label changes leave the text and Edited/Copied/Exported
statuses intact. IM preserves that metadata through its existing reader/writer.
The shared format/core and IM 4.1.6 application are unchanged.

Draft persistence still submits input changes immediately through the existing
ordered queue. Enter does not clear input before acknowledgment; rejected sends
retain it for retry. No timer, browser-stored text copy, analytics or networking
was added. Older fingerprinted assets remain available for cached web pages;
the install ZIP contains only the current release's assets.

`tests/mosaic-capture-ui.py` exercises 320-, 390- and 1100-pixel layouts with
synthetic notes: two columns, unclipped tools, Enter/Shift+Enter, mobile input
events, IME, visible new cards, retained focus, color/label saves, color reset,
touch menu activation, IM interchange and failed-send retry without duplication.
It runs with the existing coordinated data, integration and safety suites via
`python3 tools/check-editors.py`. These browser checks are not a physical iPhone
Standard Notes app test.
