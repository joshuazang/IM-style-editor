# Format 3: independent editor 4

The reader accepts format 3 only. Format 2 remains in **IM-style-editor Archive**; neither plugin rewrites the other's format. Ordinary `#!im-style-forward 2` message exports remain a shared clipboard interchange protocol. This is not a format-2 note reader or an automatic note migration.

The header is `#!im-style-editor 3`, followed by `#!encoding utf-8`. Settings, optional pending reply and optional unsent draft precede bubbles, as in the existing document structure. IDs, timestamps, presence-based statuses, omitted empty reactions, extra metadata/settings and reserved-line escaping retain their meanings.

Each bubble starts with `@@IM:BUBBLE`, contains its metadata and `@@IM:CONTENT`, and ends at the next **unescaped** `@@IM:BUBBLE` or final `@@IM:END`. There is no structural `@@IM:END-BUBBLE`. A literal old end-marker in message text is ordinary content.

As in format 2, two empty lines precede the exact message payload, and a line terminator plus two empty lines follow it. The next bubble marker immediately follows that framing; no additional separator line is inserted. Leading/trailing whitespace and message newlines are never trimmed. Literal reserved control lines and leading backslashes are escaped using a backslash. Draft and reply sections keep their explicit end markers.

The complete note content (messages, note settings, draft and pending reply) is saved once in `content.text`. Selection preferences are separate UI state. Standard Notes title, references, previews and unrelated application data remain. The editor does not write `appendEditorMessageData`, `appendEditorSettings` or `clientData.imStyleEditor` mirrors. If those obsolete owned fields accompany a valid new-format note, its next save removes them while preserving unrelated fields.

The working-memory caches are not saved copies. Message/settings records are immutable: changes create new records/arrays. A note is decoded again only when unfamiliar text arrives. Draft-only saves reuse the serialized bubble section; Standard Notes still receives a complete note snapshot. No delay is added to draft persistence. Existing acknowledgment, ordered-save, failure/retry and malformed-document protections remain.

Editor 4.1.4 keeps that immediate-save policy and format 3. Send no longer forces
a separate draft-only save before queuing the final message. The existing ordered
queue can replace a waiting draft snapshot with the final message, retaining the
input until host acknowledgment and preserving newer draft typing. There is no
new storage or custom-app API. Delayed-saving and custom-host experiments are
excluded from the build.

Editor 4.1.5 keeps format 3 and immediate draft saving. Its manual clipboard clear
adds no preferences, timers, note statuses, storage, or network access. Import-and-clear
waits for the existing note-save acknowledgment, then requests a separate confirmation
click to empty the current clipboard. Invalid or rejected imports do not open clearing,
and clipboard API failures remain visible. Archive's transfer source and bundle are unchanged.

Editor 4.0.5 also caches individual immutable bubble blocks. A new message array is still validated in full, but unchanged bubbles reuse their prepared text. Save snapshots capture the immutable `content.text` string directly and deep-copy the remaining metadata; superseded queued drafts therefore avoid JSON-encoding/decoding the full document. The host still receives complete snapshots, in order, with the same acknowledgment and retry behavior. Import matching uses temporary ID/provenance indexes to find candidates, then compares their full content and metadata as before. These caches and indexes are working memory only.

Editor 4.0.7 replaces the new editor's SDK outgoing-message history with lean reply records. Historical note payloads and fire-and-forget events are not retained. One-off callbacks are removed after replies or save timeout; streaming subscriptions remain live. The SDK's origin/session checks, object/JSON transport and host save acknowledgments remain intact. Archive's SDK is unchanged.

The save queue compares exact note text and JSON metadata against its latest pending snapshot or the current host-confirmed baseline. Identical pending requests share acknowledgment; already-confirmed identical writes are skipped. Changed or uncertain/rejected/timed-out snapshots still submit normally, with no added delay. Only the current note's confirmed baseline is retained, and a streamed host update replaces it. Normalizing-write loop protection also retains only the active note, without JSON copies of all message content. Preview generation stops after 160 characters; row measurements stop retaining removed or superseded records. Standard Notes still requires complete-note saves, and the current note's message records remain available in memory for editing, filtering and transfer.

Editor 4.0.8 honors the host's `isMetadataUpdate` contract. A metadata-only sync notification can include an older content snapshot, so it updates only same-note host timestamps and never replaces `content`, `clientData`, composer state, or the cached full context. Out-of-order timestamps do not move the host date backwards, and another note's metadata cannot switch context. Metadata is not a save acknowledgment: an unconfirmed draft stays pending. A previously acknowledged snapshot can have its host dates refreshed without treating unsaved current content as acknowledged or submitting a redundant content write. Real content updates still follow the normal stream path. The plaintext format is unchanged.

