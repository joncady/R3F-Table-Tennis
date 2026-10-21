export const markerPayload = (room: string, nonce: string) =>
  `tt1:${room}:${nonce}`;
export function markerFacingCamera(location: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
}, minSize = 45) {
  const {
    topLeftCorner: a,
    topRightCorner: b,
    bottomLeftCorner: c,
    bottomRightCorner: d,
  } = location;
  const length = (p: typeof a, q: typeof a) => Math.hypot(p.x - q.x, p.y - q.y);
  const top = length(a, b),
    bottom = length(c, d),
    left = length(a, c),
    right = length(b, d),
    width = (top + bottom) / 2,
    height = (left + right) / 2;
  return (
    width >= minSize &&
    height >= minSize &&
    width / height > 0.78 &&
    width / height < 1.28 &&
    Math.min(top, bottom) / Math.max(top, bottom) > 0.75 &&
    Math.min(left, right) / Math.max(left, right) > 0.75 &&
    b.x > a.x &&
    Math.abs(b.y - a.y) / top < 0.25
  );
}
export class MarkerGate {
  private since: number | null = null;
  private last = -Infinity;
  private detections = 0;
  update(now: number, expected: string, seen: string | null, facing: boolean) {
    // Brief decode misses are normal on low-resolution webcams. Only valid
    // observations refresh this window; a different/tilted marker resets it.
    if (now - this.last > 1800 || (seen !== null && (seen !== expected || !facing))) {
      this.since = null;
      this.detections = 0;
    }
    if (seen !== expected || !facing) return false;
    if (this.since === null) this.since = now;
    this.last = now;
    this.detections += 1;
    return this.detections >= 3 && now - this.since >= 400;
  }
}

// Describe only what the scanner can establish; brightness/occlusion are advice,
// not diagnoses. Never leave a stale “matching” message after the marker is lost.
export function markerGuidance(
  expected: string,
  seen: string | null,
  location: Parameters<typeof markerFacingCamera>[0] | null,
  sinceMatch: number,
  minSize = 45,
) {
  if (seen && seen !== expected) return 'Different session marker. Reopen this game’s pairing link.';
  if (seen === expected && location) {
    const size = Math.min(
      Math.hypot(location.topRightCorner.x - location.topLeftCorner.x, location.topRightCorner.y - location.topLeftCorner.y),
      Math.hypot(location.bottomLeftCorner.x - location.topLeftCorner.x, location.bottomLeftCorner.y - location.topLeftCorner.y),
    );
    if (size < minSize) return 'Marker is too small. Move the phone closer to the webcam.';
    if (!markerFacingCamera(location, minSize)) return 'Marker found. Face the screen straight at webcam, top edge up.';
    return 'Matching session. Hold steady…';
  }
  if (sinceMatch <= 1800) return 'Marker briefly lost. Keep it facing the webcam; alignment is still in progress.';
  return 'Marker not readable. Move closer, keep the whole marker visible, and reduce screen glare.';
}
