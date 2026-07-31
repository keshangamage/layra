import type { Vec2 } from "@layra/types";
import { ShapeUtils, Vector2 } from "three";
import { ensureCCW } from "./polygon";
import { wallLoops, type OffsetOptions } from "./offset";
import type { MeshData } from "./extrude";

// `three` is used here only for ShapeUtils and Vector2 — pure math helpers,
// not scene objects, so the renderer stays swappable.

/** Flat mesh at Y=0. */
export function triangulatePolygon(polygon: readonly Vec2[]): MeshData {
  if (polygon.length < 3) {
    return {
      positions: new Float32Array(),
      normals: new Float32Array(),
      indices: new Uint32Array(),
    };
  }

  const contour = ensureCCW(polygon);
  const faces = ShapeUtils.triangulateShape(
    contour.map((p) => new Vector2(p.x, p.z)),
    [],
  );

  const positions = new Float32Array(contour.length * 3);
  const normals = new Float32Array(contour.length * 3);
  for (let i = 0; i < contour.length; i++) {
    positions[i * 3] = contour[i]!.x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = contour[i]!.z;
    normals[i * 3 + 1] = 1;
  }

  // A CCW (x, z) loop winds clockwise seen from +Y, so reverse to face up.
  const indices = new Uint32Array(faces.length * 3);
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]!;
    indices[i * 3] = face[2]!;
    indices[i * 3 + 1] = face[1]!;
    indices[i * 3 + 2] = face[0]!;
  }

  return { positions, normals, indices };
}

/** Uses the inner wall loop so the floor meets the walls exactly. */
export function triangulateFloor(
  centerline: readonly Vec2[],
  thickness: number,
  options: OffsetOptions = {},
): MeshData {
  if (centerline.length < 3) return triangulatePolygon(centerline);
  const { inner } = wallLoops(ensureCCW(centerline), thickness, options);
  return triangulatePolygon(inner);
}
