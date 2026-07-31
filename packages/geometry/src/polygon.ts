import type { Vec2 } from "@layra/types";
import { EPSILON, cross, sub } from "./math";

/**
 * Shoelace area of a closed polygon, signed by winding.
 *
 * Positive means counter-clockwise in the (x, z) parameter plane. Note that
 * because +z points "down" when looking along -Y, such a loop appears clockwise
 * on screen from a top-down camera — the sign convention here is about the
 * parameter plane, not about what the user sees.
 */
export function signedArea(points: readonly Vec2[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
}

export function polygonArea(points: readonly Vec2[]): number {
  return Math.abs(signedArea(points));
}

export function isCCW(points: readonly Vec2[]): boolean {
  return signedArea(points) > 0;
}

/**
 * Normalizes winding to CCW, copying only when a reversal is needed.
 *
 * Every offset and extrusion function assumes CCW input so that `leftNormal`
 * points into the room.
 */
export function ensureCCW(points: readonly Vec2[]): Vec2[] {
  return isCCW(points) ? [...points] : [...points].reverse();
}

/** True when `p` lies on segment `a`-`b`, assuming the three are already collinear. */
function onSegment(a: Vec2, b: Vec2, p: Vec2): boolean {
  return (
    p.x <= Math.max(a.x, b.x) + EPSILON &&
    p.x >= Math.min(a.x, b.x) - EPSILON &&
    p.z <= Math.max(a.z, b.z) + EPSILON &&
    p.z >= Math.min(a.z, b.z) - EPSILON
  );
}

/**
 * Proper segment intersection test.
 *
 * Returns true when the segments cross or overlap. Segments that merely touch
 * at a shared endpoint are *not* counted — adjacent polygon edges always share
 * one, so counting those would make every polygon self-intersecting.
 */
export function segmentsIntersect(
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
): boolean {
  const d1 = sub(a2, a1);
  const d2 = sub(b2, b1);
  const denominator = cross(d1, d2);

  if (Math.abs(denominator) < EPSILON) {
    // Parallel. Only an overlap of collinear segments counts as an intersection.
    if (Math.abs(cross(sub(b1, a1), d1)) > EPSILON) return false;
    return (
      (onSegment(a1, a2, b1) && !sharesEndpoint(a1, a2, b1)) ||
      (onSegment(a1, a2, b2) && !sharesEndpoint(a1, a2, b2)) ||
      (onSegment(b1, b2, a1) && !sharesEndpoint(b1, b2, a1)) ||
      (onSegment(b1, b2, a2) && !sharesEndpoint(b1, b2, a2))
    );
  }

  const t = cross(sub(b1, a1), d2) / denominator;
  const u = cross(sub(b1, a1), d1) / denominator;

  // Strict interior crossing on both segments.
  return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON;
}

function sharesEndpoint(a1: Vec2, a2: Vec2, p: Vec2): boolean {
  return (
    (Math.abs(a1.x - p.x) < EPSILON && Math.abs(a1.z - p.z) < EPSILON) ||
    (Math.abs(a2.x - p.x) < EPSILON && Math.abs(a2.z - p.z) < EPSILON)
  );
}

/**
 * True when any two non-adjacent edges of the closed polygon cross.
 *
 * Used to refuse closing a room that would produce degenerate wall geometry.
 * O(n²), which is irrelevant at the handful of vertices a room polygon has.
 */
export function selfIntersects(points: readonly Vec2[]): boolean {
  const n = points.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % n]!;

    for (let j = i + 1; j < n; j++) {
      // Skip the edge itself and its two neighbours, which legitimately share
      // endpoints. The (0, n-1) pair wraps around and is adjacent too.
      const adjacent = j === i || j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;

      const b1 = points[j]!;
      const b2 = points[(j + 1) % n]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** Ray-casting point-in-polygon test. Boundary results are not guaranteed. */
export function pointInPolygon(point: Vec2, points: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    const straddles = a.z > point.z !== b.z > point.z;
    if (!straddles) continue;
    const x = ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

/** Total centerline length of the closed loop, in meters. */
export function perimeter(points: readonly Vec2[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}
