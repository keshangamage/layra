import type { Placement, Room } from "@layra/types";
import {
  convexOverlap,
  expandRect,
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
  /** Pieces whose clearance another piece intrudes into. Advisory, not a clash. */
  crowded: Set<string>;
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

/** Clearance zone of a placement, or null when it has no clearance at all. */
export function clearanceRect(placement: Placement): Rect | null {
  const item = findCatalogItem(placement.catalogItemId);
  const rect = placementRect(placement);
  if (!item || !rect) return null;
  const { front, sides, back } = item.clearance;
  if (front === 0 && sides === 0 && back === 0) return null;
  return expandRect(rect, item.clearance);
}

/**
 * Footprint overlaps and room containment. Containment uses the inner wall
 * face, since that is the usable floor.
 */
export function findCollisions(
  rooms: Room | readonly Room[],
  placements: readonly Placement[],
): CollisionReport {
  const all = Array.isArray(rooms) ? rooms : [rooms as Room];
  const overlapping = new Set<string>();
  const outOfRoom = new Set<string>();
  const crowded = new Set<string>();

  const entries = placements
    .map((placement) => ({
      placement,
      item: findCatalogItem(placement.catalogItemId),
      rect: placementRect(placement),
    }))
    .filter((entry) => entry.item && entry.rect)
    .map((entry) => ({
      id: entry.placement.id,
      wallMounted: entry.item!.wallMounted,
      corners: rectCorners(entry.rect!),
      clearance: clearanceRect(entry.placement),
    }));

  // A piece is inside the plan if any room contains it, so furniture in a
  // second room is not reported as out of bounds.
  const innerLoops = all
    .filter((room) => room.polygon.length >= 3)
    .map((room) => wallLoops(room.polygon, room.walls[0]?.thickness ?? 0).inner);

  for (const entry of entries) {
    // Wall-mounted pieces sit in the wall, so containment does not apply.
    if (entry.wallMounted || innerLoops.length === 0) continue;
    const housed = innerLoops.some((inner) => polygonContains(entry.corners, inner));
    if (!housed) outOfRoom.add(entry.id);
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

  // Crowding is directional: a chair in a sofa's walkway is the sofa's
  // problem, not the chair's, so only the owner of the zone is flagged.
  for (const owner of entries) {
    if (!owner.clearance || owner.wallMounted) continue;
    const zone = rectCorners(owner.clearance);
    for (const other of entries) {
      if (other.id === owner.id || other.wallMounted) continue;
      if (convexOverlap(zone, other.corners)) {
        crowded.add(owner.id);
        break;
      }
    }
  }

  return { overlapping, outOfRoom, crowded };
}

/**
 * Placements whose footprint sits inside a room.
 *
 * Ownership is derived from geometry rather than stored on the placement, so
 * dragging a piece from one room to another needs no bookkeeping.
 */
export function placementsInRoom(
  room: Room,
  placements: readonly Placement[],
): Placement[] {
  if (room.polygon.length < 3) return [];
  const { inner } = wallLoops(room.polygon, room.walls[0]?.thickness ?? 0);

  return placements.filter((placement) => {
    const rect = placementRect(placement);
    return rect ? polygonContains(rectCorners(rect), inner) : false;
  });
}
