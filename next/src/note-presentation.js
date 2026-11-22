/* Preserve stored appearance metadata; unsupported artwork falls back only in the view. */
function imVisibleArtwork(value) {
  return value === "garden" ? "garden" : "classic"
}

function readNoteMessages(note) {
  return imFormat.readMessages(note)
}
const imEditorSettings = new WeakMap;

function readEditorSettings(note) {
  const raw = imFormat.readSettings(note);
  if (imEditorSettings.has(raw)) return imEditorSettings.get(raw);
  const normalized = imPinSettings(raw);
  const bubbleThemes = ["spring", "sky", "mint", "lime", "lavender", "rose", "amber", "forest", "midnight",
    "cobalt", "royal", "iris"
  ];
  const backgroundThemes = ["cloud", "pearl", "mist", "seafoam", "sand", "blush", "lilac"];
  const bubbleTheme = normalized.bubbleTheme ?? normalized.theme;
  const result = {
    ..._a,
    ...normalized,
    bubbleTheme: bubbleThemes.includes(bubbleTheme) ? bubbleTheme : _a.bubbleTheme,
    backgroundTheme: backgroundThemes.includes(normalized.backgroundTheme) ? normalized.backgroundTheme : _a
      .backgroundTheme,
    wallpaper: typeof normalized.wallpaper == "boolean" ? normalized.wallpaper : _a.wallpaper,
    artwork: typeof normalized.artwork === "string" ? normalized.artwork : "classic",
    reactionOrder: Array.isArray(normalized.reactionOrder) ? normalized.reactionOrder.filter($ => typeof $ ==
      "string") : _a.reactionOrder,
    deletedEmojis: Array.isArray(normalized.deletedEmojis) ? normalized.deletedEmojis.filter($ => typeof $ ===
      "string") : []
  };
  imEditorSettings.set(raw, result);
  return result
}

function messageDayKey(timestamp) {
  const date = timestamp ? new Date(timestamp) : null;
  return !date || Number.isNaN(date.valueOf()) ? "earlier" :
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function messageDayLabel(timestamp) {
  if (!timestamp || Number.isNaN(new Date(timestamp).valueOf())) return "Earlier";
  const date = new Date(timestamp);
  const today = new Date;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).valueOf();
  const messageDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).valueOf();
  return messageDayStart === todayStart ? "Today" : messageDayStart === todayStart - 864e5 ? "Yesterday" : new Intl
    .DateTimeFormat(void 0, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === today.getFullYear() ? void 0 : "numeric"
    }).format(date)
}

function messageTimeLabel(timestamp) {
  return !timestamp || Number.isNaN(new Date(timestamp).valueOf()) ? "" : new Intl.DateTimeFormat(void 0, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp))
}
