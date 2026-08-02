import { describe, expect, it } from "vitest";
import { CATALOG, findCatalogItem } from "./catalog";
import { createEditorStore, livePlacements, livePolygon } from "./store";

const square = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 3 },
  { x: 0, z: 3 },
];

function storeWithRoom() {
  const store = createEditorStore();
  for (const point of square) store.getState().addDraftPoint(point);
  store.getState().closeDraft();
  return store;
}

describe("catalog", () => {
  it("uses unique ids", () => {
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
  });

  it("gives every item positive dimensions", () => {
    for (const item of CATALOG) {
      expect(item.footprint.w).toBeGreaterThan(0);
      expect(item.footprint.d).toBeGreaterThan(0);
      expect(item.height).toBeGreaterThan(0);
    }
  });

  it("looks items up by id", () => {
    expect(findCatalogItem("sofa-3")?.name).toBe("Sofa (3 seat)");
    expect(findCatalogItem("nope")).toBeUndefined();
  });
});

describe("placing furniture", () => {
  it("drops a piece at the room centre and selects it", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("sofa-3");

    const placement = store.getState().scene.placements[0];
    expect(placement?.catalogItemId).toBe("sofa-3");
    expect(placement?.position).toEqual({ x: 2, y: 0, z: 1.5 });
    expect(placement?.rotationY).toBe(0);
    expect(store.getState().selectedId).toBe(placement?.id);
  });

  it("records an undoable command", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("sofa-3");
    expect(store.getState().past.at(-1)?.label).toBe("Add Sofa (3 seat)");

    store.getState().undo();
    expect(store.getState().scene.placements).toHaveLength(0);

    store.getState().redo();
    expect(store.getState().scene.placements).toHaveLength(1);
  });

  it("gives each piece a distinct id", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("dining-chair");
    store.getState().placeFurniture("dining-chair");
    const [a, b] = store.getState().scene.placements;
    expect(a?.id).not.toBe(b?.id);
  });

  it("ignores an unknown catalog id", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("nope");
    expect(store.getState().scene.placements).toHaveLength(0);
    expect(store.getState().past).toHaveLength(1);
  });
});

describe("deleting furniture", () => {
  it("removes the selection and clears it", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().deleteSelected();

    expect(store.getState().scene.placements).toHaveLength(0);
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().past.at(-1)?.label).toBe("Delete Desk");
  });

  it("restores at the original index on undo", () => {
    const store = storeWithRoom();
    for (const id of ["sofa-3", "desk", "wardrobe"]) store.getState().placeFurniture(id);

    const middle = store.getState().scene.placements[1]!;
    store.getState().selectPlacement(middle.id);
    store.getState().deleteSelected();
    store.getState().undo();

    expect(store.getState().scene.placements.map((p) => p.catalogItemId)).toEqual([
      "sofa-3",
      "desk",
      "wardrobe",
    ]);
  });

  it("does nothing without a selection", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().selectPlacement(null);
    store.getState().deleteSelected();
    expect(store.getState().scene.placements).toHaveLength(1);
  });

  it("refuses to delete a locked piece", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    const id = store.getState().scene.placements[0]!.id;
    store.setState((state) => ({
      scene: {
        ...state.scene,
        placements: state.scene.placements.map((p) => ({ ...p, locked: true })),
      },
    }));

    store.getState().selectPlacement(id);
    store.getState().deleteSelected();
    expect(store.getState().scene.placements).toHaveLength(1);
  });
});

describe("rotating furniture", () => {
  it("rotates the selection and is undoable", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().rotateSelected(Math.PI / 2);

    expect(store.getState().scene.placements[0]?.rotationY).toBeCloseTo(Math.PI / 2);

    store.getState().undo();
    expect(store.getState().scene.placements[0]?.rotationY).toBeCloseTo(0);
  });

  it("accumulates across repeated turns", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().rotateSelected(Math.PI / 12);
    store.getState().rotateSelected(Math.PI / 12);
    expect(store.getState().scene.placements[0]?.rotationY).toBeCloseTo(Math.PI / 6);
  });

  it("does nothing without a selection", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().selectPlacement(null);
    store.getState().rotateSelected(1);
    expect(store.getState().scene.placements[0]?.rotationY).toBe(0);
  });
});

