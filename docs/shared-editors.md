# One core, two interfaces

`shared/core` is the only modern source for the format-3 parser/writer, save
queue, host metadata helpers, message interchange, clipboard compatibility,
text-field defaults and reply records. `next/src` contains the IM interface;
`mosaic/src` contains the Mosaic interface. Root `src` and root `index.html`
belong to the independent format-2 Archive, which is not migrated.

`shared/ui` contains the common static SVG dictionary, solid message-menu panels
and compact toolbar-control styles. It is compiled into both interfaces, with
its own SHA-256 recorded in `editors-release.json` and generated page metadata.
Interface action handlers remain in their respective source trees. A shared
visual design does not require different interfaces to expose identical actions.

Each application bundles the identical common block at build time. It works
independently after installation and does not fetch another editor's scripts.
Plugin IDs remain `com.im-style-editor.next` and `com.joshuazang.mosaic`.
This release keeps format 3; opening a note in either view does not convert it.

## Coordinated release

1. Edit the canonical shared source or the relevant interface.
2. Set both versions in `shared/release.json` for a shared-code release.
3. Run `python3 tools/package-editors.py`. It rebuilds both applications,
   manifests and install ZIPs and records a common SHA-256 fingerprint.
4. Run `python3 tools/check-editors.py`. Data suites include Archive regressions;
   browser suites cover both modern interfaces, clipboard behavior and shared
   note switching. They use synthetic notes only.
5. Commit the source and generated releases together. The Both editors workflow
   checks the packaged core and rebuilds both applications to detect stale output.
6. Publish the main branch to its existing GitHub Pages configuration. Verify
   both manifests, HTML, assets and ZIPs against the reviewed local bytes.
7. Publish future source changes and releases only from this repository. The
   retired standalone Mosaic repository is frozen; it has no separate build,
   synchronization or release step. Existing Mosaic installations retain their
   plugin ID and use this repository's `mosaic.ext.json` as their update URL.

A shared-source change updates both builds. Installed plugins receive those
updates through Standard Notes' normal update mechanism, rather than hot-loading
unreviewed code while a note is open. The workflow tests releases; it does not
silently rewrite files or grant itself publishing credentials.

Mosaic's former repository is retained for history and old links, with its tags,
releases, Pages site and final static files intact. Its frozen 1.0.3 manifest
points its app, download and `latest_url` to this repository. That old manifest
does not change on later releases; new installations should use the current
canonical manifest, and subsequent update checks use the canonical `latest_url`.
The old standalone preview and download snapshots are historical. Do not push
new builds or releases to the former repository. All source development, builds,
releases and issue tracking for both interfaces belong here.

## Recovery boundaries

Mosaic retains unconfirmed note sessions and unfinished card edits in RAM across
same-frame note switches. Successful acknowledgment releases them. Deferred
clipboard statuses contain only note/message IDs, copied text and flags; on
return they are applied to the current unchanged source, not a stale full note.
No recovery text is added to browser persistence or encrypted preferences.

Fresh ordinary host items refresh native note fields. Already-sent snapshots
stay immutable; only waiting snapshots are rebased. Unknown different host text
pauses waiting saves for review. Metadata-only messages update timestamps only.

New reply snapshots keep the direct quote and one quoted context level. Deeper
context is represented by IDs; existing notes and their older full snapshots
are not rewritten. This bounds new reply chains without a format change.
