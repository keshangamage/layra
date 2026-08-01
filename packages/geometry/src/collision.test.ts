import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import {
  convexArea,
  convexOverlap,
  expandRect,
  polygonContains,
  rectCorners,
  type Rect,
} from "./collision";
import { ensureCCW } from "./polygon";

function rect(x: number, z: number, w: number, d: number, rotationY = 0): Rect {
  return { center: { x, z }, w, d, rotationY };
}

const room: Vec2[] = ensureCCW([
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 5 },
  { x: 0, z: 5 },
]);

const lRoom: Vec2[] = ensureCCW([
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 2 },
  { x: 3, z: 2 },
  { x: 3, z: 6 },
  { x: 0, z: 6 },
]);

describe("rectCorners", () => {
  it("places an unrotated footprint around its centre", () => {
    const corners = rectCorners(rect(2, 3, 2, 1));
    const xs = corners.map((c) => c.x);
    const zs = corners.map((c) => c.z);
    expect(Math.min(...xs)).toBeCloseTo(1);
    expect(Math.max(...xs)).toBeCloseTo(3);
    expect(Math.min(...zs)).toBeCloseTo(2.5);
    expect(Math.max(...zs)).toBeCloseTo(3.5);
  });

  it("swaps extents at a quarter turn", () => {
    const corners = rectCorners(rect(0, 0, 2, 1, Math.PI / 2));
    const xs = corners.map((c) => c.x);
    const zs = corners.map((c) => c.z);
    expect(Math.max(...xs)).toBeCloseTo(0.5);
    expect(Math.max(...zs)).toBeCloseTo(1);
  });

  it("keeps its area under rotation", () => {
    for (const angle of [0, 0.3, Math.PI / 4, 1.9]) {
      expect(convexArea(rectCorners(rect(1, 1, 2, 1, angle)))).toBeCloseTo(2);
    }
  });

  it("always emits four corners", () => {
    expect(rectCorners(rect(0, 0, 1, 1, 0.7))).toHaveLength(4);
  });
});

describe("convexOverlap", () => {
  it("detects a clear overlap", () => {
    const a = rectCorners(rect(0, 0, 2, 2));
    const b = rectCorners(rect(1, 1, 2, 2));
    expect(convexOverlap(a, b)).toBe(true);
  });

  it("separates disjoint footprints", () => {
    const a = rectCorners(rect(0, 0, 2, 2));
    const b = rectCorners(rect(5, 0, 2, 2));
    expect(convexOverlap(a, b)).toBe(false);
  });

  it("treats flush edges as clear, not overlapping", () => {
    // Two 2m pieces exactly touching; furniture pushed against furniture is fine.
    const a = rectCorners(rect(0, 0, 2, 2));
    const b = rectCorners(rect(2, 0, 2, 2));
    expect(convexOverlap(a, b)).toBe(false);
  });

  it("catches an overlap only a rotated axis reveals", () => {
    // Axis-aligned bounds intersect, but the rotated diamond truly overlaps.
    const a = rectCorners(rect(0, 0, 2, 2));
    const b = rectCorners(rect(1.3, 1.3, 2, 2, Math.PI / 4));
    expect(convexOverlap(a, b)).toBe(true);
  });

  it("separates rotated pieces that only look close", () => {
    const a = rectCorners(rect(0, 0, 2, 0.5));
    const b = rectCorners(rect(0, 2, 2, 0.5, Math.PI / 4));
    expect(convexOverlap(a, b)).toBe(false);
  });

  it("is symmetric", () => {
    const a = rectCorners(rect(0, 0, 2, 1, 0.4));
    const b = rectCorners(rect(1, 0.5, 2, 1, 1.1));
    expect(convexOverlap(a, b)).toBe(convexOverlap(b, a));
  });

  it("detects full containment", () => {
    const outer = rectCorners(rect(0, 0, 4, 4));
    const inner = rectCorners(rect(0, 0, 1, 1));
    expect(convexOverlap(outer, inner)).toBe(true);
  });

  it("ignores degenerate input", () => {
    expect(convexOverlap([], rectCorners(rect(0, 0, 1, 1)))).toBe(false);
  });
});

