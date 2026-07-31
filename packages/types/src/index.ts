/**
 * Layra scene data model.
 *
 * Conventions enforced throughout the codebase:
 * - 1 unit = 1 meter.
 * - Y is up. The floor is the Y=0 plane.
 * - Ground-plane positions use {@link Vec2} (x, z). Y never appears in plan-view math.
 * - Angles are stored in radians and displayed in degrees.
 * - Furniture origin is the center of its footprint, at floor level.
 */

/** A point on the ground plane. Meters. */
export interface Vec2 {
  x: number;
  z: number;
}

/** A point in world space. Meters, Y up. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type OpeningType = "door" | "window";

/**
 * A hole in a wall. Declared and persisted this session, but not yet authored
 * by any UI and not yet cut into wall geometry.
 */
export interface Opening {
  id: string;
  type: OpeningType;
  /** Distance in meters from the wall's `start` along the wall centerline. */
  offset: number;
  width: number;
  height: number;
  /** Height in meters from the floor to the bottom edge. Doors use 0. */
  sillHeight: number;
}

/** One wall segment, measured along its centerline. */
export interface Wall {
  id: string;
  start: Vec2;
  end: Vec2;
  height: number;
  thickness: number;
  openings: Opening[];
}

export interface Room {
  walls: Wall[];
  /**
   * The wall centerline loop, normalized to CCW winding. Derived from `walls`
   * and stored so the renderer and edit handles share one source of truth.
   */
  polygon: Vec2[];
  floorMaterial: string;
}

/** Footprint extents of a catalog item, in meters. */
export interface Footprint {
  w: number;
  d: number;
}

/** Minimum free space to leave around an item, in meters. */
export interface Clearance {
  front: number;
  sides: number;
  back: number;
}

/** Not produced this session — furniture lands next session. */
export interface CatalogItem {
  id: string;
  name: string;
  gltfUrl: string;
  footprint: Footprint;
  height: number;
  wallMounted: boolean;
  clearance: Clearance;
}

/** Not produced this session — furniture lands next session. */
export interface Placement {
  id: string;
  catalogItemId: string;
  /** Center of footprint, at floor level. */
  position: Vec3;
  rotationY: number;
  locked: boolean;
}

/** Bumped whenever the persisted shape changes; `loadScene` validates against it. */
export const SCENE_VERSION = 1;

export interface Scene {
  version: number;
  room: Room;
  placements: Placement[];
}

export function emptyScene(): Scene {
  return {
    version: SCENE_VERSION,
    room: { walls: [], polygon: [], floorMaterial: "default" },
    placements: [],
  };
}
