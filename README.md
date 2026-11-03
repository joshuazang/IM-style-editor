An IM-style editor for Standard Notes

- **IM-style-editor Archive** keeps the existing editor and format-2 notes. Its install manifest remains [im-style-editor.ext.json](im-style-editor.ext.json).
- **IM-style-editor 4** is a separate plugin with format-3 notes and an independent install manifest: [im-style-editor-next.ext.json](im-style-editor-next.ext.json). Both can be installed together.

The two note formats are intentionally incompatible. Keep existing notes in Archive. To move messages, clear filters in Archive, select all the intended messages, choose **Export**, then open a **new note** in the new editor and choose **Import from clipboard**. This transfers bubbles with their timestamps, tags and message metadata; it does not transfer the unsent draft, pins, or the source note's appearance/settings. Imported messages use the destination's appearance and show **Imported**. Keep the source note until you have checked the import.

The new editor saves one complete plain-text representation, reuses decoded messages while saving drafts, and renders a measured window of nearby bubbles. See [format 3](docs/note-format-3.md) for storage details and validation.

Editor 4.0.3 remembers selections through Standard Notes’ encrypted account preferences. Existing browser-local selections migrate as their notes are opened; their local entries are removed only after an editor reopening reads the saved preferences back from Standard Notes. The bottom indicator uses `selected / total selected`.

Editor 4.0.4 adds **Timer** to the main three-dot menu: silent 5- and 25-minute presets. When it finishes, typing pauses until you cancel, extend, or restart. In that dialog, 2/3/4 focus the choices and Enter confirms; Esc cancels. If the editor was suspended or closed, the finished prompt appears when you return.

Editor 4.0.5 reduces work while saving drafts, changing bubbles, importing messages and displaying the countdown. Drafts still save immediately through the same acknowledged queue, and the note format and Archive remain unchanged.

Editor 4.0.6 fixes false selection-saving warnings when an embedded editor blocks access to old browser storage. Current selections continue to use Standard Notes’ encrypted preferences.

Editor 4.0.7 releases past save contents from the host bridge, skips identical saves already confirmed by the host, and limits temporary note/row caches. Changed drafts still save promptly using complete note snapshots.

Editor 4.0.8 fixes metadata-only sync updates restoring an older draft after Send. Host timestamps update without replacing the current message content or draft; ordinary content updates and draft autosaving continue normally.

Editor 4.1.0 adds **Merge selected** to the selection three-dot menu, with a combined-message preview. Text stays in note order, separated by blank lines; tags and pins are combined and reply destinations are preserved. The first message keeps its position/date. The combined message is edited and its Copied/Exported statuses reset.

Reading older messages now stays anchored when messages change below. Near the bottom, new messages follow smoothly; otherwise the down-arrow shows how many new messages are below. Date boundaries have doubled separator margins, and clicking a date’s selection control selects that day’s messages in the current view, including off-screen filter matches. **Iris blue** is `rgb(78, 92, 240)` with white text.

Editor 4.1.1 adds **Occult field journal** in **Appearance → Artwork**: a dense vector wallpaper combining mysterious expeditions, lost observatories, enchanted natural history, nocturnal scholars and ocean secrets. Existing artwork choices and note settings are retained. See [artwork details](docs/artwork.md).

Editor 4.1.2 makes date separators more prominent with about 40% more space at day boundaries, larger bold date labels, stronger contrast and clearer divider lines. Same-day message spacing is unchanged.
