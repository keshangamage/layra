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

/** Geometric normal of triangle `t`, from its winding. */
function faceNormal(mesh: MeshData, t: number): [number, number, number] {
  const [ia, ib, ic] = [
    mesh.indices[t * 3]!,
    mesh.indices[t * 3 + 1]!,
    mesh.indices[t * 3 + 2]!,
  ];
  const p = (i: number): [number, number, number] => [
    mesh.positions[i * 3]!,
    mesh.positions[i * 3 + 1]!,
    mesh.positions[i * 3 + 2]!,
  ];
  const a = p(ia);
  const b = p(ib);
  const c = p(ic);
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

describe("extrudeWalls vertex counts", () => {
  it("emits 12 vertices and 18 indices per segment for a 4-wall room", () => {
    const mesh = extrudeWalls(square, options);
    expect(vertexCount(mesh)).toBe(4 * VERTICES_PER_SEGMENT);
    expect(vertexCount(mesh)).toBe(48);
    expect(mesh.indices.length).toBe(4 * INDICES_PER_SEGMENT);
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
    const count = vertexCount(mesh);
    for (const index of mesh.indices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(count);
    }
  });

  it("produces no NaN or infinite coordinates", () => {
    const mesh = extrudeWalls(lShape, options);
    for (const value of mesh.positions) expect(Number.isFinite(value)).toBe(true);
    for (const value of mesh.normals) expect(Number.isFinite(value)).toBe(true);
  });

  it("spans exactly floor to wall height in Y", () => {
    const mesh = extrudeWalls(square, options);
    const ys: number[] = [];
    for (let i = 1; i < mesh.positions.length; i += 3) ys.push(mesh.positions[i]!);
    expect(Math.min(...ys)).toBeCloseTo(0);
    expect(Math.max(...ys)).toBeCloseTo(options.height);
  });

  it("emits unit-length normals", () => {
    const mesh = extrudeWalls(lShape, options);
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const len = Math.hypot(
        mesh.normals[i]!,
        mesh.normals[i + 1]!,
        mesh.normals[i + 2]!,
      );
      expect(len).toBeCloseTo(1);
    }
  });

  it("winds every triangle to agree with its declared normal", () => {
    // Guards the failure mode where a face renders inside-out under backface
    // culling: the stored normal and the winding disagree.
    const mesh = extrudeWalls(lShape, options);
    const triangles = mesh.indices.length / 3;
    for (let t = 0; t < triangles; t++) {
      const geometric = faceNormal(mesh, t);
      const first = mesh.indices[t * 3]!;
      const declared: [number, number, number] = [
        mesh.normals[first * 3]!,
        mesh.normals[first * 3 + 1]!,
        mesh.normals[first * 3 + 2]!,
      ];
      const alignment =
        geometric[0] * declared[0] +
        geometric[1] * declared[1] +
        geometric[2] * declared[2];
      expect(alignment).toBeGreaterThan(0.99);
    }
  });

  it("points the top cap straight up", () => {
    const mesh = extrudeWalls(square, options);
    const capNormals: number[] = [];
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      if (Math.abs(mesh.positions[i * 3 + 1]! - options.height) < 1e-6) {
        capNormals.push(mesh.normals[i * 3 + 1]!);
      }
    }
    // Every vertex at wall height belongs to a side face (normal Y = 0) or the
    // cap (normal Y = 1); at least the four cap quads must be present.
    expect(capNormals.filter((y) => Math.abs(y - 1) < 1e-6).length).toBe(16);
  });

  it("thickens the wall footprint as thickness grows", () => {
    const thin = extrudeWalls(square, { height: 2.5, thickness: 0.1 });
    const thick = extrudeWalls(square, { height: 2.5, thickness: 0.6 });
    const spanX = (mesh: MeshData): number => {
      const xs: number[] = [];
      for (let i = 0; i < mesh.positions.length; i += 3) xs.push(mesh.positions[i]!);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spanX(thick)).toBeGreaterThan(spanX(thin));
    expect(spanX(thin)).toBeCloseTo(4.1);
    expect(spanX(thick)).toBeCloseTo(4.6);
  });

  it("leaves no gap at corners, including non-right angles", () => {
    // The whole point of mitring. Segment i's trailing edge must land on exactly
    // the same two points as segment i+1's leading edge; per-wall boxes would
    // leave a notch here. A hexagon exercises 120° corners specifically.
    const hexagon: Vec2[] = ensureCCW(
      Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return { x: Math.cos(angle) * 3, z: Math.sin(angle) * 3 };
      }),
    );
    const mesh = extrudeWalls(hexagon, options);
    const n = hexagon.length;

    const at = (v: number): [number, number, number] => [
      mesh.positions[v * 3]!,
      mesh.positions[v * 3 + 1]!,
      mesh.positions[v * 3 + 2]!,
    ];

    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      // Outer face quad order is [B(0), A(0), A(h), B(h)], so vertex 0 of the
      // quad is the trailing (B) corner and vertex 1 is the leading (A) corner.
      expectSamePoint(
        at(i * VERTICES_PER_SEGMENT + 0),
        at(next * VERTICES_PER_SEGMENT + 1),
      );

      // Inner face quad order is [A(0), B(0), B(h), A(h)].
      expectSamePoint(
        at(i * VERTICES_PER_SEGMENT + 4 + 1),
        at(next * VERTICES_PER_SEGMENT + 4 + 0),
      );
    }
  });

  it("gives the same geometry regardless of input winding", () => {
    const clockwise = [...square].reverse();
    const a = extrudeWalls(square, options);
    const b = extrudeWalls(clockwise, options);
    expect(vertexCount(a)).toBe(vertexCount(b));
    // ensureCCW normalizes winding, so both meshes occupy the same bounds.
    const bounds = (mesh: MeshData, axis: 0 | 2): [number, number] => {
      const values: number[] = [];
      for (let i = axis; i < mesh.positions.length; i += 3) values.push(mesh.positions[i]!);
      return [Math.min(...values), Math.max(...values)];
    };
    expect(bounds(a, 0)).toEqual(bounds(b, 0));
    expect(bounds(a, 2)).toEqual(bounds(b, 2));
  });
});
