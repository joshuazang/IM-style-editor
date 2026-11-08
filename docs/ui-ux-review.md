# UI/UX review: IM 4.3.4 and Mosaic 1.3.3

This review uses synthetic notes in the opaque Standard Notes test host. It
checks both interfaces at 280–390 CSS pixels wide, a desktop width, and a short
390 × 430 viewport. The browser is Chromium with touch emulation. A short
viewport is a layout stress test, not a reproduction of the iOS keyboard.
Physical iPhone/Safari testing has not been performed in this environment.

## Previously fixed in IM 4.3.3 / Mosaic 1.3.2: native date-field sizing

The shared date field now uses a shrinkable grid track, explicit border-box
sizing, and an inline-size limit on the panel, label and input. WebKit's native
value has an explicit minimum inline size of zero. This prevents intrinsic
date-control sizing from expanding the surrounding layout. It also isolates
the field from IM's generic toolbar-input flex rule, which reduced its intended
44-pixel height to 38 pixels in Chromium before this change.

The native picker and existing confirmation behavior remain. Opening the date
panel still avoids programmatic date focus and `showPicker()`; date selection
does not dismiss it. Jump/Enter navigates the full note. No save, parser,
storage, draft or encryption behavior changes.

`tests/date-navigation-browser.py` now checks containment at 280, 320, 390 and
1100 pixels, using empty, filled, focused and four-digit-year dates. It checks
the input fits its label, panel and search popup without horizontal overflow,
stays at least 44 pixels tall, and keeps 16-pixel text. The existing navigation,
native-picker lifecycle, note isolation and zero-note-writes checks remain.
These passing Chromium checks do not establish a physical iPhone result.

## Follow-up issues fixed in IM 4.3.4 / Mosaic 1.3.3

The original measurements below are retained to explain the problems. The
follow-up release implements all four corrections without changing note format,
draft saving, encryption, card typography or selection geometry.

| Priority | Finding and evidence | Implemented correction |
| --- | --- | --- |
| High | Mosaic's search popup could extend below a short viewport when a persistent failed-save banner moved the toolbar down. At 390 × 430, the popup ended at y=504. Even after scrolling the popup to its maximum, the Pinned cards control occupied y=449–491, below the visible screen. | Both editors share one open-panel geometry controller. It bounds the panel against its actual top and the visible viewport, updating on warning/layout changes, window resizing and VisualViewport resize/scroll events. The panel scrolls internally. In the original Mosaic reproduction it now ends at y=422 and the Pinned cards control is reachable at y=367–409. |
| Medium | The Clear message statuses labels were only 20 pixels tall in IM and 25 in Mosaic. | Both use separate label rows at least 44 pixels tall, with a compact 4-pixel gap and the original small checkbox. Clicking the empty right side of a row toggles only that row. |
| Medium | Mosaic gave body-only cards the same accessible name in selection mode: `Select: Untitled card` or `Selected: Untitled card`. Their normal labels contained distinct body previews. | Normal and selection labels now use the same optional-title/body-preview fallback. Selecting a card retains its distinguishing text and adds the selected-state announcement. Visible card content is unchanged. |
| Low | Mosaic's Board view silently showed at most ten tags. A synthetic card with twelve stored tags displayed ten on the board and all twelve in Card view. | A compact `+N` button follows the first ten tags and opens Card view to show them all. In selection mode it selects/deselects the card like its other tags. Height estimation includes the overflow button, while actual measured card heights remain authoritative. |

`tests/ui-layout-regressions.py` verifies these corrections with synthetic
notes at 320 × 568, 390 × 430 and 1100 × 900, including Extra large Mosaic
text. It checks row tapping, keyboard selection, unchanged visible text and
selection geometry, tag overflow, no overlapping cards, failed-save banners,
short windows, simulated VisualViewport resize/scroll, and preservation of the
mounted native date field. Repeated open/close cycles verify viewport listeners
are removed. All test interactions preserve the stored note and make no external
requests. Simulated viewport events do not validate the native iOS keyboard or
actual VoiceOver announcements.

The geometry controller observes only open search panels, batches asynchronous
updates into animation frames, and disconnects when closed. It has no idle
timer, persistence, telemetry or note-content scanning. Screen-reader support
continues to use HTML semantics and short labels; no screen-reader engine is
bundled. Accessibility overhead has not been benchmarked, so no percentage
performance claim is made.

## Review process improvements

Functional success is insufficient evidence that a control fits. The prior date
test exercised navigation and native-picker focus behavior but did not assert
the input's bounds. This release closes that specific gap.

For future UI changes, review the affected surfaces at narrow portrait and short
landscape sizes, with enlarged text, long content, no tags, multiple tags,
selection, empty searches, and pending/failed-save banners. Measure bounds and
tap targets and inspect screenshots, rather than treating `is_visible()` as
proof that an element is inside the visible viewport. Native picker, software
keyboard, momentum scrolling and touch callout changes also need Safari/iOS
verification; Chromium touch emulation alone cannot validate those behaviors.

The next useful convenience improvement is consistent focus restoration when
closing menus and dialogs: keyboard users should return to the invoking card
or control, and phones should avoid unexpectedly reopening a text keyboard.
That is a proposed review item, not a confirmed failure from this session.
