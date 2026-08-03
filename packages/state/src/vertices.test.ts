import { describe, expect, it } from "vitest";
import { activeRoom, createEditorStore } from "./store";

/** 6m x 4m room, walls indexed to match the polygon. */
const square = [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 4 },
  { x: 0, z: 4 },
];

function storeWithRoom() {
  const store = createEditorStore();
  for (const point of square) store.getState().addDraftPoint(point);
  store.getState().closeDraft();
  return store;
}

type Store = ReturnType<typeof storeWithRoom>;

const polygonOf = (s: Store) => activeRoom(s.getState()).polygon;
const wallsOf = (s: Store) => activeRoom(s.getState()).walls;
const openingCount = (s: Store) =>
  wallsOf(s).reduce((sum, wall) => sum + wall.openings.length, 0);

function addDoor(s: Store, x: number, z: number) {
  s.getState().armOpening("door");
  s.getState().placeOpeningAt({ x, z });
}

describe("adding a corner", () => {
  it("splits the wall nearest the click", () => {
    const s = storeWithRoom();
    expect(s.getState().addVertexAt({ x: 3, z: 0.05 })).toBe(true);
    expect(polygonOf(s)).toHaveLength(5);
    expect(wallsOf(s)).toHaveLength(5);
  });

  it("inserts the corner in wall order, not at the end", () => {
    const s = storeWithRoom();
    s.getState().addVertexAt({ x: 3, z: 0 });
    expect(polygonOf(s)[1]).toEqual({ x: 3, z: 0 });
  });

  it("snaps the new corner to the grid", () => {
    const s = storeWithRoom();
    s.getState().addVertexAt({ x: 3.04, z: 0.02 });
    expect(polygonOf(s)[1]).toEqual({ x: 3, z: 0 });
  });

  it("refuses a corner on top of an existing one", () => {
    const s = storeWithRoom();
    expect(s.getState().addVertexAt({ x: 0.02, z: 0 })).toBe(false);
    expect(s.getState().addVertexAt({ x: 5.99, z: 0 })).toBe(false);
    expect(polygonOf(s)).toHaveLength(4);
  });

  it("is undoable", () => {
    const s = storeWithRoom();
    s.getState().addVertexAt({ x: 3, z: 0 });
    expect(s.getState().past.at(-1)?.label).toBe("Add corner");
    s.getState().undo();
    expect(polygonOf(s)).toEqual(square);
  });

  it("does nothing without a room", () => {
    const s = createEditorStore();
    expect(s.getState().addVertexAt({ x: 1, z: 1 })).toBe(false);
  });
});

describe("adding a corner near openings", () => {
  it("keeps a door on the half that still contains it", () => {
    const s = storeWithRoom();
    addDoor(s, 1, 0);
    expect(wallsOf(s)[0]?.openings).toHaveLength(1);

    // Split at 4m; the door sits around 0.55-1.45m, well inside the first half.
    s.getState().addVertexAt({ x: 4, z: 0 });
    expect(wallsOf(s)[0]?.openings).toHaveLength(1);
    expect(wallsOf(s)[1]?.openings).toHaveLength(0);
  });

  it("re-offsets a door that lands on the second half", () => {
    const s = storeWithRoom();
    addDoor(s, 5, 0);
    const before = wallsOf(s)[0]!.openings[0]!.offset;

    s.getState().addVertexAt({ x: 2, z: 0 });
    const moved = wallsOf(s)[1]?.openings[0];
    expect(moved).toBeDefined();
    // Measured from the new wall's own start.
    expect(moved!.offset).toBeCloseTo(before - 2);
  });

  it("drops a door the split would cut in half", () => {
    const s = storeWithRoom();
    addDoor(s, 3, 0);
    expect(openingCount(s)).toBe(1);

    s.getState().addVertexAt({ x: 3, z: 0 });
    expect(openingCount(s)).toBe(0);
  });

  it("leaves openings on other walls alone", () => {
    const s = storeWithRoom();
    addDoor(s, 3, 4);
    expect(wallsOf(s)[2]?.openings).toHaveLength(1);

    s.getState().addVertexAt({ x: 3, z: 0 });
    // That wall is now index 3, one later.
    expect(wallsOf(s)[3]?.openings).toHaveLength(1);
  });

  it("restores a dropped door on undo", () => {
    const s = storeWithRoom();
    addDoor(s, 3, 0);
    const original = wallsOf(s)[0]!.openings[0]!;

    s.getState().addVertexAt({ x: 3, z: 0 });
    expect(openingCount(s)).toBe(0);

    s.getState().undo();
    expect(wallsOf(s)[0]?.openings[0]).toEqual(original);
  });
});

describe("removing a corner", () => {
  it("merges the two walls that met there", () => {
    const s = storeWithRoom();
    s.getState().selectVertex(1);
    expect(s.getState().deleteSelectedVertex()).toBe(true);
    expect(polygonOf(s)).toHaveLength(3);
    expect(wallsOf(s)).toHaveLength(3);
  });

  it("keeps a room at three corners", () => {
    const s = storeWithRoom();
    s.getState().selectVertex(1);
    s.getState().deleteSelectedVertex();

    s.getState().selectVertex(0);
    expect(s.getState().deleteSelectedVertex()).toBe(false);
    expect(polygonOf(s)).toHaveLength(3);
  });

  it("does nothing without a selection", () => {
    const s = storeWithRoom();
    expect(s.getState().deleteSelectedVertex()).toBe(false);
  });

  it("clears the selection", () => {
    const s = storeWithRoom();
    s.getState().selectVertex(1);
    s.getState().deleteSelectedVertex();
    expect(s.getState().selectedVertex).toBeNull();
  });

  it("drops openings on the merged pair but keeps the rest", () => {
    const s = storeWithRoom();
    addDoor(s, 3, 0); // wall 0
    addDoor(s, 3, 4); // wall 2
    expect(openingCount(s)).toBe(2);

    // Removing corner 1 merges walls 0 and 1.
    s.getState().selectVertex(1);
    s.getState().deleteSelectedVertex();

    expect(openingCount(s)).toBe(1);
    expect(wallsOf(s).some((w) => w.openings.length === 1)).toBe(true);
  });

  it("handles removing the first corner, where the wrap-around wall merges", () => {
    const s = storeWithRoom();
    addDoor(s, 3, 4); // wall 2, untouched by the merge of walls 3 and 0
    s.getState().selectVertex(0);
    expect(s.getState().deleteSelectedVertex()).toBe(true);

    expect(polygonOf(s)).toHaveLength(3);
    expect(openingCount(s)).toBe(1);
  });

  it("is undoable, openings and all", () => {
    const s = storeWithRoom();
    addDoor(s, 3, 0);
    const original = wallsOf(s)[0]!.openings[0]!;

    s.getState().selectVertex(1);
    s.getState().deleteSelectedVertex();
    s.getState().undo();

    expect(polygonOf(s)).toEqual(square);
    expect(wallsOf(s)[0]?.openings[0]).toEqual(original);
  });
});
