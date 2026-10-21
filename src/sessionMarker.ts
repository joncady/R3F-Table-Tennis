export const markerPayload = (room: string, nonce: string) =>
  `tt1:${room}:${nonce}`;
export function markerFacingCamera(location: {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
}) {
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
    width >= 45 &&
    height >= 45 &&
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
  update(now: number, expected: string, seen: string | null, facing: boolean) {
    if (seen !== expected || !facing) {
      this.since = null;
      this.last = now;
      return false;
    }
    if (this.since === null || now - this.last > 500) this.since = now;
    this.last = now;
    return now - this.since >= 500;
  }
}
