import { describe, expect, it } from "vitest";
import { DEFAULT_MOUNT_HEIGHT, mountToWall, snapFloorToWall } from "./mounting";
import { findCatalogItem } from "./catalog";
import { roomFromPolygon } from "./commands";
import { createEditorStore } from "./store";

/** 6m x 4m room; walls run x=0..6 at z=0, then up the right side, and so on. */
const room = roomFromPolygon(
  [
    { x: 0, z: 0 },
    { x: 6, z: 0 },
    { x: 6, z: 4 },
    { x: 0, z: 4 },
  ],
  { height: 2.5, thickness: 0.2 },
  { id: "r0", name: "Room 1", floorMaterial: "default" },
);

const shelf = findCatalogItem("wall-shelf")!;

describe("mountToWall", () => {
  it("hangs the item at its mount height", () => {
    const mounted = mountToWall(room, { x: 3, z: 0.1 }, shelf)!;
    expect(mounted.position.y).toBeCloseTo(1.4);
  });

  it("falls back to a default height when the item states none", () => {
    const mounted = mountToWall(room, { x: 3, z: 0.1 }, { ...shelf, mountHeight: undefined })!;
    expect(mounted.position.y).toBeCloseTo(DEFAULT_MOUNT_HEIGHT);
  });

  it("sits against the inner face, not the centerline", () => {
    // Inner face of the z=0 wall is at z=0.1 with 0.2m walls; the shelf is
    // 0.25 deep, so its centre sits half a depth into the room.
    const mounted = mountToWall(room, { x: 3, z: 0 }, shelf)!;
    expect(mounted.position.z).toBeCloseTo(0.1 + 0.125);
  });

  it("faces into the room", () => {
    const mounted = mountToWall(room, { x: 3, z: 0 }, shelf)!;
    // A piece's front is -Z locally; on the z=0 wall it must point to +z.
    const front = {
      x: -Math.sin(mounted.rotationY),
      z: -Math.cos(mounted.rotationY),
    };
    expect(front.x).toBeCloseTo(0);
    expect(front.z).toBeCloseTo(1);
  });

  it("faces the other way on the opposite wall", () => {
    const mounted = mountToWall(room, { x: 3, z: 4 }, shelf)!;
    const front = {
      x: -Math.sin(mounted.rotationY),
      z: -Math.cos(mounted.rotationY),
    };
    expect(front.z).toBeCloseTo(-1);
  });

  it("picks the wall nearest the point", () => {
    const onRight = mountToWall(room, { x: 5.9, z: 2 }, shelf)!;
    expect(onRight.position.x).toBeCloseTo(5.9 - 0.125);
    expect(onRight.position.z).toBeCloseTo(2);
  });

  it("keeps the whole item on the wall near a corner", () => {
    const mounted = mountToWall(room, { x: 0, z: 0 }, shelf)!;
    // Clamped to half the 0.9m width from the wall's start, measured along the
    // centerline - the same convention openings use.
    expect(mounted.position.x).toBeCloseTo(0.45);
  });

  it("returns null without a room", () => {
    expect(mountToWall({ id: "r0", name: "Room 1", walls: [], polygon: [], floorMaterial: "d" }, { x: 0, z: 0 }, shelf))
      .toBeNull();
  });
});

describe("placing wall-mounted furniture", () => {
  function storeWithRoom() {
    const store = createEditorStore();
    for (const point of [
      { x: 0, z: 0 },
      { x: 6, z: 0 },
      { x: 6, z: 4 },
      { x: 0, z: 4 },
    ]) {
      store.getState().addDraftPoint(point);
    }
    store.getState().closeDraft();
    return store;
  }

  it("snaps a shelf to the wall instead of the floor", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("wall-shelf");
    s.getState().placeFurnitureAt({ x: 3, z: 0.4 });

    const placed = s.getState().scene.placements[0]!;
    expect(placed.position.y).toBeCloseTo(1.4);
    expect(placed.rotationY).not.toBe(0);
  });

  it("leaves floor furniture on the floor", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 3, z: 2 });

    const placed = s.getState().scene.placements[0]!;
    expect(placed.position.y).toBe(0);
    expect(placed.rotationY).toBe(0);
  });

  it("slides along walls when dragged, keeping its height", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("wall-shelf");
    s.getState().placeFurnitureAt({ x: 2, z: 0.4 });
    const id = s.getState().scene.placements[0]!.id;

    s.getState().beginPlacementDrag(id, { x: 2, z: 0.2 });
    s.getState().updatePlacementDrag({ x: 4.5, z: 0.2 });
    s.getState().endPlacementDrag();

    const moved = s.getState().scene.placements[0]!;
    expect(moved.position.x).toBeCloseTo(4.5 - 0.0);
    expect(moved.position.y).toBeCloseTo(1.4);
  });

  it("re-aims the shelf when dragged onto a different wall", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("wall-shelf");
    s.getState().placeFurnitureAt({ x: 3, z: 0.4 });
    const before = s.getState().scene.placements[0]!.rotationY;
    const id = s.getState().scene.placements[0]!.id;

    s.getState().beginPlacementDrag(id, { x: 3, z: 0.2 });
    s.getState().updatePlacementDrag({ x: 5.9, z: 2 });
    s.getState().endPlacementDrag();

    expect(s.getState().scene.placements[0]!.rotationY).not.toBeCloseTo(before);
  });

  it("moves and rotates as a single history entry", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("wall-shelf");
    s.getState().placeFurnitureAt({ x: 3, z: 0.4 });
    const before = s.getState().past.length;
    const original = s.getState().scene.placements[0]!;

    s.getState().beginPlacementDrag(original.id, { x: 3, z: 0.2 });
    s.getState().updatePlacementDrag({ x: 5.9, z: 2 });
    s.getState().endPlacementDrag();
    expect(s.getState().past).toHaveLength(before + 1);

    s.getState().undo();
    const restored = s.getState().scene.placements[0]!;
    expect(restored.position).toEqual(original.position);
    expect(restored.rotationY).toBeCloseTo(original.rotationY);
  });

  it("round-trips through save and load", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("wall-shelf");
    s.getState().placeFurnitureAt({ x: 3, z: 0.4 });
    const placed = s.getState().scene.placements[0]!;

    s.getState().replaceScene(s.getState().scene);
    expect(s.getState().scene.placements[0]).toEqual(placed);
  });
});

