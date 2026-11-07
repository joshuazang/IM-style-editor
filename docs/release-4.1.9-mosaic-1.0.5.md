# IM 4.1.9 and Mosaic 1.0.5

Mosaic's Search/tags and More buttons now float above the board with IM's
frosted surfaces. The rest of their row is transparent and permits interaction
with cards below it. The bottom composer also floats above the scrolling board:
its surrounding strip is transparent, while the typing box retains its solid
surface. Measured clearance keeps the first and last cards reachable without
hiding them beneath the overlays; notices and growing drafts update that space.

A touch hold arms Mosaic's context menu; finger release opens it. Movement,
scrolling and cancellation dismiss the gesture. Opening release clicks cannot
activate menu actions or submit an existing capture draft. Native text editing
inside inputs retains its platform behavior. Both interfaces use the same menu
placement helper to fit the menu within the viewport and away from the finger.

Mosaic selection mode uses IM's five top circular actions and bottom Select all,
selected-count and Cancel fields. Their vectors, dimensions and frost share
source files. Batch tags use the existing reactions and saving path. IM keeps
its existing selection handlers and gains Mosaic's SVGs beside Merge selected
and Clear message statuses.

The regression suite uses synthetic notes and actual Chromium touch events at
320 and 390 pixels, plus a 1100-pixel desktop viewport. It checks release timing,
movement/cancellation, accidental-click protection, viewport and draft stability,
transparent overlays, opaque typing box, last-card clearance, shared selection
vectors/dimensions and selected-only tags. The coordinated suites also cover
saving failures, late acknowledgments, note switches, clipboard races, shared
format interchange and large notes. This is browser testing, not a physical
iPhone or Standard Notes device test.

The shared persistence/parser core, format 3, storage model and network policy
are unchanged. No new persistent data, telemetry or network destination is
introduced. Only the canonical IM-style-editor repository is released; the
retired standalone Mosaic repository remains frozen.
