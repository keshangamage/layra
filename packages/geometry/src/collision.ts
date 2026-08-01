import type { Vec2 } from "@layra/types";
import { EPSILON, cross, dot, leftNormal, normalize, sub } from "./math";
import { pointInPolygon, segmentsIntersect } from "./polygon";

/** An oriented footprint on the ground plane. */
export interface Rect {
  center: Vec2;
  w: number;
  d: number;
  rotationY: number;
}

/**
 * Corners in CCW order. Uses the same Y rotation as three.js so the collision
 * box lines up with the rendered mesh.
 */
export function rectCorners(rect: Rect): Vec2[] {
  const c = Math.cos(rect.rotationY);
  const s = Math.sin(rect.rotationY);
  const hw = rect.w / 2;
  const hd = rect.d / 2;

  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, z]) => ({
    x: rect.center.x + c * x! + s * z!,
    z: rect.center.z - s * x! + c * z!,
  }));
}

function project(points: readonly Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const value = dot(point, axis);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function edgeAxes(points: readonly Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < points.length; i++) {
    const edge = sub(points[(i + 1) % points.length]!, points[i]!);
    if (Math.abs(edge.x) < EPSILON && Math.abs(edge.z) < EPSILON) continue;
    axes.push(normalize(leftNormal(edge)));
  }
  return axes;
}

/**
 * Separating axis test for two convex polygons.
 *
 * Pieces sitting flush against each other share an edge, so a separation of
 * zero counts as clear rather than overlapping.
 */
export function convexOverlap(a: readonly Vec2[], b: readonly Vec2[]): boolean {
  if (a.length < 3 || b.length < 3) return false;

  for (const axis of [...edgeAxes(a), ...edgeAxes(b)]) {
    const pa = project(a, axis);
    const pb = project(b, axis);
    if (pa.max - pb.min <= EPSILON || pb.max - pa.min <= EPSILON) return false;
  }
  return true;
}

/**
 * True when `inner` lies entirely within `outer`, which may be concave.
 *
 * Corner containment alone is not enough: a rectangle can bridge a concave
 * notch with every corner inside while an edge still cuts through a wall.
 */
export function polygonContains(
  inner: readonly Vec2[],
  outer: readonly Vec2[],
): boolean {
  if (inner.length === 0 || outer.length < 3) return false;

  for (const point of inner) {
    if (!pointInPolygon(point, outer)) return false;
  }

  for (let i = 0; i < inner.length; i++) {
    const a1 = inner[i]!;
    const a2 = inner[(i + 1) % inner.length]!;
    for (let j = 0; j < outer.length; j++) {
      const b1 = outer[j]!;
      const b2 = outer[(j + 1) % outer.length]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

export interface Clearance {
  front: number;
  sides: number;
  back: number;
}

/**
 * Grows a footprint by its per-side clearance. Front is -Z in local axes, so
 * uneven front and back shift the centre as well as widening the box.
 */
export function expandRect(rect: Rect, clearance: Clearance): Rect {
  const shift = (clearance.back - clearance.front) / 2;
  return {
    center: {
      x: rect.center.x + Math.sin(rect.rotationY) * shift,
      z: rect.center.z + Math.cos(rect.rotationY) * shift,
    },
    w: rect.w + clearance.sides * 2,
    d: rect.d + clearance.front + clearance.back,
    rotationY: rect.rotationY,
  };
}

/** Area of a convex polygon, used to size overlap severity. */
export function convexArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += cross(points[i]!, points[(i + 1) % points.length]!);
  }
  return Math.abs(sum) / 2;
}
