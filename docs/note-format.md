# Plaintext format 2 (editor 3.0.0)

This is an intentional clean break. The reader accepts format 2 only. Format 1 notes and old forwarding exports are not migrated or decoded. Unsupported/malformed archival text stays read-only and is shown in full. To reuse old content, manually copy the actual message text into a new/plain note and resave. No note checksums, hashes, integrity manifests, sequence numbers, compression or migration heuristics are used.

A complete example is in [example-format-2.txt](example-format-2.txt).

## Identity

Every new message, plain-text paragraph import, and forwarding collision receives 16 bytes from `crypto.getRandomValues`. Base64url encoding retains all 128 bits, uses `A–Z a–z 0–9 - _`, and removes padding, producing 22 characters. The final character is A, Q, g or w because the encoding has four unused low bits. IDs never derive from positions, text, clocks or counters. There is no weak random fallback. Editing, deleting neighbors, reordering complete records, and changing settings do not regenerate identities.

## Structural syntax

The exact standalone header lines are `#!im-style-editor 2` and `#!encoding utf-8`. The exact standalone machine control lines are:

- `@@IM:SETTINGS` and `@@IM:END-SETTINGS`
- `@@IM:BUBBLE`, `@@IM:CONTENT` and `@@IM:END-BUBBLE`
- `@@IM:END` (document end)

There is one settings block followed by zero or more bubbles in document order, then the document end. Each bubble has metadata, then `@@IM:CONTENT`, exactly two framing blank lines, the encoded message body, exactly two framing blank lines, then `@@IM:END-BUBBLE`. The LF wire representation is `@@IM:CONTENT` + `\n\n\n` + encoded body + `\n\n\n` + `@@IM:END-BUBBLE`: each run includes the preceding line’s terminator and two empty lines. The parser locates the end control first, then removes exactly two leading LF characters and three trailing LF characters from the region after the content-marker line. It never trims or normalizes the payload. Empty bodies use the same fixed framing, and blank/whitespace-only bodies remain valid. Missing framing is protected when detectable; the parser never guesses which user-authored blank lines to remove. No hard wrapping or Unicode normalization is performed.

Only exact reserved lines are controls. `I saw @@IM:END-BUBBLE today.` and `@@IM:UNRESERVED` are ordinary body text. Structural/metadata lines can use CRLF; the reader never normalizes the body. A different editor that changes body line endings has changed the message text, and that cannot be inferred or reversed without a backup.

## Fields

Metadata uses `name: value` lines. Bubble fields are `id`, optional `created`, optional `edited`, required `reactions`, optional `separator-after`, optional `forwarding`, and optional `extra-metadata`. Settings fields are `bubble-theme`, `background-theme`, `wallpaper`, `artwork`, `scale`, `reaction-order`, `deleted-emojis`, and optional `extra-settings`.

IDs and timestamps can be bare tokens. Simple textual settings can be bare words, such as `lime` or `classic`. Other strings use JSON quotes; booleans, numbers, arrays and objects use JSON values. Unknown message/settings properties are preserved inside `extra-metadata` / `extra-settings` objects. These cannot override reserved fields. Duplicate/unknown fields, invalid types, duplicate IDs and incomplete structures pause saving. Neither timestamps nor missing content are invented.

## Whitespace for visual spacing

The writer never emits decorative separator strings. It uses blank lines between sections/records and the fixed content framing described above. The format header, fields, settings, compact IDs and escaping rules otherwise remain the same.

Only explicit control lines determine bubble boundaries. Two, three, or hundreds of blank lines inside content never create another bubble. If a message begins with two authored blank lines, the serialized content has four blank lines after the content marker: two framing plus two authored lines. Removing the fixed framing restores the original message exactly. Leading/trailing tabs, spaces, carriage returns, Unicode and punctuation also remain unchanged.

User-authored lines of equals signs or hyphens inside the body are still ordinary content and are preserved. Do not remove them as decoration. The parser’s existing tolerance for optional punctuation outside records is unchanged, but the writer no longer generates it. Unexpected prose outside a body remains protected. Content framing uses LF; an external editor that rewrites or removes the framing may make a document invalid, or may change its payload whitespace. The parser does not try to reconstruct external edits.

## Minimal literal-control escaping

A body line exactly equal to a reserved control line is prefixed with one backslash. A body line beginning with a backslash is also prefixed with one backslash so the mapping is reversible. The decoder removes only these prefixes. Inline controls, ordinary backslashes such as `C:\notes`, ordinary `@@` prose, punctuation, Chinese, emoji, and other Unicode remain untouched. This minimal escaping is technically necessary to allow literal reserved lines without confusing them with structure.

## Storage and forwarding

`content.text` contains the entire document. Native per-note `clientData.imStyleEditor` schema 3 and the existing custom content fields remain mirrors; plaintext is authoritative. No old-format metadata is read. Normal plain-text notes split at blank lines and retain exact message whitespace and separators. Note titles, references and unrelated client data remain untouched.

Clipboard forwarding uses envelope version 2 and accepts only valid new-format IDs/records. It preserves complete selected messages and forwarding provenance, keeps destination appearance, and skips exact duplicates. ID collisions get a new random local ID with the original retained as provenance. The UI, toolbar, emoji ordering/deletion confirmation, colors, frosted menus, time grouping and storage transport are unchanged.

## Validation

`node tests/portable-format.test.cjs` covers 5,000 bubbles, 1,500 randomized Unicode/whitespace bodies, very long messages, empty bodies/documents, literal controls and backslashes, CR/CRLF, metadata/settings, deletion/reordering, absence of generated separators, 441 leading/trailing-newline combinations, exact framing, body punctuation and malformed structures. It checks 10,000 generated IDs and deterministic all-byte patterns to verify the full 128-bit encoding.

`tests/note-format.test.cjs` covers plain imports, text-only round trips, permanent edit IDs, unrelated note-data preservation and rejection of the old version. `tests/message-transfer.test.cjs` covers forwarding identity/provenance and duplicates. Existing browser smoke checks use an independent format-2 fixture writer and validate actual editor switching, saving failures, forwarding, mobile/desktop interactions and unchanged layout. No real account or note is accessed.
