import type { Vec2 } from "@layra/types";
import { add, distance, leftNormal, normalize, scale, sub } from "./math";
import { ensureCCW } from "./polygon";

export interface EdgeLabel {
  /** Midpoint of the edge, pushed outside the room by `offset`. */
  position: Vec2;
  /** Edge length in metres. */
  length: number;
  /** Rotation about Y that lays text along the edge, never upside down. */
  angle: number;
}

/**
 * Keeps text readable from above by flipping any edge that would render
 * back to front.
 */
function readableAngle(dx: number, dz: number): number {
  const angle = Math.atan2(dz, dx);
  if (angle > Math.PI / 2) return angle - Math.PI;
  if (angle < -Math.PI / 2) return angle + Math.PI;
  return angle;
}

/** One label per wall, placed just outside the room. */
export function edgeLabels(polygon: readonly Vec2[], offset = 0.35): EdgeLabel[] {
  if (polygon.length < 2) return [];

  const points = ensureCCW(polygon);
  const labels: EdgeLabel[] = [];

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const edge = sub(b, a);
    const length = distance(a, b);
    if (length < 1e-9) continue;

    // Left normal points inward for CCW, so negate to push the label out.
    const outward = scale(leftNormal(normalize(edge)), -offset);
    const midpoint = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };

    labels.push({
      position: add(midpoint, outward),
      length,
      angle: readableAngle(edge.x, edge.z),
    });
  }

  return labels;
}

/** Formats a length for display. Metres below 1km, two decimals. */
export function formatLength(metres: number): string {
  return `${metres.toFixed(2)} m`;
}

/** Formats an area for display. */
export function formatArea(squareMetres: number): string {
  return `${squareMetres.toFixed(2)} m²`;
}
