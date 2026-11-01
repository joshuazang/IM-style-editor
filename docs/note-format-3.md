# Format 3: independent editor 4

The reader accepts format 3 only. Format 2 remains in **IM-style-editor Archive**; neither plugin rewrites the other's format. Ordinary `#!im-style-forward 2` message exports remain a shared clipboard interchange protocol. This is not a format-2 note reader or an automatic note migration.

The header is `#!im-style-editor 3`, followed by `#!encoding utf-8`. Settings, optional pending reply and optional unsent draft precede bubbles, as in the existing document structure. IDs, timestamps, presence-based statuses, omitted empty reactions, extra metadata/settings and reserved-line escaping retain their meanings.

Each bubble starts with `@@IM:BUBBLE`, contains its metadata and `@@IM:CONTENT`, and ends at the next **unescaped** `@@IM:BUBBLE` or final `@@IM:END`. There is no structural `@@IM:END-BUBBLE`. A literal old end-marker in message text is ordinary content.

As in format 2, two empty lines precede the exact message payload, and a line terminator plus two empty lines follow it. The next bubble marker immediately follows that framing; no additional separator line is inserted. Leading/trailing whitespace and message newlines are never trimmed. Literal reserved control lines and leading backslashes are escaped using a backslash. Draft and reply sections keep their explicit end markers.

Only `content.text` contains the complete saved plugin state. Standard Notes title, references, previews and unrelated application data remain. The editor does not write `appendEditorMessageData`, `appendEditorSettings` or `clientData.imStyleEditor` mirrors. If those obsolete owned fields accompany a valid new-format note, its next save removes them while preserving unrelated fields.

The working-memory caches are not saved copies. Message/settings records are immutable: changes create new records/arrays. A note is decoded again only when unfamiliar text arrives. Draft-only saves reuse the serialized bubble section; Standard Notes still receives a complete note snapshot. No delay is added to draft persistence. Existing acknowledgment, ordered-save, failure/retry and malformed-document protections remain.

Nearby rows are drawn with estimated off-screen heights, then measured as they enter view. Scroll anchors are maintained across measurements and width changes. Selection and filtering operate on the complete record list; reply and pinned-message navigation first mounts an off-screen destination before locating/highlighting it.

Validation:

```sh
node tests/next-format.test.cjs
python3 tools/package-next.py 4.0.0
IM_STYLE_EDITOR_BASE_URL=http://127.0.0.1:8010 python3 tests/next-editor-smoke.py
```

The browser test uses synthetic notes and a local Standard Notes bridge fixture. It does not replace checking an installed editor on a physical iPhone and Mac.

Editor 4.0.1 adds selective status clearing for all messages or a selected set. Clearing Imported stores the sparse `importedStatusCleared` marker in extra message metadata while retaining forwarding provenance for reply navigation and duplicate detection. A new import resets that suppression so the new arrival is visibly Imported. Other selected status fields are removed entirely.
