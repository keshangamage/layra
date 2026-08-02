import type { Vec2 } from "@layra/types";

export function snapToGrid(value: number, step: number): number {
  if (step <= 0) return value;
  // Round the product too: 12 * 0.1 is 1.2000000000000002 in binary floating
  // point, and that noise would otherwise land in every saved scene.
  return Math.round(Math.round(value / step) * step * 1e6) / 1e6;
}

export function snapPoint(point: Vec2, step: number): Vec2 {
  return { x: snapToGrid(point.x, step), z: snapToGrid(point.z, step) };
}

/**
 * Snaps direction to the nearest angle increment, then length to the grid.
 *
 * Order matters: snapping the point to the grid afterwards would knock the
 * angle back off its increment.
 */
export function snapFrom(
  origin: Vec2,
  target: Vec2,
  grid: number,
  angle: number,
): Vec2 {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-9) return { ...origin };

  const snappedAngle = angle > 0
    ? Math.round(Math.atan2(dz, dx) / angle) * angle
    : Math.atan2(dz, dx);
  const snappedLength = Math.max(snapToGrid(distance, grid), grid);

  return {
    x: origin.x + Math.cos(snappedAngle) * snappedLength,
    z: origin.z + Math.sin(snappedAngle) * snappedLength,
  };
}
