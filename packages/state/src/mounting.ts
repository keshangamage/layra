import type { CatalogItem, Room, Vec2, Vec3 } from "@layra/types";
import { ensureCCW, nearestWallStation } from "@layra/geometry";

export interface Mounted {
  position: Vec3;
  rotationY: number;
}

/** Default underside height when a catalog item does not state one. */
export const DEFAULT_MOUNT_HEIGHT = 1.4;

/** How close a piece's back must come to a wall before it snaps flat. */
export const WALL_SNAP_DISTANCE = 0.45;

/**
 * Places a wall-mounted item flat against the nearest wall.
 *
 * Sits on the inner face rather than the centerline, so it hangs on the wall
 * instead of being buried in it, and faces into the room.
 */
export function mountToWall(
  room: Room,
  point: Vec2,
  item: CatalogItem,
  y?: number,
): Mounted | null {
  const station = nearestWallStation(room.polygon, point);
  if (!station) return null;

  const points = ensureCCW(room.polygon);
  const start = points[station.index];
  const end = points[(station.index + 1) % points.length];
  if (!start || !end) return null;

  const length = station.wallLength;
  if (length < 1e-9) return null;

  // Everything is measured along the centerline, including station.offset.
  // Mixing in the inner loop would shift the piece by the wall thickness,
  // because the two loops start at different points.
  const direction = { x: (end.x - start.x) / length, z: (end.z - start.z) / length };
  const inward = { x: -direction.z, z: direction.x };

  // Keep the piece fully on the wall it was dropped against.
  const half = item.footprint.w / 2;
  const along = Math.min(Math.max(station.offset, half), Math.max(length - half, half));

  // Back flat against the inner face, not straddling the centerline.
  const thickness = room.walls[0]?.thickness ?? 0;
  const standoff = thickness / 2 + item.footprint.d / 2;

  return {
    position: {
      x: start.x + direction.x * along + inward.x * standoff,
      y: y ?? item.mountHeight ?? DEFAULT_MOUNT_HEIGHT,
      z: start.z + direction.z * along + inward.z * standoff,
    },
    // A piece's front is -Z locally; aim it along the inward normal.
    rotationY: Math.atan2(-inward.x, -inward.z),
  };
}

/**
 * Aligns a floor piece flat against a wall when its back comes close enough.
 *
 * Returns null when the piece is out in the room, so dragging only snaps near
 * a wall rather than dragging everything to the edges.
 */
export function snapFloorToWall(
  room: Room,
  point: Vec2,
  item: CatalogItem,
  distance = WALL_SNAP_DISTANCE,
): Mounted | null {
  const station = nearestWallStation(room.polygon, point);
  if (!station) return null;

  const thickness = room.walls[0]?.thickness ?? 0;
  // Measured from the piece's back edge, not its centre, so wide and narrow
  // pieces snap at the same visual gap.
  const gap = station.distance - thickness / 2 - item.footprint.d / 2;
  if (gap > distance) return null;

  return mountToWall(room, point, item, 0);
}
