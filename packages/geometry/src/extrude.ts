import type { Vec2 } from "@layra/types";
import { leftNormal, normalize, sub } from "./math";
import { ensureCCW } from "./polygon";
import { wallLoops, type OffsetOptions } from "./offset";

/** Renderer-agnostic mesh data. Consumers copy these straight into buffers. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface ExtrudeOptions extends OffsetOptions {
  height: number;
  thickness: number;
}

/** Vertices emitted per wall segment: outer face, inner face, top cap — 4 each. */
export const VERTICES_PER_SEGMENT = 12;

/** Indices emitted per wall segment: 3 quads × 2 triangles × 3 indices. */
export const INDICES_PER_SEGMENT = 18;

/**
 * Accumulates quads into flat arrays.
 *
 * Vertices are never shared between faces, so each face keeps a flat normal
 * rather than averaging into a rounded corner at the wall edges.
 */
class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly indices: number[] = [];

  /**
   * Adds a quad `a → b → c → d`, wound counter-clockwise as seen from the
   * direction `normal` points.
   */
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

  build(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      indices: new Uint32Array(this.indices),
    };
  }
}

/**
 * Extrudes a closed centerline polygon into wall geometry.
 *
 * Emits three faces per segment — outer, inner, and the top cap. The bottom cap
 * is deliberately omitted: it sits at Y=0 underneath the floor mesh and is
 * never visible, so drawing it would be pure overdraw.
 *
 * Invariant relied on by the tests: exactly `VERTICES_PER_SEGMENT` vertices and
 * `INDICES_PER_SEGMENT` indices per segment.
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

    // Inward normal of this segment, from the centerline direction.
    const inward = leftNormal(normalize(sub(polygon[j]!, polygon[i]!)));

    // Outer face — normal points away from the room.
    builder.addQuad(
      [outerB.x, 0, outerB.z],
      [outerA.x, 0, outerA.z],
      [outerA.x, height, outerA.z],
      [outerB.x, height, outerB.z],
      [-inward.x, 0, -inward.z],
    );

    // Inner face — normal points into the room.
    builder.addQuad(
      [innerA.x, 0, innerA.z],
      [innerB.x, 0, innerB.z],
      [innerB.x, height, innerB.z],
      [innerA.x, height, innerA.z],
      [inward.x, 0, inward.z],
    );

    // Top cap.
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
