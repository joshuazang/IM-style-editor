# IM 4.1.8 and Mosaic 1.0.4

Both message context menus now use **Copy** and contain Edit, Reply, Pin/Unpin,
Copy, Select and separated red Delete. Export is removed from these menus while
the existing selection/main-menu export paths remain available. The Add label
button and its unused menu form are removed from the emoji/context picker.

The shared quick-tag panel is an explicit wrapping grid, with fixed-height cells
and two visible rows. This fixes Mosaic's inherited full-width menu-button rule
that previously stacked emojis vertically. Larger tag collections remain
scrollable; existing label/reaction data is preserved.

Mosaic board previews no longer expose a palette button. Color selection remains
inside an opened card, and existing card backgrounds continue to display on the
board. The opened card's inline emoji selector and Add label input are removed.
Its context-menu tags still edit the existing reaction array and save on Close.
Text, colors, tags, timestamps, statuses, format 3, storage and shared/core remain
unchanged by this UI simplification.

The browser regression checks cover both menus at 320, 390 and 1100 pixels:
matching vectors/action order, absent Export/Add label actions, multiple emoji
columns and at most two default rows, palette visibility, no inline selector,
tag changes, Copy success, and export through selection mode. Existing saving,
clipboard-race, note-switching, editor interchange and large-note checks remain
in the coordinated suite. These tests use synthetic notes in Chromium.

This release is published only from IM-style-editor. The retired standalone
Mosaic repository and its frozen historical files are not updated.
