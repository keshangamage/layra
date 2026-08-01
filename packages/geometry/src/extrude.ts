import type { Vec2 } from "@layra/types";
import { distance, leftNormal, normalize, sub } from "./math";
import { ensureCCW } from "./polygon";
import { wallLoops, type OffsetOptions } from "./offset";
import { facePanels, resolveOpenings, type WallOpening } from "./openings";

/** Renderer-agnostic mesh data, copied straight into buffers. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface ExtrudeOptions extends OffsetOptions {
  height: number;
  thickness: number;
  /** Openings per wall segment, indexed to match the centerline polygon. */
  openings?: readonly (readonly WallOpening[])[];
}

/** Outer face, inner face, top cap - 4 vertices each. */
export const VERTICES_PER_SEGMENT = 12;

/** 3 quads x 2 triangles x 3 indices. */
export const INDICES_PER_SEGMENT = 18;

class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly indices: number[] = [];

  /** a-b-c-d wound CCW as seen from where `normal` points. */
  addQuad(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    d: readonly [number, number, number],
    normal: readonly [number, number, number],
  ): void {
    const base = this.positions.length / 3;
    for (const vertex of [a, b, c, d]) {
      this.positions.push(vertex[0], vertex[1], vertex[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Same as addQuad but derives the normal from the winding. Used where the
   * quad is not exactly planar with an axis - mitring leaves the inner and
   * outer loops different lengths, so a door jamb is slightly skewed.
   */
  addQuadAuto(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    d: readonly [number, number, number],
  ): void {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];
    const len = Math.hypot(nx, ny, nz) || 1;
    this.addQuad(a, b, c, d, [nx / len, ny / len, nz / len]);
  }

  build(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      indices: new Uint32Array(this.indices),
    };
  }
}

/**
 * Extrudes a centerline polygon into walls. Vertices are unshared so faces keep
 * flat normals. The bottom cap is skipped - it sits under the floor.
 */
export function extrudeWalls(
  centerline: readonly Vec2[],
  options: ExtrudeOptions,
): MeshData {
  const { height, thickness } = options;
  const builder = new MeshBuilder();
  if (centerline.length < 3) return builder.build();

  const polygon = ensureCCW(centerline);
  const { inner, outer } = wallLoops(polygon, thickness, options);
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const innerA = inner[i]!;
    const innerB = inner[j]!;
    const outerA = outer[i]!;
    const outerB = outer[j]!;
    const direction = normalize(sub(polygon[j]!, polygon[i]!));
    const inward = leftNormal(direction);

    // Openings are measured along the centerline, and both faces are sampled
    // by the same parameter so the reveals stay square to the wall.
    const wallLength = distance(polygon[i]!, polygon[j]!);
    const spans = resolveOpenings(options.openings?.[i] ?? [], wallLength, height);

    const at = (a: Vec2, b: Vec2, u: number): Vec2 => {
      const t = wallLength < 1e-9 ? 0 : u / wallLength;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    };
    const outerAt = (u: number) => at(outerA, outerB, u);
    const innerAt = (u: number) => at(innerA, innerB, u);

    for (const panel of facePanels(spans, wallLength, height)) {
      const o0 = outerAt(panel.u0);
      const o1 = outerAt(panel.u1);
      builder.addQuad(
        [o1.x, panel.v0, o1.z],
        [o0.x, panel.v0, o0.z],
        [o0.x, panel.v1, o0.z],
        [o1.x, panel.v1, o1.z],
        [-inward.x, 0, -inward.z],
      );

      const i0 = innerAt(panel.u0);
      const i1 = innerAt(panel.u1);
      builder.addQuad(
        [i0.x, panel.v0, i0.z],
        [i1.x, panel.v0, i1.z],
        [i1.x, panel.v1, i1.z],
        [i0.x, panel.v1, i0.z],
        [inward.x, 0, inward.z],
      );
    }

    // Reveals: the faces you see inside the hole.
    for (const span of spans) {
      const iu0 = innerAt(span.u0);
      const ou0 = outerAt(span.u0);
      const iu1 = innerAt(span.u1);
      const ou1 = outerAt(span.u1);

      builder.addQuadAuto(
        [iu0.x, span.v0, iu0.z],
        [ou0.x, span.v0, ou0.z],
        [ou0.x, span.v1, ou0.z],
        [iu0.x, span.v1, iu0.z],
      );

      builder.addQuadAuto(
        [iu1.x, span.v1, iu1.z],
        [ou1.x, span.v1, ou1.z],
        [ou1.x, span.v0, ou1.z],
        [iu1.x, span.v0, iu1.z],
      );

      // Sill faces up, head faces down.
      builder.addQuad(
        [iu0.x, span.v0, iu0.z],
        [iu1.x, span.v0, iu1.z],
        [ou1.x, span.v0, ou1.z],
        [ou0.x, span.v0, ou0.z],
        [0, 1, 0],
      );

      builder.addQuad(
        [ou0.x, span.v1, ou0.z],
        [ou1.x, span.v1, ou1.z],
        [iu1.x, span.v1, iu1.z],
        [iu0.x, span.v1, iu0.z],
        [0, -1, 0],
      );
    }

    builder.addQuad(
      [innerA.x, height, innerA.z],
      [innerB.x, height, innerB.z],
      [outerB.x, height, outerB.z],
      [outerA.x, height, outerA.z],
      [0, 1, 0],
    );
  }

  return builder.build();
}
