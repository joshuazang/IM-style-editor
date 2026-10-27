/* Visible bubble-to-bubble spacing; timestamps never change message order. */
function imMessageGap(previous, current, newDay) {
  if (!previous || newDay) return 0;
  const before = Date.parse(previous.createdAt);
  const after = Date.parse(current.createdAt);
  if (!Number.isFinite(before) || !Number.isFinite(after) || after < before) return 2;
  const elapsed = after - before;
  if (elapsed <= 5 * 60 * 1000) return 2;
  if (elapsed < 60 * 60 * 1000) return 7;
  return 12;
}
