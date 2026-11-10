# IM 4.4.0 / Mosaic 1.5.0 validation

Synthetic notes only; Linux Chromium, not a physical Mac or iPhone.

- All 36 data suites and all 35 coordinated browser suites passed. Follow-up
  checks cover whole-line Board clipping and stale checklist controls after a
  note switch. Packaging verifies identical shared UI/core sources and ZIP assets.
- All seven formats render and round-trip between both plugins. Tests cover
  ordinary/structural Enter, Command/Control+Enter, Shift+Enter, IME confirmation,
  undo, visual controls retaining selection, interactive checklists and legacy
  separate titles.
- Formatted failed Sends survive note switches and retry as one message. Newer
  typing, including re-entered identical formatted text, survives a delayed
  acknowledgment. Conflicting host content retains both versions for review.
- The existing 5,000-message save tests still perform no full-note parsing,
  message-section joining or unchanged-message encoding during subsequent typing.
  Board previews remain windowed and their formatted DOM is bounded.
- Six long-card tests cover staged opening, early typing, end-caret placement,
  reduced motion, iPhone no-keyboard opening, cancellation and full-text saves.
  All 288 title/tag/reply preview-budget cases pass.

## Download cost

The shared local editor adds approximately 180 KiB compressed to each JavaScript
bundle. Ordinary messages gain no per-message format flags or metadata. Only
active input fields instantiate editor views; read-only cards/bubbles use DOM.
This measures download size, not physical-device memory consumption.

## Painted-frame comparison

Two alternating runs per version, six cards of 600 lines, 1100 × 900 viewport.
Chrome DevTools screencast captured actual compositor frames during opening;
these numbers are not inferred solely from JavaScript animation callbacks.

| Build | Open-handler work | Unique painted frames | Median paint interval | Largest paint gap |
| --- | --- | --- | --- | --- |
| Previous 1.4.22, run 1 | 17.4 ms | 20 | 16.7 ms | 25.2 ms |
| Candidate 1.5.0, run 1 | 24.0 ms | 19 | 16.8 ms | 19.2 ms |
| Previous 1.4.22, run 2 | 17.0 ms | 19 | 16.8 ms | 26.8 ms |
| Candidate 1.5.0, run 2 | 25.2 ms | 19 | 16.3 ms | 20.7 ms |

The extra synchronous editor setup did not worsen painted-frame delivery in
this fixture. This is a small local sample, not proof of Standard Notes desktop
or Safari behavior, nor a claim that the earlier Mac animation hitch is fixed.