Nearby rows are drawn with estimated off-screen heights, then measured as they enter view. Scroll anchors are maintained across measurements and width changes. Selection and filtering operate on the complete record list; reply and pinned-message navigation first mounts an off-screen destination before locating/highlighting it.

Editor 4.1.0 keeps format 3. Merge selected joins exact message text with two newlines in note order, retains the first ID/date/position, combines tags, and maps selected pins to that ID. The merged record has `edited` and omits active `copied`/`exported`. `mergeSources` in extra metadata preserves source IDs/note IDs, dates and other non-text metadata (including quoted reply/forwarding information); it does not duplicate the source bodies or reactions. Repeated merges deduplicate source IDs within their note. Existing quoted snapshots remain unchanged, and navigation can resolve a source ID to the merged bubble, including after export/import. The preview checks its source records again before saving; an unconfirmed save retains the combined text and the normal Retry save path.

Automatic following uses the last 15% of the visible message area, bounded to 48–120 pixels from the bottom. Appending outside that range keeps the visible message and its pixel offset. The existing down-arrow shows a temporary count of new messages below; reaching the bottom or changing views clears it. This count is working memory only. Following respects reduced-motion preferences and yields to pointer, wheel and scroll-key input. Per-day selection operates on all current filter matches, rather than just rendered rows.

Validation:

```sh
node tests/next-format.test.cjs
python3 tools/package-next.py 4.0.0
IM_STYLE_EDITOR_BASE_URL=http://127.0.0.1:8010 python3 tests/next-editor-smoke.py
```

The browser test uses synthetic notes and a local Standard Notes bridge fixture. It does not replace checking an installed editor on a physical iPhone and Mac.

Editor 4.0.1 adds selective status clearing for all messages or a selected set. Clearing Imported stores the sparse `importedStatusCleared` marker in extra message metadata while retaining forwarding provenance for reply navigation and duplicate detection. A new import resets that suppression so the new arrival is visibly Imported. Other selected status fields are removed entirely.

Editor 4.0.2 remembers selected bubble IDs independently per note in device-local plugin UI storage, including editor reloads. It stores no message text and adds nothing to the saved note. Cancel/Escape remove the remembered selection. IDs absent from the current note are not restored. The selection indicator uses the entire current note as its denominator, even when filtering. This UI state does not sync between devices.

Editor 4.0.3 replaces device-local selection storage with the existing Standard Notes `set-component-data` bridge. The host stores this under `PrefKey.ComponentPreferences` in its synced UserPrefs item. `imStyleSelectionV1` contains only per-note bubble IDs and optional row height; unrelated plugin preferences are retained. The counter is now `1 / 500 selected`. No message text is duplicated and no direct networking is added.

The host has no successful-write acknowledgment for this API. A posted message is therefore not treated as proof of persistence. Legacy browser selection entries are imported only as their actual note is opened, and are deleted only after a subsequent component registration returns the saved preference. Unopened notes' old entries remain until migrated. A temporary empty preference prevents cancelling a pending migration from resurrecting its old selection; it is removed after verified cleanup. Save initiation/reported host failures display a retry notice, with no new plaintext-storage fallback. Silent host failures cannot be detected immediately; unverified legacy data is retained. Preferences are read on editor registration, not streamed live; simultaneous devices use the native preference snapshot behavior.

Editor 4.0.6 treats denied legacy browser-storage access as an unavailable optional migration source, not a failure to save encrypted preferences. A denied read is not repeated on every note switch in that frame. Existing local data is untouched, and known cancelled selections retain an empty preference until legacy absence/removal can be verified on a later editor reopening. Actual preference-save failures and failures to remove a known local entry remain visible.

Editor 4.0.4 adds one silent timer shared across notes in the new editor. Only 5-minute and 25-minute presets are available. `imSilentTimerV1` is saved through the same encrypted plugin-preference bridge, retaining unrelated preferences. It stores the original duration, finish time, and optional extension duration. Ticks do not save preferences or note content. Elapsed time is recalculated after visibility/focus changes and editor reloads; there is no native background alarm or notification.

Expiry disables the composer and Send button and opens a blocking, silent dialog. Esc cancels. Keys 2/3/4 only focus short extension/long extension/restart; Enter activates the focused choice. Pointer taps activate directly. Short and long extensions are 20% and 60% of the original duration: +1/+3 minutes for 5 minutes, +5/+15 for 25 minutes. Restart always repeats the original preset. The draft and caret are retained, selection mode is preserved, and focus returns after a choice. No audio, haptics, notification permissions, browser storage or independent network calls are used.

In 4.0.5, one-second countdown updates stay inside the timer badge. The main editor responds to timer actions, errors and expiry rather than every tick. A deadline callback, visibility/focus checks and the expired-input guard retain interruption behavior; the badge also detects forward clock changes. No extra preference saves occur on ticks.
