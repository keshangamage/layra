import { describe, expect, it } from "vitest";
import { CATALOG, findCatalogItem } from "./catalog";
import { createEditorStore } from "./store";

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

describe("placements survive save and load", () => {
  it("clears the selection when a scene is replaced", () => {
    const store = storeWithRoom();
    store.getState().placeFurniture("desk");
    store.getState().replaceScene(store.getState().scene);
    expect(store.getState().selectedId).toBeNull();
  });
});
