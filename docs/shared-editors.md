# One core, two interfaces

`shared/core` is the only modern source for the format-3 parser/writer, save
queue, host metadata helpers, message interchange, clipboard compatibility,
text-field defaults and reply records. `next/src` contains the IM interface;
`mosaic/src` contains the Mosaic interface. Root `src` and root `index.html`
belong to the independent format-2 Archive, which is not migrated.

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
7. Run `python3 tools/sync-mosaic-distribution.py /path/to/Mosaic` and publish
   that compatibility repository. The old install link returns the canonical
   manifest and retains the same plugin ID. Its root preview also receives the
   fixed bundled app; it does not redirect an embedded frame and lose its host.

A shared-source change updates both builds. Installed plugins receive those
updates through Standard Notes' normal update mechanism, rather than hot-loading
unreviewed code while a note is open. The workflow tests releases; it does not
silently rewrite files or grant itself publishing credentials.

Mosaic's former repository remains a compatibility distribution, with its old
tags/releases intact. New source development and issue tracking belong here.

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
