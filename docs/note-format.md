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

# Recovery of complete records with changed separators (2.8.0)

The strict reader continues to pause saving for damaged records. If all settings/message metadata and end markers are present but their line breaks were flattened, a separate recovery scanner builds a preview. It scans balanced JSON objects, respecting quoted strings and escapes; it does not split JSON at arbitrary braces. Duplicate IDs, malformed metadata/escapes, missing boundaries, unsupported versions, or ambiguous delimiter content remain protected.

The user must choose **Restore recovered bubbles** before any write occurs. Restoration preserves recoverable message IDs, send/edit times, tags and custom metadata. Any non-whitespace text outside the document is included as additional untimed bubbles. The complete exact original text is stored in the portable settings under `recoveryOriginal`, so the backup also survives text-only editor switching. The original host note remains unchanged if a restoration save is rejected; the visible save banner offers Retry. Flattening may already have erased meaningful line breaks or spacing; recovery cannot infer them. The preview and raw backup make that limit visible instead of silently guessing.

# Copying and importing forwarded messages (2.8.0)

Select messages, then choose **Copy for forwarding**. Ordinary **Copy** retains its plain-text behavior. A forwarding export begins `#!im-style-forward 1` followed by a JSON envelope containing only the selected message records, their source note ID, export time and supported appearance/order settings. Every message property is preserved, including text, IDs, timestamps, emoji tags, separators, custom metadata and earlier forwarding history. Unselected messages, note title and note-wide recovery backups are not included. JSON escapes keep body newlines and literal delimiter-looking text safe even if structural formatting whitespace is flattened.

In a destination note, open the three-dot menu and choose **Import from clipboard**. Clipboard reading occurs only after that explicit click. The dialog previews records before **Import messages** appends them; canceling or invalid input makes no changes. It also accepts a complete strict portable IM document. Existing destination messages and appearance remain, and unfamiliar imported tags are appended to its manual category order. Active filters clear after a successful import so the added bubbles are visible.

Imported records display **Forwarded**. They retain their original send/edit times rather than substituting the import time. Original IDs are kept when available. If an ID already belongs to different content, a new local ID is assigned and the original stays in `forwarding.sourceMessageId`, with its source note ID and import time. Earlier forwarding metadata is retained as `forwarding.previous`. Importing an identical export again skips the duplicates; it never overwrites an existing bubble. Forwarding provenance and labels survive portable-text conversions.

If the browser blocks clipboard access, the import dialog provides a paste field and the export dialog provides the complete selectable text. No special website permission is required for the manual path. Delayed clipboard results are ignored after cancellation, manual editing or switching notes; applying an import uses the latest destination messages rather than the state captured when the clipboard read began. Dialog keyboard events do not send composer drafts.

This protects conversion that retains the document's text. No format can recover information already deleted before migration, or guarantee recovery after another application deletes both the note and its backups. Keep Standard Notes backups for that broader protection. A plain editor must preserve these records: deliberately deleting the headers/timestamps/tags removes the information they contain.

# Filtering, order and artwork

Active search/tag filters display a persistent `Filtering` capsule with the emoji/search state and visible/total bubble count within the current note. Its clear control is on the left and clears both search and emoji filters. The capsule aligns with both toolbar buttons at 38px tall and uses the same 22% neutral surface fill and 10px backdrop blur as the top panels. The compact Search/Tags trigger retains its bold ring and check badge. These remain visible when the panel closes. Emoji filter buttons have distinct borders and a larger hit area. Selection uses a 3px slate-blue border and a slightly stronger 44% neutral surface tint, with no colored fill or selected checkmark inside the emoji button. Underlying bubble/text silhouettes remain visible but blurred; context menus stay opaque. Browsers without backdrop-filter use opaque neutral fallbacks.

When a message is sent, it inherits the currently selected emoji filter as its sole initial category. With no emoji filter, it starts untagged, including during a text-only search. Changing the filter while drafting uses the category selected at send time. Applying the filter from either the menu or an existing bubble badge follows the same rule. The assigned category is saved in the portable record and survives editor switching; sending does not change the chosen emoji order.

In Arrange tags, **Delete emoji** sits beside **Add emoji**. Entering delete mode reveals selectable emoji choices without the normal reorder arrows; picking one asks “Do you want to delete this emoji?” before any change. Canceling keeps the category and the current filter intact. Confirming removes the category from the filter and context menus for the current note, then exits delete mode. Leaving Arrange tags or pressing Escape also exits the mode. Normal emoji clicks only filter; there are no direct per-emoji trash buttons. Existing message records and attached tags are preserved. If the deleted category was the active filter, that filter clears. A `deletedEmojis` settings list prevents built-in categories from reappearing through default fallbacks, including after an update or text-only editor conversion. Adding the same emoji restores it. The menu can also be emptied completely.

The context-menu emoji order and Arrange tags use the same order. Applying/removing a category does not reorder it. Only manual Arrange controls change priority. Background artwork retains the original Classic vector pattern, and adds Engraved garden: detailed original SVG botanical/celestial linework. Select either in Appearance; the choice is saved in the portable settings. Artwork can still be disabled. No raster assets, animation or new filters are required for either artwork.

# Existing appearance and touch behavior

New/unconfigured notes use Fresh Lime bubbles and a Warm Sand background. Explicit saved colors remain. Visible bubbles are 2px apart at most five minutes apart, 7px after five minutes, and 12px after an hour. Missing/reversed times use 2px; day dividers remain. Emoji badges are approximately 31–34×22px, with a rounded SVG body, centered point and transparent hole.

Touch holds become ready after 520ms, with the menu opening only on release. Movement over 10px cancels. Positioning prefers above the bubble, then below, then space outside a 24px zone around the finger, using the visual viewport. Notes stay stationary. Touch clicks without a fresh menu pointer-down are ignored. Background taps dismiss a phone keyboard without reopening it; desktop click/type behavior remains.

# Validation

Run `node tests/message-transfer.test.cjs`, `node tests/portable-format.test.cjs`, `node tests/note-format.test.cjs`, `node tests/message-spacing.test.cjs` and `node tests/menu-layout.test.cjs`. Serve the repository and run the browser smoke tests with `IM_STYLE_EDITOR_BASE_URL` pointing to that server: emoji-delete, recovery-forwarding, editor-roundtrip, filter-send, filter-artwork, touch-menu-placement, appearance-spacing, top-menu-frost, touch-menu, timestamp-layout. Run `python3 tests/update-cache-smoke.py` to check actual browser caching, hashes and release ZIP consistency.

These checks use synthetic host notes, not a real Standard Notes account. The round-trip fixture deliberately deletes all clientData and custom fields on every switch. Unit tests cover 1,200 randomized encoded bodies, 25 text-only transfers, CRLF, Unicode, reserved delimiters, malformed documents, legacy migration and stale-text protection.

The recovery regression fixture uses synthetic content in the same twenty-record flattened layout as the reported case. Browser tests exercise actual clipboard transfer on phone/desktop, selective export, ID collisions, duplicate imports, text-only restoration, denied clipboard access, manual fallbacks and cancellation/note-switch races.
