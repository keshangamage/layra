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

/**
 * Cap on how far a mitre vertex may travel from its original corner, as a
 * multiple of the offset distance.
 *
 * Without it, the mitre point of a very sharp corner shoots toward infinity as
 * the interior angle approaches zero.
 */
export const DEFAULT_MITRE_LIMIT = 4;

export interface OffsetOptions {
  mitreLimit?: number;
}

/**
 * Offsets a closed polygon by `distance`, mitring at every corner.
 *
 * Positive `distance` moves along the left normal, which for CCW input (see
 * `ensureCCW`) means *into* the room. Negative moves outward. The result always
 * has the same vertex count as the input, so vertex `i` of the offset loop
 * still corresponds to vertex `i` of the original.
 *
 * Each offset vertex is the intersection of the two adjacent offset edge lines.
 * Two cases need care:
 * - **Collinear neighbours**: the offset lines are parallel and never meet, so
 *   fall back to the plainly offset corner point.
 * - **Sharp corners**: the intersection is valid but arbitrarily far away, so
 *   clamp it to `mitreLimit * |distance|`.
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

  // Direction and left normal of edge i, running from vertex i to vertex i+1.
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

    // The corner as displaced by the current edge alone — also the fallback.
    const plainOffset = add(corner, scale(normalCurr, distance));

    // Degenerate edge (repeated vertex) or collinear neighbours: no unique
    // intersection exists, so take the plain offset.
    const turn = cross(dirPrev, dirCurr);
    const degenerate =
      length(dirPrev) < EPSILON || length(dirCurr) < EPSILON;

    if (degenerate || Math.abs(turn) < EPSILON) {
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

/**
 * Inner and outer wall faces for a centerline polygon of the given thickness.
 *
 * `inner` is the surface seen from inside the room; the floor is built from it
 * so the two meet without poking through each other.
 */
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
