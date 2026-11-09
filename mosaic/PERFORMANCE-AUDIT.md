# Mosaic Card-view efficiency audit — 1.4.12

Scope: Board ↔ Card transitions, iPhone full-page layout, opening work and save handoff.

## Findings and changes

- The previous transition started before the textarea's initial content height was measured. A ResizeObserver could then change the destination during the animation. The body is now measured before motion starts; the observer's initial width is already recorded, avoiding the redundant first measurement.
- The previous motion used a small translated scale and opacity fade. It did not geometrically match the Board card. The new transform maps the visible source rectangle to the measured destination and back in 320 ms, without fading the card out. The source card is hidden during the transition and restored at handoff, avoiding duplicate cards.
- The animation holds its endpoint until handoff. The completed opening effect is then cancelled so it does not retain an animation effect while reading. Forced closes and note switches cancel motion and restore the source.
- Popup actions settle running card motion before positioning menus; transforms must not change the coordinate system underneath a popup.
- iPhone uses the full visible viewport. Resize/scroll listeners track the visual viewport and are removed when the card closes. Safe-area insets protect the toolbar; tags stay inside the page. The full-page iPhone backdrop skips background blur; other device layouts remain floating cards.
- Opening and unchanged closing do not parse or save the whole note. Changed closes still wait for Standard Notes acknowledgment; failures remain editable with Retry. Removing that wait would weaken the existing save guarantee.

## Measurements

Synthetic 5,000-message fixture, headless Linux Chromium, device user-agent/viewport profiles. These measure synchronous editor-opening work, excluding the intentional animation duration, later painting and host save latency. They are not physical-iPhone timings or a controlled before/after benchmark.

| Profile | First open | Subsequent five opens | Board cards mounted | Full-note parses / saves on unchanged open-close |
| --- | ---: | --- | ---: | --- |
| iPhone | 36.0 ms | 3.1–5.8 ms | 11 | 0 / 0 |
| Android | 35.0 ms | 2.5–3.5 ms | 11 | 0 / 0 |
| Mac | 28.8 ms | 3.0–4.2 ms | 21 | 0 / 0 |

The existing 5,000-card touch drag check recorded 16.7 ms median and 95th-percentile frame intervals in this run. This is separate from Card-view opening work.

## Verification and remaining limits

Automated checks compare the opening and closing endpoints with the actual Board rectangle; confirm initial body height remains stable; verify iPhone-only full-page dimensions and viewport resizing; preserve tap-to-edit, capture drafts and explicit title entry; and exercise reduced motion, failed-save retry and note-switch interruption.

The code is not proven globally optimal. The first open still incurs browser style/layout work. Very long textarea measurement scales with that card's text length. Changed saves still serialize the shared note and depend on host acknowledgment. Physical iPhone Safari/WebView testing remains necessary to assess keyboard/notch behavior and perceived smoothness on the actual device.

## Mac opening follow-up — 1.4.16

A regression probe confirmed that automatic body focus happened after expansion
had started. Focus and scroll setup now complete before motion. Mac keyframes
contain transforms only; the compositor hint is temporary and released after
two final frames. Popup placement and forced closes cancel pending handoff work.

A sequential comparison used the same 5,000-message fixture, 1100×900 headless
Chromium viewport and eight open/close cycles per variant:

| Variant | Open median / p95 | Close median / p95 | Frames over 25 ms (open / close) |
| --- | --- | --- | --- |
| Published 1.4.15 | 32.9 / 33.4 ms | 16.7 / 33.4 ms | 69 / 59 |
| Startup/compositor fixes, blur retained | 16.8 / 33.4 ms | 16.7 / 33.4 ms | 63 / 55 |
| Same fixes, Card backdrop blur removed | 16.7 / 16.8 ms | 16.7 / 16.7 ms | 0 / 0 |

The remaining expensive rendering feature in this comparison was the whole-Board
backdrop blur. Card view now retains its dim backdrop without that filter. The
frosted controls and menus retain their existing styling. This is a synthetic
Chromium rendering comparison, not a physical-Mac guarantee; real GPU/browser
behavior and host save latency can still differ.
