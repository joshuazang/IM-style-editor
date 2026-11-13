# Visual Markdown implementation contract

Status: implemented for IM 4.4.14 / Mosaic 1.5.18.

## Agreed behavior

- Both IM and Mosaic support bold, quotation blocks, bullet lists, numbered
  lists, headings, interactive checklists, and strikethrough.
- Editing is visual. The formatting toolbar is available in opened Mosaic
  cards through the underlined-A formatting button. Automatic selection popups are enabled in desktop editable
  fields and disabled on phones, including IM capture/edit and Mosaic capture/
  opened cards. The manual Card formatting toolbar remains available on phones.
  Capture inputs have no formatting button or reserved formatting-control
  space. Read-only sent bubbles and Board cards never open this toolbar.
- Card view offers direct H1, H2, and Normal (Aa) style buttons. Clicking that active level
  again changes the selected heading to an ordinary paragraph in place; it
  preserves text and the caret rather than adding a new paragraph.
- Heading applies to the whole current logical line (bounded by actual line
  breaks), even when only one character is selected. A multiline selection
  affects only its selected lines; ending at the next line's start excludes
  that next line. Wrapped screen lines do not create new formatting boundaries.
  Surrounding lines, blank lines and inline marks remain intact. Heading soft
  breaks serialize explicitly so saved headings retain their line boundaries.
- With a nonempty highlight, quotation blocks, bullet lists, numbered lists,
  and checklists split at the exact text endpoints. Unselected paragraph
  prefixes/suffixes retain their formatting. Without a highlight, these commands
  operate on the current block. Each toggle is one undo step. If a deeply nested
  boundary cannot be split safely, the command leaves it unchanged instead of
  extending formatting into unselected text.
- Converting highlighted lines to bullets, numbers or tasks gives markers only
  to nonblank lines. Blank lines retain their spacing inside the preceding item;
  leading blank lines remain outside the list. A caret/Enter can still create a
  new empty item for typing.
- Escape in Mosaic Card View first collapses highlighted text, retaining the
  caret and open card. With no selection, Escape returns to Board through the
  ordinary save and acknowledgment path, including with a formatting popup open
  or focused.
  An IM formatting popup still dismisses locally on Escape.
- The toolbar order is Bold, Quote, Strikethrough, Bullets, Numbers, Checklist,
  then a gray divider followed by H1, H2, Normal (Aa), and Clear Formatting. The
  main formatting button uses an underlined A icon. Clear Formatting removes
  marks and block formatting from selected text without deleting its contents
  or changing unselected text. Normal changes paragraph/heading style and keeps
  inline marks. Empty selections disable Clear Formatting.
- Ordinary paragraphs remain the default. A first line becomes a heading only
  through heading formatting or Markdown heading syntax.
- Message bodies and capture drafts use one Markdown interpretation. The user
  explicitly waived a separate legacy-literal-text interpretation: existing
  `# Heading` or `**bold**` syntax may display as formatting.
- There is no per-message format flag and no bulk conversion or rewrite on
  opening a note. Stored text changes only following a user edit.
- The existing format-3 envelope, message IDs, note metadata, save acknowledgments,
  failed-save retention, and incoming-conflict protections remain in use.
- New title-like content uses a heading in the body. Existing separate titles
  remain readable and preserved, including multiline titles. Their parser
  compatibility is independent of literal-body compatibility.
- Modest additional CPU/RAM is acceptable. Noticeable additional lag in typing,
  scrolling, selection, or transitions blocks release.
- Enter is handled once per keyboard action, including iOS beforeinput and its
  delayed fallback. Modifier keys, rapid repeated presses and IME confirmation
  retain their existing behavior.
- On phones, a swipe inside an opened card or a tap outside its editable fields
  dismisses the keyboard without closing the card or discarding its draft.
  Formatting controls retain editing focus. Caret-driven scrolling does not
  dismiss the keyboard. Keyboard resize/pan and caret changes reveal the focused
  body caret inside the Card scroller, with space above the keyboard and toolbar.

