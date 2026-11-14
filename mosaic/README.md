# Mosaic

A plain-text card board for Standard Notes, built from scratch.

**[Preview](https://joshuazang.github.io/IM-style-editor/mosaic/index.html?preview=1) · [Install](https://joshuazang.github.io/IM-style-editor/mosaic.ext.json) · [Download 1.5.28](https://joshuazang.github.io/IM-style-editor/Mosaic-1.5.28.zip)**

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
In an opened card, use Text formatting → H1 or H2 for optional heading text in the body. Existing separate title
metadata remains readable and editable. Viewing a note does not rewrite it.
Pins appear first. Cards start newest-first and can be arranged by dragging;
new captures still appear first. Board order does not rearrange the IM timeline.
This is the current note's board, rather than an account-wide dashboard.

- Responsive masonry with two columns on phones and only nearby previews mounted.
- New captures animate in while neighbors move to their new positions. Drag a
  card to arrange it within its pinned/unpinned section; a dashed placeholder
  shows its destination. On phones, hold still then drag. Releasing a stationary
  hold opens the normal menu, and immediate swipes still scroll. Near the edges,
  the board scrolls automatically during a drag. Alt+Up/Down moves a focused card.
  More → Reset card order restores newest-first order. Reduced-motion preferences
  skip decorative animations while retaining drag feedback.
- Drag previews are memory-only and save once on a changed drop. A cancelled or
  unchanged drop does not save. Only a card-ID order is added to existing note
  settings, using Standard Notes' existing encryption and save protections;
  no additional stored text copies, browser persistence, telemetry or new service
  are introduced.
- Board previews have no pin/More buttons or empty footer rows. Their actions
  remain in right-click/long-press menus. Font sizes and line spacing are retained;
  blank lines in message text stay intact. Opened cards keep Pin and More.
- Edit title for an existing separate title from the context menu opens a target preview in the bottom
  composer. Enter saves and Shift+Enter adds a line. Cancel restores the capture
  draft. Starting another title cannot overwrite unfinished title entry.
- An opened card initially has no editable title field. Edit title from its
  context menu unlocks it above the body. Enter adds lines and Close saves.
  An existing title otherwise displays as a heading; untitled cards have no
  placeholder or reserved title space.
- Top-right Search/tags and More controls matching IM; search, untagged filtering,
  pins and selection. Filtering replaces the controls with a change/clear pill.
  These frosted controls float above the board; the surrounding strip is
  transparent and does not intercept touches on cards underneath.
  Mosaic retains its light appearance regardless of the system's dark setting.
- Cmd/Ctrl+F opens the board's whole-note search and selects its query. An open
  card keeps normal editing keyboard behavior.
- More → **Arrange tags** adds, replaces, merges, deletes and reorders emoji
  categories for this note. Replacing with an existing tag merges the categories.
  Confirmed deletion removes that tag from every card and keeps all cards/text.
  Untagged is movable and defaults to last. Both editors share these commands.
- A constant bottom “Take a note…” field. Enter adds a card and reveals it while keeping
  focus in ordinary text. In lists/checklists/quotations Enter continues the
  structure; after a heading it starts ordinary text. Send works in every format.
  Cmd/Ctrl+Enter exits the format, clears bold/strike and adds ordinary text;
  Shift+Enter inserts a line break within the current format. Clicking outside also adds the card.
  IME confirmation keys finish composition rather than sending early.
  The typing box retains its solid surface, with transparent space around it.
  Scroll clearance keeps the last card accessible above the box.
  Its prompt disappears while focused and returns when empty and unfocused.
  Capture and opened-card text fields retain their normal surfaces without an
  additional rectangular focus outline.
- Click a card to edit directly. Enter adds a body newline; **Close** at the
  bottom right saves. Text formatting, Pin, palette and More sit in the bottom
  toolbar. Creation timestamp and separate edited/status indicators
  appear above that toolbar; board previews omit timestamps.
- A vector palette inside an opened card offers preset background colors, including
  Iris blue with dark text. Default removes the optional color field.
- More → **Color palette** offers Sage (the original soft green), Paper (white
  and charcoal), and Sand (warm cream). These affect the board and default cards;
  explicit card colors are retained. All palettes stay light regardless of the OS setting.
- More → **Font size** offers Small, Medium, Large and Extra large. Medium keeps
  the previous card text sizes; Large is the default. Board and opened-card text respond to the choice, and measured card heights
  refresh. Capture typography shares IM’s text-scale setting.
  Phone capture text stays at least 16px to avoid input zoom.
- Filter tags and board tags have visible rounded borders and frosted surfaces.
  Search tags share IM's hover tint, and pin controls have a circular hover tint.
  Board previews use tighter spacing and omit all status labels; opened cards
  retain their timestamp and separate statuses.
- A separate quick-tag grid above the shared context actions. Emojis wrap across
  rows so the complete picker is visible. There is no Add label button
  or inline emoji selector in the opened card. Context-tag changes in an opened
  card are staged and saved on Close; board context-tag changes save immediately.
- Visual Markdown editing, quoted replies and navigation to the original.
- Touch context menus wait for release after a hold; moving or cancelling the
  gesture does not open them. The opening release cannot activate a menu action.
- Selection matches IM: five top actions (tag, copy, export, more, delete) and
  bottom Select all/count/Cancel controls. Select all follows the current filter.
- Copy, Export, Import, merge, status clearing and confirmed deletion.
- Manual clipboard clearing and Import and clear clipboard, with confirmation.
- Three light palettes unaffected by system dark mode, reduced motion, keyboard menus and Escape to exit selection.

The visual editor supports bold, strikethrough, headings, quotations, bullet
and numbered lists, and checklists. Other formatting remains readable text;
raw HTML never executes. There are no reminders or photo attachments. OpenKeep was a layout reference;
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

The two-slider button on the right of Search opens date filters. Presets cover
today, yesterday, the last seven days and the last thirty days; Exact date selects one whole day; custom From/To
dates include the entire end date. Filtering uses each message's original date
in your device's local time zone and combines with search, emoji and pin filters.
Use the X beside the active date label to remove only the date condition, or
the filter pill's X to clear all filters. No date label or All dates option is
shown when the date condition is cleared. Missing timestamps appear with no
date condition. Filtering changes
the view only. New captures and explicit reply jumps can clear a hiding date
condition to reveal their target, consistent with Mosaic's existing navigation.

Search shows a thin black focus emphasis. Its input remains solid; IM alone
uses the restored frosted search-field surface.

Mosaic 1.4.1 caps Board cards at eight times the basic one-line height. Drag
placement requires a steady 150ms hover, with a midpoint dead band and time for
neighbors to settle. Neighbors move over 400ms and the card lands over 280ms.
Release commits the displayed placeholder, without selecting an unseen target.
The destination marker stays fixed while neighboring cards animate around it.
Settings-only saves retain measured card geometry to avoid landing jumps.
Date navigation retains its destination position while taller previews are measured.

Mosaic 1.4.2 fills the shared 8× height for truncated title/body previews,
leaving residual line-fitting space below the content. Untruncated cards keep
their natural compact height. Note text, typography and save behavior are unchanged.

Mosaic 1.4.3 shares composer typography with IM, following the note’s existing
IM text scale (17.92px by default). The composer has 10px vertical padding and
a 46px minimum field height, retaining its original 14px corner radius. Mosaic’s
font-size choices continue to control Board and opened-card typography.

Mosaic 1.4.4 keeps the standard 8× body preview independent of optional titles,
reply previews and tags. Their height is added to the card, never deducted
from body text. Titles retain a separate preview allowance. Short bodies
still fit naturally, and tag overflow remains available through +N.

Mosaic 1.4.5 reduces padding in opened cards, placing a single content scrollbar
at the right edge. Titles, body text and trailing timestamps/statuses share the
scroller. The fixed action row shows a soft shadow only while content remains
below; reaching the bottom removes it. Short cards still fit their contents.

Mosaic 1.4.6 removes the remaining top and bottom content insets. The pin
scrolls away with the content, and Palette, More and Close sit against the
bottom edge to leave more room for text. Save warnings remain visible.

Mosaic 1.4.7 gives existing and editable titles a small top inset inside the
scrolling heading. Untitled cards retain their compact spacing.

Mosaic 1.4.8 moves Pin into the bottom toolbar, immediately left of Palette.
Palette sits immediately left of More, followed by Close, as one group at the
bottom right. The title keeps the small scrolling top inset.

Mosaic 1.4.9 adds a 4px top inset to the body and increases the title inset
from 4px to 4.8px. Both belong to the scrolling content, leaving no fixed
padding band at the top while scrolling.

Mosaic 1.4.10 reuses Board tag vectors and accent fill in read-only Card-view
badges. Open/Close use short, reduced-motion-aware shifts; Reply hands focus
to the composer immediately. Drag targeting follows visible card positions,
captures a new hover during the settling interval, retains it through reflow,
and displaces adjacent cards when the
nearest insertion would otherwise be a no-op. A 150ms hover and 280ms settling
interval preserve intentional placement; release commits the displayed slot.

Mosaic 1.4.11 opens Card view without focusing a text field on iPhone. Tap the
body or explicitly choose Add/Edit title to edit. Other platforms retain their
existing automatic body focus. No note content or composer drafts are changed.

Mosaic 1.4.12 opens cards as full pages on iPhone, including safe-area insets
and visual-viewport resizing. Tags remain read-only inside the page above the
compact toolbar. Other devices retain the floating card. Card motion maps the
visible Board rectangle to its measured destination and back, using transforms
without a fade. Body height is measured before motion starts; no-op closes
retain the existing save protections.

Mosaic 1.4.13 increases the body’s scrolling top padding from 4px to 6px.
The content viewport retains zero top padding, and title spacing is unchanged.

Mosaic 1.4.14 sets both body top padding and optional-title top padding to
7px. Both remain inside the scrolling content.

Mosaic 1.4.15 gives body-only opened cards 12px of scrolling top padding for
more visible breathing room. Title top padding and body spacing beneath an
existing title stay at 7px. Board spacing is unchanged.

Mosaic 1.4.16 finishes automatic focus and scroll setup before Card-view
expansion starts. Mac transitions animate transforms only, with a temporary
compositor hint and a two-frame handoff before releasing the opening effect.
Popup actions and forced closes cancel pending handoff work. The dim Card-view
backdrop no longer blurs the whole Board; controls and menus keep their frost. The existing
320ms rectangle morph, padding and acknowledged-save protection remain.

Mosaic 1.4.17 bounds initial native-textarea layout when opening very long
scrollable cards. Once the initial text proves the final card must scroll,
the remaining body is prepared after an initial paint, or after expansion for
very large bodies. Immediate input prepares the full text first; all saving
continues to use the complete working text. Short cards and reduced motion
retain immediate full preparation. Timestamp formatting is reused across opens.

Mosaic 1.4.18 starts opening and closing playback after holding the initial
rectangle through a rendering opportunity. A delayed first render no longer
uses up the moving portion of the animation. All pending long-body preparation
waits until expansion finishes; immediate input still prepares complete text.
Closing before playback starts and switching notes cancel pending playback.

Mosaic 1.4.19 opens Card view for reading without automatically focusing the
body or title on any platform. Click/tap the body or Tab into it to edit.
Add/Edit title still explicitly focuses its field. This removes native text
focus work from opening; its effect on the reported Mac hitch needs device testing.

Mosaic 1.4.20 restores automatic body focus outside iPhone. The caret starts
after the final character so typing appends to the complete body, even before
long-note preparation finishes. Opening retains its existing top scroll position.
iPhone continues to open without text focus or an automatic keyboard.

Mosaic 1.4.21 gives phone Board previews the existing 8× body allowance and
computer previews an 11× allowance. Device type determines the limit, so narrow
desktop windows retain 11× and landscape phones retain 8×. Titles, replies and
tags still add height outside the body allowance. Overflow shows an ellipsis;
opening a card shows its complete text. The allowance is local display behavior
and does not change the stored note or synchronize a device-specific preference.

Mosaic 1.4.22 fixes text-selection drags released outside Card view closing the
card. Outside dismissal now requires a primary press and release outside the
same modal session. Cancelled presses and presses from replaced dialogs cannot
dismiss the card. Normal outside clicks, Close and Escape retain the existing
save acknowledgment and failed-save retry protections.


Mosaic 1.5.0 shares visual Markdown editing and the same seven-format codec with
IM 4.4.0. Formatting controls are under Aa; capture includes an explicit Send
button. Command/Control+Enter creates a new ordinary paragraph outside the
current format, clearing bold/strike. In Card view Enter remains multiline and
Close saves through the existing acknowledgment/conflict protection. Legacy
titles remain editable; new optional headings are body content. See
[the shared contract and dependency provenance](../docs/VISUAL-MARKDOWN.md).


Mosaic 1.5.1 keeps the Board capture field free of Aa/formatting controls, matching
IM 4.4.1. Card view retains its formatting toolbar. H1–H6 choices show the active
level with a tint, follow the caret or selection, and toggle back to ordinary
text when the active level is clicked again. Text, selection and existing
capture/send behavior are preserved.

Mosaic 1.5.2 applies Heading to the current logical line, or only the selected
lines in a multiline selection. Pasted text with single line breaks no longer
becomes one large heading when only one character is selected. The shared fix
preserves surrounding lines, inline marks, selection, Undo and saved formatting.

Mosaic 1.5.3 floats the Aa formatting panel above the Card toolbar, keeping
short cards compact and leaving the bottom controls and text area stationary.

Mosaic 1.5.4 shares consistent on/off formatting toggles with IM 4.4.3, including
checklists, nested quotations/lists and whole-text selections.

Mosaic 1.5.5 fixes multiline checklist conversion, empty-item save/reopen and
checkbox/text touch separation. Full-selection paste replaces old list structure;
Undo restores checklist formatting in one step.

Mosaic 1.5.6 moves the Board capture text start 2px left, retaining its box shape,
font size, height and right inset.

Mosaic 1.5.7 shares live list, quote and heading shortcuts after soft line breaks
with IM. Typing a marker followed by Space formats the current line immediately.

Mosaic 1.5.28 reuses the Card Aa toolbar as a floating selection toolbar in Board
capture and Card body fields. Shared SVG controls match IM, keep selected text
and never trigger outside-click capture sending. Quotes use tinted rounded insets.

Board preview caps: pinned phone cards use 6× and pinned computer cards 8×;
unpinned phone cards use 8× and unpinned computer cards 14×. Titles, tags and
replies add height beyond the body preview allowance.
