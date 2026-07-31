import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import {
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

describe("signedArea / polygonArea", () => {
  it("measures a unit square as 1", () => {
    expect(polygonArea(unitSquare)).toBeCloseTo(1);
  });

  it("measures a 3-4-5 right triangle as 6", () => {
    const triangle: Vec2[] = [
      { x: 0, z: 0 },
      { x: 3, z: 0 },
      { x: 0, z: 4 },
    ];
    expect(polygonArea(triangle)).toBeCloseTo(6);
  });

  it("flips sign with winding but keeps magnitude", () => {
    const forward = signedArea(unitSquare);
    const reversed = signedArea([...unitSquare].reverse());
    expect(forward).toBeCloseTo(1);
    expect(reversed).toBeCloseTo(-1);
    expect(polygonArea(unitSquare)).toBeCloseTo(polygonArea([...unitSquare].reverse()));
  });

  it("is invariant under translation", () => {
    const moved = unitSquare.map((p) => ({ x: p.x + 137.5, z: p.z - 42.25 }));
    expect(polygonArea(moved)).toBeCloseTo(polygonArea(unitSquare));
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
    expect(isCCW(ensureCCW(unitSquare))).toBe(true);
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

  it("does not treat the shared closing vertex as an intersection", () => {
    // The wrap-around edge (last → first) is adjacent to the first edge and
    // shares a vertex with it. A naive pairwise test reports this as a crossing.
    const triangle: Vec2[] = [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 2, z: 3 },
    ];
    expect(selfIntersects(triangle)).toBe(false);
  });

  it("detects a bowtie", () => {
    const bowtie: Vec2[] = [
      { x: 0, z: 0 },
      { x: 2, z: 2 },
      { x: 2, z: 0 },
      { x: 0, z: 2 },
    ];
    expect(selfIntersects(bowtie)).toBe(true);
  });

  it("detects a crossing in a larger polygon", () => {
    const crossed: Vec2[] = [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 4 },
      { x: 2, z: -2 },
      { x: 0, z: 4 },
    ];
    expect(selfIntersects(crossed)).toBe(true);
  });

  it("accepts a concave but simple L-shape", () => {
    const lShape: Vec2[] = [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 2 },
      { x: 2, z: 2 },
      { x: 2, z: 4 },
      { x: 0, z: 4 },
    ];
    expect(selfIntersects(lShape)).toBe(false);
  });

  it("cannot self-intersect below four vertices", () => {
    expect(selfIntersects([])).toBe(false);
    expect(selfIntersects([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }])).toBe(false);
  });
});

describe("pointInPolygon", () => {
  it("distinguishes inside from outside", () => {
    expect(pointInPolygon({ x: 0.5, z: 0.5 }, unitSquare)).toBe(true);
    expect(pointInPolygon({ x: 1.5, z: 0.5 }, unitSquare)).toBe(false);
    expect(pointInPolygon({ x: -0.5, z: -0.5 }, unitSquare)).toBe(false);
  });

  it("handles the concave notch of an L-shape", () => {
    const lShape: Vec2[] = [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 2 },
      { x: 2, z: 2 },
      { x: 2, z: 4 },
      { x: 0, z: 4 },
    ];
    expect(pointInPolygon({ x: 1, z: 3 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 3, z: 3 }, lShape)).toBe(false);
  });
});

describe("perimeter", () => {
  it("sums the closed loop including the wrap-around edge", () => {
    expect(perimeter(unitSquare)).toBeCloseTo(4);
  });

  it("is zero for degenerate input", () => {
    expect(perimeter([])).toBe(0);
    expect(perimeter([{ x: 1, z: 1 }])).toBe(0);
  });
});
