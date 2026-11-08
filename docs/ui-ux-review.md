# UI/UX review: IM 4.3.3 and Mosaic 1.3.2

This review uses synthetic notes in the opaque Standard Notes test host. It
checks both interfaces at 280–390 CSS pixels wide, a desktop width, and a short
390 × 430 viewport. The browser is Chromium with touch emulation. A short
viewport is a layout stress test, not a reproduction of the iOS keyboard.
Physical iPhone/Safari testing has not been performed in this environment.

## Fixed in this release: native date-field sizing

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

## Confirmed follow-up issues

These findings are not silently changed by this date-field patch.

| Priority | Finding and evidence | Proposed correction |
| --- | --- | --- |
| High | Mosaic's search popup can extend below a short viewport when a persistent failed-save banner moves the toolbar down. At 390 × 430, the popup ended at y=504. Even after scrolling the popup to its maximum, the Pinned cards control occupied y=449–491, below the visible screen. | Size the popup against its actual top and the visible viewport's bottom. Recompute on warning, viewport and keyboard-related size changes. Keep its own vertical scrolling so every control remains reachable. Check IM's popup placement with the same bounds. |
| Medium | The Clear message statuses labels are only 20 pixels tall in IM and 25 in Mosaic. They are much smaller than the 44-pixel rows already used for many other controls. | Make the entire label row at least 44 pixels tall, keeping the checkbox visually small and adjacent rows separate. Verify tapping the label and the checkbox activates only that option. |
| Medium | Mosaic gives body-only cards the same accessible name in selection mode: `Select: Untitled card` or `Selected: Untitled card`. Their normal labels contain distinct body previews. | Reuse the body-preview fallback in selection mode, retaining a clear selected/unselected announcement. Test multiple untitled cards with keyboard and screen-reader navigation. |
| Low | Mosaic's Board view silently shows at most ten tags. A synthetic card with twelve stored tags displayed ten on the board and all twelve in Card view. The tags are preserved; the board does not indicate the omission. | Consider a compact `+2` overflow badge that opens Card view. Keep the compact card layout and update height estimation with the rendering change. This is a design choice to agree on before implementation. |

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
