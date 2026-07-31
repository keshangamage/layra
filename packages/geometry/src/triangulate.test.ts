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

/** Sum of triangle areas, which must equal the polygon's area. */
function triangulatedArea(mesh: MeshData): number {
  let total = 0;
  for (let t = 0; t < mesh.indices.length / 3; t++) {
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
    total += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
  }
  return total;
}

describe("triangulatePolygon", () => {
  it("covers a square exactly", () => {
    const mesh = triangulatePolygon(square);
    expect(triangulatedArea(mesh)).toBeCloseTo(polygonArea(square));
    expect(triangulatedArea(mesh)).toBeCloseTo(16);
  });

  it("covers a concave L-shape exactly", () => {
    const mesh = triangulatePolygon(lShape);
    expect(triangulatedArea(mesh)).toBeCloseTo(polygonArea(lShape));
    expect(triangulatedArea(mesh)).toBeCloseTo(12);
  });

  it("emits n-2 triangles for a simple polygon", () => {
    expect(triangulatePolygon(square).indices.length / 3).toBe(2);
    expect(triangulatePolygon(lShape).indices.length / 3).toBe(4);
  });

  it("lays every vertex on the floor plane", () => {
    const mesh = triangulatePolygon(lShape);
    for (let i = 1; i < mesh.positions.length; i += 3) {
      expect(mesh.positions[i]).toBe(0);
    }
  });

  it("faces every normal straight up", () => {
    const mesh = triangulatePolygon(lShape);
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      expect(mesh.normals[i * 3]).toBe(0);
      expect(mesh.normals[i * 3 + 1]).toBe(1);
      expect(mesh.normals[i * 3 + 2]).toBe(0);
    }
  });

  it("winds triangles counter-clockwise as seen from above", () => {
    // A CCW (x, z) contour triangulates to -Y facing, so triangulatePolygon
    // reverses each face. If that reversal is ever dropped the floor turns
    // invisible under backface culling, which this catches.
    const mesh = triangulatePolygon(lShape);
    for (let t = 0; t < mesh.indices.length / 3; t++) {
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
      // +Y normal from the 3D cross product corresponds to a negative
      // shoelace term in the (x, z) parameter plane.
      const shoelace = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      expect(shoelace).toBeLessThan(0);
    }
  });

  it("normalizes clockwise input to the same result", () => {
    const clockwise = [...square].reverse();
    expect(triangulatedArea(triangulatePolygon(clockwise))).toBeCloseTo(16);
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
  it("builds the floor from the inner wall loop, not the centerline", () => {
    const thickness = 0.2;
    const mesh = triangulateFloor(square, thickness);
    // Inner loop of a 4×4 centerline square at 0.2 thickness is 3.8×3.8.
    expect(triangulatedArea(mesh)).toBeCloseTo(3.8 * 3.8);
    expect(triangulatedArea(mesh)).toBeLessThan(polygonArea(square));
  });

  it("shrinks as the walls thicken", () => {
    const thin = triangulatedArea(triangulateFloor(square, 0.1));
    const thick = triangulatedArea(triangulateFloor(square, 0.6));
    expect(thick).toBeLessThan(thin);
  });

  it("handles a concave room", () => {
    const mesh = triangulateFloor(lShape, 0.2);
    expect(triangulatedArea(mesh)).toBeGreaterThan(0);
    expect(triangulatedArea(mesh)).toBeLessThan(polygonArea(lShape));
    for (const value of mesh.positions) expect(Number.isFinite(value)).toBe(true);
  });
});
