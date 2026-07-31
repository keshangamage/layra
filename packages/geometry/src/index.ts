/**
 * Pure geometry for Layra: polygon operations, mitred wall offsetting,
 * extrusion, and floor triangulation.
 *
 * Everything here takes plain data and returns plain data. No React, no
 * three.js scene objects — the renderer stays swappable.
 */

export {
  EPSILON,
  add,
  cross,
  distance,
  dot,
  equals,
  leftNormal,
  length,
  lineIntersection,
  normalize,
  scale,
  sub,
  vec2,
} from "./math";

export {
  ensureCCW,
  isCCW,
  perimeter,
  pointInPolygon,
  polygonArea,
  segmentsIntersect,
  selfIntersects,
  signedArea,
} from "./polygon";

export {
  DEFAULT_MITRE_LIMIT,
  offsetPolygon,
  wallLoops,
  type OffsetOptions,
} from "./offset";

export {
  INDICES_PER_SEGMENT,
  VERTICES_PER_SEGMENT,
  extrudeWalls,
  type ExtrudeOptions,
  type MeshData,
} from "./extrude";

export { triangulateFloor, triangulatePolygon } from "./triangulate";
