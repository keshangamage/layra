import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import {
  bounds,
  ensureCCW,
  isCCW,
  perimeter,
  pointInPolygon,
  polygonArea,
  selfIntersects,
  signedArea,
} from "./polygon";

const unitSquare: Vec2[] = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 1, z: 1 },
  { x: 0, z: 1 },
];

const lShape: Vec2[] = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 2 },
  { x: 2, z: 2 },
  { x: 2, z: 4 },
  { x: 0, z: 4 },
];

describe("signedArea / polygonArea", () => {
  it("measures a unit square as 1", () => {
    expect(polygonArea(unitSquare)).toBeCloseTo(1);
  });

  it("measures a 3-4-5 right triangle as 6", () => {
    expect(
      polygonArea([
        { x: 0, z: 0 },
        { x: 3, z: 0 },
        { x: 0, z: 4 },
      ]),
    ).toBeCloseTo(6);
  });

  it("flips sign with winding but keeps magnitude", () => {
    expect(signedArea(unitSquare)).toBeCloseTo(1);
    expect(signedArea([...unitSquare].reverse())).toBeCloseTo(-1);
  });

  it("is invariant under translation", () => {
    const moved = unitSquare.map((p) => ({ x: p.x + 137.5, z: p.z - 42.25 }));
    expect(polygonArea(moved)).toBeCloseTo(1);
  });

  it("scales with the square of a uniform scale factor", () => {
    const scaled = unitSquare.map((p) => ({ x: p.x * 3, z: p.z * 3 }));
    expect(polygonArea(scaled)).toBeCloseTo(9);
  });

  it("returns zero for degenerate input", () => {
    expect(signedArea([])).toBe(0);
    expect(signedArea([{ x: 1, z: 1 }])).toBe(0);
    expect(signedArea([{ x: 0, z: 0 }, { x: 1, z: 1 }])).toBe(0);
  });
});

describe("ensureCCW", () => {
  it("leaves an already-CCW polygon in order", () => {
    expect(ensureCCW(unitSquare)).toEqual(unitSquare);
  });

  it("reverses a clockwise polygon", () => {
    const clockwise = [...unitSquare].reverse();
    expect(isCCW(clockwise)).toBe(false);
    expect(isCCW(ensureCCW(clockwise))).toBe(true);
  });

  it("does not mutate its input", () => {
    const clockwise = [...unitSquare].reverse();
    const snapshot = [...clockwise];
    ensureCCW(clockwise);
    expect(clockwise).toEqual(snapshot);
  });
});

describe("selfIntersects", () => {
  it("accepts a simple square", () => {
    expect(selfIntersects(unitSquare)).toBe(false);
  });

  it("does not flag the shared closing vertex", () => {
    expect(
      selfIntersects([
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 2, z: 3 },
      ]),
    ).toBe(false);
  });

  it("detects a bowtie", () => {
    expect(
      selfIntersects([
        { x: 0, z: 0 },
        { x: 2, z: 2 },
        { x: 2, z: 0 },
        { x: 0, z: 2 },
      ]),
    ).toBe(true);
  });

  it("detects a crossing in a larger polygon", () => {
    expect(
      selfIntersects([
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 4 },
        { x: 2, z: -2 },
        { x: 0, z: 4 },
      ]),
    ).toBe(true);
  });

  it("accepts a concave but simple L-shape", () => {
    expect(selfIntersects(lShape)).toBe(false);
  });

  it("cannot self-intersect below four vertices", () => {
    expect(selfIntersects([])).toBe(false);
    expect(selfIntersects(unitSquare.slice(0, 3))).toBe(false);
  });
});

describe("pointInPolygon", () => {
  it("distinguishes inside from outside", () => {
    expect(pointInPolygon({ x: 0.5, z: 0.5 }, unitSquare)).toBe(true);
    expect(pointInPolygon({ x: 1.5, z: 0.5 }, unitSquare)).toBe(false);
    expect(pointInPolygon({ x: -0.5, z: -0.5 }, unitSquare)).toBe(false);
  });

  it("handles the concave notch of an L-shape", () => {
    expect(pointInPolygon({ x: 1, z: 3 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 3, z: 3 }, lShape)).toBe(false);
  });
});

describe("perimeter", () => {
  it("includes the wrap-around edge", () => {
    expect(perimeter(unitSquare)).toBeCloseTo(4);
  });

  it("is zero for degenerate input", () => {
    expect(perimeter([])).toBe(0);
    expect(perimeter([{ x: 1, z: 1 }])).toBe(0);
  });
});

describe("bounds", () => {
  it("measures extent, center and size", () => {
    const b = bounds(lShape);
    expect(b.min).toEqual({ x: 0, z: 0 });
    expect(b.max).toEqual({ x: 4, z: 4 });
    expect(b.center).toEqual({ x: 2, z: 2 });
    expect(b.size).toEqual({ x: 4, z: 4 });
  });

  it("returns zeroes for an empty polygon", () => {
    expect(bounds([]).size).toEqual({ x: 0, z: 0 });
  });
});
