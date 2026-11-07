# IM 4.1.11 and Mosaic 1.0.7

IM previously treated the Promise returned by an existing-message save as an
immediate success, clearing the edit field before acknowledgment. A rejected
edit could then disappear after switching notes. It also ignored every same-note
host update while a save was pending, allowing a genuinely newer version to be
overwritten by its next queued local snapshot.

The IM interface now retains unconfirmed full-note sessions and unfinished edits
per note in working memory. Existing-message edits close only after acknowledgment;
newer typing survives late replies. Failed edits and other mutations return when
switching back, and Retry saves the retained version. Confirmed inactive sessions
release their recovery state. The original immediate draft and acknowledged Send
behavior remain in place.

Known self-echoes and metadata-only events do not replace local text. Ordinary
native fields rebase waiting snapshots without mutating already-sent requests.
Unknown different text pauses queued writes and retains both versions. Review
offers the raw local/host text and unfinished edit; neither version is chosen by
closing the dialog. Explicit, confirmed resolution waits for in-flight requests
to finish. A failed local overwrite retains the comparison source for retry.

Shared reply tracking now bounds callbacks for operations without success replies.
IM selection and timer preferences use separate callback keys so newer changes
replace obsolete callbacks without dropping the other operation's errors or the
persistent context stream.

IM's bundled SDK transport has a guard before its legacy receiver. When a sender
window is supplied it must be the parent. Referrer/origin, registration shape,
known request and session correlation are checked before dispatch. Duplicate
registrations, malformed input and unused theme messages are ignored. Native
source-less document/window JSON transport remains supported. The SDK's unused
external theme activation is disabled; the editor's own appearance remains.

Mosaic uses palette-aware light foregrounds and frosted surfaces in night appearance.
Header icons meet at least 3:1 contrast in the tests across Sage, Paper and Sand,
against the canvas plus bright, black and Iris-blue backgrounds. Control sizes,
positions, blur and transparent surrounding strips are unchanged.

Validation includes 29 data suites and nine coordinated Chromium browser suites.
The additional IM cases cover rejected edits/pins across note switches, retry,
newer typing, metadata updates, genuine incoming conflicts, close/cancel/confirmed
version choices, failed explicit overwrite, native-field preservation, actual
receiver peer/forged-session tests, native JSON messages, 250 selection/timer
updates with bounded callbacks, and no browser-persistence writes. They run at
320, 390 and 1100 pixels with synthetic notes. Existing clipboard, timer, capture,
format interchange and 5,000-message regressions remain included.

Original audit reproductions now preserve failed IM edits and incoming host content,
reject same-origin peer messages, and retain bounded preference callbacks. Physical
Standard Notes/iPhone binaries were not exercised by these browser simulations.

Format 3, plugin IDs and install links are unchanged. No browser recovery store,
new cloud endpoint, account key or encryption layer is introduced. The official
Standard Notes host remains responsible for storage/sync encryption. Retained RAM
is not a durable backup after the editor frame/app is destroyed; an acknowledgment
does not prove server sync, and an already-sent write cannot be recalled.

Only the canonical shared repository is released. Archive format 2 and the retired
standalone Mosaic repository remain unchanged.
