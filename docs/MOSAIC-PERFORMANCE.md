# Mosaic Markdown performance

Mosaic 1.5.11 removes textarea resizing from the visual Card body and Board
capture input. CSS supplies their natural height and existing height caps;
ResizeObserver updates scroll shadows. Editing the body no longer resizes an
unchanged title. The redundant width observer and body resize listener are gone.

The shared visual editor creates checkbox controls only for actual task items.
Ordinary bullet/numbered items retain their normal markers and do not allocate
hidden controls or their event listeners. Converting between lists and tasks
still creates/removes the interactive controls as needed.

## Reproduction and measurements

Run `python3 tests/mosaic-markdown-performance.py`. The test opens six synthetic
notes containing headings, bold/strike, Chinese text, quotes, numbered lists,
and checklists. It opens/closes three cards, then edits and saves another one,
verifying the whole source and all 140 task controls remain available. It tests
1100px and 390px touch viewports with Chromium's **iframe renderer** throttled
4x. These are Linux browser measurements, not physical Mac/iPhone measurements.

The published baseline is commit `af67e39990665b48e4cb0d51fd0ad52d0de5df5a`.
The same test was run sequentially against that snapshot and the new build.

| Short typing burst | Before | After |
| --- | ---: | ---: |
| Renderer layouts, 1100px | 71 | 15 |
| Renderer layouts, 390px | 71 | 15 |
| Card-body height writes across the scenario | 72 | 0 |

Raw opening/frame/long-task timings are in
[before](performance/mosaic-1.5.10-before.json) and
[after](performance/mosaic-1.5.11-after.json). The measured typing layouts fell
79%; timing samples are small and variable. Long Markdown documents still have
measurable editor-mount costs. These results do not establish that every opening
or every device sustains 60fps.

The regression has a layout-count budget for typing, verifies no opening saves,
and checks that editing retains full note content. Offscreen `content-visibility`
on editable blocks was rejected because it could disturb caret placement and
initial sizing. It is not part of this release.
