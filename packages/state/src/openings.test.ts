import { describe, expect, it } from "vitest";
import { createEditorStore } from "./store";

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

const wallsOf = (s: ReturnType<typeof storeWithRoom>) => s.getState().scene.room.walls;

describe("arming", () => {
  it("starts unarmed and toggles", () => {
    const s = storeWithRoom();
    expect(s.getState().pendingOpening).toBeNull();
    s.getState().armOpening("door");
    expect(s.getState().pendingOpening).toBe("door");
  });

  it("does nothing when unarmed", () => {
    const s = storeWithRoom();
    expect(s.getState().placeOpeningAt({ x: 3, z: 0 })).toBe(false);
    expect(wallsOf(s).flatMap((w) => w.openings)).toHaveLength(0);
  });

  it("disarms after placing", () => {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x: 3, z: 0 });
    expect(s.getState().pendingOpening).toBeNull();
  });
});

describe("placing", () => {
  it("adds to the wall nearest the click", () => {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    expect(s.getState().placeOpeningAt({ x: 3, z: 0.05 })).toBe(true);
    expect(wallsOf(s)[0]?.openings).toHaveLength(1);
    expect(wallsOf(s)[1]?.openings).toHaveLength(0);
  });

  it("centres the opening on the click", () => {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x: 3, z: 0 });
    // Door is 0.9 wide, so a click at 3m starts it at 2.55m.
    expect(wallsOf(s)[0]?.openings[0]?.offset).toBeCloseTo(2.55);
  });

  it("pulls an opening back inside the wall near a corner", () => {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x: 0, z: 0 });
    expect(wallsOf(s)[0]?.openings[0]?.offset).toBe(0);

    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x: 6, z: 0 });
    const last = wallsOf(s)[0]?.openings.at(-1);
    expect(last?.offset).toBeCloseTo(6 - 0.9);
  });

  it("uses standard sizes per type", () => {
    const s = storeWithRoom();
    s.getState().armOpening("window");
    s.getState().placeOpeningAt({ x: 3, z: 0 });
    const opening = wallsOf(s)[0]?.openings[0];
    expect(opening?.width).toBeCloseTo(1.2);
    expect(opening?.sillHeight).toBeCloseTo(0.9);
  });

  it("gives each opening a distinct id", () => {
    const s = storeWithRoom();
    for (const x of [1, 4]) {
      s.getState().armOpening("door");
      s.getState().placeOpeningAt({ x, z: 0 });
    }
    const [a, b] = wallsOf(s)[0]!.openings;
    expect(a?.id).not.toBe(b?.id);
  });

  it("refuses a wall too short for the opening", () => {
    const s = createEditorStore();
    for (const point of [
      { x: 0, z: 0 },
      { x: 0.5, z: 0 },
      { x: 0.5, z: 3 },
      { x: 0, z: 3 },
    ]) {
      s.getState().addDraftPoint(point);
    }
    s.getState().closeDraft();
    s.getState().armOpening("door");
    expect(s.getState().placeOpeningAt({ x: 0.25, z: 0 })).toBe(false);
  });

  it("refuses an opening taller than the wall", () => {
    const s = storeWithRoom();
    s.getState().applyWallSettings({ height: 1.9 });
    s.getState().armOpening("door");
    expect(s.getState().placeOpeningAt({ x: 3, z: 0 })).toBe(false);
  });

  it("is undoable", () => {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x: 3, z: 0 });
    expect(s.getState().past.at(-1)?.label).toBe("Add door");

    s.getState().undo();
    expect(wallsOf(s)[0]?.openings).toHaveLength(0);
    s.getState().redo();
    expect(wallsOf(s)[0]?.openings).toHaveLength(1);
  });
});

describe("deleting", () => {
  it("removes and restores in place", () => {
    const s = storeWithRoom();
    for (const x of [1, 3, 5]) {
      s.getState().armOpening("door");
      s.getState().placeOpeningAt({ x, z: 0 });
    }
    const middle = wallsOf(s)[0]!.openings[1]!;
    s.getState().deleteOpening(0, middle.id);
    expect(wallsOf(s)[0]?.openings).toHaveLength(2);

    s.getState().undo();
    expect(wallsOf(s)[0]?.openings[1]?.id).toBe(middle.id);
  });

  it("ignores an unknown id or wall", () => {
    const s = storeWithRoom();
    s.getState().deleteOpening(0, "nope");
    s.getState().deleteOpening(99, "nope");
    expect(s.getState().past).toHaveLength(1);
  });
});

describe("persistence", () => {
  it("survives a scene replacement and clears the armed type", () => {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x: 3, z: 0 });
    s.getState().replaceScene(s.getState().scene);
    expect(wallsOf(s)[0]?.openings).toHaveLength(1);
    expect(s.getState().pendingOpening).toBeNull();
  });
});

