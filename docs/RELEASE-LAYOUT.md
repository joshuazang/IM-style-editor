# Repository release layout

The root keeps the current distributions for IM, Mosaic, and the frozen Archive
editor, along with their stable install manifests. Application source remains in
`src/`, `shared/`, and `mosaic/src/`; current apps remain at `next/` and `mosaic/`.

Historical files live under `releases/`:

- `im/<version>/`: previous IM 4.x ZIPs and versioned manifests.
- `mosaic/<version>/`: previous Mosaic ZIPs and versioned manifests.
- `archive/<version>/`: older Archive editor releases.
- `assets/next/` and `assets/mosaic/`: previous fingerprinted runtime assets.
- `paths.json`: original public path to archived file mapping.

See the [release index](../releases/README.md) to browse versions. Archived files
retain their original contents. Moving them does not change the editor versions
or rewrite notes.

`python3 tools/package-editors.py` builds both current packages and automatically
archives superseded root releases and runtime assets. Commit those moves along
with the generated release files. Run `python3 tools/verify-editors.py` and
`python3 tools/check-release-layout.py` before publishing.

GitHub Pages uses `.github/workflows/pages.yml`. Its static build copies tracked
files, then restores every original path from `paths.json` into the published
site. Old manifest, ZIP, and cached asset URLs therefore return the original
bytes with HTTP 200, without redirects. Both organized and original paths work.
The duplicated public paths exist only in the build output, not the Git tree.

Do not publish the repository directory directly with Jekyll: use
`python3 tools/prepare-pages.py`, which writes the ignored `_site/` directory.
