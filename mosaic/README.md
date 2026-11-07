# Mosaic

A plain-text card board for Standard Notes, built from scratch.

**[Preview](https://joshuazang.github.io/IM-style-editor/mosaic/index.html?preview=1) · [Install](https://joshuazang.github.io/IM-style-editor/mosaic.ext.json) · [Download 1.1.6](https://joshuazang.github.io/IM-style-editor/Mosaic-1.1.6.zip)**

Mosaic and IM-style-editor 4.x are separate plugins sharing one note format and
one source core. Choose either editor for the same note in Standard Notes. No
conversion or duplicate note is required. Development, issues and releases for
both interfaces happen in this repository. The former standalone Mosaic
repository is retired and retains its history and frozen installation files.
Its old installer still points here for subsequent updates; use the current
install link above for a new installation.

Archive format-2 notes remain separate. Export their messages from Archive and
import them into a new format-3 note; keep the source until checked.

## Interface

Each message becomes a card. All its text is body text, including the first line.
A title appears only after Add title is explicitly chosen. Titles are optional
message metadata in the same plain-text note. Viewing a note does not rewrite it.
Pins appear first, then newer cards. Board order does not rearrange the IM timeline.
This is the current note's board, rather than an account-wide dashboard.

- Responsive masonry with two columns on phones and only nearby previews mounted.
- Board previews have no pin/More buttons or empty footer rows. Their actions
  remain in right-click/long-press menus. Font sizes and line spacing are retained;
  blank lines in message text stay intact. Opened cards keep Pin and More.
- Add/Edit title from the context menu opens a target preview in the bottom
  composer. Enter saves and Shift+Enter adds a line. Cancel restores the capture
  draft. Starting another title cannot overwrite unfinished title entry.
- An opened card initially has no editable title field. Add/Edit title from its
  context menu unlocks it above the body. Enter adds lines and Close saves.
  An existing title otherwise displays as a heading; untitled cards have no
  placeholder or reserved title space.
- Top-right Search/tags and More controls matching IM; search, untagged filtering,
  pins and selection. Filtering replaces the controls with a change/clear pill.
  These frosted controls float above the board; the surrounding strip is
  transparent and does not intercept touches on cards underneath.
  In night appearance, their foreground and frosted surface follow the palette
  and remain legible over both bright and dark cards.
- Cmd/Ctrl+F opens the board's whole-note search and selects its query. An open
  card keeps normal editing keyboard behavior.
- More → **Arrange tags** adds, replaces, merges, deletes and reorders emoji
  categories for this note. Replacing with an existing tag merges the categories.
  Confirmed deletion removes that tag from every card and keeps all cards/text.
  Untagged is movable and defaults to last. Both editors share these commands.
- A constant bottom “Take a note…” field. Enter adds a card and reveals it while keeping
  focus; Shift+Enter inserts a newline. Clicking outside also adds the card.
  IME confirmation keys finish composition rather than sending early.
  The typing box retains its solid surface, with transparent space around it.
  Scroll clearance keeps the last card accessible above the box.
  Its prompt disappears while focused and returns when empty and unfocused.
  Capture and opened-card text fields retain their normal surfaces without an
  additional rectangular focus outline.
- Click a card to edit directly. Enter adds a body newline; **Close** at the
  bottom right saves. Pin is the only top-right button, with palette and More
  in the bottom toolbar. Creation timestamp and separate edited/status indicators
  appear above that toolbar; board previews omit timestamps.
- A vector palette inside an opened card offers preset background colors, including
  Iris blue with white text. Default removes the optional color field.
- More → **Color palette** offers Sage (the original soft green), Paper (white
  and charcoal), and Sand (warm cream). These affect the board and default cards;
  explicit card colors are retained. Each palette keeps the existing automatic
  OS night appearance.
- More → **Font size** offers Small, Medium, Large and Extra large. Medium keeps
  the previous card text sizes; Large is the default. Board text, opened-card
  text and capture input respond to the choice, and measured card heights refresh.
  Phone capture text stays at least 16px to avoid input zoom.
- Filter tags and board tags have visible rounded borders and frosted surfaces.
  Search tags share IM's hover tint, and pin controls have a circular hover tint.
  Board previews use tighter spacing and omit all status labels; opened cards
  retain their timestamp and separate statuses.
- A separate quick-tag grid above the shared context actions. Emojis wrap across
  rows, with scrolling for larger tag collections. There is no Add label button
  or inline emoji selector in the opened card. Context-tag changes in an opened
  card are staged and saved on Close; board context-tag changes save immediately.
- Plain-text card editing, quoted replies and navigation to the original.
- Touch context menus wait for release after a hold; moving or cancelling the
  gesture does not open them. The opening release cannot activate a menu action.
- Selection matches IM: five top actions (tag, copy, export, more, delete) and
  bottom Select all/count/Cancel controls. Select all follows the current filter.
- Copy, Export, Import, merge, status clearing and confirmed deletion.
- Manual clipboard clearing and Import and clear clipboard, with confirmation.
- Three light palettes unaffected by system dark mode, reduced motion, keyboard menus and Escape to exit selection.

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

Fast saves stay quiet. A pending save shows **Saving…** after 300ms and briefly
**Saved** after acknowledgment. This visual delay does not delay saving. Saved
means the Standard Notes app accepted it; the app reports cloud sync separately.
Failed saves keep Retry and conflicts offer Review.

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

Palette and font size are saved per note as the whitelisted `mosaicPalette`
and `mosaicFontSize` settings through the existing acknowledged note queue. IM
preserves them. Missing or unknown values display Sage/Large without rewriting
the note. No appearance preference is stored in browser storage, and no fonts
are fetched from outside the plugin.

The shared menu design, touch placement, selection controls and static SVG
dictionary come from `shared/ui`, compiled into both editors. The tag group is
a separate solid panel above Edit, Reply,
Pin, Copy, Select and Delete; a divider separates red Delete. Export remains in
selection mode and the main menu rather than the card's context menu.

Each actual save still submits the whole note to Standard Notes. Caching and
virtual previews reduce local work, but cannot eliminate large-note sync limits.
Scrolling searches sorted column positions for nearby cards instead of scanning
the whole board. Prepared text and tag totals are reused until messages change;
font/width changes refresh geometry. These caches stay only in working memory.
Changes to messages or geometry can still rebuild the matching layout.

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

## Optional title compatibility and preservation

Titles require IM 4.2.0 / Mosaic 1.1.0 or later in both views. Older releases
reject the direct `title:` metadata field and may report a titled note as invalid.
Untitled format-3 notes remain unchanged. Titles use quoted strings with escaped
newlines; literal body text beginning with `title:` remains body text.

Title entry preserves the capture draft and reply. Failed title saves retain
entry for Retry; late acknowledgments cannot clear newer typing. Unsubmitted
titles and unfinished card edits stay in RAM across same-frame note switches;
closing the frame/app can discard unconfirmed work. Conflict review exposes
unfinished text. Title-only changes do not mark the body Edited. Search includes
titles, Export/Import preserves them, and Merge keeps the first title while
including later titles in the combined body so their words remain visible.

**Board view** is the card overview. Its compact emoji tags sit inside each
card's bottom-left corner, using the IM vector shape and hover feedback. Click
a tag to filter the board without opening a card or sending the capture draft.
In selection mode, tapping a tag selects its card like tapping the card body.

**Card view** is an opened note. Its separate emoji pills hang from the
bottom-left edge and remain read-only. Context-menu tag changes appear
immediately; multiple badges wrap with viewport clearance. Untagged cards
reserve no tag row. Mosaic has no automatic dark mode; Sage, Paper and Sand
remain light. The search prompt hides on focus without a rectangular focus box.

Touch scrolling does not show card or tag hover feedback. On desktop, scrolling
also suppresses hover under a stationary cursor; deliberate mouse movement
after scrolling restores it. Keyboard focus and selected-card indicators remain.

Selection places its indicator over the top-left card edge. Selected cards use
a compact black check and thin black emphasis. Card text, padding, wrapping,
height and masonry position remain the same in normal and selection modes.

The **Emoji picker** is the tag grid at the top of a card's context menu. It
expands to display all rows without a separate scrollbar. Opening the menu
focuses the menu itself, rather than making its first tag appear selected.
Search/Tags and More use the same shared icons and focus styling as IM; active
filters put the green check on the left and preserve the full search icon size.
