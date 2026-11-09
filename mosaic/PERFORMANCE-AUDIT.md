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

## Six long, scrollable cards — 1.4.17

The reported six-card case exposed work *before* animation, distinct from the
backdrop frame-rate issue. Each card's full native textarea was laid out before
the transition could start. Synthetic samples with six equally long messages
showed the following synchronous opening costs (first open, then two other cards):

| Lines per message | Published 1.4.16 | Bounded preparation |
| --- | --- | --- |
| 120 | 54.9, 8.4, 10.4 ms | 26.1, 5.5, 5.3 ms |
| 600 | 50.5, 13.3, 16.1 ms | 19.1, 5.6, 7.8 ms |
| 2,400 | 94.6, 43.3, 52.4 ms | 17.4, 6.3, 5.7 ms |

These are separate headless-Chromium samples, not a physical-Mac guarantee or
a statistical benchmark. Full native text layout still has a cost; preparation
for the largest bodies now runs after the moving part of expansion, not before
its first frame. Native CSS content sizing alone produced only a modest
reduction in the experiment and was not adopted.

The initial value is bounded only when it already overflows the final viewport
by more than two text lines; short/proportional cards fall back to full layout.
The model always retains the full body. The partial field is read-only/busy,
and pointer, keyboard, composition, title and popup actions prepare full text
before editing. Shared title input handlers cannot replace a pending body with
the partial display value. Deferred callbacks are cancelled on close/switch;
full-body replacement preserves selection and scroll position. iPhone
preparation never focuses an unfocused body. Save acknowledgment/conflict
protections remain unchanged.

Regression coverage opens all six long cards and checks unchanged destination
geometry, complete values, no opening writes, early keyboard edits, title-only
saves, failed-save retention/retry, note switches, iPhone focus and reduced motion.

## Recording follow-up: delayed first render — 1.4.18

Frame-by-frame inspection of the supplied Standard Notes Mac desktop recording showed the opening
surface at its Board rectangle in one frame and almost at its destination in
the next. Earlier checks measured JavaScript frame intervals and endpoints;
they did not cover an animation clock advancing during delayed initial rendering.

A new lower-right-card regression uses a 1410×821 viewport at 2× device scale,
paragraph-length cards and a deliberate 220ms first-frame main-thread stall.
Against the published 1.4.17 assets the JavaScript geometry probe fails: sampled
progress jumps from approximately 19% to 99%, leaving too few intermediate
rectangles. This establishes elapsed-clock catch-up under a startup stall, not
an exact reproduction of the Mac rendering failure.

Opening and closing now pause at the initial keyframe, allow a render opportunity
through two animation-frame callbacks, then start playback. The geometry test records
17 intermediate rectangles with and without the injected stall, with the first
moving sample at approximately 19% progress. All pending long-body preparation
now waits for the completed expansion, unless explicit input requires it sooner.
The existing 320ms duration, geometry and save protections remain unchanged.
An additional CDP screencast captured intermediate painted rectangles in both
versions: compositor motion can continue during a JavaScript stall. Thus the
geometry improvement alone is not evidence that the reported Mac hitch is fixed.

Early Close before playback and forced close/note switching cancel the queued
start callback. Existing reversal, full-text input, reduced-motion and platform
layout checks remain in the coordinated suite. These are Linux Chromium results;
they do not guarantee physical-Mac compositor behavior or eliminate stalls that
occur after playback has started.
