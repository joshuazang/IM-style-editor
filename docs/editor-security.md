# Security and privacy boundaries

This records the inspected code and synthetic regression properties, not a
guarantee about a particular device or every future release.

## Data flow

Both modern editors receive the current note through Standard Notes' component
host. Saves use `save-items`; preferences use `set-component-data`. They do not
send note text to an independent service. Mosaic requests no account-wide note
stream. Its relay checks the parent window, binds origin/session and tracks
random request IDs. IM retains its existing official relay integration.

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
  Mosaic's fixed SVG icon dictionary contains no user content.
- Format validation, escaped reserved lines, import preview and malformed-note
  read-only behavior are retained. Format 2 is intentionally incompatible.
- Save snapshots are immutable and ordered per note, with one in flight and at
  most one newest waiting snapshot. Acknowledgment is not proof of server sync;
  Standard Notes reports server failures separately.
- Failed submissions keep text for retry. Mosaic additionally retains unconfirmed
  sessions across note switches while its iframe remains alive. Conflicting host
  text pauses waiting writes; no automatic conflict overwrite is attempted.
  A request already sent cannot be recalled. Destroying the frame can lose
  unacknowledged RAM-only work.
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

Neither the code review nor synthetic tests can establish that nobody or no
machine can ever read a note. The renderer and trusted Standard Notes client
necessarily process readable content; malicious hosts/updates or compromised
devices can access it. No telemetry or independent note-upload path was found in
the reviewed application source. No actual account notes were used in tests.

See [release validation](release-4.1.6-mosaic-1.0.1.md) for checks and limits.
