import type { Vec2 } from "@layra/types";
import { EPSILON, cross, sub } from "./math";

/**
 * Positive means CCW in the (x, z) plane — which looks clockwise from a
 * top-down camera, since +z points down the screen.
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

/** Offset and extrusion both assume CCW, so run this first. */
export function ensureCCW(points: readonly Vec2[]): Vec2[] {
  return isCCW(points) ? [...points] : [...points].reverse();
}

/** Assumes a, b, p are already collinear. */
function onSegment(a: Vec2, b: Vec2, p: Vec2): boolean {
  return (
    p.x <= Math.max(a.x, b.x) + EPSILON &&
    p.x >= Math.min(a.x, b.x) - EPSILON &&
    p.z <= Math.max(a.z, b.z) + EPSILON &&
    p.z >= Math.min(a.z, b.z) - EPSILON
  );
}

function sharesEndpoint(a1: Vec2, a2: Vec2, p: Vec2): boolean {
  return (
    (Math.abs(a1.x - p.x) < EPSILON && Math.abs(a1.z - p.z) < EPSILON) ||
    (Math.abs(a2.x - p.x) < EPSILON && Math.abs(a2.z - p.z) < EPSILON)
  );
}

/** Touching at a shared endpoint doesn't count — adjacent edges always do that. */
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
    // Parallel: only a collinear overlap counts.
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
  return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON;
}

/** Used to refuse closing a room that would extrude into garbage. */
export function selfIntersects(points: readonly Vec2[]): boolean {
  const n = points.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % n]!;

    for (let j = i + 1; j < n; j++) {
      // Skip neighbours; (0, n-1) wraps around and is adjacent too.
      if (j === i || j === i + 1 || (i === 0 && j === n - 1)) continue;

      const b1 = points[j]!;
      const b2 = points[(j + 1) % n]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

/** Ray casting. Boundary results are not guaranteed. */
export function pointInPolygon(point: Vec2, points: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (a.z > point.z === b.z > point.z) continue;
    const x = ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (point.x < x) inside = !inside;
  }
  return inside;
}

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

/** Axis-aligned bounds, used to frame the camera and shadow volume. */
export function bounds(points: readonly Vec2[]): {
  min: Vec2;
  max: Vec2;
  center: Vec2;
  size: Vec2;
} {
  if (points.length === 0) {
    const zero = { x: 0, z: 0 };
    return { min: zero, max: zero, center: zero, size: zero };
  }
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxZ = Math.max(maxZ, p.z);
  }
  return {
    min: { x: minX, z: minZ },
    max: { x: maxX, z: maxZ },
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    size: { x: maxX - minX, z: maxZ - minZ },
  };
}
