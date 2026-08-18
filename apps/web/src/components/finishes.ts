import type { CeilingMaterial, WallMaterial } from "@layra/types";
import type { SurfaceKind } from "./textures";

export interface Finish {
  color: string;
  roughness: number;
  kind: SurfaceKind;
  relief: number;
}

export const WALL_FINISHES: Record<WallMaterial, Finish> = {
  plaster: { color: "#e7e5e4", roughness: 0.92, kind: "plaster", relief: 1 },
  "warm-white": { color: "#f1eadf", roughness: 0.82, kind: "plaster", relief: 0.8 },
  concrete: { color: "#9b9a96", roughness: 0.96, kind: "concrete", relief: 1.2 },
  brick: { color: "#9a5c47", roughness: 0.9, kind: "brick", relief: 1.6 },
};

export const CEILING_FINISHES: Record<CeilingMaterial, Finish> = {
  painted: { color: "#f3eee4", roughness: 0.88, kind: "plaster", relief: 1 },
  wood: { color: "#8b684b", roughness: 0.62, kind: "floorboard", relief: 1 },
  concrete: { color: "#92918c", roughness: 0.96, kind: "concrete", relief: 1 },
};

export const FLOOR_TEXTURE: Record<string, SurfaceKind> = {
  default: "plaster",
  oak: "floorboard",
  walnut: "floorboard",
  concrete: "concrete",
  tile: "tile",
  carpet: "carpet",
};