describe("dragging furniture", () => {
  function storeWithSofa() {
    const store = storeWithRoom();
    store.getState().placeFurniture("sofa-3");
    return store;
  }

  /** Drags bypass wall snapping; snapping has its own tests. */
  const dragTo = (s: ReturnType<typeof storeWithSofa>, x: number, z: number) =>
    s.getState().updatePlacementDrag({ x, z }, true);

  it("keeps the grab offset instead of centring on the pointer", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    // Piece sits at (2, 1.5); grab it 0.5m to its right.
    store.getState().beginPlacementDrag(id, { x: 2.5, z: 1.5 });
    store.getState().updatePlacementDrag({ x: 3.5, z: 1.5 }, true);

    // Pointer moved 1m, so the piece moves 1m, not to the pointer itself.
    expect(livePlacements(store.getState())[0]?.position).toEqual({
      x: 3,
      y: 0,
      z: 1.5,
    });
  });

  it("re-renders live without touching the scene or history", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    dragTo(store, 3, 2);

    expect(livePlacements(store.getState())[0]?.position.x).toBeCloseTo(3);
    expect(store.getState().scene.placements[0]?.position.x).toBeCloseTo(2);
    expect(store.getState().past).toHaveLength(2);
  });

  it("snaps to the grid", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    dragTo(store, 2.937, 1.53);

    const position = livePlacements(store.getState())[0]!.position;
    expect(position.x).toBeCloseTo(2.9);
    expect(position.z).toBeCloseTo(1.5);
  });

  it("stays on the floor plane", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    dragTo(store, 3, 2);
    store.getState().endPlacementDrag();
    expect(store.getState().scene.placements[0]?.position.y).toBe(0);
  });

  it("records exactly one history entry per gesture", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    for (const x of [2.5, 3, 3.5]) dragTo(store, x, 1.5);
    store.getState().endPlacementDrag();

    expect(store.getState().past).toHaveLength(3);
    expect(store.getState().past.at(-1)?.label).toBe("Move furniture");
    expect(store.getState().scene.placements[0]?.position.x).toBeCloseTo(3.5);
    expect(store.getState().placementDrag).toBeNull();
  });

  it("records nothing when the piece did not move", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    store.getState().endPlacementDrag();
    expect(store.getState().past).toHaveLength(2);
  });

  it("undoes back to the original position", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    dragTo(store, 3, 2);
    store.getState().endPlacementDrag();
    store.getState().undo();

    expect(store.getState().scene.placements[0]?.position).toEqual({
      x: 2,
      y: 0,
      z: 1.5,
    });
  });

  it("refuses to drag a locked piece", () => {
    const store = storeWithSofa();
    const id = store.getState().scene.placements[0]!.id;
    store.setState((state) => ({
      scene: {
        ...state.scene,
        placements: state.scene.placements.map((p) => ({ ...p, locked: true })),
      },
    }));

    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    expect(store.getState().placementDrag).toBeNull();
  });

  it("ignores updates with no drag in progress", () => {
    const store = storeWithSofa();
    dragTo(store, 9, 9);
    store.getState().endPlacementDrag();
    expect(store.getState().scene.placements[0]?.position.x).toBeCloseTo(2);
  });

  it("leaves other pieces untouched", () => {
    const store = storeWithSofa();
    store.getState().placeFurniture("desk");
    const sofaId = store.getState().scene.placements[0]!.id;

    store.getState().beginPlacementDrag(sofaId, { x: 2, z: 1.5 });
    dragTo(store, 3, 1.5);

    expect(livePlacements(store.getState())[1]?.position.x).toBeCloseTo(2);
  });
});

