// 1 unit = 1 meter. Y is up, floor is Y=0. Angles in radians.

/** Ground-plane point. Y never appears in plan-view math. */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type OpeningType = "door" | "window";

/** Persisted and round-tripped, but not yet authored or cut into geometry. */
export interface Opening {
  id: string;
  type: OpeningType;
  /** Distance from the wall's start, along the centerline. */
  offset: number;
  width: number;
  height: number;
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
  id: string;
  name: string;
  /** Prevents edits while keeping the room visible. */
  locked?: boolean;
  walls: Wall[];
  /** Centerline loop, normalized to CCW. Derived from walls, stored so the renderer and edit handles agree. */
  polygon: Vec2[];
  floorMaterial: string;
}

export interface Footprint {
  w: number;
  d: number;
}

export interface Clearance {
  front: number;
  sides: number;
  back: number;
}

/** Furniture lands next session; nothing produces these yet. */
export interface CatalogItem {
  id: string;
  name: string;
  gltfUrl: string;
  footprint: Footprint;
  height: number;
  wallMounted: boolean;
  /** Height of the item's underside when wall-mounted. Ignored otherwise. */
  mountHeight?: number;
  clearance: Clearance;
}

export type FurnitureFinish = "natural" | "painted" | "fabric" | "leather" | "metal";

export interface Placement {
  id: string;
  catalogItemId: string;
  /** Center of footprint, at floor level. */
  position: Vec3;
  rotationY: number;
  locked: boolean;
  finish?: FurnitureFinish;
}

/** Bumped when the persisted shape changes; load migrates older files. */
export const SCENE_VERSION = 2;

export interface Scene {
  version: number;
  rooms: Room[];
  placements: Placement[];
}

export function emptyRoom(id: string, name: string): Room {
  return { id, name, locked: false, walls: [], polygon: [], floorMaterial: "default" };
}

export function emptyScene(): Scene {
  return {
    version: SCENE_VERSION,
    rooms: [emptyRoom("r0", "Room 1")],
    placements: [],
  };
}
