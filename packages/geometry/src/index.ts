// Pure geometry: polygon ops, mitred offsetting, extrusion, triangulation.
// Plain data in, plain typed arrays out. No React, no three.js scene objects.

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
  bounds,
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

export {
  convexArea,
  convexOverlap,
  expandRect,
  polygonContains,
  rectCorners,
  type Rect,
} from "./collision";