describe("selector reference stability", () => {
  // A zustand selector is called several times per render. If it returns fresh
  // objects each time, useSyncExternalStore loops forever.
  it("livePolygon keeps element identity mid-drag, so it is safe with useShallow", () => {
    const store = storeWithRoom();
    store.getState().beginDrag(1);
    store.getState().updateDrag({ x: 6, z: 0 });

    const a = livePolygon(store.getState());
    const b = livePolygon(store.getState());
    expect(a).not.toBe(b);
    a.forEach((point, i) => expect(point).toBe(b[i]));
  });

  it("livePlacements builds fresh objects, so callers must memoize it", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("sofa-3");
    const id = store.getState().scene.placements[0]!.id;
    store.getState().beginPlacementDrag(id, { x: 2, z: 1.5 });
    store.getState().updatePlacementDrag({ x: 3, z: 1.5 }, true);

    const a = livePlacements(store.getState());
    const b = livePlacements(store.getState());
    expect(a[0]).not.toBe(b[0]);
    expect(a[0]).toEqual(b[0]);
  });

  it("livePlacements returns the stored array untouched when idle", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("sofa-3");
    expect(livePlacements(store.getState())).toBe(store.getState().scene.placements);
  });
});

describe("placements survive save and load", () => {
  it("clears the selection when a scene is replaced", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().replaceScene(store.getState().scene);
    expect(store.getState().selectedId).toBeNull();
  });
});

describe("click to place", () => {
  it("does nothing until an item is armed", () => {
    const s = storeWithRoom();
    expect(s.getState().placeFurnitureAt({ x: 1, z: 1 })).toBe(false);
    expect(s.getState().scene.placements).toHaveLength(0);
  });

  it("places where the click landed, not at the room centre", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    // freeform, so this measures the click position rather than wall snapping.
    expect(s.getState().placeFurnitureAt({ x: 1.23, z: 0.57 }, true)).toBe(true);

    // Snapped to the 0.1m grid.
    expect(s.getState().scene.placements[0]?.position).toEqual({
      x: 1.2,
      y: 0,
      z: 0.6,
    });
  });

  it("selects the new piece and disarms", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 1, z: 1 });
    expect(s.getState().selectedId).toBe(s.getState().scene.placements[0]?.id);
    expect(s.getState().pendingFurniture).toBeNull();
    expect(s.getState().furnitureGhost).toBeNull();
  });

  it("stacks nothing: two pieces land where each was clicked", () => {
    const s = storeWithRoom();
    for (const [id, x] of [["desk", 1], ["dining-chair", 3]] as const) {
      s.getState().armFurniture(id);
      s.getState().placeFurnitureAt({ x, z: 1 });
    }
    const xs = s.getState().scene.placements.map((p) => p.position.x);
    expect(xs).toEqual([1, 3]);
  });

  it("is undoable", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 1, z: 1 });
    s.getState().undo();
    expect(s.getState().scene.placements).toHaveLength(0);
  });

  it("ignores an unknown catalog id", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("nope");
    expect(s.getState().placeFurnitureAt({ x: 1, z: 1 })).toBe(false);
  });

  it("arming furniture disarms an opening, and the reverse", () => {
    const s = storeWithRoom();
    s.getState().armOpening("door");
    s.getState().armFurniture("desk");
    expect(s.getState().pendingOpening).toBeNull();

    s.getState().armOpening("window");
    expect(s.getState().pendingFurniture).toBeNull();
  });

  it("blocks vertex and furniture drags while armed", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().beginDrag(1);
    expect(s.getState().dragging).toBeNull();
  });
});

