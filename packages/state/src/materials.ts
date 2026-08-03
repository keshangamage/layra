/** Floor finishes. Ids are persisted, so treat them as stable. */
export interface FloorMaterial {
  id: string;
  name: string;
  /** Base colour, shared by the 3D view and the SVG plan. */
  color: string;
  roughness: number;
}

export const FLOOR_MATERIALS: FloorMaterial[] = [
  { id: "default", name: "Plain", color: "#b8a68f", roughness: 0.8 },
  { id: "oak", name: "Oak", color: "#b07d4a", roughness: 0.6 },
  { id: "walnut", name: "Walnut", color: "#6b4529", roughness: 0.55 },
  { id: "concrete", name: "Concrete", color: "#9ca3af", roughness: 0.9 },
  { id: "tile", name: "Tile", color: "#e5e7eb", roughness: 0.25 },
  { id: "carpet", name: "Carpet", color: "#7c6f64", roughness: 1 },
];

export function findFloorMaterial(id: string): FloorMaterial {
  // Unknown ids fall back rather than throwing, so an old file still opens.
  return FLOOR_MATERIALS.find((m) => m.id === id) ?? FLOOR_MATERIALS[0]!;
}
