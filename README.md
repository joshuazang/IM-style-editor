An IM-style editor for Standard Notes

This repository now contains two separately installable interfaces built from
one shared format-3 core:

- **[IM-style-editor 4.4.1](https://joshuazang.github.io/IM-style-editor/im-style-editor-next.ext.json)** — a message timeline.
- **[Mosaic 1.5.1](https://joshuazang.github.io/IM-style-editor/mosaic.ext.json)** — a plain-text card board. [Preview](https://joshuazang.github.io/IM-style-editor/mosaic/index.html?preview=1) · [Guide](mosaic/README.md).

Both can open the same format-3 note without conversion. All development and
releases for both interfaces happen here. The standalone
[Mosaic repository](https://github.com/joshuazang/Mosaic) is retired, retaining
its history and frozen install files. Its installer points to this repository
for subsequent updates; use the current Mosaic install link above for new
installations. Each interface bundles the shared code; neither downloads code
from the other at runtime. IM-style-editor Archive remains separate and unchanged.

Build both with `python3 tools/package-editors.py`; validate with
`python3 tools/check-editors.py`. A shared-code change is checked against both
interfaces, including editor switching. See [maintenance](docs/shared-editors.md)
and [security boundaries](docs/editor-security.md).

- **IM-style-editor Archive** keeps the existing editor and format-2 notes. Its install manifest remains [im-style-editor.ext.json](im-style-editor.ext.json).
- **IM-style-editor 4** is a separate plugin with format-3 notes and an independent install manifest: [im-style-editor-next.ext.json](im-style-editor-next.ext.json). Both can be installed together.

The two note formats are intentionally incompatible. Keep existing notes in Archive. To move messages, clear filters in Archive, select all the intended messages, choose **Export**, then open a **new note** in the new editor and choose **Import from clipboard**. This transfers bubbles with their timestamps, tags and message metadata; it does not transfer the unsent draft, pins, or the source note's appearance/settings. Imported messages use the destination's appearance and show **Imported**. Keep the source note until you have checked the import.

The new editor saves one complete plain-text representation, reuses decoded messages while saving drafts, and renders a measured window of nearby bubbles. See [format 3](docs/note-format-3.md) for storage details and validation.

Editor 4.0.3 remembers selections through Standard Notes’ encrypted account preferences. Existing browser-local selections migrate as their notes are opened; their local entries are removed only after an editor reopening reads the saved preferences back from Standard Notes. The bottom indicator uses `selected / total selected`.

Editor 4.0.4 adds **Timer** to the main three-dot menu: silent 5- and 25-minute presets. When it finishes, typing pauses until you cancel, extend, or restart. In that dialog, 2/3/4 focus the choices and Enter confirms; Esc cancels. If the editor was suspended or closed, the finished prompt appears when you return.

Editor 4.0.5 reduces work while saving drafts, changing bubbles, importing messages and displaying the countdown. Drafts still save immediately through the same acknowledged queue, and the note format and Archive remain unchanged.

Editor 4.0.6 fixes false selection-saving warnings when an embedded editor blocks access to old browser storage. Current selections continue to use Standard Notes’ encrypted preferences.

Editor 4.0.7 releases past save contents from the host bridge, skips identical saves already confirmed by the host, and limits temporary note/row caches. Changed drafts still save promptly using complete note snapshots.

Editor 4.0.8 fixes metadata-only sync updates restoring an older draft after Send. Host timestamps update without replacing the current message content or draft; ordinary content updates and draft autosaving continue normally.

Editor 4.1.0 adds **Merge selected** to the selection three-dot menu, with a combined-message preview. Text stays in note order, separated by blank lines; tags and pins are combined and reply destinations are preserved. The first message keeps its position/date. The combined message is edited and its Copied/Exported statuses reset.

Reading older messages now stays anchored when messages change below. Near the bottom, new messages follow smoothly; otherwise the down-arrow shows how many new messages are below. Date boundaries have doubled separator margins, and clicking a date’s selection control selects that day’s messages in the current view, including off-screen filter matches. **Iris blue** is `rgb(78, 92, 240)` with white text.

Editor 4.1.2 makes date separators more prominent with about 40% more space at day boundaries, larger bold date labels, stronger contrast and clearer divider lines. Same-day message spacing is unchanged.

Editor 4.1.4 removes the forced draft-only save before Send. When a newer draft is
waiting behind an unfinished save, the final message can replace that queued draft.
Draft saving remains immediate, and the input stays until the host acknowledges
the save. This reduces some save submissions; large notes can still encounter
sync limits. Keep existing notes intact and use a smaller active capture note if needed.

Editor 4.1.5 adds **Clear clipboard** to the three-dot menu, with confirmation.
Import offers **Cancel**, **Import**, and a red **Import and clear clipboard**.
The combined action waits for the import-save acknowledgment before asking to clear;
cancelling keeps the clipboard, and rejected imports never initiate clearing.
Clearing uses an explicit click through the existing clipboard compatibility path.
Timed clearing is not offered because the official-style sandbox blocks it without
a fresh user gesture. This clears the current clipboard, not clipboard-manager history.

IM 4.1.6 / Mosaic 1.0.1 consolidate the modern parser, save queue, transfer,
clipboard and reply helpers under `shared/core`. Mosaic retains failed saves
across note switches in the same live editor, applies late clipboard statuses to
the latest matching message, and preserves refreshed native note fields. Drafts
reuse their cached message section after adding/editing cards. Newly created
replies keep bounded quoted context rather than recursively copying the entire
chain; existing saved replies are preserved. Both interfaces request that browser
spellchecking, autocomplete, autocorrection and writing suggestions stay off.

Mosaic 1.0.2 uses two compact masonry columns on phones. Enter adds a card and
reveals it without moving input focus; Shift+Enter inserts a line break. The
same keys save an existing card or add a body line. Each card has a vector
palette for preset background colors and **Add label** in its three-dot menu.
Labels reuse the shared tags; card colors are optional message metadata that
IM preserves. Nearby previews use their measured heights to avoid blank space
and clipped controls. Draft saving and the shared core are unchanged.

IM 4.1.7 and Mosaic 1.0.3 share the same solid context-menu design and SVG
dictionary in `shared/ui`. A separate tag panel appears above the actions, and
Delete has its own separator. Existing IM actions keep their handlers; Export
and Add label expose the existing transfer/tag data paths from the context menu.

Mosaic cards open directly for editing. Enter adds newlines inside the opened
card; the bottom-right **Close** saves and waits for acknowledgment. The timestamp
and separate edited/status indicators appear in that editor, with no timestamps
on the board. Only Pin occupies the top-right corner; palette, More and Close
are at the bottom. Capture moves to the bottom and retains Enter-to-send, while
the top-right Search/tags and More controls match IM. See [release validation](docs/release-4.1.7-mosaic-1.0.3.md).

IM 4.1.8 and Mosaic 1.0.4 simplify both message menus to Edit, Reply, Pin/Unpin,
Copy, Select and separated red Delete. The shared emoji grid wraps across compact
rows instead of full-width vertical buttons. Export and Add label are removed
from these menus; export remains available through selection and existing main
menu actions. Mosaic's palette appears only in opened cards, and the inline
emoji selector is removed from the card editor. Existing tags/colors and the
note format are unchanged. See [release validation](docs/release-4.1.8-mosaic-1.0.4.md).

IM 4.1.9 and Mosaic 1.0.5 share the selection controls, menu-positioning helper
and selection-option SVGs. Mosaic opens touch context menus after release and
floats its frosted top controls above the board. The surrounding composer strip
is transparent; the typing box keeps its solid surface. Selection mode matches
IM's five top actions and bottom Select all/count/Cancel controls. Saving and
the shared note format are unchanged. See [release validation](docs/release-4.1.9-mosaic-1.0.5.md).

IM 4.1.10 gains Mosaic's filter-tag hover tint. Mosaic 1.0.6 adds bordered frosted
filter tags and board tags, compact previews without status labels, and circular
pin hover feedback. Its More menu offers Sage, Paper and Sand palettes and four
font sizes: Small, Medium (the previous typography), Large (the default), and
Extra large. These are note settings; card text, statuses, pins and custom colors
remain intact. See [release validation](docs/release-4.1.10-mosaic-1.0.6.md).

IM 4.1.11 retains unconfirmed edits and other changes across note switches. Edit
fields close after acknowledgment and preserve newer typing. A genuinely different
host version pauses waiting saves and offers both texts for explicit review.
Its receiver now checks the parent sender and session/request correlation, ignores
unused theme loading, and bounds preference callbacks independently for selections
and the timer. Mosaic 1.0.7 fixes dark header contrast while retaining frost and
transparent surrounding strips. Format 3 and the storage/encryption channel are
unchanged. See [release validation](docs/release-4.1.11-mosaic-1.0.7.md).

IM 4.1.12 gives selection rows separate 44px touch targets. Taps stay bound to
the original message; dragging and cancelled gestures do not select a neighbor.
Both editors improve keyboard focus and control contrast, and show quiet saving
feedback after 300ms. This delays only the label: drafts still save immediately.
Failed saves retain their existing Retry warning and conflicts retain Review.

Mosaic 1.0.8 adds focused Cmd/Ctrl+F search and **More → Arrange tags**, using
the same add, replace/merge, confirmed delete and reorder commands as IM.
Untagged remains movable and defaults to last. Message text stays intact.
Board scrolling uses indexed columns, while search text and tag totals reuse
RAM-only prepared data. Actual saves still submit the full note. See
[release validation](docs/release-4.1.12-mosaic-1.0.8.md).

IM 4.2.0 / Mosaic 1.1.0 make titles explicit and optional. All existing message
text, including its first line, is body text. Add/Edit title in the context menu
opens a target preview in either bottom composer; Enter saves and Shift+Enter
adds a title line. In an opened Mosaic card, the same menu action unlocks a
multiline field above the body; Close saves it. Unused titles add no saved data.
Titles use a direct quoted `title:` field with escaped line breaks. Update both
plugins before using titles: older releases reject that new metadata field.
Title-only changes preserve body text/status, IDs, timestamps and capture drafts.
Failed saves remain retryable, and late acknowledgments preserve newer entry.
Mosaic board previews remove their pin/More buttons and unused footer space;
opened cards retain those controls. See [validation and compatibility](docs/release-4.2.0-mosaic-1.1.0.md).

IM 4.2.1 / Mosaic 1.1.1 hide empty composer prompts while focused and restore
them on blur. Mosaic's capture and opened-card writing fields no longer paint
the extra rectangular focus outline; their normal surfaces remain. This is a
CSS-only adjustment with no changes to note content, typing or saving.

Mosaic 1.1.2 shows read-only emoji-tag badges below the body in opened cards.
Clicking a badge has no action; the existing context menu still edits tags.
Cards without tags reserve no tag row. IM remains at 4.2.1.

Mosaic 1.1.3 places emoji tags in separate pills that straddle the bottom edge
of board and opened cards. Tags no longer take an internal row. Wrapped badge
clearance is included in masonry positioning and visible-card lookup; opened
cards reserve viewport clearance and retain read-only badge clicks. IM is unchanged.

IM 4.2.2 / Mosaic 1.1.4 slightly strengthen context-menu action labels. Mosaic
uses **Board view** for the overview and **Card view** for an opened note. Board
tags sit inside the bottom-left corner, with IM-shaped vector tags and hover
feedback; clicking filters without opening the card. Only Card-view badges hang
from the bottom-left edge and stay read-only. Mosaic keeps Sage, Paper and Sand
light palettes regardless of system appearance, and search hides its placeholder
while focused without an extra rectangular outline. IM appearance is unchanged
apart from the requested menu label weight.

IM 4.2.3 validates each touch selection once, using the row under the finger
at the start and end of the tap. It ignores compatibility clicks, cancelled
scroll gestures and touches from a previous note, while retaining keyboard and
mouse selection. Mosaic 1.1.5 limits card/tag hover to mouse-capable devices and
suppresses it during scrolling until the mouse deliberately moves again.
No note format, saving, storage or encryption changes are involved.

IM 4.2.4 and Mosaic 1.1.6 keep identical text widths, wrapping and message/card
positions when entering or leaving selection mode. IM uses the same row spacing
and measured layout in both modes, with a 20px visible circle farther left in a
transparent 44px tap area. Mosaic places compact black selection badges over the
top-left edge and adds a thin black outline without moving text or changing
card padding, colors or height. Selection retains its touch/keyboard behavior.

The two top-right Search/Tags and More buttons now share canonical SVG geometry,
sizes, frost, borders and keyboard-focus styles. Search-only filters retain the
same magnifying-glass size with no tag drawing; their shared green check sits on
the left. Both search buttons focus their search field when opening. The context
menu's **Emoji picker** expands to show all rows without its own scrollbar, and
Mosaic no longer automatically focuses the first emoji when opening the menu.

IM 4.2.7 / Mosaic 1.3.0 replace date filtering with **Jump to date**. The
shared calendar-and-magnifier SVG sits at the right edge of each search field;
the two-slider vector is retained in source as an archived icon. Choose a local
calendar date to reveal its first message in the full note. Text/tag/pins filters
are cleared for the jump; earlier and later messages remain scrollable in each
interface's normal ordering. Dates with no messages jump forward to the next
available message, or backward to the last earlier one when there is no later
message, with a brief notice. Undated messages remain in the note.

Both interfaces reuse one date picker, lookup and vector definition. Navigation
only changes the view: it does not rewrite notes, touch drafts, add storage, or
change encryption. The search fields retain their precise black focus emphasis
without resizing; IM uses its 22% frosted surface with 10px blur, while Mosaic's
field stays solid.


IM 4.2.8 / Mosaic 1.3.1 keep the native date picker and separate date choice
from the explicit **Jump to date** action. Opening the panel dismisses an active
text keyboard without calling focus or showPicker on the date field; selecting
a date keeps the field mounted until confirmation. This avoids competing iOS
keyboard/picker requests and mid-selection dismissal.

Both active editors now ship light-only styling and advertise a light color
scheme. Mosaic note bodies, titles and capture text use solid dark charcoal
across palettes and card colors. Its Iris blue display tint is lighter for dark
text contrast; stored color IDs and the shared note format are unchanged.
IM's 960px column and Mosaic's 1440px board limits are unchanged.


IM 4.2.9 removes touch-down message emphasis and its React state updates, so a
finger beginning a scroll no longer paints a selected-looking row or redraws
visible messages. Long presses remain release-only and are cancelled when the
list scrolls, including after a hold has armed. Final release also verifies
finger movement and list position. Touch tap highlights are suppressed on
message surfaces, while deliberate selection and menu feedback are preserved.
Measured virtual anchoring skips unchanged scrollTop assignments to avoid
interrupting native momentum. Mosaic and the shared note/save format are unchanged.



IM 4.3.2 removes Everyday Objects 2 and Occult Field Journal from the artwork
choices and current plugin package, along with their previews and drawing tools.
Classic · Everyday objects and Engraved garden remain. Existing notes with a
removed artwork value display the original Classic background, without rewriting
note text or drafts when opened. The original artwork is unchanged.

IM 4.3.3 / Mosaic 1.3.2 constrain native date fields to their surrounding panels
and retain their 44px height. Native date selection and explicit navigation are
unchanged. The [UI/UX review](docs/ui-ux-review.md) records the tested layout
bounds, remaining issues, proposed fixes and iPhone verification limitation.

IM 4.3.4 / Mosaic 1.3.3 keep open search panels within the visible viewport,
including when save warnings reduce the available space. Both status-clearing
dialogs now have separate 44px label targets. Mosaic retains distinct text
previews in selection accessibility labels and shows a compact `+N` button
when a card has more than ten tags. It opens Card view without altering tags
or drafts. Card typography and selection layout are unchanged.

Mosaic 1.3.4 sizes opened cards to their text instead of reserving a fixed body
height. Cards grow and shrink while editing, up to the viewport limit; longer
bodies then scroll inside the card with Close still reachable. Width changes
remeasure wrapped text without changing the note format or save behavior.
Desktop and phone viewport regressions cover growth, shrinkage, scrolling,
resizing and saving; native iPhone keyboard behavior still needs device testing.

Mosaic 1.3.5 gives Board cards a shared height budget of five times a basic
one-line card at the current font size and column width. Previews grow with
content and end in an ellipsis at that budget; opening, searching, and exporting
still use the complete text. Dense tag groups use the existing +N overflow
button to keep the text, reply preview and tags within the same height budget.

Mosaic 1.4.0 adds short entrance/reflow animations and Board drag-to-reorder.
Phone users hold still, then drag; stationary holds retain the release-only
context menu and ordinary swipes remain scrolling. The destination appears as
a dashed placeholder, neighboring cards animate around it, and edge scrolling
reaches off-screen cards. Alt+Up/Down and Reset card order provide alternatives.
Only card IDs are saved in Mosaic settings, once per changed drop; IM message
order, text, titles, tags and timestamps stay intact. Cancel, note switches and
incoming content abort previews. Existing failed-save retry and conflict
protections apply, and reduced-motion preferences skip decorative animation.

Mosaic 1.4.1 raises the Board preview budget to 8× and stabilizes drag placement:
150ms steady hover, a midpoint dead band, a 420ms settling interval, and slower
400ms neighbor/280ms landing animation. Release commits the visible placeholder;
settings-only saves preserve message references and measured geometry. Added
mouse/touch boundary, intended-target, noise and exact landing regressions.

Mosaic 1.4.2 aligns truncated Board cards at the shared 8× maximum height,
including titled cards. Short cards keep their natural height; leftover space
from whole-line clamping stays below the preview content.

IM 4.3.5 / Mosaic 1.4.3 use one shared composer typography rule and the note’s
existing IM text scale. The default size is 17.92px in both. Mosaic uses 10px
vertical padding and a 46px minimum field height; existing input corner shapes
remain intact. Mosaic’s font-size menu continues to size cards and opened cards.

Mosaic 1.4.4 applies the standard 8× allowance to the body preview alone.
Titles, reply previews and tag rows add height outside it; adding them does not
reduce body lines. Truncated bodies retain their consistent standard height,
and short bodies stay compact. Titles have an independent preview allowance.

Mosaic 1.4.5 gives opened cards a single edge-aligned content scroller. The
full-width body and trailing timestamps/statuses scroll together; the action
row stays visible. A subtle shadow above it indicates content below and clears
at the bottom. Phone outer margins and internal padding are smaller. Native
text editing, compact short cards and acknowledged-save/retry protections remain.

Mosaic 1.4.6 removes the remaining top and bottom content insets in opened
cards. The pin scrolls with the heading and body; the compact action row sits
against the bottom edge, retaining the overflow shadow and save/retry feedback.

Mosaic 1.4.7 adds a small top inset to opened-card titles, including the title
editing field. This spacing scrolls away with the heading; untitled cards and
the fixed bottom action row keep their compact spacing.

Mosaic 1.4.8 groups opened-card controls at the bottom right in the order
Pin, Palette, More, Close. Pin stays available alongside the other actions;
the scrolling header now uses its full width for the optional title.

Mosaic 1.4.9 adds a small scrolling body inset and increases the title inset
by 20%; the content viewport itself retains zero top padding.

Mosaic 1.4.10 gives opened cards the Board tag silhouette and accent fill,
adds interruptible Open/Close motion, and improves drag hit-testing during
neighbor movement. Adjacent-card hovers now offer a changed slot; placement
still waits for deliberate hovering and saves once on drop.

Mosaic 1.4.11 avoids automatic text-field focus when opening a card on iPhone.
Tapping the body still starts editing; other platforms keep the existing focus.

Mosaic 1.4.12 adds iPhone-only full-page Card view and rectangle-based
expansion/return motion. Initial body measurement precedes animation, and
iPhone viewport listeners are removed when closing or switching notes.

Mosaic 1.4.13 increases opened-card body top padding by 50% (4px to 6px),
inside the scrolling text so no fixed padding band remains while scrolling.

Mosaic 1.4.14 unifies opened-card body and optional-title top padding at 7px,
within the scrolling content.

Mosaic 1.4.15 increases body-only Card-view top spacing to 12px while keeping
title top spacing at 7px; the extra space scrolls away with the text.

Mosaic 1.4.16 removes delayed focus work from card expansion and uses a
transform-only Mac animation with a staged compositor handoff.

Mosaic 1.4.17 addresses the six-long-card opening case with bounded first-paint
text layout, full-text input guards and deferred large-body preparation.

Mosaic 1.4.18 holds the initial card rectangle through a rendering opportunity
before starting playback, preventing a delayed first frame from consuming the
expansion. Remaining long-body preparation runs after the transition.

Mosaic 1.4.19 opens Card view without automatically focusing its text on any
platform. Click or tap the body, or Tab into it, to begin editing.

Mosaic 1.4.20 restores automatic Card-view body focus outside iPhone, with the
caret after the final character, including bodies prepared after expansion.

Mosaic 1.4.21 keeps the Board body preview at 8× on phones and expands it to
11× on computers, including desktop browsers. Titles and tags add height.

Mosaic 1.4.22 keeps Card view open when a text selection starts inside the
card and is released outside. Outside dismissal requires a press outside too.


IM 4.4.0 / Mosaic 1.5.0 add one shared visual Markdown editor: bold,
strikethrough, headings, quotation blocks, bullet/numbered lists and interactive
checklists. Use **Aa** for formatting; the note still stores plain Markdown in
its existing format-3 message bodies. New headings replace new separate-title
entry; existing separate titles remain visible and editable. Viewing never
converts message bodies. See [the editing rules](docs/VISUAL-MARKDOWN.md).

In IM input and Mosaic Board input, ordinary Enter sends. In lists and
checklists it continues the list, in quotes it continues the quotation, and
after headings it starts ordinary text. In opened Mosaic cards ordinary Enter
adds a paragraph. **Command/Control+Enter always creates ordinary text below the
current format and clears bold/strike**; it never sends or closes. Shift+Enter
keeps the current format and inserts a line break. **Send** works from every
format; **Close** saves an opened Mosaic card.

Both plugins bundle their editor dependencies locally with pinned official
source checksums and license notices. No new runtime connection, plaintext
browser storage or encryption layer is introduced. Existing save acknowledgment,
conflict review and failed-draft protections also apply to formatted content.


IM 4.4.1 / Mosaic 1.5.1 remove Aa and the formatting toolbar from IM input and
Mosaic Board input, freeing that space for capture. Formatting controls remain
in opened Mosaic cards. The heading picker highlights the current H1–H6 level;
clicking that active level again returns the selected text to ordinary paragraphs
without adding a line or removing text. Moving the caret updates the highlight.
