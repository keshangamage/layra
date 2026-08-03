/**
 * Distance a perspective camera needs to fit a ground-plane box in view.
 *
 * Checks both axes: a wide room is limited by horizontal field of view, a deep
 * one by vertical, and which of the two binds depends on the viewport aspect.
 */
export function fitDistance(
  size: { x: number; z: number },
  fovDegrees: number,
  aspect: number,
  padding = 1.25,
): number {
  const radius = Math.hypot(Math.max(size.x, 0), Math.max(size.z, 0)) / 2;
  if (radius <= 0) return 1;

  const vertical = (fovDegrees * Math.PI) / 180;
  const halfV = Math.tan(vertical / 2);
  const halfH = halfV * Math.max(aspect, 0.01);

  return (radius * padding) / Math.min(halfV, halfH);
}
