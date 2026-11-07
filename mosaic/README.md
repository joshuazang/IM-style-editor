# Mosaic

A plain-text card board for Standard Notes, built from scratch.

**[Preview](https://joshuazang.github.io/IM-style-editor/mosaic/index.html?preview=1) · [Install](https://joshuazang.github.io/IM-style-editor/mosaic.ext.json) · [Download 1.0.3](https://joshuazang.github.io/IM-style-editor/Mosaic-1.0.3.zip)**

Mosaic and IM-style-editor 4.x are separate plugins sharing one note format and
one source core. Choose either editor for the same note in Standard Notes. No
conversion or duplicate note is required. The original Mosaic installer at
`https://joshuazang.github.io/Mosaic/mosaic.ext.json` still works.

Archive format-2 notes remain separate. Export their messages from Archive and
import them into a new format-3 note; keep the source until checked.

## Interface

Each message becomes a card: the first line is its title and the remaining lines
its body. They remain one saved text string. Viewing a note does not rewrite it.
Pins appear first, then newer cards. Board order does not rearrange the IM timeline.
This is the current note's board, rather than an account-wide dashboard.

- Responsive masonry with two columns on phones and only nearby previews mounted.
- Top-right Search/tags and More controls matching IM; search, untagged filtering,
  pins and selection. Filtering replaces the controls with a change/clear pill.
- A constant bottom “Take a note…” field. Enter adds a card and reveals it while keeping
  focus; Shift+Enter inserts a newline. Clicking outside also adds the card.
  IME confirmation keys finish composition rather than sending early.
- Click a card to edit directly. Enter adds a body newline; **Close** at the
  bottom right saves. Pin is the only top-right button, with palette and More
  in the bottom toolbar. Creation timestamp and separate edited/status indicators
  appear above that toolbar; board previews omit timestamps.
- A vector palette on every card offers preset background colors, including
  Iris blue with white text. Default removes the optional color field.
- A separate quick-tag panel above the shared context actions. **Add label**
  adds a label/emoji through the same tag array. In an opened card, tags are
  staged with the edit and saved on Close. On the board they save immediately.
- Plain-text card editing, quoted replies and navigation to the original.
- Copy, Export, Import, merge, status clearing and confirmed deletion.
- Manual clipboard clearing and Import and clear clipboard, with confirmation.
- Light/dark themes, reduced motion, keyboard menus and Escape to exit selection.

No reminders, photos, checkboxes, Markdown rendering or rich-text editing.
HTML-looking text is displayed literally. OpenKeep was a layout reference;
no OpenKeep application code, assets or dependencies are included.

## Saving

Capture drafts save immediately on input through Standard Notes' acknowledged
queue. There is one in-flight save per note and at most one waiting snapshot;
newer waiting versions replace older ones. Idle time causes no note saves.
Adding a card can replace a waiting draft-only write with the final card write.
Input clears only after acknowledgment, and a late acknowledgment cannot clear
newer typing.

Rejected saves remain available when switching away and back in the same live
editor. Retry saves that retained version. A conflicting host version pauses
waiting writes and offers both texts for review. An already-sent request cannot
be recalled. Closing the iframe/app can discard unconfirmed RAM-only recovery;
these protections are not a promise against every abrupt shutdown.

Existing-card changes save with **Close**, Escape or a backdrop click. The editor
waits for acknowledgment and stays open on a failed save. New typing during a
pending Close remains open for another save. An unchanged Close submits no edit.
Switching notes without Close keeps unfinished edits per card in working memory
under **Resume unfinished edit**, while the same editor frame remains alive.
Close the edit before switching interfaces or closing the app.

Copy/Export flags are applied after a successful clipboard write, to the latest
matching original message. If that message changed during the clipboard action,
its newer text is not marked as copied. Manual native copying cannot be verified.
Refreshed Standard Notes titles, references and unrelated native fields survive
later writes. Invalid notes remain read-only.

Label and color changes save through the same queue without changing message
text or its Edited status. Optional `cardColor` stores only a preset ID in
format-3 extra metadata; IM preserves it through edits and editor switches.
Unrecognized color IDs are never evaluated as CSS. Preview heights are measured
only for nearby new/resized cards and reused during later layouts.

The shared menu design and static SVG dictionary come from `shared/ui`, compiled
into both editors. The tag group is a separate solid panel above Edit, Reply,
Pin, Copy text, Export, Select and Delete; a divider separates Delete.

Each actual save still submits the whole note to Standard Notes. Caching and
virtual previews reduce local work, but cannot eliminate large-note sync limits.

## Privacy and encryption

No telemetry, analytics, independent cloud storage, remote fonts or browser-storage
note copies. Assets are bundled; CSP blocks independent network connections.
All note saves and selection preferences use the registered Standard Notes host.
Standard Notes supplies encryption and sync. Readable text exists in memory and,
after an explicit copy/export, in the OS clipboard. GitHub may receive asset-load
metadata; offline availability depends on the installed plugin/client cache.

Text fields request disabled browser proofing and writing suggestions. An OS,
keyboard, extension, accessibility service or modified client can ignore those
requests. No hosted plugin can promise protection against a compromised device
or malicious future update. See [security boundaries](../docs/editor-security.md).

## Development

Canonical source is in this repository: `mosaic/src` for this interface and
`shared/core` for both modern editors. No npm runtime dependency is used by Mosaic.
Python 3 and Node build and check the data layer. Browser tests additionally use
Python Playwright and Chromium; only synthetic notes are used.

```sh
python3 tools/package-editors.py
python3 tools/check-editors.py --data-only
# pip install playwright==1.62.0 && python3 -m playwright install chromium
python3 tools/check-editors.py
```

See [shared maintenance](../docs/shared-editors.md) and [NOTICE.md](NOTICE.md).
Browser-sized tests do not substitute for physical iOS/macOS Standard Notes tests.