## Shared implementation boundary

Use one editor implementation and one Markdown codec in both plugins. Prefer
ProseMirror's model, state, view, commands, history, keyboard handling, and list
commands, with a custom schema containing only the agreed features. Parsing and
serialization must share that schema. A build tool should produce a locally
bundled browser asset with pinned source checksums and third-party license notices.

The package registry is a development dependency destination. The installed
plugins must not fetch editor code, fonts, images, or services at runtime.

The editable schema needs paragraphs, hard breaks, headings, blockquotes,
bullet/ordered lists, list items with optional checked state, and bold/strike
marks. Unsupported formatting must paste as readable text rather than introduce
unselected schema features. Raw HTML is not an executable rendering path.

Read-only IM bubbles, reply previews, and Board cards use lightweight rendered
content, not a separate editor instance per message. Cache unchanged rendering;
retain current message windowing. Only active editing fields need editor views,
with explicit lifecycle cleanup and selection preservation.

Existing separate titles stay outside the Board body allowance. Headings inside
the Markdown body are body content. Pinned previews use 6x on phones and 8x on computers. Unpinned previews use
8x on phones and 14x on computers. Tags/replies retain their additive height.

## Integration points inspected

- `shared/core/note-format.js`: bodies and drafts already store text. No new
  envelope version or per-message format metadata is required.
- `next/src/editor-runtime.js`: replace the capture/edit textarea component,
  render formatted message bodies, and integrate plain-text search and previews.
  Preserve session-based edit/draft retention and late-acknowledgment behavior.
- `next/src/private-fields.js`: maintain private-input attributes on editable
  content. Search, import/export, and legacy title fields remain ordinary fields.
- `mosaic/src/app.js`: integrate capture and opened-body editing; retain iPhone
  no-keyboard opening, Mac end-caret behavior, and gesture-aware dismissal.
- `mosaic/src/model.js`: preserve bounded previews and measured masonry layout
  for formatted blocks. Do not estimate a different body allowance for titles.
- `shared/ui`: share formatting controls, typography, and rendering rules across
  the React and DOM interfaces. Preserve the current rounded/box-shaped shells.

## Agreed editing and capture interaction

- In IM input and Mosaic Board input, Enter in an ordinary paragraph sends the
  capture. The Send action sends from any supported format.
- In opened Mosaic cards, Enter in ordinary text creates another paragraph.
  Close saves edits through the existing acknowledgment flow.
- In both contexts, Enter in a bullet list, numbered list, or checklist continues
  the list. A new checklist item starts unchecked; Enter on an empty item exits
  the list and creates ordinary text.
- Enter in a quotation creates another quoted paragraph. Enter in an empty
  quotation paragraph exits the quotation and creates ordinary text.
- Enter in a heading creates ordinary text below it, without heading appearance.
- Command+Enter or Control+Enter, in every input and opened Card view, exits the
  current quotation/list/checklist/heading and creates a new ordinary paragraph
  below. It also clears active bold and strikethrough. It never sends, saves, or
  closes the card. In ordinary text it creates a new ordinary paragraph.
- Shift+Enter inserts a line break within the current paragraph or list item,
  preserving its format. It never sends.
- Bold and strikethrough are inline styles and do not change ordinary Enter's
  structural behavior. Explicitly enabled marks remain active until disabled,
  except that Command/Control+Enter clears them.
- After a successful send clears the submitted capture, the next capture starts
  as ordinary, unformatted text. Newer typing entered while acknowledgment was
  pending must retain its own content and formatting.
- Composition events never submit an unfinished IME composition.

## Required verification before release

- All seven features round-trip between IM and Mosaic, including nested lists,
  checked state, escaped punctuation, multiline content, Unicode, and literal
  format-3 control lines. Viewing alone performs no write.
