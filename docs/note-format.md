# Saved note format and editor switching

The note's `content.text` is always the authoritative text. IM-style-editor does not hide format markers in it. New plain-text notes are split at blank lines; single line breaks remain inside a bubble. Original whitespace, including CRLF and leading/trailing blank lines, is preserved when serializing the note.

Schema 1 stores message IDs, text, separators, timestamps, categories and appearance in `item.clientData.imStyleEditor`. Standard Notes saves this per-note, per-editor data in the note's component-data domain. It is separate from global component preferences and browser caches. See the host's [ComponentViewer implementation](https://github.com/standardnotes/app/blob/main/packages/snjs/lib/Services/ComponentManager/ComponentViewer.ts), specifically `getClientData`, `jsonForItem` and `handleSaveItemsMessage`.

Legacy `appendEditorMessageData`, `appendEditorSettings` and offset ranges remain readable and are mirrored on save. Opening an older note migrates its format once without changing its text. A save rejection is shown to the user with a retry action. Acknowledged note updates do not trigger a save loop.

When another editor changes the plain text, old metadata must not hide or overwrite the new words. Changes confined to one bubble retain its identity, time and categories. For changes spanning multiple bubbles, unchanged prefix/suffix bubbles retain their metadata and the changed area is re-imported at paragraph boundaries. No timestamps are invented for imported or ambiguous text.

Ordinary editor switching and installed updates keep the same note and plugin identifier. A plain-text-only export to a different note cannot carry timestamps/categories, and metadata already removed before this version cannot be reconstructed from text alone. No plugin-controlled iframe reload is used: the host must establish the editor session when rebuilding the frame.

# Time-based spacing and default appearance

Visible bubbles are 2px apart when send times are at most five minutes apart, 7px after five minutes, and 12px after an hour. Missing or reversed times use 2px. Existing day dividers remain, and no timestamps or ordering are changed. Filtered lists calculate spacing between visible messages. Emoji labels use SVG geometry matching the requested paper-tag reference: a rounded left body, a vertically centered right-pointing tip, and a transparent circular hole. The existing emoji is centered in the body; no raster image is used.

New notes and notes without saved appearance use Fresh Lime bubbles and a Warm Sand background. Explicit saved appearance remains unchanged.

# Validation

Run `node tests/note-format.test.cjs`, `node tests/message-spacing.test.cjs`, `node tests/menu-layout.test.cjs`, and `python3 tests/update-cache-smoke.py`. Serve the repository and run `tests/editor-roundtrip-smoke.py`, `tests/touch-menu-placement-smoke.py`, `tests/appearance-spacing-smoke.py`, `tests/top-menu-frost-smoke.py`, `tests/touch-menu-smoke.py` and `tests/timestamp-layout-smoke.py` with `IM_STYLE_EDITOR_BASE_URL` pointing to that local server. These checks use synthetic host data; no real account or note is accessed.

# Touch context menu

A hold becomes ready after 520ms, but its menu opens only on pointer release. Moving more than 10px or canceling the pointer cancels the hold. Native touch context menus are suppressed. A menu prefers space above the selected bubble, then below it, then scrolls within the larger space outside a 24px zone around the hold point. Positioning uses the visual viewport so the keyboard and zoom do not push actions off-screen. The note and scroll position are not changed. Touch clicks that did not start with a fresh menu pointer-down are ignored (zero-detail assistive/keyboard activation remains supported).

# Compact vector badges and top-menu frost

Single-emoji badges are approximately 31–34×22px, including their pointed SVG tail and transparent hole. The glyph is 14px; longer custom labels can grow horizontally. Only the search/tag panel and the three-dot panel group (including Appearance) use an 82% surface fill with a 10px backdrop blur. Browsers without backdrop-filter retain the opaque fallback. Toolbar triggers use a compact dark frosted capsule (78% opacity) with SVG icons; the Search/Tags label is icon-only. Context menus and the composer are not frosted.
