# Security and privacy boundaries

This records the inspected code and synthetic regression properties, not a
guarantee about a particular device or every future release.

## Data flow

Both modern editors receive the current note through Standard Notes' component
host. Saves use `save-items`; preferences use `set-component-data`. They do not
send note text to an independent service. Mosaic requests no account-wide note
stream. Its relay checks the parent window, binds origin/session and tracks
random request IDs. IM retains its SDK transport with a guard before the older
receiver: supplied source windows must be parent, malformed/referrer/origin input
is rejected, replies require a known request and a matching session when supplied,
and duplicate registrations/unused theme messages are ignored. Source-less native
JSON/document messages remain supported. External SDK theme activation is disabled.

Both shipped pages have `connect-src 'none'`. Mosaic has no fetch/XHR/WebSocket,
analytics, remote font, service worker or runtime package dependency. Its UI is
original code using OpenKeep only as a layout reference. IM retains its existing
React/SDK dependencies. Neither app embeds an account password or encryption key.

Initial installation, hosted previews and updates can contact GitHub Pages.
Those requests disclose ordinary connection metadata to the hosting service.
Bundled assets enable installed/offline operation where the Standard Notes client
supports it; a newly opened website still needs assets available in its cache.

## Encryption

The plugin does not implement encryption. The official Standard Notes client
encrypts Note and UserPrefs records for storage/sync using its items-key system.
Account password protection, local keychain/database protection, optional app
passcode and device settings belong to that client and OS. A device login password
alone is not the same as an additional Standard Notes app passcode.

The earlier source review checked Standard Notes revision
`f64d5a4a1991d0e5d1c326c6131673ab4b72684c`: component saves pass through native
mutators/sync persistence, Note/UserPrefs are encrypted, desktop uses the OS
keychain, and iOS keychain access uses WhenUnlockedThisDeviceOnly. A website's
browser-backed keychain has different protections. This is a source trace, not
inspection of a user's actual local database or installed binary.

Readable note text necessarily exists in the editor/client's RAM while in use.
Explicit Copy/Export puts readable text on the system clipboard. Clipboard
history, OS memory/swap, backups, screen capture, accessibility tools, keyboards,
extensions and compromised devices are outside this plugin's control. Manual
clearing empties the current clipboard, not every historical clipboard copy.

## Content handling and persistence

- User text enters text nodes or textarea values, never evaluated HTML/scripts.
  The shared fixed SVG icon dictionary contains no user content. The DOM SVG
  factory and React SVG wrapper interpret only those static strings as markup.
- Format validation, escaped reserved lines, import preview and malformed-note
  read-only behavior are retained. Format 2 is intentionally incompatible.
- Save snapshots are immutable and ordered per note, with one in flight and at
  most one newest waiting snapshot. Acknowledgment is not proof of server sync;
  Standard Notes reports server failures separately.
- Failed submissions keep text for retry. Both interfaces retain unconfirmed
  sessions across note switches while their iframe remains alive. IM edit fields
  remain open until acknowledgment; late acknowledgments preserve newer edits.
  Conflicting host text pauses waiting writes; no automatic conflict overwrite is attempted.
  A request already sent cannot be recalled. Destroying the frame can lose
  unacknowledged RAM-only work.
- Conflict review exposes both raw texts and any unfinished IM edit. Choosing a
  version requires explicit confirmation and waits for already-sent writes to
  finish. Saving a local choice retains its comparison source until success.
- Preference callbacks are bounded per operation. IM keeps independent latest
  selection and timer error callbacks, so the lack of successful preference
  acknowledgments cannot grow an unbounded callback history.
- Late clipboard completion marks only unchanged current source text. Switching
  notes defers the mark until its note returns; it does not save an old full note.
- Ordinary native field changes survive later Mosaic saves; metadata-only
  notifications cannot replace content. Optional unknown metadata stays data.
- Selection IDs use Standard Notes encrypted component preferences. The host has
  no success acknowledgment for that preference API. Mosaic creates no browser
  storage copies. IM retains only its previously documented legacy selection-ID
  migration; it does not introduce plaintext note/draft browser storage.
- Text fields request disabled spellchecking, autocomplete, autocorrection and
  writing suggestions. These are client hints; OS/keyboard writing tools or
  third-party services may ignore them. CSP does not govern those external tools.
- Mosaic card colors resolve preset IDs to fixed local CSS colors; arbitrary
  metadata cannot supply CSS or URLs. Labels are text in the existing reaction
  array, rendered as text nodes. Neither feature introduces storage/network APIs.
- Opened Mosaic cards use normal multiline typing and save through the same
  acknowledged queue on Close. Failed Close leaves the fields available; a late
  acknowledgment cannot discard newer typing. Note switches can retain an
  unfinished editor in RAM, but do not create an additional durable text copy.

Neither the code review nor synthetic tests can establish that nobody or no
machine can ever read a note. The renderer and trusted Standard Notes client
necessarily process readable content; malicious hosts/updates or compromised
devices can access it. No telemetry or independent note-upload path was found in
the reviewed application source. No actual account notes were used in tests.

Mosaic's prepared search text, tag totals and column-position index live only in
RAM. The shared save indicator schedules visual updates only: no save delay,
new browser storage, preference copy or network request is introduced. Tag
management uses the existing acknowledged note queue and preserves message text.

Optional titles are escaped text in the same note. Title entry uses the existing
acknowledged queue and RAM-only unfinished-edit protection, without a separate
browser/prefs title store. Title fields and display use text values/nodes;
HTML-looking titles are never evaluated. Older readers reject the new field.

See [release validation](release-4.2.0-mosaic-1.1.0.md) for current checks and limits.
