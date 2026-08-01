import type { Vec2 } from "@layra/types";
import { EPSILON, distance, dot, sub } from "./math";
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
