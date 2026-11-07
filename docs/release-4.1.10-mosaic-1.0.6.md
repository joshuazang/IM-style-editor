# IM 4.1.10 and Mosaic 1.0.6

Both top-right search/tag menus now use Mosaic's visible hover tint. Mosaic's
filter tags have rounded borders and frosted surfaces; board tag chips also
have visible borders. Pin controls on the board and inside opened cards use a
circular hover tint. Board previews omit Copied, Imported, Exported and Edited
labels while preserving those fields and their display inside opened cards.
Reduced card padding and tag/footer spacing remove unused vertical space.

Mosaic's More menu adds Color palette and Font size. Sage retains the original
green, Paper uses white and charcoal, and Sand uses warm cream and dark brown.
Existing OS night appearance continues automatically. Explicit card colors
remain unchanged. The four font sizes are Small, Medium, Large and Extra large;
Medium retains the previous text sizes, and Large is the default. Input text on
phones stays at least 16px. Native system fonts are used without downloads.

Choices are per-note settings using the existing acknowledged saving path.
Only known palette and font IDs affect presentation. Missing/unknown settings
fall back to Sage/Large without automatic note writes. IM preserves the extra
settings, and the shared parser, format 3, storage policy and network policy are
unchanged. A failed appearance save uses the existing retained-session retry.

Font size forms part of the masonry height-cache key. Changing size cannot reuse
a measurement from another size. Only nearby cards are mounted/measured, and
scroll anchoring remains active. Viewing a palette or size menu does not save.

Regression coverage uses synthetic notes at 320, 390 and 1100 pixels: all four
sizes, Medium compatibility and Large default, nonoverlapping measured previews,
compact tagged/untagged height differences, borders/frost/hover, opened-card
statuses and pin feedback, all palettes in both OS appearances, text contrast,
per-note persistence and reload, failed-save retry, and IM interchange preserving
text, drafts, statuses and settings. The existing coordinated saving, clipboard,
touch, large-note and Archive suites also run. Chromium phone-sized tests are
not physical iOS Standard Notes tests.

Only the canonical IM-style-editor repository is published. The retired Mosaic
repository and its frozen historical releases remain untouched.