- Selection, undo/redo, formatting shortcuts, paste, and composition work in
  capture and edit modes. Formatting controls preserve the selection on touch.
- Failed capture/edit/checklist saves and conflicting incoming content retain
  recoverable state. Switching notes and late acknowledgments preserve newer
  text, formatting, and unrelated Standard Notes fields.
- Board truncation, additive metadata height, selection layout, drag placement,
  focus, and outside-release text selection retain their current guarantees.
- Compare current and candidate builds using six long cards, very long opened
  bodies, and the 5,000-message fixture. Measure startup, typing, scroll, paint,
  and transition behavior; JavaScript frame intervals alone are insufficient.
- Report bundle/memory costs separately from responsiveness. Do not claim
  physical-Mac/iPhone results from Linux Chromium emulation.

## Rebuilding locally bundled dependencies

Normal packaging does not download dependencies. `shared/vendor/markdown-editor.js`
is checked in, checksum verified by the data suite, and included identically in
both plugins. Both install ZIPs include the upstream licenses.

The official upstream sources, versions, commits and individual SHA-256 hashes
are pinned in `shared/vendor/markdown-sources.json`. To rebuild:

```sh
python3 tools/fetch-markdown-sources.py /tmp/markdown-sources
node tools/build-markdown-vendor.cjs /tmp/markdown-sources
```

The source fetch uses GitHub's API and verifies both Git blob identity and pinned
SHA-256. The optional compiler uses Playwright 1.62.1's Babel TypeScript/CommonJS
transform; supply its `babelBundle.js` path as the second argument if it is not in
Node's normal module path. The serializer is the ProseMirror Markdown serializer;
the parser bundle contains Marked's lexer, without its HTML rendering path.

No registry or remote CDN access is needed by the installed plugins. There is no
new note encryption, storage location, telemetry or network permission.

## Measured cost and retained safety

The locally bundled editor adds about 180 KiB compressed to each plugin's
JavaScript download. It adds no format flags or metadata bytes to unformatted
messages. The seven-feature schema is shared byte-for-byte by both interfaces;
Board cards and timeline bubbles do not instantiate editor views.

Formatted failed Sends are covered across note switches. IM's retained capture
is kept separate from the already-submitted message, avoiding a duplicate draft
on retry. Newer typing is retained even when it matches the submitted text.
Local Chromium tests cover these cases as well as unformatted regressions.
Physical Mac/iPhone responsiveness is not established by Chromium emulation.

See [validation results](VISUAL-MARKDOWN-VALIDATION.md) for the measured download
cost, painted-frame comparison and platform limits.

Formatting buttons apply on the first click and remove their format on the
second, for a caret or selected text. Checklist off removes the list rather than
converting it to bullets. Quote off preserves contained lists. Selection-wide
active indicators use the same classification as the corresponding commands.

Applying list formatting to selected plain-text lines creates one item per
logical line. Shift+Enter within an existing item remains a continuation line.
Empty `[ ]`/`[x]` items retain their task state through serialization. Checkbox
targets stay separate from text and the first text line aligns with the box.

Native Markdown shortcuts apply at the start of paragraphs and logical lines
after soft breaks. A completed marker plus Space formats immediately while
retaining preceding text. IM sizes visual inputs without an intermediate auto
height, which prevents scroll clamping during Chinese composition confirmation.

Aa and selection formatting use the same toolbar DOM and commands. Selection
popups retain native ranges, fit the visible viewport, stay out of document
layout and are removed on context changes. Alt+F10 focuses a visible toolbar;
Left/Right navigate controls and Escape returns to the input. The paragraph
continuation action remains in Aa for cursor use, not in the selection popup.
Quotes display an accent bar, soft tint, rounded inset and decorative quote mark;
formatting syntax and stored text are unchanged.

Board preview caps: pinned phone cards use 6× and pinned computer cards 8×;
unpinned phone cards use 8× and unpinned computer cards 14×. Titles, tags and
replies add height beyond the body preview allowance.
