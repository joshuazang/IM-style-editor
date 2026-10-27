To publish a new static extension release after editing the bundle or styles:

1. Run `python3 tools/package-release.py X.Y.Z` with a new version.
2. Run `python3 tests/update-cache-smoke.py`. With the repository served locally, also run the touch-menu and timestamp-layout checks.
3. Commit the updated HTML and manifests, new hashed assets, version-specific install manifest, and ZIP. Keep older published files so cached installation links remain valid.
4. After pushing, verify the **GitHub Pages** manifest, runtime HTML, assets, and downloadable ZIP. A successful Git push alone does not establish that Pages deployed the release.

The canonical install manifest is `im-style-editor.ext.json`. Each release also has a fresh `im-style-editor-X.Y.Z.ext.json` link for updating when the canonical manifest is cached. `latest_url` points back to the canonical manifest, while the runtime URL and hashed asset names prevent reuse of an old interface.
