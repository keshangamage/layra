import type { Vec2 } from "@layra/types";
import { ShapeUtils, Vector2 } from "three";
import { ensureCCW } from "./polygon";
import { wallLoops, type OffsetOptions } from "./offset";
import type { MeshData } from "./extrude";

/**
 * Triangulates a closed polygon into a flat floor mesh at Y=0.
 *
 * `three` is imported here for `ShapeUtils.triangulateShape` and `Vector2`
 * only. Both are pure math helpers rather than scene objects, so this module
 * still returns plain typed arrays and the renderer stays swappable.
 */
export function triangulatePolygon(polygon: readonly Vec2[]): MeshData {
  if (polygon.length < 3) {
    return {
      positions: new Float32Array(),
      normals: new Float32Array(),
      indices: new Uint32Array(),
    };
  }

  const contour = ensureCCW(polygon);
  const points = contour.map((p) => new Vector2(p.x, p.z));
  const faces = ShapeUtils.triangulateShape(points, []);

  const positions = new Float32Array(contour.length * 3);
  const normals = new Float32Array(contour.length * 3);
  for (let i = 0; i < contour.length; i++) {
    positions[i * 3] = contour[i]!.x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = contour[i]!.z;
    normals[i * 3] = 0;
    normals[i * 3 + 1] = 1;
    normals[i * 3 + 2] = 0;
  }

  // A CCW loop in the (x, z) parameter plane winds clockwise when viewed from
  // +Y, so each triangle is reversed to make the floor face up.
  const indices = new Uint32Array(faces.length * 3);
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]!;
    indices[i * 3] = face[2]!;
    indices[i * 3 + 1] = face[1]!;
    indices[i * 3 + 2] = face[0]!;
  }

  return { positions, normals, indices };
}

/**
 * Builds the floor for a room, using the inner wall loop so the floor meets the
 * walls exactly instead of poking through them.
 */
export function triangulateFloor(
  centerline: readonly Vec2[],
  thickness: number,
  options: OffsetOptions = {},
): MeshData {
  if (centerline.length < 3) return triangulatePolygon(centerline);
  const { inner } = wallLoops(ensureCCW(centerline), thickness, options);
  return triangulatePolygon(inner);
}
