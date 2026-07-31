import type { Vec2 } from "@layra/types";

/**
 * Tolerance for treating a quantity as zero. Chosen well below the 0.1 m grid
 * snap so snapped input never lands inside the epsilon band by accident.
 */
export const EPSILON = 1e-9;

export function vec2(x: number, z: number): Vec2 {
  return { x, z };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, z: a.z - b.z };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, z: a.z * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z;
}

/** 2D cross product (the z-component of the 3D cross of the lifted vectors). */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.z - a.z * b.x;
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.z);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Returns the zero vector when the input is degenerate rather than producing NaN. */
export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  if (len < EPSILON) return { x: 0, z: 0 };
  return { x: a.x / len, z: a.z / len };
}

/**
 * Left-hand normal of a direction in the (x, z) plane.
 *
 * For a polygon normalized to CCW winding by `ensureCCW`, this points into the
 * room interior. Every offset sign in this package depends on that.
 */
export function leftNormal(dir: Vec2): Vec2 {
  return { x: -dir.z, z: dir.x };
}

export function equals(a: Vec2, b: Vec2, tolerance = EPSILON): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.z - b.z) <= tolerance;
}

/**
 * Intersection of two infinite lines, each given as a point and a direction.
 * Returns `null` when the directions are parallel or either is degenerate.
 */
export function lineIntersection(
  p1: Vec2,
  d1: Vec2,
  p2: Vec2,
  d2: Vec2,
): Vec2 | null {
  const denominator = cross(d1, d2);
  if (Math.abs(denominator) < EPSILON) return null;
  const t = cross(sub(p2, p1), d2) / denominator;
  return add(p1, scale(d1, t));
}
