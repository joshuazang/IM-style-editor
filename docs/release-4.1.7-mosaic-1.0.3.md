# IM 4.1.7 and Mosaic 1.0.3

Both editors compile the same menu CSS, toolbar-control CSS and original SVG
dictionary from `shared/ui`. Message menus have a separate quick-tag panel
above Edit, Reply, Pin/Unpin, Copy text, Export, Select and Delete. Delete remains
red and separated by a divider. Add label is in the tag panel. Existing IM
action handlers and touch-release protection are retained; Export and custom
labels use its existing transfer/tag persistence paths. Archive is unchanged.

Mosaic now opens a clicked card directly for editing. Enter in its body inserts
a newline; Enter in its title starts the body. The bottom capture field retains
Enter-to-send and Shift+Enter for a newline. Capture is below the board; the two
top-right controls use IM's geometry/design, with search/tags in a popover and
a 90px filter change/clear pill. Pin filtering remains in the search/tag panel.

An opened card has only Pin at the top right, palette/More/Close in its bottom
toolbar, and creation timestamp plus separate status/edited indicators above
that toolbar. Board previews keep statuses but omit timestamps. No edited-time
field is introduced. Close saves through the existing queue and waits for host
acknowledgment. Failed saves retain the fields for retry; newer typing during
acknowledgment keeps the editor open. Unchanged Close does not write or mark an
edit. Escape/backdrop clicks use the same safe Close path. Color/tag menus work
inside the native dialog without losing its unsubmitted text.

`card-editor-menu-smoke.py` checks 320-, 390- and 1100-pixel layouts, including
a 480-pixel keyboard-sized height. It tests direct editing, multiline Enter,
metadata placement, unchanged Close, pending/failed acknowledgments, newer
typing, modal palette/tags, capture position, filter geometry, identical vectors
and action ordering, IM editing/tag creation, and clipboard-confirmed copy/export.
The existing integration tests cover pins, replies, selection, deletion safety,
imports, note/editor switches and 5,000-record windowing. A shared-UI checksum
test verifies the same icons and styles ship in both apps.

Data format 3 and `shared/core` are unchanged. No extra note copies, browser
storage, new network paths or telemetry are added. Tests use synthetic notes
in Chromium; they do not certify a physical iOS/macOS Standard Notes client.
