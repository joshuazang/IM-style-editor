# Editor interaction audit

Scope: IM 4.4.14 and Mosaic 1.5.19. Fixtures contain synthetic notes only.

## Reproduced and fixed

- On phones, the opened Card formatting panel could cover the insertion caret.
  The Card now accounts for the panel's actual bounds and provides additional
  scrollable overflow without increasing the card's intrinsic height.
- On Android, a visual viewport reduced by the keyboard could leave the Card
  centered in the covered layout viewport. Card positioning now uses the visible
  viewport, including its vertical offset.

`tests/mosaic-keyboard-caret.py` exercises both phone types at 320, 390 and
430 CSS pixels, real touch placement in a long note, stepped keyboard resize and
pan, continued typing/Enter, floating-panel visibility with unchanged card size,
focus retention, saving and reopening. The panel and Android cases failed before
the fixes. iPhone continues to open without autofocus; Android retains its
existing autofocus behavior.

## Regression coverage

`python3 tools/check-editors.py` runs the coordinated suites for both editors:

- Selection and formatting boundaries, toggle state, headings, checklist rows,
  copy/paste, undo and live formatting.
- Enter event sequences, Chinese composition, cursor placement, phone keyboard
  dismissal and caret visibility, resizing and scrolling.
- Card opening/closing, Escape, outside-click press origin, long Markdown notes,
  six long cards, reduced motion, dragging and insertion behavior.
- Capture and edit drafts, note switches, replies, pinned cards, tag layout,
  failure/retry, delayed acknowledgments and conflicting incoming edits.
- Shared core, separate plugin identities, packaged release consistency and
  retained historical installation paths.

The morph regression checks the current natural contenteditable height, stable
opening geometry and absence of inline height rewriting; it no longer requires
the removed textarea measurement implementation.

Performance suites run without other browser suites in parallel, to avoid
confusing test workload with editor latency.

## Limits

Chromium automation exercises real browser input and touch events. Mobile OS
keyboards and visual viewport changes are simulated; the suite does not replace
physical iPhone/Android or Standard Notes native WebView testing. Passing tests
are bounded evidence, not a guarantee that every UI defect has been eliminated.

## Results

All 39 data suites and all 44 coordinated browser suites passed after the
corrected regressions were rerun. The keyboard matrix now covers Android as
well as iPhone. An old morph assertion required removed textarea height styles;
the performance test also needed to mount virtualized cards before clicking.
Both tests now check the current behavior.

The stress fixture contains six long Markdown cards with 70 sections per card
and runs with 4x CPU throttling. It recorded about 133 ms frame intervals at the
95th percentile and 349–378 ms longest tasks. Typing used 15 layout passes and no
inline body-height rewrites. Functional checks pass, but these frame stalls remain
a performance limitation; this release does not claim to eliminate them.

## IM momentum follow-up (4.4.15)

Reverse touch flings through unmeasured older rows triggered repeated measured
anchor scrollTop assignments, including during post-release inertia. IM now
collects row measurements during native touch scrolling and applies their offset
correction after 180 ms without scrolling, using the reading position at that
time. Keyboard resizing and non-touch navigation retain immediate measurements.
The idle timer and touch listeners are removed on unmount.

`tests/im-momentum.py` uses actual Chromium touch flings at 320 and 390 pixels,
asserts continued movement after release and zero programmatic scroll writes
while the fling is active, and checks bounded correction and unchanged notes.
Native iOS WebView physics still require physical-device verification.

## Desktop newline follow-up (IM 4.4.18 / Mosaic 1.5.23)

Enter and Shift+Enter synchronously serialize the updated visual document. The
previous writer repeatedly inspected its growing output prefix when closing
blocks, making long notes disproportionately expensive. Serialization now joins
block-sized output chunks while retaining list/quote writer state. Paragraph-only
documents also reuse escaped output for unchanged immutable paragraphs, with
separate last-block handling for soft breaks. Values and change notifications
remain synchronous; saving does not depend on a delayed task.

The new exact-output data regression compares against the original contextual
serializer across mixed blocks, marks, whitespace, Unicode, reused nodes and
edits. The desktop browser regression edits inside notes up to about 800 KB,
with 4x CPU throttling, then verifies exact saved drafts. Enter and Shift+Enter
transactions in the large paragraph fixture measured approximately 9–16 ms;
the structured fixture measured 5–8 ms. These are controlled Chromium results,
not measurements from the user's physical Mac/Standard Notes installation.

## Phone native text selection (Mosaic 1.5.25)

Card long-press/context-menu handlers now leave editable fields to the native
text selection menu. Swipe-to-dismiss checks both the DOM selection and the
editor selection before blurring; long-held caret drags are also exempt.
Selection-owned gestures and DOM-first selection updates suppress caret scrolling
while the keyboard/viewport changes. Ordinary swipes still dismiss the keyboard.

The regression models long presses, native DOM selection before editor-state
synchronization, handle gestures targeting the scroller, viewport resizing and
held caret drags. Keyboard dismissal, exact draft saving, Board touch menus and
selection-first Escape also passed. The test browser cannot reproduce the actual
iOS blue-handle UI; physical-device verification remains outstanding.
