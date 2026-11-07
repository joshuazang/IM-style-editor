An IM-style editor for Standard Notes

This repository now contains two separately installable interfaces built from
one shared format-3 core:

- **[IM-style-editor 4.1.7](https://joshuazang.github.io/IM-style-editor/im-style-editor-next.ext.json)** — a message timeline.
- **[Mosaic 1.0.3](https://joshuazang.github.io/IM-style-editor/mosaic.ext.json)** — a plain-text card board. [Preview](https://joshuazang.github.io/IM-style-editor/mosaic/index.html?preview=1) · [Guide](mosaic/README.md).

Both can open the same format-3 note without conversion. The original
[Mosaic install link](https://joshuazang.github.io/Mosaic/mosaic.ext.json)
continues to work. Each interface bundles the shared code; neither downloads
code from the other at runtime. Archive remains separate and unchanged.

Build both with `python3 tools/package-editors.py`; validate with
`python3 tools/check-editors.py`. A shared-code change is checked against both
interfaces, including editor switching. See [maintenance](docs/shared-editors.md)
and [security boundaries](docs/editor-security.md).

- **IM-style-editor Archive** keeps the existing editor and format-2 notes. Its install manifest remains [im-style-editor.ext.json](im-style-editor.ext.json).
- **IM-style-editor 4** is a separate plugin with format-3 notes and an independent install manifest: [im-style-editor-next.ext.json](im-style-editor-next.ext.json). Both can be installed together.

The two note formats are intentionally incompatible. Keep existing notes in Archive. To move messages, clear filters in Archive, select all the intended messages, choose **Export**, then open a **new note** in the new editor and choose **Import from clipboard**. This transfers bubbles with their timestamps, tags and message metadata; it does not transfer the unsent draft, pins, or the source note's appearance/settings. Imported messages use the destination's appearance and show **Imported**. Keep the source note until you have checked the import.

The new editor saves one complete plain-text representation, reuses decoded messages while saving drafts, and renders a measured window of nearby bubbles. See [format 3](docs/note-format-3.md) for storage details and validation.

Editor 4.0.3 remembers selections through Standard Notes’ encrypted account preferences. Existing browser-local selections migrate as their notes are opened; their local entries are removed only after an editor reopening reads the saved preferences back from Standard Notes. The bottom indicator uses `selected / total selected`.

Editor 4.0.4 adds **Timer** to the main three-dot menu: silent 5- and 25-minute presets. When it finishes, typing pauses until you cancel, extend, or restart. In that dialog, 2/3/4 focus the choices and Enter confirms; Esc cancels. If the editor was suspended or closed, the finished prompt appears when you return.

Editor 4.0.5 reduces work while saving drafts, changing bubbles, importing messages and displaying the countdown. Drafts still save immediately through the same acknowledged queue, and the note format and Archive remain unchanged.

Editor 4.0.6 fixes false selection-saving warnings when an embedded editor blocks access to old browser storage. Current selections continue to use Standard Notes’ encrypted preferences.

Editor 4.0.7 releases past save contents from the host bridge, skips identical saves already confirmed by the host, and limits temporary note/row caches. Changed drafts still save promptly using complete note snapshots.

Editor 4.0.8 fixes metadata-only sync updates restoring an older draft after Send. Host timestamps update without replacing the current message content or draft; ordinary content updates and draft autosaving continue normally.

Editor 4.1.0 adds **Merge selected** to the selection three-dot menu, with a combined-message preview. Text stays in note order, separated by blank lines; tags and pins are combined and reply destinations are preserved. The first message keeps its position/date. The combined message is edited and its Copied/Exported statuses reset.

Reading older messages now stays anchored when messages change below. Near the bottom, new messages follow smoothly; otherwise the down-arrow shows how many new messages are below. Date boundaries have doubled separator margins, and clicking a date’s selection control selects that day’s messages in the current view, including off-screen filter matches. **Iris blue** is `rgb(78, 92, 240)` with white text.

Editor 4.1.1 adds **Occult field journal** in **Appearance → Artwork**: a dense vector wallpaper combining mysterious expeditions, lost observatories, enchanted natural history, nocturnal scholars and ocean secrets. Existing artwork choices and note settings are retained. See [artwork details](docs/artwork.md).

Editor 4.1.2 makes date separators more prominent with about 40% more space at day boundaries, larger bold date labels, stronger contrast and clearer divider lines. Same-day message spacing is unchanged.

Editor 4.1.3 redraws Occult field journal with smooth SVG curves, enlarges its drawing scale by 10%, and adds an upright, taller composition with matching edge details. The wallpaper joins without mirrored or upside-down copies.

Editor 4.1.4 removes the forced draft-only save before Send. When a newer draft is
waiting behind an unfinished save, the final message can replace that queued draft.
Draft saving remains immediate, and the input stays until the host acknowledges
the save. This reduces some save submissions; large notes can still encounter
sync limits. Keep existing notes intact and use a smaller active capture note if needed.

Editor 4.1.5 adds **Clear clipboard** to the three-dot menu, with confirmation.
Import offers **Cancel**, **Import**, and a red **Import and clear clipboard**.
The combined action waits for the import-save acknowledgment before asking to clear;
cancelling keeps the clipboard, and rejected imports never initiate clearing.
Clearing uses an explicit click through the existing clipboard compatibility path.
Timed clearing is not offered because the official-style sandbox blocks it without
a fresh user gesture. This clears the current clipboard, not clipboard-manager history.

IM 4.1.6 / Mosaic 1.0.1 consolidate the modern parser, save queue, transfer,
clipboard and reply helpers under `shared/core`. Mosaic retains failed saves
across note switches in the same live editor, applies late clipboard statuses to
the latest matching message, and preserves refreshed native note fields. Drafts
reuse their cached message section after adding/editing cards. Newly created
replies keep bounded quoted context rather than recursively copying the entire
chain; existing saved replies are preserved. Both interfaces request that browser
spellchecking, autocomplete, autocorrection and writing suggestions stay off.

Mosaic 1.0.2 uses two compact masonry columns on phones. Enter adds a card and
reveals it without moving input focus; Shift+Enter inserts a line break. The
same keys save an existing card or add a body line. Each card has a vector
palette for preset background colors and **Add label** in its three-dot menu.
Labels reuse the shared tags; card colors are optional message metadata that
IM preserves. Nearby previews use their measured heights to avoid blank space
and clipped controls. Draft saving and the shared core are unchanged.

IM 4.1.7 and Mosaic 1.0.3 share the same solid context-menu design and SVG
dictionary in `shared/ui`. A separate tag panel appears above the actions, and
Delete has its own separator. Existing IM actions keep their handlers; Export
and Add label expose the existing transfer/tag data paths from the context menu.

Mosaic cards open directly for editing. Enter adds newlines inside the opened
card; the bottom-right **Close** saves and waits for acknowledgment. The timestamp
and separate edited/status indicators appear in that editor, with no timestamps
on the board. Only Pin occupies the top-right corner; palette, More and Close
are at the bottom. Capture moves to the bottom and retains Enter-to-send, while
the top-right Search/tags and More controls match IM. See [release validation](docs/release-4.1.7-mosaic-1.0.3.md).
