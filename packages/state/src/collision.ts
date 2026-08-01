import type { Placement, Room } from "@layra/types";
import {
  convexOverlap,
  polygonContains,
  rectCorners,
  wallLoops,
  type Rect,
} from "@layra/geometry";
import { findCatalogItem } from "./catalog";

export interface CollisionReport {
  /** Pieces whose footprints intersect another piece. */
  overlapping: Set<string>;
  /** Pieces not fully inside the inner wall face. */
  outOfRoom: Set<string>;
}

export function placementRect(placement: Placement): Rect | null {
  const item = findCatalogItem(placement.catalogItemId);
  if (!item) return null;
  return {
    center: { x: placement.position.x, z: placement.position.z },
    w: item.footprint.w,
    d: item.footprint.d,
    rotationY: placement.rotationY,
  };
}

export function isBlocked(report: CollisionReport, id: string): boolean {
  return report.overlapping.has(id) || report.outOfRoom.has(id);
}

/**
 * Footprint overlaps and room containment. Containment uses the inner wall
 * face, since that is the usable floor.
 */
export function findCollisions(
  room: Room,
  placements: readonly Placement[],
): CollisionReport {
  const overlapping = new Set<string>();
  const outOfRoom = new Set<string>();

  const entries = placements
    .map((placement) => ({
      placement,
      item: findCatalogItem(placement.catalogItemId),
      corners: placementRect(placement),
    }))
    .filter((entry) => entry.item && entry.corners)
    .map((entry) => ({
      id: entry.placement.id,
      wallMounted: entry.item!.wallMounted,
      corners: rectCorners(entry.corners!),
    }));

  const thickness = room.walls[0]?.thickness ?? 0;
  const inner =
    room.polygon.length >= 3 ? wallLoops(room.polygon, thickness).inner : [];

  for (const entry of entries) {
    // Wall-mounted pieces sit in the wall, so containment does not apply.
    if (entry.wallMounted || inner.length < 3) continue;
    if (!polygonContains(entry.corners, inner)) outOfRoom.add(entry.id);
  }

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      // Wall pieces hang above the floor, so they never fight for it.
      if (a.wallMounted || b.wallMounted) continue;
      if (convexOverlap(a.corners, b.corners)) {
        overlapping.add(a.id);
        overlapping.add(b.id);
      }
    }
  }

  return { overlapping, outOfRoom };
}
