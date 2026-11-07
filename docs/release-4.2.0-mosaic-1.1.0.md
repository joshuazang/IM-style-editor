# IM 4.2.0 and Mosaic 1.1.0

All existing message text is now body text in Mosaic. First lines are no longer
implicitly headings; no text is moved, removed or automatically converted.
Explicit optional titles display above the same message in both interfaces.
They use a direct quoted `title:` metadata field, with escaped multiline text,
quotes and backslashes. Malformed, duplicate and non-string title fields remain
read-only. Message IDs, timestamps and body escaping/framing are retained.
Titles are stored once in the note. Untitled messages have no default title
property and add zero stored bytes, including in the 1,000-message test.

Update both modern editors before using titles. The optional field extends
format 3; older releases reject the unknown metadata and may report a titled
note as invalid. Untitled format-3 notes remain compatible. Archive is unchanged.
Both existing modern plugin identifiers and stable install URLs are retained.

Right-click/long-press menus offer Add title or Edit title. In IM and Mosaic's
board, the bottom composer shows a target preview and title-entry mode. Enter
saves onto that message, Shift+Enter adds a line, and Cancel returns to the
capture draft. Existing capture text and pending reply are preserved. Starting
another title cannot silently replace unfinished entry. Title-only changes do
not alter the body, its Edited status, message ID or creation time.

An opened Mosaic card has no editable title field until Add/Edit title is
chosen from its context menu. Existing titles otherwise display as headings.
Unlocked titles use normal multiline editing and the existing Close-to-save
flow. Untitled cards reserve no title space. Opened cards keep their Pin, More,
palette and Close controls. Only board previews lose Pin and More; all their
actions remain accessible through their context menus. Removing footer rows and
extra margins tightens tagged and untagged previews without shrinking font sizes
or line spacing, or deleting blank lines from actual text.

Title changes use the existing immutable note queue. Failed saves keep entry
and Retry; switching notes in the same editor retains unfinished title state.
Newer typing survives a late acknowledgment. Genuine different incoming text
pauses writes and retains versions for review; unfinished titles are exposed
for copying. Unsubmitted title/card entry remains RAM-only, so it is not a
durable backup after frame/app shutdown. Host acknowledgment does not prove
cloud synchronization. Already-sent requests cannot be recalled.

Search includes title text with cached preparation in Mosaic. Export/Import and
reply metadata preserve titles. Merge retains the first message's title and
puts subsequent titles into the combined body so all heading words stay visible.
Only changed message records need re-encoding; draft saves still reuse unchanged
bubble sections and remain immediate. Actual saves still submit the whole note.

Validation includes 32 data suites and eleven coordinated Chromium browser
suites, using synthetic notes. Title cases cover multiline/Unicode/escaped
control-like text, malformed refusal, metadata/status/body/draft preservation,
zero-byte unused titles, failed save and retry across switches, separate body
edits, late acknowledgments, foreign versions, explicit resolution and release
of confirmed sessions. UI flows run at 320, 390 and 1100px and check menu-gated
title fields, captured-draft restoration, exact body preservation, cross-editor
display, retained opened-card controls, and tight board-card bottoms. Existing
security, clipboard, timer, selection, 5,000-card and 10,000-card checks remain.
Physical iPhone hardware and installed Standard Notes binaries were not tested.

No new network service, telemetry, browser-storage recovery copy, preference
store or encryption key is introduced. The official Standard Notes client
continues to provide storage and synchronization encryption. Only the canonical
shared repository is developed and released; retired Mosaic remains untouched.
