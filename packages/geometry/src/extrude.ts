import type { Vec2 } from "@layra/types";
import { leftNormal, normalize, sub } from "./math";
import { ensureCCW } from "./polygon";
import { wallLoops, type OffsetOptions } from "./offset";

/** Renderer-agnostic mesh data, copied straight into buffers. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface ExtrudeOptions extends OffsetOptions {
  height: number;
  thickness: number;
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
    const inward = leftNormal(normalize(sub(polygon[j]!, polygon[i]!)));

    builder.addQuad(
      [outerB.x, 0, outerB.z],
      [outerA.x, 0, outerA.z],
      [outerA.x, height, outerA.z],
      [outerB.x, height, outerB.z],
      [-inward.x, 0, -inward.z],
    );

    builder.addQuad(
      [innerA.x, 0, innerA.z],
      [innerB.x, 0, innerB.z],
      [innerB.x, height, innerB.z],
      [innerA.x, height, innerA.z],
      [inward.x, 0, inward.z],
    );

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