describe("duplicate", () => {
  it("copies the selection beside the original", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 1, z: 1 });
    s.getState().duplicateSelected();

    const [original, copy] = s.getState().scene.placements;
    expect(s.getState().scene.placements).toHaveLength(2);
    expect(copy?.catalogItemId).toBe("desk");
    expect(copy?.id).not.toBe(original?.id);
    // Offset so it is not hidden underneath.
    expect(copy!.position.x).toBeGreaterThan(original!.position.x);
    expect(copy!.position.z).toBeCloseTo(original!.position.z);
  });

  it("keeps rotation", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 1, z: 1 });
    s.getState().rotateSelected(Math.PI / 2);
    s.getState().duplicateSelected();
    expect(s.getState().scene.placements[1]?.rotationY).toBeCloseTo(Math.PI / 2);
  });

  it("selects the copy so repeats fan out", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("dining-chair");
    s.getState().placeFurnitureAt({ x: 1, z: 1 });
    s.getState().duplicateSelected();
    s.getState().duplicateSelected();

    const xs = s.getState().scene.placements.map((p) => p.position.x);
    expect(xs[2]).toBeGreaterThan(xs[1]!);
  });

  it("never copies the locked flag", () => {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 1, z: 1 });
    s.setState((state) => ({
      scene: {
        ...state.scene,
        placements: state.scene.placements.map((p) => ({ ...p, locked: true })),
      },
    }));
    s.getState().duplicateSelected();
    expect(s.getState().scene.placements[1]?.locked).toBe(false);
  });

  it("does nothing without a selection", () => {
    const s = storeWithRoom();
    s.getState().selectPlacement(null);
    s.getState().duplicateSelected();
    expect(s.getState().scene.placements).toHaveLength(0);
  });
});

describe("locking", () => {
  function storeWithDesk() {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);
    return s;
  }

  const desk = (s: ReturnType<typeof storeWithDesk>) =>
    s.getState().scene.placements[0]!;

  it("toggles and is undoable", () => {
    const s = storeWithDesk();
    expect(desk(s).locked).toBe(false);

    s.getState().toggleSelectedLock();
    expect(desk(s).locked).toBe(true);
    expect(s.getState().past.at(-1)?.label).toBe("Lock furniture");

    s.getState().undo();
    expect(desk(s).locked).toBe(false);
  });

  it("toggles back off", () => {
    const s = storeWithDesk();
    s.getState().toggleSelectedLock();
    s.getState().toggleSelectedLock();
    expect(desk(s).locked).toBe(false);
    expect(s.getState().past.at(-1)?.label).toBe("Unlock furniture");
  });

  it("blocks moving, rotating and deleting once locked", () => {
    const s = storeWithDesk();
    s.getState().toggleSelectedLock();
    const before = desk(s);

    s.getState().beginPlacementDrag(before.id, { x: 2, z: 1.5 });
    expect(s.getState().placementDrag).toBeNull();

    s.getState().setSelectedRotation(1);
    s.getState().rotateSelected(1);
    expect(desk(s).rotationY).toBe(before.rotationY);

    s.getState().deleteSelected();
    expect(s.getState().scene.placements).toHaveLength(1);
  });

  it("does nothing without a selection", () => {
    const s = storeWithDesk();
    s.getState().selectPlacement(null);
    s.getState().toggleSelectedLock();
    expect(desk(s).locked).toBe(false);
  });
});

describe("absolute rotation", () => {
  function storeWithDesk() {
    const s = storeWithRoom();
    s.getState().armFurniture("desk");
    s.getState().placeFurnitureAt({ x: 2, z: 1.5 }, true);
    return s;
  }

  it("sets the angle rather than adding to it", () => {
    const s = storeWithDesk();
    s.getState().setSelectedRotation(Math.PI / 2);
    s.getState().setSelectedRotation(Math.PI / 4);
    expect(s.getState().scene.placements[0]?.rotationY).toBeCloseTo(Math.PI / 4);
  });

  it("collapses a slider drag into one history entry", () => {
    const s = storeWithDesk();
    const before = s.getState().past.length;
    for (const angle of [0.2, 0.4, 0.6, 0.8]) s.getState().setSelectedRotation(angle);
    expect(s.getState().past).toHaveLength(before + 1);
  });

  it("undoes the whole drag at once", () => {
    const s = storeWithDesk();
    for (const angle of [0.2, 0.4, 0.6]) s.getState().setSelectedRotation(angle);
    s.getState().undo();
    expect(s.getState().scene.placements[0]?.rotationY).toBe(0);
  });

  it("records nothing when the angle is unchanged", () => {
    const s = storeWithDesk();
    const before = s.getState().past.length;
    s.getState().setSelectedRotation(0);
    expect(s.getState().past).toHaveLength(before);
  });
});
