import type { CatalogItem } from "@layra/types";

// Dimensions in metres. gltfUrl records the intended asset path; until those
// exist, the renderer draws a box from footprint and height.
export const CATALOG: CatalogItem[] = [
  {
    id: "sofa-3",
    name: "Sofa (3 seat)",
    gltfUrl: "/models/sofa-3.glb",
    footprint: { w: 2.1, d: 0.9 },
    height: 0.8,
    wallMounted: false,
    clearance: { front: 0.7, sides: 0.1, back: 0 },
  },
  {
    id: "armchair",
    name: "Armchair",
    gltfUrl: "/models/armchair.glb",
    footprint: { w: 0.85, d: 0.85 },
    height: 0.8,
    wallMounted: false,
    clearance: { front: 0.6, sides: 0.15, back: 0 },
  },
  {
    id: "bed-double",
    name: "Bed (double)",
    gltfUrl: "/models/bed-double.glb",
    footprint: { w: 1.6, d: 2.05 },
    height: 0.55,
    wallMounted: false,
    clearance: { front: 0.7, sides: 0.6, back: 0 },
  },
  {
    id: "dining-table",
    name: "Dining table",
    gltfUrl: "/models/dining-table.glb",
    footprint: { w: 1.6, d: 0.9 },
    height: 0.75,
    wallMounted: false,
    clearance: { front: 0.75, sides: 0.75, back: 0.75 },
  },
  {
    id: "dining-chair",
    name: "Dining chair",
    gltfUrl: "/models/dining-chair.glb",
    footprint: { w: 0.45, d: 0.5 },
    height: 0.9,
    wallMounted: false,
    clearance: { front: 0.4, sides: 0.05, back: 0.3 },
  },
  {
    id: "desk",
    name: "Desk",
    gltfUrl: "/models/desk.glb",
    footprint: { w: 1.4, d: 0.7 },
    height: 0.75,
    wallMounted: false,
    clearance: { front: 0.8, sides: 0.1, back: 0 },
  },
  {
    id: "wardrobe",
    name: "Wardrobe",
    gltfUrl: "/models/wardrobe.glb",
    footprint: { w: 1.2, d: 0.6 },
    height: 2.0,
    wallMounted: false,
    clearance: { front: 0.9, sides: 0, back: 0 },
  },
  {
    id: "bookshelf",
    name: "Bookshelf",
    gltfUrl: "/models/bookshelf.glb",
    footprint: { w: 0.8, d: 0.32 },
    height: 1.8,
    wallMounted: false,
    clearance: { front: 0.6, sides: 0, back: 0 },
  },
  {
    id: "wall-shelf",
    name: "Wall shelf",
    gltfUrl: "/models/wall-shelf.glb",
    footprint: { w: 0.9, d: 0.25 },
    height: 0.3,
    wallMounted: true,
    mountHeight: 1.4,
    clearance: { front: 0.3, sides: 0, back: 0 },
  },
];

export function findCatalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}