describe("expandRect", () => {
  const none = { front: 0, sides: 0, back: 0 };

  it("is a no-op with zero clearance", () => {
    const base = rect(2, 3, 2, 1, 0.4);
    expect(expandRect(base, none)).toEqual(base);
  });

  it("widens symmetrically for side clearance", () => {
    const grown = expandRect(rect(0, 0, 2, 1), { ...none, sides: 0.25 });
    expect(grown.w).toBeCloseTo(2.5);
    expect(grown.center).toEqual({ x: 0, z: 0 });
  });

  it("extends toward -Z for front clearance and shifts the centre", () => {
    // A sofa with 0.7m in front and nothing behind keeps its back edge put.
    const grown = expandRect(rect(0, 0, 2, 1), { ...none, front: 0.7 });
    expect(grown.d).toBeCloseTo(1.7);
    expect(grown.center.z).toBeCloseTo(-0.35);

    const zs = rectCorners(grown).map((c) => c.z);
    expect(Math.min(...zs)).toBeCloseTo(-1.2);
    expect(Math.max(...zs)).toBeCloseTo(0.5);
  });

  it("extends toward +Z for back clearance", () => {
    const grown = expandRect(rect(0, 0, 2, 1), { ...none, back: 0.4 });
    const zs = rectCorners(grown).map((c) => c.z);
    expect(Math.min(...zs)).toBeCloseTo(-0.5);
    expect(Math.max(...zs)).toBeCloseTo(0.9);
  });

  it("leaves the centre alone when front and back match", () => {
    const grown = expandRect(rect(1, 1, 2, 1), { front: 0.3, sides: 0, back: 0.3 });
    expect(grown.center.x).toBeCloseTo(1);
    expect(grown.center.z).toBeCloseTo(1);
    expect(grown.d).toBeCloseTo(1.6);
  });

  it("follows the piece's rotation", () => {
    // Turned a quarter turn, front clearance now runs along -X.
    const grown = expandRect(rect(0, 0, 2, 1, Math.PI / 2), { ...none, front: 0.7 });
    const xs = rectCorners(grown).map((c) => c.x);
    expect(Math.min(...xs)).toBeCloseTo(-1.2);
    expect(Math.max(...xs)).toBeCloseTo(0.5);
  });

  it("keeps the footprint strictly inside when every side grows", () => {
    const base = rect(1, 2, 1.4, 0.7, 0.9);
    const grown = expandRect(base, { front: 0.8, sides: 0.1, back: 0.2 });
    expect(polygonContains(rectCorners(base), rectCorners(grown))).toBe(true);
  });

  it("shares an edge when a side has no clearance", () => {
    // Zero back clearance leaves the back edges collinear, which containment
    // reports as touching rather than inside. Clearance checks therefore test
    // for intrusion, never for containment.
    const base = rect(0, 0, 2, 1);
    const grown = expandRect(base, { front: 0.8, sides: 0.1, back: 0 });
    expect(polygonContains(rectCorners(base), rectCorners(grown))).toBe(false);
  });
});

describe("polygonContains", () => {
  it("accepts a footprint well inside the room", () => {
    expect(polygonContains(rectCorners(rect(3, 2.5, 2, 1)), room)).toBe(true);
  });

  it("rejects a footprint poking through a wall", () => {
    expect(polygonContains(rectCorners(rect(5.5, 2.5, 2, 1)), room)).toBe(false);
  });

  it("rejects a footprint entirely outside", () => {
    expect(polygonContains(rectCorners(rect(10, 10, 1, 1)), room)).toBe(false);
  });

  it("accounts for rotation", () => {
    // Fits lengthwise but not once turned across the narrow direction.
    expect(polygonContains(rectCorners(rect(3, 0.6, 4, 1)), room)).toBe(true);
    expect(polygonContains(rectCorners(rect(3, 0.6, 4, 1, Math.PI / 2)), room)).toBe(
      false,
    );
  });

  it("rejects a piece bridging a concave notch with every corner inside", () => {
    // The regression a corners-only test misses: all four corners land in the
    // L-shape, but an edge still cuts across the missing arm.
    const bridging = rectCorners(rect(3.2, 3, 5.6, 0.4, Math.PI / 4));
    expect(polygonContains(bridging, lRoom)).toBe(false);
  });

  it("accepts a piece inside one arm of the L", () => {
    expect(polygonContains(rectCorners(rect(1.4, 4, 2, 1)), lRoom)).toBe(true);
  });

  it("rejects empty input", () => {
    expect(polygonContains([], room)).toBe(false);
    expect(polygonContains(rectCorners(rect(0, 0, 1, 1)), [])).toBe(false);
  });
});
