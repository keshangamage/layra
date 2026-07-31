import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import { DEFAULT_MITRE_LIMIT, offsetPolygon, wallLoops } from "./offset";
import { ensureCCW, polygonArea } from "./polygon";
import { length, sub } from "./math";

/** 4×4 square centred on the origin, CCW in the (x, z) plane. */
const square: Vec2[] = ensureCCW([
  { x: -2, z: -2 },
  { x: 2, z: -2 },
  { x: 2, z: 2 },
  { x: -2, z: 2 },
]);

describe("offsetPolygon", () => {
  it("shrinks the square by exactly the offset on every side", () => {
    const inner = offsetPolygon(square, 0.1);
    for (const p of inner) {
      expect(Math.abs(p.x)).toBeCloseTo(1.9);
      expect(Math.abs(p.z)).toBeCloseTo(1.9);
    }
  });

  it("grows the square by exactly the offset on every side", () => {
    const outer = offsetPolygon(square, -0.1);
    for (const p of outer) {
      expect(Math.abs(p.x)).toBeCloseTo(2.1);
      expect(Math.abs(p.z)).toBeCloseTo(2.1);
    }
  });

  it("preserves vertex count and correspondence", () => {
    const inner = offsetPolygon(square, 0.1);
    expect(inner).toHaveLength(square.length);
    // Vertex i of the offset stays in the same quadrant as vertex i.
    for (let i = 0; i < square.length; i++) {
      expect(Math.sign(inner[i]!.x)).toBe(Math.sign(square[i]!.x));
      expect(Math.sign(inner[i]!.z)).toBe(Math.sign(square[i]!.z));
    }
  });

  it("offsets inward for positive distance on CCW input", () => {
    expect(polygonArea(offsetPolygon(square, 0.5))).toBeLessThan(polygonArea(square));
    expect(polygonArea(offsetPolygon(square, -0.5))).toBeGreaterThan(polygonArea(square));
  });

  it("returns the polygon unchanged for a zero offset", () => {
    const same = offsetPolygon(square, 0);
    for (let i = 0; i < square.length; i++) {
      expect(same[i]!.x).toBeCloseTo(square[i]!.x);
      expect(same[i]!.z).toBeCloseTo(square[i]!.z);
    }
  });

  it("mitres a 45° corner further out than a right angle", () => {
    // A shallower interior angle pushes the mitre point further from the corner.
    const diamond: Vec2[] = ensureCCW([
      { x: 0, z: -3 },
      { x: 1, z: 0 },
      { x: 0, z: 3 },
      { x: -1, z: 0 },
    ]);
    const offsetDiamond = offsetPolygon(diamond, -0.1);
    const squareOffset = offsetPolygon(square, -0.1);

    const sharpTravel = length(sub(offsetDiamond[0]!, diamond[0]!));
    const rightAngleTravel = length(sub(squareOffset[0]!, square[0]!));
    expect(sharpTravel).toBeGreaterThan(rightAngleTravel);
  });

  it("falls back to a plain offset on collinear neighbours instead of dividing by zero", () => {
    // The midpoint of the bottom edge is a redundant collinear vertex — the two
    // adjacent offset lines are parallel and never intersect.
    const withCollinear: Vec2[] = ensureCCW([
      { x: -2, z: -2 },
      { x: 0, z: -2 },
      { x: 2, z: -2 },
      { x: 2, z: 2 },
      { x: -2, z: 2 },
    ]);
    const offset = offsetPolygon(withCollinear, 0.1);
    expect(offset).toHaveLength(5);
    for (const p of offset) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
    }
    const collinearVertex = offset.find((p) => Math.abs(p.x) < 1e-6);
    expect(collinearVertex?.z).toBeCloseTo(-1.9);
  });

  it("clamps a sharp corner to the mitre limit", () => {
    // A sliver triangle: without clamping the apex mitre runs away to infinity.
    const sliver: Vec2[] = ensureCCW([
      { x: 0, z: 0 },
      { x: 20, z: 0.2 },
      { x: 20, z: -0.2 },
    ]);
    const distance = 0.1;
    const offset = offsetPolygon(sliver, -distance);

    for (let i = 0; i < sliver.length; i++) {
      const travelled = length(sub(offset[i]!, sliver[i]!));
      expect(travelled).toBeLessThanOrEqual(distance * DEFAULT_MITRE_LIMIT + 1e-9);
      expect(Number.isFinite(offset[i]!.x)).toBe(true);
    }
  });

  it("honours a custom mitre limit", () => {
    const sliver: Vec2[] = ensureCCW([
      { x: 0, z: 0 },
      { x: 20, z: 0.2 },
      { x: 20, z: -0.2 },
    ]);
    const tight = offsetPolygon(sliver, -0.1, { mitreLimit: 1 });
    for (let i = 0; i < sliver.length; i++) {
      expect(length(sub(tight[i]!, sliver[i]!))).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it("passes polygons with fewer than three vertices straight through", () => {
    expect(offsetPolygon([], 0.1)).toEqual([]);
    expect(offsetPolygon([{ x: 1, z: 1 }], 0.1)).toEqual([{ x: 1, z: 1 }]);
  });

  it("survives a repeated vertex without producing NaN", () => {
    const duplicated: Vec2[] = [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 4 },
    ];
    for (const p of offsetPolygon(duplicated, 0.1)) {
      expect(Number.isNaN(p.x)).toBe(false);
      expect(Number.isNaN(p.z)).toBe(false);
    }
  });
});

describe("wallLoops", () => {
  it("splits thickness evenly either side of the centerline", () => {
    const { inner, outer } = wallLoops(square, 0.2);
    for (const p of inner) expect(Math.abs(p.x)).toBeCloseTo(1.9);
    for (const p of outer) expect(Math.abs(p.x)).toBeCloseTo(2.1);
  });

  it("keeps the inner loop strictly inside the outer", () => {
    const { inner, outer } = wallLoops(square, 0.3);
    expect(polygonArea(inner)).toBeLessThan(polygonArea(outer));
  });
});
