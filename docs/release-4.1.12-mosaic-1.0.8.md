# IM 4.1.12 and Mosaic 1.0.8

Small IM messages now have separate selection rows at least 44px high, with
centered 44px checkbox targets. Individual selection toggles keep the same row
geometry. Touch selection is bound to the starting message: motion beyond 10px,
scroll movement, pointer cancellation or release over another row cancels it.
Compatibility clicks cannot toggle a neighboring message after touch release.
Mouse and keyboard activation remain supported. Normal timeline spacing is kept.

Shared accessibility styles add visible focus outlines, 44px quick-tag and
filter targets, larger tag-arrangement and dialog controls, and better selection
contrast. Compact top-control shapes stay the same; coarse pointers receive
larger target areas where they fit. Existing frosted surfaces, filter-pill
geometry and transparent surrounding strips are retained.

Mosaic Cmd/Ctrl+F opens whole-note search and selects the query when the board is
active. It leaves an opened card/dialog and selection-mode keyboard behavior alone.
More → Arrange tags uses the same pure add, replace/merge, delete and reorder
commands as IM. A replacement with an existing category merges it; confirmed
deletion removes the emoji from all affected messages without deleting text or
messages. Untagged is movable and defaults to last. Failed changes stay in the
existing retained session with Retry. Context menus do not regain Add label.

Both composers use the same visual save-feedback controller. Actual draft saves
still start immediately through the unchanged acknowledged queue. Only a pending
label waits 300ms; a fast save remains quiet, and a slow successful acknowledgment
briefly shows Saved. Failed saves keep their persistent Retry warning; conflicts
keep Review. Switching notes cancels obsolete visual timers. Saved describes host
acceptance, not confirmed server sync. No periodic idle saves are introduced.

Mosaic prepares lowercase search text, title/body splits and per-card tag sets
once per immutable record. A per-message-array index caches IDs and tag totals;
unchanged text can be reused after status-only edits. Only the latest query result
is cached. All caches stay in RAM. Masonry layout indexes sorted items per column
and by ID. Binary range lookup finds visible previews; anchor and navigation
lookups no longer scan every card. Measurement updates visit mounted nodes only.
Rebuilding geometry after message, size or measured-height changes still visits
the matching records; ordinary range queries reuse that prepared layout.
At the bottom, changed preview measurements keep the final card above the input;
older reading positions keep their message anchor. Actual saves still send the
complete note because the Standard Notes plugin API has no text-delta operation.

Validation covers 30 data suites and ten coordinated Chromium browser suites,
including the prior security/recovery regressions. New cases compare 10,000-card
range queries against full scans (103 column-item reads for a sample viewport),
check search/count invalidation, and verify that status changes do not prepare
unchanged body text again. Both editors run immediate/fast/slow/failed save and
note-switch checks at 320, 390 and 1100px. Synthetic touch cases exercise exact
rapid selection, nonoverlapping targets, stable geometry, keyboard activation,
scrolling and cancellation. Tag tests cover merge/deletion confirmations,
Untagged ordering, failure recovery and editor interchange. Palette checks cover
light/dark menus, dialogs, filters, selection contrast and visible keyboard focus.

These browser simulations do not exercise physical iPhone hardware or the
installed Standard Notes binaries. No real account notes were used.
The preceding encryption, clipboard and RAM recovery boundaries still apply:
format 3 and plugin IDs stay unchanged; no durable recovery store, encryption key
or independent service is added. The official Standard Notes client remains
responsible for encryption and sync. Archive and retired standalone Mosaic are
unchanged. Both stable install URLs continue to work.
