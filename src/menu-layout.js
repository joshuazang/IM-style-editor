/* Place touch menus away from the hold point without scrolling/moving the note. */
function imMenuPosition({ anchor, point, width, height, viewport, touch }) {
  const margin = 8, gap = 12, fingerClearance = 24;
  const left = viewport.left || 0, top = viewport.top || 0;
  const right = left + viewport.width, bottom = top + viewport.height;
  const maxWidth = Math.max(1, Math.min(viewport.width - 2 * margin, touch ? 260 : 220));
  const w = Math.min(width, maxWidth);
  let maxHeight = Math.max(1, viewport.height - 2 * margin);
  let h = Math.min(height, maxHeight);
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(value, Math.max(lo, hi)));
  let x = clamp(touch ? anchor.right - w : point.x, left + margin, right - margin - w);
  let y;
  if (!touch) {
    y = clamp(point.y, top + margin, bottom - margin - h);
  } else {
    const above = Math.min(anchor.top - gap, point.y - fingerClearance);
    const below = Math.max(anchor.bottom + gap, point.y + fingerClearance);
    if (above - h >= top + margin) y = above - h;
    else if (below + h <= bottom - margin) y = below;
    else {
      const roomAbove = Math.max(0, point.y - fingerClearance - top - margin);
      const roomBelow = Math.max(0, bottom - margin - point.y - fingerClearance);
      if (Math.max(roomAbove, roomBelow) >= 44) {
        maxHeight = Math.min(maxHeight, Math.max(roomAbove, roomBelow));
        h = Math.min(height, maxHeight);
        y = roomAbove >= roomBelow ? point.y - fingerClearance - h : point.y + fingerClearance;
      } else y = clamp(point.y - h - fingerClearance, top + margin, bottom - margin - h);
    }
    y = clamp(y, top + margin, bottom - margin - h);
  }
  return { x, y, maxHeight, maxWidth };
}