describe("snapFloorToWall", () => {
  const sofa = findCatalogItem("sofa-3")!;

  it("snaps a piece whose back is near a wall", () => {
    // Sofa is 0.9 deep, wall half-thickness 0.1, so its back is at z-0.55.
    const snapped = snapFloorToWall(room, { x: 3, z: 0.6 }, sofa);
    expect(snapped).not.toBeNull();
    expect(snapped!.position.z).toBeCloseTo(0.1 + 0.45);
  });

  it("leaves a piece out in the room alone", () => {
    expect(snapFloorToWall(room, { x: 3, z: 2 }, sofa)).toBeNull();
  });

  it("keeps it on the floor", () => {
    expect(snapFloorToWall(room, { x: 3, z: 0.6 }, sofa)!.position.y).toBe(0);
  });

  it("turns the piece to face into the room", () => {
    const snapped = snapFloorToWall(room, { x: 3, z: 0.6 }, sofa)!;
    const front = {
      x: -Math.sin(snapped.rotationY),
      z: -Math.cos(snapped.rotationY),
    };
    expect(front.z).toBeCloseTo(1);
  });

  it("measures the gap from the back edge, so depth does not change the reach", () => {
    // A deep piece and a shallow one placed the same distance from the wall
    // should both snap, because the threshold is measured from their backs.
    const shallow = findCatalogItem("bookshelf")!;
    const centre = 0.1 + shallow.footprint.d / 2 + 0.2;
    expect(snapFloorToWall(room, { x: 3, z: centre }, shallow)).not.toBeNull();

    const deepCentre = 0.1 + sofa.footprint.d / 2 + 0.2;
    expect(snapFloorToWall(room, { x: 3, z: deepCentre }, sofa)).not.toBeNull();
  });

  it("honours a custom threshold", () => {
    expect(snapFloorToWall(room, { x: 3, z: 1.4 }, sofa)).toBeNull();
    expect(snapFloorToWall(room, { x: 3, z: 1.4 }, sofa, 2)).not.toBeNull();
  });
});

describe("snapping while placing and dragging", () => {
  function storeWithRoom() {
    const store = createEditorStore();
    for (const point of [
      { x: 0, z: 0 },
      { x: 6, z: 0 },
      { x: 6, z: 4 },
      { x: 0, z: 4 },
    ]) {
      store.getState().addDraftPoint(point);
    }
    store.getState().closeDraft();
    return store;
  }

  it("places a sofa flat against the wall it was dropped near", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("sofa-3");
    s.getState().placeFurnitureAt({ x: 3, z: 0.6 });

    const placed = s.getState().scene.placements[0]!;
    expect(placed.position.z).toBeCloseTo(0.55);
    expect(placed.rotationY).not.toBe(0);
  });

  it("leaves it where clicked when Alt bypasses the snap", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("sofa-3");
    s.getState().placeFurnitureAt({ x: 3, z: 0.6 }, true);

    const placed = s.getState().scene.placements[0]!;
    expect(placed.position.z).toBeCloseTo(0.6);
    expect(placed.rotationY).toBe(0);
  });

  it("snaps mid-drag when pulled close to a wall", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("sofa-3");
    s.getState().placeFurnitureAt({ x: 3, z: 2 }, true);
    const id = s.getState().scene.placements[0]!.id;

    s.getState().beginPlacementDrag(id, { x: 3, z: 2 });
    s.getState().updatePlacementDrag({ x: 3, z: 0.6 });
    s.getState().endPlacementDrag();

    expect(s.getState().scene.placements[0]!.position.z).toBeCloseTo(0.55);
  });

  it("releases the snap when dragged back into the room", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("sofa-3");
    s.getState().placeFurnitureAt({ x: 3, z: 0.6 });
    const id = s.getState().scene.placements[0]!.id;

    s.getState().beginPlacementDrag(id, { x: 3, z: 0.55 });
    s.getState().updatePlacementDrag({ x: 3, z: 2.55 });
    s.getState().endPlacementDrag();

    expect(s.getState().scene.placements[0]!.position.z).toBeGreaterThan(1.5);
  });
});