describe("editing", () => {
  function storeWithDoor() {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x: 3, z: 0 });
    return s;
  }

  const opening = (s: ReturnType<typeof storeWithRoom>) =>
    s.getState().scene.room.walls[0]!.openings[0]!;

  it("selects the opening it just placed", () => {
    const s = storeWithDoor();
    expect(s.getState().selectedOpening).toEqual({
      wallIndex: 0,
      id: opening(s).id,
    });
  });

  it("moves along the wall", () => {
    const s = storeWithDoor();
    s.getState().updateSelectedOpening({ offset: 1 });
    expect(opening(s).offset).toBeCloseTo(1);
  });

  it("clamps rather than refusing, unlike placement", () => {
    const s = storeWithDoor();
    s.getState().updateSelectedOpening({ offset: 99 });
    // Wall is 6m, door is 0.9m wide.
    expect(opening(s).offset).toBeCloseTo(5.1);

    s.getState().updateSelectedOpening({ offset: -5 });
    expect(opening(s).offset).toBe(0);
  });

  it("keeps width within the wall and above the minimum", () => {
    const s = storeWithDoor();
    s.getState().updateSelectedOpening({ width: 99 });
    expect(opening(s).width).toBeCloseTo(6);

    s.getState().updateSelectedOpening({ width: 0.01 });
    expect(opening(s).width).toBeCloseTo(0.3);
  });

  it("never lets sill plus height exceed the wall", () => {
    const s = storeWithDoor();
    s.getState().updateSelectedOpening({ sillHeight: 99 });
    const o = opening(s);
    expect(o.sillHeight + o.height).toBeLessThanOrEqual(2.5 + 1e-9);
  });

  it("pulls the opening back when width grows past the end", () => {
    const s = storeWithDoor();
    s.getState().updateSelectedOpening({ offset: 5.1 });
    s.getState().updateSelectedOpening({ width: 2 });
    const o = opening(s);
    expect(o.offset + o.width).toBeLessThanOrEqual(6 + 1e-9);
  });

  it("merges a slider drag into one history entry", () => {
    const s = storeWithDoor();
    const before = s.getState().past.length;
    for (const offset of [1, 1.5, 2, 2.5]) {
      s.getState().updateSelectedOpening({ offset });
    }
    expect(s.getState().past).toHaveLength(before + 1);
  });

  it("does not merge across different fields", () => {
    const s = storeWithDoor();
    const before = s.getState().past.length;
    s.getState().updateSelectedOpening({ offset: 1 });
    s.getState().updateSelectedOpening({ width: 1.2 });
    expect(s.getState().past).toHaveLength(before + 2);
  });

  it("undoes a whole drag at once", () => {
    const s = storeWithDoor();
    const original = opening(s).offset;
    for (const offset of [1, 2, 3]) s.getState().updateSelectedOpening({ offset });
    s.getState().undo();
    expect(opening(s).offset).toBeCloseTo(original);
  });

  it("records nothing when the value does not change", () => {
    const s = storeWithDoor();
    const before = s.getState().past.length;
    s.getState().updateSelectedOpening({ offset: opening(s).offset });
    expect(s.getState().past).toHaveLength(before);
  });

  it("does nothing without a selection", () => {
    const s = storeWithDoor();
    s.getState().selectOpening(null);
    const before = s.getState().past.length;
    s.getState().updateSelectedOpening({ offset: 1 });
    expect(s.getState().past).toHaveLength(before);
  });

  it("clears the selection when the opening is deleted", () => {
    const s = storeWithDoor();
    s.getState().deleteOpening(0, opening(s).id);
    expect(s.getState().selectedOpening).toBeNull();
  });
});

describe("surviving a vertex drag", () => {
  function storeWithDoorOn(wallIndex: number, x: number, z: number) {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().placeOpeningAt({ x, z });
    expect(s.getState().scene.room.walls[wallIndex]!.openings).toHaveLength(1);
    return s;
  }

  it("keeps openings when a vertex moves", () => {
    // Regression: rebuilding walls from the polygon used to drop every opening.
    const s = storeWithDoorOn(0, 3, 0);
    s.getState().beginDrag(1);
    s.getState().updateDrag({ x: 7, z: 0 });
    s.getState().endDrag();

    expect(s.getState().scene.room.walls[0]!.openings).toHaveLength(1);
  });

  it("keeps openings on walls the drag did not touch", () => {
    const s = storeWithDoorOn(2, 3, 4);
    s.getState().beginDrag(0);
    s.getState().updateDrag({ x: -1, z: 0 });
    s.getState().endDrag();
    expect(s.getState().scene.room.walls[2]!.openings).toHaveLength(1);
  });

  it("pulls an opening back inside a shortened wall", () => {
    const s = storeWithDoorOn(0, 5.5, 0);
    const before = s.getState().scene.room.walls[0]!.openings[0]!;
    expect(before.offset).toBeCloseTo(5.05);

    // Shrink wall 0 from 6m to 3m.
    s.getState().beginDrag(1);
    s.getState().updateDrag({ x: 3, z: 0 });
    s.getState().endDrag();

    const after = s.getState().scene.room.walls[0]!.openings[0]!;
    expect(after.offset + after.width).toBeLessThanOrEqual(3 + 1e-9);
  });

  it("restores the exact original offset on undo, not the clamped one", () => {
    const s = storeWithDoorOn(0, 5.5, 0);
    const original = s.getState().scene.room.walls[0]!.openings[0]!.offset;

    s.getState().beginDrag(1);
    s.getState().updateDrag({ x: 3, z: 0 });
    s.getState().endDrag();
    s.getState().undo();

    expect(s.getState().scene.room.walls[0]!.openings[0]!.offset).toBeCloseTo(original);
  });

  it("keeps opening ids stable across the move", () => {
    const s = storeWithDoorOn(0, 3, 0);
    const id = s.getState().scene.room.walls[0]!.openings[0]!.id;
    s.getState().beginDrag(1);
    s.getState().updateDrag({ x: 7, z: 0 });
    s.getState().endDrag();
    expect(s.getState().scene.room.walls[0]!.openings[0]!.id).toBe(id);
  });
});
