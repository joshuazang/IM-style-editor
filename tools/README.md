To publish a new static extension release after editing the bundle or styles:

1. Run `python3 tools/package-release.py X.Y.Z` with a new version.
2. Run the Node format/spacing/layout tests and `python3 tests/update-cache-smoke.py`. With the repository served locally, run the capture-controls, message-emphasis, reply, draft-status, clipboard-selection, keyboard-scroll, selection-status, selection-menu, editor-interactions, reactions-serialization, emoji-delete, recovery-forwarding, editor-roundtrip, filter-send, filter-artwork, touch-menu, touch-menu-placement, timestamp-layout, appearance-spacing and top-menu-frost checks. Set `IM_STYLE_EDITOR_BASE_URL` to the active local server.
3. Commit the updated HTML and manifests, new hashed assets, version-specific install manifest, and ZIP. Keep older published files so cached installation links remain valid.
4. After pushing, verify the **GitHub Pages** manifest, runtime HTML, assets, and downloadable ZIP. A successful Git push alone does not establish that Pages deployed the release.

The canonical install manifest is `im-style-editor.ext.json`. Each release also has a fresh `im-style-editor-X.Y.Z.ext.json` link for updating when the canonical manifest is cached. `latest_url` points back to the canonical manifest, while the runtime URL and hashed asset names prevent reuse of an old interface.

Readable note-storage helpers live in `src/`. The packager inlines them before hashing the runtime bundle; do not add a separate mutable script URL. Already-published hashed assets are restored from Git after their changes are copied into a new asset. See `docs/note-format.md` for the storage schema and round-trip checks.

Editor 3.0.0 writes plaintext format 2 only. This is an intentional clean break; do not add format-1 migration code or test fixtures. Read `docs/note-format.md` and the complete `docs/example-format-2.txt` example. Both SVG artwork files must remain in the release archive.

Composer edits use a separate edit buffer, so canceling or saving restores the unsent message draft. Selection checks live outside bubble articles in a permanent left gutter. Viewport behavior is maintained in `src/editor-interactions.js`; phone touch scrolling dismisses composer focus, and the bottom shortcut uses the current filtered list. At the bottom, resizing the viewport or composer keeps the latest message above the input; reading earlier messages preserves that position. Send and the bottom shortcut retain their original vertical positions. Native interactive keyboard dragging remains controlled by Standard Notes/iOS.

Copy and Export share a clipboard writer: asynchronous clipboard API first, compatibility copy second, then a solid manual-copy dialog if both are blocked. Selection mode captures the input row height before unmounting it so empty and multiline drafts do not shift the message viewport.

Draft/status serialization uses presence markers and a framed draft section; see `docs/note-format.md`. Editing identical text does not save a bubble change. Notes open at the newest message once per open.
