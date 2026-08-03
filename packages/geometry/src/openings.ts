import type { Vec2 } from "@layra/types";
import { EPSILON, distance, dot, leftNormal, sub } from "./math";
import { ensureCCW } from "./polygon";

/** Where a point lands along the nearest wall of a room. */
export interface WallStation {
  /** Index into the centerline polygon, matching Room.walls. */
  index: number;
  /** Distance along that wall from its start, in metres. */
  offset: number;
  /** How far the point was from the wall. */
  distance: number;
  /** Length of that wall. */
  wallLength: number;
}

/** Maps a clicked point onto the closest wall, for placing an opening. */
export function nearestWallStation(
  polygon: readonly Vec2[],
  point: Vec2,
): WallStation | null {
  if (polygon.length < 3) return null;
  const points = ensureCCW(polygon);

  let best: WallStation | null = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const edge = sub(b, a);
    const lengthSquared = dot(edge, edge);
    if (lengthSquared < EPSILON) continue;

    // Clamped projection, so a click past the end lands on the corner.
    const t = Math.min(1, Math.max(0, dot(sub(point, a), edge) / lengthSquared));
    const foot = { x: a.x + edge.x * t, z: a.z + edge.z * t };
    const away = distance(point, foot);

    if (!best || away < best.distance) {
      const wallLength = Math.sqrt(lengthSquared);
      best = { index: i, offset: t * wallLength, distance: away, wallLength };
    }
  }
  return best;
}

/** A rectangular hole in one wall segment, measured along its centerline. */
export interface WallOpening {
  /** Distance from the segment's start, in metres. */
  offset: number;
  width: number;
  height: number;
  /** Height from the floor to the bottom edge. Doors use 0. */
  sillHeight: number;
}

/** An opening resolved to its span along the wall and up it. */
export interface OpeningSpan {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Drops openings a wall cannot hold and sorts what is left.
 *
 * Anything that runs past either end of the segment, pokes through the top, or
 * has no area is discarded rather than clamped - silently resizing a door is
 * worse than not cutting it.
 */
export function resolveOpenings(
  openings: readonly WallOpening[],
  wallLength: number,
  wallHeight: number,
): OpeningSpan[] {
  const spans: OpeningSpan[] = [];

  for (const opening of openings) {
    const u0 = opening.offset;
    const u1 = opening.offset + opening.width;
    const v0 = opening.sillHeight;
    const v1 = opening.sillHeight + opening.height;

    if (opening.width <= EPSILON || opening.height <= EPSILON) continue;
    if (u0 < -EPSILON || u1 > wallLength + EPSILON) continue;
    if (v0 < -EPSILON || v1 > wallHeight + EPSILON) continue;

    spans.push({ u0, u1, v0, v1 });
  }

  spans.sort((a, b) => a.u0 - b.u0);

  // Overlapping openings would produce self-intersecting panels, so keep the
  // first of any overlapping pair.
  const kept: OpeningSpan[] = [];
  for (const span of spans) {
    const previous = kept.at(-1);
    if (previous && span.u0 < previous.u1 - EPSILON) continue;
    kept.push(span);
  }
  return kept;
}

/** An opening's footprint in plan, for drawing it on a floor plan. */
export interface OpeningFootprint {
  /** The four corners of the gap, spanning the wall thickness. */
  gap: Vec2[];
  /** Inner-face corner at the opening's start, where a door hinges. */
  hinge: Vec2;
  /** Unit vector along the wall, from start to end. */
  along: Vec2;
  /** Unit vector pointing into the room. */
  inward: Vec2;
}

/**
 * Where an opening sits in plan. Measured from the wall centerline, so the gap
 * spans the full thickness either side.
 */
export function openingFootprint(
  wallStart: Vec2,
  wallEnd: Vec2,
  opening: { offset: number; width: number },
  thickness: number,
): OpeningFootprint | null {
  const edge = sub(wallEnd, wallStart);
  const length = Math.hypot(edge.x, edge.z);
  if (length < EPSILON) return null;

  const along = { x: edge.x / length, z: edge.z / length };
  const inward = leftNormal(along);
  const half = thickness / 2;

  const at = (u: number) => ({
    x: wallStart.x + along.x * u,
    z: wallStart.z + along.z * u,
  });
  const start = at(opening.offset);
  const end = at(opening.offset + opening.width);
  const shift = (p: Vec2, s: number) => ({
    x: p.x + inward.x * s,
    z: p.z + inward.z * s,
  });

  return {
    gap: [shift(start, half), shift(end, half), shift(end, -half), shift(start, -half)],
    hinge: shift(start, half),
    along,
    inward,
  };
}

/** Rectangle of wall face left solid around the openings. */
export interface Panel {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/**
 * Splits a wall face into the solid rectangles around its openings: full-height
 * strips between them, plus the pieces above and below each one.
 */
export function facePanels(
  spans: readonly OpeningSpan[],
  wallLength: number,
  wallHeight: number,
): Panel[] {
  if (spans.length === 0) {
    return [{ u0: 0, u1: wallLength, v0: 0, v1: wallHeight }];
  }

  const panels: Panel[] = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.u0 - cursor > EPSILON) {
      panels.push({ u0: cursor, u1: span.u0, v0: 0, v1: wallHeight });
    }
    if (span.v0 > EPSILON) {
      panels.push({ u0: span.u0, u1: span.u1, v0: 0, v1: span.v0 });
    }
    if (wallHeight - span.v1 > EPSILON) {
      panels.push({ u0: span.u0, u1: span.u1, v0: span.v1, v1: wallHeight });
    }
    cursor = span.u1;
  }

  if (wallLength - cursor > EPSILON) {
    panels.push({ u0: cursor, u1: wallLength, v0: 0, v1: wallHeight });
  }

  return panels;
}

/** Where an opening sits in 3D, for rendering a panel in the hole. */
export interface OpeningTransform {
  /** Centre of the opening, at mid height. */
  position: { x: number; y: number; z: number };
  /** Rotation about Y that lays a panel flat in the wall. */
  rotationY: number;
  width: number;
  height: number;
}

export function openingTransform(
  wallStart: Vec2,
  wallEnd: Vec2,
  opening: { offset: number; width: number; height: number; sillHeight: number },
): OpeningTransform | null {
  const edge = sub(wallEnd, wallStart);
  const length = Math.hypot(edge.x, edge.z);
  if (length < EPSILON) return null;

  const along = { x: edge.x / length, z: edge.z / length };
  const centre = opening.offset + opening.width / 2;

  return {
    position: {
      x: wallStart.x + along.x * centre,
      y: opening.sillHeight + opening.height / 2,
      z: wallStart.z + along.z * centre,
    },
    // A panel's normal is its local +Z; aim it across the wall, not along it.
    rotationY: Math.atan2(-along.z, along.x),
    width: opening.width,
    height: opening.height,
  };
}
