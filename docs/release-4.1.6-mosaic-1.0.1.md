# Coordinated release validation

IM-style-editor 4.1.6 and Mosaic 1.0.1 share the same canonical core. Format 3
and both plugin identifiers are unchanged. Archive is not modified.

## Audit findings addressed

| Finding | Change | Regression evidence |
| --- | --- | --- |
| Failed Mosaic draft discarded after switching notes | Retain unconfirmed sessions in RAM until acknowledgment or explicit saved-version choice | Rejection → A/B/A → Retry at 320/390/1100 pixels; draft stays unsent |
| Late clipboard result overwrote newer same-note content | Defer per-message status intents and match them against current source text | Delayed Copy and Export with changed body/draft/title; inactive-note permission enforcement; changed source not marked |
| Same-text host updates lost native fields | Merge fresh native fields and rebase waiting snapshots, leaving sent packets immutable | Idle, in-flight and queued title/reference/unrelated-field changes |
| Drafts rebuilt unchanged bubble sections after adding a card | Adopt the writer's normalized cached record array | 5,000 messages, post-Send typing: zero full parses, section joins or unchanged bubble encodes |
| Recursive reply snapshots grew with every previous reply | Bound new quotes to direct text plus one context level, retain deeper IDs | 100 short replies: 47,355 bytes in the synthetic fixture; old nested records remain unchanged |
| Optional malformed merge metadata crashed reply navigation | Validate array/object shape at lookup | Unknown string/null/number merge metadata and forwarding chains |
| Browser proofing/writing assistance enabled | Request disabled proofing, autocomplete, autocorrection and writing suggestions | Actual IM/Mosaic text-field attributes, including card editor inputs |

No additional browser-storage note copies, independent networking or encryption
scheme were introduced. No account data was used.

## Checks

`python3 tools/package-editors.py` builds both releases. The common block's
SHA-256 is recorded in `editors-release.json` and each generated page/script.
`python3 tools/verify-editors.py` compares the bundled cores, install metadata,
JavaScript syntax and exact installed ZIP contents.

`python3 tools/check-editors.py` runs 27 Node data suites plus the IM integration,
clipboard, Mosaic integration and audit safety browser suites. They cover:

- Archive export → modern import; incompatible note formats remain read-only.
- Mosaic → IM → Mosaic switching with exact text, draft and metadata retention.
- Empty/failed/late acknowledgments, coalesced waiting writes, no idle writes,
  final Send failure across note switches and exactly one message after retry.
- Multiple unfinished card edits, per-card restoration and source changes.
- Opaque sandbox origins, parent/session checks and mobile JSON transport.
- Clipboard success/denial/manual fallback; rejected import never clears it.
- Pins, replies, filters, off-screen Select all/Export, merge and status clearing.
- Malformed syntax, reserved lines, CRLF, emoji, unknown metadata and literal HTML.
- Completed Chinese IME capture before click-outside submission.
- 5,000-message windowing: 13 initial Mosaic previews / 279 page elements in
  the recorded run; IM 18 rows / 262 elements. IM input took a median of 19.9 ms
  over two animation frames in that local run, with zero full parses/encodes.

These are local Chromium results with synthetic component hosts. They are not
physical iPhone/macOS app certification, a formal penetration test, proof of
server sync, or a guarantee against a malicious OS/host/update. Full note records
remain in RAM, and actual saves still submit a complete note to Standard Notes.
See [security boundaries](editor-security.md).
