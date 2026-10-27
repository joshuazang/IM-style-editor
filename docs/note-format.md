# Portable note format (2.7.0)

The complete note is stored in Standard Notes `content.text`, including bubble boundaries, exact message bodies, IDs, send/edit timestamps, emoji tags, and appearance. Native clientData and the legacy custom fields are additional mirrors, never prerequisites for restoration. A text-only export into a different note therefore restores the same bubbles. Keeping the plugin identifier unchanged also preserves ordinary installed-update behavior.

A plain-text editor shows a readable document like this:

```text
#!im-style-editor 1
:::settings {"bubbleTheme":"lime","backgroundTheme":"sand","artwork":"classic","scale":1.12,"reactionOrder":["⭐","✅"]}
:::bubble {"id":"message-1","createdAt":"2026-10-27T12:00:00.000Z","reactions":["⭐"]}
First message.

This blank line is still inside the first bubble.
:::end-bubble
:::bubble {"id":"message-2","createdAt":"2026-10-27T12:01:00.000Z","reactions":[]}
Second message.
:::end-bubble
:::end-im-style-editor
```

Edit the words between `:::bubble` and `:::end-bubble` in the plain-text editor. Blank lines and single newlines within those boundaries remain in the same bubble. JSON in each bubble header holds its ID, send time, edit time and tags. Missing times remain missing; the editor does not invent dates for old imported text. Settings are in their own JSON record. Unknown message metadata fields are preserved.

Backslashes in message bodies are doubled (`\\`), carriage returns are written as `\r`, and lines starting with `:::` have one extra leading backslash. These rules permit literal delimiter-looking content, Windows paths, arbitrary blank lines and CRLF to round-trip unambiguously. The document itself uses LF but accepts CRLF from other editors. The IM interface removes the records/escapes and renders only the actual bubble contents. Standard Notes list previews use decoded text, not the headers. No HTML is executed.

# Migration and recovery

Opening an older note automatically writes the portable document. First-time plain-text import splits at blank lines while preserving single newlines within paragraphs and exact original whitespace. If earlier recoverable metadata exists, its boundaries, IDs, tags and timestamps take priority when it matches the actual words. The earlier exact text and recoverable message/settings snapshot are also retained once as `clientData.imStyleEditor.migrationBackup`. This extra backup is helpful when the host preserves component data; the portable document itself carries everything needed when it does not.

Schema 2 stores a mirror in `item.clientData.imStyleEditor`, the per-note, per-editor component-data domain. Legacy `appendEditorMessageData`, `appendEditorSettings` and offsets remain readable/mirrored for older-format migration. Versions before 2.7.0 do not understand portable records and should not be used to edit a migrated note.

Valid portable text is authoritative over all mirrors. Plain-text edits inside a record retain its metadata. Invalid JSON, duplicate IDs, missing boundaries, unsupported format versions, malformed escapes and text outside the document trigger a read-only recovery view. That view shows the entire original text and pauses saving. It never silently reinterprets damaged records as ordinary paragraphs or replaces them with stale hidden metadata. The records can then be repaired in the plain editor. A save failure is visible and offers Retry; acknowledged host echoes do not cause save loops.

This protects conversion that retains the document's text. No format can recover information already deleted before migration, or guarantee recovery after another application deletes both the note and its backups. Keep Standard Notes backups for that broader protection. A plain editor must preserve these records: deliberately deleting the headers/timestamps/tags removes the information they contain.

# Filtering, order and artwork

Active search/tag filters display a persistent `Filtering` capsule with the emoji/search state, visible/total message count, and a one-click clear control. The compact Search/Tags trigger also has a bold ring and check badge. These remain visible when the panel closes. Emoji filter buttons have distinct borders, a larger hit area, and a selected check, while the panel keeps its light 22% fill and 10px backdrop blur. Underlying bubble/text silhouettes remain visible but blurred; context menus stay opaque.

The context-menu emoji order and Arrange tags use the same order. Applying/removing a category does not reorder it. Only manual Arrange controls change priority. Background artwork retains the original Classic vector pattern, and adds Engraved garden: detailed original SVG botanical/celestial linework. Select either in Appearance; the choice is saved in the portable settings. Artwork can still be disabled. No raster assets, animation or new filters are required for either artwork.

# Existing appearance and touch behavior

New/unconfigured notes use Fresh Lime bubbles and a Warm Sand background. Explicit saved colors remain. Visible bubbles are 2px apart at most five minutes apart, 7px after five minutes, and 12px after an hour. Missing/reversed times use 2px; day dividers remain. Emoji badges are approximately 31–34×22px, with a rounded SVG body, centered point and transparent hole.

Touch holds become ready after 520ms, with the menu opening only on release. Movement over 10px cancels. Positioning prefers above the bubble, then below, then space outside a 24px zone around the finger, using the visual viewport. Notes stay stationary. Touch clicks without a fresh menu pointer-down are ignored. Background taps dismiss a phone keyboard without reopening it; desktop click/type behavior remains.

# Validation

Run `node tests/portable-format.test.cjs`, `node tests/note-format.test.cjs`, `node tests/message-spacing.test.cjs` and `node tests/menu-layout.test.cjs`. Serve the repository and run the browser smoke tests with `IM_STYLE_EDITOR_BASE_URL` pointing to that server: editor-roundtrip, filter-artwork, touch-menu-placement, appearance-spacing, top-menu-frost, touch-menu, timestamp-layout. Run `python3 tests/update-cache-smoke.py` to check actual browser caching, hashes and release ZIP consistency.

These checks use synthetic host notes, not a real Standard Notes account. The round-trip fixture deliberately deletes all clientData and custom fields on every switch. Unit tests cover 1,200 randomized encoded bodies, 25 text-only transfers, CRLF, Unicode, reserved delimiters, malformed documents, legacy migration and stale-text protection.
