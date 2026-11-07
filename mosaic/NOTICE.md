# Source and attribution

Copyright (c) 2026 joshuazang. Publishing this source does not make a separate
license grant, consistent with the IM-style-editor project.

Mosaic's board UI, layout model, CSS and SVG controls were written for this project.
OpenKeep was a visual layout reference; no OpenKeep application code, assets,
analytics, storage layer or dependencies are included.

The format-3 parser/writer, save queue, transfer, clipboard, host metadata and
reply helpers live in `shared/core` in
https://github.com/joshuazang/IM-style-editor. Both modern interfaces compile the
same sources into their own release. `editors-release.json` records the exact
core fingerprint; neither interface fetches a shared runtime remotely.

The original Mosaic 1.0.0 used the project's IM 4.1.5 core at revision
7e063e3e028f050fa37b09092b5982619d0c5197. That historical release remains at
https://github.com/joshuazang/Mosaic/releases/tag/v1.0.0.

`mosaic/src/relay.js` implements the public Standard Notes component protocol,
informed by https://github.com/standardnotes/component-relay and the established
IM host integration. It binds the parent origin/session and supports the mobile
JSON transport. Mosaic bundles no compiled SDK or third-party JavaScript runtime.

The IM interface retains its existing React and Standard Notes SDK build. Moving
both projects here does not mean that every IM runtime dependency was authored
from scratch. Archive's sources and runtime are intentionally independent.

Build both current interfaces with `python3 tools/package-editors.py`. No runtime
dependency download is needed for that command.
