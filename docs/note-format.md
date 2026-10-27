# Plaintext format 2 (editor 3.0.0)

This is an intentional clean break. The reader accepts format 2 only. Format 1 notes and old forwarding exports are not migrated or decoded. Unsupported/malformed archival text stays read-only and is shown in full. To reuse old content, manually copy the actual message text into a new/plain note and resave. No note checksums, hashes, integrity manifests, sequence numbers, compression or migration heuristics are used.

A complete example is in [example-format-2.txt](example-format-2.txt).

## Identity

Every new message, plain-text paragraph import, and forwarding collision receives 16 bytes from `crypto.getRandomValues`. Base64url encoding retains all 128 bits, uses `A–Z a–z 0–9 - _`, and removes padding, producing 22 characters. The final character is A, Q, g or w because the encoding has four unused low bits. IDs never derive from positions, text, clocks or counters. There is no weak random fallback. Editing, deleting neighbors, reordering complete records, and changing settings do not regenerate identities.

## Structural syntax

The exact standalone header lines are `#!im-style-editor 2` and `#!encoding utf-8`. The exact standalone machine control lines are:

- `@@IM:SETTINGS` and `@@IM:END-SETTINGS`
- `@@IM:BUBBLE`, `@@IM:TEXT` and `@@IM:END-BUBBLE`
- `@@IM:END` (document end)

There is one settings block followed by zero or more bubbles in document order, then the document end. Each bubble has metadata, then `@@IM:TEXT`, then its body. A single LF inserted by the writer immediately before `@@IM:END-BUBBLE` frames the body and is not part of it. All earlier body bytes/characters, including leading/trailing whitespace, blank lines and carriage returns, belong to the actual message. Empty messages have an empty body plus that framing LF. No hard wrapping or Unicode normalization is performed.

Only exact reserved lines are controls. `I saw @@IM:END-BUBBLE today.` and `@@IM:UNRESERVED` are ordinary body text. Structural/metadata lines can use CRLF; the reader never normalizes the body. A different editor that changes body line endings has changed the message text, and that cannot be inferred or reversed without a backup.

## Fields

Metadata uses `name: value` lines. Bubble fields are `id`, optional `created`, optional `edited`, required `reactions`, optional `separator-after`, optional `forwarding`, and optional `extra-metadata`. Settings fields are `bubble-theme`, `background-theme`, `wallpaper`, `artwork`, `scale`, `reaction-order`, `deleted-emojis`, and optional `extra-settings`.

IDs and timestamps can be bare tokens. Simple textual settings can be bare words, such as `lime` or `classic`. Other strings use JSON quotes; booleans, numbers, arrays and objects use JSON values. Unknown message/settings properties are preserved inside `extra-metadata` / `extra-settings` objects. These cannot override reserved fields. Duplicate/unknown fields, invalid types, duplicate IDs and incomplete structures pause saving. Neither timestamps nor missing content are invented.

## Decoration is not structure

The writer emits 60 equals signs outside records and 60 hyphens before `@@IM:TEXT`. Neither line is needed. The parser does not use a separator to begin/end a bubble or discover its body. It accepts optional ASCII punctuation decoration of any length (including altered punctuation, duplicates and lines moved before/between metadata/control/header lines). Removing all generated decoration yields the identical semantic document.

Inside `@@IM:TEXT`, equals signs, hyphens and other punctuation lines are actual user text and are always preserved. Adding/deleting these lines changes that message's text but never changes its bubble boundaries. This distinction is necessary to preserve message text exactly.

Unexpected prose outside a body is protected rather than silently discarded as decoration. A separator changed into ordinary words or reserved metadata/control syntax is no longer disposable punctuation; put actual prose inside `@@IM:TEXT`. This conservative validation does not use separators to repair or infer structure.

## Minimal literal-control escaping

A body line exactly equal to a reserved control line is prefixed with one backslash. A body line beginning with a backslash is also prefixed with one backslash so the mapping is reversible. The decoder removes only these prefixes. Inline controls, ordinary backslashes such as `C:\notes`, ordinary `@@` prose, punctuation, Chinese, emoji, and other Unicode remain untouched. This minimal escaping is technically necessary to allow literal reserved lines without confusing them with structure.

## Storage and forwarding

`content.text` contains the entire document. Native per-note `clientData.imStyleEditor` schema 3 and the existing custom content fields remain mirrors; plaintext is authoritative. No old-format metadata is read. Normal plain-text notes split at blank lines and retain exact message whitespace and separators. Note titles, references and unrelated client data remain untouched.

Clipboard forwarding uses envelope version 2 and accepts only valid new-format IDs/records. It preserves complete selected messages and forwarding provenance, keeps destination appearance, and skips exact duplicates. ID collisions get a new random local ID with the original retained as provenance. The UI, toolbar, emoji ordering/deletion confirmation, colors, frosted menus, time grouping and storage transport are unchanged.

## Validation

`node tests/portable-format.test.cjs` covers 5,000 bubbles, 1,500 randomized Unicode/whitespace bodies, very long messages, empty bodies/documents, literal controls and backslashes, CR/CRLF, metadata/settings, deletion/reordering, altered/moved/removed decoration, body punctuation and malformed structures. It checks 10,000 generated IDs and deterministic all-byte patterns to verify the full 128-bit encoding.

`tests/note-format.test.cjs` covers plain imports, text-only round trips, permanent edit IDs, unrelated note-data preservation and rejection of the old version. `tests/message-transfer.test.cjs` covers forwarding identity/provenance and duplicates. Existing browser smoke checks use an independent format-2 fixture writer and validate actual editor switching, saving failures, forwarding, mobile/desktop interactions and unchanged layout. No real account or note is accessed.
