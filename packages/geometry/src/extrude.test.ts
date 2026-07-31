import { describe, expect, it } from "vitest";
import type { Vec2 } from "@layra/types";
import {
  INDICES_PER_SEGMENT,
  VERTICES_PER_SEGMENT,
  extrudeWalls,
  type MeshData,
} from "./extrude";
import { ensureCCW } from "./polygon";

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

const options = { height: 2.5, thickness: 0.2 };

function vertexCount(mesh: MeshData): number {
  return mesh.positions.length / 3;
}

function vertexAt(mesh: MeshData, v: number): [number, number, number] {
  return [
    mesh.positions[v * 3]!,
    mesh.positions[v * 3 + 1]!,
    mesh.positions[v * 3 + 2]!,
  ];
}

/** Normal derived from triangle winding, for cross-checking stored normals. */
function faceNormal(mesh: MeshData, t: number): [number, number, number] {
  const a = vertexAt(mesh, mesh.indices[t * 3]!);
  const b = vertexAt(mesh, mesh.indices[t * 3 + 1]!);
  const c = vertexAt(mesh, mesh.indices[t * 3 + 2]!);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
  const n: [number, number, number] = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

function expectSamePoint(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): void {
  expect(a[0]).toBeCloseTo(b[0], 9);
  expect(a[1]).toBeCloseTo(b[1], 9);
  expect(a[2]).toBeCloseTo(b[2], 9);
}

describe("extrudeWalls counts", () => {
  it("emits 12 vertices and 18 indices per segment", () => {
    const mesh = extrudeWalls(square, options);
    expect(vertexCount(mesh)).toBe(48);
    expect(mesh.indices.length).toBe(72);
  });

  it("scales linearly with segment count", () => {
    for (const polygon of [square, lShape]) {
      const mesh = extrudeWalls(polygon, options);
      expect(vertexCount(mesh)).toBe(polygon.length * VERTICES_PER_SEGMENT);
      expect(mesh.indices.length).toBe(polygon.length * INDICES_PER_SEGMENT);
    }
  });

  it("keeps positions and normals in lockstep", () => {
    const mesh = extrudeWalls(lShape, options);
    expect(mesh.normals.length).toBe(mesh.positions.length);
  });

  it("returns empty geometry below three vertices", () => {
    for (const degenerate of [[], [{ x: 0, z: 0 }], [{ x: 0, z: 0 }, { x: 1, z: 0 }]]) {
      const mesh = extrudeWalls(degenerate, options);
      expect(mesh.positions.length).toBe(0);
      expect(mesh.indices.length).toBe(0);
    }
  });
});

describe("extrudeWalls integrity", () => {
  it("references only in-range vertices", () => {
    const mesh = extrudeWalls(lShape, options);
    for (const index of mesh.indices) {
      expect(index).toBeLessThan(vertexCount(mesh));
    }
  });

  it("produces no NaN or infinite coordinates", () => {
    const mesh = extrudeWalls(lShape, options);
    for (const value of mesh.positions) expect(Number.isFinite(value)).toBe(true);
    for (const value of mesh.normals) expect(Number.isFinite(value)).toBe(true);
  });

  it("spans exactly floor to wall height", () => {
    const mesh = extrudeWalls(square, options);
    const ys: number[] = [];
    for (let i = 1; i < mesh.positions.length; i += 3) ys.push(mesh.positions[i]!);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(options.height);
  });

  it("emits unit-length normals", () => {
    const mesh = extrudeWalls(lShape, options);
    for (let i = 0; i < mesh.normals.length; i += 3) {
      expect(
        Math.hypot(mesh.normals[i]!, mesh.normals[i + 1]!, mesh.normals[i + 2]!),
      ).toBeCloseTo(1);
    }
  });

  it("winds every triangle to agree with its stored normal", () => {
    // Catches faces that would render inside-out under backface culling.
    const mesh = extrudeWalls(lShape, options);
    for (let t = 0; t < mesh.indices.length / 3; t++) {
      const geometric = faceNormal(mesh, t);
      const first = mesh.indices[t * 3]!;
      const alignment =
        geometric[0] * mesh.normals[first * 3]! +
        geometric[1] * mesh.normals[first * 3 + 1]! +
        geometric[2] * mesh.normals[first * 3 + 2]!;
      expect(alignment).toBeGreaterThan(0.99);
    }
  });

  it("leaves no gap at corners, including non-right angles", () => {
    // The point of mitring. A hexagon exercises 120 degree corners.
    const hexagon: Vec2[] = ensureCCW(
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return { x: Math.cos(angle) * 3, z: Math.sin(angle) * 3 };
      }),
    );
    const mesh = extrudeWalls(hexagon, options);

    for (let i = 0; i < hexagon.length; i++) {
      const next = (i + 1) % hexagon.length;
      // Outer quad is [B(0), A(0), A(h), B(h)]; inner is [A(0), B(0), B(h), A(h)].
      expectSamePoint(
        vertexAt(mesh, i * VERTICES_PER_SEGMENT),
        vertexAt(mesh, next * VERTICES_PER_SEGMENT + 1),
      );
      expectSamePoint(
        vertexAt(mesh, i * VERTICES_PER_SEGMENT + 5),
        vertexAt(mesh, next * VERTICES_PER_SEGMENT + 4),
      );
    }
  });

  it("thickens the footprint as thickness grows", () => {
    const spanX = (mesh: MeshData): number => {
      const xs: number[] = [];
      for (let i = 0; i < mesh.positions.length; i += 3) xs.push(mesh.positions[i]!);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spanX(extrudeWalls(square, { height: 2.5, thickness: 0.1 }))).toBeCloseTo(4.1);
    expect(spanX(extrudeWalls(square, { height: 2.5, thickness: 0.6 }))).toBeCloseTo(4.6);
  });

  it("gives the same bounds regardless of input winding", () => {
    const bounds = (mesh: MeshData, axis: 0 | 2): [number, number] => {
      const values: number[] = [];
      for (let i = axis; i < mesh.positions.length; i += 3) values.push(mesh.positions[i]!);
      return [Math.min(...values), Math.max(...values)];
    };
    const a = extrudeWalls(square, options);
    const b = extrudeWalls([...square].reverse(), options);
    expect(bounds(a, 0)).toEqual(bounds(b, 0));
    expect(bounds(a, 2)).toEqual(bounds(b, 2));
  });
});
