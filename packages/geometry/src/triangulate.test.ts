import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import { triangulateFloor, triangulatePolygon } from "./triangulate";
import { ensureCCW, polygonArea } from "./polygon";
import type { MeshData } from "./extrude";

const square: Vec2[] = ensureCCW([
  { x: -2, z: -2 },
  { x: 2, z: -2 },
  { x: 2, z: 2 },
  { x: -2, z: 2 },
]);

const lShape: Vec2[] = ensureCCW([
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 2 },
  { x: 2, z: 2 },
  { x: 2, z: 4 },
  { x: 0, z: 4 },
]);

/** Shoelace term per triangle; negative means +Y facing. */
function shoelace(mesh: MeshData, t: number): number {
  const [ia, ib, ic] = [
    mesh.indices[t * 3]!,
    mesh.indices[t * 3 + 1]!,
    mesh.indices[t * 3 + 2]!,
  ];
  const ax = mesh.positions[ia * 3]!;
  const az = mesh.positions[ia * 3 + 2]!;
  const bx = mesh.positions[ib * 3]!;
  const bz = mesh.positions[ib * 3 + 2]!;
  const cx = mesh.positions[ic * 3]!;
  const cz = mesh.positions[ic * 3 + 2]!;
  return (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
}

function triangulatedArea(mesh: MeshData): number {
  let total = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
    total += Math.abs(shoelace(mesh, t)) / 2;
  }
  return total;
}

describe("triangulatePolygon", () => {
  it("covers a square exactly", () => {
    expect(triangulatedArea(triangulatePolygon(square))).toBeCloseTo(16);
  });

  it("covers a concave L-shape exactly", () => {
    const mesh = triangulatePolygon(lShape);
    expect(triangulatedArea(mesh)).toBeCloseTo(polygonArea(lShape));
    expect(triangulatedArea(mesh)).toBeCloseTo(12);
  });

  it("emits n-2 triangles", () => {
    expect(triangulatePolygon(square).indices.length / 3).toBe(2);
    expect(triangulatePolygon(lShape).indices.length / 3).toBe(4);
  });

  it("lays every vertex on the floor plane", () => {
    const mesh = triangulatePolygon(lShape);
    for (let i = 1; i < mesh.positions.length; i += 3) {
      expect(mesh.positions[i]).toBe(0);
    }
  });

  it("faces every normal up", () => {
    const mesh = triangulatePolygon(lShape);
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      expect(mesh.normals[i * 3]).toBe(0);
      expect(mesh.normals[i * 3 + 1]).toBe(1);
      expect(mesh.normals[i * 3 + 2]).toBe(0);
    }
  });

  it("winds triangles to face up", () => {
    // Drop the reversal and the floor turns invisible under backface culling.
    const mesh = triangulatePolygon(lShape);
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      expect(shoelace(mesh, t)).toBeLessThan(0);
    }
  });

  it("normalizes clockwise input to the same result", () => {
    expect(triangulatedArea(triangulatePolygon([...square].reverse()))).toBeCloseTo(16);
  });

  it("returns empty geometry below three vertices", () => {
    for (const degenerate of [[], [{ x: 0, z: 0 }], [{ x: 0, z: 0 }, { x: 1, z: 0 }]]) {
      const mesh = triangulatePolygon(degenerate);
      expect(mesh.positions.length).toBe(0);
      expect(mesh.indices.length).toBe(0);
    }
  });
});

describe("triangulateFloor", () => {
  it("builds from the inner wall loop, not the centerline", () => {
    const mesh = triangulateFloor(square, 0.2);
    expect(triangulatedArea(mesh)).toBeCloseTo(3.8 * 3.8);
    expect(triangulatedArea(mesh)).toBeLessThan(polygonArea(square));
  });

  it("shrinks as walls thicken", () => {
    expect(triangulatedArea(triangulateFloor(square, 0.6))).toBeLessThan(
      triangulatedArea(triangulateFloor(square, 0.1)),
    );
  });

  it("handles a concave room", () => {
    const mesh = triangulateFloor(lShape, 0.2);
    expect(triangulatedArea(mesh)).toBeGreaterThan(0);
    expect(triangulatedArea(mesh)).toBeLessThan(polygonArea(lShape));
    for (const value of mesh.positions) expect(Number.isFinite(value)).toBe(true);
  });
});
