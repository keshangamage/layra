import type { Vec2 } from "@layra/types";
import {
  EPSILON,
  add,
  cross,
  leftNormal,
  length,
  lineIntersection,
  normalize,
  scale,
  sub,
} from "./math";

/** Without a cap, a mitre point runs to infinity as a corner sharpens. */
export const DEFAULT_MITRE_LIMIT = 4;

export interface OffsetOptions {
  mitreLimit?: number;
}

/**
 * Offsets a closed polygon, mitring each corner. Positive distance moves inward
 * for CCW input. Vertex count is preserved, so index i still maps to index i.
 */
export function offsetPolygon(
  points: readonly Vec2[],
  distance: number,
  options: OffsetOptions = {},
): Vec2[] {
  const n = points.length;
  if (n < 3) return [...points];

  const mitreLimit = options.mitreLimit ?? DEFAULT_MITRE_LIMIT;
  const maxDisplacement = Math.abs(distance) * mitreLimit;

  const directions: Vec2[] = [];
  const normals: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const dir = normalize(sub(points[(i + 1) % n]!, points[i]!));
    directions.push(dir);
    normals.push(leftNormal(dir));
  }

  const result: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const corner = points[i]!;
    const prevIndex = (i - 1 + n) % n;
    const dirPrev = directions[prevIndex]!;
    const dirCurr = directions[i]!;
    const normalPrev = normals[prevIndex]!;
    const normalCurr = normals[i]!;

    const plainOffset = add(corner, scale(normalCurr, distance));

    // Collinear or repeated vertices give no unique intersection.
    const degenerate = length(dirPrev) < EPSILON || length(dirCurr) < EPSILON;
    if (degenerate || Math.abs(cross(dirPrev, dirCurr)) < EPSILON) {
      result.push(plainOffset);
      continue;
    }

    const mitre = lineIntersection(
      add(corner, scale(normalPrev, distance)),
      dirPrev,
      add(corner, scale(normalCurr, distance)),
      dirCurr,
    );
    if (mitre === null) {
      result.push(plainOffset);
      continue;
    }

    const displacement = sub(mitre, corner);
    const travelled = length(displacement);
    if (travelled > maxDisplacement && travelled > EPSILON) {
      result.push(add(corner, scale(normalize(displacement), maxDisplacement)));
      continue;
    }
    result.push(mitre);
  }

  return result;
}

/** The floor is built from `inner`, so the two meet without poking through. */
export function wallLoops(
  centerline: readonly Vec2[],
  thickness: number,
  options: OffsetOptions = {},
): { inner: Vec2[]; outer: Vec2[] } {
  const half = thickness / 2;
  return {
    inner: offsetPolygon(centerline, half, options),
    outer: offsetPolygon(centerline, -half, options),
  };
}
