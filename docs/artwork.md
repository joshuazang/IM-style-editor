# Occult field journal

Choose **More options → Appearance → Artwork → Occult field journal**, with Background artwork enabled. The artwork choice is saved in the current note's existing settings. Classic and Engraved garden remain available; the default and other notes' choices are unchanged.

The composition combines UFO sightings, lost observatories, overgrown ruins, expedition equipment, natural-history specimens, enchanted forests, nocturnal scholarship and maritime cosmic horror. Local revisions replace the footprint with a crescent compass, repair the nautilus specimen bottle, replace the skull inkwell with a Cthulhu statuette, and replace the bottom-left specimen jar with a barnacled sea bell.

The current illustration is drawn directly as smooth stroked SVG paths, ellipses and curves in [draw-field-journal.mjs](../tools/draw-field-journal.mjs). It does not use raster tracing. Rounded joins and caps keep outlines smooth. Seventy-seven distinct illustrations form 96 varied, upright placements; 503 smaller botanical, nautical and celestial details fill their interstices.

The taller composition adds different illustrations before repeating. Its edges join through matching continuations translated across the tile boundaries, without reflecting or inverting any element. The 1,254 × 1,881 drawing displays at 660 × 990 CSS pixels. The previous drawing's individual panels displayed at 600 pixels wide, so the drawing scale is 10% larger.

`next/assets/occult-field-journal-v2.svg` contains no embedded bitmap, script, font, external reference or animation. Negative space is transparent, with a uniform soft ink tint and no screen-edge gradient. The editor loads it from its own asset directory only when this artwork is selected. It adds no note processing, timer, browser storage or independent network service. Archive's artwork and runtime are unchanged.

To regenerate the static SVG, run `node tools/draw-field-journal.mjs`. The drawing script is a creation tool, not an editor dependency.
